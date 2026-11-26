"""Add feed stock tracking, worker advances, overtime/advance payroll fields, and market price basis.

Revision ID: f2b4c6d8e0a1
Revises: e1a2b3c4d5f6
Create Date: 2026-11-26
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f2b4c6d8e0a1"
down_revision: Union[str, Sequence[str], None] = "e1a2b3c4d5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("market_prices") as batch_op:
        batch_op.add_column(
            sa.Column("price_basis", sa.String(length=30), nullable=False, server_default="dressed_meat")
        )

    with op.batch_alter_table("feed_types") as batch_op:
        batch_op.add_column(
            sa.Column("stock_quantity", sa.Numeric(10, 2), nullable=False, server_default=sa.text("0.00"))
        )
        batch_op.add_column(
            sa.Column("reorder_level", sa.Numeric(10, 2), nullable=False, server_default=sa.text("0.00"))
        )

    op.create_table(
        "feed_stock_entries",
        sa.Column("stock_entry_id", sa.Uuid(), nullable=False),
        sa.Column("feed_type_id", sa.Uuid(), nullable=False),
        sa.Column("entry_date", sa.Date(), nullable=False),
        sa.Column("quantity_added", sa.Numeric(10, 2), nullable=False),
        sa.Column("unit_cost", sa.Numeric(10, 2), nullable=False, server_default=sa.text("0.00")),
        sa.Column("total_cost", sa.Numeric(12, 2), nullable=False, server_default=sa.text("0.00")),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("archived_by", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("updated_by", sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(["feed_type_id"], ["feed_types.feed_type_id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("stock_entry_id"),
    )
    op.create_index("ix_feed_stock_entries_entry_date", "feed_stock_entries", ["entry_date"], unique=False)

    with op.batch_alter_table("salary_payments") as batch_op:
        batch_op.add_column(
            sa.Column("advance_deduction", sa.Numeric(12, 2), nullable=False, server_default=sa.text("0.00"))
        )
        batch_op.add_column(
            sa.Column("overtime_pay", sa.Numeric(12, 2), nullable=False, server_default=sa.text("0.00"))
        )

    op.create_table(
        "worker_advances",
        sa.Column("advance_id", sa.Uuid(), nullable=False),
        sa.Column("worker_id", sa.Uuid(), nullable=False),
        sa.Column("advance_date", sa.Date(), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_void", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("void_reason", sa.Text(), nullable=True),
        sa.Column("voided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("voided_by", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("updated_by", sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(["worker_id"], ["workers.worker_id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("advance_id"),
    )
    op.create_index("ix_worker_advances_advance_date", "worker_advances", ["advance_date"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_worker_advances_advance_date", table_name="worker_advances")
    op.drop_table("worker_advances")

    with op.batch_alter_table("salary_payments") as batch_op:
        batch_op.drop_column("overtime_pay")
        batch_op.drop_column("advance_deduction")

    op.drop_index("ix_feed_stock_entries_entry_date", table_name="feed_stock_entries")
    op.drop_table("feed_stock_entries")

    with op.batch_alter_table("feed_types") as batch_op:
        batch_op.drop_column("reorder_level")
        batch_op.drop_column("stock_quantity")

    with op.batch_alter_table("market_prices") as batch_op:
        batch_op.drop_column("price_basis")
