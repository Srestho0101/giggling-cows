from datetime import date
from decimal import Decimal
from typing import Optional
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


# BREEDING RECORD
class BreedingRecordBase(BaseModel):
    cow_id: uuid.UUID
    heat_date: Optional[date] = None
    seed_date: date
    conception_date: Optional[date] = None
    method: str = Field("artificial_insemination", pattern="^(artificial_insemination|natural)$")
    sire_id: Optional[uuid.UUID] = None
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
        has_semen = self.semen_code is not None and len(self.semen_code.strip()) > 0
        if (has_sire and has_semen) or (not has_sire and not has_semen):
            raise ValueError("Exactly one source must be provided: either an on-farm sire_id OR purchased semen_code.")
        return self


class BreedingRecordUpdate(BaseModel):
    heat_date: Optional[date] = None
    seed_date: Optional[date] = None
    conception_date: Optional[date] = None
    method: Optional[str] = Field(None, pattern="^(artificial_insemination|natural)$")
    sire_id: Optional[uuid.UUID] = None
    semen_code: Optional[str] = Field(None, max_length=100)
    semen_provider: Optional[str] = Field(None, max_length=150)
    doctor_name: Optional[str] = Field(None, max_length=100)
    cost: Optional[Decimal] = Field(None, ge=0, max_digits=12, decimal_places=2)
    outcome: Optional[str] = Field(None, pattern="^(pending|successful|failed)$")
    notes: Optional[str] = None
    is_archived: Optional[bool] = None


class BreedingRecordRead(BreedingRecordBase, AuditBase):
    breeding_id: uuid.UUID
    cow_tag_number: Optional[str] = None
    sire_tag_number: Optional[str] = None
    is_archived: bool = False


# PREGNANCY REPORT
class PregnancyReportBase(BaseModel):
    cow_id: uuid.UUID
    breeding_id: Optional[uuid.UUID] = None
    report_date: date
    status: str = Field("confirmed", pattern="^(confirmed|suspected|failed|calved|aborted)$")
    expected_calving_date: Optional[date] = None
    actual_calving_date: Optional[date] = None
    notes: Optional[str] = None


class PregnancyReportCreate(PregnancyReportBase):
    pass


class PregnancyReportUpdate(BaseModel):
    breeding_id: Optional[uuid.UUID] = None
    report_date: Optional[date] = None
    status: Optional[str] = Field(None, pattern="^(confirmed|suspected|failed|calved|aborted)$")
    expected_calving_date: Optional[date] = None
    actual_calving_date: Optional[date] = None
    notes: Optional[str] = None
    is_archived: Optional[bool] = None


class PregnancyReportRead(PregnancyReportBase, AuditBase):
    pregnancy_id: uuid.UUID
    cow_tag_number: Optional[str] = None
    is_archived: bool = False
