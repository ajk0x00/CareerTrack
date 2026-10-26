# AI Resume Generation with LangGraph

**Date**: 2026-10-26

## 1. Changes Made

- `app/llm/resume_generation.py`: Added `ResumeGenerationConfigurationError` (a `ResumeGenerationError` subclass) for missing credentials or base URL, so configuration failures are distinguishable from workflow failures. Added a compiled LangGraph workflow with `prepare_job_context`, parallel `generate_professional_summary`, `select_and_order_skills`, and `select_and_rewrite_experience` branches, followed by deterministic `compose_resume` assembly.
- `app/prompts/analyze_resume_job.md`: Added structured job-description analysis that routes summary, skills, and experience context to the corresponding branch.
- `app/prompts/generate_resume_summary.md`: Added the tailored/generic professional-summary prompt with source-bound factual constraints.
- `app/prompts/tailor_resume_skills.md`: Added the prompt that selects and ranks existing skill IDs without allowing invented skill names.
- `app/prompts/tailor_resume_experience.md`: Added the prompt that selects source accomplishment IDs and rewrites them without adding facts or metrics.
- `app/schemas/resume.py`: Added `ResumeGenerationRequest` and typed job-context, summary, skill-selection, experience-selection, and candidate-context models. Generated prose is normalized to Markdown-safe single lines.
- `app/llm/prompt.py`: Role sections are now compiled into a `ChatPromptTemplate` and rendered with `format_messages()`, so LangChain owns placeholder substitution instead of a hand-rolled regex pass. Substituted values are never re-interpreted as templates, a missing variable fails with the prompt and variable name, and an unescaped literal brace is reported as such rather than as a bogus variable. The prompt-name argument was renamed `prompt_name` so a template may declare a `{name}` variable.
- `app/core/config.py`: Added bounded `LLM_TIMEOUT_SECONDS` and `LLM_MAX_RETRIES` settings for generation calls.
- `.env.example`: Documented the LLM timeout and retry settings.
- `app/services/resume.py`: Extracted shared user-scoped career loading into `_CareerSnapshot`, added deterministic experience-year calculation from merged employment intervals, education formatting, candidate-context construction, and the `ResumeGenerationService` graph orchestrator.
- `app/api/v1/endpoints/resumes.py`: Added authenticated `POST /api/v1/resumes/generate`, with optional `job_id` and `job_description`. A supplied description takes precedence; otherwise the owned stored job is used. No effective description runs generic mode. Added ownership and 404 handling, non-leaking `502` for workflow failures, and `503` for an unconfigured server.
- `frontend/src/types/resume.ts`: Added `ResumeGenerateInput`.
- `frontend/src/api/resumes.ts`: Added the typed `generateResume` client.
- `frontend/src/components/workspace/TailoredResumeWorkspace.tsx`: Wired Generate to the AI endpoint, passed the current job ID and description, added a duplicate-request guard, cleared stale job fields and ATS results when they no longer match the displayed draft, and removed the implicit sample Stripe job from a new workspace.
- `frontend/src/components/workspace/JobDescriptionPanel.tsx`: Replaced the hardcoded parsed-skill count with generic/tailored mode and changed the CTA label for generic generation.
- `tests/test_resume_generation.py`: Added coverage for missing-credential classification and the `503`/`502` endpoint mapping, required section order, source-ID validation, generic-mode job-context skipping, mocked graph fan-out/fan-in, request normalization, overlapping employment-year calculation, and education formatting.
- `changelogs/2026-10-26_ai_resume_generation.md`: Documented this task.

No database migration, new runtime dependency, or infrastructure change was required. Two optional LLM tuning variables were added with defaults.

## 2. Why the Change Was Made (Rationale)

- The requested workflow needs independent, target-specific treatment of the summary, skills, and experience while guaranteeing a stable final resume structure. LangGraph makes those branches explicit and parallel; deterministic composition prevents the model from changing section order, dates, employers, skill names, or contact information.
- Skills are selected by source ID and resolved back to canonical database names, and experience is selected by source log ID. This allows ATS-oriented ordering and rewriting without permitting invented skills or mapped accomplishments.
- The professional summary is generated in both modes. With a job it is aligned to the supplied context; without one it is a generic summary based only on stored career data.
- Existing `GET /api/v1/resumes/draft` remains the fast deterministic initial-page fallback. AI generation runs only when the user clicks Generate, avoiding provider cost and latency on every page load.
- The endpoint returns unsaved Markdown, preserving the existing explicit Save and historical-resume behavior instead of silently overwriting stored documents.
- The previous new-workspace defaults silently targeted a sample Stripe description. Blank defaults plus an explicit Reload Sample action make generic generation truthful and prevent accidental sample tailoring.

## 3. Things to Lookout for in Future Development

- A tailored request performs four LLM calls (job analysis plus three branches); a generic request performs three. Provider latency, rate limits, and cost should be monitored, and the graph currently has no retry or per-user throttling layer.
- Source-ID validation prevents invented skills and accomplishment mappings, but it cannot mechanically prove that rewritten summary or bullet prose preserves every fact. The prompts forbid invented claims and metrics; stronger fact-checking would require an additional verification node or deterministic claim checks.
- `years_experience` counts merged, non-overlapping employment months and floors to completed years. Gaps are not counted, `end_date = NULL` is treated as ongoing, and less than one year is sent to the prompt as `0`.
- Generated resumes are not saved or versioned automatically. They remain a dirty editor buffer until the existing Save action persists them, and repeated generation against a saved document replaces the visible buffer only.
- In generic mode the generated draft is tied to no job. Saving from a job-specific workspace uses the existing `jobId`; saving from the master workspace updates or creates the canonical resume.
- Stored job descriptions are combined with requirements server-side. A non-blank request description overrides the stored text, but a supplied `job_id` is still ownership-checked.
- Request descriptions are capped at 50,000 characters. Stored descriptions are not revalidated against that cap before being sent to the provider.
- Generated text is stripped of unsupported Markdown/HTML constructs and collapsed to one line, but stored employer, skill, and education values can still contain Markdown that the PDF exporter rejects.
- The client guards against duplicate Generate clicks, but the API itself is not idempotent or rate-limited. Because generation performs no writes, retries cannot duplicate database records.
- The graph requires `LLM_API_KEY`; a missing key or blank base URL now returns `503` naming the misconfiguration, while model-side failures stay `502`. The messages still do not echo the key itself or upstream provider errors, so diagnosing a bad credential requires the server log.
- Prompt bodies are now LangChain templates, so any literal brace in a prompt must be written `{{` or `}}`. `load_prompt` fails loudly on an unescaped brace rather than sending a half-rendered prompt to the model.
- Unit tests mock the model and do not require PostgreSQL or an LLM provider. A real-provider smoke test and route-level integration test remain follow-up verification when those services are available.
