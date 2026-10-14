# Expose Experience Accomplishment Logs in CareerTrack MCP Server

**Date**: 2026-10-14

## 1. Changes Made
- `app/mcp/tools.py`:
  - Enriched `get_work_experience` with optional `include_logs: bool = True` parameter to attach `experience_logs` and `total_logs` under each company in the timeline.
  - Implemented `get_experience_logs` tool supporting filtering by `company_name`, `company_id`, `q` (search text in accomplishment description), and `limit`.
  - Implemented `add_experience_log` and `create_experience_log` (alias) tools allowing clients to log accomplishments by company name or company ID, with automatic provisioning of `CompanyWorked` if the company does not exist yet.
  - Updated `get_career_context` to fetch all user experience logs, enrich the `work_timeline` companies with their respective logs, and provide top-level `experience_logs` list and `total_experience_logs` counter.
- `app/mcp/resources.py`:
  - Updated `careertrack://experience` resource to include `experience_logs` and `total_logs` per company.
  - Added new `careertrack://experience-logs` resource exposing all accomplishment logs for direct inspection.
  - Enriched `careertrack://career-context` resource with `experience_logs` and `total_experience_logs`.
- `app/mcp/server.py`:
  - Updated MCP server description to mention work accomplishments and experience logs.

## 2. Why the Change Was Made (Rationale)
- While high-level company tenures (`companies_worked`) were exposed via MCP, individual work accomplishment logs from `ExperienceLog` were previously missing from the MCP server.
- The user had 12+ detailed work accomplishment logs (e.g. Postgres migrations, LLM gateways, monorepo refactoring) stored in the database, but external AI agents and resume-generation workflows could not access them.
- Exposing accomplishments in both per-company timeline view and searchable flat lists enables AI assistants to precisely cite quantified achievements when drafting tailored ATS resumes.

## 3. Things to Lookout for in Future Development
- When adding experience logs via MCP using `company_name`, if the company does not already exist, it is auto-created with default start date of today and `actively_working=True`. The user can later update the exact employment dates and type via the Career Settings UI.
- All new experience log tools and resources strictly enforce user isolation through `resolve_user()`.
