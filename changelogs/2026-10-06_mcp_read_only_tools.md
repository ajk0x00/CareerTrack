# MCP Server Restricted to Read-Only Actions

**Date**: 2026-10-06

## 1. Changes Made
- `app/mcp/tools.py`: Removed all mutation tools (`add_skill`, `update_skill`, `delete_skill`, `add_preference`, `update_preference`, `delete_preference`, `add_work_experience`, `update_work_experience`, `delete_work_experience`). Kept only read tools (`get_skills`, `get_preferences`, `get_work_experience`, `get_experience_summary`, `get_workspaces`, `get_career_context`). Cleaned up unused mutation imports (`date`, `delete`).

## 2. Why the Change Was Made (Rationale)
- The user specified that the Model Context Protocol (MCP) server should only expose read actions.
- MCP is designed to provide safe, read-only career context (skills, career preferences, companies worked in, verified experience timeline, and ATS context) to external AI clients and agents without exposing write or delete capabilities that could lead to unintended modifications or data loss.
- Frontend web application CRUD functionality continues to operate through the authenticated REST API routes (`/api/v1/...`).

## 3. Things to Lookout for in Future Development
- **Read-Only Invariant**: Any future MCP tools added to the server should follow this read-only convention. All mutations belong to authenticated REST endpoints in `app/api/v1/`.
- **Client Tool Discovery**: Clients connecting over MCP Streamable HTTP or SSE will now discover exactly 6 inspection tools and 6 URI resources.
