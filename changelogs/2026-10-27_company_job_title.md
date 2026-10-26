# First-Class Company Job Title

**Date**: 2026-10-27

## 1. Changes Made
- `app/models/company.py`: Added nullable `job_title: Mapped[str | None]` (`String(150)`) to `CompanyWorked`.
- `alembic/versions/7eebe1b4462b_add_job_title_to_companies_worked.py`: Added the nullable `companies_worked.job_title` column; downgrade drops it.
- `app/schemas/company.py`: Added optional `job_title` to the base, update, and response schemas, with whitespace stripping and empty-string-to-`None` normalization.
- `app/api/v1/endpoints/companies.py`: Accepts and persists `job_title` on create and update.
- `app/llm/graph.py`: Resume import now stores the extracted `title` in `CompanyWorked.job_title` on create and refreshes it on update when a non-empty title is extracted. Removed the `Role: <title>` `ExperienceLog` pseudo-accomplishment block.
- `app/services/resume.py`: Removed the `_ROLE_PREFIX` filter and renders experience headings as `**{job_title} — {company_name}**`, falling back to `**{company_name}**` when no title is set.
- `app/mcp/tools.py`, `app/mcp/resources.py`, `app/mcp/experience.py`: Added `job_title` to employment timeline and experience-log payloads.
- `frontend/src/types/workspace.ts`: Added `job_title` to `CompanyWorkedItem`, `CompanyWorkedCreateInput`, and `CompanyWorkedUpdateInput`.
- `frontend/src/components/workspace/settings/CompanyForm.tsx`: Added an optional "Job title" input (max 150) next to the company name; trimmed and sent as `null` when empty.
- `frontend/src/components/workspace/settings/CompanyTimelineItem.tsx`: Shows the job title as the primary line with the company name beneath, falling back to company-only.
- `frontend/src/components/workspace/ExperienceModal.tsx`: Company selector options now include the job title to disambiguate multiple roles at the same employer.
- `frontend/src/index.css`: Added styles for the two-column company/job-title form row and the timeline company line.

## 2. Why the Change Was Made (Rationale)
- A work-history entry previously stored only the employer and dates. The job title had no column, so the LLM import encoded it as a fake `ExperienceLog` whose description was `Role: <title>`, and the resume draft had to filter those rows out again.
- Adding a nullable `job_title` column makes the title first-class without breaking existing rows or old clients, and deleting the `Role:` workaround removes a lossy round-trip between import, storage, and resume rendering.
- `CompanyUpdate` treats the field as optional and the endpoint assigns it whenever the key is present, so a user can also clear a previously stored title.

## 3. Things to Lookout for in Future Development
- Legacy `companies_worked` rows have `job_title = NULL`, so the resume draft deliberately falls back to the company-only heading until the user fills the field in.
- The import no longer creates `Role:` rows. Re-importing a resume will not backfill titles for companies that only ever got a `Role:` row; the user must edit the work-history entry to set the title.
- Existing `Role:` `experience_logs` rows from earlier imports are not deleted by the migration. Now that the draft filter is gone, they will render as ordinary bullets until they are cleaned up or edited.
- The frontend company form now exposes the job title field, including in the inline edit form on the career timeline.
- Run `alembic upgrade head` in every environment before deploying code that reads `job_title`; without the migration, company queries will fail on the missing column.
