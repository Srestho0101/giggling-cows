from datetime import datetime
from typing import Generic, List, Optional, TypeVar
import uuid
from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class AuditBase(BaseModel):
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[uuid.UUID] = None
    updated_by: Optional[uuid.UUID] = None
    archived_at: Optional[datetime] = None
    archived_by: Optional[uuid.UUID] = None
    voided_at: Optional[datetime] = None
    voided_by: Optional[uuid.UUID] = None
    void_reason: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class SafeDataOperationEventRead(BaseModel):
    event_id: uuid.UUID
    entity_type: str
    entity_id: uuid.UUID
    operation: str
    actor_id: Optional[uuid.UUID] = None
    actor_email: Optional[str] = None
    reason: Optional[str] = None
    occurred_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int
    pages: int


class MessageResponse(BaseModel):
    message: str
    detail: Optional[str] = None
