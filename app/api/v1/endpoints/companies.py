from collections.abc import Sequence
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.company import CompanyWorked, EmploymentType
from app.models.user import User
from app.schemas.company import (
    CompanyWorkedCreate,
    CompanyWorkedResponse,
    CompanyWorkedUpdate,
)

router = APIRouter()


@router.get(
    "",
    response_model=list[CompanyWorkedResponse],
    summary="List all companies worked in for current user",
)
async def list_my_companies(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    actively_working: Annotated[
        bool | None,
        Query(description="Filter by actively working status"),
    ] = None,
    employment_type: Annotated[
        EmploymentType | None,
        Query(description="Filter by employment type (full_time, part_time, etc.)"),
    ] = None,
) -> Sequence[CompanyWorked]:
    """Returns all companies worked in by the authenticated user."""
    stmt = select(CompanyWorked).where(CompanyWorked.user_id == current_user.id)
    if actively_working is not None:
        stmt = stmt.where(CompanyWorked.actively_working == actively_working)
    if employment_type is not None:
        stmt = stmt.where(CompanyWorked.employment_type == employment_type.value)

    stmt = stmt.order_by(
        CompanyWorked.start_date.desc(),
        CompanyWorked.created_at.desc(),
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post(
    "",
    response_model=CompanyWorkedResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a new company worked in",
)
async def create_company(
    data: CompanyWorkedCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CompanyWorked:
    """Creates a new company worked in entry for the authenticated user."""
    company = CompanyWorked(
        user_id=current_user.id,
        company_name=data.company_name,
        employment_type=(
            data.employment_type.value
            if isinstance(data.employment_type, EmploymentType)
            else str(data.employment_type)
        ),
        start_date=data.start_date,
        end_date=None if data.actively_working else data.end_date,
        actively_working=data.actively_working,
    )
    db.add(company)
    await db.flush()
    await db.refresh(company)
    return company



@router.get(
    "/{company_id}",
    response_model=CompanyWorkedResponse,
    summary="Get company worked in by ID",
)
async def get_company_by_id(
    company_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CompanyWorked:
    """Returns a specific company worked in record belonging to the authenticated user."""
    stmt = select(CompanyWorked).where(
        CompanyWorked.id == company_id,
        CompanyWorked.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    company = result.scalar_one_or_none()

    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found",
        )
    return company


@router.patch(
    "/{company_id}",
    response_model=CompanyWorkedResponse,
    summary="Partially update a company worked in entry",
)
async def update_company(
    company_id: int,
    data: CompanyWorkedUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CompanyWorked:
    """Updates fields of an existing company worked in entry belonging to the authenticated user."""
    stmt = select(CompanyWorked).where(
        CompanyWorked.id == company_id,
        CompanyWorked.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    company = result.scalar_one_or_none()

    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found",
        )

    update_data = data.model_dump(exclude_unset=True)

    # Determine effective states for date consistency check
    effective_start_date = update_data.get("start_date", company.start_date)
    effective_actively_working = update_data.get(
        "actively_working", company.actively_working
    )
    effective_end_date = (
        None
        if effective_actively_working
        else update_data.get("end_date", company.end_date)
    )

    if (
        not effective_actively_working
        and effective_end_date is not None
        and effective_end_date < effective_start_date
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="End date cannot be earlier than start date",
        )

    if "company_name" in update_data and update_data["company_name"] is not None:
        company.company_name = update_data["company_name"]
    if "employment_type" in update_data and update_data["employment_type"] is not None:
        company.employment_type = (
            update_data["employment_type"].value
            if isinstance(update_data["employment_type"], EmploymentType)
            else str(update_data["employment_type"])
        )
    if "start_date" in update_data and update_data["start_date"] is not None:
        company.start_date = update_data["start_date"]
    if "actively_working" in update_data and update_data["actively_working"] is not None:
        company.actively_working = update_data["actively_working"]
        if company.actively_working:
            company.end_date = None
    if "end_date" in update_data:
        if not company.actively_working:
            company.end_date = update_data["end_date"]
        else:
            company.end_date = None


    await db.flush()
    await db.refresh(company)
    return company


@router.delete(
    "/{company_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a company worked in entry",
)
async def delete_company(
    company_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    """Deletes a company worked in entry for the authenticated user."""
    stmt = select(CompanyWorked).where(
        CompanyWorked.id == company_id,
        CompanyWorked.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    company = result.scalar_one_or_none()

    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found",
        )

    await db.delete(company)
    await db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
