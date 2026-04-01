from sqlalchemy import Column, Integer, String, JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from app.db.session import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    avatar_color = Column(String(20), nullable=False, default="#2E7D32")  # hex color
    short_name = Column(String(4), nullable=False)  # z.B. "MA", "PA", "KI"
    preferences = Column(JSONB().with_variant(JSON(), "sqlite"), nullable=True, default=dict)

    households = relationship("HouseholdMember", back_populates="user")
    meal_plan_entries = relationship(
        "MealPlanEntry",
        secondary="meal_plan_entry_users",
        back_populates="assigned_users",
    )
