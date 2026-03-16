from pydantic import BaseModel, model_validator
from typing import Any


class UserPreferences(BaseModel):
    dietary_restrictions: list[str] = []  # ["vegetarian", "vegan", "gluten_free", ...]
    allergies: list[str] = []             # ["peanuts", "dairy", "eggs", "wheat", ...]
    disliked_ingredients: list[str] = []  # free-text list
    liked_cuisines: list[str] = []        # ["italian", "german", "asian", ...]
    spice_tolerance: str = "medium"       # "mild" | "medium" | "spicy"
    portion_size: str = "normal"          # "small" | "normal" | "large"


class UserPreferencesUpdate(BaseModel):
    preferences: UserPreferences


class UserOut(BaseModel):
    id: int
    name: str
    avatar_color: str
    short_name: str
    preferences: UserPreferences = UserPreferences()

    @model_validator(mode="before")
    @classmethod
    def coerce_preferences(cls, data: Any) -> Any:
        if hasattr(data, "__dict__"):
            # ORM object: read preferences attribute
            raw = getattr(data, "preferences", None)
            return {
                "id": data.id,
                "name": data.name,
                "avatar_color": data.avatar_color,
                "short_name": data.short_name,
                "preferences": raw if raw is not None else {},
            }
        if isinstance(data, dict) and data.get("preferences") is None:
            data["preferences"] = {}
        return data

    model_config = {"from_attributes": True}
