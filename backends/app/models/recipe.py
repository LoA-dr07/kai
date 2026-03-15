from sqlalchemy import Column, Integer, String, Float, Text, ForeignKey, UniqueConstraint, Boolean, Table
from sqlalchemy.orm import relationship
from app.db.session import Base


# Many-to-many association: Recipe ↔ Tag
recipe_tags = Table(
    "recipe_tags",
    Base.metadata,
    Column("recipe_id", Integer, ForeignKey("recipes.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    is_predefined = Column(Boolean, nullable=False, default=False)

    recipes = relationship("Recipe", secondary="recipe_tags", back_populates="tags")


class Recipe(Base):
    __tablename__ = "recipes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    servings = Column(Integer, nullable=False, default=2)
    prep_time_minutes = Column(Integer, nullable=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="SET NULL"), nullable=True)

    ingredients = relationship("RecipeIngredient", back_populates="recipe", cascade="all, delete-orphan")
    meal_plan_entries = relationship("MealPlanEntry", back_populates="recipe")
    tags = relationship("Tag", secondary="recipe_tags", back_populates="recipes", lazy="selectin")
    ratings = relationship("RecipeRating", back_populates="recipe", cascade="all, delete-orphan", lazy="selectin")


class Ingredient(Base):
    __tablename__ = "ingredients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True)

    recipes = relationship("RecipeIngredient", back_populates="ingredient")


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id = Column(Integer, primary_key=True, index=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False)
    ingredient_id = Column(Integer, ForeignKey("ingredients.id"), nullable=False)
    amount = Column(Float, nullable=False)
    unit = Column(String(50), nullable=False)

    recipe = relationship("Recipe", back_populates="ingredients")
    ingredient = relationship("Ingredient", back_populates="recipes")

    __table_args__ = (UniqueConstraint("recipe_id", "ingredient_id"),)


class RecipeRating(Base):
    __tablename__ = "recipe_ratings"

    id = Column(Integer, primary_key=True, index=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    stars = Column(Integer, nullable=False)  # 0–5

    recipe = relationship("Recipe", back_populates="ratings")
    user = relationship("User")

    __table_args__ = (UniqueConstraint("recipe_id", "user_id"),)
