from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.profile import ProfileResponse, ProfileUpdate

router = APIRouter()


async def _check_email_conflict(
    email: str,
    user_id: int,
    db: AsyncSession,
) -> None:
    """Checks whether the requested email is already used by another account."""
    stmt = select(User).where(User.email == email, User.id != user_id)
    result = await db.execute(stmt)
    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email address already exists",
        )


@router.get(
    "",
    response_model=ProfileResponse,
    summary="Get current user profile",
)
async def get_my_profile(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Returns the profile of the currently authenticated user."""
    return current_user


@router.patch(
    "",
    response_model=ProfileResponse,
    summary="Partially update current user profile",
)
async def patch_my_profile(
    data: ProfileUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Updates provided profile fields for the authenticated user."""
    update_data = data.model_dump(exclude_unset=True)

    if "email" in update_data and update_data["email"] is not None:
        new_email = update_data["email"]
        if new_email != current_user.email:
            await _check_email_conflict(new_email, current_user.id, db)
            current_user.email = new_email

    if "name" in update_data:
        current_user.name = update_data["name"]
    if "phone" in update_data:
        current_user.phone = update_data["phone"]
    if "socials" in update_data:
        current_user.socials = update_data["socials"]
    if "address" in update_data:
        current_user.address = update_data["address"]

    await db.flush()
    await db.refresh(current_user)
    return current_user

