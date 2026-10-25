"""Pydantic schemas for Job postings and pipeline tracking."""

from datetime import date, datetime
from enum import StrEnum
from typing import Any, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.company import EmploymentType
from app.models.job import JobStatus, WorkplaceType


class SalaryInterval(StrEnum):
    """Salary payment interval."""

    YEARLY = "yearly"
    MONTHLY = "monthly"
    HOURLY = "hourly"


class JobBase(BaseModel):
    """Base schema for job posting and pipeline attributes."""

    title: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Job title or role",
    )
    company_name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Name of the company offering the position",
    )
    job_url: str | None = Field(
        default=None,
        max_length=1024,
        description="Link to the original job posting or application page",
    )
    location: str | None = Field(
        default=None,
        max_length=255,
        description="Job location (e.g. city, state, country, or remote)",
    )
    workplace_type: WorkplaceType | None = Field(
        default=None,
        description="Workplace policy: remote, hybrid, or on_site",
    )
    employment_type: EmploymentType | None = Field(
        default=None,
        description="Employment type: full_time, part_time, contract, internship",
    )
    department: str | None = Field(
        default=None,
        max_length=255,
        description="Department or team within the organization",
    )
    description: str | None = Field(
        default=None,
        description="Full text of the job description and responsibilities",
    )
    requirements: str | None = Field(
        default=None,
        description="Key skills, qualifications, or requirements specified",
    )
    salary_min: float | None = Field(
        default=None,
        ge=0,
        description="Minimum compensation figure",
    )
    salary_max: float | None = Field(
        default=None,
        ge=0,
        description="Maximum compensation figure",
    )
    salary_currency: str = Field(
        default="USD",
        max_length=10,
        description="Currency code for salary (e.g. USD, EUR, GBP)",
    )
    salary_interval: SalaryInterval | None = Field(
        default=SalaryInterval.YEARLY,
        description="Compensation frequency: yearly, monthly, or hourly",
    )
    posted_date: date | None = Field(
        default=None,
        description="Date the job was posted by the employer",
    )
    deadline_date: date | None = Field(
        default=None,
        description="Application closing or deadline date",
    )
    status: JobStatus = Field(
        default=JobStatus.SAVED,
        description="Current state of the job in the application pipeline",
    )
    current_stage: str | None = Field(
        default=None,
        max_length=100,
        description="Specific interview stage (e.g. Recruiter Screen, Technical Round, System Design)",
    )
    applied_date: date | None = Field(
        default=None,
        description="Date the application was submitted",
    )
    excitement_rating: int | None = Field(
        default=None,
        ge=1,
        le=5,
        description="Applicant excitement or priority rating (1 to 5)",
    )
    notes: str | None = Field(
        default=None,
        description="Private notes, interview impressions, or follow-ups",
    )
    contact_name: str | None = Field(
        default=None,
        max_length=255,
        description="Recruiter or hiring manager name",
    )
    contact_email: str | None = Field(
        default=None,
        max_length=255,
        description="Recruiter or hiring manager email",
    )
    contact_phone: str | None = Field(
        default=None,
        max_length=50,
        description="Recruiter or contact phone number",
    )

    @field_validator("title", "company_name")
    @classmethod
    def validate_non_empty_strings(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Field cannot be empty or only whitespace")
        return stripped

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, v: Any) -> Any:
        if isinstance(v, str):
            normalized = v.strip().lower().replace("-", "_").replace(" ", "_")
            return normalized
        return v

    @field_validator("workplace_type", mode="before")
    @classmethod
    def normalize_workplace_type(cls, v: Any) -> Any:
        if isinstance(v, str):
            normalized = v.strip().lower().replace("-", "_").replace(" ", "_")
            return normalized
        return v

    @field_validator("employment_type", mode="before")
    @classmethod
    def normalize_employment_type(cls, v: Any) -> Any:
        if isinstance(v, str):
            normalized = v.strip().lower().replace("-", "_").replace(" ", "_")
            return normalized
        return v

    @field_validator("salary_interval", mode="before")
    @classmethod
    def normalize_salary_interval(cls, v: Any) -> Any:
        if isinstance(v, str):
            normalized = v.strip().lower().replace("-", "_").replace(" ", "_")
            return normalized
        return v

    @model_validator(mode="after")
    def validate_cross_field_rules(self) -> Self:
        if (
            self.salary_min is not None
            and self.salary_max is not None
            and self.salary_max < self.salary_min
        ):
            raise ValueError("Maximum salary cannot be less than minimum salary")
        if (
            self.posted_date is not None
            and self.deadline_date is not None
            and self.deadline_date < self.posted_date
        ):
            raise ValueError("Deadline date cannot be earlier than posted date")
        return self


class JobCreate(JobBase):
    """Schema for creating a new job posting entry."""

    pass


class JobUpdate(BaseModel):
    """Schema for updating an existing job posting or pipeline state."""

    title: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
        description="Updated job title",
    )
    company_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
        description="Updated company name",
    )
    job_url: str | None = Field(
        default=None,
        max_length=1024,
        description="Updated job posting URL",
    )
    location: str | None = Field(
        default=None,
        max_length=255,
        description="Updated location",
    )
    workplace_type: WorkplaceType | None = Field(
        default=None,
        description="Updated workplace type",
    )
    employment_type: EmploymentType | None = Field(
        default=None,
        description="Updated employment type",
    )
    department: str | None = Field(
        default=None,
        max_length=255,
        description="Updated department",
    )
    description: str | None = Field(
        default=None,
        description="Updated job description",
    )
    requirements: str | None = Field(
        default=None,
        description="Updated requirements",
    )
    salary_min: float | None = Field(
        default=None,
        ge=0,
        description="Updated minimum salary",
    )
    salary_max: float | None = Field(
        default=None,
        ge=0,
        description="Updated maximum salary",
    )
    salary_currency: str | None = Field(
        default=None,
        max_length=10,
        description="Updated currency",
    )
    salary_interval: SalaryInterval | None = Field(
        default=None,
        description="Updated salary interval",
    )
    posted_date: date | None = Field(
        default=None,
        description="Updated posted date",
    )
    deadline_date: date | None = Field(
        default=None,
        description="Updated deadline date",
    )
    status: JobStatus | None = Field(
        default=None,
        description="Updated pipeline status",
    )
    current_stage: str | None = Field(
        default=None,
        max_length=100,
        description="Updated specific stage",
    )
    applied_date: date | None = Field(
        default=None,
        description="Updated application submission date",
    )
    excitement_rating: int | None = Field(
        default=None,
        ge=1,
        le=5,
        description="Updated excitement rating (1 to 5)",
    )
    notes: str | None = Field(
        default=None,
        description="Updated personal notes",
    )
    contact_name: str | None = Field(
        default=None,
        max_length=255,
        description="Updated contact name",
    )
    contact_email: str | None = Field(
        default=None,
        max_length=255,
        description="Updated contact email",
    )
    contact_phone: str | None = Field(
        default=None,
        max_length=50,
        description="Updated contact phone",
    )

    @field_validator("title", "company_name")
    @classmethod
    def validate_non_empty_strings(cls, v: str | None) -> str | None:
        if v is None:
            return None
        stripped = v.strip()
        if not stripped:
            raise ValueError("Field cannot be empty or only whitespace")
        return stripped

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, v: Any) -> Any:
        if v is None:
            return None
        if isinstance(v, str):
            return v.strip().lower().replace("-", "_").replace(" ", "_")
        return v

    @field_validator("workplace_type", mode="before")
    @classmethod
    def normalize_workplace_type(cls, v: Any) -> Any:
        if v is None:
            return None
        if isinstance(v, str):
            return v.strip().lower().replace("-", "_").replace(" ", "_")
        return v

    @field_validator("employment_type", mode="before")
    @classmethod
    def normalize_employment_type(cls, v: Any) -> Any:
        if v is None:
            return None
        if isinstance(v, str):
            return v.strip().lower().replace("-", "_").replace(" ", "_")
        return v

    @field_validator("salary_interval", mode="before")
    @classmethod
    def normalize_salary_interval(cls, v: Any) -> Any:
        if v is None:
            return None
        if isinstance(v, str):
            return v.strip().lower().replace("-", "_").replace(" ", "_")
        return v

    @model_validator(mode="after")
    def validate_cross_field_rules(self) -> Self:
        if (
            self.salary_min is not None
            and self.salary_max is not None
            and self.salary_max < self.salary_min
        ):
            raise ValueError("Maximum salary cannot be less than minimum salary")
        if (
            self.posted_date is not None
            and self.deadline_date is not None
            and self.deadline_date < self.posted_date
        ):
            raise ValueError("Deadline date cannot be earlier than posted date")
        return self


class JobResponse(BaseModel):
    """Schema for returning full job posting and pipeline tracking details."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    title: str
    company_name: str
    job_url: str | None = None
    location: str | None = None
    workplace_type: WorkplaceType | str | None = None
    employment_type: EmploymentType | str | None = None
    department: str | None = None
    description: str | None = None
    requirements: str | None = None
    salary_min: float | None = None
    salary_max: float | None = None
    salary_currency: str | None = "USD"
    salary_interval: SalaryInterval | str | None = None
    posted_date: date | None = None
    deadline_date: date | None = None
    status: JobStatus | str
    current_stage: str | None = None
    applied_date: date | None = None
    excitement_rating: int | None = None
    notes: str | None = None
    contact_name: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    created_at: datetime
    updated_at: datetime
    expired_at: datetime | None = None
    expires_at: datetime | None = None
    purge_at: datetime | None = None


class JobPipelineSummary(BaseModel):
    """Aggregate statistics for current user's job pipeline stages."""

    total: int
    saved: int
    applied: int
    interviewing: int
    offer: int
    expired_recently: int = 0
