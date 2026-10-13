"""API endpoints for Experience Log management."""

from collections.abc import Sequence
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.company import CompanyWorked
from app.models.experience_log import ExperienceLog
from app.models.user import User
from app.schemas.experience_log import (
    ExperienceLogCreate,
    ExperienceLogResponse,
    ExperienceLogUpdate,
)

router = APIRouter()


@router.get(
    "",
    response_model=list[ExperienceLogResponse],
    summary="List all experience logs for current user",
)
async def list_my_experience_logs(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    company_id: Annotated[
        int | None,
        Query(description="Filter experience logs by company ID"),
    ] = None,
    company_name: Annotated[
        str | None,
        Query(description="Filter experience logs by company name"),
    ] = None,
) -> Sequence[ExperienceLog]:
    """Returns all experience logs recorded for the authenticated user."""
    stmt = select(ExperienceLog).where(ExperienceLog.user_id == current_user.id)
    if company_id is not None:
        stmt = stmt.where(ExperienceLog.company_id == company_id)
    if company_name is not None and company_name.strip():
        stmt = stmt.join(CompanyWorked).where(
            CompanyWorked.company_name.ilike(f"%{company_name.strip()}%")
        )

    stmt = stmt.order_by(ExperienceLog.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post(
    "",
    response_model=ExperienceLogResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new experience log entry",
)
async def create_experience_log(
    data: ExperienceLogCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ExperienceLog:
    """Creates a new experience log entry for the authenticated user."""
    # Validate company belongs to current user
    company_stmt = select(CompanyWorked).where(
        CompanyWorked.id == data.company_id,
        CompanyWorked.user_id == current_user.id,
    )
    company_res = await db.execute(company_stmt)
    company = company_res.scalar_one_or_none()
    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found or does not belong to user",
        )

    experience_log = ExperienceLog(
        user_id=current_user.id,
        company_id=data.company_id,
        description=data.description,
    )
    db.add(experience_log)
    await db.flush()
    await db.refresh(experience_log)
    return experience_log


@router.get(
    "/{experience_id}",
    response_model=ExperienceLogResponse,
    summary="Get experience log by ID",
)
async def get_experience_log_by_id(
    experience_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ExperienceLog:
    """Returns a specific experience log record belonging to the authenticated user."""
    stmt = select(ExperienceLog).where(
        ExperienceLog.id == experience_id,
        ExperienceLog.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    experience_log = result.scalar_one_or_none()

    if experience_log is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Experience log not found",
        )
    return experience_log


@router.patch(
    "/{experience_id}",
    response_model=ExperienceLogResponse,
    summary="Update an existing experience log entry",
)
async def update_experience_log(
    experience_id: int,
    data: ExperienceLogUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ExperienceLog:
    """Updates fields of an existing experience log entry."""
    stmt = select(ExperienceLog).where(
        ExperienceLog.id == experience_id,
        ExperienceLog.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    experience_log = result.scalar_one_or_none()

    if experience_log is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Experience log not found",
        )

    if data.company_id is not None:
        company_stmt = select(CompanyWorked).where(
            CompanyWorked.id == data.company_id,
            CompanyWorked.user_id == current_user.id,
        )
        company_res = await db.execute(company_stmt)
        if company_res.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Company not found or does not belong to user",
            )
        experience_log.company_id = data.company_id
    if data.description is not None:
        experience_log.description = data.description

    await db.flush()
    await db.refresh(experience_log)
    return experience_log


@router.delete(
    "/{experience_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an experience log entry",
)
async def delete_experience_log(
    experience_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    """Deletes an experience log entry belonging to the authenticated user."""
    stmt = select(ExperienceLog).where(
        ExperienceLog.id == experience_id,
        ExperienceLog.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    experience_log = result.scalar_one_or_none()

    if experience_log is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Experience log not found",
        )

    await db.delete(experience_log)
    await db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
