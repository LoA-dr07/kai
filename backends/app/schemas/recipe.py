from pydantic import BaseModel, Field
from typing import Optional


class IngredientBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class IngredientCreate(IngredientBase):
    pass


class IngredientOut(IngredientBase):
    id: int

    model_config = {"from_attributes": True}


class RecipeIngredientBase(BaseModel):
    ingredient_id: int
    amount: float = Field(..., gt=0)
    unit: str = Field(..., min_length=1, max_length=50)


class RecipeIngredientCreate(RecipeIngredientBase):
    pass


class RecipeIngredientOut(RecipeIngredientBase):
    id: int
    ingredient: IngredientOut

    model_config = {"from_attributes": True}


class RecipeBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    servings: int = Field(default=2, ge=1)
    prep_time_minutes: Optional[int] = Field(default=None, ge=1)


class RecipeCreate(RecipeBase):
    ingredients: list[RecipeIngredientCreate] = []


class RecipeUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    servings: Optional[int] = Field(default=None, ge=1)
    prep_time_minutes: Optional[int] = Field(default=None, ge=1)
    ingredients: Optional[list[RecipeIngredientCreate]] = None


class RecipeOut(RecipeBase):
    id: int
    ingredients: list[RecipeIngredientOut] = []

    model_config = {"from_attributes": True}
