from datetime import date, datetime, timedelta
from typing import List, Optional
import uuid
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.core.database import get_db
from app.core.security import AuthUser, UserRole, get_current_user, require_roles
from app.models.health import BreedingRecord, CalvingEvent, HealthRecord, Pregnancy, PregnancyReport, Sire
from app.models.herd import Cow
from app.schemas.health import (
    BreedingActionQueueItem,
    BreedingRecordCreate,
    BreedingRecordRead,
    BreedingRecordUpdate,
    BreedingSummaryRead,
    CalvingCalfSummary,
    CalvingEventRead,
    CalvingRequest,
    HealthRecordCreate,
    HealthRecordRead,
    HealthRecordUpdate,
    PregnancyCreate,
    PregnancyRead,
    PregnancyReportCreate,
    PregnancyReportRead,
    PregnancyReportUpdate,
    PregnancyUpdate,
    SireCreate,
    SireRead,
    SireUpdate,
)
from app.services.breeding_service import (
    DRY_OFF_DAYS_BEFORE_CALVING,
    fail_prior_open_breedings,
    record_calving_for_pregnancy,
    resolve_or_create_sire_for_breeding,
    sire_display_name,
    sync_check_to_pregnancy_episode,
)
from app.services.safe_data_operations import capture_lifecycle_state, record_lifecycle_changes

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

    lifecycle_before = capture_lifecycle_state(record)
    update_dict = data.model_dump(exclude_unset=True)

    for field, val in update_dict.items():
        setattr(record, field, val)
    record_lifecycle_changes(db, record, lifecycle_before, current_user.id, current_user.email)
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


# ---------------------- SIRE REGISTRY ----------------------
def _to_sire_read(sire: Sire) -> SireRead:
    return SireRead(
        sire_id=sire.sire_id,
        source_type=sire.source_type,
        cow_id=sire.cow_id,
        cow_tag_number=sire.cow.current_tag_number if sire.cow else None,
        bull_name=sire.bull_name,
        semen_code=sire.semen_code,
        provider=sire.provider,
        breed=sire.breed,
        notes=sire.notes,
        display_name=sire_display_name(sire),
        is_archived=sire.is_archived,
        created_at=sire.created_at,
        updated_at=sire.updated_at,
        created_by=sire.created_by,
        updated_by=sire.updated_by,
    )


@router.get("/sires", response_model=List[SireRead])
async def list_sires(
    source_type: Optional[str] = None,
    include_archived: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    # Ensure active on-farm bulls/oxen have a Sire entry
    active_bulls = (
        await db.execute(
            select(Cow).where(
                Cow.sex == "male",
                Cow.status == "active",
                Cow.is_archived == False,
            )
        )
    ).scalars().all()
    existing_on_farm_ids = {
        row
        for row in (
            await db.execute(select(Sire.cow_id).where(Sire.source_type == "on_farm", Sire.cow_id.is_not(None)))
        ).scalars().all()
    }
    created_any = False
    for bull in active_bulls:
        if bull.cow_id not in existing_on_farm_ids:
            db.add(
                Sire(
                    source_type="on_farm",
                    cow_id=bull.cow_id,
                    bull_name=bull.current_tag_number,
                    breed=bull.breed,
                    created_by=current_user.id,
                    updated_by=current_user.id,
                )
            )
            created_any = True
    if created_any:
        await db.commit()

    stmt = select(Sire).options(joinedload(Sire.cow)).order_by(Sire.source_type.asc(), Sire.created_at.desc())
    if source_type:
        stmt = stmt.where(Sire.source_type == source_type)
    if not include_archived:
        stmt = stmt.where(Sire.is_archived == False)
    rows = (await db.execute(stmt)).scalars().unique().all()
    return [_to_sire_read(s) for s in rows]


@router.post("/sires", response_model=SireRead, status_code=status.HTTP_201_CREATED)
async def create_sire(
    data: SireCreate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.DATA_ENTRY])),
):
    if data.source_type == "on_farm":
        cow = await db.get(Cow, data.cow_id)
        if not cow:
            raise HTTPException(status_code=404, detail="Cow not found")
        existing = (
            await db.execute(select(Sire).where(Sire.source_type == "on_farm", Sire.cow_id == data.cow_id))
        ).scalar_one_or_none()
        if existing:
            if existing.is_archived:
                existing.is_archived = False
                existing.updated_by = current_user.id
                await db.commit()
            stmt = select(Sire).options(joinedload(Sire.cow)).where(Sire.sire_id == existing.sire_id)
            return _to_sire_read((await db.execute(stmt)).scalar_one())

    sire = Sire(
        source_type=data.source_type,
        cow_id=data.cow_id if data.source_type == "on_farm" else None,
        bull_name=data.bull_name,
        semen_code=data.semen_code.strip() if data.semen_code else None,
        provider=data.provider.strip() if data.provider else None,
        breed=data.breed,
        notes=data.notes,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(sire)
    await db.commit()
    stmt = select(Sire).options(joinedload(Sire.cow)).where(Sire.sire_id == sire.sire_id)
    return _to_sire_read((await db.execute(stmt)).scalar_one())


@router.patch("/sires/{sire_id}", response_model=SireRead)
async def update_sire(
    sire_id: uuid.UUID,
    data: SireUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.DATA_ENTRY])),
):
    sire = await db.get(Sire, sire_id)
    if not sire:
        raise HTTPException(status_code=404, detail="Sire not found")
    lifecycle_before = capture_lifecycle_state(sire)
    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(sire, field, val)
    record_lifecycle_changes(db, sire, lifecycle_before, current_user.id, current_user.email)
    sire.updated_by = current_user.id
    await db.commit()
    stmt = select(Sire).options(joinedload(Sire.cow)).where(Sire.sire_id == sire_id)
    return _to_sire_read((await db.execute(stmt)).scalar_one())


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
            joinedload(BreedingRecord.sire_entry).joinedload(Sire.cow),
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
                sire_registry_id=br.sire_registry_id,
                sire_tag_number=br.sire.current_tag_number if br.sire else None,
                sire_display_name=sire_display_name(br.sire_entry)
                or (f"Sire {br.sire.current_tag_number}" if br.sire else br.semen_code),
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

    if data.sire_id:
        sire = await db.get(Cow, data.sire_id)
        if not sire:
            raise HTTPException(status_code=404, detail="Sire cow not found")

    resolved_reg_id, resolved_sire_id, resolved_code, resolved_provider = await resolve_or_create_sire_for_breeding(
        db,
        sire_registry_id=data.sire_registry_id,
        sire_cow_id=data.sire_id,
        semen_code=data.semen_code,
        semen_provider=data.semen_provider,
        user_id=current_user.id,
    )

    record = BreedingRecord(
        cow_id=data.cow_id,
        heat_date=data.heat_date,
        seed_date=data.seed_date,
        conception_date=data.conception_date,
        method=data.method,
        sire_id=resolved_sire_id,
        sire_registry_id=resolved_reg_id,
        semen_code=resolved_code,
        semen_provider=resolved_provider,
        doctor_name=data.doctor_name,
        cost=data.cost,
        outcome=data.outcome,
        notes=data.notes,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(record)
    await db.flush()

    # Auto-fail prior open breeding attempts when a repeat service is logged
    await fail_prior_open_breedings(
        db,
        cow_id=data.cow_id,
        before_date=data.seed_date,
        exclude_breeding_id=record.breeding_id,
        user_id=current_user.id,
    )

    await db.commit()
    stmt = (
        select(BreedingRecord)
        .options(
            joinedload(BreedingRecord.cow),
            joinedload(BreedingRecord.sire),
            joinedload(BreedingRecord.sire_entry).joinedload(Sire.cow),
        )
        .where(BreedingRecord.breeding_id == record.breeding_id)
    )
    br = (await db.execute(stmt)).scalar_one()

    return BreedingRecordRead(
        breeding_id=br.breeding_id,
        cow_id=br.cow_id,
        cow_tag_number=cow.current_tag_number,
        heat_date=br.heat_date,
        seed_date=br.seed_date,
        conception_date=br.conception_date,
        method=br.method,
        sire_id=br.sire_id,
        sire_registry_id=br.sire_registry_id,
        sire_tag_number=br.sire.current_tag_number if br.sire else None,
        sire_display_name=sire_display_name(br.sire_entry)
        or (f"Sire {br.sire.current_tag_number}" if br.sire else br.semen_code),
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

    lifecycle_before = capture_lifecycle_state(record)
    update_dict = data.model_dump(exclude_unset=True)
    next_heat = update_dict.get("heat_date", record.heat_date)
    next_seed = update_dict.get("seed_date", record.seed_date)
    next_conception = update_dict.get("conception_date", record.conception_date)
    if next_heat is not None and next_seed < next_heat:
        raise HTTPException(status_code=422, detail="Insemination date cannot be earlier than heat date.")
    if next_conception is not None and next_conception < next_seed:
        raise HTTPException(status_code=422, detail="Conception date cannot be earlier than insemination date.")

    if "sire_registry_id" in update_dict or "sire_id" in update_dict or "semen_code" in update_dict:
        next_reg = update_dict.get("sire_registry_id")
        next_sire = update_dict.get("sire_id")
        next_semen = update_dict.get("semen_code")
        next_provider = update_dict.get("semen_provider", record.semen_provider)
        if next_reg is None and next_sire is None and (next_semen is None or not str(next_semen).strip()):
            raise HTTPException(
                status_code=422,
                detail="Please choose either an on-farm sire OR enter a purchased semen code.",
            )
        reg_id, sire_id, code, prov = await resolve_or_create_sire_for_breeding(
            db,
            sire_registry_id=next_reg,
            sire_cow_id=next_sire,
            semen_code=next_semen,
            semen_provider=next_provider,
            user_id=current_user.id,
        )
        update_dict["sire_registry_id"] = reg_id
        update_dict["sire_id"] = sire_id
        update_dict["semen_code"] = code
        update_dict["semen_provider"] = prov

    for field, val in update_dict.items():
        setattr(record, field, val)
    record_lifecycle_changes(db, record, lifecycle_before, current_user.id, current_user.email)
    record.updated_by = current_user.id

    await db.commit()
    stmt = (
        select(BreedingRecord)
        .options(
            joinedload(BreedingRecord.cow),
            joinedload(BreedingRecord.sire),
            joinedload(BreedingRecord.sire_entry).joinedload(Sire.cow),
        )
        .where(BreedingRecord.breeding_id == breeding_id)
    )
    br = (await db.execute(stmt)).scalar_one()

    return BreedingRecordRead(
        breeding_id=br.breeding_id,
        cow_id=br.cow_id,
        cow_tag_number=br.cow.current_tag_number if br.cow else None,
        heat_date=br.heat_date,
        seed_date=br.seed_date,
        conception_date=br.conception_date,
        method=br.method,
        sire_id=br.sire_id,
        sire_registry_id=br.sire_registry_id,
        sire_tag_number=br.sire.current_tag_number if br.sire else None,
        sire_display_name=sire_display_name(br.sire_entry)
        or (f"Sire {br.sire.current_tag_number}" if br.sire else br.semen_code),
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
                episode_id=pr.episode_id,
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

    if data.breeding_id:
        breeding = await db.get(BreedingRecord, data.breeding_id)
        if not breeding:
            raise HTTPException(status_code=404, detail="Breeding record not found")
        if data.report_date < breeding.seed_date:
            raise HTTPException(
                status_code=422,
                detail="Check date cannot be earlier than insemination date.",
            )
        if data.expected_calving_date is not None and data.expected_calving_date <= breeding.seed_date:
            raise HTTPException(
                status_code=422,
                detail="Expected calving date must be after insemination date.",
            )

    resolved_status = data.status
    if data.actual_calving_date is not None and resolved_status in ("confirmed", "suspected"):
        resolved_status = "calved"

    report = PregnancyReport(
        cow_id=data.cow_id,
        breeding_id=data.breeding_id,
        episode_id=data.episode_id,
        report_date=data.report_date,
        status=resolved_status,
        expected_calving_date=data.expected_calving_date,
        actual_calving_date=data.actual_calving_date,
        notes=data.notes,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(report)
    await db.flush()

    await sync_check_to_pregnancy_episode(db, report, current_user.id)

    if report.actual_calving_date is not None or report.status == "calved":
        prior_open_stmt = select(PregnancyReport).where(
            PregnancyReport.cow_id == report.cow_id,
            PregnancyReport.pregnancy_id != report.pregnancy_id,
            PregnancyReport.is_archived == False,
            PregnancyReport.status.in_(["confirmed", "suspected"]),
            PregnancyReport.report_date <= report.report_date,
        )
        for prior in (await db.execute(prior_open_stmt)).scalars().all():
            prior.status = "calved"
            if prior.actual_calving_date is None and report.actual_calving_date is not None:
                prior.actual_calving_date = report.actual_calving_date
            prior.updated_by = current_user.id

    await db.commit()
    await db.refresh(report)

    return PregnancyReportRead(
        pregnancy_id=report.pregnancy_id,
        cow_id=report.cow_id,
        cow_tag_number=cow.current_tag_number,
        breeding_id=report.breeding_id,
        episode_id=report.episode_id,
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

    lifecycle_before = capture_lifecycle_state(report)
    update_dict = data.model_dump(exclude_unset=True)
    next_report_date = update_dict.get("report_date", report.report_date)
    next_expected = update_dict.get("expected_calving_date", report.expected_calving_date)
    next_actual = update_dict.get("actual_calving_date", report.actual_calving_date)
    next_status = update_dict.get("status", report.status)
    next_breeding_id = update_dict.get("breeding_id", report.breeding_id)

    if (
        next_expected is not None
        and next_actual is None
        and next_status in ("confirmed", "suspected")
        and next_expected < next_report_date
    ):
        raise HTTPException(
            status_code=422,
            detail="Expected calving date cannot be earlier than check date.",
        )

    if next_breeding_id:
        breeding = await db.get(BreedingRecord, next_breeding_id)
        if not breeding:
            raise HTTPException(status_code=404, detail="Breeding record not found")
        if next_report_date < breeding.seed_date:
            raise HTTPException(
                status_code=422,
                detail="Check date cannot be earlier than insemination date.",
            )
        if (
            next_expected is not None
            and next_actual is None
            and next_status in ("confirmed", "suspected")
            and next_expected <= breeding.seed_date
        ):
            raise HTTPException(
                status_code=422,
                detail="Expected calving date must be after insemination date.",
            )

    for field, val in update_dict.items():
        setattr(report, field, val)

    # Auto-transition status to "calved" when actual_calving_date is recorded
    if (
        report.actual_calving_date is not None
        and report.status in ("confirmed", "suspected")
    ):
        report.status = "calved"

    if report.actual_calving_date is not None or report.status == "calved":
        prior_open_stmt = select(PregnancyReport).where(
            PregnancyReport.cow_id == report.cow_id,
            PregnancyReport.pregnancy_id != report.pregnancy_id,
            PregnancyReport.is_archived == False,
            PregnancyReport.status.in_(["confirmed", "suspected"]),
            PregnancyReport.report_date <= report.report_date,
        )
        for prior in (await db.execute(prior_open_stmt)).scalars().all():
            prior.status = "calved"
            if prior.actual_calving_date is None and report.actual_calving_date is not None:
                prior.actual_calving_date = report.actual_calving_date
            prior.updated_by = current_user.id

    await sync_check_to_pregnancy_episode(db, report, current_user.id)

    record_lifecycle_changes(db, report, lifecycle_before, current_user.id, current_user.email)
    report.updated_by = current_user.id

    await db.commit()
    await db.refresh(report)

    cow = await db.get(Cow, report.cow_id)
    return PregnancyReportRead(
        pregnancy_id=report.pregnancy_id,
        cow_id=report.cow_id,
        cow_tag_number=cow.current_tag_number if cow else None,
        breeding_id=report.breeding_id,
        episode_id=report.episode_id,
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


# ---------------------- PREGNANCY EPISODES & CALVING ----------------------
async def _build_pregnancy_read(db: AsyncSession, preg: Pregnancy) -> PregnancyRead:
    calving_read: Optional[CalvingEventRead] = None
    if preg.calving_event and not preg.calving_event.is_archived:
        calves = (
            await db.execute(
                select(Cow)
                .where(Cow.origin_calving_id == preg.calving_event.calving_id, Cow.is_archived == False)
                .order_by(Cow.created_at.asc())
            )
        ).scalars().all()
        calving_read = CalvingEventRead(
            calving_id=preg.calving_event.calving_id,
            pregnancy_id=preg.calving_event.pregnancy_id,
            dam_id=preg.calving_event.dam_id,
            dam_tag_number=preg.cow.current_tag_number if preg.cow else None,
            calving_date=preg.calving_event.calving_date,
            calving_ease=preg.calving_event.calving_ease,
            live_count=preg.calving_event.live_count,
            stillborn_count=preg.calving_event.stillborn_count,
            notes=preg.calving_event.notes,
            is_archived=preg.calving_event.is_archived,
            created_at=preg.calving_event.created_at,
            updated_at=preg.calving_event.updated_at,
            created_by=preg.calving_event.created_by,
            updated_by=preg.calving_event.updated_by,
            calves=[
                CalvingCalfSummary(
                    cow_id=c.cow_id,
                    current_tag_number=c.current_tag_number,
                    sex=c.sex,
                    birth_weight_kg=c.birth_weight_kg,
                    status=c.status,
                )
                for c in calves
            ],
        )

    sire_label = sire_display_name(preg.sire_entry)
    if not sire_label and preg.breeding_record:
        if preg.breeding_record.sire_entry:
            sire_label = sire_display_name(preg.breeding_record.sire_entry)
        elif preg.breeding_record.sire:
            sire_label = f"Sire {preg.breeding_record.sire.current_tag_number}"
        elif preg.breeding_record.semen_code:
            sire_label = preg.breeding_record.semen_code

    sorted_checks = sorted(
        [c for c in preg.checks if not c.is_archived],
        key=lambda c: (c.report_date, c.created_at),
        reverse=True,
    )
    return PregnancyRead(
        pregnancy_id=preg.pregnancy_id,
        cow_id=preg.cow_id,
        cow_tag_number=preg.cow.current_tag_number if preg.cow else None,
        breeding_id=preg.breeding_id,
        breeding_seed_date=preg.breeding_record.seed_date if preg.breeding_record else None,
        sire_registry_id=preg.sire_registry_id,
        sire_display_name=sire_label,
        status=preg.status,
        confirmed_date=preg.confirmed_date,
        expected_calving_date=preg.expected_calving_date,
        dry_off_date=preg.dry_off_date,
        ended_at=preg.ended_at,
        next_breeding_eligible_date=preg.next_breeding_eligible_date,
        notes=preg.notes,
        is_archived=preg.is_archived,
        created_at=preg.created_at,
        updated_at=preg.updated_at,
        created_by=preg.created_by,
        updated_by=preg.updated_by,
        checks=[
            PregnancyReportRead(
                pregnancy_id=chk.pregnancy_id,
                cow_id=chk.cow_id,
                cow_tag_number=preg.cow.current_tag_number if preg.cow else None,
                breeding_id=chk.breeding_id,
                episode_id=chk.episode_id,
                report_date=chk.report_date,
                status=chk.status,
                expected_calving_date=chk.expected_calving_date,
                actual_calving_date=chk.actual_calving_date,
                notes=chk.notes,
                is_archived=chk.is_archived,
                created_at=chk.created_at,
                updated_at=chk.updated_at,
                created_by=chk.created_by,
                updated_by=chk.updated_by,
            )
            for chk in sorted_checks
        ],
        calving_event=calving_read,
    )


@router.get("/pregnancies", response_model=List[PregnancyRead])
async def list_pregnancies(
    cow_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
    include_archived: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    stmt = (
        select(Pregnancy)
        .options(
            joinedload(Pregnancy.cow),
            joinedload(Pregnancy.breeding_record).joinedload(BreedingRecord.sire),
            joinedload(Pregnancy.breeding_record).joinedload(BreedingRecord.sire_entry).joinedload(Sire.cow),
            joinedload(Pregnancy.sire_entry).joinedload(Sire.cow),
            selectinload(Pregnancy.checks),
            joinedload(Pregnancy.calving_event),
        )
        .order_by(Pregnancy.created_at.desc())
    )
    if cow_id:
        stmt = stmt.where(Pregnancy.cow_id == cow_id)
    if status:
        stmt = stmt.where(Pregnancy.status == status)
    if not include_archived:
        stmt = stmt.where(Pregnancy.is_archived == False)

    rows = (await db.execute(stmt)).scalars().unique().all()
    return [await _build_pregnancy_read(db, p) for p in rows]


@router.post("/pregnancies", response_model=PregnancyRead, status_code=status.HTTP_201_CREATED)
async def create_pregnancy(
    data: PregnancyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.DATA_ENTRY])),
):
    cow = await db.get(Cow, data.cow_id)
    if not cow:
        raise HTTPException(status_code=404, detail="Cow not found")

    dry_off = (
        data.expected_calving_date - timedelta(days=DRY_OFF_DAYS_BEFORE_CALVING)
        if data.expected_calving_date
        else None
    )
    preg = Pregnancy(
        cow_id=data.cow_id,
        breeding_id=data.breeding_id,
        sire_registry_id=data.sire_registry_id,
        status=data.status,
        confirmed_date=data.confirmed_date,
        expected_calving_date=data.expected_calving_date,
        dry_off_date=dry_off,
        notes=data.notes,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(preg)
    await db.commit()

    stmt = (
        select(Pregnancy)
        .options(
            joinedload(Pregnancy.cow),
            joinedload(Pregnancy.breeding_record).joinedload(BreedingRecord.sire),
            joinedload(Pregnancy.breeding_record).joinedload(BreedingRecord.sire_entry).joinedload(Sire.cow),
            joinedload(Pregnancy.sire_entry).joinedload(Sire.cow),
            selectinload(Pregnancy.checks),
            joinedload(Pregnancy.calving_event),
        )
        .where(Pregnancy.pregnancy_id == preg.pregnancy_id)
    )
    return await _build_pregnancy_read(db, (await db.execute(stmt)).scalar_one())


@router.patch("/pregnancies/{pregnancy_id}", response_model=PregnancyRead)
async def update_pregnancy(
    pregnancy_id: uuid.UUID,
    data: PregnancyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.DATA_ENTRY])),
):
    preg = await db.get(Pregnancy, pregnancy_id)
    if not preg:
        raise HTTPException(status_code=404, detail="Pregnancy not found")
    lifecycle_before = capture_lifecycle_state(preg)
    update_dict = data.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        setattr(preg, field, val)
    if "expected_calving_date" in update_dict and "dry_off_date" not in update_dict:
        preg.dry_off_date = (
            preg.expected_calving_date - timedelta(days=DRY_OFF_DAYS_BEFORE_CALVING)
            if preg.expected_calving_date
            else None
        )
    if preg.status in ("aborted", "failed") and preg.ended_at is None:
        preg.ended_at = datetime.now(ZoneInfo("Asia/Dhaka")).date()
    record_lifecycle_changes(db, preg, lifecycle_before, current_user.id, current_user.email)
    preg.updated_by = current_user.id
    await db.commit()

    stmt = (
        select(Pregnancy)
        .options(
            joinedload(Pregnancy.cow),
            joinedload(Pregnancy.breeding_record).joinedload(BreedingRecord.sire),
            joinedload(Pregnancy.breeding_record).joinedload(BreedingRecord.sire_entry).joinedload(Sire.cow),
            joinedload(Pregnancy.sire_entry).joinedload(Sire.cow),
            selectinload(Pregnancy.checks),
            joinedload(Pregnancy.calving_event),
        )
        .where(Pregnancy.pregnancy_id == pregnancy_id)
    )
    return await _build_pregnancy_read(db, (await db.execute(stmt)).scalar_one())


@router.post("/pregnancies/{pregnancy_id}/calve", response_model=CalvingEventRead, status_code=status.HTTP_201_CREATED)
async def calve_pregnancy(
    pregnancy_id: uuid.UUID,
    data: CalvingRequest,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.DATA_ENTRY])),
):
    preg = await db.get(Pregnancy, pregnancy_id)
    if not preg or preg.is_archived:
        raise HTTPException(status_code=404, detail="Pregnancy not found")
    if preg.status in ("aborted", "failed"):
        raise HTTPException(status_code=400, detail="Cannot record calving on an aborted or failed pregnancy.")

    calving = await record_calving_for_pregnancy(db, preg, data, current_user.id)
    await db.commit()
    await db.refresh(calving)

    dam = await db.get(Cow, calving.dam_id)
    calves = (
        await db.execute(
            select(Cow).where(Cow.origin_calving_id == calving.calving_id).order_by(Cow.created_at.asc())
        )
    ).scalars().all()

    return CalvingEventRead(
        calving_id=calving.calving_id,
        pregnancy_id=calving.pregnancy_id,
        dam_id=calving.dam_id,
        dam_tag_number=dam.current_tag_number if dam else None,
        calving_date=calving.calving_date,
        calving_ease=calving.calving_ease,
        live_count=calving.live_count,
        stillborn_count=calving.stillborn_count,
        notes=calving.notes,
        is_archived=calving.is_archived,
        created_at=calving.created_at,
        updated_at=calving.updated_at,
        created_by=calving.created_by,
        updated_by=calving.updated_by,
        calves=[
            CalvingCalfSummary(
                cow_id=c.cow_id,
                current_tag_number=c.current_tag_number,
                sex=c.sex,
                birth_weight_kg=c.birth_weight_kg,
                status=c.status,
            )
            for c in calves
        ],
    )


@router.get("/breeding/summary", response_model=BreedingSummaryRead)
async def get_breeding_summary(
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    today = datetime.now(ZoneInfo("Asia/Dhaka")).date()

    breedings = (
        await db.execute(
            select(BreedingRecord)
            .options(joinedload(BreedingRecord.cow))
            .where(BreedingRecord.is_archived == False)
            .order_by(BreedingRecord.seed_date.desc())
        )
    ).scalars().unique().all()

    resolved_breedings = [b for b in breedings if b.outcome in ("successful", "failed")]
    successful_breedings = [b for b in breedings if b.outcome == "successful"]
    conception_rate_pct = (
        round((len(successful_breedings) / len(resolved_breedings)) * 100.0, 1)
        if resolved_breedings
        else None
    )
    avg_services = (
        round(len(resolved_breedings) / len(successful_breedings), 2)
        if successful_breedings
        else None
    )

    pregnancies = (
        await db.execute(
            select(Pregnancy)
            .options(joinedload(Pregnancy.cow), selectinload(Pregnancy.checks))
            .where(Pregnancy.is_archived == False)
        )
    ).scalars().unique().all()

    active_pregs = [p for p in pregnancies if p.status in ("suspected", "confirmed") and p.ended_at is None]
    active_pregnant_cow_ids = {p.cow_id for p in active_pregs}

    due_for_check: List[BreedingActionQueueItem] = []
    for br in breedings:
        if (
            br.outcome == "pending"
            and br.cow
            and br.cow.status == "active"
            and not br.cow.is_archived
            and br.cow_id not in active_pregnant_cow_ids
        ):
            days_since = (today - br.seed_date).days
            if days_since >= 28:
                due_for_check.append(
                    BreedingActionQueueItem(
                        cow_id=br.cow_id,
                        cow_tag_number=br.cow.current_tag_number,
                        bucket="due_for_check",
                        reference_date=br.seed_date,
                        days_value=days_since,
                        breeding_id=br.breeding_id,
                        detail=f"Bred {days_since}d ago — pregnancy check due",
                    )
                )

    due_for_dry_off: List[BreedingActionQueueItem] = []
    calving_due: List[BreedingActionQueueItem] = []
    for preg in active_pregs:
        if not preg.cow or preg.cow.status != "active" or preg.cow.is_archived:
            continue
        if preg.dry_off_date and preg.dry_off_date <= today + timedelta(days=14):
            days_until_dry = (preg.dry_off_date - today).days
            if days_until_dry >= -14:
                due_for_dry_off.append(
                    BreedingActionQueueItem(
                        cow_id=preg.cow_id,
                        cow_tag_number=preg.cow.current_tag_number,
                        bucket="due_for_dry_off",
                        reference_date=preg.dry_off_date,
                        days_value=days_until_dry,
                        pregnancy_id=preg.pregnancy_id,
                        detail=(
                            f"Dry-off overdue by {abs(days_until_dry)}d"
                            if days_until_dry < 0
                            else f"Dry-off due in {days_until_dry}d"
                        ),
                    )
                )
        if preg.expected_calving_date and preg.expected_calving_date <= today + timedelta(days=14):
            days_until_calv = (preg.expected_calving_date - today).days
            calving_due.append(
                BreedingActionQueueItem(
                    cow_id=preg.cow_id,
                    cow_tag_number=preg.cow.current_tag_number,
                    bucket="calving_due",
                    reference_date=preg.expected_calving_date,
                    days_value=days_until_calv,
                    pregnancy_id=preg.pregnancy_id,
                    detail=(
                        f"Overdue by {abs(days_until_calv)}d"
                        if days_until_calv < 0
                        else f"Calving due in {days_until_calv}d"
                    ),
                )
            )

    # Open > 90 days: active adult/heifer female cows not pregnant, not in VWP, and >90d open
    latest_vwp_by_cow: dict[uuid.UUID, date] = {}
    for p in pregnancies:
        if p.next_breeding_eligible_date:
            prev = latest_vwp_by_cow.get(p.cow_id)
            if prev is None or p.next_breeding_eligible_date > prev:
                latest_vwp_by_cow[p.cow_id] = p.next_breeding_eligible_date

    latest_calving_by_cow: dict[uuid.UUID, date] = {}
    for p in pregnancies:
        if p.status == "calved" and p.ended_at:
            prev = latest_calving_by_cow.get(p.cow_id)
            if prev is None or p.ended_at > prev:
                latest_calving_by_cow[p.cow_id] = p.ended_at

    female_cows = (
        await db.execute(
            select(Cow).where(Cow.sex == "female", Cow.status == "active", Cow.is_archived == False)
        )
    ).scalars().all()

    open_over_90: List[BreedingActionQueueItem] = []
    for c in female_cows:
        if c.cow_id in active_pregnant_cow_ids:
            continue
        if c.cow_type and "calf" in c.cow_type.lower():
            continue
        if c.birth_date and (today - c.birth_date).days < 365:
            continue
        vwp = latest_vwp_by_cow.get(c.cow_id)
        if vwp and today < vwp:
            continue
        ref_date = latest_calving_by_cow.get(c.cow_id) or c.acquisition_date
        days_open = (today - ref_date).days
        if days_open >= 90:
            open_over_90.append(
                BreedingActionQueueItem(
                    cow_id=c.cow_id,
                    cow_tag_number=c.current_tag_number,
                    bucket="open_over_90_days",
                    reference_date=ref_date,
                    days_value=days_open,
                    detail=f"Open {days_open}d without active pregnancy",
                )
            )

    return BreedingSummaryRead(
        conception_rate_pct=conception_rate_pct,
        avg_services_per_conception=avg_services,
        active_pregnant_count=len(active_pregnant_cow_ids),
        due_for_check=sorted(due_for_check, key=lambda x: x.days_value, reverse=True),
        due_for_dry_off=sorted(due_for_dry_off, key=lambda x: x.days_value),
        calving_due=sorted(calving_due, key=lambda x: x.days_value),
        open_over_90_days=sorted(open_over_90, key=lambda x: x.days_value, reverse=True),
    )
