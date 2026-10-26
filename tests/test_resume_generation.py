"""Focused tests for the AI resume-generation workflow."""

from datetime import date
from types import SimpleNamespace
import unittest
from typing import cast
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
from pydantic import ValidationError

from app.api.v1.endpoints.resumes import generate_resume as generate_resume_endpoint
from app.llm import resume_generation
from app.llm.prompt import load_prompt
from app.models.company import CompanyWorked
from app.models.education import Education
from app.models.user import User
from app.services.resume import ResumeGenerationService
from app.llm.resume_generation import (
    ResumeGenerationConfigurationError,
    ResumeGenerationError,
    compose_resume_node,
    prepare_job_context_node,
    validate_experience_selection,
    validate_skill_selection,
)
from app.schemas.resume import (
    GeneratedProfessionalSummary,
    GenerationAccomplishment,
    GenerationCandidateContext,
    GenerationCompany,
    GenerationSkill,
    JobContextChunks,
    ResumeGenerationRequest,
    TailoredExperienceBullet,
    TailoredExperienceSelection,
    TailoredSkillSelection,
)


def _candidate() -> GenerationCandidateContext:
    """Builds a small candidate with two employers and two skills."""
    return GenerationCandidateContext(
        years_experience=6,
        companies=[
            GenerationCompany(
                id=1,
                company_name="Acme Corp",
                job_title="Senior Engineer",
                date_range="Jan 2022 \u2013 Present",
                accomplishments=[
                    GenerationAccomplishment(id=10, description="Built an API"),
                    GenerationAccomplishment(id=11, description="Led a migration"),
                ],
            ),
            GenerationCompany(
                id=2,
                company_name="Beta Labs",
                job_title=None,
                date_range="Jun 2019 \u2013 Dec 2021",
                accomplishments=[
                    GenerationAccomplishment(id=20, description="Automated reports"),
                ],
            ),
        ],
        skills=[
            GenerationSkill(id=101, name="Python", proficiency="expert"),
            GenerationSkill(id=102, name="FastAPI", proficiency="advanced"),
        ],
    )


class ResumeGenerationCompositionTests(unittest.TestCase):
    """Tests deterministic assembly and source-bound LLM output validation."""

    def test_composes_sections_in_required_order(self) -> None:
        result = compose_resume_node(
            {
                "candidate": _candidate(),
                "header_markdown": "# Jordan Lee\njordan@example.com \u2022 Toronto, Canada",
                "education_blocks": [
                    "### BSc Computer Science - Example University (Sep 2015 \u2013 May 2019)\n"
                    "- Graduated with honours"
                ],
                "has_profile": True,
                "professional_summary": "Engineer with six years of experience.",
                "selected_skill_ids": [102, 101],
                "experience_bullets": [
                    TailoredExperienceBullet(log_id=11, text="Led a zero-downtime data migration"),
                    TailoredExperienceBullet(log_id=10, text="Built a high-throughput API"),
                    TailoredExperienceBullet(log_id=20, text="Automated recurring reports"),
                ],
            }
        )

        markdown = result["draft_response"].markdown
        self.assertLess(markdown.index("## Professional Summary"), markdown.index("## Skills"))
        self.assertLess(markdown.index("## Skills"), markdown.index("## Experience"))
        self.assertLess(markdown.index("## Experience"), markdown.index("## Education"))
        self.assertIn("## Skills\n\nFastAPI, Python", markdown)
        self.assertIn("### Senior Engineer - Acme Corp (Jan 2022 \u2013 Present)", markdown)
        self.assertLess(
            markdown.index("- Led a zero-downtime data migration"),
            markdown.index("- Built a high-throughput API"),
        )
        self.assertIn("### Beta Labs (Jun 2019 \u2013 Dec 2021)", markdown)
        self.assertIn("- Automated recurring reports", markdown)
        self.assertIn(
            "### BSc Computer Science - Example University (Sep 2015 \u2013 May 2019)",
            markdown,
        )

    def test_empty_sections_are_omitted(self) -> None:
        result = compose_resume_node(
            {
                "candidate": GenerationCandidateContext(years_experience=0),
                "header_markdown": "# Jordan Lee",
                "education_blocks": [],
                "has_profile": True,
                "professional_summary": "",
                "selected_skill_ids": [],
                "experience_bullets": [],
            }
        )

        self.assertEqual(result["draft_response"].markdown, "# Jordan Lee")

    def test_rejects_unknown_skill_id(self) -> None:
        with self.assertRaises(ResumeGenerationError):
            validate_skill_selection(
                _candidate(),
                TailoredSkillSelection(skill_ids=[999]),
            )

    def test_requires_a_skill_when_sources_exist(self) -> None:
        with self.assertRaises(ResumeGenerationError):
            validate_skill_selection(_candidate(), TailoredSkillSelection(skill_ids=[]))

    def test_deduplicates_selected_skills_without_reordering(self) -> None:
        selected = validate_skill_selection(
            _candidate(),
            TailoredSkillSelection(skill_ids=[102, 102, 101]),
        )
        self.assertEqual(selected, [102, 101])

    def test_rejects_unknown_experience_id(self) -> None:
        with self.assertRaises(ResumeGenerationError):
            validate_experience_selection(
                _candidate(),
                TailoredExperienceSelection(
                    bullets=[TailoredExperienceBullet(log_id=999, text="Invented work")]
                ),
            )

    def test_requires_an_accomplishment_when_sources_exist(self) -> None:
        with self.assertRaises(ResumeGenerationError):
            validate_experience_selection(
                _candidate(),
                TailoredExperienceSelection(bullets=[]),
            )


class ResumeGenerationGraphTests(unittest.IsolatedAsyncioTestCase):
    """Tests the compiled graph's fan-out and fan-in with a mocked LLM."""

    async def test_prepare_job_context_skips_llm_in_generic_mode(self) -> None:
        state = {
            "candidate": _candidate(),
            "header_markdown": "# Jordan Lee",
            "education_blocks": [],
            "has_profile": True,
            "job_description": None,
            "job_context": None,
            "professional_summary": None,
            "selected_skill_ids": None,
            "experience_bullets": None,
            "draft_response": None,
        }

        with patch.object(
            resume_generation,
            "_invoke_structured",
            side_effect=AssertionError("LLM should not run"),
        ):
            result = await prepare_job_context_node(state, {})

        self.assertEqual(result["job_context"].summary_context, "")
        self.assertEqual(result["job_context"].skills_context, "")
        self.assertEqual(result["job_context"].experience_context, "")

    async def test_graph_runs_branches_and_composes_resume(self) -> None:
        calls: list[str] = []

        async def fake_structured(
            prompt_name: str,
            output_schema: type,
            config: object,
            **variables: object,
        ) -> object:
            del config, variables
            calls.append(prompt_name)
            if output_schema is JobContextChunks:
                return JobContextChunks(
                    summary_context="Senior backend role",
                    skills_context="Python and FastAPI",
                    experience_context="API reliability",
                )
            if output_schema is GeneratedProfessionalSummary:
                return GeneratedProfessionalSummary(
                    text="Backend engineer with six years of experience."
                )
            if output_schema is TailoredSkillSelection:
                return TailoredSkillSelection(skill_ids=[102, 101])
            if output_schema is TailoredExperienceSelection:
                return TailoredExperienceSelection(
                    bullets=[
                        TailoredExperienceBullet(log_id=10, text="Built a reliable API"),
                        TailoredExperienceBullet(log_id=11, text="Led a data migration"),
                        TailoredExperienceBullet(log_id=20, text="Automated reporting"),
                    ]
                )
            raise AssertionError(f"Unexpected output schema: {output_schema}")

        initial_state = {
            "candidate": _candidate(),
            "header_markdown": "# Jordan Lee\njordan@example.com",
            "education_blocks": [],
            "has_profile": True,
            "job_description": "We need a backend engineer with Python experience.",
            "job_context": None,
            "professional_summary": None,
            "selected_skill_ids": None,
            "experience_bullets": None,
            "draft_response": None,
        }

        with patch.object(resume_generation, "_invoke_structured", fake_structured):
            final_state = await resume_generation.resume_generation_graph.ainvoke(
                initial_state
            )

        self.assertEqual(len(calls), 4)
        response = final_state["draft_response"]
        self.assertIn("## Professional Summary", response.markdown)
        self.assertIn("FastAPI, Python", response.markdown)
        self.assertIn("Built a reliable API", response.markdown)
        self.assertTrue(response.has_experience)
        self.assertTrue(response.has_skills)


class PromptLoaderTests(unittest.TestCase):
    """Tests safe one-pass prompt placeholder substitution."""

    def test_inserted_placeholder_text_is_not_expanded_again(self) -> None:
        messages, _ = load_prompt("extract_resume", resume="{resume} is literal")
        self.assertIn("{resume} is literal", messages[-1].content)


class ResumeGenerationServiceTests(unittest.TestCase):
    """Tests deterministic career calculations and formatting."""

    def test_experience_years_merge_overlapping_roles(self) -> None:
        companies = [
            CompanyWorked(
                company_name="Acme",
                start_date=date(2020, 1, 1),
                end_date=date(2021, 12, 31),
                actively_working=False,
            ),
            CompanyWorked(
                company_name="Beta",
                start_date=date(2021, 6, 1),
                end_date=date(2022, 12, 31),
                actively_working=False,
            ),
        ]
        years = ResumeGenerationService._completed_experience_years(
            companies,
            today=date(2026, 3, 15),
        )
        self.assertEqual(years, 3)

    def test_education_block_uses_required_structure(self) -> None:
        education = Education(
            degree="BSc Computer Science",
            institution="Example University",
            description="Graduated with honours",
            start_date=date(2015, 9, 1),
            end_date=date(2019, 5, 31),
        )
        block = ResumeGenerationService._education_block(education)
        self.assertEqual(
            block,
            "### BSc Computer Science - Example University (Sep 2015 \u2013 May 2019)\n"
            "- Graduated with honours",
        )


class ResumeGenerationRequestTests(unittest.TestCase):
    """Tests request normalization at the API boundary."""

    def test_blank_job_description_means_generic_generation(self) -> None:
        request = ResumeGenerationRequest(job_description="   \n  ")
        self.assertIsNone(request.job_description)

    def test_rejects_oversized_job_description(self) -> None:
        with self.assertRaises(ValidationError):
            ResumeGenerationRequest(job_description="x" * 50_001)

    def test_generated_text_is_markdown_safe_and_single_line(self) -> None:
        summary = GeneratedProfessionalSummary(
            text="- Built `<100ms` APIs | Python\nand Go"
        )
        self.assertEqual(
            summary.text,
            "Built less than 100ms APIs / Python and Go",
        )


class ResumeGenerationConfigurationTests(unittest.IsolatedAsyncioTestCase):
    """A missing LLM credential is a server misconfiguration, not a retryable failure."""

    async def test_missing_api_key_raises_configuration_error(self) -> None:
        settings = SimpleNamespace(LLM_API_KEY="", LLM_BASE_URL="https://api.example/v1")
        with patch.object(resume_generation, "get_settings", return_value=settings):
            with self.assertRaises(ResumeGenerationConfigurationError):
                await resume_generation._invoke_structured(
                    "extract_resume",
                    GeneratedProfessionalSummary,
                    {},
                    resume="R",
                )

    async def test_configuration_error_maps_to_503(self) -> None:
        with patch.object(
            ResumeGenerationService,
            "generate",
            AsyncMock(side_effect=ResumeGenerationConfigurationError("LLM_API_KEY is not configured")),
        ):
            with self.assertRaises(HTTPException) as raised:
                await generate_resume_endpoint(
                    ResumeGenerationRequest(),
                    cast(User, SimpleNamespace(id=1)),
                    AsyncMock(),
                )
        self.assertEqual(raised.exception.status_code, 503)
        self.assertIn("not configured", raised.exception.detail)

    async def test_workflow_failure_still_maps_to_502(self) -> None:
        with patch.object(
            ResumeGenerationService,
            "generate",
            AsyncMock(side_effect=ResumeGenerationError("The model selected a skill outside the candidate's data")),
        ):
            with self.assertRaises(HTTPException) as raised:
                await generate_resume_endpoint(
                    ResumeGenerationRequest(),
                    cast(User, SimpleNamespace(id=1)),
                    AsyncMock(),
                )
        self.assertEqual(raised.exception.status_code, 502)
        self.assertEqual(
            raised.exception.detail,
            "Resume generation failed. Please try again.",
        )


if __name__ == "__main__":
    unittest.main()
