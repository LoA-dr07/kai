from sqlalchemy import Column, Integer, String, Float, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.db.session import Base


class Recipe(Base):
    __tablename__ = "recipes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    servings = Column(Integer, nullable=False, default=2)
    prep_time_minutes = Column(Integer, nullable=True)
    household_id = Column(Integer, ForeignKey("households.id"), nullable=True)

    ingredients = relationship("RecipeIngredient", back_populates="recipe", cascade="all, delete-orphan")
    meal_plan_entries = relationship("MealPlanEntry", back_populates="recipe")
    household = relationship("Household", back_populates="recipes")


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
