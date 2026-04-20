from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional


class ShoppingListItemOut(BaseModel):
    id: int
    name: str
    amount: Optional[float] = None
    unit: Optional[str] = None
    is_checked: bool
    is_manual: bool
    sort_order: int
    custom_meal_ref: Optional[str] = None

    model_config = {"from_attributes": True}


class ShoppingListOut(BaseModel):
    id: int
    household_id: Optional[int] = None
    created_at: datetime
    items: list[ShoppingListItemOut] = []

    model_config = {"from_attributes": True}


class ShoppingListItemCreate(BaseModel):
    name: str
    amount: Optional[float] = None
    unit: Optional[str] = None


class ShoppingListItemUpdate(BaseModel):
    is_checked: Optional[bool] = None
    name: Optional[str] = None
    amount: Optional[float] = None
    unit: Optional[str] = None


class GenerateShoppingListRequest(BaseModel):
    date_from: date
    date_to: date
    merge: bool = False
