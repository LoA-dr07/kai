from pydantic import BaseModel
from app.schemas.user import UserOut


class HouseholdOut(BaseModel):
    id: int
    name: str
    members: list[UserOut]

    model_config = {"from_attributes": True}
