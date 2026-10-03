from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.profile import ProfileCreate, ProfileResponse, ProfileUpdate

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


@router.post(
    "",
    response_model=ProfileResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create or initialize user profile",
)
async def create_or_initialize_profile(
    data: ProfileCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Initializes or sets the authenticated user's profile details."""
    if data.email is not None and data.email != current_user.email:
        await _check_email_conflict(data.email, current_user.id, db)
        current_user.email = data.email

    if data.name is not None:
        current_user.name = data.name
    if data.phone is not None:
        current_user.phone = data.phone
    if data.socials is not None:
        current_user.socials = data.socials
    if data.address is not None:
        current_user.address = data.address

    await db.flush()
    await db.refresh(current_user)
    return current_user


@router.put(
    "",
    response_model=ProfileResponse,
    summary="Update current user profile (full replacement)",
)
async def update_my_profile(
    data: ProfileUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Replaces all profile fields of the currently authenticated user."""
    if data.email is not None and data.email != current_user.email:
        await _check_email_conflict(data.email, current_user.id, db)
        current_user.email = data.email

    current_user.name = data.name
    current_user.phone = data.phone
    current_user.socials = data.socials
    current_user.address = data.address

    await db.flush()
    await db.refresh(current_user)
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


@router.delete(
    "",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Clear current user profile",
)
async def delete_my_profile(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    """Resets all optional profile details (name, phone, socials, address) for the current user."""
    current_user.name = None
    current_user.phone = None
    current_user.socials = None
    current_user.address = None

    await db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/{user_id}",
    response_model=ProfileResponse,
    summary="Get user profile by ID",
)
async def get_user_profile_by_id(
    user_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Returns a user profile by their ID."""
    if user_id == current_user.id:
        return current_user

    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user


@router.put(
    "/{user_id}",
    response_model=ProfileResponse,
    summary="Update user profile by ID",
)
async def update_user_profile_by_id(
    user_id: int,
    data: ProfileUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Updates user profile by ID (only permissible for own profile)."""
    if user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify another user's profile",
        )
    return await update_my_profile(data=data, current_user=current_user, db=db)


@router.patch(
    "/{user_id}",
    response_model=ProfileResponse,
    summary="Partially update user profile by ID",
)
async def patch_user_profile_by_id(
    user_id: int,
    data: ProfileUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Partially updates user profile by ID (only permissible for own profile)."""
    if user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify another user's profile",
        )
    return await patch_my_profile(data=data, current_user=current_user, db=db)


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Clear user profile by ID",
)
async def delete_user_profile_by_id(
    user_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    """Clears user profile by ID (only permissible for own profile)."""
    if user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify another user's profile",
        )
    return await delete_my_profile(current_user=current_user, db=db)
