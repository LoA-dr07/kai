from pydantic import BaseModel, Field
from typing import Optional


class UserBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    abbreviation: str = Field(..., min_length=1, max_length=3)
    avatar_color: str = Field(..., pattern=r"^#[0-9A-Fa-f]{6}$")


class UserCreate(UserBase):
    pass


class UserOut(UserBase):
    id: int
    household_id: Optional[int] = None

    model_config = {"from_attributes": True}
