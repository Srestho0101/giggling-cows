from datetime import date
from decimal import Decimal
from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import AuthUser, UserRole, get_current_user, require_roles
from app.models.herd import Cow
from app.models.sales import Customer, MilkProduction, SalePayment, SalesInvoice, SalesInvoiceLine
from app.schemas.sales import (
    CustomerCreate,
    CustomerRead,
    CustomerUpdate,
    MilkProductionCreate,
    MilkProductionRead,
    SalePaymentCreate,
    SalePaymentRead,
    SalesInvoiceCreate,
    SalesInvoiceLineRead,
    SalesInvoiceRead,
    SalesInvoiceStatusUpdate,
)
from app.services.invoice_service import (
    add_invoice_payment,
    create_sales_invoice,
    update_invoice_status,
)

router = APIRouter()


# ---------------------- CUSTOMERS ----------------------
@router.get("/customers", response_model=List[CustomerRead])
async def list_customers(
    include_archived: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    stmt = select(Customer)
    if not include_archived:
        stmt = stmt.where(Customer.is_archived == False)
    customers = (await db.execute(stmt)).scalars().all()

    res = []
    for c in customers:
        # Sum total invoiced and paid for active/completed invoices
        inv_stmt = select(
            func.coalesce(func.sum(SalesInvoice.total_amount), 0),
            func.coalesce(func.sum(SalesInvoice.paid_amount), 0),
        ).where(
            SalesInvoice.customer_id == c.customer_id,
            SalesInvoice.status != "void",
        )
        total_inv, total_paid = (await db.execute(inv_stmt)).first() or (0, 0)
        total_inv = Decimal(str(total_inv))
        total_paid = Decimal(str(total_paid))
        balance = total_inv - total_paid

        r = CustomerRead.model_validate(c)
        r.total_invoiced = total_inv
        r.total_paid = total_paid
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

    update_dict = data.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        setattr(customer, field, val)
    customer.updated_by = current_user.id

    await db.commit()
    await db.refresh(customer)
    return CustomerRead.model_validate(customer)


@router.delete("/customers/{customer_id}", response_model=CustomerRead)
async def archive_customer(
    customer_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER])),
):
    customer = await db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    customer.is_archived = True
    customer.updated_by = current_user.id

    await db.commit()
    await db.refresh(customer)
    r = CustomerRead.model_validate(customer)
    r.total_invoiced = Decimal("0.00")
    r.total_paid = Decimal("0.00")
    r.current_balance = Decimal("0.00")
    return r


# ---------------------- MILK PRODUCTION ----------------------
@router.get("/milk", response_model=List[MilkProductionRead])
async def list_milk_production(
    cow_id: Optional[uuid.UUID] = None,
    session_time: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
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
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    stmt = (
        select(SalesInvoice)
        .options(
            selectinload(SalesInvoice.customer),
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

    invoices = (await db.execute(stmt)).scalars().all()
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
            selectinload(SalesInvoice.customer),
            selectinload(SalesInvoice.lines).selectinload(SalesInvoiceLine.cow),
            selectinload(SalesInvoice.payments),
        )
        .where(SalesInvoice.invoice_id == invoice_id)
    )
    invoice = (await db.execute(stmt)).scalar_one_or_none()
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
    await update_invoice_status(db, invoice_id, data.status, user_id=current_user.id)
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
