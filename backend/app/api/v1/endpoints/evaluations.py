from datetime import date
from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import AuthUser, UserRole, get_current_user, require_roles
from app.models.evaluation import MarketPrice, PurchaseEvaluation
from app.schemas.herd import CowDetailRead
from app.schemas.evaluation import (
    ConvertEvaluationToCow,
    EvaluationCalculationRequest,
    EvaluationCalculationResult,
    MarketPriceCreate,
    MarketPriceRead,
    MarketPriceUpdate,
    PurchaseEvaluationCreate,
    PurchaseEvaluationRead,
    PurchaseEvaluationUpdate,
)
from app.services.evaluation_service import (
    calculate_evaluation_metrics,
    convert_evaluation_to_cow,
    create_purchase_evaluation,
)
from app.services.safe_data_operations import capture_lifecycle_state, record_lifecycle_changes

router = APIRouter()


# ---------------------- MARKET PRICES ----------------------
@router.get("/market-prices", response_model=List[MarketPriceRead])
async def list_market_prices(
    include_archived: bool = False,
    archived_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    stmt = select(MarketPrice).order_by(MarketPrice.price_date.desc())
    if archived_only:
        stmt = stmt.where(MarketPrice.is_archived == True)
    elif not include_archived:
        stmt = stmt.where(MarketPrice.is_archived == False)
    return (await db.execute(stmt)).scalars().all()


@router.post("/market-prices", response_model=MarketPriceRead, status_code=status.HTTP_201_CREATED)
async def create_market_price(
    data: MarketPriceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER])),
):
    mp = MarketPrice(
        price_date=data.price_date,
        price_per_kg_net=data.price_per_kg_net,
        source=data.source,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(mp)
    await db.commit()
    await db.refresh(mp)
    return mp


@router.patch("/market-prices/{market_price_id}", response_model=MarketPriceRead)
async def update_market_price(
    market_price_id: uuid.UUID,
    data: MarketPriceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER])),
):
    mp = await db.get(MarketPrice, market_price_id)
    if not mp:
        raise HTTPException(status_code=404, detail="Market price not found")

    lifecycle_before = capture_lifecycle_state(mp)
    update_dict = data.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        setattr(mp, field, val)
    record_lifecycle_changes(db, mp, lifecycle_before, current_user.id, current_user.email)
    mp.updated_by = current_user.id

    await db.commit()
    await db.refresh(mp)
    return mp


# ---------------------- CALCULATION PREVIEW ----------------------
@router.post("/calculate-preview", response_model=EvaluationCalculationResult)
async def preview_evaluation_calculation(
    data: EvaluationCalculationRequest,
    current_user: AuthUser = Depends(get_current_user),
):
    return calculate_evaluation_metrics(
        live_weight_kg=data.live_weight_kg,
        growth_potential=data.growth_potential,
        offered_price=data.offered_price,
        market_price_per_kg=data.market_price_per_kg,
        custom_net_weight_percent=data.custom_net_weight_percent,
    )


# ---------------------- PURCHASE EVALUATIONS ----------------------
@router.get("", response_model=List[PurchaseEvaluationRead])
async def list_purchase_evaluations(
    decision: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    include_archived: bool = False,
    archived_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    stmt = (
        select(PurchaseEvaluation)
        .options(
            selectinload(PurchaseEvaluation.supplier),
            selectinload(PurchaseEvaluation.cow),
        )
        .order_by(PurchaseEvaluation.evaluation_date.desc())
    )
    if decision:
        stmt = stmt.where(PurchaseEvaluation.decision == decision)
    if start_date:
        stmt = stmt.where(PurchaseEvaluation.evaluation_date >= start_date)
    if end_date:
        stmt = stmt.where(PurchaseEvaluation.evaluation_date <= end_date)
    if archived_only:
        stmt = stmt.where(PurchaseEvaluation.is_archived == True)
    elif not include_archived:
        stmt = stmt.where(PurchaseEvaluation.is_archived == False)

    evaluations = (await db.execute(stmt)).scalars().all()
    results = []
    for ev in evaluations:
        read_obj = PurchaseEvaluationRead(
            evaluation_id=ev.evaluation_id,
            evaluation_date=ev.evaluation_date,
            supplier_id=ev.supplier_id,
            supplier_name=ev.supplier.name if ev.supplier else None,
            live_weight_kg=ev.live_weight_kg,
            growth_potential=ev.growth_potential,
            net_weight_percent=ev.net_weight_percent,
            est_net_weight_kg=ev.est_net_weight_kg,
            offered_price=ev.offered_price,
            net_price_per_kg=ev.net_price_per_kg,
            market_price_id=ev.market_price_id,
            market_price_per_kg=ev.market_price_per_kg,
            is_profitable=ev.is_profitable,
            decision=ev.decision,
            cow_id=ev.cow_id,
            cow_tag_number=ev.cow.current_tag_number if ev.cow else None,
            notes=ev.notes,
            is_archived=ev.is_archived,
            created_at=ev.created_at,
            updated_at=ev.updated_at,
            created_by=ev.created_by,
            updated_by=ev.updated_by,
        )
        results.append(read_obj)
    return results


@router.post("", response_model=PurchaseEvaluationRead, status_code=status.HTTP_201_CREATED)
async def add_purchase_evaluation(
    data: PurchaseEvaluationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.DATA_ENTRY])),
):
    ev = await create_purchase_evaluation(db, data, user_id=current_user.id)
    await db.commit()
    await db.refresh(ev)
    return PurchaseEvaluationRead(
        evaluation_id=ev.evaluation_id,
        evaluation_date=ev.evaluation_date,
        supplier_id=ev.supplier_id,
        supplier_name=None,
        live_weight_kg=ev.live_weight_kg,
        growth_potential=ev.growth_potential,
        net_weight_percent=ev.net_weight_percent,
        est_net_weight_kg=ev.est_net_weight_kg,
        offered_price=ev.offered_price,
        net_price_per_kg=ev.net_price_per_kg,
        market_price_id=ev.market_price_id,
        market_price_per_kg=ev.market_price_per_kg,
        is_profitable=ev.is_profitable,
        decision=ev.decision,
        cow_id=ev.cow_id,
        cow_tag_number=None,
        notes=ev.notes,
        is_archived=ev.is_archived,
        created_at=ev.created_at,
        updated_at=ev.updated_at,
        created_by=ev.created_by,
        updated_by=ev.updated_by,
    )


@router.patch("/{evaluation_id}", response_model=PurchaseEvaluationRead)
async def update_evaluation_decision(
    evaluation_id: uuid.UUID,
    data: PurchaseEvaluationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER])),
):
    ev = await db.get(PurchaseEvaluation, evaluation_id)
    if not ev:
        raise HTTPException(status_code=404, detail="Purchase evaluation not found")

    lifecycle_before = capture_lifecycle_state(ev)
    if ev.decision == "returned" and data.decision and data.decision != "returned":
        raise HTTPException(
            status_code=400,
            detail="Cannot modify a returned purchase evaluation. Returned records are final.",
        )

    if data.decision:
        ev.decision = data.decision
    if data.notes is not None:
        ev.notes = data.notes
    if data.is_archived is not None:
        ev.is_archived = data.is_archived
    record_lifecycle_changes(db, ev, lifecycle_before, current_user.id, current_user.email)
    ev.updated_by = current_user.id

    await db.commit()
    await db.refresh(ev)
    return PurchaseEvaluationRead(
        evaluation_id=ev.evaluation_id,
        evaluation_date=ev.evaluation_date,
        supplier_id=ev.supplier_id,
        supplier_name=None,
        live_weight_kg=ev.live_weight_kg,
        growth_potential=ev.growth_potential,
        net_weight_percent=ev.net_weight_percent,
        est_net_weight_kg=ev.est_net_weight_kg,
        offered_price=ev.offered_price,
        net_price_per_kg=ev.net_price_per_kg,
        market_price_id=ev.market_price_id,
        market_price_per_kg=ev.market_price_per_kg,
        is_profitable=ev.is_profitable,
        decision=ev.decision,
        cow_id=ev.cow_id,
        cow_tag_number=None,
        notes=ev.notes,
        is_archived=ev.is_archived,
        created_at=ev.created_at,
        updated_at=ev.updated_at,
        created_by=ev.created_by,
        updated_by=ev.updated_by,
    )


@router.post("/{evaluation_id}/convert-to-cow", response_model=CowDetailRead, status_code=status.HTTP_201_CREATED)
async def convert_evaluation_to_cow_endpoint(
    evaluation_id: uuid.UUID,
    cow_data: ConvertEvaluationToCow,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.DATA_ENTRY])),
):
    cow = await convert_evaluation_to_cow(db, evaluation_id, cow_data, user_id=current_user.id)
    await db.commit()
    
    # Reload cow detail
    from app.api.v1.endpoints.cows import get_cow_detail
    return await get_cow_detail(cow.cow_id, db, current_user)
