"""Shared enums used across models, schemas and routers."""
import enum


class MealType(str, enum.Enum):
    breakfast = "breakfast"
    lunch = "lunch"
    snack = "snack"
    dinner = "dinner"
    dessert = "dessert"
