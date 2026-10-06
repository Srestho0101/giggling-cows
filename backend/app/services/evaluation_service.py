from decimal import Decimal, ROUND_HALF_UP
import uuid
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.evaluation import MarketPrice, PurchaseEvaluation
from app.models.herd import Cow, CowIDHistory, CowWarehouseHistory
from app.schemas.evaluation import ConvertEvaluationToCow, EvaluationCalculationRequest, EvaluationCalculationResult, PurchaseEvaluationCreate


def calculate_evaluation_metrics(
    live_weight_kg: Decimal,
    growth_potential: str,
    offered_price: Decimal,
    market_price_per_kg: Decimal,
    custom_net_weight_percent: Optional[Decimal] = None,
) -> EvaluationCalculationResult:
    if custom_net_weight_percent is not None:
        net_weight_percent = custom_net_weight_percent
    else:
        # ER diagram rule: good -> 60-62% (mid: 61%), poor -> 54-55% (mid: 54.5%)
        if growth_potential == "good":
            net_weight_percent = Decimal("61.00")
        else:
            net_weight_percent = Decimal("54.50")

    est_net_weight_kg = (live_weight_kg * net_weight_percent / Decimal("100.00")).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    if est_net_weight_kg <= Decimal("0.00"):
        est_net_weight_kg = Decimal("0.01")

    net_price_per_kg = (offered_price / est_net_weight_kg).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    is_profitable = net_price_per_kg < market_price_per_kg
    diff_per_kg = (market_price_per_kg - net_price_per_kg).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    total_margin = (diff_per_kg * est_net_weight_kg).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    return EvaluationCalculationResult(
        live_weight_kg=live_weight_kg,
        growth_potential=growth_potential,
        net_weight_percent=net_weight_percent,
        est_net_weight_kg=est_net_weight_kg,
        offered_price=offered_price,
        net_price_per_kg=net_price_per_kg,
        market_price_per_kg=market_price_per_kg,
        is_profitable=is_profitable,
        price_difference_per_kg=diff_per_kg,
        total_projected_margin=total_margin,
    )


async def create_purchase_evaluation(
    session: AsyncSession,
    data: PurchaseEvaluationCreate,
    user_id: Optional[uuid.UUID] = None,
) -> PurchaseEvaluation:
    # Resolve market price
    market_price_val = data.market_price_per_kg
    market_price_id = data.market_price_id

    if market_price_val is None:
        if market_price_id is not None:
            mp = await session.get(MarketPrice, market_price_id)
            if not mp:
                raise HTTPException(status_code=404, detail="Specified market price not found")
            market_price_val = mp.price_per_kg_net
        else:
            # Fetch latest market price
            stmt = select(MarketPrice).order_by(MarketPrice.price_date.desc()).limit(1)
            latest = (await session.execute(stmt)).scalar_one_or_none()
            if not latest:
                raise HTTPException(
                    status_code=400,
                    detail="No market price configured. Please enter a market price per kg.",
                )
            market_price_id = latest.market_price_id
            market_price_val = latest.price_per_kg_net

    calc = calculate_evaluation_metrics(
        live_weight_kg=data.live_weight_kg,
        growth_potential=data.growth_potential,
        offered_price=data.offered_price,
        market_price_per_kg=market_price_val,
        custom_net_weight_percent=data.custom_net_weight_percent,
    )

    evaluation = PurchaseEvaluation(
        evaluation_date=data.evaluation_date,
        supplier_id=data.supplier_id,
        live_weight_kg=calc.live_weight_kg,
        growth_potential=calc.growth_potential,
        net_weight_percent=calc.net_weight_percent,
        est_net_weight_kg=calc.est_net_weight_kg,
        offered_price=calc.offered_price,
        net_price_per_kg=calc.net_price_per_kg,
        market_price_id=market_price_id,
        market_price_per_kg=market_price_val,
        is_profitable=calc.is_profitable,
        decision=data.decision,
        notes=data.notes,
        created_by=user_id,
        updated_by=user_id,
    )
    session.add(evaluation)
    await session.flush()
    return evaluation


async def convert_evaluation_to_cow(
    session: AsyncSession,
    evaluation_id: uuid.UUID,
    cow_data: ConvertEvaluationToCow,
    user_id: Optional[uuid.UUID] = None,
) -> Cow:
    evaluation = await session.get(PurchaseEvaluation, evaluation_id)
    if not evaluation:
        raise HTTPException(status_code=404, detail="Purchase evaluation not found")

    if evaluation.decision == "returned":
        raise HTTPException(
            status_code=400,
            detail="Cannot convert a returned purchase evaluation to a cow. Returned evaluations are final.",
        )

    if evaluation.cow_id is not None:
        raise HTTPException(
            status_code=400,
            detail="This evaluation has already been converted to a cow.",
        )

    # Check active tag uniqueness
    tag_stmt = select(Cow).where(
        Cow.current_tag_number == cow_data.tag_number,
        Cow.status != "archived",
    )
    existing_tag = (await session.execute(tag_stmt)).scalar_one_or_none()
    if existing_tag:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An active cow with tag number '{cow_data.tag_number}' already exists.",
        )

    acquisition_type = "bought_from_supplier" if evaluation.supplier_id else "bought_from_bazar"

    new_cow = Cow(
        current_tag_number=cow_data.tag_number,
        sex=cow_data.sex,
        category=cow_data.category,
        birth_date=cow_data.birth_date,
        acquisition_type=acquisition_type,
        acquisition_date=evaluation.evaluation_date,
        purchase_price=evaluation.offered_price,
        supplier_id=evaluation.supplier_id,
        dam_id=None,
        sire_id=None,
        warehouse_id=cow_data.warehouse_id,
        status="active",
        notes=cow_data.notes or evaluation.notes,
        created_by=user_id,
        updated_by=user_id,
    )
    session.add(new_cow)
    await session.flush()

    # Create initial tag history
    tag_history = CowIDHistory(
        cow_id=new_cow.cow_id,
        tag_number=new_cow.current_tag_number,
        tag_type="ear_tag",
        assigned_date=new_cow.acquisition_date,
        reason="Initial tag on purchase conversion",
        created_by=user_id,
        updated_by=user_id,
    )
    session.add(tag_history)

    # Create initial warehouse movement history
    warehouse_history = CowWarehouseHistory(
        cow_id=new_cow.cow_id,
        warehouse_id=new_cow.warehouse_id,
        moved_in_date=new_cow.acquisition_date,
        reason="Initial warehouse placement upon purchase",
        created_by=user_id,
        updated_by=user_id,
    )
    session.add(warehouse_history)

    # Update evaluation
    evaluation.decision = "bought"
    evaluation.cow_id = new_cow.cow_id
    evaluation.updated_by = user_id
    await session.flush()

    return new_cow
