from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.preference import PreferenceImportance


class PreferenceBase(BaseModel):
    """Base schema for user preference attributes."""

    title: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Title or summary of the career preference",
    )
    description: str | None = Field(
        None,
        max_length=2000,
        description="Detailed description or context for this preference",
    )
    importance: PreferenceImportance = Field(
        default=PreferenceImportance.MEDIUM,
        description="Importance level (low, medium, high, critical)",
    )

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Title cannot be empty or only whitespace")
        if len(stripped) > 255:
            raise ValueError("Title must not exceed 255 characters")
        return stripped

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str | None) -> str | None:
        if v is None:
            return None
        stripped = v.strip()
        if not stripped:
            return None
        if len(stripped) > 2000:
            raise ValueError("Description must not exceed 2000 characters")
        return stripped

    @field_validator("importance", mode="before")
    @classmethod
    def normalize_importance(cls, v: Any) -> Any:
        if isinstance(v, str):
            normalized = v.strip().lower()
            alias_map = {
                "must_have": PreferenceImportance.CRITICAL.value,
                "must-have": PreferenceImportance.CRITICAL.value,
                "nice_to_have": PreferenceImportance.LOW.value,
                "nice-to-have": PreferenceImportance.LOW.value,
            }
            if normalized in alias_map:
                return alias_map[normalized]
            return normalized
        return v


class PreferenceCreate(PreferenceBase):
    """Schema for creating a new user preference."""

    pass


class PreferenceUpdate(BaseModel):
    """Schema for updating an existing user preference."""

    title: str | None = Field(
        None,
        min_length=1,
        max_length=255,
        description="Updated title",
    )
    description: str | None = Field(
        None,
        max_length=2000,
        description="Updated description",
    )
    importance: PreferenceImportance | None = Field(
        None,
        description="Updated importance level",
    )

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str | None) -> str | None:
        if v is None:
            return None
        stripped = v.strip()
        if not stripped:
            raise ValueError("Title cannot be empty or only whitespace")
        if len(stripped) > 255:
            raise ValueError("Title must not exceed 255 characters")
        return stripped

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str | None) -> str | None:
        if v is None:
            return None
        stripped = v.strip()
        if not stripped:
            return None
        if len(stripped) > 2000:
            raise ValueError("Description must not exceed 2000 characters")
        return stripped

    @field_validator("importance", mode="before")
    @classmethod
    def normalize_importance(cls, v: Any) -> Any:
        if v is None:
            return None
        if isinstance(v, str):
            normalized = v.strip().lower()
            alias_map = {
                "must_have": PreferenceImportance.CRITICAL.value,
                "must-have": PreferenceImportance.CRITICAL.value,
                "nice_to_have": PreferenceImportance.LOW.value,
                "nice-to-have": PreferenceImportance.LOW.value,
            }
            if normalized in alias_map:
                return alias_map[normalized]
            return normalized
        return v


class PreferenceResponse(BaseModel):
    """Schema for returning user preference details."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    title: str
    description: str | None = None
    importance: PreferenceImportance
    created_at: datetime
    updated_at: datetime
