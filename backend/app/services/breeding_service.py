from datetime import date, timedelta
from decimal import Decimal
from typing import Optional
import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.health import BreedingRecord, CalvingEvent, Pregnancy, PregnancyReport, Sire
from app.models.herd import Cow, CowWarehouseHistory, Warehouse, WeightRecord
from app.schemas.health import CalvingRequest

GESTATION_DAYS = 283
DRY_OFF_DAYS_BEFORE_CALVING = 60
VWP_DAYS_AFTER_CALVING = 50


def sire_display_name(sire: Optional[Sire]) -> Optional[str]:
    if not sire:
        return None
    if sire.source_type == "on_farm":
        if sire.cow:
            return f"Sire {sire.cow.current_tag_number}"
        return sire.bull_name or "On-farm sire"
    parts = [p for p in (sire.bull_name, sire.semen_code) if p]
    label = " · ".join(parts) if parts else "External AI"
    if sire.provider:
        return f"{label} ({sire.provider})"
    return label


async def resolve_or_create_sire_for_breeding(
    session: AsyncSession,
    *,
    sire_registry_id: Optional[uuid.UUID],
    sire_cow_id: Optional[uuid.UUID],
    semen_code: Optional[str],
    semen_provider: Optional[str],
    user_id: Optional[uuid.UUID],
) -> tuple[Optional[uuid.UUID], Optional[uuid.UUID], Optional[str], Optional[str]]:
    """Ensure every breeding record links to a Sire registry entry and satisfies exclusivity."""
    if sire_registry_id:
        sire = await session.get(Sire, sire_registry_id)
        if not sire:
            raise HTTPException(status_code=404, detail="Sire registry entry not found")
        if sire.source_type == "on_farm":
            return sire.sire_id, sire.cow_id, None, None
        code = (semen_code or sire.semen_code or sire.bull_name or "AI").strip()
        provider = semen_provider or sire.provider
        return sire.sire_id, None, code, provider

    if sire_cow_id:
        stmt = select(Sire).where(
            Sire.source_type == "on_farm",
            Sire.cow_id == sire_cow_id,
            Sire.is_archived == False,
        )
        sire = (await session.execute(stmt)).scalar_one_or_none()
        if not sire:
            cow = await session.get(Cow, sire_cow_id)
            sire = Sire(
                source_type="on_farm",
                cow_id=sire_cow_id,
                bull_name=cow.current_tag_number if cow else None,
                breed=cow.breed if cow else None,
                created_by=user_id,
                updated_by=user_id,
            )
            session.add(sire)
            await session.flush()
        return sire.sire_id, sire_cow_id, None, None

    clean_code = (semen_code or "").strip()
    clean_provider = (semen_provider or "").strip() or None
    if clean_code:
        stmt = select(Sire).where(
            Sire.source_type == "external_semen",
            Sire.semen_code == clean_code,
            Sire.is_archived == False,
        )
        sire = (await session.execute(stmt)).scalars().first()
        if not sire:
            sire = Sire(
                source_type="external_semen",
                semen_code=clean_code,
                provider=clean_provider,
                created_by=user_id,
                updated_by=user_id,
            )
            session.add(sire)
            await session.flush()
        elif clean_provider and not sire.provider:
            sire.provider = clean_provider
            sire.updated_by = user_id
        return sire.sire_id, None, clean_code, clean_provider

    return None, None, None, None


async def fail_prior_open_breedings(
    session: AsyncSession,
    *,
    cow_id: uuid.UUID,
    before_date: date,
    exclude_breeding_id: Optional[uuid.UUID],
    user_id: Optional[uuid.UUID],
) -> None:
    """When a repeat breeding occurs or another attempt succeeds, fail prior pending attempts."""
    stmt = select(BreedingRecord).where(
        BreedingRecord.cow_id == cow_id,
        BreedingRecord.is_archived == False,
        BreedingRecord.outcome == "pending",
        BreedingRecord.seed_date < before_date,
    )
    if exclude_breeding_id:
        stmt = stmt.where(BreedingRecord.breeding_id != exclude_breeding_id)
    for prior in (await session.execute(stmt)).scalars().all():
        prior.outcome = "failed"
        prior.updated_by = user_id


async def find_plausible_breeding(
    session: AsyncSession,
    *,
    cow_id: uuid.UUID,
    check_date: date,
) -> Optional[BreedingRecord]:
    """Find the most recent non-archived breeding attempt within 25-120 days (or latest <= check_date)."""
    window_start = check_date - timedelta(days=120)
    window_end = check_date - timedelta(days=25)
    stmt = (
        select(BreedingRecord)
        .where(
            BreedingRecord.cow_id == cow_id,
            BreedingRecord.is_archived == False,
            BreedingRecord.seed_date >= window_start,
            BreedingRecord.seed_date <= window_end,
        )
        .order_by(BreedingRecord.seed_date.desc())
        .limit(1)
    )
    match = (await session.execute(stmt)).scalar_one_or_none()
    if match:
        return match
    fallback_stmt = (
        select(BreedingRecord)
        .where(
            BreedingRecord.cow_id == cow_id,
            BreedingRecord.is_archived == False,
            BreedingRecord.seed_date < check_date,
        )
        .order_by(BreedingRecord.seed_date.desc())
        .limit(1)
    )
    return (await session.execute(fallback_stmt)).scalar_one_or_none()


async def sync_check_to_pregnancy_episode(
    session: AsyncSession,
    report: PregnancyReport,
    user_id: Optional[uuid.UUID],
) -> Optional[Pregnancy]:
    """Attach a PregnancyReport check to a Pregnancy episode and run automatic transitions."""
    breeding: Optional[BreedingRecord] = None
    if report.breeding_id:
        breeding = await session.get(BreedingRecord, report.breeding_id)
    elif report.status in ("confirmed", "suspected"):
        breeding = await find_plausible_breeding(
            session, cow_id=report.cow_id, check_date=report.report_date
        )
        if breeding:
            report.breeding_id = breeding.breeding_id

    # Locate existing episode if linked or open for this cow
    episode: Optional[Pregnancy] = None
    if report.episode_id:
        episode = await session.get(Pregnancy, report.episode_id)
    if not episode:
        open_stmt = (
            select(Pregnancy)
            .where(
                Pregnancy.cow_id == report.cow_id,
                Pregnancy.is_archived == False,
                Pregnancy.status.in_(["suspected", "confirmed"]),
            )
            .order_by(Pregnancy.created_at.desc())
            .limit(1)
        )
        episode = (await session.execute(open_stmt)).scalar_one_or_none()

    if report.status == "failed":
        if breeding and breeding.outcome == "pending":
            breeding.outcome = "failed"
            breeding.updated_by = user_id
        elif not breeding:
            latest_pending = (
                await session.execute(
                    select(BreedingRecord)
                    .where(
                        BreedingRecord.cow_id == report.cow_id,
                        BreedingRecord.is_archived == False,
                        BreedingRecord.outcome == "pending",
                        BreedingRecord.seed_date <= report.report_date,
                    )
                    .order_by(BreedingRecord.seed_date.desc())
                    .limit(1)
                )
            ).scalar_one_or_none()
            if latest_pending:
                latest_pending.outcome = "failed"
                latest_pending.updated_by = user_id
                report.breeding_id = latest_pending.breeding_id
        if episode and episode.status == "suspected":
            episode.status = "failed"
            episode.ended_at = report.report_date
            episode.updated_by = user_id
            report.episode_id = episode.pregnancy_id
        return episode

    if report.status == "aborted":
        if episode:
            episode.status = "aborted"
            episode.ended_at = report.report_date
            if report.notes:
                episode.notes = report.notes
            episode.updated_by = user_id
            report.episode_id = episode.pregnancy_id
        return episode

    if report.status in ("suspected", "confirmed"):
        expected_due = report.expected_calving_date
        if expected_due is None and breeding is not None:
            expected_due = breeding.seed_date + timedelta(days=GESTATION_DAYS)
            report.expected_calving_date = expected_due

        dry_off = (
            expected_due - timedelta(days=DRY_OFF_DAYS_BEFORE_CALVING)
            if expected_due is not None
            else None
        )

        if not episode:
            episode = Pregnancy(
                cow_id=report.cow_id,
                breeding_id=breeding.breeding_id if breeding else report.breeding_id,
                sire_registry_id=breeding.sire_registry_id if breeding else None,
                status=report.status,
                confirmed_date=report.report_date if report.status == "confirmed" else None,
                expected_calving_date=expected_due,
                dry_off_date=dry_off,
                notes=report.notes,
                created_by=user_id,
                updated_by=user_id,
            )
            session.add(episode)
            await session.flush()
        else:
            if breeding and not episode.breeding_id:
                episode.breeding_id = breeding.breeding_id
            if breeding and not episode.sire_registry_id:
                episode.sire_registry_id = breeding.sire_registry_id
            if report.status == "confirmed":
                episode.status = "confirmed"
                episode.confirmed_date = episode.confirmed_date or report.report_date
            if expected_due is not None:
                episode.expected_calving_date = expected_due
                episode.dry_off_date = dry_off
            if report.notes:
                episode.notes = report.notes
            episode.updated_by = user_id

        report.episode_id = episode.pregnancy_id

        if report.status == "confirmed" and breeding is not None:
            breeding.outcome = "successful"
            breeding.conception_date = breeding.conception_date or breeding.seed_date
            breeding.updated_by = user_id
            await fail_prior_open_breedings(
                session,
                cow_id=report.cow_id,
                before_date=breeding.seed_date,
                exclude_breeding_id=breeding.breeding_id,
                user_id=user_id,
            )
        return episode

    if report.status == "calved":
        calving_dt = report.actual_calving_date or report.report_date
        if not episode:
            episode = Pregnancy(
                cow_id=report.cow_id,
                breeding_id=breeding.breeding_id if breeding else report.breeding_id,
                sire_registry_id=breeding.sire_registry_id if breeding else None,
                status="calved",
                confirmed_date=report.report_date,
                expected_calving_date=report.expected_calving_date,
                ended_at=calving_dt,
                next_breeding_eligible_date=calving_dt + timedelta(days=VWP_DAYS_AFTER_CALVING),
                notes=report.notes,
                created_by=user_id,
                updated_by=user_id,
            )
            session.add(episode)
            await session.flush()
        else:
            episode.status = "calved"
            episode.ended_at = calving_dt
            episode.next_breeding_eligible_date = calving_dt + timedelta(days=VWP_DAYS_AFTER_CALVING)
            episode.updated_by = user_id

        report.episode_id = episode.pregnancy_id
        if breeding is not None:
            breeding.outcome = "successful"
            breeding.conception_date = breeding.conception_date or breeding.seed_date
            breeding.updated_by = user_id
            await fail_prior_open_breedings(
                session,
                cow_id=report.cow_id,
                before_date=breeding.seed_date,
                exclude_breeding_id=breeding.breeding_id,
                user_id=user_id,
            )
        return episode

    return episode


async def record_calving_for_pregnancy(
    session: AsyncSession,
    pregnancy: Pregnancy,
    data: CalvingRequest,
    user_id: Optional[uuid.UUID],
) -> CalvingEvent:
    """Atomically create CalvingEvent, update Pregnancy + Breeding, and register 0..N calves."""
    existing = (
        await session.execute(
            select(CalvingEvent).where(CalvingEvent.pregnancy_id == pregnancy.pregnancy_id)
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Calving has already been recorded for this pregnancy.")

    breeding: Optional[BreedingRecord] = None
    if pregnancy.breeding_id:
        breeding = await session.get(BreedingRecord, pregnancy.breeding_id)
        if breeding:
            breeding.outcome = "successful"
            breeding.conception_date = breeding.conception_date or breeding.seed_date
            breeding.updated_by = user_id
            await fail_prior_open_breedings(
                session,
                cow_id=pregnancy.cow_id,
                before_date=breeding.seed_date,
                exclude_breeding_id=breeding.breeding_id,
                user_id=user_id,
            )

    calving = CalvingEvent(
        pregnancy_id=pregnancy.pregnancy_id,
        dam_id=pregnancy.cow_id,
        calving_date=data.calving_date,
        calving_ease=data.calving_ease,
        live_count=data.live_count,
        stillborn_count=data.stillborn_count,
        notes=data.notes,
        created_by=user_id,
        updated_by=user_id,
    )
    session.add(calving)
    await session.flush()

    pregnancy.status = "calved"
    pregnancy.ended_at = data.calving_date
    pregnancy.next_breeding_eligible_date = data.calving_date + timedelta(days=VWP_DAYS_AFTER_CALVING)
    pregnancy.updated_by = user_id

    # Mark any open checks linked to this pregnancy as calved
    open_checks = (
        await session.execute(
            select(PregnancyReport).where(
                PregnancyReport.episode_id == pregnancy.pregnancy_id,
                PregnancyReport.is_archived == False,
                PregnancyReport.status.in_(["confirmed", "suspected"]),
            )
        )
    ).scalars().all()
    for chk in open_checks:
        chk.status = "calved"
        chk.actual_calving_date = data.calving_date
        chk.updated_by = user_id

    # Create newborn cow profiles atomically
    sire_cow_id = breeding.sire_id if breeding else None
    sire_reg_id = pregnancy.sire_registry_id or (breeding.sire_registry_id if breeding else None)
    if sire_reg_id and not sire_cow_id:
        sire_entry = await session.get(Sire, sire_reg_id)
        if sire_entry and sire_entry.source_type == "on_farm":
            sire_cow_id = sire_entry.cow_id

    for calf in data.calves:
        clean_tag = calf.current_tag_number.strip()
        dup = (
            await session.execute(
                select(Cow).where(Cow.current_tag_number == clean_tag, Cow.status != "archived")
            )
        ).scalar_one_or_none()
        if dup:
            raise HTTPException(
                status_code=400,
                detail=f"An active cow with tag '{clean_tag}' already exists.",
            )
        wh = await session.get(Warehouse, calf.warehouse_id)
        if not wh:
            raise HTTPException(status_code=404, detail="Selected calf shed not found.")

        calf_type = calf.cow_type or ("Heifer Calf" if calf.sex == "female" else "Bull Calf")
        new_calf = Cow(
            current_tag_number=clean_tag,
            sex=calf.sex,
            category=calf.category,
            cow_type=calf_type,
            breed=calf.breed,
            color=calf.color,
            marking=calf.marking,
            birth_date=data.calving_date,
            acquisition_type="born_on_farm",
            acquisition_date=data.calving_date,
            purchase_price=Decimal("0"),
            dam_id=pregnancy.cow_id,
            sire_id=sire_cow_id,
            sire_registry_id=sire_reg_id,
            origin_calving_id=calving.calving_id,
            birth_weight_kg=calf.birth_weight_kg,
            warehouse_id=calf.warehouse_id,
            status="active",
            gives_milk=False,
            milking_sessions=[],
            notes=calf.notes,
            created_by=user_id,
            updated_by=user_id,
        )
        session.add(new_calf)
        await session.flush()

        session.add(
            CowWarehouseHistory(
                cow_id=new_calf.cow_id,
                warehouse_id=calf.warehouse_id,
                moved_in_date=data.calving_date,
                reason="Born on farm (calving)",
                created_by=user_id,
                updated_by=user_id,
            )
        )
        if calf.birth_weight_kg is not None:
            session.add(
                WeightRecord(
                    cow_id=new_calf.cow_id,
                    weigh_date=data.calving_date,
                    weight_kg=calf.birth_weight_kg,
                    created_by=user_id,
                    updated_by=user_id,
                )
            )

    return calving
