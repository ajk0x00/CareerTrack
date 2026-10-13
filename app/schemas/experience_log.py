"""Pydantic schemas for Experience Log data validation and serialization."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ExperienceLogBase(BaseModel):
    """Base schema for Experience Log attributes."""

    company_name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Name of the company",
    )
    description: str = Field(
        ...,
        min_length=1,
        description="Description of the experience, responsibilities, and achievements",
    )

    @field_validator("company_name")
    @classmethod
    def validate_company_name(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Company name cannot be empty or only whitespace")
        if len(stripped) > 255:
            raise ValueError("Company name must not exceed 255 characters")
        return stripped

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Description cannot be empty or only whitespace")
        return stripped


class ExperienceLogCreate(ExperienceLogBase):
    """Schema for creating a new experience log entry."""

    pass


class ExperienceLogUpdate(BaseModel):
    """Schema for updating an existing experience log entry."""

    company_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
        description="Updated company name",
    )
    description: str | None = Field(
        default=None,
        min_length=1,
        description="Updated description",
    )

    @field_validator("company_name")
    @classmethod
    def validate_company_name(cls, v: str | None) -> str | None:
        if v is None:
            return None
        stripped = v.strip()
        if not stripped:
            raise ValueError("Company name cannot be empty or only whitespace")
        if len(stripped) > 255:
            raise ValueError("Company name must not exceed 255 characters")
        return stripped

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str | None) -> str | None:
        if v is None:
            return None
        stripped = v.strip()
        if not stripped:
            raise ValueError("Description cannot be empty or only whitespace")
        return stripped


class ExperienceLogResponse(BaseModel):
    """Schema for returning experience log details."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    company_name: str
    description: str
    created_at: datetime
    updated_at: datetime
