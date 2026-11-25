"""Add cow_type and relax dam constraint for purchased cows.

Revision ID: e1a2b3c4d5f6
Revises: d5b7e2a94c31
Create Date: 2026-11-25
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "e1a2b3c4d5f6"
down_revision: Union[str, Sequence[str], None] = "d5b7e2a94c31"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    with op.batch_alter_table("cows") as batch_op:
        batch_op.add_column(sa.Column("cow_type", sa.String(length=50), nullable=True))
    if bind.engine.name == "postgresql":
        op.drop_constraint("check_acquisition_integrity", "cows", type_="check")
        op.create_check_constraint(
            "check_acquisition_integrity",
            "cows",
            "(acquisition_type = 'born_on_farm' AND supplier_id IS NULL) OR (acquisition_type != 'born_on_farm')",
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.engine.name == "postgresql":
        op.drop_constraint("check_acquisition_integrity", "cows", type_="check")
        op.create_check_constraint(
            "check_acquisition_integrity",
            "cows",
            "(acquisition_type = 'born_on_farm' AND supplier_id IS NULL) OR (acquisition_type != 'born_on_farm' AND dam_id IS NULL AND sire_id IS NULL)",
        )
    with op.batch_alter_table("cows") as batch_op:
        batch_op.drop_column("cow_type")
