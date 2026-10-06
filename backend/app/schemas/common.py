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
