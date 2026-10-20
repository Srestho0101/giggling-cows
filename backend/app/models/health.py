import uuid
from datetime import date
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import Boolean, CheckConstraint, Date, ForeignKey, Numeric, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import ArchiveAuditMixin, AuditMixin, Base


class HealthRecord(Base, AuditMixin, ArchiveAuditMixin):
    __tablename__ = "health_records"

    health_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    cow_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("cows.cow_id", ondelete="RESTRICT"), nullable=False
    )
    record_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # 'treatment' | 'vaccination' | 'deworming' | 'checkup'
    record_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    vet_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0.00)
    next_due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True, index=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    cow: Mapped["Cow"] = relationship("Cow")


class BreedingRecord(Base, AuditMixin, ArchiveAuditMixin):
    __tablename__ = "breeding_records"

    breeding_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    cow_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("cows.cow_id", ondelete="RESTRICT"), nullable=False
    )
    heat_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    seed_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    conception_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    method: Mapped[str] = mapped_column(
        String(50), nullable=False, default="artificial_insemination"
    )  # 'artificial_insemination' | 'natural'
    
    # Exactly one source: on-farm sire OR purchased semen
    sire_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("cows.cow_id", ondelete="RESTRICT"), nullable=True
    )
    semen_code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    semen_provider: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    
    doctor_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0.00)
    outcome: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending"
    )  # 'pending' | 'successful' | 'failed'
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    __table_args__ = (
        CheckConstraint(
            "(sire_id IS NOT NULL AND semen_code IS NULL) OR (sire_id IS NULL AND semen_code IS NOT NULL)",
            name="check_breeding_source_exclusivity",
        ),
    )

    # Relationships
    cow: Mapped["Cow"] = relationship("Cow", foreign_keys=[cow_id])
    sire: Mapped[Optional["Cow"]] = relationship("Cow", foreign_keys=[sire_id])
    pregnancy_reports: Mapped[List["PregnancyReport"]] = relationship("PregnancyReport", back_populates="breeding_record")


class PregnancyReport(Base, AuditMixin, ArchiveAuditMixin):
    __tablename__ = "pregnancy_reports"

    pregnancy_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    cow_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("cows.cow_id", ondelete="RESTRICT"), nullable=False
    )
    breeding_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("breeding_records.breeding_id", ondelete="RESTRICT"), nullable=True
    )
    report_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="confirmed"
    )  # 'confirmed' | 'suspected' | 'failed' | 'calved' | 'aborted'
    expected_calving_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True, index=True)
    actual_calving_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    cow: Mapped["Cow"] = relationship("Cow")
    breeding_record: Mapped[Optional["BreedingRecord"]] = relationship(
        "BreedingRecord", back_populates="pregnancy_reports"
    )
