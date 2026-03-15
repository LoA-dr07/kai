from pydantic import BaseModel


class UserOut(BaseModel):
    id: int
    name: str
    avatar_color: str
    short_name: str

    model_config = {"from_attributes": True}
