from collections.abc import AsyncGenerator
import logging

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings, normalize_database_url

logger = logging.getLogger(__name__)

settings = get_settings()

# Engine configuration with connection pooling and pre-ping
engine = create_async_engine(
    normalize_database_url(str(settings.SQLALCHEMY_DATABASE_URI)),
    echo=settings.DB_ECHO,
    pool_pre_ping=True,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_timeout=settings.DB_POOL_TIMEOUT,
)

# Async session factory
async_session_factory = async_sessionmaker(
    bind=engine,
    autoflush=False,
    expire_on_commit=False,
    class_=AsyncSession,
)


class Base(DeclarativeBase):
    """Base declarative class for all database models."""
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency that provides an async database session per request."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def close_db_connection() -> None:
    """Disposes engine connection pool on shutdown."""
    logger.info("Closing database connection pool...")
    await engine.dispose()
    logger.info("Database connection pool closed.")
