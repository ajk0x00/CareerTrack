"""Services for orchestrating resume import, drafting, and AI generation."""

from collections import defaultdict
from dataclasses import dataclass
from datetime import date
import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.llm.graph import resume_extraction_graph
from app.llm.resume_generation import resume_generation_graph
from app.models.company import CompanyWorked
from app.models.education import Education
from app.models.experience_log import ExperienceLog
from app.models.skill import Skill, SkillProficiency
from app.models.user import User
from app.schemas.resume import (
    GenerationAccomplishment,
    GenerationCandidateContext,
    GenerationCompany,
    GenerationEducation,
    GenerationSkill,
    ResumeDraftResponse,
    ResumeImportResponse,
)

logger = logging.getLogger(__name__)

_PROFICIENCY_ORDER: tuple[str, ...] = (
    SkillProficiency.EXPERT.value,
    SkillProficiency.ADVANCED.value,
    SkillProficiency.INTERMEDIATE.value,
    SkillProficiency.BEGINNER.value,
)


@dataclass(frozen=True)
class _CareerSnapshot:
    """All user-owned records needed to build or generate a resume."""

    user: User
    companies: list[CompanyWorked]
    logs_by_company: dict[int, list[ExperienceLog]]
    skills: list[Skill]
    education: list[Education]


async def _load_career_snapshot(user_id: int, db: AsyncSession) -> _CareerSnapshot:
    """Loads profile and career records in a consistent order for resume output."""
    user = await db.get(User, user_id)
    if user is None:
        raise ValueError(f"User {user_id} not found")

    companies_stmt = (
        select(CompanyWorked)
        .where(CompanyWorked.user_id == user_id)
        .order_by(
            CompanyWorked.actively_working.desc(),
            CompanyWorked.start_date.desc(),
        )
    )
    companies = list((await db.execute(companies_stmt)).scalars().all())

    logs_stmt = (
        select(ExperienceLog)
        .where(ExperienceLog.user_id == user_id)
        .order_by(ExperienceLog.created_at.asc(), ExperienceLog.id.asc())
    )
    logs = list((await db.execute(logs_stmt)).scalars().all())

    logs_by_company: dict[int, list[ExperienceLog]] = defaultdict(list)
    for log in logs:
        logs_by_company[log.company_id].append(log)

    skills_stmt = select(Skill).where(Skill.user_id == user_id)
    skills = list((await db.execute(skills_stmt)).scalars().all())

    education_stmt = (
        select(Education)
        .where(Education.user_id == user_id)
        .order_by(Education.created_at.desc(), Education.id.desc())
    )
    education = list((await db.execute(education_stmt)).scalars().all())

    return _CareerSnapshot(
        user=user,
        companies=companies,
        logs_by_company=dict(logs_by_company),
        skills=skills,
        education=education,
    )


class ResumeImportService:
    """Orchestrates LLM extraction and transactional upsert into CareerTrack models via LangGraph."""

    @staticmethod
    async def import_resume(
        user_id: int,
        resume_markdown: str,
        db: AsyncSession,
    ) -> ResumeImportResponse:
        """Parses a Markdown resume via LangGraph and upserts companies, accomplishments, and skills."""
        initial_state = {
            "user_id": user_id,
            "resume_markdown": resume_markdown,
            "extraction": None,
            "import_response": None,
        }

        config = {
            "configurable": {"db": db},
            "run_name": "ResumeImportWorkflow",
            "tags": ["resume-import", f"user:{user_id}"],
        }

        logger.info("Executing LangGraph resume extraction workflow for user_id=%d", user_id)
        final_state = await resume_extraction_graph.ainvoke(initial_state, config=config)

        import_response = final_state.get("import_response")
        if import_response is None:
            raise ValueError("LangGraph execution completed without generating an import response.")

        return import_response


class ResumeDraftService:
    """Builds a deterministic Markdown resume draft from stored career data."""

    @staticmethod
    def _display_name(user: User) -> str:
        """Returns the user's display name, falling back to a title-cased email local part."""
        name = (user.name or "").strip()
        if name:
            return name
        local_part = user.email.split("@", 1)[0]
        return local_part.replace(".", " ").replace("_", " ").replace("-", " ").title()

    @staticmethod
    def _address_line(address: dict[str, Any] | None) -> str:
        """Collapses stored address data into a single defensive string."""
        if not address:
            return ""
        preferred = ["city", "state", "country"]
        values = [str(address[key]).strip() for key in preferred if address.get(key)]
        if values:
            return ", ".join(values)
        return ", ".join(
            str(value).strip()
            for value in address.values()
            if value is not None and str(value).strip()
        )

    @classmethod
    def _contact_line(cls, user: User) -> str:
        """Builds the single-line contact block for the resume header."""
        parts: list[str] = []
        email = (user.email or "").strip()
        if email:
            parts.append(email)
        phone = (user.phone or "").strip()
        if phone:
            parts.append(phone)
        address_line = cls._address_line(user.address)
        if address_line:
            parts.append(address_line)
        if user.socials:
            parts.extend(
                str(value).strip()
                for value in user.socials.values()
                if value is not None and str(value).strip()
            )
        return " \u2022 ".join(parts)

    @staticmethod
    def _format_month(value: date) -> str:
        """Formats a date as abbreviated month and year (e.g. Jan 2020)."""
        return value.strftime("%b %Y")

    @classmethod
    def _dates_line(cls, company: CompanyWorked) -> str:
        """Formats the employment range with an en dash."""
        start = cls._format_month(company.start_date)
        if company.actively_working or company.end_date is None:
            return f"{start} \u2013 Present"
        return f"{start} \u2013 {cls._format_month(company.end_date)}"

    @classmethod
    def _education_line(cls, education: Education) -> str:
        """Formats one education row as a single Markdown bullet."""
        line = f"- **{education.degree.strip()}, {education.institution.strip()}**"
        if education.start_date is not None:
            start = cls._format_month(education.start_date)
            if education.end_date is None:
                line += f" ({start} \u2013 Present)"
            else:
                line += f" ({start} \u2013 {cls._format_month(education.end_date)})"
        description = education.description.strip()
        if description:
            line += f": {description}"
        return line

    @staticmethod
    async def build_draft(user_id: int, db: AsyncSession) -> ResumeDraftResponse:
        """Builds a resume draft from the user's profile, companies, logs, and skills."""
        snapshot = await _load_career_snapshot(user_id, db)
        user = snapshot.user
        companies = snapshot.companies
        logs_by_company = snapshot.logs_by_company

        experience_blocks: list[str] = []
        for company in companies:
            job_title = (company.job_title or "").strip()
            heading = (
                f"**{job_title} \u2014 {company.company_name}**"
                if job_title
                else f"**{company.company_name}**"
            )
            block_lines = [
                heading,
                ResumeDraftService._dates_line(company),
            ]
            for log in logs_by_company.get(company.id, []):
                description = log.description.strip()
                if not description:
                    continue
                block_lines.append(f"- {description}")
            experience_blocks.append("\n".join(block_lines))

        skills = snapshot.skills

        skills_by_proficiency: dict[str, list[str]] = defaultdict(list)
        for skill in skills:
            skill_name = skill.name.strip()
            if not skill_name:
                continue
            skills_by_proficiency[skill.proficiency].append(skill_name)

        ordered_proficiencies = list(_PROFICIENCY_ORDER) + sorted(
            proficiency
            for proficiency in skills_by_proficiency
            if proficiency not in _PROFICIENCY_ORDER
        )

        skill_lines: list[str] = []
        for proficiency in ordered_proficiencies:
            names = skills_by_proficiency.get(proficiency)
            if not names:
                continue
            label = proficiency.replace("_", " ").title()
            joined = ", ".join(sorted(names, key=str.casefold))
            skill_lines.append(f"**{label}:** {joined}")

        education_rows = snapshot.education

        education_lines = [
            ResumeDraftService._education_line(education)
            for education in education_rows
        ]

        display_name = ResumeDraftService._display_name(user)
        contact_line = ResumeDraftService._contact_line(user)

        header_lines = [f"# {display_name}"]
        if contact_line:
            header_lines.append(contact_line)

        sections: list[str] = ["\n".join(header_lines)]
        if experience_blocks:
            sections.append("## Experience\n\n" + "\n\n".join(experience_blocks))
        if skill_lines:
            sections.append("## Skills\n\n" + "\n".join(skill_lines))
        if education_lines:
            sections.append("## Education\n\n" + "\n".join(education_lines))

        has_profile = bool(
            (user.name or "").strip()
            or (user.phone or "").strip()
            or user.address
            or user.socials
        )

        return ResumeDraftResponse(
            markdown="\n\n".join(sections),
            has_profile=has_profile,
            has_experience=bool(experience_blocks),
            has_skills=bool(skill_lines),
        )


class ResumeGenerationService:
    """Generates a tailored or generic resume through the LangGraph workflow."""

    @staticmethod
    def _completed_experience_years(
        companies: list[CompanyWorked],
        today: date | None = None,
    ) -> int:
        """Counts completed years across non-overlapping employment months."""
        current_date = today or date.today()
        current_month = current_date.year * 12 + current_date.month
        intervals: list[tuple[int, int]] = []

        for company in companies:
            start_month = company.start_date.year * 12 + company.start_date.month
            if company.actively_working or company.end_date is None:
                end_month = current_month
            else:
                end_month = company.end_date.year * 12 + company.end_date.month
            if end_month >= start_month:
                intervals.append((start_month, end_month))

        if not intervals:
            return 0

        intervals.sort()
        total_months = 0
        merged_start, merged_end = intervals[0]
        for start_month, end_month in intervals[1:]:
            if start_month <= merged_end + 1:
                merged_end = max(merged_end, end_month)
                continue
            total_months += merged_end - merged_start + 1
            merged_start, merged_end = start_month, end_month
        total_months += merged_end - merged_start + 1
        return total_months // 12

    @staticmethod
    def _header_markdown(user: User) -> tuple[str, bool]:
        """Builds the candidate header and its profile-completeness flag."""
        display_name = ResumeDraftService._display_name(user)
        contact_line = ResumeDraftService._contact_line(user)
        header_lines = [f"# {display_name}"]
        if contact_line:
            header_lines.append(contact_line)
        return "\n".join(header_lines), bool(contact_line or display_name.strip())

    @classmethod
    def _education_block(cls, education: Education) -> str:
        """Formats one education entry using the required heading and description structure."""
        degree = " ".join(education.degree.split())
        institution = " ".join(education.institution.split())
        heading = f"### {degree} - {institution}"

        if education.start_date is not None:
            start = cls._format_education_date(education.start_date)
            if education.end_date is None:
                heading += f" ({start} \u2013 Present)"
            else:
                heading += (
                    f" ({start} \u2013 {cls._format_education_date(education.end_date)})"
                )

        description = " ".join(education.description.split())
        if not description:
            return heading
        return f"{heading}\n- {description}"

    @staticmethod
    def _format_education_date(value: date) -> str:
        """Formats an education date as an abbreviated month and year."""
        return value.strftime("%b %Y")

    @classmethod
    def _candidate_context(
        cls,
        snapshot: _CareerSnapshot,
    ) -> GenerationCandidateContext:
        """Builds the non-contact LLM context from stored career records."""
        companies: list[GenerationCompany] = []
        for company in snapshot.companies:
            accomplishments = [
                GenerationAccomplishment(
                    id=log.id,
                    description=" ".join(log.description.split()),
                )
                for log in snapshot.logs_by_company.get(company.id, [])
                if log.description.strip()
            ]
            companies.append(
                GenerationCompany(
                    id=company.id,
                    company_name=company.company_name.strip(),
                    job_title=(company.job_title or "").strip() or None,
                    date_range=ResumeDraftService._dates_line(company),
                    accomplishments=accomplishments,
                )
            )

        skills = [
            GenerationSkill(
                id=skill.id,
                name=" ".join(skill.name.split()),
                proficiency=skill.proficiency,
            )
            for skill in snapshot.skills
            if skill.name.strip()
        ]
        education = [
            GenerationEducation(
                degree=" ".join(row.degree.split()),
                institution=" ".join(row.institution.split()),
                description=" ".join(row.description.split()),
            )
            for row in snapshot.education
        ]

        return GenerationCandidateContext(
            years_experience=cls._completed_experience_years(snapshot.companies),
            companies=companies,
            skills=skills,
            education=education,
        )

    @classmethod
    async def generate(
        cls,
        user_id: int,
        job_description: str | None,
        db: AsyncSession,
    ) -> ResumeDraftResponse:
        """Generates resume Markdown without persisting or mutating career records."""
        snapshot = await _load_career_snapshot(user_id, db)
        candidate = cls._candidate_context(snapshot)
        header_markdown, has_profile = cls._header_markdown(snapshot.user)
        education_blocks = [
            cls._education_block(education) for education in snapshot.education
        ]
        normalized_job_description = (job_description or "").strip() or None

        initial_state = {
            "candidate": candidate,
            "header_markdown": header_markdown,
            "education_blocks": education_blocks,
            "has_profile": has_profile,
            "job_description": normalized_job_description,
            "job_context": None,
            "professional_summary": None,
            "selected_skill_ids": None,
            "experience_bullets": None,
            "draft_response": None,
        }
        config = {
            "run_name": "ResumeGenerationWorkflow",
            "tags": [
                "resume-generation",
                "tailored" if normalized_job_description else "generic",
                f"user:{user_id}",
            ],
        }

        logger.info(
            "Executing LangGraph resume generation workflow for user_id=%d mode=%s",
            user_id,
            "tailored" if normalized_job_description else "generic",
        )
        final_state = await resume_generation_graph.ainvoke(initial_state, config=config)

        response = final_state.get("draft_response")
        if response is None:
            raise ValueError("Resume generation completed without producing a draft")

        return response
