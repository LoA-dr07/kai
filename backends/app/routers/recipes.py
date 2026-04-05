from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.recipe import Recipe, Ingredient, RecipeIngredient, Tag, RecipeRating
from app.models.user import User
from app.schemas.recipe import (
    RecipeCreate, RecipeUpdate, RecipeOut,
    IngredientCreate, IngredientUpdate, IngredientOut,
    RecipeIngredientUpdate, RecipeIngredientOut,
    TagCreate, TagOut,
    RecipeRatingOut, RecipeRatingUpsert,
    RecipeExportItem, RecipeExportIngredient, RecipeImportResult,
    RecipeUrlImport, RecipeUrlPreview,
)
from app.utils.recipe_scraper import (
    scrape_recipe_url as _scrape_recipe_url,
    parse_instructions as _parse_instructions,
    parse_iso_duration as _parse_iso_duration,
    parse_ingredients as _parse_ingredients,
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


def _set_recipe_ingredients(db: Session, recipe_id: int, ingredients) -> None:
    """Replace all RecipeIngredients for a recipe with the given list."""
    db.query(RecipeIngredient).filter(RecipeIngredient.recipe_id == recipe_id).delete()
    for item in ingredients:
        _get_or_create_ingredient(db, item.ingredient_id)
        db.add(RecipeIngredient(
            recipe_id=recipe_id,
            ingredient_id=item.ingredient_id,
            amount=item.amount,
            unit=item.unit,
        ))


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


@router.patch("/ingredients/{ingredient_id}", response_model=IngredientOut)
def update_ingredient(ingredient_id: int, payload: IngredientUpdate, db: Session = Depends(get_db)):
    ingredient = db.get(Ingredient, ingredient_id)
    if not ingredient:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    duplicate = db.query(Ingredient).filter(
        Ingredient.name == payload.name,
        Ingredient.id != ingredient_id,
    ).first()
    if duplicate:
        raise HTTPException(status_code=409, detail="Ingredient name already exists")
    ingredient.name = payload.name
    db.commit()
    db.refresh(ingredient)
    return ingredient


@router.patch("/{recipe_id}/ingredients/{recipe_ingredient_id}", response_model=RecipeIngredientOut)
def update_recipe_ingredient(
    recipe_id: int,
    recipe_ingredient_id: int,
    payload: RecipeIngredientUpdate,
    db: Session = Depends(get_db),
):
    ri = db.query(RecipeIngredient).filter(
        RecipeIngredient.id == recipe_ingredient_id,
        RecipeIngredient.recipe_id == recipe_id,
    ).first()
    if not ri:
        raise HTTPException(status_code=404, detail="RecipeIngredient not found")
    if payload.ingredient_id is not None:
        if not db.get(Ingredient, payload.ingredient_id):
            raise HTTPException(status_code=404, detail="Ingredient not found")
        ri.ingredient_id = payload.ingredient_id
    if payload.amount is not None:
        ri.amount = payload.amount
    if payload.unit is not None:
        ri.unit = payload.unit
    db.commit()
    db.refresh(ri)
    return ri


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

    _set_recipe_ingredients(db, recipe.id, payload.ingredients)
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
            source_url=r.source_url,
            ingredients=[
                RecipeExportIngredient(
                    ingredient_name=ri.ingredient.name,
                    amount=ri.amount,
                    unit=ri.unit,
                )
                for ri in r.ingredients
            ],
            ratings=[
                RecipeRatingOut(user_id=rating.user_id, stars=rating.stars)
                for rating in r.ratings
            ],
        )
        for r in recipes
    ]


@router.post("/import", response_model=RecipeImportResult)
def import_recipes(recipes: list[RecipeExportItem], db: Session = Depends(get_db)):
    created = 0
    skipped = 0
    created_ids: list[int] = []
    for item in recipes:
        if db.query(Recipe).filter(Recipe.name == item.name).first():
            skipped += 1
            continue
        recipe = Recipe(
            name=item.name,
            description=item.description,
            servings=item.servings,
            prep_time_minutes=item.prep_time_minutes,
            source_url=item.source_url,
        )
        db.add(recipe)
        db.flush()
        seen_ingredient_ids: set[int] = set()
        for ing in item.ingredients:
            ingredient = db.query(Ingredient).filter(Ingredient.name == ing.ingredient_name).first()
            if not ingredient:
                ingredient = Ingredient(name=ing.ingredient_name)
                db.add(ingredient)
                db.flush()
            if ingredient.id in seen_ingredient_ids:
                continue  # skip duplicate ingredient within the same recipe
            seen_ingredient_ids.add(ingredient.id)
            db.add(RecipeIngredient(
                recipe_id=recipe.id,
                ingredient_id=ingredient.id,
                amount=ing.amount,
                unit=ing.unit,
            ))
        for rating in item.ratings:
            if not db.get(User, rating.user_id):
                continue  # skip if user doesn't exist in this DB
            db.add(RecipeRating(
                recipe_id=recipe.id,
                user_id=rating.user_id,
                stars=rating.stars,
            ))
        created_ids.append(recipe.id)
        created += 1
    db.commit()
    return RecipeImportResult(created=created, skipped=skipped, created_ids=created_ids)


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

    author_raw = recipe_data.get("author")
    if isinstance(author_raw, list):
        author_raw = author_raw[0] if author_raw else None
    if isinstance(author_raw, dict):
        author_name = author_raw.get("name", "")
    elif isinstance(author_raw, str):
        author_name = author_raw
    else:
        author_name = ""
    if author_name and name.endswith(f" von {author_name}"):
        name = name[: -len(f" von {author_name}")].rstrip()

    try:
        description = _parse_instructions(recipe_data.get("recipeInstructions"))
        if not description:
            raw_desc = recipe_data.get("description")
            if isinstance(raw_desc, str):
                description = raw_desc.strip() or None
    except Exception:
        description = None

    try:
        raw_ingredients = _parse_ingredients(recipe_data.get("recipeIngredient") or [])
    except Exception:
        raw_ingredients = []

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
        source_url=payload.url,
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
        _set_recipe_ingredients(db, recipe.id, payload.ingredients)

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
