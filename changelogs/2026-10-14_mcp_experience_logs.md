# Expose Experience Accomplishment Logs in CareerTrack MCP Server

**Date**: 2026-10-14

## 1. Changes Made
- `app/mcp/tools.py`:
  - Enriched `get_work_experience` with optional `include_logs: bool = True` parameter to attach `experience_logs` and `total_logs` under each company in the timeline.
  - Implemented `get_experience_logs` tool supporting filtering by `company_name`, `company_id`, `q` (search text in accomplishment description), and `limit`.
  - Implemented `add_experience_log` and `create_experience_log` (alias) tools allowing clients to log accomplishments by company name or company ID, with automatic provisioning of `CompanyWorked` if the company does not exist yet.
  - Added `get_profile` tool to expose user public profile details (ID, name, address, socials) while strictly omitting private contact information (`email` and `phone`).
  - Renamed `get_work_experience` to `get_employment_history` and `get_experience_logs` to `get_work_accomplishments` to eliminate naming confusion between company tenures/dates and individual project accomplishment logs.
  - Significantly enhanced descriptions for `get_employment_history` and `get_work_accomplishments`, clearly delineating their distinct purposes and guiding LLM callers on when to use each (and when not to).
  - Streamlined exposed tools to exactly 6: `get_profile`, `get_skills`, `get_preferences`, `get_employment_history`, `get_work_accomplishments`, and `add_job`.
  - Removed unused and duplicate tools: `get_experience_summary`, `add_experience_log`, `create_experience_log`, `get_workspaces`, `get_jobs`, `get_job`, `get_job_pipeline_summary`, `create_job`, and `get_career_context`.
- `app/mcp/resources.py`:
  - Updated `careertrack://profile` and `careertrack://career-context` resources to also omit `email` and `phone` for privacy consistency.
  - Updated `careertrack://experience` resource to include `experience_logs` and `total_logs` per company.
  - Added new `careertrack://experience-logs` resource exposing all accomplishment logs for direct inspection.
- `app/mcp/server.py`:
  - Updated MCP server description to reflect the streamlined toolset, profile exposure, employment history, and work accomplishments.

## 2. Why the Change Was Made (Rationale)
- While high-level company tenures (`companies_worked`) were exposed via MCP, individual work accomplishment logs from `ExperienceLog` were previously missing from the MCP server.
- The user had 12+ detailed work accomplishment logs (e.g. Postgres migrations, LLM gateways, monorepo refactoring) stored in the database, but external AI agents and resume-generation workflows could not access them.
- Exposing accomplishments in both per-company timeline view and searchable flat lists enables AI assistants to precisely cite quantified achievements when drafting tailored ATS resumes.
- Streamlining the exposed MCP tools to the exact subset needed (`get_profile`, `get_skills`, `get_preferences`, `get_employment_history`, `get_work_accomplishments`, `add_job`) eliminates LLM prompt context bloat and tool confusion for external agent clients.
- Previously, `get_work_experience` and `get_experience_logs` were easily conflated by LLMs due to the repeated word "experience". Renaming them to `get_employment_history` (chronological companies and dates) and `get_work_accomplishments` (specific technical achievements and impact bullet points) creates unambiguous domain boundaries.
- Adding `get_profile` allows connected AI assistants to personalize responses and tailor resumes with the user's name, location, and social links without leaking private contact credentials (`email` and `phone`).

## 3. Things to Lookout for in Future Development
- Exactly 6 tools are exposed over MCP: `get_profile`, `get_skills`, `get_preferences`, `get_employment_history`, `get_work_accomplishments`, and `add_job`.
- `get_profile` and `careertrack://profile` deliberately omit `email` and `phone` for privacy. If contact information is ever needed for external resume rendering, it should only be injected with explicit user consent.
- `get_employment_history` returns company records with both `accomplishments` and backwards-compatible `experience_logs` keys.
- `get_work_accomplishments` supports both `query` and `q` search parameters.
- Full CRUD operations and administrative actions continue to be available through the authenticated REST API (`/api/v1/...`).
- All tools strictly enforce user isolation through `resolve_user()`.
