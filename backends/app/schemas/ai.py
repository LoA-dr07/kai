from pydantic import BaseModel
from datetime import date
from typing import Optional, Literal
from app.enums import MealType


class AiMealPlanRequest(BaseModel):
    week_start_date: date
    requesting_user_id: int
    special_wishes: str = ""
    meal_types: list[MealType] = list(MealType)


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


# --- Chat ---

class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class RecipeSuggestion(BaseModel):
    recipe_id: Optional[int] = None
    recipe_name: str
    reason: str
    is_new_recipe: bool = False


class AiChatRequest(BaseModel):
    messages: list[ChatMessage]
    week_start_date: Optional[date] = None


class AiChatResponse(BaseModel):
    reply: str
    recipe_suggestions: list[RecipeSuggestion] = []
