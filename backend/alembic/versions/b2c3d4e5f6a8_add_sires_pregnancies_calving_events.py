"""Add sires, pregnancies, calving_events, and cow lineage/origin fields.

Revision ID: b2c3d4e5f6a8
Revises: a1b2c3d4e5f7
Create Date: 2026-11-28
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b2c3d4e5f6a8"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "sires",
        sa.Column("sire_id", sa.Uuid(), nullable=False),
        sa.Column("source_type", sa.String(length=30), nullable=False, server_default="external_semen"),
        sa.Column("cow_id", sa.Uuid(), nullable=True),
        sa.Column("bull_name", sa.String(length=150), nullable=True),
        sa.Column("semen_code", sa.String(length=100), nullable=True),
        sa.Column("provider", sa.String(length=150), nullable=True),
        sa.Column("breed", sa.String(length=50), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("archived_by", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("updated_by", sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(["cow_id"], ["cows.cow_id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("sire_id"),
    )
    op.create_index("ix_sires_semen_code", "sires", ["semen_code"], unique=False)

    with op.batch_alter_table("breeding_records") as batch_op:
        batch_op.add_column(sa.Column("sire_registry_id", sa.Uuid(), nullable=True))
        batch_op.create_foreign_key(
            "fk_breeding_records_sire_registry",
            "sires",
            ["sire_registry_id"],
            ["sire_id"],
            ondelete="SET NULL",
        )

    op.create_table(
        "pregnancies",
        sa.Column("pregnancy_id", sa.Uuid(), nullable=False),
        sa.Column("cow_id", sa.Uuid(), nullable=False),
        sa.Column("breeding_id", sa.Uuid(), nullable=True),
        sa.Column("sire_registry_id", sa.Uuid(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="suspected"),
        sa.Column("confirmed_date", sa.Date(), nullable=True),
        sa.Column("expected_calving_date", sa.Date(), nullable=True),
        sa.Column("dry_off_date", sa.Date(), nullable=True),
        sa.Column("ended_at", sa.Date(), nullable=True),
        sa.Column("next_breeding_eligible_date", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("archived_by", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("updated_by", sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(["breeding_id"], ["breeding_records.breeding_id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["cow_id"], ["cows.cow_id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["sire_registry_id"], ["sires.sire_id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("pregnancy_id"),
    )
    op.create_index("ix_pregnancies_cow_id", "pregnancies", ["cow_id"], unique=False)
    op.create_index("ix_pregnancies_expected_calving_date", "pregnancies", ["expected_calving_date"], unique=False)

    with op.batch_alter_table("pregnancy_reports") as batch_op:
        batch_op.add_column(sa.Column("episode_id", sa.Uuid(), nullable=True))
        batch_op.create_index("ix_pregnancy_reports_episode_id", ["episode_id"], unique=False)
        batch_op.create_foreign_key(
            "fk_pregnancy_reports_episode",
            "pregnancies",
            ["episode_id"],
            ["pregnancy_id"],
            ondelete="SET NULL",
        )

    op.create_table(
        "calving_events",
        sa.Column("calving_id", sa.Uuid(), nullable=False),
        sa.Column("pregnancy_id", sa.Uuid(), nullable=False),
        sa.Column("dam_id", sa.Uuid(), nullable=False),
        sa.Column("calving_date", sa.Date(), nullable=False),
        sa.Column("calving_ease", sa.String(length=30), nullable=False, server_default="normal"),
        sa.Column("live_count", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("stillborn_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("archived_by", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("updated_by", sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(["dam_id"], ["cows.cow_id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["pregnancy_id"], ["pregnancies.pregnancy_id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("calving_id"),
        sa.UniqueConstraint("pregnancy_id"),
    )
    op.create_index("ix_calving_events_calving_date", "calving_events", ["calving_date"], unique=False)
    op.create_index("ix_calving_events_dam_id", "calving_events", ["dam_id"], unique=False)

    with op.batch_alter_table("cows") as batch_op:
        batch_op.add_column(sa.Column("sire_registry_id", sa.Uuid(), nullable=True))
        batch_op.add_column(sa.Column("origin_calving_id", sa.Uuid(), nullable=True))
        batch_op.add_column(sa.Column("birth_weight_kg", sa.Numeric(8, 2), nullable=True))
        batch_op.create_foreign_key(
            "fk_cows_sire_registry",
            "sires",
            ["sire_registry_id"],
            ["sire_id"],
            ondelete="SET NULL",
        )
        batch_op.create_foreign_key(
            "fk_cows_origin_calving",
            "calving_events",
            ["origin_calving_id"],
            ["calving_id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("cows") as batch_op:
        batch_op.drop_constraint("fk_cows_origin_calving", type_="foreignkey")
        batch_op.drop_constraint("fk_cows_sire_registry", type_="foreignkey")
        batch_op.drop_column("birth_weight_kg")
        batch_op.drop_column("origin_calving_id")
        batch_op.drop_column("sire_registry_id")

    op.drop_index("ix_calving_events_dam_id", table_name="calving_events")
    op.drop_index("ix_calving_events_calving_date", table_name="calving_events")
    op.drop_table("calving_events")

    with op.batch_alter_table("pregnancy_reports") as batch_op:
        batch_op.drop_constraint("fk_pregnancy_reports_episode", type_="foreignkey")
        batch_op.drop_index("ix_pregnancy_reports_episode_id")
        batch_op.drop_column("episode_id")

    op.drop_index("ix_pregnancies_expected_calving_date", table_name="pregnancies")
    op.drop_index("ix_pregnancies_cow_id", table_name="pregnancies")
    op.drop_table("pregnancies")

    with op.batch_alter_table("breeding_records") as batch_op:
        batch_op.drop_constraint("fk_breeding_records_sire_registry", type_="foreignkey")
        batch_op.drop_column("sire_registry_id")

    op.drop_index("ix_sires_semen_code", table_name="sires")
    op.drop_table("sires")
