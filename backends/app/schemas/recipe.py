from pydantic import BaseModel, Field
from typing import Optional


class IngredientBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class IngredientCreate(IngredientBase):
    pass


class IngredientUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class IngredientOut(IngredientBase):
    id: int

    model_config = {"from_attributes": True}


class RecipeIngredientBase(BaseModel):
    ingredient_id: int
    amount: float = Field(..., gt=0)
    unit: str = Field(..., min_length=1, max_length=50)


class RecipeIngredientCreate(RecipeIngredientBase):
    pass


class RecipeIngredientUpdate(BaseModel):
    ingredient_id: Optional[int] = None
    amount: Optional[float] = Field(default=None, gt=0)
    unit: Optional[str] = Field(default=None, min_length=1, max_length=50)


class RecipeIngredientOut(RecipeIngredientBase):
    id: int
    ingredient: IngredientOut

    model_config = {"from_attributes": True}


# --- Tags ---

class TagOut(BaseModel):
    id: int
    name: str
    is_predefined: bool
    category: Optional[str] = None

    model_config = {"from_attributes": True}


class TagCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


# --- Ratings ---

class RecipeRatingOut(BaseModel):
    user_id: int
    stars: int

    model_config = {"from_attributes": True}


class RecipeRatingUpsert(BaseModel):
    user_id: int
    stars: int = Field(..., ge=0, le=5)


# --- Recipes ---

class RecipeBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    servings: int = Field(default=2, ge=1)
    prep_time_minutes: Optional[int] = Field(default=None, ge=1)
    source_url: Optional[str] = None


class RecipeCreate(RecipeBase):
    ingredients: list[RecipeIngredientCreate] = []
    tag_ids: list[int] = []


class RecipeUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    servings: Optional[int] = Field(default=None, ge=1)
    prep_time_minutes: Optional[int] = Field(default=None, ge=1)
    source_url: Optional[str] = None
    ingredients: Optional[list[RecipeIngredientCreate]] = None
    tag_ids: Optional[list[int]] = None


class RecipeOut(RecipeBase):
    id: int
    ingredients: list[RecipeIngredientOut] = []
    tags: list[TagOut] = []
    ratings: list[RecipeRatingOut] = []

    model_config = {"from_attributes": True}


# --- Import / Export ---

class RecipeExportIngredient(BaseModel):
    ingredient_name: str
    amount: float
    unit: str


class RecipeExportItem(BaseModel):
    name: str
    description: Optional[str] = None
    servings: int = 2
    prep_time_minutes: Optional[int] = None
    source_url: Optional[str] = None
    ingredients: list[RecipeExportIngredient] = []
    ratings: list[RecipeRatingOut] = []
    tags: list[str] = []


class RecipeImportResult(BaseModel):
    created: int
    skipped: int
    created_ids: list[int] = []


class RecipeUrlImport(BaseModel):
    url: str


class RecipeUrlPreview(BaseModel):
    name: str
    description: Optional[str] = None
    servings: int = 2
    prep_time_minutes: Optional[int] = None
    source_url: Optional[str] = None
    ingredients: list[RecipeExportIngredient] = []


class RecipeBulkUrlItem(BaseModel):
    url: str
    tag_ids: list[int] = []
    ratings: list[RecipeRatingUpsert] = []


class RecipeBulkUrlImport(BaseModel):
    items: list[RecipeBulkUrlItem]


class BulkUrlImportFailure(BaseModel):
    url: str
    error: str


class BulkUrlImportResult(BaseModel):
    created_ids: list[int]
    failed: list[BulkUrlImportFailure]


class RecipeUrlPreviewResult(BaseModel):
    url: str
    preview: Optional[RecipeUrlPreview] = None
    error: Optional[str] = None


class RecipeBulkPreviewResult(BaseModel):
    results: list[RecipeUrlPreviewResult]


class TagRepairResult(BaseModel):
    merged_tags: int
    affected_recipes: int
    orphaned_tags_removed: int
