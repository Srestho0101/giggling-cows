import uuid
from datetime import date
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import Boolean, Date, ForeignKey, Numeric, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import ArchiveAuditMixin, AuditMixin, Base, VoidAuditMixin


class MilkProduction(Base, AuditMixin, ArchiveAuditMixin, VoidAuditMixin):
    __tablename__ = "milk_productions"

    milk_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    cow_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("cows.cow_id", ondelete="RESTRICT"), nullable=False
    )
    production_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    session: Mapped[str] = mapped_column(String(20), nullable=False)  # 'morning' | 'noon' | 'evening'
    liters: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_void: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    void_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    cow: Mapped["Cow"] = relationship("Cow")


class Customer(Base, AuditMixin, ArchiveAuditMixin):
    __tablename__ = "customers"

    customer_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    customer_type: Mapped[str] = mapped_column(
        String(50), nullable=False, default="individual"
    )  # 'individual' | 'dairy_shop' | 'wholesaler' | 'meat_buyer'
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    invoices: Mapped[List["SalesInvoice"]] = relationship("SalesInvoice", back_populates="customer")


class SalesInvoice(Base, AuditMixin, VoidAuditMixin):
    __tablename__ = "sales_invoices"

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    invoice_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("customers.customer_id", ondelete="RESTRICT"), nullable=False
    )
    invoice_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="draft"
    )  # 'draft' | 'issued' | 'partially_paid' | 'paid' | 'void'
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0.00)
    discount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0.00)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0.00)
    paid_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0.00)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    void_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    customer: Mapped["Customer"] = relationship("Customer", back_populates="invoices")
    lines: Mapped[List["SalesInvoiceLine"]] = relationship(
        "SalesInvoiceLine", back_populates="invoice", cascade="save-update, merge"
    )
    payments: Mapped[List["SalePayment"]] = relationship(
        "SalePayment", back_populates="invoice", cascade="save-update, merge"
    )


class SalesInvoiceLine(Base, AuditMixin):
    __tablename__ = "sales_invoice_lines"

    line_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("sales_invoices.invoice_id", ondelete="RESTRICT"), nullable=False
    )
    item_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # 'milk' | 'animal' | 'other'
    cow_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("cows.cow_id", ondelete="RESTRICT"), nullable=True
    )
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=1.00)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0.00)
    line_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0.00)

    # Relationships
    invoice: Mapped["SalesInvoice"] = relationship("SalesInvoice", back_populates="lines")
    cow: Mapped[Optional["Cow"]] = relationship("Cow")


class SalePayment(Base, AuditMixin, VoidAuditMixin):
    __tablename__ = "sale_payments"

    payment_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("sales_invoices.invoice_id", ondelete="RESTRICT"), nullable=False
    )
    payment_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    payment_method: Mapped[str] = mapped_column(
        String(50), nullable=False, default="cash"
    )  # 'cash' | 'bank' | 'bKash' | 'Nagad' | 'other'
    reference_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="paid"
    )  # 'paid' | 'void'
    void_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    invoice: Mapped["SalesInvoice"] = relationship("SalesInvoice", back_populates="payments")
