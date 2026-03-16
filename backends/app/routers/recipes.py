from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.recipe import Recipe, Ingredient, RecipeIngredient, Tag, RecipeRating
from app.schemas.recipe import (
    RecipeCreate, RecipeUpdate, RecipeOut,
    IngredientCreate, IngredientOut,
    TagCreate, TagOut,
    RecipeRatingOut, RecipeRatingUpsert,
    RecipeExportItem, RecipeExportIngredient, RecipeImportResult,
    RecipeUrlImport, RecipeUrlPreview,
)

router = APIRouter(prefix="/recipes", tags=["recipes"])


def _get_or_create_ingredient(db: Session, ingredient_id: int) -> Ingredient:
    ingredient = db.get(Ingredient, ingredient_id)
    if not ingredient:
        raise HTTPException(status_code=404, detail=f"Ingredient {ingredient_id} not found")
    return ingredient


def _apply_tags(db: Session, recipe: Recipe, tag_ids: list[int]) -> None:
    tags = [db.get(Tag, tid) for tid in tag_ids]
    recipe.tags = [t for t in tags if t is not None]


# --- Ingredients ---

@router.get("/ingredients", response_model=list[IngredientOut])
def list_ingredients(db: Session = Depends(get_db)):
    return db.query(Ingredient).order_by(Ingredient.name).all()


@router.post("/ingredients", response_model=IngredientOut, status_code=status.HTTP_201_CREATED)
def create_ingredient(payload: IngredientCreate, db: Session = Depends(get_db)):
    existing = db.query(Ingredient).filter(Ingredient.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=409, detail="Ingredient already exists")
    ingredient = Ingredient(name=payload.name)
    db.add(ingredient)
    db.commit()
    db.refresh(ingredient)
    return ingredient


# --- Tags ---

@router.get("/tags", response_model=list[TagOut])
def list_tags(db: Session = Depends(get_db)):
    return db.query(Tag).order_by(Tag.is_predefined.desc(), Tag.name).all()


@router.post("/tags", response_model=TagOut, status_code=status.HTTP_201_CREATED)
def create_tag(payload: TagCreate, db: Session = Depends(get_db)):
    existing = db.query(Tag).filter(Tag.name == payload.name).first()
    if existing:
        return existing
    tag = Tag(name=payload.name, is_predefined=False)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag


# --- Recipes ---

@router.get("", response_model=list[RecipeOut])
def list_recipes(db: Session = Depends(get_db)):
    return db.query(Recipe).order_by(Recipe.name).all()


@router.post("", response_model=RecipeOut, status_code=status.HTTP_201_CREATED)
def create_recipe(payload: RecipeCreate, db: Session = Depends(get_db)):
    recipe = Recipe(
        name=payload.name,
        description=payload.description,
        servings=payload.servings,
        prep_time_minutes=payload.prep_time_minutes,
    )
    db.add(recipe)
    db.flush()

    for item in payload.ingredients:
        _get_or_create_ingredient(db, item.ingredient_id)
        db.add(RecipeIngredient(
            recipe_id=recipe.id,
            ingredient_id=item.ingredient_id,
            amount=item.amount,
            unit=item.unit,
        ))

    _apply_tags(db, recipe, payload.tag_ids)

    db.commit()
    db.refresh(recipe)
    return recipe


@router.get("/export", response_model=list[RecipeExportItem])
def export_recipes(db: Session = Depends(get_db)):
    recipes = db.query(Recipe).order_by(Recipe.name).all()
    return [
        RecipeExportItem(
            name=r.name,
            description=r.description,
            servings=r.servings,
            prep_time_minutes=r.prep_time_minutes,
            ingredients=[
                RecipeExportIngredient(
                    ingredient_name=ri.ingredient.name,
                    amount=ri.amount,
                    unit=ri.unit,
                )
                for ri in r.ingredients
            ],
        )
        for r in recipes
    ]


@router.post("/import", response_model=RecipeImportResult)
def import_recipes(recipes: list[RecipeExportItem], db: Session = Depends(get_db)):
    created = 0
    skipped = 0
    for item in recipes:
        if db.query(Recipe).filter(Recipe.name == item.name).first():
            skipped += 1
            continue
        recipe = Recipe(
            name=item.name,
            description=item.description,
            servings=item.servings,
            prep_time_minutes=item.prep_time_minutes,
        )
        db.add(recipe)
        db.flush()
        for ing in item.ingredients:
            ingredient = db.query(Ingredient).filter(Ingredient.name == ing.ingredient_name).first()
            if not ingredient:
                ingredient = Ingredient(name=ing.ingredient_name)
                db.add(ingredient)
                db.flush()
            db.add(RecipeIngredient(
                recipe_id=recipe.id,
                ingredient_id=ingredient.id,
                amount=ing.amount,
                unit=ing.unit,
            ))
        created += 1
    db.commit()
    return RecipeImportResult(created=created, skipped=skipped)


def _parse_iso_duration(duration: str) -> int | None:
    """Convert ISO 8601 duration (e.g. PT1H30M) to minutes."""
    import re
    if not duration:
        return None
    match = re.fullmatch(r'P(?:T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?', duration.upper())
    if not match:
        return None
    hours = int(match.group(1) or 0)
    minutes = int(match.group(2) or 0)
    total = hours * 60 + minutes
    return total if total > 0 else None


def _find_recipe_jsonld(data) -> dict | None:
    """Recursively find a @type: Recipe object in JSON-LD data."""
    if isinstance(data, list):
        for item in data:
            result = _find_recipe_jsonld(item)
            if result:
                return result
    elif isinstance(data, dict):
        type_val = data.get("@type", "")
        if isinstance(type_val, str) and type_val.lower() == "recipe":
            return data
        if isinstance(type_val, list) and any(t.lower() == "recipe" for t in type_val):
            return data
        if "@graph" in data:
            return _find_recipe_jsonld(data["@graph"])
    return None


def _scrape_recipe_url(url: str) -> dict:
    """Fetch a page and extract recipe data from JSON-LD structured data."""
    import json
    import requests
    from html.parser import HTMLParser

    class _JsonLdExtractor(HTMLParser):
        def __init__(self):
            super().__init__()
            self._in_block = False
            self.blocks: list[str] = []
            self._buf: list[str] = []

        def handle_starttag(self, tag, attrs):
            if tag == "script" and dict(attrs).get("type") == "application/ld+json":
                self._in_block = True
                self._buf = []

        def handle_endtag(self, tag):
            if tag == "script" and self._in_block:
                self._in_block = False
                self.blocks.append("".join(self._buf))

        def handle_data(self, data):
            if self._in_block:
                self._buf.append(data)

    resp = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
    resp.raise_for_status()

    parser = _JsonLdExtractor()
    parser.feed(resp.text)

    for block in parser.blocks:
        try:
            recipe = _find_recipe_jsonld(json.loads(block))
            if recipe:
                return recipe
        except (ValueError, KeyError):
            continue

    raise ValueError("Keine Rezeptdaten (JSON-LD) auf der Seite gefunden")


@router.post("/import/url", response_model=RecipeUrlPreview)
def import_recipe_from_url(payload: RecipeUrlImport):
    try:
        recipe_data = _scrape_recipe_url(payload.url)
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Rezept konnte nicht ausgelesen werden: {exc}",
        )

    name = recipe_data.get("name", "Unbekanntes Rezept")
    if isinstance(name, list):
        name = name[0] if name else "Unbekanntes Rezept"

    try:
        description = recipe_data.get("description") or None
    except Exception:
        description = None

    raw_ingredients: list[RecipeExportIngredient] = []
    try:
        for line in (recipe_data.get("recipeIngredient") or []):
            line = str(line).strip()
            if not line:
                continue
            parts = line.split(None, 2)
            if len(parts) == 3:
                try:
                    amount = float(parts[0].replace(",", "."))
                    raw_ingredients.append(
                        RecipeExportIngredient(ingredient_name=parts[2], amount=amount, unit=parts[1])
                    )
                    continue
                except ValueError:
                    pass
            raw_ingredients.append(
                RecipeExportIngredient(ingredient_name=line, amount=1.0, unit="Stück")
            )
    except Exception:
        pass

    try:
        raw_time = recipe_data.get("totalTime") or recipe_data.get("prepTime")
        prep_minutes = _parse_iso_duration(raw_time) if raw_time else None
    except Exception:
        prep_minutes = None

    try:
        yields_raw = recipe_data.get("recipeYield")
        if isinstance(yields_raw, list):
            yields_raw = yields_raw[0] if yields_raw else None
        servings = int(str(yields_raw).split()[0]) if yields_raw else 2
    except Exception:
        servings = 2

    return RecipeUrlPreview(
        name=name,
        description=description,
        servings=servings,
        prep_time_minutes=prep_minutes,
        ingredients=raw_ingredients,
    )


@router.get("/{recipe_id}", response_model=RecipeOut)
def get_recipe(recipe_id: int, db: Session = Depends(get_db)):
    recipe = db.get(Recipe, recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe


@router.patch("/{recipe_id}", response_model=RecipeOut)
def update_recipe(recipe_id: int, payload: RecipeUpdate, db: Session = Depends(get_db)):
    recipe = db.get(Recipe, recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    for field, value in payload.model_dump(exclude_unset=True, exclude={"ingredients", "tag_ids"}).items():
        setattr(recipe, field, value)

    if payload.ingredients is not None:
        db.query(RecipeIngredient).filter(RecipeIngredient.recipe_id == recipe_id).delete()
        for item in payload.ingredients:
            _get_or_create_ingredient(db, item.ingredient_id)
            db.add(RecipeIngredient(
                recipe_id=recipe.id,
                ingredient_id=item.ingredient_id,
                amount=item.amount,
                unit=item.unit,
            ))

    if payload.tag_ids is not None:
        _apply_tags(db, recipe, payload.tag_ids)

    db.commit()
    db.refresh(recipe)
    return recipe


@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recipe(recipe_id: int, db: Session = Depends(get_db)):
    recipe = db.get(Recipe, recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    db.delete(recipe)
    db.commit()


@router.post("/{recipe_id}/ratings", response_model=RecipeRatingOut)
def upsert_rating(recipe_id: int, payload: RecipeRatingUpsert, db: Session = Depends(get_db)):
    recipe = db.get(Recipe, recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    rating = db.query(RecipeRating).filter(
        RecipeRating.recipe_id == recipe_id,
        RecipeRating.user_id == payload.user_id,
    ).first()

    if rating:
        rating.stars = payload.stars
    else:
        rating = RecipeRating(recipe_id=recipe_id, user_id=payload.user_id, stars=payload.stars)
        db.add(rating)

    db.commit()
    db.refresh(rating)
    return rating
