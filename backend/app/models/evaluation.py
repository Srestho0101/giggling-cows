import uuid
from datetime import date
from decimal import Decimal
from typing import Optional
from sqlalchemy import Boolean, Date, ForeignKey, Numeric, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import AuditMixin, Base


class MarketPrice(Base, AuditMixin):
    __tablename__ = "market_prices"

    market_price_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    price_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    price_per_kg_net: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    source: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    evaluations: Mapped[list["PurchaseEvaluation"]] = relationship("PurchaseEvaluation", back_populates="market_price")


class PurchaseEvaluation(Base, AuditMixin):
    __tablename__ = "purchase_evaluations"

    evaluation_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    evaluation_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    supplier_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("suppliers.supplier_id", ondelete="RESTRICT"), nullable=True
    )
    live_weight_kg: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    growth_potential: Mapped[str] = mapped_column(String(20), nullable=False)  # 'good' | 'poor'
    net_weight_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    est_net_weight_kg: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    offered_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    net_price_per_kg: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    
    market_price_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("market_prices.market_price_id", ondelete="RESTRICT"), nullable=True
    )
    market_price_per_kg: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    is_profitable: Mapped[bool] = mapped_column(Boolean, nullable=False)
    decision: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending"
    )  # 'bought' | 'returned' | 'pending'
    
    cow_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("cows.cow_id", ondelete="RESTRICT"), nullable=True
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    supplier: Mapped[Optional["Supplier"]] = relationship("Supplier")
    market_price: Mapped[Optional["MarketPrice"]] = relationship("MarketPrice", back_populates="evaluations")
    cow: Mapped[Optional["Cow"]] = relationship("Cow")
