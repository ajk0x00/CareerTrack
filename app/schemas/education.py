from datetime import datetime
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class EducationBase(BaseModel):
    """Base schema for user education attributes."""

    degree: str = Field(
        ...,
        min_length=1,
        max_length=150,
        description="Degree type, for example B.Tech or M.Sc",
    )
    institution: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Name of the institution that awarded the degree",
    )
    cgpa: float = Field(
        ...,
        ge=0,
        le=99.99,
        description="Passing CGPA on the applicable scale",
    )

    @field_validator("degree")
    @classmethod
    def validate_degree(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Degree cannot be empty or only whitespace")
        if len(stripped) > 150:
            raise ValueError("Degree must not exceed 150 characters")
        return stripped

    @field_validator("institution")
    @classmethod
    def validate_institution(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Institution cannot be empty or only whitespace")
        if len(stripped) > 255:
            raise ValueError("Institution must not exceed 255 characters")
        return stripped


class EducationCreate(EducationBase):
    """Schema for creating a new education record."""

    pass


class EducationUpdate(BaseModel):
    """Schema for updating an existing education record."""

    degree: str | None = Field(
        None,
        min_length=1,
        max_length=150,
        description="Updated degree type",
    )
    institution: str | None = Field(
        None,
        min_length=1,
        max_length=255,
        description="Updated institution name",
    )
    cgpa: float | None = Field(
        None,
        ge=0,
        le=99.99,
        description="Updated CGPA",
    )

    @field_validator("degree")
    @classmethod
    def validate_degree(cls, v: str | None) -> str | None:
        if v is None:
            return None
        stripped = v.strip()
        if not stripped:
            raise ValueError("Degree cannot be empty or only whitespace")
        if len(stripped) > 150:
            raise ValueError("Degree must not exceed 150 characters")
        return stripped

    @field_validator("institution")
    @classmethod
    def validate_institution(cls, v: str | None) -> str | None:
        if v is None:
            return None
        stripped = v.strip()
        if not stripped:
            raise ValueError("Institution cannot be empty or only whitespace")
        if len(stripped) > 255:
            raise ValueError("Institution must not exceed 255 characters")
        return stripped

    @model_validator(mode="after")
    def validate_at_least_one_field(self) -> Self:
        if self.degree is None and self.institution is None and self.cgpa is None:
            raise ValueError("At least one field must be provided for update")
        return self


class EducationResponse(BaseModel):
    """Schema for returning education record details."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    degree: str
    institution: str
    cgpa: float
    created_at: datetime
    updated_at: datetime
