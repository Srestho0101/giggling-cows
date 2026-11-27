"""Add cow profile picture, color, marking, and sale record fields.

Revision ID: a1b2c3d4e5f7
Revises: f2b4c6d8e0a1
Create Date: 2026-11-27
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f7"
down_revision: Union[str, Sequence[str], None] = "f2b4c6d8e0a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("cows") as batch_op:
        batch_op.add_column(sa.Column("color", sa.String(length=80), nullable=True))
        batch_op.add_column(sa.Column("marking", sa.String(length=200), nullable=True))
        batch_op.add_column(sa.Column("profile_picture_url", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("sold_date", sa.Date(), nullable=True))
        batch_op.add_column(sa.Column("sale_price", sa.Numeric(12, 2), nullable=True))
        batch_op.add_column(sa.Column("buyer_name", sa.String(length=150), nullable=True))
        batch_op.add_column(sa.Column("buyer_phone", sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column("buyer_address", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("sale_notes", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("cows") as batch_op:
        batch_op.drop_column("sale_notes")
        batch_op.drop_column("buyer_address")
        batch_op.drop_column("buyer_phone")
        batch_op.drop_column("buyer_name")
        batch_op.drop_column("sale_price")
        batch_op.drop_column("sold_date")
        batch_op.drop_column("profile_picture_url")
        batch_op.drop_column("marking")
        batch_op.drop_column("color")
