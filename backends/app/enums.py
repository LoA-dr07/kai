"""Shared enums used across models, schemas and routers."""
import enum


# Kept in sync by hand with the frontend: mobile/lib/types.ts (MealType union)
# and mobile/lib/constants.ts (MEAL_TYPES display labels/icons). Update all
# three when adding/removing/renaming a meal type.
class MealType(str, enum.Enum):
    breakfast = "breakfast"
    lunch = "lunch"
    snack = "snack"
    dinner = "dinner"
    dessert = "dessert"
