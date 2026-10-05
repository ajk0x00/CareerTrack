from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class WorkspaceBase(BaseModel):
    """Base schema for workspace attributes."""

    name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Name of the workspace",
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Workspace name cannot be empty or only whitespace")
        if len(stripped) > 100:
            raise ValueError("Workspace name must not exceed 100 characters")
        return stripped


class WorkspaceCreate(WorkspaceBase):
    """Schema for creating a new workspace."""

    pass


class WorkspaceUpdate(BaseModel):
    """Schema for updating an existing workspace."""

    name: str | None = Field(
        None,
        min_length=1,
        max_length=100,
        description="Updated workspace name",
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str | None) -> str | None:
        if v is None:
            return None
        stripped = v.strip()
        if not stripped:
            raise ValueError("Workspace name cannot be empty or only whitespace")
        if len(stripped) > 100:
            raise ValueError("Workspace name must not exceed 100 characters")
        return stripped


class WorkspaceResponse(BaseModel):
    """Schema for returning workspace details."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    name: str
    created_at: datetime
    updated_at: datetime
