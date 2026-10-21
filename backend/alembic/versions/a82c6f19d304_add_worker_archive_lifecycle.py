"""Add archive lifecycle fields to workers.

Revision ID: a82c6f19d304
Revises: 7d2f9c4a1b6e
Create Date: 2026-10-22
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a82c6f19d304"
down_revision: Union[str, Sequence[str], None] = "7d2f9c4a1b6e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("workers") as batch_op:
        batch_op.add_column(
            sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.text("false"))
        )
        batch_op.add_column(sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("archived_by", sa.Uuid(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("workers") as batch_op:
        batch_op.drop_column("archived_by")
        batch_op.drop_column("archived_at")
        batch_op.drop_column("is_archived")
