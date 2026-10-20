import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import AuthUser, get_current_user
from app.schemas.common import SafeDataOperationEventRead
from app.services.safe_data_operations import list_lifecycle_events

router = APIRouter()


@router.get("/safe-data-operations", response_model=list[SafeDataOperationEventRead])
async def get_safe_data_operation_history(
    entity_type: str = Query(..., min_length=1, max_length=80),
    entity_id: uuid.UUID = Query(...),
    limit: int = Query(100, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    return await list_lifecycle_events(db, entity_type, entity_id, limit)
