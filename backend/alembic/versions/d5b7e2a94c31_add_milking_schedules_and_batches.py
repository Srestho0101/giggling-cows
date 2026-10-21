"""Add per-cow milking schedules and session batch records.

Revision ID: d5b7e2a94c31
Revises: a82c6f19d304
Create Date: 2026-10-22
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d5b7e2a94c31"
down_revision: Union[str, Sequence[str], None] = "a82c6f19d304"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("cows") as batch_op:
        batch_op.add_column(
            sa.Column("gives_milk", sa.Boolean(), nullable=False, server_default=sa.text("false"))
        )
        batch_op.add_column(
            sa.Column("milking_sessions", sa.JSON(), nullable=False, server_default=sa.text("'[]'"))
        )

    op.create_table(
        "milk_production_batches",
        sa.Column("batch_id", sa.Uuid(), nullable=False),
        sa.Column("production_date", sa.Date(), nullable=False),
        sa.Column("session", sa.String(length=20), nullable=False),
        sa.Column("total_liters", sa.Numeric(8, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("updated_by", sa.Uuid(), nullable=True),
        sa.PrimaryKeyConstraint("batch_id"),
        sa.UniqueConstraint("production_date", "session", name="unique_milk_production_batch_session"),
    )
    op.create_index(
        "ix_milk_production_batches_production_date",
        "milk_production_batches",
        ["production_date"],
        unique=False,
    )

    with op.batch_alter_table("milk_productions") as batch_op:
        batch_op.add_column(sa.Column("batch_id", sa.Uuid(), nullable=True))
        batch_op.create_foreign_key(
            "fk_milk_productions_batch_id_milk_production_batches",
            "milk_production_batches",
            ["batch_id"],
            ["batch_id"],
            ondelete="RESTRICT",
        )
        batch_op.create_index("ix_milk_productions_batch_id", ["batch_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("milk_productions") as batch_op:
        batch_op.drop_index("ix_milk_productions_batch_id")
        batch_op.drop_constraint("fk_milk_productions_batch_id_milk_production_batches", type_="foreignkey")
        batch_op.drop_column("batch_id")

    op.drop_index("ix_milk_production_batches_production_date", table_name="milk_production_batches")
    op.drop_table("milk_production_batches")

    with op.batch_alter_table("cows") as batch_op:
        batch_op.drop_column("milking_sessions")
        batch_op.drop_column("gives_milk")
