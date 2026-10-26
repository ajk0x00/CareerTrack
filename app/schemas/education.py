from datetime import date, datetime
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
    description: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Free-form description with every extra detail about the entry",
    )
    start_date: date = Field(
        ...,
        description="Date the qualification started",
    )
    end_date: date | None = Field(
        default=None,
        description="Date the qualification ended; null while still studying",
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

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Description cannot be empty or only whitespace")
        if len(stripped) > 2000:
            raise ValueError("Description must not exceed 2000 characters")
        return stripped

    @model_validator(mode="after")
    def validate_date_range(self) -> Self:
        if self.end_date is not None and self.end_date < self.start_date:
            raise ValueError("End date cannot be earlier than start date")
        return self


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
    description: str | None = Field(
        None,
        min_length=1,
        max_length=2000,
        description="Updated free-form description",
    )
    start_date: date | None = Field(
        None,
        description="Updated start date",
    )
    end_date: date | None = Field(
        None,
        description="Updated end date; null while still studying",
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

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str | None) -> str | None:
        if v is None:
            return None
        stripped = v.strip()
        if not stripped:
            raise ValueError("Description cannot be empty or only whitespace")
        if len(stripped) > 2000:
            raise ValueError("Description must not exceed 2000 characters")
        return stripped

    @model_validator(mode="after")
    def validate_update_fields(self) -> Self:
        if (
            self.degree is None
            and self.institution is None
            and self.description is None
            and self.start_date is None
            and self.end_date is None
        ):
            raise ValueError("At least one field must be provided for update")
        if (
            self.start_date is not None
            and self.end_date is not None
            and self.end_date < self.start_date
        ):
            raise ValueError("End date cannot be earlier than start date")
        return self


class EducationResponse(BaseModel):
    """Schema for returning education record details."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    degree: str
    institution: str
    description: str
    start_date: date | None
    end_date: date | None
    created_at: datetime
    updated_at: datetime
