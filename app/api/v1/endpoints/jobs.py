"""Endpoints for managing Job postings and application pipeline tracking."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.company import EmploymentType
from app.models.job import Job, JobStatus, WorkplaceType
from app.models.user import User
from app.schemas.job import (
    JobCreate,
    JobPipelineSummary,
    JobResponse,
    JobUpdate,
    SalaryInterval,
)
from app.services import job_lifecycle

router = APIRouter()


def _to_job_response(job: Job) -> JobResponse:
    """Serializes a job, adding derived lifecycle timestamps for saved postings."""
    response = JobResponse.model_validate(job)
    if job.status == JobStatus.SAVED.value:
        response.expires_at = job_lifecycle.expires_at(job.created_at)
        response.purge_at = job_lifecycle.purge_at(job.created_at)
    return response


@router.get(
    "",
    response_model=list[JobResponse],
    summary="List all job postings and pipeline applications for current user",
)
async def list_jobs(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    job_status: Annotated[
        JobStatus | None,
        Query(alias="status", description="Filter by pipeline stage (e.g. saved, applied, interviewing, offer)"),
    ] = None,
    workplace_type: Annotated[
        WorkplaceType | None,
        Query(description="Filter by workplace type (remote, hybrid, on_site)"),
    ] = None,
    employment_type: Annotated[
        EmploymentType | None,
        Query(description="Filter by employment type (full_time, contract, etc.)"),
    ] = None,
    q: Annotated[
        str | None,
        Query(description="Search across job title, company name, or location"),
    ] = None,
    sort_by: Annotated[
        str,
        Query(
            description="Field to sort by: updated_at, created_at, applied_date, deadline_date, company_name, title, salary_max"
        ),
    ] = "updated_at",
    sort_order: Annotated[
        str,
        Query(description="Sort order: asc or desc"),
    ] = "desc",
    include_expired: Annotated[
        bool,
        Query(description="Include saved jobs that have passed their expiry window"),
    ] = False,
) -> list[JobResponse]:
    """Returns all jobs tracked by the authenticated user with optional filtering and sorting."""
    stmt = select(Job).where(Job.user_id == current_user.id)

    if not include_expired:
        stmt = stmt.where(Job.expired_at.is_(None))

    if job_status is not None:
        stmt = stmt.where(Job.status == job_status.value)
    if workplace_type is not None:
        stmt = stmt.where(Job.workplace_type == workplace_type.value)
    if employment_type is not None:
        stmt = stmt.where(Job.employment_type == employment_type.value)
    if q and q.strip():
        search_term = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Job.title.ilike(search_term),
                Job.company_name.ilike(search_term),
                Job.location.ilike(search_term),
            )
        )

    # Sort column selection
    sort_column_map = {
        "updated_at": Job.updated_at,
        "created_at": Job.created_at,
        "applied_date": Job.applied_date,
        "deadline_date": Job.deadline_date,
        "company_name": Job.company_name,
        "title": Job.title,
        "salary_max": Job.salary_max,
    }
    target_column = sort_column_map.get(sort_by, Job.updated_at)
    if sort_order.lower() == "asc":
        stmt = stmt.order_by(target_column.asc().nulls_last())
    else:
        stmt = stmt.order_by(target_column.desc().nulls_last())

    result = await db.execute(stmt)
    return [_to_job_response(job) for job in result.scalars().all()]


@router.get(
    "/pipeline/summary",
    response_model=JobPipelineSummary,
    summary="Get pipeline stage summary statistics for current user",
)
async def get_pipeline_summary(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JobPipelineSummary:
    """Aggregates the count of jobs across all pipeline stages for the current user."""
    stmt = (
        select(Job.status, func.count(Job.id))
        .where(Job.user_id == current_user.id, Job.expired_at.is_(None))
        .group_by(Job.status)
    )
    result = await db.execute(stmt)
    counts = dict(result.all())

    expired_stmt = select(func.count(Job.id)).where(
        Job.user_id == current_user.id,
        Job.status == JobStatus.SAVED.value,
        Job.expired_at.is_not(None),
    )
    expired_recently = (await db.execute(expired_stmt)).scalar_one()

    saved = counts.get(JobStatus.SAVED.value, 0)
    applied = counts.get(JobStatus.APPLIED.value, 0)
    interviewing = counts.get(JobStatus.INTERVIEWING.value, 0)
    offer = counts.get(JobStatus.OFFER.value, 0)
    total = sum(counts.values())

    return JobPipelineSummary(
        total=total,
        saved=saved,
        applied=applied,
        interviewing=interviewing,
        offer=offer,
        expired_recently=expired_recently,
    )


@router.post(
    "",
    response_model=JobResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new job posting entry in the user's pipeline",
)
async def create_job(
    data: JobCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JobResponse:
    """Adds a new job posting to the user's career pipeline."""
    # Automatically set applied_date to today if user marks status as applied without providing a date
    effective_applied_date = data.applied_date
    if data.status == JobStatus.APPLIED and effective_applied_date is None:
        effective_applied_date = date.today()

    job = Job(
        user_id=current_user.id,
        title=data.title,
        company_name=data.company_name,
        job_url=data.job_url,
        location=data.location,
        workplace_type=(
            data.workplace_type.value
            if isinstance(data.workplace_type, WorkplaceType)
            else (str(data.workplace_type) if data.workplace_type else None)
        ),
        employment_type=(
            data.employment_type.value
            if isinstance(data.employment_type, EmploymentType)
            else (str(data.employment_type) if data.employment_type else None)
        ),
        department=data.department,
        description=data.description,
        requirements=data.requirements,
        salary_min=data.salary_min,
        salary_max=data.salary_max,
        salary_currency=data.salary_currency,
        salary_interval=(
            data.salary_interval.value
            if isinstance(data.salary_interval, SalaryInterval)
            else (str(data.salary_interval) if data.salary_interval else None)
        ),
        posted_date=data.posted_date,
        deadline_date=data.deadline_date,
        status=(
            data.status.value
            if isinstance(data.status, JobStatus)
            else str(data.status)
        ),
        current_stage=data.current_stage,
        applied_date=effective_applied_date,
        excitement_rating=data.excitement_rating,
        notes=data.notes,
        contact_name=data.contact_name,
        contact_email=data.contact_email,
        contact_phone=data.contact_phone,
    )
    db.add(job)
    await db.flush()
    await db.refresh(job)
    return _to_job_response(job)


@router.post(
    "/{job_id}/restore",
    response_model=JobResponse,
    summary="Restore an expired saved job posting",
)
async def restore_job(
    job_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JobResponse:
    """Clears the expiry marker on a saved job so it becomes visible again."""
    stmt = select(Job).where(
        Job.id == job_id,
        Job.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    job = result.scalar_one_or_none()

    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    if job.expired_at is not None:
        job.expired_at = None
        await db.flush()
        await db.refresh(job)

    return _to_job_response(job)


@router.get(
    "/{job_id}",
    response_model=JobResponse,
    summary="Get job posting details by ID",
)
async def get_job_by_id(
    job_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    include_expired: Annotated[
        bool,
        Query(description="Return the job even if it has expired"),
    ] = False,
) -> JobResponse:
    """Returns a specific job posting record belonging to the authenticated user."""
    stmt = select(Job).where(
        Job.id == job_id,
        Job.user_id == current_user.id,
    )
    if not include_expired:
        stmt = stmt.where(Job.expired_at.is_(None))
    result = await db.execute(stmt)
    job = result.scalar_one_or_none()

    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )
    return _to_job_response(job)


@router.patch(
    "/{job_id}",
    response_model=JobResponse,
    summary="Partially update a job posting or pipeline status",
)
async def update_job(
    job_id: int,
    data: JobUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JobResponse:
    """Updates fields of an existing job entry belonging to the authenticated user."""
    stmt = select(Job).where(
        Job.id == job_id,
        Job.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    job = result.scalar_one_or_none()

    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    update_data = data.model_dump(exclude_unset=True)

    # Cross-field validation for effective salary values
    effective_salary_min = update_data.get("salary_min", job.salary_min)
    effective_salary_max = update_data.get("salary_max", job.salary_max)
    if (
        effective_salary_min is not None
        and effective_salary_max is not None
        and effective_salary_max < effective_salary_min
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Maximum salary cannot be less than minimum salary",
        )

    # Cross-field validation for effective dates
    effective_posted_date = update_data.get("posted_date", job.posted_date)
    effective_deadline_date = update_data.get("deadline_date", job.deadline_date)
    if (
        effective_posted_date is not None
        and effective_deadline_date is not None
        and effective_deadline_date < effective_posted_date
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Deadline date cannot be earlier than posted date",
        )

    # Check status updates
    if "status" in update_data and update_data["status"] is not None:
        new_status = (
            update_data["status"].value
            if isinstance(update_data["status"], JobStatus)
            else str(update_data["status"])
        )
        job.status = new_status
        # If marked as applied and no applied_date was set or provided, set today
        if new_status == JobStatus.APPLIED.value and job.applied_date is None and "applied_date" not in update_data:
            job.applied_date = date.today()

    if "title" in update_data and update_data["title"] is not None:
        job.title = update_data["title"]
    if "company_name" in update_data and update_data["company_name"] is not None:
        job.company_name = update_data["company_name"]
    if "job_url" in update_data:
        job.job_url = update_data["job_url"]
    if "location" in update_data:
        job.location = update_data["location"]
    if "workplace_type" in update_data:
        val = update_data["workplace_type"]
        job.workplace_type = (
            val.value if isinstance(val, WorkplaceType) else (str(val) if val else None)
        )
    if "employment_type" in update_data:
        val = update_data["employment_type"]
        job.employment_type = (
            val.value if isinstance(val, EmploymentType) else (str(val) if val else None)
        )
    if "department" in update_data:
        job.department = update_data["department"]
    if "description" in update_data:
        job.description = update_data["description"]
    if "requirements" in update_data:
        job.requirements = update_data["requirements"]
    if "salary_min" in update_data:
        job.salary_min = update_data["salary_min"]
    if "salary_max" in update_data:
        job.salary_max = update_data["salary_max"]
    if "salary_currency" in update_data and update_data["salary_currency"] is not None:
        job.salary_currency = update_data["salary_currency"]
    if "salary_interval" in update_data:
        val = update_data["salary_interval"]
        job.salary_interval = (
            val.value if isinstance(val, SalaryInterval) else (str(val) if val else None)
        )
    if "posted_date" in update_data:
        job.posted_date = update_data["posted_date"]
    if "deadline_date" in update_data:
        job.deadline_date = update_data["deadline_date"]
    if "current_stage" in update_data:
        job.current_stage = update_data["current_stage"]
    if "applied_date" in update_data:
        job.applied_date = update_data["applied_date"]
    if "excitement_rating" in update_data:
        job.excitement_rating = update_data["excitement_rating"]
    if "notes" in update_data:
        job.notes = update_data["notes"]
    if "contact_name" in update_data:
        job.contact_name = update_data["contact_name"]
    if "contact_email" in update_data:
        job.contact_email = update_data["contact_email"]
    if "contact_phone" in update_data:
        job.contact_phone = update_data["contact_phone"]

    await db.flush()
    await db.refresh(job)
    return _to_job_response(job)


@router.delete(
    "/{job_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a job posting entry",
)
async def delete_job(
    job_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    """Deletes a job posting and its pipeline tracking record for the authenticated user."""
    stmt = select(Job).where(
        Job.id == job_id,
        Job.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    job = result.scalar_one_or_none()

    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    await db.delete(job)
    await db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
