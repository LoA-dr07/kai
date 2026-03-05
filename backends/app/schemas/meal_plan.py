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


class MealPlanEntryOut(MealPlanEntryBase):
    id: int
    recipe: Optional[RecipeOut] = None

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
