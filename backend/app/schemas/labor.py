from datetime import date
from decimal import Decimal
from typing import List, Optional
import uuid
from pydantic import BaseModel, Field

from app.schemas.common import AuditBase


# WORKER
class WorkerBase(BaseModel):
    name: str = Field(..., max_length=150)
    phone: Optional[str] = Field(None, max_length=50)
    role: str = Field("caretaker", max_length=50)
    join_date: date
    monthly_salary: Decimal = Field(..., ge=0, max_digits=12, decimal_places=2)
    status: str = Field("active", pattern="^(active|inactive)$")


class WorkerCreate(WorkerBase):
    pass


class WorkerUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=150)
    phone: Optional[str] = Field(None, max_length=50)
    role: Optional[str] = Field(None, max_length=50)
    join_date: Optional[date] = None
    monthly_salary: Optional[Decimal] = Field(None, ge=0, max_digits=12, decimal_places=2)
    status: Optional[str] = Field(None, pattern="^(active|inactive)$")


class WorkerRead(WorkerBase, AuditBase):
    worker_id: uuid.UUID


# ATTENDANCE
class AttendanceItem(BaseModel):
    worker_id: uuid.UUID
    is_present: bool = True
    note: Optional[str] = None


class BatchAttendanceCreate(BaseModel):
    attendance_date: date
    records: List[AttendanceItem]


class WorkerAttendanceRead(AuditBase):
    attendance_id: uuid.UUID
    worker_id: uuid.UUID
    worker_name: Optional[str] = None
    attendance_date: date
    is_present: bool
    note: Optional[str] = None


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


class SalaryPaymentRead(SalaryPaymentBase, AuditBase):
    payment_id: uuid.UUID
    worker_name: Optional[str] = None
    net_paid: Decimal


# MILL CHARGE
class MillChargeBase(BaseModel):
    charge_date: date
    charge_type: str = Field(..., pattern="^(worker_food|substitute_worker|other)$")
    amount: Decimal = Field(..., gt=0, max_digits=12, decimal_places=2)
    substitute_name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None


class MillChargeCreate(MillChargeBase):
    pass


class MillChargeRead(MillChargeBase, AuditBase):
    mill_charge_id: uuid.UUID
