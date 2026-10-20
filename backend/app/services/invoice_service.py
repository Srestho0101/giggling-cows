from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
import uuid
from typing import Optional
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.herd import Cow
from app.models.sales import Customer, SalePayment, SalesInvoice, SalesInvoiceLine
from app.schemas.sales import SalePaymentCreate, SalesInvoiceCreate
from app.services.safe_data_operations import capture_lifecycle_state, record_lifecycle_changes


async def generate_invoice_number(session: AsyncSession) -> str:
    today_str = datetime.now(timezone.utc).strftime("%Y%m")
    prefix = f"INV-{today_str}-"
    stmt = (
        select(SalesInvoice.invoice_number)
        .where(SalesInvoice.invoice_number.like(f"{prefix}%"))
        .order_by(SalesInvoice.invoice_number.desc())
        .limit(1)
    )
    latest = (await session.execute(stmt)).scalar_one_or_none()
    if latest:
        try:
            seq = int(latest.split("-")[-1]) + 1
        except ValueError:
            seq = 1
    else:
        seq = 1
    return f"{prefix}{seq:04d}"


async def create_sales_invoice(
    session: AsyncSession,
    data: SalesInvoiceCreate,
    user_id: Optional[uuid.UUID] = None,
) -> SalesInvoice:
    customer = await session.get(Customer, data.customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    invoice_number = await generate_invoice_number(session)
    subtotal = Decimal("0.00")

    # Validate lines and animals
    lines_to_add = []
    for item in data.lines:
        line_total = (item.quantity * item.unit_price).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        subtotal += line_total

        if item.item_type == "animal":
            if not item.cow_id:
                raise HTTPException(
                    status_code=400,
                    detail="Animal sale line must specify a valid cow_id.",
                )
            cow = await session.get(Cow, item.cow_id)
            if not cow:
                raise HTTPException(
                    status_code=404,
                    detail=f"Cow with ID {item.cow_id} not found.",
                )
            if cow.status != "active":
                raise HTTPException(
                    status_code=400,
                    detail=f"Cow {cow.current_tag_number} is not active (current status: {cow.status}) and cannot be sold.",
                )

        lines_to_add.append(
            SalesInvoiceLine(
                item_type=item.item_type,
                cow_id=item.cow_id,
                description=item.description,
                quantity=item.quantity,
                unit_price=item.unit_price,
                line_total=line_total,
                created_by=user_id,
                updated_by=user_id,
            )
        )

    discount = data.discount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if discount > subtotal:
        raise HTTPException(status_code=400, detail="Discount cannot exceed invoice subtotal.")

    total_amount = subtotal - discount

    invoice = SalesInvoice(
        invoice_number=invoice_number,
        customer_id=data.customer_id,
        invoice_date=data.invoice_date,
        due_date=data.due_date,
        status="draft",
        subtotal=subtotal,
        discount=discount,
        total_amount=total_amount,
        paid_amount=Decimal("0.00"),
        notes=data.notes,
        lines=lines_to_add,
        created_by=user_id,
        updated_by=user_id,
    )
    session.add(invoice)
    await session.flush()
    return invoice


async def update_invoice_status(
    session: AsyncSession,
    invoice_id: uuid.UUID,
    new_status: str,
    void_reason: Optional[str] = None,
    user_id: Optional[uuid.UUID] = None,
    actor_email: Optional[str] = None,
) -> SalesInvoice:
    stmt = (
        select(SalesInvoice)
        .options(selectinload(SalesInvoice.lines))
        .where(SalesInvoice.invoice_id == invoice_id)
        .execution_options(populate_existing=True)
    )
    invoice = (await session.execute(stmt)).scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    lifecycle_before = capture_lifecycle_state(invoice)

    if invoice.status == new_status:
        return invoice

    # Transition to ISSUED
    if new_status == "issued":
        if invoice.status not in ["draft", "void"]:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot transition to 'issued' from '{invoice.status}'",
            )
        # Update any cow to 'sold'
        for line in invoice.lines:
            if line.item_type == "animal" and line.cow_id:
                cow = await session.get(Cow, line.cow_id)
                if cow:
                    cow.status = "sold"
                    cow.updated_by = user_id

        invoice.status = "issued"
        invoice.updated_by = user_id

    # Transition to VOID
    elif new_status == "void":
        if not (void_reason or "").strip():
            raise HTTPException(status_code=422, detail="A reason is required when voiding an invoice.")
        if invoice.paid_amount > Decimal("0.00"):
            raise HTTPException(
                status_code=400,
                detail="Cannot void an invoice that has payments recorded. Reverse payments first.",
            )
        # Revert sold cows back to active
        for line in invoice.lines:
            if line.item_type == "animal" and line.cow_id:
                cow = await session.get(Cow, line.cow_id)
                if cow and cow.status == "sold":
                    cow.status = "active"
                    cow.updated_by = user_id

        invoice.status = "void"
        invoice.void_reason = void_reason.strip()
        invoice.updated_by = user_id

    record_lifecycle_changes(session, invoice, lifecycle_before, user_id, actor_email)
    await session.flush()
    return invoice


async def add_invoice_payment(
    session: AsyncSession,
    invoice_id: uuid.UUID,
    payment_data: SalePaymentCreate,
    user_id: Optional[uuid.UUID] = None,
) -> SalePayment:
    invoice = await session.get(SalesInvoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice.status in ["draft", "void"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot record payments against an invoice with status '{invoice.status}'. Issue the invoice first.",
        )

    remaining_due = invoice.total_amount - invoice.paid_amount
    if payment_data.amount > remaining_due:
        raise HTTPException(
            status_code=400,
            detail=f"Payment amount ({payment_data.amount}) exceeds outstanding invoice balance ({remaining_due}).",
        )

    payment = SalePayment(
        invoice_id=invoice_id,
        payment_date=payment_data.payment_date,
        amount=payment_data.amount,
        payment_method=payment_data.payment_method,
        reference_number=payment_data.reference_number,
        notes=payment_data.notes,
        created_by=user_id,
        updated_by=user_id,
    )
    session.add(payment)

    invoice.paid_amount += payment_data.amount
    if invoice.paid_amount >= invoice.total_amount:
        invoice.status = "paid"
    else:
        invoice.status = "partially_paid"
    invoice.updated_by = user_id

    await session.flush()
    return payment


async def void_invoice_payment(
    session: AsyncSession,
    invoice_id: uuid.UUID,
    payment_id: uuid.UUID,
    void_reason: str,
    user_id: Optional[uuid.UUID] = None,
    actor_email: Optional[str] = None,
) -> SalePayment:
    payment = await session.get(SalePayment, payment_id)
    if not payment or payment.invoice_id != invoice_id:
        raise HTTPException(status_code=404, detail="Payment not found for this invoice")

    if payment.status == "void":
        raise HTTPException(status_code=400, detail="Payment is already voided")

    lifecycle_before = capture_lifecycle_state(payment)

    invoice = await session.get(SalesInvoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    payment.status = "void"
    payment.void_reason = void_reason
    payment.updated_by = user_id
    record_lifecycle_changes(session, payment, lifecycle_before, user_id, actor_email)

    invoice.paid_amount = max(Decimal("0.00"), invoice.paid_amount - payment.amount)
    if invoice.paid_amount == Decimal("0.00"):
        invoice.status = "issued"
    elif invoice.paid_amount < invoice.total_amount:
        invoice.status = "partially_paid"
    else:
        invoice.status = "paid"
    invoice.updated_by = user_id

    await session.flush()
    return payment
