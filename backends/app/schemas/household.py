from pydantic import BaseModel, Field
from typing import List
from app.schemas.user import UserOut


class HouseholdBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class HouseholdCreate(HouseholdBase):
    pass


class HouseholdOut(HouseholdBase):
    id: int
    members: List[UserOut] = []

    model_config = {"from_attributes": True}
