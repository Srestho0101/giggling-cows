from calendar import monthrange
from datetime import date, datetime
from decimal import Decimal
from typing import List, Literal, Optional
import uuid
from zoneinfo import ZoneInfo
from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.common import AuditBase


def _dhaka_today() -> date:
    return datetime.now(ZoneInfo("Asia/Dhaka")).date()


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
class WeightRecordBase(BaseModel):
    weigh_date: date
    weight_kg: Decimal = Field(..., gt=0, max_digits=8, decimal_places=2)


class WeightRecordCreate(WeightRecordBase):
    @model_validator(mode="after")
    def validate_weigh_date_not_future(self) -> "WeightRecordCreate":
        if self.weigh_date > date.today():
            raise ValueError("Weigh date cannot be in the future.")
        return self


class WeightRecordUpdate(BaseModel):
    weigh_date: Optional[date] = None
    weight_kg: Optional[Decimal] = Field(None, gt=0, max_digits=8, decimal_places=2)
    is_archived: Optional[bool] = None

    @model_validator(mode="after")
    def validate_weigh_date_not_future(self) -> "WeightRecordUpdate":
        if self.weigh_date is not None and self.weigh_date > date.today():
            raise ValueError("Weigh date cannot be in the future.")
        return self


class WeightRecordRead(WeightRecordBase, AuditBase):
    weight_id: uuid.UUID
    cow_id: uuid.UUID
    is_archived: bool = False


# COW ID / TAG HISTORY
class CowIDHistoryCreate(BaseModel):
    tag_number: str = Field(..., min_length=1, max_length=50)
    tag_type: str = Field("ear_tag", max_length=50)
    assigned_date: date
    removed_date: Optional[date] = None
    reason: Optional[str] = Field(None, max_length=500)
    set_as_current: bool = True

    @model_validator(mode="after")
    def validate_dates_and_tag(self) -> "CowIDHistoryCreate":
        self.tag_number = self.tag_number.strip()
        if not self.tag_number:
            raise ValueError("Tag number cannot be empty.")
        if self.removed_date is not None and self.removed_date < self.assigned_date:
            raise ValueError("Removed date cannot be earlier than assigned date.")
        return self


class CowIDHistoryRead(AuditBase):
    history_id: uuid.UUID
    cow_id: uuid.UUID
    tag_number: str
    tag_type: str
    assigned_date: date
    removed_date: Optional[date] = None
    reason: Optional[str] = None


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
    category: str = Field(..., max_length=50)  # dairy, beef, duel-purpose
    cow_type: Optional[str] = Field(None, max_length=50)
    breed: Optional[str] = Field(None, pattern="^(deshi|friesian|other)$")
    birth_date: Optional[date] = None
    acquisition_type: str = Field(..., pattern="^(born_on_farm|bought_from_supplier|bought_from_bazar)$")
    acquisition_date: date
    purchase_price: Optional[Decimal] = Field(None, ge=0, max_digits=12, decimal_places=2)
    supplier_id: Optional[uuid.UUID] = None
    dam_id: Optional[uuid.UUID] = None
    sire_id: Optional[uuid.UUID] = None
    warehouse_id: uuid.UUID
    status: str = Field("active", pattern="^(active|sold|deceased|archived)$")
    gives_milk: Optional[bool] = None
    milking_sessions: Optional[List[Literal["morning", "noon", "evening"]]] = None
    notes: Optional[str] = None


class CowCreate(CowBase):
    @model_validator(mode="after")
    def validate_acquisition_rules(self) -> "CowCreate":
        if self.acquisition_type == "born_on_farm":
            if self.supplier_id is not None:
                raise ValueError("Born on farm cows cannot have a supplier_id.")
            # Born-on-farm cows must not carry a purchase price
            self.purchase_price = Decimal("0")
            if self.birth_date is not None:
                self.acquisition_date = self.birth_date
        # Acquisition date must not precede birth date
        if self.birth_date is not None and self.acquisition_date < self.birth_date:
            raise ValueError("Acquisition date cannot be earlier than birth date.")
        if self.sex == "male" or self.status != "active":
            self.gives_milk = False
            self.milking_sessions = []
        else:
            if self.gives_milk is None:
                self.gives_milk = (self.cow_type or "").strip().lower() == "cow"
            if self.gives_milk:
                if not self.milking_sessions:
                    self.milking_sessions = ["morning", "noon", "evening"]
            else:
                self.milking_sessions = []
        return self


class CowUpdate(BaseModel):
    current_tag_number: Optional[str] = Field(None, max_length=50)
    sex: Optional[str] = Field(None, pattern="^(male|female)$")
    category: Optional[str] = Field(None, max_length=50)
    cow_type: Optional[str] = Field(None, max_length=50)
    breed: Optional[str] = Field(None, pattern="^(deshi|friesian|other)$")
    birth_date: Optional[date] = None
    acquisition_type: Optional[str] = Field(None, pattern="^(born_on_farm|bought_from_supplier|bought_from_bazar)$")
    acquisition_date: Optional[date] = None
    purchase_price: Optional[Decimal] = Field(None, ge=0, max_digits=12, decimal_places=2)
    supplier_id: Optional[uuid.UUID] = None
    dam_id: Optional[uuid.UUID] = None
    sire_id: Optional[uuid.UUID] = None
    warehouse_id: Optional[uuid.UUID] = None
    status: Optional[str] = Field(None, pattern="^(active|sold|deceased|archived)$")
    gives_milk: Optional[bool] = None
    milking_sessions: Optional[List[Literal["morning", "noon", "evening"]]] = None
    notes: Optional[str] = None
    is_archived: Optional[bool] = None


class CowRead(CowBase, AuditBase):
    cow_id: uuid.UUID
    is_archived: bool
    gives_milk: bool = False
    milking_sessions: List[Literal["morning", "noon", "evening"]] = Field(default_factory=list)
    warehouse_name: Optional[str] = None
    supplier_name: Optional[str] = None
    dam_tag: Optional[str] = None
    sire_tag: Optional[str] = None
    age: Optional[str] = None
    age_group: Optional[str] = None
    latest_weight_kg: Optional[Decimal] = None
    days_on_farm: Optional[int] = None

    @model_validator(mode="after")
    def calculate_derived_fields(self) -> "CowRead":
        today = _dhaka_today()
        if self.acquisition_date:
            self.days_on_farm = max(0, (today - self.acquisition_date).days)
        else:
            self.days_on_farm = None

        category = self.category.strip().casefold()
        if "dairy" in category or "milk" in category:
            self.age = None
            self.age_group = None
            return self

        if self.birth_date is None or self.birth_date > today:
            self.age = None
            self.age_group = None
            return self

        months = (today.year - self.birth_date.year) * 12 + today.month - self.birth_date.month
        if today.day < self.birth_date.day:
            months -= 1
        months = max(months, 0)
        years, remaining_months = divmod(months, 12)
        age_parts = []
        if years:
            age_parts.append(f"{years} {'year' if years == 1 else 'years'}")
        if remaining_months or not years:
            age_parts.append(f"{remaining_months} {'month' if remaining_months == 1 else 'months'}")
        self.age = ", ".join(age_parts)
        if today < _add_months(self.birth_date, 4):
            if self.breed == "deshi":
                self.age_group = "Deshi Calf"
            elif self.breed == "friesian":
                self.age_group = "Friesian Calf"
            else:
                self.age_group = "Calf"
        elif today <= _add_months(self.birth_date, 10):
            self.age_group = "Medium"
        else:
            self.age_group = "Adult"
        return self


def _add_months(value: date, months: int) -> date:
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    day = min(value.day, monthrange(year, month)[1])
    return date(year, month, day)


class CowOffspringRead(BaseModel):
    cow_id: uuid.UUID
    current_tag_number: str
    sex: str
    category: str
    cow_type: Optional[str] = None
    birth_date: Optional[date] = None
    status: str

    model_config = ConfigDict(from_attributes=True)


class CowDetailRead(CowRead):
    id_history: List[CowIDHistoryRead] = []
    warehouse_history: List[CowWarehouseHistoryRead] = []
    weight_records: List[WeightRecordRead] = []
    offspring: List[CowOffspringRead] = []
