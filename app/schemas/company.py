from datetime import date, datetime
from typing import Any, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.company import EmploymentType


class CompanyWorkedBase(BaseModel):
    """Base schema for company worked in attributes."""

    company_name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Name of the company worked in",
    )
    employment_type: EmploymentType = Field(
        default=EmploymentType.FULL_TIME,
        description="Type of employment (full_time, part_time, contract, internship)",
    )
    start_date: date = Field(
        ...,
        description="Start date of employment",
    )
    end_date: date | None = Field(
        default=None,
        description="End date of employment (optional or omitted if actively working)",
    )
    actively_working: bool = Field(
        default=False,
        description="Whether user is currently working at this company",
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

    @field_validator("employment_type", mode="before")
    @classmethod
    def normalize_employment_type(cls, v: Any) -> Any:
        if isinstance(v, str):
            return v.strip().lower().replace("-", "_").replace(" ", "_")
        return v

    @model_validator(mode="after")
    def validate_dates(self) -> Self:
        if self.actively_working:
            self.end_date = None
        elif self.end_date is not None and self.end_date < self.start_date:
            raise ValueError("End date cannot be earlier than start date")
        return self


class CompanyWorkedCreate(CompanyWorkedBase):
    """Schema for creating a new company worked in record."""

    pass


class CompanyWorkedUpdate(BaseModel):
    """Schema for updating an existing company worked in record."""

    company_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
        description="Updated company name",
    )
    employment_type: EmploymentType | None = Field(
        default=None,
        description="Updated type of employment",
    )
    start_date: date | None = Field(
        default=None,
        description="Updated start date",
    )
    end_date: date | None = Field(
        default=None,
        description="Updated end date",
    )
    actively_working: bool | None = Field(
        default=None,
        description="Updated actively working status",
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

    @field_validator("employment_type", mode="before")
    @classmethod
    def normalize_employment_type(cls, v: Any) -> Any:
        if v is None:
            return None
        if isinstance(v, str):
            return v.strip().lower().replace("-", "_").replace(" ", "_")
        return v

    @model_validator(mode="after")
    def validate_dates(self) -> Self:
        if self.actively_working is True:
            self.end_date = None
        elif (
            self.actively_working is False
            and self.start_date is not None
            and self.end_date is not None
            and self.end_date < self.start_date
        ):
            raise ValueError("End date cannot be earlier than start date")
        elif (
            self.start_date is not None
            and self.end_date is not None
            and self.end_date < self.start_date
        ):
            raise ValueError("End date cannot be earlier than start date")
        return self


class CompanyWorkedResponse(BaseModel):
    """Schema for returning company worked in details."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    company_name: str
    employment_type: EmploymentType
    start_date: date
    end_date: date | None = None
    actively_working: bool
    created_at: datetime
    updated_at: datetime
