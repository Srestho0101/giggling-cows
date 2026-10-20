from datetime import date
from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.core.database import get_db
from app.core.security import AuthUser, UserRole, get_current_user, require_roles
from app.models.health import BreedingRecord, HealthRecord, PregnancyReport
from app.models.herd import Cow
from app.schemas.health import (
    BreedingRecordCreate,
    BreedingRecordRead,
    BreedingRecordUpdate,
    HealthRecordCreate,
    HealthRecordRead,
    HealthRecordUpdate,
    PregnancyReportCreate,
    PregnancyReportRead,
    PregnancyReportUpdate,
)

router = APIRouter()


# ---------------------- HEALTH RECORDS ----------------------
@router.get("/records", response_model=List[HealthRecordRead])
async def list_health_records(
    cow_id: Optional[uuid.UUID] = None,
    record_type: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    include_archived: bool = False,
    archived_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    stmt = (
        select(HealthRecord)
        .options(joinedload(HealthRecord.cow))
        .order_by(HealthRecord.record_date.desc())
    )
    if cow_id:
        stmt = stmt.where(HealthRecord.cow_id == cow_id)
    if record_type:
        stmt = stmt.where(HealthRecord.record_type == record_type)
    if start_date:
        stmt = stmt.where(HealthRecord.record_date >= start_date)
    if end_date:
        stmt = stmt.where(HealthRecord.record_date <= end_date)
    if archived_only:
        stmt = stmt.where(HealthRecord.is_archived == True)
    elif not include_archived:
        stmt = stmt.where(HealthRecord.is_archived == False)

    records = (await db.execute(stmt)).scalars().unique().all()
    res = []
    for r in records:
        res.append(
            HealthRecordRead(
                health_id=r.health_id,
                cow_id=r.cow_id,
                cow_tag_number=r.cow.current_tag_number if r.cow else None,
                record_type=r.record_type,
                record_date=r.record_date,
                vet_name=r.vet_name,
                details=r.details,
                cost=r.cost,
                next_due_date=r.next_due_date,
                is_archived=r.is_archived,
                created_at=r.created_at,
                updated_at=r.updated_at,
                created_by=r.created_by,
                updated_by=r.updated_by,
            )
        )
    return res


@router.post("/records", response_model=HealthRecordRead, status_code=status.HTTP_201_CREATED)
async def create_health_record(
    data: HealthRecordCreate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.DATA_ENTRY])),
):
    cow = await db.get(Cow, data.cow_id)
    if not cow:
        raise HTTPException(status_code=404, detail="Cow not found")

    record = HealthRecord(
        cow_id=data.cow_id,
        record_type=data.record_type,
        record_date=data.record_date,
        vet_name=data.vet_name,
        details=data.details,
        cost=data.cost,
        next_due_date=data.next_due_date,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    return HealthRecordRead(
        health_id=record.health_id,
        cow_id=record.cow_id,
        cow_tag_number=cow.current_tag_number,
        record_type=record.record_type,
        record_date=record.record_date,
        vet_name=record.vet_name,
        details=record.details,
        cost=record.cost,
        next_due_date=record.next_due_date,
        is_archived=record.is_archived,
        created_at=record.created_at,
        updated_at=record.updated_at,
        created_by=record.created_by,
        updated_by=record.updated_by,
    )


@router.patch("/records/{health_id}", response_model=HealthRecordRead)
async def update_health_record(
    health_id: uuid.UUID,
    data: HealthRecordUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.DATA_ENTRY])),
):
    record = await db.get(HealthRecord, health_id)
    if not record:
        raise HTTPException(status_code=404, detail="Health record not found")

    update_dict = data.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        setattr(record, field, val)
    record.updated_by = current_user.id

    await db.commit()
    await db.refresh(record)

    cow = await db.get(Cow, record.cow_id)
    return HealthRecordRead(
        health_id=record.health_id,
        cow_id=record.cow_id,
        cow_tag_number=cow.current_tag_number if cow else None,
        record_type=record.record_type,
        record_date=record.record_date,
        vet_name=record.vet_name,
        details=record.details,
        cost=record.cost,
        next_due_date=record.next_due_date,
        is_archived=record.is_archived,
        created_at=record.created_at,
        updated_at=record.updated_at,
        created_by=record.created_by,
        updated_by=record.updated_by,
    )


# ---------------------- BREEDING RECORDS ----------------------
@router.get("/breeding", response_model=List[BreedingRecordRead])
async def list_breeding_records(
    cow_id: Optional[uuid.UUID] = None,
    outcome: Optional[str] = None,
    include_archived: bool = False,
    archived_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    stmt = (
        select(BreedingRecord)
        .options(
            joinedload(BreedingRecord.cow),
            joinedload(BreedingRecord.sire),
        )
        .order_by(BreedingRecord.seed_date.desc())
    )
    if cow_id:
        stmt = stmt.where(BreedingRecord.cow_id == cow_id)
    if outcome:
        stmt = stmt.where(BreedingRecord.outcome == outcome)
    if archived_only:
        stmt = stmt.where(BreedingRecord.is_archived == True)
    elif not include_archived:
        stmt = stmt.where(BreedingRecord.is_archived == False)

    records = (await db.execute(stmt)).scalars().unique().all()
    res = []
    for br in records:
        res.append(
            BreedingRecordRead(
                breeding_id=br.breeding_id,
                cow_id=br.cow_id,
                cow_tag_number=br.cow.current_tag_number if br.cow else None,
                heat_date=br.heat_date,
                seed_date=br.seed_date,
                conception_date=br.conception_date,
                method=br.method,
                sire_id=br.sire_id,
                sire_tag_number=br.sire.current_tag_number if br.sire else None,
                semen_code=br.semen_code,
                semen_provider=br.semen_provider,
                doctor_name=br.doctor_name,
                cost=br.cost,
                outcome=br.outcome,
                notes=br.notes,
                is_archived=br.is_archived,
                created_at=br.created_at,
                updated_at=br.updated_at,
                created_by=br.created_by,
                updated_by=br.updated_by,
            )
        )
    return res


@router.post("/breeding", response_model=BreedingRecordRead, status_code=status.HTTP_201_CREATED)
async def create_breeding_record(
    data: BreedingRecordCreate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.DATA_ENTRY])),
):
    cow = await db.get(Cow, data.cow_id)
    if not cow:
        raise HTTPException(status_code=404, detail="Cow not found")

    sire_tag = None
    if data.sire_id:
        sire = await db.get(Cow, data.sire_id)
        if not sire:
            raise HTTPException(status_code=404, detail="Sire cow not found")
        sire_tag = sire.current_tag_number

    record = BreedingRecord(
        cow_id=data.cow_id,
        heat_date=data.heat_date,
        seed_date=data.seed_date,
        conception_date=data.conception_date,
        method=data.method,
        sire_id=data.sire_id,
        semen_code=data.semen_code,
        semen_provider=data.semen_provider,
        doctor_name=data.doctor_name,
        cost=data.cost,
        outcome=data.outcome,
        notes=data.notes,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    return BreedingRecordRead(
        breeding_id=record.breeding_id,
        cow_id=record.cow_id,
        cow_tag_number=cow.current_tag_number,
        heat_date=record.heat_date,
        seed_date=record.seed_date,
        conception_date=record.conception_date,
        method=record.method,
        sire_id=record.sire_id,
        sire_tag_number=sire_tag,
        semen_code=record.semen_code,
        semen_provider=record.semen_provider,
        doctor_name=record.doctor_name,
        cost=record.cost,
        outcome=record.outcome,
        notes=record.notes,
        is_archived=record.is_archived,
        created_at=record.created_at,
        updated_at=record.updated_at,
        created_by=record.created_by,
        updated_by=record.updated_by,
    )


@router.patch("/breeding/{breeding_id}", response_model=BreedingRecordRead)
async def update_breeding_record(
    breeding_id: uuid.UUID,
    data: BreedingRecordUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.DATA_ENTRY])),
):
    record = await db.get(BreedingRecord, breeding_id)
    if not record:
        raise HTTPException(status_code=404, detail="Breeding record not found")

    update_dict = data.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        setattr(record, field, val)
    record.updated_by = current_user.id

    await db.commit()
    await db.refresh(record)

    cow = await db.get(Cow, record.cow_id)
    sire_tag = None
    if record.sire_id:
        sire = await db.get(Cow, record.sire_id)
        if sire:
            sire_tag = sire.current_tag_number

    return BreedingRecordRead(
        breeding_id=record.breeding_id,
        cow_id=record.cow_id,
        cow_tag_number=cow.current_tag_number if cow else None,
        heat_date=record.heat_date,
        seed_date=record.seed_date,
        conception_date=record.conception_date,
        method=record.method,
        sire_id=record.sire_id,
        sire_tag_number=sire_tag,
        semen_code=record.semen_code,
        semen_provider=record.semen_provider,
        doctor_name=record.doctor_name,
        cost=record.cost,
        outcome=record.outcome,
        notes=record.notes,
        is_archived=record.is_archived,
        created_at=record.created_at,
        updated_at=record.updated_at,
        created_by=record.created_by,
        updated_by=record.updated_by,
    )


# ---------------------- PREGNANCY REPORTS ----------------------
@router.get("/pregnancy", response_model=List[PregnancyReportRead])
async def list_pregnancy_reports(
    cow_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
    include_archived: bool = False,
    archived_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    stmt = (
        select(PregnancyReport)
        .options(joinedload(PregnancyReport.cow))
        .order_by(PregnancyReport.report_date.desc())
    )
    if cow_id:
        stmt = stmt.where(PregnancyReport.cow_id == cow_id)
    if status:
        stmt = stmt.where(PregnancyReport.status == status)
    if archived_only:
        stmt = stmt.where(PregnancyReport.is_archived == True)
    elif not include_archived:
        stmt = stmt.where(PregnancyReport.is_archived == False)

    reports = (await db.execute(stmt)).scalars().unique().all()
    res = []
    for pr in reports:
        res.append(
            PregnancyReportRead(
                pregnancy_id=pr.pregnancy_id,
                cow_id=pr.cow_id,
                cow_tag_number=pr.cow.current_tag_number if pr.cow else None,
                breeding_id=pr.breeding_id,
                report_date=pr.report_date,
                status=pr.status,
                expected_calving_date=pr.expected_calving_date,
                actual_calving_date=pr.actual_calving_date,
                notes=pr.notes,
                is_archived=pr.is_archived,
                created_at=pr.created_at,
                updated_at=pr.updated_at,
                created_by=pr.created_by,
                updated_by=pr.updated_by,
            )
        )
    return res


@router.post("/pregnancy", response_model=PregnancyReportRead, status_code=status.HTTP_201_CREATED)
async def create_pregnancy_report(
    data: PregnancyReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.DATA_ENTRY])),
):
    cow = await db.get(Cow, data.cow_id)
    if not cow:
        raise HTTPException(status_code=404, detail="Cow not found")

    report = PregnancyReport(
        cow_id=data.cow_id,
        breeding_id=data.breeding_id,
        report_date=data.report_date,
        status=data.status,
        expected_calving_date=data.expected_calving_date,
        actual_calving_date=data.actual_calving_date,
        notes=data.notes,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    return PregnancyReportRead(
        pregnancy_id=report.pregnancy_id,
        cow_id=report.cow_id,
        cow_tag_number=cow.current_tag_number,
        breeding_id=report.breeding_id,
        report_date=report.report_date,
        status=report.status,
        expected_calving_date=report.expected_calving_date,
        actual_calving_date=report.actual_calving_date,
        notes=report.notes,
        is_archived=report.is_archived,
        created_at=report.created_at,
        updated_at=report.updated_at,
        created_by=report.created_by,
        updated_by=report.updated_by,
    )


@router.patch("/pregnancy/{pregnancy_id}", response_model=PregnancyReportRead)
async def update_pregnancy_report(
    pregnancy_id: uuid.UUID,
    data: PregnancyReportUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.DATA_ENTRY])),
):
    report = await db.get(PregnancyReport, pregnancy_id)
    if not report:
        raise HTTPException(status_code=404, detail="Pregnancy report not found")

    update_dict = data.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        setattr(report, field, val)
    report.updated_by = current_user.id

    await db.commit()
    await db.refresh(report)

    cow = await db.get(Cow, report.cow_id)
    return PregnancyReportRead(
        pregnancy_id=report.pregnancy_id,
        cow_id=report.cow_id,
        cow_tag_number=cow.current_tag_number if cow else None,
        breeding_id=report.breeding_id,
        report_date=report.report_date,
        status=report.status,
        expected_calving_date=report.expected_calving_date,
        actual_calving_date=report.actual_calving_date,
        notes=report.notes,
        is_archived=report.is_archived,
        created_at=report.created_at,
        updated_at=report.updated_at,
        created_by=report.created_by,
        updated_by=report.updated_by,
    )
