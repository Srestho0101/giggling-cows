from datetime import date
from decimal import Decimal
from typing import Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import AuditBase


# MARKET PRICE
class MarketPriceBase(BaseModel):
    price_date: date
    price_per_kg_net: Decimal = Field(..., gt=0, max_digits=10, decimal_places=2)
    source: Optional[str] = Field(None, max_length=100)


class MarketPriceCreate(MarketPriceBase):
    pass


class MarketPriceRead(MarketPriceBase, AuditBase):
    market_price_id: uuid.UUID


# CALCULATION PREVIEW
class EvaluationCalculationRequest(BaseModel):
    live_weight_kg: Decimal = Field(..., gt=0, max_digits=8, decimal_places=2)
    growth_potential: str = Field(..., pattern="^(good|poor)$")
    custom_net_weight_percent: Optional[Decimal] = Field(None, ge=40, le=80, max_digits=5, decimal_places=2)
    offered_price: Decimal = Field(..., gt=0, max_digits=12, decimal_places=2)
    market_price_per_kg: Decimal = Field(..., gt=0, max_digits=10, decimal_places=2)


class EvaluationCalculationResult(BaseModel):
    live_weight_kg: Decimal
    growth_potential: str
    net_weight_percent: Decimal
    est_net_weight_kg: Decimal
    offered_price: Decimal
    net_price_per_kg: Decimal
    market_price_per_kg: Decimal
    is_profitable: bool
    price_difference_per_kg: Decimal
    total_projected_margin: Decimal


# PURCHASE EVALUATION
class PurchaseEvaluationBase(BaseModel):
    evaluation_date: date
    supplier_id: Optional[uuid.UUID] = None
    live_weight_kg: Decimal = Field(..., gt=0, max_digits=8, decimal_places=2)
    growth_potential: str = Field(..., pattern="^(good|poor)$")
    custom_net_weight_percent: Optional[Decimal] = Field(None, ge=40, le=80, max_digits=5, decimal_places=2)
    offered_price: Decimal = Field(..., gt=0, max_digits=12, decimal_places=2)
    market_price_id: Optional[uuid.UUID] = None
    market_price_per_kg: Optional[Decimal] = Field(None, gt=0, max_digits=10, decimal_places=2)
    decision: str = Field("pending", pattern="^(bought|returned|pending)$")
    notes: Optional[str] = None


class PurchaseEvaluationCreate(PurchaseEvaluationBase):
    pass


class PurchaseEvaluationUpdate(BaseModel):
    decision: Optional[str] = Field(None, pattern="^(bought|returned|pending)$")
    notes: Optional[str] = None


class PurchaseEvaluationRead(AuditBase):
    evaluation_id: uuid.UUID
    evaluation_date: date
    supplier_id: Optional[uuid.UUID] = None
    supplier_name: Optional[str] = None
    live_weight_kg: Decimal
    growth_potential: str
    net_weight_percent: Decimal
    est_net_weight_kg: Decimal
    offered_price: Decimal
    net_price_per_kg: Decimal
    market_price_id: Optional[uuid.UUID] = None
    market_price_per_kg: Decimal
    is_profitable: bool
    decision: str
    cow_id: Optional[uuid.UUID] = None
    cow_tag_number: Optional[str] = None
    notes: Optional[str] = None


class ConvertEvaluationToCow(BaseModel):
    tag_number: str = Field(..., max_length=50)
    sex: str = Field(..., pattern="^(male|female)$")
    category: str = Field(..., max_length=50)
    warehouse_id: uuid.UUID
    birth_date: Optional[date] = None
    notes: Optional[str] = None
