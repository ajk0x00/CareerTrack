"""Authentication and authorization utilities for the CareerTrack MCP server.

Supports:
1. Client ID and Client Secret (API client credentials for MCP integrations).
2. Standard JWT Bearer tokens (user access tokens).
"""

import base64
from datetime import datetime, timezone
import os
from typing import Any

from fastapi import HTTPException
import jwt
from mcp.server.auth.provider import AccessToken, TokenVerifier
from mcp.server.mcpserver import Context
from mcp.server.mcpserver.exceptions import ToolError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token, verify_password
from app.models.api_client import ApiClient
from app.models.user import User


class CareerTrackTokenVerifier(TokenVerifier):
    """MCP TokenVerifier implementing standard Bearer token validation for CareerTrack."""

    async def verify_token(self, token: str) -> AccessToken | None:
        """Verifies JWT bearer token and returns an AccessToken or None if invalid."""
        try:
            payload = decode_access_token(token)
            sub = payload.get("sub")
            if not sub:
                return None
            return AccessToken(
                token=token,
                client_id="careertrack-client",
                scopes=["all"],
                subject=str(sub),
                expires_at=payload.get("exp"),
                claims=payload,
            )
        except (HTTPException, jwt.PyJWTError, Exception):
            return None


async def verify_client_credentials(
    session: AsyncSession,
    client_id: str,
    client_secret: str,
) -> User | None:
    """Verifies a Client ID and Client Secret pair and returns the matching active User."""
    stmt = select(ApiClient).where(
        ApiClient.client_id == client_id.strip(),
        ApiClient.is_active == True,  # noqa: E712
    )
    result = await session.execute(stmt)
    api_client = result.scalars().first()

    if not api_client:
        return None

    if not verify_password(client_secret.strip(), api_client.client_secret_hash):
        return None

    # Update last used timestamp
    api_client.last_used_at = datetime.now(timezone.utc)
    await session.flush()

    user = await session.get(User, api_client.user_id)
    if not user or not user.is_active:
        return None

    return user


def extract_client_credentials_from_request(
    client_id: str | None = None,
    client_secret: str | None = None,
    ctx: Context | None = None,
) -> tuple[str, str] | None:
    """Extracts Client ID and Secret from explicit args, MCP headers, or environment."""
    if client_id and client_secret:
        return client_id.strip(), client_secret.strip()

    if ctx is not None:
        try:
            headers = ctx.headers
            if headers:
                # 1. Custom headers
                cid = headers.get("x-client-id") or headers.get("X-Client-ID")
                csec = headers.get("x-client-secret") or headers.get("X-Client-Secret")
                if cid and csec:
                    return cid.strip(), csec.strip()

                # 2. Basic Auth: Authorization: Basic <base64(client_id:client_secret)>
                auth_header = headers.get("authorization") or headers.get("Authorization")
                if auth_header and auth_header.lower().startswith("basic "):
                    encoded = auth_header[6:].strip()
                    try:
                        decoded = base64.b64decode(encoded).decode("utf-8")
                        if ":" in decoded:
                            cid, csec = decoded.split(":", 1)
                            return cid.strip(), csec.strip()
                    except Exception:
                        pass
        except Exception:
            pass

    # 3. Environment variables
    env_cid = os.environ.get("CAREERTRACK_CLIENT_ID") or os.environ.get("CLIENT_ID")
    env_csec = os.environ.get("CAREERTRACK_CLIENT_SECRET") or os.environ.get("CLIENT_SECRET")
    if env_cid and env_csec:
        return env_cid.strip(), env_csec.strip()

    return None


def extract_token_from_request(
    auth_token: str | None = None,
    ctx: Context | None = None,
) -> str | None:
    """Extracts bearer token from explicit argument, MCP context headers, or environment."""
    if auth_token and auth_token.strip():
        token = auth_token.strip()
        if token.lower().startswith("bearer "):
            return token[7:].strip()
        return token

    if ctx is not None:
        try:
            headers = ctx.headers
            if headers:
                auth_header = headers.get("authorization") or headers.get("Authorization")
                if auth_header and auth_header.lower().startswith("bearer "):
                    return auth_header[7:].strip()
        except Exception:
            pass

    env_token = os.environ.get("CAREERTRACK_AUTH_TOKEN") or os.environ.get("AUTH_TOKEN")
    if env_token and env_token.strip():
        val = env_token.strip()
        if val.lower().startswith("bearer "):
            return val[7:].strip()
        return val

    return None


async def resolve_user(
    session: AsyncSession,
    auth_token: str | None = None,
    client_id: str | None = None,
    client_secret: str | None = None,
    ctx: Context | None = None,
) -> User:
    """Resolves and validates the authenticated User from Client ID & Secret or Bearer Token.

    Raises ToolError if credentials are missing, invalid, expired, or user not found/inactive.
    """
    # 1. Try Client ID and Secret first
    client_creds = extract_client_credentials_from_request(
        client_id=client_id,
        client_secret=client_secret,
        ctx=ctx,
    )
    if client_creds is not None:
        cid, csec = client_creds
        user = await verify_client_credentials(session, cid, csec)
        if user is None:
            raise ToolError("Authentication failed: Invalid Client ID or Client Secret.")
        return user

    # 2. Try Bearer Token
    token = extract_token_from_request(auth_token=auth_token, ctx=ctx)
    if not token:
        raise ToolError(
            "Authentication required: Please provide Client ID and Client Secret "
            "(via CAREERTRACK_CLIENT_ID & CAREERTRACK_CLIENT_SECRET, 'X-Client-ID' & 'X-Client-Secret' headers, "
            "or 'Authorization: Basic <base64>') or a valid JWT bearer token via CAREERTRACK_AUTH_TOKEN."
        )

    try:
        payload = decode_access_token(token)
    except HTTPException as exc:
        raise ToolError(f"Authentication failed: {exc.detail}") from exc
    except Exception as exc:
        raise ToolError(f"Authentication failed: Invalid access token ({exc})") from exc

    sub = payload.get("sub")
    if not sub:
        raise ToolError("Authentication failed: Token missing subject claim.")

    try:
        user_id = int(sub)
    except ValueError:
        raise ToolError("Authentication failed: Invalid subject claim in token.") from None

    user = await session.get(User, user_id)
    if user is None:
        raise ToolError(f"Authentication failed: User with ID {user_id} does not exist.")

    if not user.is_active:
        raise ToolError("Authentication failed: User account is inactive.")

    return user
