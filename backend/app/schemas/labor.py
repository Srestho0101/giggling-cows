from datetime import date
from decimal import Decimal
from typing import Annotated, List, Optional
import uuid
from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.common import AuditBase


# WORKER
Weekday = Annotated[int, Field(ge=0, le=6)]  # Monday=0, Sunday=6


class WorkerBase(BaseModel):
    name: str = Field(..., max_length=150)
    phone: Optional[str] = Field(None, max_length=50)
    role: str = Field("caretaker", max_length=50)
    join_date: date
    monthly_salary: Decimal = Field(..., ge=0, max_digits=12, decimal_places=2)
    weekly_holidays: List[Weekday] = Field(default_factory=list)
    status: str = Field("active", pattern="^(active|inactive)$")

    @field_validator("weekly_holidays")
    @classmethod
    def unique_weekly_holidays(cls, days: List[int]) -> List[int]:
        if len(days) != len(set(days)):
            raise ValueError("Weekly holidays cannot contain duplicate days.")
        return sorted(days)


class WorkerCreate(WorkerBase):
    pass


class WorkerUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=150)
    phone: Optional[str] = Field(None, max_length=50)
    role: Optional[str] = Field(None, max_length=50)
    join_date: Optional[date] = None
    monthly_salary: Optional[Decimal] = Field(None, ge=0, max_digits=12, decimal_places=2)
    weekly_holidays: Optional[List[Weekday]] = None
    is_archived: bool = False
    status: Optional[str] = Field(None, pattern="^(active|inactive)$")

    @field_validator("weekly_holidays")
    @classmethod
    def unique_weekly_holidays(cls, days: Optional[List[int]]) -> Optional[List[int]]:
        if days is None:
            raise ValueError("Weekly holidays must be a list; send an empty list to clear them.")
        if len(days) != len(set(days)):
            raise ValueError("Weekly holidays cannot contain duplicate days.")
        return sorted(days)


class WorkerRead(WorkerBase, AuditBase):
    worker_id: uuid.UUID
    is_archived: bool = False


# ATTENDANCE
class AttendanceItem(BaseModel):
    worker_id: uuid.UUID
    is_present: bool = True
    note: Optional[str] = None


class BatchAttendanceCreate(BaseModel):
    attendance_date: date
    records: List[AttendanceItem]


class WorkerAttendanceUpdate(BaseModel):
    is_present: Optional[bool] = None
    note: Optional[str] = None
    is_archived: Optional[bool] = None


class WorkerAttendanceRead(AuditBase):
    attendance_id: uuid.UUID
    worker_id: uuid.UUID
    worker_name: Optional[str] = None
    attendance_date: date
    is_present: bool
    note: Optional[str] = None
    is_archived: bool = False
    is_holiday: bool = False


# SALARY PAYMENT
class SalaryPaymentBase(BaseModel):
    worker_id: uuid.UUID
    pay_month: date
    base_salary: Decimal = Field(..., ge=0, max_digits=12, decimal_places=2)
    absence_deduction: Decimal = Field(Decimal("0.00"), ge=0, max_digits=12, decimal_places=2)
    bonus: Decimal = Field(Decimal("0.00"), ge=0, max_digits=12, decimal_places=2)
    paid_date: date
    status: str = Field("paid", pattern="^(paid|pending|cancelled)$")


class SalaryPaymentCreate(SalaryPaymentBase):
    pass


class SalaryPaymentUpdate(BaseModel):
    base_salary: Optional[Decimal] = Field(None, ge=0, max_digits=12, decimal_places=2)
    absence_deduction: Optional[Decimal] = Field(None, ge=0, max_digits=12, decimal_places=2)
    bonus: Optional[Decimal] = Field(None, ge=0, max_digits=12, decimal_places=2)
    paid_date: Optional[date] = None
    status: Optional[str] = Field(None, pattern="^(paid|pending|cancelled)$")
    is_void: Optional[bool] = None
    void_reason: Optional[str] = None

    @model_validator(mode="after")
    def require_void_reason(self):
        if self.is_void is True and not (self.void_reason or "").strip():
            raise ValueError("A reason is required when voiding a salary payment.")
        return self


class SalaryPaymentRead(SalaryPaymentBase, AuditBase):
    payment_id: uuid.UUID
    worker_name: Optional[str] = None
    net_paid: Decimal
    is_void: bool = False
    void_reason: Optional[str] = None


# MILL CHARGE
class MillChargeBase(BaseModel):
    charge_date: date
    charge_type: str = Field(..., pattern="^(worker_food|substitute_worker|other)$")
    amount: Decimal = Field(..., gt=0, max_digits=12, decimal_places=2)
    substitute_name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None


class MillChargeCreate(MillChargeBase):
    pass


class MillChargeUpdate(BaseModel):
    charge_date: Optional[date] = None
    charge_type: Optional[str] = Field(None, pattern="^(worker_food|substitute_worker|other)$")
    amount: Optional[Decimal] = Field(None, gt=0, max_digits=12, decimal_places=2)
    substitute_name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    is_archived: Optional[bool] = None
    is_void: Optional[bool] = None
    void_reason: Optional[str] = None

    @model_validator(mode="after")
    def require_void_reason(self):
        if self.is_void is True and not (self.void_reason or "").strip():
            raise ValueError("A reason is required when voiding a mill charge.")
        return self


class MillChargeRead(MillChargeBase, AuditBase):
    mill_charge_id: uuid.UUID
    is_archived: bool = False
    is_void: bool = False
    void_reason: Optional[str] = None
