import uuid
from datetime import datetime, timezone
from typing import AsyncGenerator
from sqlalchemy import DateTime, Uuid, func
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.core.config import settings

engine_kwargs = {
    "echo": False,
    "future": True,
    "pool_pre_ping": True,
    "connect_args": settings.database_connect_args,
}

if not settings.DATABASE_URL.startswith("sqlite"):
    engine_kwargs.update({
        "pool_size": 3,
        "max_overflow": 2,
        "pool_timeout": 10,
        "pool_recycle": 280,
    })

engine = create_async_engine(
    settings.async_database_url,
    **engine_kwargs,
)

async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )


class AuditMixin(TimestampMixin):
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        nullable=True,
    )
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        nullable=True,
    )


class ArchiveAuditMixin:
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    archived_by: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)


class VoidAuditMixin:
    voided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    voided_by: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        try:
            yield session
            # Writes commit inside endpoints. Only flush a leftover transaction
            # so pure reads do not pay an extra COMMIT round-trip.
            if session.is_active and (session.new or session.dirty or session.deleted):
                await session.commit()
        except Exception:
            await session.rollback()
            raise
