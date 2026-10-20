from datetime import date
from decimal import Decimal
from typing import Optional
import uuid
from pydantic import BaseModel, Field, model_validator

from app.schemas.common import AuditBase


# EXPENSE CATEGORY
class ExpenseCategoryBase(BaseModel):
    name: str = Field(..., max_length=100)
    name_bn: str = Field(..., max_length=100)
    category_group: str = Field(..., pattern="^(food|miscellaneous)$")


class ExpenseCategoryCreate(ExpenseCategoryBase):
    pass


class ExpenseCategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    name_bn: Optional[str] = Field(None, max_length=100)
    category_group: Optional[str] = Field(None, pattern="^(food|miscellaneous)$")
    is_archived: Optional[bool] = None


class ExpenseCategoryRead(ExpenseCategoryBase, AuditBase):
    category_id: uuid.UUID
    is_archived: bool = False


# FEED TYPE
class FeedTypeBase(BaseModel):
    category_id: uuid.UUID
    name: str = Field(..., max_length=100)
    name_bn: str = Field(..., max_length=100)
    unit: str = Field("kg", max_length=20)
    unit_cost: Decimal = Field(..., ge=0, max_digits=10, decimal_places=2)


class FeedTypeCreate(FeedTypeBase):
    pass


class FeedTypeUpdate(BaseModel):
    category_id: Optional[uuid.UUID] = None
    name: Optional[str] = Field(None, max_length=100)
    name_bn: Optional[str] = Field(None, max_length=100)
    unit: Optional[str] = Field(None, max_length=20)
    unit_cost: Optional[Decimal] = Field(None, ge=0, max_digits=10, decimal_places=2)
    is_archived: Optional[bool] = None


class FeedTypeRead(FeedTypeBase, AuditBase):
    feed_type_id: uuid.UUID
    is_archived: bool
    category_name: Optional[str] = None


# FEEDING RECORD
class FeedingRecordBase(BaseModel):
    feed_type_id: uuid.UUID
    cow_id: Optional[uuid.UUID] = None
    feeding_date: date
    quantity: Decimal = Field(..., gt=0, max_digits=10, decimal_places=2)
    custom_unit_cost: Optional[Decimal] = Field(None, ge=0, max_digits=10, decimal_places=2)
    notes: Optional[str] = None


class FeedingRecordCreate(FeedingRecordBase):
    pass


class FeedingRecordUpdate(BaseModel):
    feed_type_id: Optional[uuid.UUID] = None
    cow_id: Optional[uuid.UUID] = None
    feeding_date: Optional[date] = None
    quantity: Optional[Decimal] = Field(None, gt=0, max_digits=10, decimal_places=2)
    custom_unit_cost: Optional[Decimal] = Field(None, ge=0, max_digits=10, decimal_places=2)
    notes: Optional[str] = None
    is_archived: Optional[bool] = None


class FeedingRecordRead(AuditBase):
    feeding_id: uuid.UUID
    feed_type_id: uuid.UUID
    feed_name: Optional[str] = None
    feed_name_bn: Optional[str] = None
    unit: Optional[str] = None
    cow_id: Optional[uuid.UUID] = None
    cow_tag_number: Optional[str] = None
    feeding_date: date
    quantity: Decimal
    cost: Decimal
    notes: Optional[str] = None
    is_archived: bool = False


# EXPENSE
class ExpenseBase(BaseModel):
    category_id: uuid.UUID
    warehouse_id: Optional[uuid.UUID] = None
    cow_id: Optional[uuid.UUID] = None
    expense_date: date
    amount: Decimal = Field(..., gt=0, max_digits=12, decimal_places=2)
    description: Optional[str] = None


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseUpdate(BaseModel):
    category_id: Optional[uuid.UUID] = None
    warehouse_id: Optional[uuid.UUID] = None
    cow_id: Optional[uuid.UUID] = None
    expense_date: Optional[date] = None
    amount: Optional[Decimal] = Field(None, gt=0, max_digits=12, decimal_places=2)
    description: Optional[str] = None
    is_archived: Optional[bool] = None
    is_void: Optional[bool] = None
    void_reason: Optional[str] = None

    @model_validator(mode="after")
    def require_void_reason(self):
        if self.is_void is True and not (self.void_reason or "").strip():
            raise ValueError("A reason is required when voiding an expense.")
        return self


class ExpenseRead(ExpenseBase, AuditBase):
    expense_id: uuid.UUID
    category_name: Optional[str] = None
    category_name_bn: Optional[str] = None
    warehouse_name: Optional[str] = None
    cow_tag_number: Optional[str] = None
    is_archived: bool = False
    is_void: bool = False
    void_reason: Optional[str] = None
