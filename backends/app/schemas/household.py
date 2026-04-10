from pydantic import BaseModel
from app.schemas.user import UserOut


class HouseholdSettings(BaseModel):
    cooking_days: list[str] = []           # ["monday", "tuesday", ...]
    hot_meal_time: str = "dinner"          # "lunch" | "dinner" | "both"
    cold_meal_days: list[str] = []         # days with only cold meals
    leftovers_frequency: str = "sometimes" # "never" | "sometimes" | "often"
    shared_meals_importance: int = 3       # 1–5 (1=independent, 5=always same)
    weekly_budget: float | None = None     # optional weekly budget in €
    preferred_cuisines: list[str] = []     # ["italian", "german", "asian", ...]
    cooking_skill_level: str = "medium"    # "beginner" | "medium" | "advanced"
    notes: str = ""                         # free-text context for AI


class HouseholdSettingsUpdate(BaseModel):
    settings: HouseholdSettings


class HouseholdOut(BaseModel):
    id: int
    name: str
    members: list[UserOut]
    settings: HouseholdSettings = HouseholdSettings()

    model_config = {"from_attributes": True}
