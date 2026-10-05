# Workspace Backend Model & CRUD API Endpoints

**Date**: 2026-10-05

## 1. Changes Made
- `app/models/workspace.py`: Created SQLAlchemy `Workspace` model storing user workspaces with columns `id`, `user_id` (foreign key to `users.id` with `CASCADE` delete), `name` (`String(100)`, not nullable), `created_at`, and `updated_at`.
- `app/models/__init__.py`: Re-exported `Workspace`.
- `alembic/versions/4004d25d9d46_create_workspaces_table.py`: Generated and applied Alembic migration creating the `workspaces` table with indexes on `id` and `user_id`.
- `app/schemas/workspace.py`: Created strict Pydantic schemas:
  - `WorkspaceBase`: Base schema validating non-empty whitespace-trimmed `name` (max 100 characters).
  - `WorkspaceCreate`: Creation payload schema inheriting base validation.
  - `WorkspaceUpdate`: Partial update payload schema supporting name updates with string validation.
  - `WorkspaceResponse`: Response schema with `from_attributes=True` for serializing database rows to JSON.
- `app/schemas/__init__.py`: Re-exported `WorkspaceBase`, `WorkspaceCreate`, `WorkspaceResponse`, and `WorkspaceUpdate`.
- `app/api/v1/endpoints/workspaces.py`: Implemented authenticated user-scoped CRUD endpoints:
  - `GET /api/v1/workspaces`: Lists all workspaces for the authenticated user ordered by `created_at` ascending, with optional `q` name search query parameter.
  - `POST /api/v1/workspaces`: Creates a new workspace (`201 Created`) with duplicate name prevention per user.
  - `GET /api/v1/workspaces/{workspace_id}`: Retrieves a single workspace by ID with ownership verification (`404` if not found).
  - `PATCH /api/v1/workspaces/{workspace_id}`: Partially updates a workspace with duplicate name collision validation.
  - `DELETE /api/v1/workspaces/{workspace_id}`: Deletes a workspace (`204 No Content`) with ownership verification.
- `app/api/v1/router.py`: Mounted workspaces router under `/workspaces` with tag `Workspaces`.

## 2. Why the Change Was Made (Rationale)
- The user requested implementing the Workspace data model and CRUD APIs, specifying that Workspace will just have a `name`.
- In careerTrack, workspaces represent distinct career context projects or resumes being prepared for different tracks (e.g. "Tailored Resume Generator", "Executive Bio & Pitch Deck", "Cover Letter Synthesizer").
- Scoping all queries to `current_user.id` guarantees tenant isolation so users can only access and manipulate their own workspaces.
- Standard async session semantics were preserved: flushes use `await db.flush()` and transactions commit automatically through `get_db`.

## 3. Things to Lookout for in Future Development
- **Database Migration Prerequisite**: Ensure `alembic upgrade head` is executed on any fresh environment to create the `workspaces` table (revision `4004d25d9d46`).
- **Cascade Deletion**: When a user account is deleted, all corresponding workspace records are automatically removed via PostgreSQL `ON DELETE CASCADE`.
- **Frontend Switcher Integration**: The `WorkspaceSwitcher` component in the navbar can be wired to fetch, create, and switch between dynamic workspace records from `/api/v1/workspaces`.
