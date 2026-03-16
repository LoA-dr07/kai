"""phase7: ai settings for household and users

Revision ID: 0005
Revises: 0004
Create Date: 2026-03-16

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("households", sa.Column("settings", JSONB, nullable=True))
    op.add_column("users", sa.Column("preferences", JSONB, nullable=True))


def downgrade() -> None:
    op.drop_column("users", "preferences")
    op.drop_column("households", "settings")
