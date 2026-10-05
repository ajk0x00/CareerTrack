"""Pydantic schemas for API Client credentials (Client ID and Secret)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ApiClientCreate(BaseModel):
    """Schema for creating a new API Client credential."""

    name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Descriptive name for this client (e.g. 'Claude Desktop', 'Cursor IDE')",
        examples=["Claude Desktop"],
    )


class ApiClientResponse(BaseModel):
    """Schema for returning API Client details (excluding raw secret)."""

    id: int
    name: str
    client_id: str
    client_secret_prefix: str
    is_active: bool
    last_used_at: datetime | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ApiClientCreateResponse(ApiClientResponse):
    """Schema returned once upon creation containing the raw client secret."""

    client_secret: str = Field(
        ...,
        description="The unhashed client secret. Stored hashed; this will NEVER be shown again.",
    )
