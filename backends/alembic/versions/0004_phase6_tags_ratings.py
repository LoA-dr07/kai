"""phase6: recipe tags and ratings

Revision ID: 0004
Revises: 0003
Create Date: 2026-03-15

"""
from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- tags ---
    op.create_table(
        "tags",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("is_predefined", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.create_index("ix_tags_id", "tags", ["id"])

    # --- recipe_tags (many-to-many) ---
    op.create_table(
        "recipe_tags",
        sa.Column("recipe_id", sa.Integer(), sa.ForeignKey("recipes.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("tag_id", sa.Integer(), sa.ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
    )

    # --- recipe_ratings ---
    op.create_table(
        "recipe_ratings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("recipe_id", sa.Integer(), sa.ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("stars", sa.Integer(), nullable=False),
        sa.UniqueConstraint("recipe_id", "user_id"),
    )
    op.create_index("ix_recipe_ratings_id", "recipe_ratings", ["id"])

    # Seed predefined tags (meal types)
    op.execute(
        "INSERT INTO tags (name, is_predefined) VALUES "
        "('Frühstück', true), "
        "('Mittagessen', true), "
        "('Snack', true), "
        "('Abendessen', true), "
        "('Dessert', true)"
    )


def downgrade() -> None:
    op.drop_index("ix_recipe_ratings_id", "recipe_ratings")
    op.drop_table("recipe_ratings")
    op.drop_table("recipe_tags")
    op.drop_index("ix_tags_id", "tags")
    op.drop_table("tags")
