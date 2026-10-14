# Expose Experience Accomplishment Logs in CareerTrack MCP Server

**Date**: 2026-10-14

## 1. Changes Made
- `app/mcp/tools.py`:
  - Enriched `get_work_experience` with optional `include_logs: bool = True` parameter to attach `experience_logs` and `total_logs` under each company in the timeline.
  - Implemented `get_experience_logs` tool supporting filtering by `company_name`, `company_id`, `q` (search text in accomplishment description), and `limit`.
  - Implemented `add_experience_log` and `create_experience_log` (alias) tools allowing clients to log accomplishments by company name or company ID, with automatic provisioning of `CompanyWorked` if the company does not exist yet.
  - Streamlined exposed tools to exactly 5: `get_skills`, `get_preferences`, `get_work_experience`, `get_experience_logs`, and `add_job`.
  - Removed unused and duplicate tools: `get_experience_summary`, `add_experience_log`, `create_experience_log`, `get_workspaces`, `get_jobs`, `get_job`, `get_job_pipeline_summary`, `create_job`, and `get_career_context`.
- `app/mcp/resources.py`:
  - Updated `careertrack://experience` resource to include `experience_logs` and `total_logs` per company.
  - Added new `careertrack://experience-logs` resource exposing all accomplishment logs for direct inspection.
- `app/mcp/server.py`:
  - Updated MCP server description to reflect the streamlined toolset.

## 2. Why the Change Was Made (Rationale)
- While high-level company tenures (`companies_worked`) were exposed via MCP, individual work accomplishment logs from `ExperienceLog` were previously missing from the MCP server.
- The user had 12+ detailed work accomplishment logs (e.g. Postgres migrations, LLM gateways, monorepo refactoring) stored in the database, but external AI agents and resume-generation workflows could not access them.
- Exposing accomplishments in both per-company timeline view and searchable flat lists enables AI assistants to precisely cite quantified achievements when drafting tailored ATS resumes.
- Streamlining the exposed MCP tools to the exact subset needed (`get_skills`, `get_preferences`, `get_work_experience`, `get_experience_logs`, `add_job`) eliminates LLM prompt context bloat and tool confusion for external agent clients.

## 3. Things to Lookout for in Future Development
- Only 5 tools are exposed over MCP: `get_skills`, `get_preferences`, `get_work_experience`, `get_experience_logs`, and `add_job`. Full CRUD operations and administrative actions continue to be available through the authenticated REST API (`/api/v1/...`).
- All tools strictly enforce user isolation through `resolve_user()`.
