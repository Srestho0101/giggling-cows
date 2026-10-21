"""Add recurring weekly holidays to workers.

Revision ID: 7d2f9c4a1b6e
Revises: 41a8c2d7e6bf
Create Date: 2026-10-22
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7d2f9c4a1b6e"
down_revision: Union[str, Sequence[str], None] = "41a8c2d7e6bf"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "workers",
        sa.Column(
            "weekly_holidays",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
    )


def downgrade() -> None:
    op.drop_column("workers", "weekly_holidays")
