import uuid
from datetime import date
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import Boolean, CheckConstraint, Date, ForeignKey, Integer, Numeric, String, Text, Uuid
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


class Sire(Base, AuditMixin, ArchiveAuditMixin):
    __tablename__ = "sires"

    sire_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    source_type: Mapped[str] = mapped_column(
        String(30), nullable=False, default="external_semen"
    )  # 'on_farm' | 'external_semen'
    cow_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("cows.cow_id", ondelete="RESTRICT"), nullable=True
    )
    bull_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    semen_code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    provider: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    breed: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    cow: Mapped[Optional["Cow"]] = relationship("Cow", foreign_keys=[cow_id])


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
    sire_registry_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("sires.sire_id", ondelete="SET NULL"), nullable=True
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
    sire_entry: Mapped[Optional["Sire"]] = relationship("Sire", foreign_keys=[sire_registry_id])
    pregnancy_reports: Mapped[List["PregnancyReport"]] = relationship("PregnancyReport", back_populates="breeding_record")
    pregnancies: Mapped[List["Pregnancy"]] = relationship("Pregnancy", back_populates="breeding_record")


class Pregnancy(Base, AuditMixin, ArchiveAuditMixin):
    __tablename__ = "pregnancies"

    pregnancy_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    cow_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("cows.cow_id", ondelete="RESTRICT"), nullable=False, index=True
    )
    breeding_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("breeding_records.breeding_id", ondelete="SET NULL"), nullable=True
    )
    sire_registry_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("sires.sire_id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="suspected"
    )  # 'suspected' | 'confirmed' | 'calved' | 'aborted' | 'failed'
    confirmed_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    expected_calving_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True, index=True)
    dry_off_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    ended_at: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    next_breeding_eligible_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    cow: Mapped["Cow"] = relationship("Cow", foreign_keys=[cow_id])
    breeding_record: Mapped[Optional["BreedingRecord"]] = relationship(
        "BreedingRecord", back_populates="pregnancies"
    )
    sire_entry: Mapped[Optional["Sire"]] = relationship("Sire", foreign_keys=[sire_registry_id])
    checks: Mapped[List["PregnancyReport"]] = relationship("PregnancyReport", back_populates="episode")
    calving_event: Mapped[Optional["CalvingEvent"]] = relationship(
        "CalvingEvent", back_populates="pregnancy", uselist=False
    )


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
    episode_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("pregnancies.pregnancy_id", ondelete="SET NULL"), nullable=True, index=True
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
    episode: Mapped[Optional["Pregnancy"]] = relationship(
        "Pregnancy", back_populates="checks"
    )


class CalvingEvent(Base, AuditMixin, ArchiveAuditMixin):
    __tablename__ = "calving_events"

    calving_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    pregnancy_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("pregnancies.pregnancy_id", ondelete="RESTRICT"), unique=True, nullable=False
    )
    dam_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("cows.cow_id", ondelete="RESTRICT"), nullable=False, index=True
    )
    calving_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    calving_ease: Mapped[str] = mapped_column(
        String(30), nullable=False, default="normal"
    )  # 'normal' | 'assisted' | 'c_section'
    live_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    stillborn_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    pregnancy: Mapped["Pregnancy"] = relationship("Pregnancy", back_populates="calving_event")
    dam: Mapped["Cow"] = relationship("Cow", foreign_keys=[dam_id])
