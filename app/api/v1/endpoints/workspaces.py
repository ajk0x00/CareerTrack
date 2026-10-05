from collections.abc import Sequence
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.workspace import Workspace
from app.schemas.workspace import (
    WorkspaceCreate,
    WorkspaceResponse,
    WorkspaceUpdate,
)

router = APIRouter()


@router.get(
    "",
    response_model=list[WorkspaceResponse],
    summary="List all workspaces for current user",
)
async def list_my_workspaces(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    q: Annotated[
        str | None,
        Query(description="Search workspaces by name"),
    ] = None,
) -> Sequence[Workspace]:
    """Returns all workspaces belonging to the authenticated user."""
    stmt = select(Workspace).where(Workspace.user_id == current_user.id)
    if q is not None and q.strip():
        stmt = stmt.where(Workspace.name.ilike(f"%{q.strip()}%"))

    stmt = stmt.order_by(Workspace.created_at.asc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post(
    "",
    response_model=WorkspaceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new workspace",
)
async def create_workspace(
    data: WorkspaceCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Workspace:
    """Creates a new workspace for the authenticated user."""
    # Check for duplicate workspace name for this user (case-insensitive)
    dup_stmt = select(Workspace).where(
        Workspace.user_id == current_user.id,
        func.lower(Workspace.name) == data.name.lower(),
    )
    dup_res = await db.execute(dup_stmt)
    if dup_res.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A workspace named '{data.name}' already exists",
        )

    workspace = Workspace(
        user_id=current_user.id,
        name=data.name,
    )
    db.add(workspace)
    await db.flush()
    await db.refresh(workspace)
    return workspace


@router.get(
    "/{workspace_id}",
    response_model=WorkspaceResponse,
    summary="Get workspace by ID",
)
async def get_workspace_by_id(
    workspace_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Workspace:
    """Returns a specific workspace belonging to the authenticated user."""
    stmt = select(Workspace).where(
        Workspace.id == workspace_id,
        Workspace.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    workspace = result.scalar_one_or_none()

    if workspace is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found",
        )
    return workspace


@router.patch(
    "/{workspace_id}",
    response_model=WorkspaceResponse,
    summary="Partially update a workspace",
)
async def update_workspace(
    workspace_id: int,
    data: WorkspaceUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Workspace:
    """Updates fields of an existing workspace belonging to the authenticated user."""
    stmt = select(Workspace).where(
        Workspace.id == workspace_id,
        Workspace.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    workspace = result.scalar_one_or_none()

    if workspace is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found",
        )

    update_data = data.model_dump(exclude_unset=True)

    if "name" in update_data and update_data["name"] is not None:
        new_name = update_data["name"]
        # Check if another workspace with this name already exists for this user
        dup_stmt = select(Workspace).where(
            Workspace.user_id == current_user.id,
            func.lower(Workspace.name) == new_name.lower(),
            Workspace.id != workspace_id,
        )
        dup_res = await db.execute(dup_stmt)
        if dup_res.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A workspace named '{new_name}' already exists",
            )
        workspace.name = new_name

    await db.flush()
    await db.refresh(workspace)
    return workspace


@router.delete(
    "/{workspace_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a workspace",
)
async def delete_workspace(
    workspace_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    """Deletes a workspace for the authenticated user."""
    stmt = select(Workspace).where(
        Workspace.id == workspace_id,
        Workspace.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    workspace = result.scalar_one_or_none()

    if workspace is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found",
        )

    await db.delete(workspace)
    await db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
