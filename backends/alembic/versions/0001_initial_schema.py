"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-03-05

"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "recipes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("servings", sa.Integer(), nullable=False, server_default="2"),
        sa.Column("prep_time_minutes", sa.Integer(), nullable=True),
    )
    op.create_index("ix_recipes_id", "recipes", ["id"])

    op.create_table(
        "ingredients",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False, unique=True),
    )
    op.create_index("ix_ingredients_id", "ingredients", ["id"])

    op.create_table(
        "recipe_ingredients",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("recipe_id", sa.Integer(), sa.ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ingredient_id", sa.Integer(), sa.ForeignKey("ingredients.id"), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("unit", sa.String(50), nullable=False),
        sa.UniqueConstraint("recipe_id", "ingredient_id"),
    )
    op.create_index("ix_recipe_ingredients_id", "recipe_ingredients", ["id"])

    op.create_table(
        "meal_plans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("week_start_date", sa.Date(), nullable=False),
    )
    op.create_index("ix_meal_plans_id", "meal_plans", ["id"])

    op.execute("CREATE TYPE IF NOT EXISTS mealtype AS ENUM ('breakfast', 'lunch', 'dinner')")

    op.create_table(
        "meal_plan_entries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("meal_plan_id", sa.Integer(), sa.ForeignKey("meal_plans.id", ondelete="CASCADE"), nullable=False),
        sa.Column("day_of_week", sa.Integer(), nullable=False),
        sa.Column("meal_type", sa.Enum("breakfast", "lunch", "dinner", name="mealtype", create_type=False), nullable=False),
        sa.Column("recipe_id", sa.Integer(), sa.ForeignKey("recipes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("custom_meal", sa.String(255), nullable=True),
    )
    op.create_index("ix_meal_plan_entries_id", "meal_plan_entries", ["id"])


def downgrade() -> None:
    op.drop_table("meal_plan_entries")
    sa.Enum(name="mealtype").drop(op.get_bind())
    op.drop_table("meal_plans")
    op.drop_table("recipe_ingredients")
    op.drop_table("ingredients")
    op.drop_table("recipes")
