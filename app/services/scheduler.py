"""Recurring scheduler for job posting lifecycle maintenance."""

from datetime import datetime
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.config import get_settings
from app.services.job_lifecycle import run_maintenance

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


def start_scheduler() -> None:
    """Starts the daily job lifecycle sweep once per process."""
    global _scheduler

    settings = get_settings()
    if not settings.JOB_MAINTENANCE_ENABLED:
        logger.info("Job lifecycle maintenance disabled; scheduler not started")
        return
    if _scheduler is not None:
        return

    scheduler = AsyncIOScheduler(timezone=settings.JOB_MAINTENANCE_TZ)
    trigger = CronTrigger(
        hour=settings.JOB_MAINTENANCE_HOUR,
        minute=0,
        timezone=settings.JOB_MAINTENANCE_TZ,
    )
    job = scheduler.add_job(
        run_maintenance,
        trigger,
        id="job_lifecycle_maintenance",
        max_instances=1,
        coalesce=True,
        next_run_time=datetime.now(tz=scheduler.timezone),
    )
    scheduler.start()
    _scheduler = scheduler
    logger.info("Job lifecycle maintenance scheduled; next run at %s", job.next_run_time)


def shutdown_scheduler() -> None:
    """Stops the scheduler if it was started."""
    global _scheduler

    if _scheduler is None:
        return

    _scheduler.shutdown(wait=False)
    _scheduler = None
    logger.info("Job lifecycle maintenance scheduler stopped")
