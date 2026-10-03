from collections.abc import Sequence
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.preference import Preference, PreferenceImportance
from app.models.user import User
from app.schemas.preference import (
    PreferenceCreate,
    PreferenceResponse,
    PreferenceUpdate,
)

router = APIRouter()


@router.get(
    "",
    response_model=list[PreferenceResponse],
    summary="List all preferences for current user",
)
async def list_my_preferences(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    importance: Annotated[
        PreferenceImportance | None,
        Query(description="Filter preferences by importance level"),
    ] = None,
) -> Sequence[Preference]:
    """Returns all career preferences for the authenticated user."""
    stmt = select(Preference).where(Preference.user_id == current_user.id)
    if importance is not None:
        stmt = stmt.where(Preference.importance == importance.value)

    stmt = stmt.order_by(Preference.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post(
    "",
    response_model=PreferenceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user preference",
)
async def create_preference(
    data: PreferenceCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Preference:
    """Creates a new career preference entry for the authenticated user."""
    preference = Preference(
        user_id=current_user.id,
        title=data.title,
        description=data.description,
        importance=data.importance.value,
    )
    db.add(preference)
    await db.flush()
    await db.refresh(preference)
    return preference


@router.get(
    "/{preference_id}",
    response_model=PreferenceResponse,
    summary="Get user preference by ID",
)
async def get_preference_by_id(
    preference_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Preference:
    """Returns a specific preference belonging to the authenticated user."""
    stmt = select(Preference).where(
        Preference.id == preference_id,
        Preference.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    preference = result.scalar_one_or_none()

    if preference is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Preference not found",
        )
    return preference


@router.patch(
    "/{preference_id}",
    response_model=PreferenceResponse,
    summary="Partially update a user preference",
)
async def update_preference(
    preference_id: int,
    data: PreferenceUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Preference:
    """Updates fields of an existing preference belonging to the authenticated user."""
    stmt = select(Preference).where(
        Preference.id == preference_id,
        Preference.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    preference = result.scalar_one_or_none()

    if preference is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Preference not found",
        )

    update_data = data.model_dump(exclude_unset=True)

    if "title" in update_data and update_data["title"] is not None:
        preference.title = update_data["title"]
    if "description" in update_data:
        preference.description = update_data["description"]
    if "importance" in update_data and update_data["importance"] is not None:
        preference.importance = (
            update_data["importance"].value
            if isinstance(update_data["importance"], PreferenceImportance)
            else str(update_data["importance"])
        )

    await db.flush()
    await db.refresh(preference)
    return preference


@router.delete(
    "/{preference_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a user preference",
)
async def delete_preference(
    preference_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    """Deletes a career preference entry for the authenticated user."""
    stmt = select(Preference).where(
        Preference.id == preference_id,
        Preference.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    preference = result.scalar_one_or_none()

    if preference is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Preference not found",
        )

    await db.delete(preference)
    await db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
