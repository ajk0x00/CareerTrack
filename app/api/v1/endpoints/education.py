from collections.abc import Sequence
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.education import Education
from app.models.user import User
from app.schemas.education import (
    EducationCreate,
    EducationResponse,
    EducationUpdate,
)

router = APIRouter()


@router.get(
    "",
    response_model=list[EducationResponse],
    summary="List all education records for current user",
)
async def list_my_education(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Sequence[Education]:
    """Returns all education records for the authenticated user, newest first."""
    stmt = (
        select(Education)
        .where(Education.user_id == current_user.id)
        .order_by(Education.created_at.desc(), Education.id.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post(
    "",
    response_model=EducationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new education record",
)
async def create_education(
    data: EducationCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Education:
    """Creates a new education record for the authenticated user."""
    education = Education(
        user_id=current_user.id,
        degree=data.degree,
        institution=data.institution,
        description=data.description,
        start_date=data.start_date,
        end_date=data.end_date,
    )
    db.add(education)
    await db.flush()
    await db.refresh(education)
    return education


@router.patch(
    "/{education_id}",
    response_model=EducationResponse,
    summary="Partially update an education record",
)
async def update_education(
    education_id: int,
    data: EducationUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Education:
    """Updates fields of an existing education record belonging to the authenticated user."""
    stmt = select(Education).where(
        Education.id == education_id,
        Education.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    education = result.scalar_one_or_none()

    if education is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Education record not found",
        )

    update_data = data.model_dump(exclude_unset=True)

    if "degree" in update_data and update_data["degree"] is not None:
        education.degree = update_data["degree"]
    if "institution" in update_data and update_data["institution"] is not None:
        education.institution = update_data["institution"]
    if "description" in update_data and update_data["description"] is not None:
        education.description = update_data["description"]
    if "start_date" in update_data and update_data["start_date"] is not None:
        education.start_date = update_data["start_date"]
    if "end_date" in update_data:
        education.end_date = update_data["end_date"]

    await db.flush()
    await db.refresh(education)
    return education


@router.delete(
    "/{education_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an education record",
)
async def delete_education(
    education_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    """Deletes an education record belonging to the authenticated user."""
    stmt = select(Education).where(
        Education.id == education_id,
        Education.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    education = result.scalar_one_or_none()

    if education is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Education record not found",
        )

    await db.delete(education)
    await db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
