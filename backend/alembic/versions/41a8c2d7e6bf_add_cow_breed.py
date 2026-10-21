"""Add breed classification for cows and calves.

Revision ID: 41a8c2d7e6bf
Revises: c6a3e59d14b2
Create Date: 2026-10-21
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "41a8c2d7e6bf"
down_revision: Union[str, Sequence[str], None] = "c6a3e59d14b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("cows", sa.Column("breed", sa.String(length=30), nullable=True))


def downgrade() -> None:
    op.drop_column("cows", "breed")
