import uuid
from datetime import date
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import Boolean, CheckConstraint, Date, ForeignKey, Index, JSON, Numeric, String, Text, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import ArchiveAuditMixin, AuditMixin, Base


class Warehouse(Base, AuditMixin, ArchiveAuditMixin):
    __tablename__ = "warehouses"

    warehouse_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    housing_type: Mapped[str] = mapped_column(String(50), nullable=False, default="shed")
    capacity: Mapped[int] = mapped_column(nullable=False, default=10)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    cows: Mapped[List["Cow"]] = relationship("Cow", back_populates="warehouse")
    movements: Mapped[List["CowWarehouseHistory"]] = relationship("CowWarehouseHistory", back_populates="warehouse")


class Supplier(Base, AuditMixin, ArchiveAuditMixin):
    __tablename__ = "suppliers"

    supplier_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    supplier_type: Mapped[str] = mapped_column(String(50), nullable=False, default="individual")
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    cows: Mapped[List["Cow"]] = relationship("Cow", back_populates="supplier")


class Cow(Base, AuditMixin, ArchiveAuditMixin):
    __tablename__ = "cows"

    cow_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    current_tag_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    sex: Mapped[str] = mapped_column(String(10), nullable=False)  # 'male' | 'female'
    category: Mapped[str] = mapped_column(String(50), nullable=False)  # dairy, beef, duel-purpose
    cow_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # bull_calf, heifer_calf, bull, cow, heifer, ox
    breed: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)  # deshi | friesian | other
    color: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    marking: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    profile_picture_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    birth_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    acquisition_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # 'born_on_farm' | 'bought_from_supplier' | 'bought_from_bazar'
    acquisition_date: Mapped[date] = mapped_column(Date, nullable=False)
    purchase_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    
    supplier_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("suppliers.supplier_id"), nullable=True
    )
    dam_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("cows.cow_id"), nullable=True
    )
    sire_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("cows.cow_id"), nullable=True
    )
    sire_registry_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("sires.sire_id", ondelete="SET NULL", use_alter=True, name="fk_cows_sire_registry"),
        nullable=True,
    )
    origin_calving_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("calving_events.calving_id", ondelete="SET NULL", use_alter=True, name="fk_cows_origin_calving"),
        nullable=True,
    )
    birth_weight_kg: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2), nullable=True)
    warehouse_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("warehouses.warehouse_id"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="active"
    )  # 'active' | 'sold' | 'deceased' | 'archived'
    gives_milk: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    milking_sessions: Mapped[List[str]] = mapped_column(JSON, nullable=False, default=list, server_default=text("'[]'"))
    sold_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    sale_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    buyer_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    buyer_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    buyer_address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    sale_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    __table_args__ = (
        CheckConstraint(
            "(acquisition_type = 'born_on_farm' AND supplier_id IS NULL) OR "
            "(acquisition_type != 'born_on_farm')",
            name="check_acquisition_integrity",
        ),
        Index("idx_active_cow_tag", "current_tag_number", unique=False),
    )

    # Relationships
    supplier: Mapped[Optional["Supplier"]] = relationship("Supplier", back_populates="cows")
    warehouse: Mapped["Warehouse"] = relationship("Warehouse", back_populates="cows")
    dam: Mapped[Optional["Cow"]] = relationship("Cow", remote_side=[cow_id], foreign_keys=[dam_id])
    sire: Mapped[Optional["Cow"]] = relationship("Cow", remote_side=[cow_id], foreign_keys=[sire_id])
    
    warehouse_history: Mapped[List["CowWarehouseHistory"]] = relationship("CowWarehouseHistory", back_populates="cow", cascade="save-update, merge")
    weight_records: Mapped[List["WeightRecord"]] = relationship("WeightRecord", back_populates="cow", cascade="save-update, merge")


class CowWarehouseHistory(Base, AuditMixin):
    __tablename__ = "cow_warehouse_histories"

    movement_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    cow_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("cows.cow_id", ondelete="RESTRICT"), nullable=False
    )
    warehouse_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("warehouses.warehouse_id"), nullable=False
    )
    moved_in_date: Mapped[date] = mapped_column(Date, nullable=False)
    moved_out_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    # Relationships
    cow: Mapped["Cow"] = relationship("Cow", back_populates="warehouse_history")
    warehouse: Mapped["Warehouse"] = relationship("Warehouse", back_populates="movements")


class WeightRecord(Base, AuditMixin, ArchiveAuditMixin):
    __tablename__ = "weight_records"

    weight_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    cow_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("cows.cow_id", ondelete="RESTRICT"), nullable=False
    )
    weigh_date: Mapped[date] = mapped_column(Date, nullable=False)
    weight_kg: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    cow: Mapped["Cow"] = relationship("Cow", back_populates="weight_records")
