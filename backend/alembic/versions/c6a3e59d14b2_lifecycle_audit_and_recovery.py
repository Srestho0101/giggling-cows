"""Add lifecycle actor metadata and append-only operation history.

Revision ID: c6a3e59d14b2
Revises: 9f29af5a4663
Create Date: 2026-10-20
"""

from typing import Sequence, Union

from alembic import context, op
import sqlalchemy as sa


revision: str = "c6a3e59d14b2"
down_revision: Union[str, Sequence[str], None] = "9f29af5a4663"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


ARCHIVABLE_TABLES = (
    "warehouses",
    "suppliers",
    "cows",
    "weight_records",
    "expense_categories",
    "feed_types",
    "feeding_records",
    "expenses",
    "health_records",
    "breeding_records",
    "pregnancy_reports",
    "worker_attendances",
    "mill_charges",
    "milk_productions",
    "customers",
    "market_prices",
    "purchase_evaluations",
)

VOIDABLE_TABLES = (
    "expenses",
    "mill_charges",
    "milk_productions",
    "salary_payments",
    "sales_invoices",
    "sale_payments",
)


def upgrade() -> None:
    for table_name in ARCHIVABLE_TABLES:
        with op.batch_alter_table(table_name) as batch_op:
            batch_op.add_column(sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))
            batch_op.add_column(sa.Column("archived_by", sa.Uuid(), nullable=True))

    for table_name in VOIDABLE_TABLES:
        with op.batch_alter_table(table_name) as batch_op:
            batch_op.add_column(sa.Column("voided_at", sa.DateTime(timezone=True), nullable=True))
            batch_op.add_column(sa.Column("voided_by", sa.Uuid(), nullable=True))

    with op.batch_alter_table("salary_payments") as batch_op:
        batch_op.add_column(
            sa.Column("is_void", sa.Boolean(), nullable=False, server_default=sa.text("false"))
        )

    with op.batch_alter_table("sales_invoices") as batch_op:
        batch_op.add_column(sa.Column("void_reason", sa.Text(), nullable=True))

    op.create_table(
        "safe_data_operation_events",
        sa.Column("event_id", sa.Uuid(), nullable=False),
        sa.Column("entity_type", sa.String(length=80), nullable=False),
        sa.Column("entity_id", sa.Uuid(), nullable=False),
        sa.Column("operation", sa.String(length=40), nullable=False),
        sa.Column("actor_id", sa.Uuid(), nullable=True),
        sa.Column("actor_email", sa.String(length=320), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("event_id"),
    )
    op.create_index(
        "ix_safe_data_operation_events_entity_type",
        "safe_data_operation_events",
        ["entity_type"],
    )
    op.create_index(
        "ix_safe_data_operation_events_entity_id",
        "safe_data_operation_events",
        ["entity_id"],
    )


def downgrade() -> None:
    if context.is_offline_mode():
        raise RuntimeError("Offline downgrade is disabled because audit history cannot be checked.")
    bind = op.get_bind()
    has_events = bind.execute(
        sa.text("SELECT 1 FROM safe_data_operation_events LIMIT 1")
    ).first()
    if has_events:
        raise RuntimeError(
            "Cannot downgrade while safe-data operation history exists. Export the audit events "
            "before removing this migration."
        )

    op.drop_index("ix_safe_data_operation_events_entity_id", table_name="safe_data_operation_events")
    op.drop_index("ix_safe_data_operation_events_entity_type", table_name="safe_data_operation_events")
    op.drop_table("safe_data_operation_events")

    with op.batch_alter_table("sales_invoices") as batch_op:
        batch_op.drop_column("void_reason")

    with op.batch_alter_table("salary_payments") as batch_op:
        batch_op.drop_column("is_void")

    for table_name in reversed(VOIDABLE_TABLES):
        with op.batch_alter_table(table_name) as batch_op:
            batch_op.drop_column("voided_by")
            batch_op.drop_column("voided_at")

    for table_name in reversed(ARCHIVABLE_TABLES):
        with op.batch_alter_table(table_name) as batch_op:
            batch_op.drop_column("archived_by")
            batch_op.drop_column("archived_at")
