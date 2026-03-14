"""phase 4: household and users

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-14

"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # households
    op.create_table(
        "households",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
    )
    op.create_index("ix_households_id", "households", ["id"])

    # users
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("abbreviation", sa.String(3), nullable=False),
        sa.Column("avatar_color", sa.String(7), nullable=False, server_default="#808080"),
        sa.Column("household_id", sa.Integer(), sa.ForeignKey("households.id"), nullable=True),
    )
    op.create_index("ix_users_id", "users", ["id"])

    # add household_id to recipes
    op.add_column("recipes", sa.Column("household_id", sa.Integer(), sa.ForeignKey("households.id"), nullable=True))

    # add household_id to meal_plans
    op.add_column("meal_plans", sa.Column("household_id", sa.Integer(), sa.ForeignKey("households.id"), nullable=True))

    # meal_plan_entry_users association table
    op.create_table(
        "meal_plan_entry_users",
        sa.Column("entry_id", sa.Integer(), sa.ForeignKey("meal_plan_entries.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    )


def downgrade() -> None:
    op.drop_table("meal_plan_entry_users")
    op.drop_column("meal_plans", "household_id")
    op.drop_column("recipes", "household_id")
    op.drop_index("ix_users_id", table_name="users")
    op.drop_table("users")
    op.drop_index("ix_households_id", table_name="households")
    op.drop_table("households")
