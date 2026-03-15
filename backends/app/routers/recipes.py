from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.recipe import Recipe, Ingredient, RecipeIngredient
from app.schemas.recipe import (
    RecipeCreate, RecipeUpdate, RecipeOut,
    IngredientCreate, IngredientOut,
    RecipeExportItem, RecipeExportIngredient, RecipeImportResult,
)

router = APIRouter(prefix="/recipes", tags=["recipes"])


def _get_or_create_ingredient(db: Session, ingredient_id: int) -> Ingredient:
    ingredient = db.get(Ingredient, ingredient_id)
    if not ingredient:
        raise HTTPException(status_code=404, detail=f"Ingredient {ingredient_id} not found")
    return ingredient


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
    db.flush()  # get recipe.id before adding ingredients

    for item in payload.ingredients:
        _get_or_create_ingredient(db, item.ingredient_id)
        db.add(RecipeIngredient(
            recipe_id=recipe.id,
            ingredient_id=item.ingredient_id,
            amount=item.amount,
            unit=item.unit,
        ))

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

    for field, value in payload.model_dump(exclude_unset=True, exclude={"ingredients"}).items():
        setattr(recipe, field, value)

    if payload.ingredients is not None:
        # replace all ingredients
        db.query(RecipeIngredient).filter(RecipeIngredient.recipe_id == recipe_id).delete()
        for item in payload.ingredients:
            _get_or_create_ingredient(db, item.ingredient_id)
            db.add(RecipeIngredient(
                recipe_id=recipe.id,
                ingredient_id=item.ingredient_id,
                amount=item.amount,
                unit=item.unit,
            ))

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
