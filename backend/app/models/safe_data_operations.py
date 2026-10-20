import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class SafeDataOperationEvent(Base):
    """Append-only history for archive, restore, and void lifecycle changes."""

    __tablename__ = "safe_data_operation_events"

    event_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    entity_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    entity_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
    operation: Mapped[str] = mapped_column(String(40), nullable=False)
    actor_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid(as_uuid=True), nullable=True)
    actor_email: Mapped[Optional[str]] = mapped_column(String(320), nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
