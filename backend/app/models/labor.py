import uuid
from datetime import date
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import JSON, Boolean, Date, ForeignKey, Numeric, String, Text, UniqueConstraint, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import ArchiveAuditMixin, AuditMixin, Base, VoidAuditMixin


class Worker(Base, AuditMixin, ArchiveAuditMixin):
    __tablename__ = "workers"

    worker_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    role: Mapped[str] = mapped_column(String(50), nullable=False, default="caretaker")
    join_date: Mapped[date] = mapped_column(Date, nullable=False)
    monthly_salary: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    weekly_holidays: Mapped[list[int]] = mapped_column(
        JSON, nullable=False, default=list, server_default=text("'[]'")
    )
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")  # 'active' | 'inactive'

    # Relationships
    attendances: Mapped[List["WorkerAttendance"]] = relationship(
        "WorkerAttendance", back_populates="worker", cascade="save-update, merge"
    )
    salary_payments: Mapped[List["SalaryPayment"]] = relationship(
        "SalaryPayment", back_populates="worker", cascade="save-update, merge"
    )


class WorkerAttendance(Base, AuditMixin, ArchiveAuditMixin):
    __tablename__ = "worker_attendances"

    attendance_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    worker_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("workers.worker_id", ondelete="RESTRICT"), nullable=False
    )
    attendance_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    is_present: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    __table_args__ = (
        UniqueConstraint("worker_id", "attendance_date", name="unique_worker_daily_attendance"),
    )

    # Relationships
    worker: Mapped["Worker"] = relationship("Worker", back_populates="attendances")


class SalaryPayment(Base, AuditMixin, VoidAuditMixin):
    __tablename__ = "salary_payments"

    payment_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    worker_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("workers.worker_id", ondelete="RESTRICT"), nullable=False
    )
    pay_month: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    base_salary: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    absence_deduction: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0.00)
    bonus: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0.00)
    net_paid: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    paid_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="paid")  # 'paid' | 'pending' | 'cancelled'
    is_void: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    void_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    worker: Mapped["Worker"] = relationship("Worker", back_populates="salary_payments")


class MillCharge(Base, AuditMixin, ArchiveAuditMixin, VoidAuditMixin):
    __tablename__ = "mill_charges"

    mill_charge_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    charge_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    charge_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # 'worker_food' | 'substitute_worker' | 'other'
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    substitute_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_void: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    void_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
