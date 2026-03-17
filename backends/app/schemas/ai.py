from pydantic import BaseModel
from datetime import date
from typing import Optional
from app.models.meal_plan import MealType


class AiMealPlanRequest(BaseModel):
    week_start_date: date
    requesting_user_id: int
    special_wishes: str = ""


class AiMealPlanSuggestionEntry(BaseModel):
    day_of_week: int          # 0–6
    meal_type: MealType
    recipe_id: Optional[int] = None
    recipe_name: Optional[str] = None
    custom_meal: Optional[str] = None
    assigned_user_ids: list[int] = []
    reason: Optional[str] = None


class AiMealPlanSuggestion(BaseModel):
    week_start_date: date
    entries: list[AiMealPlanSuggestionEntry]
