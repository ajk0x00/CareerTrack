"""Job model representing job postings and application pipeline tracking."""

from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class JobStatus(StrEnum):
    """Current state of a job in the application/pipeline funnel."""

    SAVED = "saved"
    APPLIED = "applied"
    INTERVIEWING = "interviewing"
    OFFER = "offer"


class WorkplaceType(StrEnum):
    """Workplace arrangement type."""

    REMOTE = "remote"
    HYBRID = "hybrid"
    ON_SITE = "on_site"


class Job(Base):
    """Model storing job postings and user application pipeline tracking."""

    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Job Posting Details
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    job_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    workplace_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    employment_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    department: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    requirements: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Compensation / Salary Details
    salary_min: Mapped[float | None] = mapped_column(
        Numeric(12, 2, asdecimal=False),
        nullable=True,
    )
    salary_max: Mapped[float | None] = mapped_column(
        Numeric(12, 2, asdecimal=False),
        nullable=True,
    )
    salary_currency: Mapped[str | None] = mapped_column(
        String(10),
        nullable=True,
        default="USD",
        server_default="USD",
    )
    salary_interval: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Posting Dates
    posted_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    deadline_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Pipeline State & Tracking Details
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default=JobStatus.SAVED.value,
        server_default=JobStatus.SAVED.value,
        index=True,
    )
    current_stage: Mapped[str | None] = mapped_column(String(100), nullable=True)
    applied_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    excitement_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Recruiter / Contact Details
    contact_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
