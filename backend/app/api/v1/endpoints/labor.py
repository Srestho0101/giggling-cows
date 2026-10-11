from datetime import date
from decimal import Decimal
from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import AuthUser, UserRole, get_current_user, require_roles
from app.models.labor import MillCharge, SalaryPayment, Worker, WorkerAttendance
from app.schemas.labor import (
    BatchAttendanceCreate,
    MillChargeCreate,
    MillChargeRead,
    SalaryPaymentCreate,
    SalaryPaymentRead,
    WorkerAttendanceRead,
    WorkerCreate,
    WorkerRead,
    WorkerUpdate,
)

router = APIRouter()


# ---------------------- WORKERS ----------------------
@router.get("/workers", response_model=List[WorkerRead])
async def list_workers(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    stmt = select(Worker)
    if status:
        stmt = stmt.where(Worker.status == status)
    return (await db.execute(stmt)).scalars().all()


@router.post("/workers", response_model=WorkerRead, status_code=status.HTTP_201_CREATED)
async def create_worker(
    data: WorkerCreate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER])),
):
    worker = Worker(
        name=data.name,
        phone=data.phone,
        role=data.role,
        join_date=data.join_date,
        monthly_salary=data.monthly_salary,
        status=data.status,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(worker)
    await db.commit()
    await db.refresh(worker)
    return worker


@router.patch("/workers/{worker_id}", response_model=WorkerRead)
async def update_worker(
    worker_id: uuid.UUID,
    data: WorkerUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER])),
):
    worker = await db.get(Worker, worker_id)
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    update_dict = data.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        setattr(worker, field, val)
    worker.updated_by = current_user.id

    await db.commit()
    await db.refresh(worker)
    return worker


# ---------------------- ATTENDANCE ----------------------
@router.get("/attendance", response_model=List[WorkerAttendanceRead])
async def get_daily_attendance(
    attendance_date: date = Query(default_factory=date.today),
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    # Fetch active workers
    workers_stmt = select(Worker).where(Worker.status == "active").order_by(Worker.name.asc())
    active_workers = (await db.execute(workers_stmt)).scalars().all()

    # Fetch recorded attendance for this date
    att_stmt = (
        select(WorkerAttendance)
        .where(WorkerAttendance.attendance_date == attendance_date)
    )
    recorded = {att.worker_id: att for att in (await db.execute(att_stmt)).scalars().all()}

    res = []
    for w in active_workers:
        if w.worker_id in recorded:
            att = recorded[w.worker_id]
            res.append(
                WorkerAttendanceRead(
                    attendance_id=att.attendance_id,
                    worker_id=w.worker_id,
                    worker_name=w.name,
                    attendance_date=attendance_date,
                    is_present=att.is_present,
                    note=att.note,
                    created_at=att.created_at,
                    updated_at=att.updated_at,
                    created_by=att.created_by,
                    updated_by=att.updated_by,
                )
            )
        else:
            # Default to present if unrecorded
            res.append(
                WorkerAttendanceRead(
                    attendance_id=uuid.uuid4(),
                    worker_id=w.worker_id,
                    worker_name=w.name,
                    attendance_date=attendance_date,
                    is_present=True,
                    note=None,
                )
            )
    return res


@router.post("/attendance/batch", response_model=List[WorkerAttendanceRead])
async def save_batch_attendance(
    data: BatchAttendanceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.DATA_ENTRY])),
):
    results = []
    for item in data.records:
        stmt = select(WorkerAttendance).where(
            WorkerAttendance.worker_id == item.worker_id,
            WorkerAttendance.attendance_date == data.attendance_date,
        )
        existing = (await db.execute(stmt)).scalar_one_or_none()
        if existing:
            existing.is_present = item.is_present
            existing.note = item.note
            existing.updated_by = current_user.id
            results.append(existing)
        else:
            att = WorkerAttendance(
                worker_id=item.worker_id,
                attendance_date=data.attendance_date,
                is_present=item.is_present,
                note=item.note,
                created_by=current_user.id,
                updated_by=current_user.id,
            )
            db.add(att)
            results.append(att)

    await db.commit()
    return await get_daily_attendance(data.attendance_date, db, current_user)


# ---------------------- SALARY PAYMENTS ----------------------
@router.get("/salary-payments", response_model=List[SalaryPaymentRead])
async def list_salary_payments(
    worker_id: Optional[uuid.UUID] = None,
    month: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER])),
):
    stmt = (
        select(SalaryPayment)
        .options(selectinload(SalaryPayment.worker))
        .order_by(SalaryPayment.paid_date.desc())
    )
    if worker_id:
        stmt = stmt.where(SalaryPayment.worker_id == worker_id)
    if month:
        stmt = stmt.where(SalaryPayment.pay_month == month)

    payments = (await db.execute(stmt)).scalars().all()
    res = []
    for p in payments:
        res.append(
            SalaryPaymentRead(
                payment_id=p.payment_id,
                worker_id=p.worker_id,
                worker_name=p.worker.name if p.worker else None,
                pay_month=p.pay_month,
                base_salary=p.base_salary,
                absence_deduction=p.absence_deduction,
                bonus=p.bonus,
                net_paid=p.net_paid,
                paid_date=p.paid_date,
                status=p.status,
                created_at=p.created_at,
                updated_at=p.updated_at,
                created_by=p.created_by,
                updated_by=p.updated_by,
            )
        )
    return res


@router.post("/salary-payments", response_model=SalaryPaymentRead, status_code=status.HTTP_201_CREATED)
async def create_salary_payment(
    data: SalaryPaymentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER])),
):
    worker = await db.get(Worker, data.worker_id)
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    net_paid = data.base_salary - data.absence_deduction + data.bonus
    if net_paid < Decimal("0.00"):
        raise HTTPException(status_code=400, detail="Net paid salary cannot be negative.")

    payment = SalaryPayment(
        worker_id=data.worker_id,
        pay_month=data.pay_month,
        base_salary=data.base_salary,
        absence_deduction=data.absence_deduction,
        bonus=data.bonus,
        net_paid=net_paid,
        paid_date=data.paid_date,
        status=data.status,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(payment)
    await db.commit()
    await db.refresh(payment)

    return SalaryPaymentRead(
        payment_id=payment.payment_id,
        worker_id=payment.worker_id,
        worker_name=worker.name,
        pay_month=payment.pay_month,
        base_salary=payment.base_salary,
        absence_deduction=payment.absence_deduction,
        bonus=payment.bonus,
        net_paid=payment.net_paid,
        paid_date=payment.paid_date,
        status=payment.status,
        created_at=payment.created_at,
        updated_at=payment.updated_at,
        created_by=payment.created_by,
        updated_by=payment.updated_by,
    )


# ---------------------- MILL CHARGES ----------------------
@router.get("/mill-charges", response_model=List[MillChargeRead])
async def list_mill_charges(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    stmt = select(MillCharge).order_by(MillCharge.charge_date.desc())
    if start_date:
        stmt = stmt.where(MillCharge.charge_date >= start_date)
    if end_date:
        stmt = stmt.where(MillCharge.charge_date <= end_date)
    return (await db.execute(stmt)).scalars().all()


@router.post("/mill-charges", response_model=MillChargeRead, status_code=status.HTTP_201_CREATED)
async def create_mill_charge(
    data: MillChargeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.DATA_ENTRY])),
):
    mc = MillCharge(
        charge_date=data.charge_date,
        charge_type=data.charge_type,
        amount=data.amount,
        substitute_name=data.substitute_name,
        description=data.description,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(mc)
    await db.commit()
    await db.refresh(mc)
    return mc
