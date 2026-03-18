"""add tag category and family member tags

Revision ID: 0006
Revises: 0005
Create Date: 2026-03-18

"""
from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tags", sa.Column("category", sa.String(50), nullable=True))

    # Categorize existing predefined meal-type tags
    op.execute(
        "UPDATE tags SET category = 'meal_type' WHERE is_predefined = true"
    )

    # Insert family member tags
    op.execute(
        "INSERT INTO tags (name, is_predefined, category) VALUES "
        "('Mama', true, 'family'), "
        "('Papa', true, 'family'), "
        "('Kind', true, 'family')"
    )


def downgrade() -> None:
    op.execute("DELETE FROM tags WHERE category = 'family'")
    op.drop_column("tags", "category")
