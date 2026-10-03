# User Preference Backend Model & API Endpoints

**Date**: 2026-10-03

## 1. Changes Made
- `app/models/preference.py`: Created SQLAlchemy `Preference` model storing user preferences with columns `id`, `user_id` (foreign key to `users.id` with `CASCADE` delete), `title` (`String(255)`), `description` (`Text`, optional), `importance` (`String(50)`, default `'medium'`), `created_at`, and `updated_at`. Defined `PreferenceImportance` enum with levels `low`, `medium`, `high`, and `critical`.
- `app/models/__init__.py`: Re-exported `Preference` and `PreferenceImportance`.
- `alembic/versions/c26a5ea63ca9_create_preferences_table.py`: Generated and applied Alembic migration creating the `preferences` table with indexes on `id` and `user_id`.
- `app/schemas/preference.py`: Created strict Pydantic schemas:
  - `PreferenceBase`: Base schema validating non-empty stripped title, description length, and case-insensitive importance mapping (including aliases `must_have` -> `critical`, `nice_to_have` -> `low`).
  - `PreferenceCreate`: Schema for creating a preference.
  - `PreferenceUpdate`: Schema for partial preference updates.
  - `PreferenceResponse`: Schema for returning serialized preference details (`from_attributes=True`).
- `app/schemas/__init__.py`: Re-exported `PreferenceBase`, `PreferenceCreate`, `PreferenceUpdate`, and `PreferenceResponse`.
- `app/api/v1/endpoints/preferences.py`: Implemented authenticated user-scoped endpoints:
  - `GET /api/v1/preferences`: List authenticated user's preferences, with optional `importance` query filter.
  - `POST /api/v1/preferences`: Create a new preference (`201 Created`).
  - `GET /api/v1/preferences/{preference_id}`: Retrieve a single preference with ownership verification.
  - `PATCH /api/v1/preferences/{preference_id}`: Partially update a preference with ownership verification.
  - `DELETE /api/v1/preferences/{preference_id}`: Delete a preference (`204 No Content`) with ownership verification.
- `app/api/v1/router.py`: Mounted preferences router under `/api/v1/preferences` with tag `Preferences`.

## 2. Why the Change Was Made (Rationale)
- The user requested backend models and API endpoints for user preferences (title, description, and importance).
- Storing discrete user preferences as relational rows attached to `users.id` allows users to capture specific priorities (e.g. remote work requirements, target domains, compensation constraints, or technology stack preferences) that feed into ATS resume tailoring.
- Scoping all database operations to `current_user.id` guarantees multi-tenant data isolation, preventing users from accessing or modifying another user's preferences.
- Standard async session rules were followed: flushes are performed via `await db.flush()` and transactions commit automatically in `get_db`.

## 3. Things to Lookout for in Future Development
- **Database Migration Prerequisite**: Ensure `alembic upgrade head` is executed on any fresh environment to create the `preferences` table (revision `c26a5ea63ca9`).
- **Cascade Deletion**: If a user is deleted from the `users` table, all associated preferences are automatically removed via PostgreSQL `ON DELETE CASCADE`.
- **Frontend Integration**: The frontend Preferences tab in the Settings modal can now be wired to fetch and persist items to `/api/v1/preferences`.
