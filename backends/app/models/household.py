from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.db.session import Base


class Household(Base):
    __tablename__ = "households"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)

    members = relationship("User", back_populates="household")
    recipes = relationship("Recipe", back_populates="household")
    meal_plans = relationship("MealPlan", back_populates="household")
