"""LangGraph workflow for generating an ATS-oriented resume from stored career data."""

import logging
from typing import Any, TypeVar, TypedDict

from langchain_core.runnables import RunnableConfig
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel

from app.core.config import get_settings
from app.llm.prompt import load_prompt
from app.schemas.resume import (
    GeneratedProfessionalSummary,
    GenerationCandidateContext,
    GenerationCompany,
    JobContextChunks,
    ResumeDraftResponse,
    TailoredExperienceBullet,
    TailoredExperienceSelection,
    TailoredSkillSelection,
)

logger = logging.getLogger(__name__)

_StructuredOutput = TypeVar("_StructuredOutput", bound=BaseModel)


class ResumeGenerationError(RuntimeError):
    """Raised when the generation workflow cannot produce a trustworthy resume."""


class ResumeGenerationState(TypedDict):
    """Shared state for the resume-generation LangGraph."""

    candidate: GenerationCandidateContext
    header_markdown: str
    education_blocks: list[str]
    has_profile: bool
    job_description: str | None
    job_context: JobContextChunks | None
    professional_summary: str | None
    selected_skill_ids: list[int] | None
    experience_bullets: list[TailoredExperienceBullet] | None
    draft_response: ResumeDraftResponse | None


async def _invoke_structured(
    prompt_name: str,
    output_schema: type[_StructuredOutput],
    config: RunnableConfig,
    **variables: Any,
) -> _StructuredOutput:
    """Runs a prompt through ChatOpenAI with Pydantic-enforced structured output."""
    settings = get_settings()
    api_key = settings.LLM_API_KEY.strip()
    if not api_key:
        raise ResumeGenerationError("LLM_API_KEY is not configured")

    messages, prompt_config = load_prompt(prompt_name, **variables)
    base_url = prompt_config.base_url.rstrip("/")
    if not base_url:
        raise ResumeGenerationError("An LLM base URL is not configured")

    llm = ChatOpenAI(
        model=prompt_config.model,
        temperature=prompt_config.temperature,
        api_key=api_key,
        base_url=base_url,
        timeout=settings.LLM_TIMEOUT_SECONDS,
        max_retries=settings.LLM_MAX_RETRIES,
    )
    structured_llm = llm.with_structured_output(output_schema)

    logger.info(
        "[resume-generation:%s] Invoking model=%s (temp=%.2f)",
        prompt_name,
        prompt_config.model,
        prompt_config.temperature,
    )
    result = await structured_llm.ainvoke(messages, config=config)
    if isinstance(result, output_schema):
        return result
    return output_schema.model_validate(result)


async def prepare_job_context_node(
    state: ResumeGenerationState,
    config: RunnableConfig,
) -> dict[str, Any]:
    """Routes job-description details into summary, skills, and experience chunks."""
    job_description = (state.get("job_description") or "").strip()
    if not job_description:
        logger.info("[resume-generation:prepare_job_context] No job description; using generic mode")
        return {
            "job_context": JobContextChunks(
                summary_context="",
                skills_context="",
                experience_context="",
            )
        }

    job_context = await _invoke_structured(
        "analyze_resume_job",
        JobContextChunks,
        config,
        job_description=job_description,
    )
    return {"job_context": job_context}


async def generate_professional_summary_node(
    state: ResumeGenerationState,
    config: RunnableConfig,
) -> dict[str, Any]:
    """Generates a job-aligned or generic professional summary."""
    candidate = state["candidate"]
    job_context = state.get("job_context")
    if job_context is None:
        raise ResumeGenerationError("Job context was not prepared")

    result = await _invoke_structured(
        "generate_resume_summary",
        GeneratedProfessionalSummary,
        config,
        candidate_context=candidate.model_dump_json(indent=2),
        summary_context=job_context.summary_context or "No target job was supplied.",
    )
    return {"professional_summary": result.text}


def validate_skill_selection(
    candidate: GenerationCandidateContext,
    selection: TailoredSkillSelection,
) -> list[int]:
    """Validates skill IDs against the source data and removes duplicate selections."""
    source_ids = {skill.id for skill in candidate.skills}
    ordered_ids: list[int] = []
    seen: set[int] = set()

    for skill_id in selection.skill_ids:
        if skill_id not in source_ids:
            raise ResumeGenerationError("The model selected a skill outside the candidate's data")
        if skill_id in seen:
            continue
        seen.add(skill_id)
        ordered_ids.append(skill_id)

    if source_ids and not ordered_ids:
        raise ResumeGenerationError("The model did not select any candidate skills")
    return ordered_ids


async def select_and_order_skills_node(
    state: ResumeGenerationState,
    config: RunnableConfig,
) -> dict[str, Any]:
    """Selects and orders source skills for maximum target-job relevance."""
    candidate = state["candidate"]
    job_context = state.get("job_context")
    if job_context is None:
        raise ResumeGenerationError("Job context was not prepared")

    result = await _invoke_structured(
        "tailor_resume_skills",
        TailoredSkillSelection,
        config,
        candidate_context=candidate.model_dump_json(indent=2),
        skills_context=job_context.skills_context or "No target job was supplied.",
    )
    return {"selected_skill_ids": validate_skill_selection(candidate, result)}


def validate_experience_selection(
    candidate: GenerationCandidateContext,
    selection: TailoredExperienceSelection,
) -> list[TailoredExperienceBullet]:
    """Validates rewritten accomplishments against source logs and removes duplicates."""
    source_ids = {
        accomplishment.id
        for company in candidate.companies
        for accomplishment in company.accomplishments
    }
    bullets: list[TailoredExperienceBullet] = []
    seen: set[int] = set()

    for bullet in selection.bullets:
        if bullet.log_id not in source_ids:
            raise ResumeGenerationError(
                "The model selected an accomplishment outside the candidate's data"
            )
        if bullet.log_id in seen:
            continue
        seen.add(bullet.log_id)
        bullets.append(bullet)

    if source_ids and not bullets:
        raise ResumeGenerationError("The model did not select any candidate accomplishments")
    return bullets


async def select_and_rewrite_experience_node(
    state: ResumeGenerationState,
    config: RunnableConfig,
) -> dict[str, Any]:
    """Selects achievements and rewrites them using the target job's language."""
    candidate = state["candidate"]
    job_context = state.get("job_context")
    if job_context is None:
        raise ResumeGenerationError("Job context was not prepared")

    result = await _invoke_structured(
        "tailor_resume_experience",
        TailoredExperienceSelection,
        config,
        candidate_context=candidate.model_dump_json(indent=2),
        experience_context=job_context.experience_context or "No target job was supplied.",
    )
    return {
        "experience_bullets": validate_experience_selection(candidate, result),
    }


def _single_line(value: str) -> str:
    """Collapses stored or generated text to one Markdown-safe line."""
    return " ".join(value.split())


def _experience_heading(company: GenerationCompany) -> str:
    """Formats one employment heading in the required resume structure."""
    job_title = _single_line(company.job_title or "")
    company_name = _single_line(company.company_name)
    heading = f"{job_title} - {company_name}" if job_title else company_name
    return f"### {heading} ({_single_line(company.date_range)})"


def compose_resume_node(state: ResumeGenerationState) -> dict[str, Any]:
    """Assembles generated and database-derived content into the final Markdown resume."""
    candidate = state["candidate"]
    skills_by_id = {skill.id: _single_line(skill.name) for skill in candidate.skills}
    selected_skill_ids = state.get("selected_skill_ids") or []
    selected_skill_names = [
        skills_by_id[skill_id]
        for skill_id in selected_skill_ids
        if skill_id in skills_by_id and skills_by_id[skill_id]
    ]

    selected_bullets = state.get("experience_bullets") or []
    company_id_by_log_id = {
        accomplishment.id: company.id
        for company in candidate.companies
        for accomplishment in company.accomplishments
    }
    bullets_by_company: dict[int, list[str]] = {}
    for bullet in selected_bullets:
        company_id = company_id_by_log_id.get(bullet.log_id)
        if company_id is not None:
            bullets_by_company.setdefault(company_id, []).append(bullet.text)

    experience_blocks: list[str] = []
    for company in candidate.companies:
        lines = [_experience_heading(company)]
        lines.extend(f"- {text}" for text in bullets_by_company.get(company.id, []))
        experience_blocks.append("\n".join(lines))

    sections: list[str] = [state["header_markdown"]]

    professional_summary = (state.get("professional_summary") or "").strip()
    if professional_summary:
        sections.append("## Professional Summary\n\n" + professional_summary)

    if selected_skill_names:
        sections.append("## Skills\n\n" + ", ".join(selected_skill_names))

    if experience_blocks:
        sections.append("## Experience\n\n" + "\n\n".join(experience_blocks))

    education_blocks = state.get("education_blocks") or []
    if education_blocks:
        sections.append("## Education\n\n" + "\n\n".join(education_blocks))

    response = ResumeDraftResponse(
        markdown="\n\n".join(sections),
        has_profile=state["has_profile"],
        has_experience=bool(candidate.companies),
        has_skills=bool(selected_skill_names),
    )
    return {"draft_response": response}


def create_resume_generation_graph() -> Any:
    """Builds and compiles the resume-generation LangGraph."""
    builder = StateGraph(ResumeGenerationState)

    builder.add_node("prepare_job_context", prepare_job_context_node)
    builder.add_node("generate_professional_summary", generate_professional_summary_node)
    builder.add_node("select_and_order_skills", select_and_order_skills_node)
    builder.add_node("select_and_rewrite_experience", select_and_rewrite_experience_node)
    builder.add_node("compose_resume", compose_resume_node)

    builder.add_edge(START, "prepare_job_context")
    builder.add_edge("prepare_job_context", "generate_professional_summary")
    builder.add_edge("prepare_job_context", "select_and_order_skills")
    builder.add_edge("prepare_job_context", "select_and_rewrite_experience")
    builder.add_edge(
        [
            "generate_professional_summary",
            "select_and_order_skills",
            "select_and_rewrite_experience",
        ],
        "compose_resume",
    )
    builder.add_edge("compose_resume", END)

    return builder.compile()


resume_generation_graph = create_resume_generation_graph()
