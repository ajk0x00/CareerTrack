"""Two-stage job posting lifecycle: soft expiry and hard purge of stale saved jobs.

Both retention windows are measured from ``jobs.created_at`` so the sweep never
depends on when a previous run happened. Maintenance is a single set-based pass
per stage; it never iterates rows individually.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
import logging

from sqlalchemy import Interval, delete, func, literal, update

from app.core.config import get_settings
from app.core.database import async_session_factory
from app.models.job import Job, JobStatus

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class MaintenanceResult:
    """Counts produced by one maintenance sweep."""

    expired: int
    purged: int


def expires_at(created_at: datetime) -> datetime:
    """Returns the moment a saved job becomes expired."""
    return created_at + timedelta(days=get_settings().JOB_EXPIRY_DAYS)


def purge_at(created_at: datetime) -> datetime:
    """Returns the moment a saved job is hard-deleted."""
    return created_at + timedelta(days=get_settings().JOB_PURGE_DAYS)


async def run_maintenance() -> MaintenanceResult:
    """Soft-expires then hard-deletes stale saved jobs in two set-based statements."""
    settings = get_settings()
    expiry_cutoff = func.now() - literal(
        timedelta(days=settings.JOB_EXPIRY_DAYS),
        Interval(),
    )
    purge_cutoff = func.now() - literal(
        timedelta(days=settings.JOB_PURGE_DAYS),
        Interval(),
    )

    async with async_session_factory() as db:
        try:
            expire_stmt = (
                update(Job)
                .where(
                    Job.status == JobStatus.SAVED.value,
                    Job.expired_at.is_(None),
                    Job.created_at < expiry_cutoff,
                )
                .values(expired_at=func.now())
                .execution_options(synchronize_session=False)
            )
            expired = (await db.execute(expire_stmt)).rowcount or 0

            purge_stmt = (
                delete(Job)
                .where(
                    Job.status == JobStatus.SAVED.value,
                    Job.created_at < purge_cutoff,
                )
                .execution_options(synchronize_session=False)
            )
            purged = (await db.execute(purge_stmt)).rowcount or 0

            await db.commit()
        except Exception:
            await db.rollback()
            logger.exception("job maintenance failed")
            raise

    logger.info(
        "expired %d saved job(s) older than %d days; purged %d saved job(s) older than %d days",
        expired,
        settings.JOB_EXPIRY_DAYS,
        purged,
        settings.JOB_PURGE_DAYS,
    )
    logger.info("job maintenance: expired=%d purged=%d", expired, purged)
    return MaintenanceResult(expired=expired, purged=purged)
