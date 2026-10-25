"""Service for orchestrating LLM-powered resume parsing and database upserts via LangGraph."""

from collections import defaultdict
from datetime import date
import logging
import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.llm.graph import resume_extraction_graph
from app.models.company import CompanyWorked
from app.models.education import Education
from app.models.experience_log import ExperienceLog
from app.models.skill import Skill, SkillProficiency
from app.models.user import User
from app.schemas.resume import ResumeDraftResponse, ResumeImportResponse

logger = logging.getLogger(__name__)

_PROFICIENCY_ORDER: tuple[str, ...] = (
    SkillProficiency.EXPERT.value,
    SkillProficiency.ADVANCED.value,
    SkillProficiency.INTERMEDIATE.value,
    SkillProficiency.BEGINNER.value,
)

_ROLE_PREFIX = re.compile(r"^\s*role:\s*", re.IGNORECASE)


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

    @staticmethod
    async def build_draft(user_id: int, db: AsyncSession) -> ResumeDraftResponse:
        """Builds a resume draft from the user's profile, companies, logs, and skills."""
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

        experience_blocks: list[str] = []
        for company in companies:
            block_lines = [
                f"**{company.company_name}**",
                ResumeDraftService._dates_line(company),
            ]
            for log in logs_by_company.get(company.id, []):
                description = log.description.strip()
                if not description or _ROLE_PREFIX.match(description):
                    continue
                block_lines.append(f"- {description}")
            experience_blocks.append("\n".join(block_lines))

        skills_stmt = select(Skill).where(Skill.user_id == user_id)
        skills = list((await db.execute(skills_stmt)).scalars().all())

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

        education_stmt = (
            select(Education)
            .where(Education.user_id == user_id)
            .order_by(Education.created_at.desc(), Education.id.desc())
        )
        education_rows = list((await db.execute(education_stmt)).scalars().all())

        education_lines = [
            f"- **{education.degree.strip()}, {education.institution.strip()}** "
            f"(CGPA: {education.cgpa:.2f})"
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
