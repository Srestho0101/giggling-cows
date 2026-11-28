from datetime import date
from decimal import Decimal
from typing import List, Literal, Optional
import uuid
from pydantic import BaseModel, Field, model_validator

from app.schemas.common import AuditBase


# HEALTH RECORD
class HealthRecordBase(BaseModel):
    cow_id: uuid.UUID
    record_type: str = Field(..., pattern="^(treatment|vaccination|deworming|checkup)$")
    record_date: date
    vet_name: Optional[str] = Field(None, max_length=100)
    details: Optional[str] = None
    cost: Decimal = Field(Decimal("0.00"), ge=0, max_digits=12, decimal_places=2)
    next_due_date: Optional[date] = None


class HealthRecordCreate(HealthRecordBase):
    pass


class HealthRecordUpdate(BaseModel):
    cow_id: Optional[uuid.UUID] = None
    record_type: Optional[str] = Field(None, pattern="^(treatment|vaccination|deworming|checkup)$")
    record_date: Optional[date] = None
    vet_name: Optional[str] = Field(None, max_length=100)
    details: Optional[str] = None
    cost: Optional[Decimal] = Field(None, ge=0, max_digits=12, decimal_places=2)
    next_due_date: Optional[date] = None
    is_archived: Optional[bool] = None


class HealthRecordRead(HealthRecordBase, AuditBase):
    health_id: uuid.UUID
    cow_tag_number: Optional[str] = None
    is_archived: bool = False


# SIRE REGISTRY
class SireBase(BaseModel):
    source_type: Literal["on_farm", "external_semen"] = "external_semen"
    cow_id: Optional[uuid.UUID] = None
    bull_name: Optional[str] = Field(None, max_length=150)
    semen_code: Optional[str] = Field(None, max_length=100)
    provider: Optional[str] = Field(None, max_length=150)
    breed: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = None


class SireCreate(SireBase):
    @model_validator(mode="after")
    def validate_sire(self) -> "SireCreate":
        if self.source_type == "on_farm" and self.cow_id is None:
            raise ValueError("On-farm sire must reference a cow_id.")
        if self.source_type == "external_semen" and not (self.semen_code or self.bull_name):
            raise ValueError("External AI sire requires at least a semen code or bull name.")
        return self


class SireUpdate(BaseModel):
    bull_name: Optional[str] = Field(None, max_length=150)
    semen_code: Optional[str] = Field(None, max_length=100)
    provider: Optional[str] = Field(None, max_length=150)
    breed: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = None
    is_archived: Optional[bool] = None


class SireRead(SireBase, AuditBase):
    sire_id: uuid.UUID
    cow_tag_number: Optional[str] = None
    display_name: Optional[str] = None
    is_archived: bool = False


# BREEDING RECORD
class BreedingRecordBase(BaseModel):
    cow_id: uuid.UUID
    heat_date: Optional[date] = None
    seed_date: date
    conception_date: Optional[date] = None
    method: str = Field("artificial_insemination", pattern="^(artificial_insemination|natural)$")
    sire_id: Optional[uuid.UUID] = None
    sire_registry_id: Optional[uuid.UUID] = None
    semen_code: Optional[str] = Field(None, max_length=100)
    semen_provider: Optional[str] = Field(None, max_length=150)
    doctor_name: Optional[str] = Field(None, max_length=100)
    cost: Decimal = Field(Decimal("0.00"), ge=0, max_digits=12, decimal_places=2)
    outcome: str = Field("pending", pattern="^(pending|successful|failed)$")
    notes: Optional[str] = None


class BreedingRecordCreate(BreedingRecordBase):
    @model_validator(mode="after")
    def validate_breeding_source(self) -> "BreedingRecordCreate":
        has_sire = self.sire_id is not None
        has_registry = self.sire_registry_id is not None
        has_semen = self.semen_code is not None and len(self.semen_code.strip()) > 0
        if not has_registry and ((has_sire and has_semen) or (not has_sire and not has_semen)):
            raise ValueError("Please choose either an on-farm sire OR enter a purchased semen code.")
        if self.heat_date is not None and self.seed_date < self.heat_date:
            raise ValueError("Insemination date cannot be earlier than heat date.")
        if self.conception_date is not None and self.conception_date < self.seed_date:
            raise ValueError("Conception date cannot be earlier than insemination date.")
        return self


class BreedingRecordUpdate(BaseModel):
    heat_date: Optional[date] = None
    seed_date: Optional[date] = None
    conception_date: Optional[date] = None
    method: Optional[str] = Field(None, pattern="^(artificial_insemination|natural)$")
    sire_id: Optional[uuid.UUID] = None
    sire_registry_id: Optional[uuid.UUID] = None
    semen_code: Optional[str] = Field(None, max_length=100)
    semen_provider: Optional[str] = Field(None, max_length=150)
    doctor_name: Optional[str] = Field(None, max_length=100)
    cost: Optional[Decimal] = Field(None, ge=0, max_digits=12, decimal_places=2)
    outcome: Optional[str] = Field(None, pattern="^(pending|successful|failed)$")
    notes: Optional[str] = None
    is_archived: Optional[bool] = None

    @model_validator(mode="after")
    def validate_dates(self) -> "BreedingRecordUpdate":
        if self.heat_date is not None and self.seed_date is not None and self.seed_date < self.heat_date:
            raise ValueError("Insemination date cannot be earlier than heat date.")
        if self.conception_date is not None and self.seed_date is not None and self.conception_date < self.seed_date:
            raise ValueError("Conception date cannot be earlier than insemination date.")
        return self


class BreedingRecordRead(BreedingRecordBase, AuditBase):
    breeding_id: uuid.UUID
    cow_tag_number: Optional[str] = None
    sire_tag_number: Optional[str] = None
    sire_display_name: Optional[str] = None
    is_archived: bool = False


# PREGNANCY REPORT (VET CHECK)
class PregnancyReportBase(BaseModel):
    cow_id: uuid.UUID
    breeding_id: Optional[uuid.UUID] = None
    episode_id: Optional[uuid.UUID] = None
    report_date: date
    status: str = Field("confirmed", pattern="^(confirmed|suspected|failed|calved|aborted)$")
    expected_calving_date: Optional[date] = None
    actual_calving_date: Optional[date] = None
    notes: Optional[str] = None


class PregnancyReportCreate(PregnancyReportBase):
    @model_validator(mode="after")
    def validate_dates(self) -> "PregnancyReportCreate":
        if (
            self.expected_calving_date is not None
            and self.actual_calving_date is None
            and self.status in ("confirmed", "suspected")
            and self.expected_calving_date < self.report_date
        ):
            raise ValueError("Expected calving date cannot be earlier than check date.")
        return self


class PregnancyReportUpdate(BaseModel):
    breeding_id: Optional[uuid.UUID] = None
    episode_id: Optional[uuid.UUID] = None
    report_date: Optional[date] = None
    status: Optional[str] = Field(None, pattern="^(confirmed|suspected|failed|calved|aborted)$")
    expected_calving_date: Optional[date] = None
    actual_calving_date: Optional[date] = None
    notes: Optional[str] = None
    is_archived: Optional[bool] = None

    @model_validator(mode="after")
    def validate_dates(self) -> "PregnancyReportUpdate":
        if (
            self.report_date is not None
            and self.expected_calving_date is not None
            and self.actual_calving_date is None
            and self.status in (None, "confirmed", "suspected")
            and self.expected_calving_date < self.report_date
        ):
            raise ValueError("Expected calving date cannot be earlier than check date.")
        return self


class PregnancyReportRead(PregnancyReportBase, AuditBase):
    pregnancy_id: uuid.UUID
    cow_tag_number: Optional[str] = None
    is_archived: bool = False


# CALVING EVENT & PREGNANCY EPISODE
class CalvingCalfCreate(BaseModel):
    current_tag_number: str = Field(..., min_length=1, max_length=50)
    sex: str = Field(..., pattern="^(male|female)$")
    category: str = Field("dairy", max_length=50)
    cow_type: Optional[str] = Field(None, max_length=50)
    breed: Optional[str] = Field(None, pattern="^(deshi|friesian|other)$")
    color: Optional[str] = Field(None, max_length=80)
    marking: Optional[str] = Field(None, max_length=200)
    birth_weight_kg: Optional[Decimal] = Field(None, gt=0, max_digits=8, decimal_places=2)
    warehouse_id: uuid.UUID
    notes: Optional[str] = None


class CalvingRequest(BaseModel):
    calving_date: date
    calving_ease: Literal["normal", "assisted", "c_section"] = "normal"
    live_count: int = Field(1, ge=0, le=10)
    stillborn_count: int = Field(0, ge=0, le=10)
    notes: Optional[str] = None
    calves: List[CalvingCalfCreate] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_counts(self) -> "CalvingRequest":
        if self.live_count == 0 and self.stillborn_count == 0:
            raise ValueError("Record at least one live or stillborn calf for a calving event.")
        if len(self.calves) > self.live_count:
            raise ValueError("Number of newborn cow profiles cannot exceed live calf count.")
        tags = [c.current_tag_number.strip() for c in self.calves]
        if len(tags) != len(set(tags)):
            raise ValueError("Duplicate calf tag numbers in the same calving.")
        return self


class CalvingCalfSummary(BaseModel):
    cow_id: uuid.UUID
    current_tag_number: str
    sex: str
    birth_weight_kg: Optional[Decimal] = None
    status: str


class CalvingEventRead(AuditBase):
    calving_id: uuid.UUID
    pregnancy_id: uuid.UUID
    dam_id: uuid.UUID
    dam_tag_number: Optional[str] = None
    calving_date: date
    calving_ease: str
    live_count: int
    stillborn_count: int
    notes: Optional[str] = None
    is_archived: bool = False
    calves: List[CalvingCalfSummary] = Field(default_factory=list)


class PregnancyCreate(BaseModel):
    cow_id: uuid.UUID
    breeding_id: Optional[uuid.UUID] = None
    sire_registry_id: Optional[uuid.UUID] = None
    status: Literal["suspected", "confirmed"] = "confirmed"
    confirmed_date: Optional[date] = None
    expected_calving_date: Optional[date] = None
    notes: Optional[str] = None


class PregnancyUpdate(BaseModel):
    breeding_id: Optional[uuid.UUID] = None
    sire_registry_id: Optional[uuid.UUID] = None
    status: Optional[Literal["suspected", "confirmed", "calved", "aborted", "failed"]] = None
    confirmed_date: Optional[date] = None
    expected_calving_date: Optional[date] = None
    dry_off_date: Optional[date] = None
    ended_at: Optional[date] = None
    notes: Optional[str] = None
    is_archived: Optional[bool] = None


class PregnancyRead(AuditBase):
    pregnancy_id: uuid.UUID
    cow_id: uuid.UUID
    cow_tag_number: Optional[str] = None
    breeding_id: Optional[uuid.UUID] = None
    breeding_seed_date: Optional[date] = None
    sire_registry_id: Optional[uuid.UUID] = None
    sire_display_name: Optional[str] = None
    status: str
    confirmed_date: Optional[date] = None
    expected_calving_date: Optional[date] = None
    dry_off_date: Optional[date] = None
    ended_at: Optional[date] = None
    next_breeding_eligible_date: Optional[date] = None
    notes: Optional[str] = None
    is_archived: bool = False
    checks: List[PregnancyReportRead] = Field(default_factory=list)
    calving_event: Optional[CalvingEventRead] = None


class BreedingActionQueueItem(BaseModel):
    cow_id: uuid.UUID
    cow_tag_number: str
    bucket: Literal["due_for_check", "due_for_dry_off", "calving_due", "open_over_90_days"]
    reference_date: date
    days_value: int
    breeding_id: Optional[uuid.UUID] = None
    pregnancy_id: Optional[uuid.UUID] = None
    detail: str


class BreedingSummaryRead(BaseModel):
    conception_rate_pct: Optional[float] = None
    avg_services_per_conception: Optional[float] = None
    active_pregnant_count: int = 0
    due_for_check: List[BreedingActionQueueItem] = Field(default_factory=list)
    due_for_dry_off: List[BreedingActionQueueItem] = Field(default_factory=list)
    calving_due: List[BreedingActionQueueItem] = Field(default_factory=list)
    open_over_90_days: List[BreedingActionQueueItem] = Field(default_factory=list)
