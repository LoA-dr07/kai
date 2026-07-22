from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from app.db.session import get_db
from app.models.shopping_list import ShoppingList, ShoppingListItem
from app.models.meal_plan import MealPlan, MealPlanEntry
from app.schemas.shopping_list import (
    ShoppingListOut,
    ShoppingListItemOut,
    ShoppingListItemCreate,
    ShoppingListItemUpdate,
    GenerateShoppingListRequest,
)
from app.utils.db import apply_update
from app.utils.household import get_household_or_404

router = APIRouter(prefix="/shopping-list", tags=["shopping-list"])


def _get_active_list(db: Session, household_id: int) -> ShoppingList | None:
    return (
        db.query(ShoppingList)
        .filter(ShoppingList.household_id == household_id)
        .order_by(ShoppingList.created_at.desc())
        .first()
    )


@router.get("", response_model=ShoppingListOut | None)
def get_active_shopping_list(db: Session = Depends(get_db)):
    household = get_household_or_404(db)
    shopping_list = _get_active_list(db, household.id)
    return shopping_list


@router.post("/generate", response_model=ShoppingListOut)
def generate_shopping_list(
    payload: GenerateShoppingListRequest,
    db: Session = Depends(get_db),
):
    # Single transaction (no per-item begin_nested()) is fine here: unlike
    # bulk_import_from_url() in recipes.py, every step below is a local DB
    # aggregation with no independent external call that can fail per-item.
    household = get_household_or_404(db)
    existing = _get_active_list(db, household.id)

    # Gather all meal plan entries within the date range.
    # household_id is intentionally not filtered: plans are created without it
    # (single-household app), matching the behaviour of list_meal_plans.
    all_plans = (
        db.query(MealPlan)
        .options(
            joinedload(MealPlan.entries).joinedload(MealPlanEntry.recipe)
        )
        .all()
    )

    entries_in_range: list[MealPlanEntry] = []
    for plan in all_plans:
        week_start = plan.week_start_date
        for entry in plan.entries:
            entry_date = week_start + timedelta(days=entry.day_of_week)
            if payload.date_from <= entry_date <= payload.date_to:
                entries_in_range.append(entry)

    # Aggregate ingredients from recipe-based entries
    # key: (ingredient_name_lower, unit_lower) → (display_name, unit, total_amount)
    ingredient_map: dict[tuple[str, str], tuple[str, str, float]] = {}
    custom_meals: list[str] = []
    sort_counter = 0

    for entry in entries_in_range:
        if entry.recipe_id and entry.recipe:
            recipe = entry.recipe
            # Scale the recipe's ingredient amounts to the number of people
            # actually assigned to this entry. If nobody is assigned (assigned
            # users are optional), keep the recipe's own amounts unscaled.
            num_people = len(entry.assigned_users)
            scale = (num_people / recipe.servings) if num_people > 0 else 1.0
            for ri in recipe.ingredients:
                if ri.ingredient:
                    ing_name = ri.ingredient.name
                    unit = (ri.unit or "").strip()
                    key = (ing_name.lower(), unit.lower())
                    scaled_amount = (ri.amount or 0) * scale
                    if key in ingredient_map:
                        n, u, amt = ingredient_map[key]
                        ingredient_map[key] = (n, u, amt + scaled_amount)
                    else:
                        ingredient_map[key] = (ing_name, unit, scaled_amount)
        elif entry.custom_meal:
            if entry.custom_meal not in custom_meals:
                custom_meals.append(entry.custom_meal)

    # Build list of new items
    new_items: list[dict] = []
    for (_, _), (name, unit, amount) in ingredient_map.items():
        new_items.append({
            "name": name,
            "amount": round(amount, 2) if amount > 0 else None,
            "unit": unit if unit else None,
            "is_manual": False,
        })
    # Sort alphabetically
    new_items.sort(key=lambda x: x["name"].lower())

    for i, item in enumerate(new_items):
        item["sort_order"] = i
    sort_counter = len(new_items)

    for meal in custom_meals:
        new_items.append({
            "name": meal,
            "amount": None,
            "unit": None,
            "is_manual": False,
            "custom_meal_ref": meal,
            "sort_order": sort_counter,
        })
        sort_counter += 1

    if existing and payload.merge:
        # Merge: add new items to existing list, skipping duplicates
        existing_names = {item.name.lower() for item in existing.items}
        for item_data in new_items:
            if item_data["name"].lower() not in existing_names:
                item = ShoppingListItem(
                    shopping_list_id=existing.id,
                    name=item_data["name"],
                    amount=item_data.get("amount"),
                    unit=item_data.get("unit"),
                    is_checked=False,
                    is_manual=item_data.get("is_manual", False),
                    sort_order=item_data["sort_order"],
                    custom_meal_ref=item_data.get("custom_meal_ref"),
                )
                db.add(item)
        db.commit()
        db.refresh(existing)
        return existing
    else:
        # Replace: delete existing list (if any) and create new one
        if existing:
            db.delete(existing)
            db.flush()

        new_list = ShoppingList(household_id=household.id)
        db.add(new_list)
        db.flush()

        for item_data in new_items:
            item = ShoppingListItem(
                shopping_list_id=new_list.id,
                name=item_data["name"],
                amount=item_data.get("amount"),
                unit=item_data.get("unit"),
                is_checked=False,
                is_manual=item_data.get("is_manual", False),
                sort_order=item_data["sort_order"],
                custom_meal_ref=item_data.get("custom_meal_ref"),
            )
            db.add(item)

        db.commit()
        db.refresh(new_list)
        return new_list


@router.post("/items", response_model=ShoppingListItemOut, status_code=status.HTTP_201_CREATED)
def add_item(payload: ShoppingListItemCreate, db: Session = Depends(get_db)):
    household = get_household_or_404(db)
    shopping_list = _get_active_list(db, household.id)
    if not shopping_list:
        # Create a new empty list
        shopping_list = ShoppingList(household_id=household.id)
        db.add(shopping_list)
        db.flush()

    max_order = max((i.sort_order for i in shopping_list.items), default=-1)
    item = ShoppingListItem(
        shopping_list_id=shopping_list.id,
        name=payload.name,
        amount=payload.amount,
        unit=payload.unit,
        is_checked=False,
        is_manual=True,
        sort_order=max_order + 1,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/items/{item_id}", response_model=ShoppingListItemOut)
def update_item(item_id: int, payload: ShoppingListItemUpdate, db: Session = Depends(get_db)):
    item = db.get(ShoppingListItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"Item {item_id} not found")
    apply_update(item, payload)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.get(ShoppingListItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"Item {item_id} not found")
    db.delete(item)
    db.commit()


@router.delete("/done", status_code=status.HTTP_204_NO_CONTENT)
def clear_done_items(db: Session = Depends(get_db)):
    household = get_household_or_404(db)
    shopping_list = _get_active_list(db, household.id)
    if not shopping_list:
        return
    for item in list(shopping_list.items):
        if item.is_checked:
            db.delete(item)
    db.commit()


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def delete_shopping_list(db: Session = Depends(get_db)):
    household = get_household_or_404(db)
    shopping_list = _get_active_list(db, household.id)
    if shopping_list:
        db.delete(shopping_list)
        db.commit()
