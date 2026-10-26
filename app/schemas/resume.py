"""Pydantic schemas for LLM resume extraction and import."""

from datetime import date, datetime
import re
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.company import EmploymentType
from app.models.skill import SkillProficiency


def _parse_flexible_date(value: Any) -> date | None:
    """Parse flexible date strings (YYYY-MM-DD, YYYY-MM, YYYY, Month YYYY)."""
    if value is None or value == "":
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()

    val_str = str(value).strip()
    if val_str.lower() in ("present", "current", "now", "today", "ongoing", "none", "null"):
        return None

    # YYYY-MM-DD
    match = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})$", val_str)
    if match:
        year, month, day = int(match.group(1)), int(match.group(2)), int(match.group(3))
        return date(year, max(1, min(12, month)), max(1, min(28, day)))

    # YYYY-MM
    match = re.match(r"^(\d{4})-(\d{1,2})$", val_str)
    if match:
        year, month = int(match.group(1)), int(match.group(2))
        return date(year, max(1, min(12, month)), 1)

    # YYYY
    match = re.match(r"^(\d{4})$", val_str)
    if match:
        return date(int(match.group(1)), 1, 1)

    # Try common formats like "Jan 2020", "January 2020", "01/2020"
    for fmt in ("%b %Y", "%B %Y", "%m/%Y", "%m/%d/%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(val_str, fmt).date()
        except ValueError:
            continue

    # Fallback default if unparseable
    return date(2020, 1, 1)


class ExtractedCompany(BaseModel):
    """An employment tenure extracted from a resume."""

    company_name: str = Field(..., description="Employer or organization name")
    title: str = Field(default="", description="Job title or position held (e.g. Senior Software Engineer, Tech Lead)")
    employment_type: EmploymentType = Field(
        default=EmploymentType.FULL_TIME,
        description="Type of employment: full_time, part_time, contract, internship",
    )
    start_date: date = Field(..., description="Start date in YYYY-MM-DD (use YYYY-MM-01 if day omitted)")
    end_date: date | None = Field(default=None, description="End date in YYYY-MM-DD, or null if currently working")
    actively_working: bool = Field(default=False, description="True if currently working here, false otherwise")
    accomplishments: list[str] = Field(
        default_factory=list,
        description="Key responsibilities, achievements, and impact statements at this company, without bullet markers (- or *)",
    )

    @field_validator("company_name")
    @classmethod
    def clean_company_name(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            return "Unknown Company"
        return stripped[:255]

    @field_validator("title")
    @classmethod
    def clean_title(cls, v: str | None) -> str:
        return (v or "").strip()[:255]

    @field_validator("employment_type", mode="before")
    @classmethod
    def normalize_employment_type(cls, v: Any) -> EmploymentType:
        if isinstance(v, str):
            clean = v.strip().lower().replace("-", "_").replace(" ", "_")
            for member in EmploymentType:
                if clean == member.value:
                    return member
        elif isinstance(v, EmploymentType):
            return v
        return EmploymentType.FULL_TIME

    @field_validator("start_date", mode="before")
    @classmethod
    def parse_start_date(cls, v: Any) -> date:
        parsed = _parse_flexible_date(v)
        return parsed or date(2020, 1, 1)

    @field_validator("end_date", mode="before")
    @classmethod
    def parse_end_date(cls, v: Any) -> date | None:
        return _parse_flexible_date(v)

    @model_validator(mode="after")
    def validate_working_dates(self) -> "ExtractedCompany":
        if self.actively_working:
            self.end_date = None
        elif self.end_date is not None and self.end_date < self.start_date:
            # If dates are inverted, adjust end_date to match start_date
            self.end_date = self.start_date
        return self


class ExtractedSkill(BaseModel):
    """A technical or domain skill extracted from a resume."""

    name: str = Field(..., description="Technical or professional skill, programming language, tool, or competency")
    proficiency: SkillProficiency = Field(
        default=SkillProficiency.INTERMEDIATE,
        description="Proficiency level: beginner, intermediate, advanced, expert (expert: 5+ yrs or staff/lead; advanced: multi-project; intermediate: standard stack; beginner: novice)",
    )

    @field_validator("name")
    @classmethod
    def clean_skill_name(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            return "General Skill"
        return stripped[:100]

    @field_validator("proficiency", mode="before")
    @classmethod
    def normalize_proficiency(cls, v: Any) -> SkillProficiency:
        if isinstance(v, str):
            clean = v.strip().lower().replace("-", "_").replace(" ", "_")
            alias_map = {
                "novice": SkillProficiency.BEGINNER,
                "basic": SkillProficiency.BEGINNER,
                "entry": SkillProficiency.BEGINNER,
                "proficient": SkillProficiency.INTERMEDIATE,
                "medium": SkillProficiency.INTERMEDIATE,
                "senior": SkillProficiency.ADVANCED,
                "lead": SkillProficiency.EXPERT,
                "master": SkillProficiency.EXPERT,
            }
            if clean in alias_map:
                return alias_map[clean]
            for member in SkillProficiency:
                if clean == member.value:
                    return member
        elif isinstance(v, SkillProficiency):
            return v
        return SkillProficiency.INTERMEDIATE


class ResumeExtraction(BaseModel):
    """Unified extraction result from a resume."""

    companies: list[ExtractedCompany] = Field(
        default_factory=list,
        description="All employment history tenures and their accomplishments from the resume",
    )
    skills: list[ExtractedSkill] = Field(
        default_factory=list,
        description="All technical, domain, and professional skills extracted from the resume",
    )


class ResumeImportRequest(BaseModel):
    """Request payload for importing a resume."""

    resume_markdown: str = Field(
        ...,
        min_length=10,
        description="Resume text in Markdown format",
    )


class ResumeImportResponse(BaseModel):
    """Response payload detailing the records created or updated by resume import."""

    model_config = ConfigDict(from_attributes=True)

    companies_created: int = 0
    companies_updated: int = 0
    accomplishments_created: int = 0
    skills_created: int = 0
    skills_updated: int = 0
    errors: list[str] = Field(default_factory=list)


class ResumeGenerationRequest(BaseModel):
    """Payload for generating an ATS-oriented resume from stored career data."""

    job_id: int | None = Field(
        default=None,
        ge=1,
        description="Optional tracked job whose description should be used when none is supplied.",
    )
    job_description: str | None = Field(
        default=None,
        max_length=50_000,
        description="Optional job description to tailor against. Blank values run generic generation.",
    )

    @field_validator("job_description")
    @classmethod
    def normalize_job_description(cls, value: str | None) -> str | None:
        """Trims the description and treats whitespace-only text as no target job."""
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class JobContextChunks(BaseModel):
    """Structured job-description context routed to each generation branch."""

    summary_context: str = Field(
        ...,
        description="Role scope, seniority, domain, and positioning cues relevant to the professional summary.",
    )
    skills_context: str = Field(
        ...,
        description="Required and preferred skills, technologies, and competencies ranked by importance.",
    )
    experience_context: str = Field(
        ...,
        description="Responsibilities, achievement themes, and domain language relevant to work experience.",
    )


def _clean_generated_text(value: str, *, max_length: int) -> str:
    """Collapses generated prose to one plain-text line and enforces a safe length."""
    cleaned = " ".join(value.split())
    cleaned = cleaned.lstrip("#>* ")
    cleaned = (
        cleaned.replace("`", "")
        .replace("![", "")
        .replace(":::", " : ")
        .replace("|", " / ")
        .replace("<=", "at most ")
        .replace(">=", "at least ")
        .replace("<", "less than ")
        .replace(">", "more than ")
    )
    cleaned = " ".join(cleaned.split()).lstrip("-* ").strip()
    if not cleaned:
        raise ValueError("Generated text cannot be empty")
    if len(cleaned) > max_length:
        raise ValueError(f"Generated text cannot exceed {max_length} characters")
    return cleaned


class GeneratedProfessionalSummary(BaseModel):
    """Structured output for the professional summary branch."""

    text: str = Field(
        ...,
        description="A plain-text professional summary with no Markdown formatting or bullet points.",
    )

    @field_validator("text")
    @classmethod
    def clean_text(cls, value: str) -> str:
        """Normalizes the summary into one safe paragraph."""
        return _clean_generated_text(value, max_length=1_500)


class TailoredSkillSelection(BaseModel):
    """Structured output containing source skill IDs in ATS-priority order."""

    skill_ids: list[int] = Field(
        default_factory=list,
        description="Existing source skill IDs only, ordered from most to least relevant.",
    )


class TailoredExperienceBullet(BaseModel):
    """A source accomplishment rewritten for the target job."""

    log_id: int = Field(..., ge=1, description="Existing experience-log ID being rewritten")
    text: str = Field(
        ...,
        description="A truthful, plain-text accomplishment with no Markdown or bullet prefix.",
    )

    @field_validator("text")
    @classmethod
    def clean_text(cls, value: str) -> str:
        """Normalizes the bullet into one safe line."""
        return _clean_generated_text(value, max_length=700)


class TailoredExperienceSelection(BaseModel):
    """Structured output containing ordered, rewritten accomplishments."""

    bullets: list[TailoredExperienceBullet] = Field(
        default_factory=list,
        description="Selected source accomplishment IDs and their ATS-oriented rewrites in display order.",
    )


class GenerationAccomplishment(BaseModel):
    """A stored accomplishment supplied to the generation graph."""

    id: int
    description: str


class GenerationCompany(BaseModel):
    """A stored employment tenure supplied to the generation graph."""

    id: int
    company_name: str
    job_title: str | None
    date_range: str
    accomplishments: list[GenerationAccomplishment] = Field(default_factory=list)


class GenerationSkill(BaseModel):
    """A stored skill supplied to the generation graph."""

    id: int
    name: str
    proficiency: str


class GenerationEducation(BaseModel):
    """A stored education record supplied to summary generation."""

    degree: str
    institution: str
    description: str


class GenerationCandidateContext(BaseModel):
    """Non-contact career data used by the LLM generation branches."""

    years_experience: int = Field(
        ...,
        ge=0,
        description="Completed years of professional experience calculated from non-overlapping employment dates.",
    )
    companies: list[GenerationCompany] = Field(default_factory=list)
    skills: list[GenerationSkill] = Field(default_factory=list)
    education: list[GenerationEducation] = Field(default_factory=list)


class ResumeCreate(BaseModel):
    """Payload for persisting a generated resume."""

    job_id: int | None = Field(
        default=None,
        description="Optional job the resume is tailored to. Null creates the canonical master resume.",
    )
    title: str | None = Field(
        default=None,
        max_length=150,
        description="Optional resume title. Derived from the job when omitted.",
    )
    markdown: str = Field(..., min_length=1, description="Resume content in Markdown format")


class ResumeUpdate(BaseModel):
    """Payload for partially updating a stored resume."""

    title: str | None = Field(default=None, max_length=150)
    markdown: str | None = Field(default=None, min_length=1)


class ResumeSummary(BaseModel):
    """List representation of a stored resume."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    job_id: int | None
    job_title: str | None
    job_company: str | None
    created_at: datetime
    updated_at: datetime
    exported_at: datetime | None


class ResumeDetail(ResumeSummary):
    """Full representation of a stored resume including its Markdown body."""

    markdown: str


class ResumeDraftResponse(BaseModel):
    """Draft resume built from live career data without persisting anything."""

    markdown: str
    has_profile: bool
    has_experience: bool
    has_skills: bool


class AtsReport(BaseModel):
    """Result of verifying the rendered PDF against the source Markdown."""

    parse_clean: bool
    char_count: int
    page_count: int
    sections_found: list[str]
    missing_tokens: list[str]
    keyword_coverage: float | None
    matched_keywords: list[str]
    missing_keywords: list[str]
