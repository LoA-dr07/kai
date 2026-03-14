from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.db.session import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    abbreviation = Column(String(3), nullable=False)
    avatar_color = Column(String(7), nullable=False, default="#808080")
    household_id = Column(Integer, ForeignKey("households.id"), nullable=True)

    household = relationship("Household", back_populates="members")
    meal_plan_entries = relationship(
        "MealPlanEntry",
        secondary="meal_plan_entry_users",
        back_populates="assigned_users",
    )
