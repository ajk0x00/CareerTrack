# MCP Server Integration for CareerTrack

**Date**: 2026-10-05

## 1. Changes Made
- `requirements.txt` & `pyproject.toml`: Added approved runtime dependency `mcp>=1.0.0` (using official `mcp` SDK v2.3.0).
- `AGENTS.md`: Added `mcp` to approved runtime dependencies list.
- `app/mcp/__init__.py`: Package initialization with lazy loader for `create_mcp_server` and `server`.
- `app/mcp/auth.py`: Implemented `CareerTrackTokenVerifier(TokenVerifier)` and `resolve_user()` supporting standard JWT Bearer token authentication via `CAREERTRACK_AUTH_TOKEN` environment variable, request headers (`Authorization: Bearer <token>`), and explicit `auth_token` arguments.
- `app/mcp/experience.py`: Implemented ATS-grade experience calculation algorithms including non-overlapping interval merging for accurate calendar career tenure, formatted tenure strings (e.g. `3 years, 2 months`), and employment type breakdown.
- `app/mcp/tools.py`: Implemented 15 standardized MCP tools:
  - Skills: `get_skills`, `add_skill`, `update_skill`, `delete_skill`
  - Preferences: `get_preferences`, `add_preference`, `update_preference`, `delete_preference`
  - Work Experience: `get_work_experience`, `get_experience_summary`, `add_work_experience`, `update_work_experience`, `delete_work_experience`
  - Workspaces: `get_workspaces`
  - Unified Context: `get_career_context` (aggregates profile, total experience, active roles, skills matrix by proficiency, preferences by importance, and workspaces)
- `app/mcp/resources.py`: Implemented 6 MCP URI resources for direct assistant reads:
  - `careertrack://profile`
  - `careertrack://skills`
  - `careertrack://preferences`
  - `careertrack://experience`
  - `careertrack://experience-summary`
  - `careertrack://career-context`
- `app/models/api_client.py` & `app/models/__init__.py`: Created `ApiClient` model for storing per-user API client credentials with `client_id`, `client_secret_hash` (bcrypt), `client_secret_prefix`, and timestamps.
- `alembic/versions/07538b2138fc_create_api_clients_table.py`: Created and applied migration for the `api_clients` table.
- `app/schemas/api_client.py` & `app/schemas/__init__.py`: Defined schemas `ApiClientCreate`, `ApiClientResponse`, and `ApiClientCreateResponse`.
- `app/api/v1/endpoints/api_clients.py` & `app/api/v1/router.py`: Implemented CRUD API endpoints (`GET /api/v1/api-clients`, `POST /api/v1/api-clients`, `DELETE /api/v1/api-clients/{client_id}`) under `/api-clients`.
- `app/mcp/auth.py` & `app/mcp/server.py`: Enhanced authentication to natively support Client ID and Client Secret via:
  - Custom headers (`X-Client-ID` and `X-Client-Secret`)
  - HTTP Basic Auth (`Authorization: Basic base64(client_id:client_secret)`)
  - Query parameters (`?client_id=...&client_secret=...` with session-bound token caching for message POSTs)
  - Stdio CLI flags (`--client-id` and `--client-secret`) and environment variables (`CAREERTRACK_CLIENT_ID` and `CAREERTRACK_CLIENT_SECRET`)
- `frontend/src/components/workspace/settings/IntegrationsTab.tsx`, `SettingsSidebar.tsx`, `SettingsModal.tsx`: Added an "MCP & API Keys" tab in the Workspace & Account Settings modal where users can generate new Client ID & Secret credentials, copy ready-to-use Claude Desktop / Cursor configuration snippets, and revoke active credentials.
- `.env.example`: Added `CAREERTRACK_CLIENT_ID` and `CAREERTRACK_CLIENT_SECRET` configuration fields.

## 2. Why the Change Was Made (Rationale)
- The user requested Client ID and Client Secret authentication for the MCP server so that external AI applications (Claude Desktop, Cursor, AI agents) can authenticate with persistent, revocable service credentials rather than requiring manual user login or short-lived JWT tokens.
- Following the approved database-backed approach, each user can independently generate multiple named API clients (e.g. "Work Laptop Claude", "Cursor IDE"), view when they were last used, and revoke them at any time without resetting their user account.
- Client secrets are hashed with bcrypt before storing in PostgreSQL, and only revealed once upon generation.
- The MCP server automatically verifies the Client ID & Secret on incoming requests across all transports (HTTP headers, Basic Auth, SSE query parameters, and stdio CLI).

## 3. Things to Lookout for in Future Development
- **Single Secret Display**: The raw `client_secret` is only returned on initial creation (`POST /api/v1/api-clients`) and cannot be retrieved later; users must copy it or generate a replacement if lost.
- **Session Token Caching**: When connecting over SSE with query parameters (`?client_id=...&client_secret=...`), the server generates a session bearer token and caches it keyed by `session_id`, ensuring the subsequent JSON-RPC message POSTs authenticate smoothly without needing headers.
- **Revocation**: Deleting an API client via `DELETE /api/v1/api-clients/{client_id}` immediately revokes all access for that Client ID on subsequent MCP requests.
