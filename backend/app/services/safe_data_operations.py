from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.safe_data_operations import SafeDataOperationEvent


def capture_lifecycle_state(record: Any) -> dict[str, Any]:
    if hasattr(record, "is_void"):
        is_void = bool(record.is_void)
    elif getattr(record, "status", None) == "void":
        is_void = True
    else:
        is_void = False
    return {
        "is_archived": getattr(record, "is_archived", None),
        "is_void": is_void,
        "void_reason": getattr(record, "void_reason", None),
    }


def record_lifecycle_changes(
    session: AsyncSession,
    record: Any,
    before: dict[str, Any],
    actor_id,
    actor_email: str | None,
) -> None:
    now = datetime.now(timezone.utc)
    entity_type = record.__tablename__
    primary_key_name = record.__mapper__.primary_key[0].key
    entity_id = getattr(record, primary_key_name)

    archived = getattr(record, "is_archived", None)
    if before["is_archived"] is not None and bool(archived) != bool(before["is_archived"]):
        is_archiving = bool(archived)
        record.archived_at = now if is_archiving else None
        record.archived_by = actor_id if is_archiving else None
        session.add(
            SafeDataOperationEvent(
                entity_type=entity_type,
                entity_id=entity_id,
                operation="archived" if is_archiving else "restored",
                actor_id=actor_id,
                actor_email=actor_email,
                occurred_at=now,
            )
        )

    after = capture_lifecycle_state(record)
    if after["is_void"] != before["is_void"]:
        is_voiding = after["is_void"]
        reason = after["void_reason"] or before["void_reason"]
        if hasattr(record, "voided_at"):
            record.voided_at = now if is_voiding else None
            record.voided_by = actor_id if is_voiding else None
        if hasattr(record, "void_reason") and not is_voiding:
            record.void_reason = None
        session.add(
            SafeDataOperationEvent(
                entity_type=entity_type,
                entity_id=entity_id,
                operation="voided" if is_voiding else "unvoided",
                actor_id=actor_id,
                actor_email=actor_email,
                reason=reason,
                occurred_at=now,
            )
        )


async def list_lifecycle_events(
    session: AsyncSession,
    entity_type: str,
    entity_id,
    limit: int = 100,
) -> list[SafeDataOperationEvent]:
    stmt = (
        select(SafeDataOperationEvent)
        .where(
            SafeDataOperationEvent.entity_type == entity_type,
            SafeDataOperationEvent.entity_id == entity_id,
        )
        .order_by(SafeDataOperationEvent.occurred_at.desc())
        .limit(limit)
    )
    return list((await session.execute(stmt)).scalars().all())
