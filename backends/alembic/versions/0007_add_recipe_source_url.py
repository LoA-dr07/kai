"""add source_url to recipes

Revision ID: 0007
Revises: 0006
Create Date: 2026-03-30

"""
from alembic import op
import sqlalchemy as sa

revision = '0007'
down_revision = '0006'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('recipes', sa.Column('source_url', sa.String(2048), nullable=True))


def downgrade():
    op.drop_column('recipes', 'source_url')
