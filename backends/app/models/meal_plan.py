import enum
from sqlalchemy import Column, Integer, String, Date, ForeignKey, Enum, Table
from sqlalchemy.orm import relationship
from app.db.session import Base


# Many-to-many association: MealPlanEntry ↔ User
meal_plan_entry_users = Table(
    "meal_plan_entry_users",
    Base.metadata,
    Column("entry_id", Integer, ForeignKey("meal_plan_entries.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)


class MealType(str, enum.Enum):
    breakfast = "breakfast"
    lunch = "lunch"
    snack = "snack"
    dinner = "dinner"
    dessert = "dessert"


class MealPlan(Base):
    __tablename__ = "meal_plans"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    week_start_date = Column(Date, nullable=False)  # always a Monday
    household_id = Column(Integer, ForeignKey("households.id", ondelete="SET NULL"), nullable=True)

    entries = relationship("MealPlanEntry", back_populates="meal_plan", cascade="all, delete-orphan")


class MealPlanEntry(Base):
    __tablename__ = "meal_plan_entries"

    id = Column(Integer, primary_key=True, index=True)
    meal_plan_id = Column(Integer, ForeignKey("meal_plans.id", ondelete="CASCADE"), nullable=False)
    day_of_week = Column(Integer, nullable=False)  # 0=Monday … 6=Sunday
    meal_type = Column(Enum(MealType), nullable=False)
    recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="SET NULL"), nullable=True)
    custom_meal = Column(String(255), nullable=True)  # free-text alternative to a recipe

    meal_plan = relationship("MealPlan", back_populates="entries")
    recipe = relationship("Recipe", back_populates="meal_plan_entries")
    assigned_users = relationship(
        "User",
        secondary="meal_plan_entry_users",
        back_populates="meal_plan_entries",
        lazy="selectin",
    )
