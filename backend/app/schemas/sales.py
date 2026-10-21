from datetime import date
from decimal import Decimal
from typing import List, Literal, Optional
import uuid
from pydantic import BaseModel, Field, model_validator

from app.schemas.common import AuditBase


# MILK PRODUCTION
class MilkProductionBase(BaseModel):
    cow_id: uuid.UUID
    production_date: date
    session: str = Field(..., pattern="^(morning|noon|evening)$")
    liters: Decimal = Field(..., gt=0, max_digits=8, decimal_places=2)


class MilkProductionCreate(MilkProductionBase):
    pass


class MilkProductionUpdate(BaseModel):
    cow_id: Optional[uuid.UUID] = None
    production_date: Optional[date] = None
    session: Optional[str] = Field(None, pattern="^(morning|noon|evening)$")
    liters: Optional[Decimal] = Field(None, gt=0, max_digits=8, decimal_places=2)
    is_archived: Optional[bool] = None
    is_void: Optional[bool] = None
    void_reason: Optional[str] = None

    @model_validator(mode="after")
    def require_void_reason(self):
        if self.is_void is True and not (self.void_reason or "").strip():
            raise ValueError("A reason is required when voiding a milk record.")
        return self


class MilkProductionRead(MilkProductionBase, AuditBase):
    milk_id: uuid.UUID
    cow_tag_number: Optional[str] = None
    is_archived: bool = False
    is_void: bool = False
    void_reason: Optional[str] = None


MilkSession = Literal["morning", "noon", "evening"]


class MilkCowScheduleItem(BaseModel):
    cow_id: uuid.UUID
    gives_milk: bool
    milking_sessions: List[MilkSession] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_schedule(self):
        if len(self.milking_sessions) != len(set(self.milking_sessions)):
            raise ValueError("A milking session can only be selected once.")
        if self.gives_milk != bool(self.milking_sessions):
            raise ValueError("Select at least one session for a cow that gives milk, or mark her as not milking.")
        return self


class MilkCowSchedulesUpdate(BaseModel):
    records: List[MilkCowScheduleItem]

    @model_validator(mode="after")
    def validate_unique_cows(self):
        cow_ids = [record.cow_id for record in self.records]
        if len(cow_ids) != len(set(cow_ids)):
            raise ValueError("A cow can only appear once in the milking roster update.")
        return self


class MilkProductionBatchCreate(BaseModel):
    production_date: date
    session: MilkSession
    total_liters: Decimal = Field(..., ge=0, max_digits=8, decimal_places=2)
    cow_ids: List[uuid.UUID]

    @model_validator(mode="after")
    def validate_batch(self):
        if len(self.cow_ids) != len(set(self.cow_ids)):
            raise ValueError("A cow can only be selected once in a session.")
        if self.cow_ids and self.total_liters <= 0:
            raise ValueError("Enter a positive total when one or more cows are selected.")
        if not self.cow_ids and self.total_liters != 0:
            raise ValueError("Set the session total to 0 when no cows are selected.")
        if self.total_liters * 100 < len(self.cow_ids):
            raise ValueError("There must be at least 0.01 liters for each selected cow.")
        return self


class MilkProductionBatchRead(BaseModel):
    batch_id: Optional[uuid.UUID] = None
    production_date: date
    session: MilkSession
    total_liters: Decimal
    cow_ids: List[uuid.UUID]
    cow_count: int


# CUSTOMER
class CustomerBase(BaseModel):
    name: str = Field(..., max_length=150)
    phone: Optional[str] = Field(None, max_length=50)
    customer_type: str = Field("individual", pattern="^(individual|dairy_shop|wholesaler|meat_buyer)$")


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=150)
    phone: Optional[str] = Field(None, max_length=50)
    customer_type: Optional[str] = Field(None, pattern="^(individual|dairy_shop|wholesaler|meat_buyer)$")
    is_archived: Optional[bool] = None


class CustomerRead(CustomerBase, AuditBase):
    customer_id: uuid.UUID
    is_archived: bool
    total_invoiced: Optional[Decimal] = Decimal("0.00")
    total_paid: Optional[Decimal] = Decimal("0.00")
    current_balance: Optional[Decimal] = Decimal("0.00")


# SALES INVOICE LINE
class SalesInvoiceLineBase(BaseModel):
    item_type: str = Field(..., pattern="^(milk|animal|other)$")
    cow_id: Optional[uuid.UUID] = None
    description: str = Field(..., max_length=255)
    quantity: Decimal = Field(..., gt=0, max_digits=10, decimal_places=2)
    unit_price: Decimal = Field(..., ge=0, max_digits=12, decimal_places=2)


class SalesInvoiceLineCreate(SalesInvoiceLineBase):
    @model_validator(mode="after")
    def validate_animal_line(self) -> "SalesInvoiceLineCreate":
        if self.item_type == "animal" and self.cow_id is None:
            raise ValueError("An animal sale line must be linked to a specific cow_id.")
        return self


class SalesInvoiceLineRead(SalesInvoiceLineBase, AuditBase):
    line_id: uuid.UUID
    invoice_id: uuid.UUID
    line_total: Decimal
    cow_tag_number: Optional[str] = None


# SALE PAYMENT
class SalePaymentBase(BaseModel):
    payment_date: date
    amount: Decimal = Field(..., gt=0, max_digits=12, decimal_places=2)
    payment_method: str = Field("cash", pattern="^(cash|bank|bKash|Nagad|other)$")
    reference_number: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None


class SalePaymentCreate(SalePaymentBase):
    pass


class SalePaymentVoid(BaseModel):
    void_reason: str = Field(..., min_length=1, max_length=500)

    @model_validator(mode="after")
    def require_nonblank_reason(self):
        if not self.void_reason.strip():
            raise ValueError("A reason is required when voiding a payment.")
        return self


class SalePaymentRead(SalePaymentBase, AuditBase):
    payment_id: uuid.UUID
    invoice_id: uuid.UUID
    status: str = "paid"
    void_reason: Optional[str] = None


# SALES INVOICE
class SalesInvoiceCreate(BaseModel):
    customer_id: uuid.UUID
    invoice_date: date
    due_date: Optional[date] = None
    discount: Decimal = Field(Decimal("0.00"), ge=0, max_digits=12, decimal_places=2)
    notes: Optional[str] = None
    lines: List[SalesInvoiceLineCreate] = Field(..., min_length=1)


class SalesInvoiceStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(issued|void)$")
    notes: Optional[str] = None
    void_reason: Optional[str] = Field(None, min_length=1, max_length=500)

    @model_validator(mode="after")
    def require_void_reason(self):
        if self.status == "void" and not (self.void_reason or "").strip():
            raise ValueError("A reason is required when voiding an invoice.")
        return self


class SalesInvoiceRead(AuditBase):
    invoice_id: uuid.UUID
    invoice_number: str
    customer_id: uuid.UUID
    customer_name: Optional[str] = None
    invoice_date: date
    due_date: Optional[date] = None
    status: str
    subtotal: Decimal
    discount: Decimal
    total_amount: Decimal
    paid_amount: Decimal
    outstanding_balance: Decimal
    notes: Optional[str] = None
    lines: List[SalesInvoiceLineRead] = []
    payments: List[SalePaymentRead] = []
