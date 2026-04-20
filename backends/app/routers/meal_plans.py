from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.meal_plan import MealPlan, MealPlanEntry
from app.models.recipe import Recipe
from app.models.user import User
from app.schemas.meal_plan import (
    MealPlanCreate, MealPlanUpdate, MealPlanOut,
    MealPlanEntryCreate, MealPlanEntryUpdate, MealPlanEntryOut,
)

router = APIRouter(prefix="/meal-plans", tags=["meal-plans"])


def _get_plan_or_404(db: Session, plan_id: int) -> MealPlan:
    plan = db.get(MealPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Meal plan not found")
    return plan


def _validate_recipe(db: Session, recipe_id: int | None):
    if recipe_id is not None and not db.get(Recipe, recipe_id):
        raise HTTPException(status_code=404, detail=f"Recipe {recipe_id} not found")


def _assign_users(db: Session, entry: MealPlanEntry, user_ids: list[int]):
    if user_ids:
        users = db.query(User).filter(User.id.in_(user_ids)).all()
        if len(users) != len(user_ids):
            raise HTTPException(status_code=404, detail="One or more users not found")
        entry.assigned_users = users
    else:
        entry.assigned_users = []


# --- Meal Plans ---

@router.get("", response_model=list[MealPlanOut])
def list_meal_plans(db: Session = Depends(get_db)):
    return db.query(MealPlan).order_by(MealPlan.week_start_date.desc()).all()


@router.post("", response_model=MealPlanOut, status_code=status.HTTP_201_CREATED)
def create_meal_plan(payload: MealPlanCreate, db: Session = Depends(get_db)):
    plan = MealPlan(name=payload.name, week_start_date=payload.week_start_date)
    db.add(plan)
    db.flush()

    for entry_data in payload.entries:
        _validate_recipe(db, entry_data.recipe_id)
        entry = MealPlanEntry(
            meal_plan_id=plan.id,
            day_of_week=entry_data.day_of_week,
            meal_type=entry_data.meal_type,
            recipe_id=entry_data.recipe_id,
            custom_meal=entry_data.custom_meal,
            repeat_weekly=entry_data.repeat_weekly,
        )
        db.add(entry)
        db.flush()
        _assign_users(db, entry, entry_data.assigned_user_ids)

    db.commit()
    db.refresh(plan)
    return plan


@router.get("/{plan_id}", response_model=MealPlanOut)
def get_meal_plan(plan_id: int, db: Session = Depends(get_db)):
    return _get_plan_or_404(db, plan_id)


@router.patch("/{plan_id}", response_model=MealPlanOut)
def update_meal_plan(plan_id: int, payload: MealPlanUpdate, db: Session = Depends(get_db)):
    plan = _get_plan_or_404(db, plan_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(plan, field, value)
    db.commit()
    db.refresh(plan)
    return plan


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meal_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = _get_plan_or_404(db, plan_id)
    db.delete(plan)
    db.commit()


# --- Entries (within a plan) ---

@router.post("/{plan_id}/entries", response_model=MealPlanEntryOut, status_code=status.HTTP_201_CREATED)
def add_entry(plan_id: int, payload: MealPlanEntryCreate, db: Session = Depends(get_db)):
    _get_plan_or_404(db, plan_id)
    _validate_recipe(db, payload.recipe_id)
    entry = MealPlanEntry(
        meal_plan_id=plan_id,
        day_of_week=payload.day_of_week,
        meal_type=payload.meal_type,
        recipe_id=payload.recipe_id,
        custom_meal=payload.custom_meal,
        repeat_weekly=payload.repeat_weekly,
    )
    db.add(entry)
    db.flush()
    _assign_users(db, entry, payload.assigned_user_ids)
    db.commit()
    db.refresh(entry)
    return MealPlanEntryOut.model_validate(entry)


@router.patch("/{plan_id}/entries/{entry_id}", response_model=MealPlanEntryOut)
def update_entry(plan_id: int, entry_id: int, payload: MealPlanEntryUpdate, db: Session = Depends(get_db)):
    _get_plan_or_404(db, plan_id)
    entry = db.get(MealPlanEntry, entry_id)
    if not entry or entry.meal_plan_id != plan_id:
        raise HTTPException(status_code=404, detail="Entry not found")
    _validate_recipe(db, payload.recipe_id)

    update_data = payload.model_dump(exclude_unset=True)
    user_ids = update_data.pop("assigned_user_ids", None)

    for field, value in update_data.items():
        setattr(entry, field, value)

    if user_ids is not None:
        _assign_users(db, entry, user_ids)

    db.commit()
    db.refresh(entry)
    return MealPlanEntryOut.model_validate(entry)


@router.delete("/{plan_id}/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entry(plan_id: int, entry_id: int, db: Session = Depends(get_db)):
    _get_plan_or_404(db, plan_id)
    entry = db.get(MealPlanEntry, entry_id)
    if not entry or entry.meal_plan_id != plan_id:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(entry)
    db.commit()
