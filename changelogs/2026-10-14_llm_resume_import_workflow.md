# LLM Resume Import Workflow

**Date**: 2026-10-14

## 1. Changes Made
- `requirements.txt`: Added `langgraph`, `langsmith`, `langchain-core`, `langchain-openai`, and `pyyaml` runtime dependencies.
- `app/core/config.py`: Added `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, and `LLM_TEMPERATURE` alongside `LANGCHAIN_TRACING_V2`, `LANGCHAIN_API_KEY`, `LANGCHAIN_PROJECT`, and `LANGCHAIN_ENDPOINT` settings (removed `LLM_MAX_TOKENS`).
- `.env.example`: Documented LLM configuration, model parameters, and LangSmith tracing variables without max token limits.
- `app/main.py`: Synchronized LangSmith environment variables in lifespan startup for tracing.
- `app/llm/graph.py`: Built LangGraph `resume_extraction_graph` with `extract_resume` and `upsert_database` nodes using `ChatOpenAI.with_structured_output(ResumeExtraction)` and automatic LangSmith tracing.
- `app/llm/prompt.py`: Added `PromptLLMConfig` and `load_prompt()` supporting YAML frontmatter (`---`) to control LLM parameters (`model`, `temperature`, `base_url`) per prompt with graceful fallbacks to application `Settings`. Removed `max_tokens` constraint.
- `app/prompts/extract_resume.md`: Configured with YAML frontmatter specifying model (`accounts/fireworks/models/glm-5p3`) and temperature (`0.1`), followed by `# System` and `# User` sections.
- `app/schemas/resume.py`: Defined `ExtractedCompany`, `ExtractedSkill`, `ResumeExtraction`, `ResumeImportRequest`, and `ResumeImportResponse` Pydantic models with rich field descriptions and enum constraints.
- `app/schemas/__init__.py`: Exported resume models and request/response schemas.
- `app/services/resume.py`: Orchestrates resume extraction and database upserts through the compiled LangGraph workflow.
- `app/api/v1/endpoints/resume.py`: Added `POST /api/v1/resume/import` endpoint; removed stale `LLMError` import.
- `app/api/v1/router.py`: Mounted resume endpoint router under `/resume`.
- `frontend/src/components/workspace/ResumeCanvas.tsx`: Replaced textual labels in segmented control with icons and added "Upload Resume" button.
- `frontend/src/components/workspace/ResumeUploadModal.tsx`: Created modal with drag-and-drop file upload, markdown editor, and sync to `POST /api/v1/resume/import`.

## 2. Why the Change Was Made (Rationale)
- The user requested removing `max_tokens` limits across prompt frontmatter, Settings, and ChatOpenAI calls so that generation is not artificially capped and structured JSON outputs can fully finish streaming.
- `load_prompt()` parses the YAML frontmatter at the top of the file into a `PromptLLMConfig` instance (`model`, `temperature`, `base_url`). Any omitted parameters automatically fall back to the global application `Settings`.
- LangGraph's `extract_resume_node` dynamically instantiates `ChatOpenAI` using the prompt-specific configuration.
- The upsert logic respects existing user data by never deleting records, matching existing companies and skills, and skipping duplicate accomplishment logs.

## 3. Things to Lookout for in Future Development
- `CompanyWorked` currently does not have a dedicated `title` column in the database; extracted job titles are preserved in `ExperienceLog.description` as `Role: <title>`. A future migration could add a `title` column directly to `CompanyWorked`.
- Upstream provider timeouts for extremely long resumes when no token cap is specified.
- When deploying in production, ensure `LLM_API_KEY` is provided in the container environment.
