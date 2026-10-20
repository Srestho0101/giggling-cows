from datetime import date
from decimal import Decimal
from typing import List, Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.common import AuditBase


# WAREHOUSE
class WarehouseBase(BaseModel):
    name: str = Field(..., max_length=100)
    housing_type: str = Field("shed", max_length=50)
    capacity: int = Field(10, ge=1)


class WarehouseCreate(WarehouseBase):
    pass


class WarehouseUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    housing_type: Optional[str] = Field(None, max_length=50)
    capacity: Optional[int] = Field(None, ge=1)
    is_archived: Optional[bool] = None


class WarehouseRead(WarehouseBase, AuditBase):
    warehouse_id: uuid.UUID
    is_archived: bool
    current_occupancy: Optional[int] = 0


# SUPPLIER
class SupplierBase(BaseModel):
    name: str = Field(..., max_length=150)
    phone: Optional[str] = Field(None, max_length=50)
    supplier_type: str = Field("individual", max_length=50)


class SupplierCreate(SupplierBase):
    pass


class SupplierUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=150)
    phone: Optional[str] = Field(None, max_length=50)
    supplier_type: Optional[str] = Field(None, max_length=50)
    is_archived: Optional[bool] = None


class SupplierRead(SupplierBase, AuditBase):
    supplier_id: uuid.UUID
    is_archived: bool


# WEIGHT RECORD
class WeightRecordCreate(BaseModel):
    weigh_date: date
    weight_kg: Decimal = Field(..., gt=0, max_digits=8, decimal_places=2)


class WeightRecordUpdate(BaseModel):
    weigh_date: Optional[date] = None
    weight_kg: Optional[Decimal] = Field(None, gt=0, max_digits=8, decimal_places=2)
    is_archived: Optional[bool] = None


class WeightRecordRead(WeightRecordCreate, AuditBase):
    weight_id: uuid.UUID
    cow_id: uuid.UUID
    is_archived: bool = False


# COW ID / TAG HISTORY
class CowIDHistoryCreate(BaseModel):
    tag_number: str = Field(..., max_length=50)
    tag_type: str = Field("ear_tag", max_length=50)
    assigned_date: date
    removed_date: Optional[date] = None
    reason: Optional[str] = None


class CowIDHistoryRead(CowIDHistoryCreate, AuditBase):
    history_id: uuid.UUID
    cow_id: uuid.UUID


# COW WAREHOUSE MOVEMENT HISTORY
class CowWarehouseHistoryCreate(BaseModel):
    warehouse_id: uuid.UUID
    moved_in_date: date
    reason: Optional[str] = Field(None, max_length=200)


class CowWarehouseHistoryRead(AuditBase):
    movement_id: uuid.UUID
    cow_id: uuid.UUID
    warehouse_id: uuid.UUID
    warehouse_name: Optional[str] = None
    moved_in_date: date
    moved_out_date: Optional[date] = None
    reason: Optional[str] = None


# COW
class CowBase(BaseModel):
    current_tag_number: str = Field(..., max_length=50)
    sex: str = Field(..., pattern="^(male|female)$")
    category: str = Field(..., max_length=50)  # dairy, bull, heifer, calf, ox
    birth_date: Optional[date] = None
    acquisition_type: str = Field(..., pattern="^(born_on_farm|bought_from_supplier|bought_from_bazar)$")
    acquisition_date: date
    purchase_price: Optional[Decimal] = Field(None, ge=0, max_digits=12, decimal_places=2)
    supplier_id: Optional[uuid.UUID] = None
    dam_id: Optional[uuid.UUID] = None
    sire_id: Optional[uuid.UUID] = None
    warehouse_id: uuid.UUID
    status: str = Field("active", pattern="^(active|sold|deceased|archived)$")
    notes: Optional[str] = None


class CowCreate(CowBase):
    @model_validator(mode="after")
    def validate_acquisition_rules(self) -> "CowCreate":
        if self.acquisition_type == "born_on_farm":
            if self.supplier_id is not None:
                raise ValueError("Born on farm cows cannot have a supplier_id.")
        else:
            if self.dam_id is not None or self.sire_id is not None:
                raise ValueError("Purchased cows cannot have on-farm dam_id or sire_id.")
        return self


class CowUpdate(BaseModel):
    current_tag_number: Optional[str] = Field(None, max_length=50)
    sex: Optional[str] = Field(None, pattern="^(male|female)$")
    category: Optional[str] = Field(None, max_length=50)
    birth_date: Optional[date] = None
    acquisition_type: Optional[str] = Field(None, pattern="^(born_on_farm|bought_from_supplier|bought_from_bazar)$")
    acquisition_date: Optional[date] = None
    purchase_price: Optional[Decimal] = Field(None, ge=0, max_digits=12, decimal_places=2)
    supplier_id: Optional[uuid.UUID] = None
    dam_id: Optional[uuid.UUID] = None
    sire_id: Optional[uuid.UUID] = None
    warehouse_id: Optional[uuid.UUID] = None
    status: Optional[str] = Field(None, pattern="^(active|sold|deceased|archived)$")
    notes: Optional[str] = None
    is_archived: Optional[bool] = None


class CowRead(CowBase, AuditBase):
    cow_id: uuid.UUID
    is_archived: bool
    warehouse_name: Optional[str] = None
    supplier_name: Optional[str] = None
    dam_tag: Optional[str] = None
    sire_tag: Optional[str] = None
    latest_weight_kg: Optional[Decimal] = None


class CowDetailRead(CowRead):
    id_history: List[CowIDHistoryRead] = []
    warehouse_history: List[CowWarehouseHistoryRead] = []
    weight_records: List[WeightRecordRead] = []
