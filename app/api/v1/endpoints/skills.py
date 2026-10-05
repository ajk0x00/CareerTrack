from collections.abc import Sequence
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.skill import Skill, SkillProficiency
from app.models.user import User
from app.schemas.skill import (
    SkillCreate,
    SkillResponse,
    SkillUpdate,
)

router = APIRouter()


@router.get(
    "",
    response_model=list[SkillResponse],
    summary="List all skills for current user",
)
async def list_my_skills(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    proficiency: Annotated[
        SkillProficiency | None,
        Query(description="Filter skills by proficiency level"),
    ] = None,
    q: Annotated[
        str | None,
        Query(description="Search skills by name"),
    ] = None,
) -> Sequence[Skill]:
    """Returns all skills recorded for the authenticated user."""
    stmt = select(Skill).where(Skill.user_id == current_user.id)
    if proficiency is not None:
        stmt = stmt.where(Skill.proficiency == proficiency.value)
    if q is not None and q.strip():
        stmt = stmt.where(Skill.name.ilike(f"%{q.strip()}%"))

    stmt = stmt.order_by(Skill.name.asc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post(
    "",
    response_model=SkillResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user skill",
)
async def create_skill(
    data: SkillCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Skill:
    """Creates a new skill entry for the authenticated user."""
    # Check for duplicate skill name for this user (case-insensitive)
    dup_stmt = select(Skill).where(
        Skill.user_id == current_user.id,
        func.lower(Skill.name) == data.name.lower(),
    )
    dup_res = await db.execute(dup_stmt)
    if dup_res.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A skill named '{data.name}' already exists in your profile",
        )

    skill = Skill(
        user_id=current_user.id,
        name=data.name,
        proficiency=(
            data.proficiency.value
            if isinstance(data.proficiency, SkillProficiency)
            else str(data.proficiency)
        ),
    )
    db.add(skill)
    await db.flush()
    await db.refresh(skill)
    return skill


@router.get(
    "/{skill_id}",
    response_model=SkillResponse,
    summary="Get user skill by ID",
)
async def get_skill_by_id(
    skill_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Skill:
    """Returns a specific skill belonging to the authenticated user."""
    stmt = select(Skill).where(
        Skill.id == skill_id,
        Skill.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    skill = result.scalar_one_or_none()

    if skill is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Skill not found",
        )
    return skill


@router.patch(
    "/{skill_id}",
    response_model=SkillResponse,
    summary="Partially update a user skill",
)
async def update_skill(
    skill_id: int,
    data: SkillUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Skill:
    """Updates fields of an existing skill belonging to the authenticated user."""
    stmt = select(Skill).where(
        Skill.id == skill_id,
        Skill.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    skill = result.scalar_one_or_none()

    if skill is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Skill not found",
        )

    update_data = data.model_dump(exclude_unset=True)

    if "name" in update_data and update_data["name"] is not None:
        new_name = update_data["name"]
        # Check if another skill with this name already exists for this user
        dup_stmt = select(Skill).where(
            Skill.user_id == current_user.id,
            func.lower(Skill.name) == new_name.lower(),
            Skill.id != skill_id,
        )
        dup_res = await db.execute(dup_stmt)
        if dup_res.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A skill named '{new_name}' already exists in your profile",
            )
        skill.name = new_name

    if "proficiency" in update_data and update_data["proficiency"] is not None:
        skill.proficiency = (
            update_data["proficiency"].value
            if isinstance(update_data["proficiency"], SkillProficiency)
            else str(update_data["proficiency"])
        )

    await db.flush()
    await db.refresh(skill)
    return skill


@router.delete(
    "/{skill_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a user skill",
)
async def delete_skill(
    skill_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    """Deletes a skill entry for the authenticated user."""
    stmt = select(Skill).where(
        Skill.id == skill_id,
        Skill.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    skill = result.scalar_one_or_none()

    if skill is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Skill not found",
        )

    await db.delete(skill)
    await db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
