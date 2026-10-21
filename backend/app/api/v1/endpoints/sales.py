from datetime import date
from decimal import Decimal
from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.core.database import get_db
from app.core.security import AuthUser, UserRole, get_current_user, require_roles
from app.models.herd import Cow
from app.models.sales import Customer, MilkProduction, MilkProductionBatch, SalePayment, SalesInvoice, SalesInvoiceLine
from app.schemas.sales import (
    CustomerCreate,
    CustomerRead,
    CustomerUpdate,
    MilkCowScheduleItem,
    MilkCowSchedulesUpdate,
    MilkProductionBatchCreate,
    MilkProductionBatchRead,
    MilkProductionCreate,
    MilkProductionRead,
    MilkProductionUpdate,
    SalePaymentCreate,
    SalePaymentRead,
    SalePaymentVoid,
    SalesInvoiceCreate,
    SalesInvoiceLineRead,
    SalesInvoiceRead,
    SalesInvoiceStatusUpdate,
)
from app.services.invoice_service import (
    add_invoice_payment,
    create_sales_invoice,
    update_invoice_status,
    void_invoice_payment,
)
from app.services.safe_data_operations import capture_lifecycle_state, record_lifecycle_changes

router = APIRouter()


# ---------------------- CUSTOMERS ----------------------
@router.get("/customers", response_model=List[CustomerRead])
async def list_customers(
    include_archived: bool = False,
    archived_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    inv_sub = (
        select(
            SalesInvoice.customer_id,
            func.coalesce(func.sum(SalesInvoice.total_amount), 0).label("total_inv"),
            func.coalesce(func.sum(SalesInvoice.paid_amount), 0).label("total_paid"),
        )
        .where(SalesInvoice.status != "void")
        .group_by(SalesInvoice.customer_id)
        .subquery()
    )
    stmt = (
        select(
            Customer,
            func.coalesce(inv_sub.c.total_inv, 0).label("total_inv"),
            func.coalesce(inv_sub.c.total_paid, 0).label("total_paid"),
        )
        .outerjoin(inv_sub, Customer.customer_id == inv_sub.c.customer_id)
    )
    if archived_only:
        stmt = stmt.where(Customer.is_archived == True)
    elif not include_archived:
        stmt = stmt.where(Customer.is_archived == False)
    rows = (await db.execute(stmt)).all()

    res = []
    for c, total_inv, total_paid in rows:
        total_inv_dec = Decimal(str(total_inv))
        total_paid_dec = Decimal(str(total_paid))
        balance = total_inv_dec - total_paid_dec

        r = CustomerRead.model_validate(c)
        r.total_invoiced = total_inv_dec
        r.total_paid = total_paid_dec
        r.current_balance = balance
        res.append(r)
    return res


@router.post("/customers", response_model=CustomerRead, status_code=status.HTTP_201_CREATED)
async def create_customer(
    data: CustomerCreate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.DATA_ENTRY])),
):
    customer = Customer(
        name=data.name,
        phone=data.phone,
        customer_type=data.customer_type,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(customer)
    await db.commit()
    await db.refresh(customer)
    r = CustomerRead.model_validate(customer)
    r.total_invoiced = Decimal("0.00")
    r.total_paid = Decimal("0.00")
    r.current_balance = Decimal("0.00")
    return r


@router.patch("/customers/{customer_id}", response_model=CustomerRead)
async def update_customer(
    customer_id: uuid.UUID,
    data: CustomerUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER])),
):
    customer = await db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    lifecycle_before = capture_lifecycle_state(customer)
    update_dict = data.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        setattr(customer, field, val)
    record_lifecycle_changes(db, customer, lifecycle_before, current_user.id, current_user.email)
    customer.updated_by = current_user.id

    await db.commit()
    await db.refresh(customer)
    return CustomerRead.model_validate(customer)


# ---------------------- MILK PRODUCTION ----------------------
@router.put("/milk/cow-schedules", response_model=List[MilkCowScheduleItem])
async def save_milk_cow_schedules(
    data: MilkCowSchedulesUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.DATA_ENTRY])),
):
    cow_ids = [item.cow_id for item in data.records]
    cows = (await db.execute(select(Cow).where(Cow.cow_id.in_(cow_ids)))).scalars().all() if cow_ids else []
    cow_by_id = {cow.cow_id: cow for cow in cows}
    missing = [str(cow_id) for cow_id in cow_ids if cow_id not in cow_by_id]
    if missing:
        raise HTTPException(status_code=404, detail=f"Cow(s) not found: {', '.join(missing)}")

    for item in data.records:
        cow = cow_by_id[item.cow_id]
        cow.gives_milk = item.gives_milk
        cow.milking_sessions = list(item.milking_sessions)
        cow.updated_by = current_user.id

    await db.commit()
    return data.records


@router.get("/milk/batches", response_model=List[MilkProductionBatchRead])
async def list_milk_production_batches(
    production_date: Optional[date] = None,
    session: Optional[str] = Query(default=None, pattern="^(morning|noon|evening)$"),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    batch_stmt = select(MilkProductionBatch)
    legacy_stmt = select(MilkProduction).where(
        MilkProduction.batch_id.is_(None),
        MilkProduction.is_archived == False,
        MilkProduction.is_void == False,
    )
    if production_date:
        batch_stmt = batch_stmt.where(MilkProductionBatch.production_date == production_date)
        legacy_stmt = legacy_stmt.where(MilkProduction.production_date == production_date)
    if start_date:
        batch_stmt = batch_stmt.where(MilkProductionBatch.production_date >= start_date)
        legacy_stmt = legacy_stmt.where(MilkProduction.production_date >= start_date)
    if end_date:
        batch_stmt = batch_stmt.where(MilkProductionBatch.production_date <= end_date)
        legacy_stmt = legacy_stmt.where(MilkProduction.production_date <= end_date)
    if session:
        batch_stmt = batch_stmt.where(MilkProductionBatch.session == session)
        legacy_stmt = legacy_stmt.where(MilkProduction.session == session)

    batches = (await db.execute(batch_stmt.order_by(MilkProductionBatch.production_date.desc()))).scalars().all()
    rows_by_batch: dict[uuid.UUID, list[MilkProduction]] = {}
    if batches:
        batch_rows = (await db.execute(
            select(MilkProduction).where(
                MilkProduction.batch_id.in_([batch.batch_id for batch in batches]),
                MilkProduction.is_archived == False,
                MilkProduction.is_void == False,
            )
        )).scalars().all()
        for row in batch_rows:
            rows_by_batch.setdefault(row.batch_id, []).append(row)

    # Keep older per-cow records visible as session totals until a session is first saved
    # through the new batch recorder.
    legacy_groups: dict[tuple[date, str], tuple[Decimal, list[uuid.UUID]]] = {}
    legacy_rows = (await db.execute(legacy_stmt.order_by(MilkProduction.production_date.desc()))).scalars().all()
    for row in legacy_rows:
        key = (row.production_date, row.session)
        total, cow_ids = legacy_groups.get(key, (Decimal("0.00"), []))
        legacy_groups[key] = (total + row.liters, [*cow_ids, row.cow_id])

    result = []
    for batch in batches:
        legacy_total, legacy_cow_ids = legacy_groups.pop(
            (batch.production_date, batch.session),
            (Decimal("0.00"), []),
        )
        batch_cow_ids = [row.cow_id for row in rows_by_batch.get(batch.batch_id, [])]
        cow_ids = list(dict.fromkeys([*batch_cow_ids, *legacy_cow_ids]))
        result.append(
            MilkProductionBatchRead(
                batch_id=batch.batch_id,
                production_date=batch.production_date,
                session=batch.session,
                total_liters=batch.total_liters + legacy_total,
                cow_ids=cow_ids,
                cow_count=len(cow_ids),
            )
        )

    result.extend(
        MilkProductionBatchRead(
            batch_id=None,
            production_date=record_date,
            session=record_session,
            total_liters=total_liters,
            cow_ids=list(dict.fromkeys(cow_ids)),
            cow_count=len(set(cow_ids)),
        )
        for (record_date, record_session), (total_liters, cow_ids) in legacy_groups.items()
    )
    result.sort(key=lambda batch: (batch.production_date, {"morning": 0, "noon": 1, "evening": 2}[batch.session]), reverse=True)
    return result


@router.post("/milk/batches", response_model=MilkProductionBatchRead)
async def save_milk_production_batch(
    data: MilkProductionBatchCreate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.DATA_ENTRY])),
):
    selected_cows = (await db.execute(select(Cow).where(Cow.cow_id.in_(data.cow_ids)))).scalars().all() if data.cow_ids else []
    cow_by_id = {cow.cow_id: cow for cow in selected_cows}
    if len(cow_by_id) != len(data.cow_ids):
        raise HTTPException(status_code=404, detail="One or more selected cows were not found.")
    unavailable = [
        cow.current_tag_number
        for cow in selected_cows
        if cow.is_archived or cow.status != "active" or not cow.gives_milk or data.session not in (cow.milking_sessions or [])
    ]
    if unavailable:
        raise HTTPException(
            status_code=400,
            detail=f"These cows are not scheduled for the {data.session} session: {', '.join(unavailable)}",
        )

    batch = (await db.execute(select(MilkProductionBatch).where(
        MilkProductionBatch.production_date == data.production_date,
        MilkProductionBatch.session == data.session,
    ))).scalar_one_or_none()
    if batch is None:
        batch = MilkProductionBatch(
            production_date=data.production_date,
            session=data.session,
            total_liters=data.total_liters,
            created_by=current_user.id,
            updated_by=current_user.id,
        )
        db.add(batch)
        await db.flush()
    else:
        batch.total_liters = data.total_liters
        batch.updated_by = current_user.id

    record_stmt = select(MilkProduction).where(
        MilkProduction.production_date == data.production_date,
        MilkProduction.session == data.session,
        MilkProduction.is_archived == False,
        (MilkProduction.batch_id == batch.batch_id) | MilkProduction.batch_id.is_(None),
    )
    existing_records = (await db.execute(record_stmt.order_by(MilkProduction.created_at.asc()))).scalars().all()
    available_by_cow: dict[uuid.UUID, MilkProduction] = {}
    for record in existing_records:
        if not record.is_archived:
            # Prefer an existing active row when older history has duplicate cow/session rows.
            previous = available_by_cow.get(record.cow_id)
            if previous is None or (previous.is_void and not record.is_void):
                available_by_cow[record.cow_id] = record
        record.batch_id = batch.batch_id

    selected_ids = set(data.cow_ids)
    used_record_ids: set[uuid.UUID] = set()
    total_cents = int(data.total_liters * 100)
    base_cents, extra_cents = divmod(total_cents, len(data.cow_ids)) if data.cow_ids else (0, 0)
    allocations = {
        cow_id: Decimal(base_cents + (1 if index < extra_cents else 0)) / Decimal("100")
        for index, cow_id in enumerate(data.cow_ids)
    }

    for cow_id, liters in allocations.items():
        record = available_by_cow.get(cow_id)
        if record is None:
            record = MilkProduction(
                cow_id=cow_id,
                batch_id=batch.batch_id,
                production_date=data.production_date,
                session=data.session,
                liters=liters,
                created_by=current_user.id,
                updated_by=current_user.id,
            )
            db.add(record)
            continue

        used_record_ids.add(record.milk_id)
        before = capture_lifecycle_state(record)
        record.liters = liters
        record.production_date = data.production_date
        record.session = data.session
        record.is_void = False
        record.void_reason = None
        record.updated_by = current_user.id
        record_lifecycle_changes(db, record, before, current_user.id, current_user.email)

    for record in existing_records:
        if (
            (record.cow_id not in selected_ids or record.milk_id not in used_record_ids)
            and not record.is_archived
            and not record.is_void
        ):
            before = capture_lifecycle_state(record)
            record.is_void = True
            record.void_reason = "Not milked in the saved session batch."
            record.updated_by = current_user.id
            record_lifecycle_changes(db, record, before, current_user.id, current_user.email)

    await db.commit()
    saved_rows = (await db.execute(select(MilkProduction).where(
        MilkProduction.batch_id == batch.batch_id,
        MilkProduction.is_archived == False,
        MilkProduction.is_void == False,
    ))).scalars().all()
    return MilkProductionBatchRead(
        batch_id=batch.batch_id,
        production_date=batch.production_date,
        session=batch.session,
        total_liters=batch.total_liters,
        cow_ids=[row.cow_id for row in saved_rows],
        cow_count=len(saved_rows),
    )


@router.get("/milk", response_model=List[MilkProductionRead])
async def list_milk_production(
    cow_id: Optional[uuid.UUID] = None,
    session_time: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    include_archived: bool = False,
    archived_only: bool = False,
    include_void: bool = False,
    void_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    stmt = (
        select(MilkProduction)
        .options(selectinload(MilkProduction.cow))
        .order_by(MilkProduction.production_date.desc())
    )
    if cow_id:
        stmt = stmt.where(MilkProduction.cow_id == cow_id)
    if session_time:
        stmt = stmt.where(MilkProduction.session == session_time)
    if start_date:
        stmt = stmt.where(MilkProduction.production_date >= start_date)
    if end_date:
        stmt = stmt.where(MilkProduction.production_date <= end_date)
    if archived_only:
        stmt = stmt.where(MilkProduction.is_archived == True)
    elif not include_archived:
        stmt = stmt.where(MilkProduction.is_archived == False)
    if void_only:
        stmt = stmt.where(MilkProduction.is_void == True)
    elif not include_void:
        stmt = stmt.where(MilkProduction.is_void == False)

    records = (await db.execute(stmt)).scalars().all()
    res = []
    for m in records:
        res.append(
            MilkProductionRead(
                milk_id=m.milk_id,
                cow_id=m.cow_id,
                cow_tag_number=m.cow.current_tag_number if m.cow else None,
                production_date=m.production_date,
                session=m.session,
                liters=m.liters,
                is_archived=m.is_archived,
                is_void=m.is_void,
                void_reason=m.void_reason,
                created_at=m.created_at,
                updated_at=m.updated_at,
                created_by=m.created_by,
                updated_by=m.updated_by,
            )
        )
    return res


@router.post("/milk", response_model=MilkProductionRead, status_code=status.HTTP_201_CREATED)
async def record_milk_production(
    data: MilkProductionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.DATA_ENTRY])),
):
    cow = await db.get(Cow, data.cow_id)
    if not cow:
        raise HTTPException(status_code=404, detail="Cow not found")

    record = MilkProduction(
        cow_id=data.cow_id,
        production_date=data.production_date,
        session=data.session,
        liters=data.liters,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    return MilkProductionRead(
        milk_id=record.milk_id,
        cow_id=record.cow_id,
        cow_tag_number=cow.current_tag_number,
        production_date=record.production_date,
        session=record.session,
        liters=record.liters,
        is_archived=record.is_archived,
        is_void=record.is_void,
        void_reason=record.void_reason,
        created_at=record.created_at,
        updated_at=record.updated_at,
        created_by=record.created_by,
        updated_by=record.updated_by,
    )


@router.patch("/milk/{milk_id}", response_model=MilkProductionRead)
async def update_milk_production(
    milk_id: uuid.UUID,
    data: MilkProductionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.DATA_ENTRY])),
):
    record = await db.get(MilkProduction, milk_id)
    if not record:
        raise HTTPException(status_code=404, detail="Milk production record not found")

    lifecycle_before = capture_lifecycle_state(record)
    update_dict = data.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        setattr(record, field, val)
    record_lifecycle_changes(db, record, lifecycle_before, current_user.id, current_user.email)
    record.updated_by = current_user.id

    await db.commit()
    await db.refresh(record)

    cow = await db.get(Cow, record.cow_id)
    return MilkProductionRead(
        milk_id=record.milk_id,
        cow_id=record.cow_id,
        cow_tag_number=cow.current_tag_number if cow else None,
        production_date=record.production_date,
        session=record.session,
        liters=record.liters,
        is_archived=record.is_archived,
        is_void=record.is_void,
        void_reason=record.void_reason,
        created_at=record.created_at,
        updated_at=record.updated_at,
        created_by=record.created_by,
        updated_by=record.updated_by,
    )


# ---------------------- SALES INVOICES ----------------------
def format_invoice_read(inv: SalesInvoice) -> SalesInvoiceRead:
    lines = [
        SalesInvoiceLineRead(
            line_id=line.line_id,
            invoice_id=line.invoice_id,
            item_type=line.item_type,
            cow_id=line.cow_id,
            cow_tag_number=line.cow.current_tag_number if line.cow else None,
            description=line.description,
            quantity=line.quantity,
            unit_price=line.unit_price,
            line_total=line.line_total,
            created_at=line.created_at,
            updated_at=line.updated_at,
            created_by=line.created_by,
            updated_by=line.updated_by,
        )
        for line in inv.lines
    ]

    payments = [
        SalePaymentRead(
            payment_id=p.payment_id,
            invoice_id=p.invoice_id,
            payment_date=p.payment_date,
            amount=p.amount,
            payment_method=p.payment_method,
            reference_number=p.reference_number,
            notes=p.notes,
            status=p.status,
            void_reason=p.void_reason,
            voided_at=p.voided_at,
            voided_by=p.voided_by,
            created_at=p.created_at,
            updated_at=p.updated_at,
            created_by=p.created_by,
            updated_by=p.updated_by,
        )
        for p in inv.payments
    ]

    outstanding = max(Decimal("0.00"), inv.total_amount - inv.paid_amount)

    return SalesInvoiceRead(
        invoice_id=inv.invoice_id,
        invoice_number=inv.invoice_number,
        customer_id=inv.customer_id,
        customer_name=inv.customer.name if inv.customer else None,
        invoice_date=inv.invoice_date,
        due_date=inv.due_date,
        status=inv.status,
        subtotal=inv.subtotal,
        discount=inv.discount,
        total_amount=inv.total_amount,
        paid_amount=inv.paid_amount,
        outstanding_balance=outstanding,
        notes=inv.notes,
        void_reason=inv.void_reason,
        voided_at=inv.voided_at,
        voided_by=inv.voided_by,
        lines=lines,
        payments=payments,
        created_at=inv.created_at,
        updated_at=inv.updated_at,
        created_by=inv.created_by,
        updated_by=inv.updated_by,
    )


@router.get("/invoices", response_model=List[SalesInvoiceRead])
async def list_sales_invoices(
    customer_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    include_void: bool = False,
    void_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    stmt = (
        select(SalesInvoice)
        .options(
            joinedload(SalesInvoice.customer),
            selectinload(SalesInvoice.lines).selectinload(SalesInvoiceLine.cow),
            selectinload(SalesInvoice.payments),
        )
        .order_by(SalesInvoice.invoice_date.desc())
    )
    if customer_id:
        stmt = stmt.where(SalesInvoice.customer_id == customer_id)
    if status:
        stmt = stmt.where(SalesInvoice.status == status)
    if start_date:
        stmt = stmt.where(SalesInvoice.invoice_date >= start_date)
    if end_date:
        stmt = stmt.where(SalesInvoice.invoice_date <= end_date)
    if void_only:
        stmt = stmt.where(SalesInvoice.status == "void")
    elif not include_void:
        stmt = stmt.where(SalesInvoice.status != "void")

    invoices = (await db.execute(stmt)).scalars().unique().all()
    return [format_invoice_read(inv) for inv in invoices]


@router.get("/invoices/{invoice_id}", response_model=SalesInvoiceRead)
async def get_sales_invoice(
    invoice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    stmt = (
        select(SalesInvoice)
        .options(
            joinedload(SalesInvoice.customer),
            selectinload(SalesInvoice.lines).selectinload(SalesInvoiceLine.cow),
            selectinload(SalesInvoice.payments),
        )
        .where(SalesInvoice.invoice_id == invoice_id)
    )
    invoice = (await db.execute(stmt)).scalars().unique().first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return format_invoice_read(invoice)


@router.post("/invoices", response_model=SalesInvoiceRead, status_code=status.HTTP_201_CREATED)
async def create_invoice(
    data: SalesInvoiceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER])),
):
    invoice = await create_sales_invoice(db, data, user_id=current_user.id)
    await db.commit()
    return await get_sales_invoice(invoice.invoice_id, db, current_user)


@router.patch("/invoices/{invoice_id}/status", response_model=SalesInvoiceRead)
async def update_invoice_status_endpoint(
    invoice_id: uuid.UUID,
    data: SalesInvoiceStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER])),
):
    await update_invoice_status(
        db,
        invoice_id,
        data.status,
        void_reason=data.void_reason,
        user_id=current_user.id,
        actor_email=current_user.email,
    )
    await db.commit()
    return await get_sales_invoice(invoice_id, db, current_user)


@router.post("/invoices/{invoice_id}/payments", response_model=SalePaymentRead, status_code=status.HTTP_201_CREATED)
async def record_invoice_payment(
    invoice_id: uuid.UUID,
    payment_data: SalePaymentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER])),
):
    payment = await add_invoice_payment(db, invoice_id, payment_data, user_id=current_user.id)
    await db.commit()
    await db.refresh(payment)
    return SalePaymentRead.model_validate(payment)


@router.patch("/invoices/{invoice_id}/payments/{payment_id}/void", response_model=SalePaymentRead)
async def void_payment_endpoint(
    invoice_id: uuid.UUID,
    payment_id: uuid.UUID,
    data: SalePaymentVoid,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER])),
):
    payment = await void_invoice_payment(
        db,
        invoice_id,
        payment_id,
        data.void_reason,
        user_id=current_user.id,
        actor_email=current_user.email,
    )
    await db.commit()
    await db.refresh(payment)
    return SalePaymentRead.model_validate(payment)
