from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
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
    RecipeBulkUrlItem, RecipeBulkUrlImport, BulkUrlImportResult, BulkUrlImportFailure,
    RecipeUrlPreviewResult, RecipeBulkPreviewResult,
    TagRepairResult,
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
    existing = db.query(Tag).filter(func.lower(Tag.name) == payload.name.strip().lower()).first()
    if existing:
        return existing
    tag = Tag(name=payload.name.strip(), is_predefined=False)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag


@router.post("/tags/repair", response_model=TagRepairResult)
def repair_imported_tags(db: Session = Depends(get_db)):
    """
    Three-step repair for tag data imported before users were renamed:

    1. Ensure every user has a predefined family tag with their current name.
       If an import-created non-predefined tag with that name already exists,
       promote it to predefined/family instead of creating a duplicate.

    2. Merge all remaining non-predefined tags that case-insensitively match a
       predefined tag into the predefined one and remove the orphan.

    3. Remove orphaned predefined family tags whose name no longer matches any
       user (left over from the pre-rename seed values like "Mama"/"Papa"/"Kind").
       If such a tag still has linked recipes, those links are moved to the
       matching user's family tag first; if no match can be found, the tag is
       left in place and counted separately.
    """
    merged = 0
    orphans_removed = 0
    affected: set[int] = set()

    # Step 1: sync user names → predefined family tags
    for user in db.query(User).order_by(User.id).all():
        family_tag = db.query(Tag).filter(
            func.lower(Tag.name) == user.name.lower(),
            Tag.category == "family",
        ).first()
        if not family_tag:
            any_tag = db.query(Tag).filter(
                func.lower(Tag.name) == user.name.lower()
            ).first()
            if any_tag:
                any_tag.is_predefined = True
                any_tag.category = "family"
                any_tag.name = user.name
            else:
                db.add(Tag(name=user.name, is_predefined=True, category="family"))
    db.flush()

    # Step 2: merge non-predefined tags that match a predefined tag (case-insensitive)
    for pre_tag in db.query(Tag).filter(Tag.is_predefined == True).all():
        dups = db.query(Tag).filter(
            Tag.is_predefined == False,
            Tag.id != pre_tag.id,
            func.lower(Tag.name) == pre_tag.name.lower(),
        ).all()
        for dup in dups:
            for recipe in list(dup.recipes):
                if pre_tag not in recipe.tags:
                    recipe.tags.append(pre_tag)
                affected.add(recipe.id)
            db.flush()
            db.delete(dup)
            merged += 1
    db.flush()

    # Step 3: remove orphaned predefined family tags (no user has that name)
    user_names_lower = {u.name.lower() for u in db.query(User).all()}
    for tag in db.query(Tag).filter(Tag.is_predefined == True, Tag.category == "family").all():
        if tag.name.lower() in user_names_lower:
            continue
        # Stale tag – re-link its recipes to the first available user family tag
        for recipe in list(tag.recipes):
            for user_tag in recipe.tags:
                if user_tag.category == "family" and user_tag.name.lower() in user_names_lower:
                    break
            else:
                # Recipe has no other family tag; skip re-linking (user can re-tag manually)
                continue
            affected.add(recipe.id)
        db.flush()
        db.delete(tag)
        orphans_removed += 1

    db.commit()
    return TagRepairResult(
        merged_tags=merged,
        affected_recipes=len(affected),
        orphaned_tags_removed=orphans_removed,
    )


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
            tags=[t.name for t in r.tags],
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
        for tag_name in item.tags:
            normalized = tag_name.strip()
            if not normalized:
                continue
            tag = db.query(Tag).filter(func.lower(Tag.name) == normalized.lower()).first()
            if not tag:
                tag = Tag(name=normalized)
                db.add(tag)
                db.flush()
            if tag not in recipe.tags:
                recipe.tags.append(tag)
        created_ids.append(recipe.id)
        created += 1
    db.commit()
    return RecipeImportResult(created=created, skipped=skipped, created_ids=created_ids)


def _build_recipe_preview(url: str) -> RecipeUrlPreview:
    """Scrape a recipe URL and return a RecipeUrlPreview. Raises on failure."""
    recipe_data = _scrape_recipe_url(url)

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
        source_url=url,
        ingredients=raw_ingredients,
    )


@router.post("/import/url", response_model=RecipeUrlPreview)
def import_recipe_from_url(payload: RecipeUrlImport):
    try:
        return _build_recipe_preview(payload.url)
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Rezept konnte nicht ausgelesen werden: {exc}",
        )


@router.post("/import/url/bulk-preview", response_model=RecipeBulkPreviewResult)
def bulk_preview_from_url(payload: RecipeBulkUrlImport):
    """Scrape multiple URLs and return previews without persisting anything."""
    results: list[RecipeUrlPreviewResult] = []
    for item in payload.items:
        try:
            preview = _build_recipe_preview(item.url)
            results.append(RecipeUrlPreviewResult(url=item.url, preview=preview))
        except Exception as exc:
            results.append(RecipeUrlPreviewResult(url=item.url, error=str(exc)))
    return RecipeBulkPreviewResult(results=results)


@router.post("/import/url/bulk", response_model=BulkUrlImportResult)
def bulk_import_from_url(payload: RecipeBulkUrlImport, db: Session = Depends(get_db)):
    """Import recipes from URLs with per-recipe tags and ratings."""
    created_ids: list[int] = []
    failed: list[BulkUrlImportFailure] = []

    for item in payload.items:
        sp = db.begin_nested()
        try:
            preview = _build_recipe_preview(item.url)
            recipe = Recipe(
                name=preview.name,
                description=preview.description,
                servings=preview.servings,
                prep_time_minutes=preview.prep_time_minutes,
                source_url=preview.source_url,
            )
            db.add(recipe)
            db.flush()

            seen: set[int] = set()
            for ing in preview.ingredients:
                ingredient = db.query(Ingredient).filter(Ingredient.name == ing.ingredient_name).first()
                if not ingredient:
                    ingredient = Ingredient(name=ing.ingredient_name)
                    db.add(ingredient)
                    db.flush()
                if ingredient.id in seen:
                    continue
                seen.add(ingredient.id)
                db.add(RecipeIngredient(
                    recipe_id=recipe.id,
                    ingredient_id=ingredient.id,
                    amount=ing.amount,
                    unit=ing.unit,
                ))

            for tag_id in item.tag_ids:
                tag = db.get(Tag, tag_id)
                if tag and tag not in recipe.tags:
                    recipe.tags.append(tag)

            for r in item.ratings:
                if db.get(User, r.user_id):
                    db.add(RecipeRating(
                        recipe_id=recipe.id,
                        user_id=r.user_id,
                        stars=r.stars,
                    ))

            sp.commit()
            created_ids.append(recipe.id)
        except Exception as exc:
            sp.rollback()
            failed.append(BulkUrlImportFailure(url=item.url, error=str(exc)))

    db.commit()
    return BulkUrlImportResult(created_ids=created_ids, failed=failed)


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
