"""API Client management endpoints for MCP and third-party integrations."""

import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.security import hash_password
from app.models.api_client import ApiClient
from app.models.user import User
from app.schemas.api_client import (
    ApiClientCreate,
    ApiClientCreateResponse,
    ApiClientResponse,
)

router = APIRouter()


def generate_client_credentials() -> tuple[str, str, str, str]:
    """Generates a secure Client ID and Client Secret pair.

    Returns:
        tuple of (client_id, raw_client_secret, client_secret_hash, client_secret_prefix)
    """
    client_id = f"ct_live_{secrets.token_hex(16)}"
    raw_secret = f"ct_sec_{secrets.token_urlsafe(32)}"
    secret_hash = hash_password(raw_secret)
    secret_prefix = f"{raw_secret[:12]}..."
    return client_id, raw_secret, secret_hash, secret_prefix


@router.get(
    "",
    response_model=list[ApiClientResponse],
    summary="List all API clients",
    description="Returns all active and inactive API client credentials created by the authenticated user.",
)
async def list_api_clients(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[ApiClient]:
    """Retrieve all API credentials owned by the current user."""
    stmt = (
        select(ApiClient)
        .where(ApiClient.user_id == current_user.id)
        .order_by(ApiClient.created_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post(
    "",
    response_model=ApiClientCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new API client credential",
    description=(
        "Generates a new Client ID and Client Secret pair. "
        "The raw secret is only returned ONCE in this response."
    ),
)
async def create_api_client(
    payload: ApiClientCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ApiClientCreateResponse:
    """Generate a new Client ID and Secret pair for the current user."""
    client_id, raw_secret, secret_hash, secret_prefix = generate_client_credentials()

    client = ApiClient(
        user_id=current_user.id,
        name=payload.name.strip(),
        client_id=client_id,
        client_secret_hash=secret_hash,
        client_secret_prefix=secret_prefix,
        is_active=True,
    )
    db.add(client)
    await db.flush()
    await db.refresh(client)

    return ApiClientCreateResponse(
        id=client.id,
        name=client.name,
        client_id=client.client_id,
        client_secret=raw_secret,
        client_secret_prefix=client.client_secret_prefix,
        is_active=client.is_active,
        last_used_at=client.last_used_at,
        created_at=client.created_at,
    )


@router.delete(
    "/{client_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke an API client",
    description="Permanently revokes and deletes an API client credential by its Client ID.",
)
async def revoke_api_client(
    client_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Permanently delete and revoke an API client credential."""
    stmt = select(ApiClient).where(
        ApiClient.client_id == client_id,
        ApiClient.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    client = result.scalars().first()

    if client is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"API client '{client_id}' not found.",
        )

    await db.delete(client)
    await db.flush()
