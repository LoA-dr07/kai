from pydantic import BaseModel, Field, model_validator
from typing import Optional
from datetime import date
from app.models.meal_plan import MealType
from app.schemas.recipe import RecipeOut


class MealPlanEntryBase(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6)
    meal_type: MealType
    recipe_id: Optional[int] = None
    custom_meal: Optional[str] = Field(default=None, max_length=255)
    assigned_user_ids: list[int] = []

    @model_validator(mode="after")
    def recipe_or_custom_meal(self):
        if self.recipe_id is None and self.custom_meal is None:
            raise ValueError("Either recipe_id or custom_meal must be set")
        return self


class MealPlanEntryCreate(MealPlanEntryBase):
    pass


class MealPlanEntryUpdate(BaseModel):
    recipe_id: Optional[int] = None
    custom_meal: Optional[str] = Field(default=None, max_length=255)
    assigned_user_ids: Optional[list[int]] = None


class MealPlanEntryOut(BaseModel):
    id: int
    day_of_week: int
    meal_type: MealType
    recipe_id: Optional[int] = None
    custom_meal: Optional[str] = None
    recipe: Optional[RecipeOut] = None
    assigned_user_ids: list[int] = []

    @model_validator(mode="before")
    @classmethod
    def flatten_assigned_users(cls, data):
        if hasattr(data, "assigned_users"):
            return {
                "id": data.id,
                "day_of_week": data.day_of_week,
                "meal_type": data.meal_type,
                "recipe_id": data.recipe_id,
                "custom_meal": data.custom_meal,
                "recipe": data.recipe,
                "assigned_user_ids": [u.id for u in data.assigned_users],
            }
        return data

    model_config = {"from_attributes": True}


class MealPlanBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    week_start_date: date


class MealPlanCreate(MealPlanBase):
    entries: list[MealPlanEntryCreate] = []


class MealPlanUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    week_start_date: Optional[date] = None


class MealPlanOut(MealPlanBase):
    id: int
    entries: list[MealPlanEntryOut] = []

    model_config = {"from_attributes": True}
