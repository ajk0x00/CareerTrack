# Job Posting & Application Pipeline Model and CRUD API Endpoints

**Date**: 2026-10-11

## 1. Changes Made
- `app/models/job.py`: Created SQLAlchemy `Job` model inheriting from `Base` with `JobStatus` and `WorkplaceType` enums:
  - Job posting attributes: `title` (required), `company_name` (required), `job_url`, `location`, `workplace_type` (`remote`, `hybrid`, `on_site`), `employment_type` (`full_time`, `part_time`, `contract`, `internship`), `department`, `description` (full job posting text for ATS resume tailoring), `requirements`, `salary_min`, `salary_max`, `salary_currency`, `salary_interval` (`yearly`, `monthly`, `hourly`), `posted_date`, `deadline_date`.
  - Application pipeline state attributes: `status` (indexed, defaults to `saved`, stages matching frontend `JobPipeline`: `saved`, `applied`, `interviewing`, `offer`), `current_stage` (e.g. specific interview round), `applied_date`, `excitement_rating` (1-5 rating), `notes`.
  - Contact attributes: `contact_name`, `contact_email`, `contact_phone`.
  - Relational & audit columns: `id`, `user_id` (foreign key to `users.id` with `CASCADE` delete), `created_at`, `updated_at`.
- `app/models/__init__.py`: Re-exported `Job`, `JobStatus`, and `WorkplaceType`.
- `alembic/versions/3a26aef408c1_create_jobs_table.py`: Created and applied Alembic migration to create `jobs` table with indexes on `id`, `user_id`, and `status`.
- `app/schemas/job.py`: Created strict Pydantic schemas:
  - `JobBase`: Base schema validating whitespace-trimmed non-empty title and company name, enum normalization, cross-field validation ensuring `salary_max >= salary_min` and `deadline_date >= posted_date`.
  - `JobCreate`: Creation payload schema.
  - `JobUpdate`: Partial update payload schema supporting optional fields and effective-state cross-field validations.
  - `JobResponse`: Response serialization schema with `from_attributes=True`.
  - `JobPipelineSummary`: Summary schema aggregating job counts across the four pipeline stages (`saved`, `applied`, `interviewing`, `offer`) and total count.
- `app/schemas/__init__.py`: Re-exported `JobBase`, `JobCreate`, `JobPipelineSummary`, `JobResponse`, `JobStatus`, `JobUpdate`, `SalaryInterval`, and `WorkplaceType`.
- `frontend/src/types/workspace.ts`: Added `JobStatus`, `JobItem`, `JobCreateInput`, `JobUpdateInput`, and `JobPipelineSummary` matching the backend model.
- `frontend/src/components/workspace/JobPipeline.tsx`: Integrated `JobStatus` type for `PipelineJob.stage`.
- `app/api/v1/endpoints/jobs.py`: Implemented authenticated user-scoped CRUD endpoints:
  - `GET /api/v1/jobs`: Lists jobs for current user with filtering by `status`, `workplace_type`, `employment_type`, search term `q` across title/company/location, and configurable sorting.
  - `GET /api/v1/jobs/pipeline/summary`: Returns aggregate count of applications across all four pipeline stages (`saved`, `applied`, `interviewing`, `offer`, `total`).
  - `POST /api/v1/jobs`: Creates a job posting entry (`201 Created`), auto-populating `applied_date` to today when status is `applied` if no date was provided.
  - `GET /api/v1/jobs/{job_id}`: Retrieves a single job by ID with user ownership check (`404` if not found).
  - `PATCH /api/v1/jobs/{job_id}`: Partially updates a job with cross-field salary and date validation.
  - `DELETE /api/v1/jobs/{job_id}`: Deletes a job record (`204 No Content`) with ownership verification.
- `app/api/v1/router.py`: Mounted jobs router under `/jobs` with tag `Jobs`.
- `app/mcp/tools.py`: Implemented MCP read and create tools for Job:
  - `get_jobs`: Retrieves tracked job postings with optional filters for `status` (`saved`, `applied`, `interviewing`, `offer`), `workplace_type` (`remote`, `hybrid`, `on_site`), or keyword query `query`.
  - `get_job`: Retrieves full details of a specific job by `job_id`.
  - `get_job_pipeline_summary`: Aggregates active pipeline counts across stages (`saved`, `applied`, `interviewing`, `offer`, `total`).
  - `add_job` and `create_job` (alias): Adds a new job posting directly to the user's career pipeline with input validation, cross-field checks, auto-populated applied dates, and commit.
  - `get_career_context`: Enriched unified career context snapshot with `job_pipeline` active opportunities and stage distribution.
- `app/mcp/resources.py`: Added URI resources for direct assistant reads:
  - `careertrack://jobs`: Returns user's active job opportunities and pipeline details.
  - `careertrack://job-pipeline-summary`: Returns stage breakdown counts.
  - `careertrack://career-context`: Enriched with `job_pipeline` section.
- `app/mcp/server.py`: Updated MCP server description to include job application pipeline tracking.

## 2. Why the Change Was Made (Rationale)
- The user requested a data model and CRUD endpoints for jobs, requiring complete details of the job posting (title, company, description, requirements, salary, location, workplace/employment type, dates) as well as the applicant's current state in their job pipeline (status stages, current interview round, applied date, excitement rating, personal notes, recruiter contact info).
- In careerTrack, storing job posting descriptions and requirements is critical because it powers the ATS-friendly resume tailoring workflow where a user's logged accomplishments and skills are mapped directly to a specific target job posting.
- Strict multi-tenant isolation ensures each user only views and modifies their own jobs and pipeline metrics.
- Async database sessions follow the repo's established pattern: routes use `await db.flush()` and transactions commit automatically upon completion via `get_db`.

## 3. Things to Lookout for in Future Development
- **Database Migration Prerequisite**: Ensure `alembic upgrade head` is executed on any fresh environment to create the `jobs` table (revision `3a26aef408c1`).
- **Cascade Deletion**: When a user account is deleted, all corresponding records in `jobs` are automatically removed via PostgreSQL `ON DELETE CASCADE`.
- **ATS Resume Workspace Integration**: The job description and requirements fields can be hooked up directly to the tailored resume workspace (`TailoredResumeWorkspace.tsx`), enabling one-click targeting of a specific tracked job in the user's pipeline.
- **Kanban / Pipeline Board UI**: The `/api/v1/jobs/pipeline/summary` and `/api/v1/jobs` endpoints can power a drag-and-drop Kanban board for moving jobs between `saved` -> `applied` -> `screening` -> `interviewing` -> `offer` -> `accepted`.
