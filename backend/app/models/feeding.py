import uuid
from datetime import date
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import Boolean, Date, ForeignKey, Numeric, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import ArchiveAuditMixin, AuditMixin, Base, VoidAuditMixin


class ExpenseCategory(Base, AuditMixin, ArchiveAuditMixin):
    __tablename__ = "expense_categories"

    category_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    name_bn: Mapped[str] = mapped_column(String(100), nullable=False)
    category_group: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # 'food' | 'miscellaneous'
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    feed_types: Mapped[List["FeedType"]] = relationship("FeedType", back_populates="category")
    expenses: Mapped[List["Expense"]] = relationship("Expense", back_populates="category")


class FeedType(Base, AuditMixin, ArchiveAuditMixin):
    __tablename__ = "feed_types"

    feed_type_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("expense_categories.category_id", ondelete="RESTRICT"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    name_bn: Mapped[str] = mapped_column(String(100), nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False, default="kg")  # kg, bundle, bag, liter
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0.00)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    category: Mapped["ExpenseCategory"] = relationship("ExpenseCategory", back_populates="feed_types")
    feeding_records: Mapped[List["FeedingRecord"]] = relationship("FeedingRecord", back_populates="feed_type")


class FeedingRecord(Base, AuditMixin, ArchiveAuditMixin):
    __tablename__ = "feeding_records"

    feeding_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    feed_type_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("feed_types.feed_type_id", ondelete="RESTRICT"), nullable=False
    )
    cow_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("cows.cow_id", ondelete="RESTRICT"), nullable=True
    )
    feeding_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    feed_type: Mapped["FeedType"] = relationship("FeedType", back_populates="feeding_records")
    cow: Mapped[Optional["Cow"]] = relationship("Cow")


class Expense(Base, AuditMixin, ArchiveAuditMixin, VoidAuditMixin):
    __tablename__ = "expenses"

    expense_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("expense_categories.category_id", ondelete="RESTRICT"), nullable=False
    )
    warehouse_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("warehouses.warehouse_id", ondelete="RESTRICT"), nullable=True
    )
    cow_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("cows.cow_id", ondelete="RESTRICT"), nullable=True
    )
    expense_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_void: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    void_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    category: Mapped["ExpenseCategory"] = relationship("ExpenseCategory", back_populates="expenses")
    warehouse: Mapped[Optional["Warehouse"]] = relationship("Warehouse")
    cow: Mapped[Optional["Cow"]] = relationship("Cow")
