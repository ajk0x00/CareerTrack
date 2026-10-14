"""LangGraph workflow for Resume Extraction and Profile Synchronization.

Provides an observable StateGraph with automatic LangSmith tracing.
"""

import logging
from typing import Any, TypedDict

from langchain_core.runnables import RunnableConfig
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.llm.prompt import load_prompt
from app.models.company import CompanyWorked
from app.models.experience_log import ExperienceLog
from app.models.skill import Skill
from app.schemas.resume import (
    ExtractedCompany,
    ResumeExtraction,
    ResumeImportResponse,
)

logger = logging.getLogger(__name__)


class ResumeExtractionState(TypedDict):
    """State schema for the resume extraction LangGraph."""

    user_id: int
    resume_markdown: str
    extraction: ResumeExtraction | None
    import_response: ResumeImportResponse | None


async def extract_resume_node(
    state: ResumeExtractionState,
    config: RunnableConfig,
) -> dict[str, Any]:
    """LangGraph node: Extract structured career entities from Markdown resume using LLM."""
    settings = get_settings()

    # 1. Load prompt template and prompt-level LLM frontmatter configuration
    messages, prompt_config = load_prompt(
        "extract_resume",
        resume=state["resume_markdown"],
    )

    # 2. Instantiate LangChain ChatOpenAI configured by prompt frontmatter (with settings fallbacks)
    base_url = prompt_config.base_url.rstrip("/")
    llm = ChatOpenAI(
        model=prompt_config.model,
        temperature=prompt_config.temperature,
        api_key=settings.LLM_API_KEY or "not-provided",
        base_url=base_url,
    )

    structured_llm = llm.with_structured_output(ResumeExtraction)

    logger.info(
        "[LangGraph:extract_resume] Invoking model=%s (temp=%.2f) via base_url=%s",
        prompt_config.model,
        prompt_config.temperature,
        base_url,
    )

    result = await structured_llm.ainvoke(messages, config=config)

    # Handle result if returned as dict or Pydantic instance
    if isinstance(result, dict):
        extraction = ResumeExtraction.model_validate(result)
    elif isinstance(result, ResumeExtraction):
        extraction = result
    else:
        raise ValueError(f"Unexpected extraction result type: {type(result)}")

    return {"extraction": extraction}


async def upsert_database_node(
    state: ResumeExtractionState,
    config: RunnableConfig,
) -> dict[str, Any]:
    """LangGraph node: Upsert extracted companies, accomplishments, and skills into database."""
    extraction = state.get("extraction")
    if extraction is None:
        raise ValueError("Cannot upsert: No extraction found in graph state.")

    user_id = state["user_id"]
    configurable = config.get("configurable", {})
    db: AsyncSession | None = configurable.get("db")

    if db is None:
        raise ValueError("Database session (db) not provided in LangGraph configurable context.")

    companies_created = 0
    companies_updated = 0
    accomplishments_created = 0

    # 1. Load existing companies
    company_stmt = select(CompanyWorked).where(CompanyWorked.user_id == user_id)
    company_res = await db.execute(company_stmt)
    existing_companies: list[CompanyWorked] = list(company_res.scalars().all())

    for ext_co in extraction.companies:
        co_obj = _find_matching_company(existing_companies, ext_co)

        if co_obj is not None:
            co_obj.employment_type = ext_co.employment_type.value
            co_obj.start_date = ext_co.start_date
            co_obj.end_date = ext_co.end_date
            co_obj.actively_working = ext_co.actively_working
            companies_updated += 1
        else:
            co_obj = CompanyWorked(
                user_id=user_id,
                company_name=ext_co.company_name,
                employment_type=ext_co.employment_type.value,
                start_date=ext_co.start_date,
                end_date=ext_co.end_date,
                actively_working=ext_co.actively_working,
            )
            db.add(co_obj)
            existing_companies.append(co_obj)
            companies_created += 1

        # Flush to obtain generated primary key
        await db.flush()

        # Upsert accomplishments for this company
        acc_count = await _upsert_accomplishments(user_id, co_obj.id, ext_co, db)
        accomplishments_created += acc_count

    # 2. Upsert skills
    skills_created = 0
    skills_updated = 0

    skill_stmt = select(Skill).where(Skill.user_id == user_id)
    skill_res = await db.execute(skill_stmt)
    existing_skills: dict[str, Skill] = {
        s.name.lower().strip(): s for s in skill_res.scalars().all()
    }

    for ext_skill in extraction.skills:
        skill_key = ext_skill.name.lower().strip()
        if not skill_key:
            continue

        if skill_key in existing_skills:
            skill_obj = existing_skills[skill_key]
            if skill_obj.proficiency != ext_skill.proficiency.value:
                skill_obj.proficiency = ext_skill.proficiency.value
                skills_updated += 1
        else:
            new_skill = Skill(
                user_id=user_id,
                name=ext_skill.name.strip(),
                proficiency=ext_skill.proficiency.value,
            )
            db.add(new_skill)
            existing_skills[skill_key] = new_skill
            skills_created += 1

    await db.flush()

    response = ResumeImportResponse(
        companies_created=companies_created,
        companies_updated=companies_updated,
        accomplishments_created=accomplishments_created,
        skills_created=skills_created,
        skills_updated=skills_updated,
        errors=[],
    )

    logger.info(
        "[LangGraph:upsert_database] Completed: companies +%d/~%d, accomplishments +%d, skills +%d/~%d",
        companies_created,
        companies_updated,
        accomplishments_created,
        skills_created,
        skills_updated,
    )

    return {"import_response": response}


def _find_matching_company(
    existing: list[CompanyWorked],
    extracted: ExtractedCompany,
) -> CompanyWorked | None:
    """Finds an existing CompanyWorked record by name and start date."""
    target_name = extracted.company_name.lower().strip()

    for co in existing:
        if (
            co.company_name.lower().strip() == target_name
            and co.start_date == extracted.start_date
        ):
            return co

    name_matches = [co for co in existing if co.company_name.lower().strip() == target_name]
    if len(name_matches) == 1:
        return name_matches[0]

    return None


async def _upsert_accomplishments(
    user_id: int,
    company_id: int,
    extracted_co: ExtractedCompany,
    db: AsyncSession,
) -> int:
    """Upserts accomplishments for a given company, avoiding duplicates."""
    stmt = select(ExperienceLog).where(
        ExperienceLog.user_id == user_id,
        ExperienceLog.company_id == company_id,
    )
    res = await db.execute(stmt)
    existing_descriptions = {
        log.description.lower().strip() for log in res.scalars().all()
    }

    added = 0

    if extracted_co.title:
        role_desc = f"Role: {extracted_co.title}"
        if role_desc.lower() not in existing_descriptions:
            db.add(
                ExperienceLog(
                    user_id=user_id,
                    company_id=company_id,
                    description=role_desc,
                )
            )
            existing_descriptions.add(role_desc.lower())
            added += 1

    for bullet in extracted_co.accomplishments:
        clean_bullet = bullet.strip().lstrip("-*•").strip()
        if not clean_bullet:
            continue
        if clean_bullet.lower() not in existing_descriptions:
            db.add(
                ExperienceLog(
                    user_id=user_id,
                    company_id=company_id,
                    description=clean_bullet,
                )
            )
            existing_descriptions.add(clean_bullet.lower())
            added += 1

    return added


def create_resume_extraction_graph() -> Any:
    """Builds and compiles the LangGraph StateGraph for resume extraction."""
    builder = StateGraph(ResumeExtractionState)

    builder.add_node("extract_resume", extract_resume_node)
    builder.add_node("upsert_database", upsert_database_node)

    builder.add_edge(START, "extract_resume")
    builder.add_edge("extract_resume", "upsert_database")
    builder.add_edge("upsert_database", END)

    return builder.compile()


# Singleton compiled graph
resume_extraction_graph = create_resume_extraction_graph()
