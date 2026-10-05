# Companies Worked In Model & CRUD API Endpoints

**Date**: 2026-10-05

## 1. Changes Made
- `app/models/company.py`: Created SQLAlchemy `CompanyWorked` model representing companies worked in by a user, including columns `id`, `user_id` (foreign key to `users.id` with `CASCADE` delete), `company_name` (`String(255)`), `start_date` (`Date`), `end_date` (`Date`, nullable), `actively_working` (`Boolean`, default `False`), `created_at`, and `updated_at`.
- `app/models/__init__.py`: Re-exported `CompanyWorked`.
- `alembic/versions/e14f776cf8d3_create_companies_worked_table.py`: Generated and applied Alembic migration creating the `companies_worked` table with indexes on `id` and `user_id`.
- `app/schemas/company.py`: Created strict Pydantic schemas:
  - `CompanyWorkedBase`: Base schema validating company name length, non-empty whitespace stripping, and cross-field date validation (ensuring `end_date >= start_date` when provided and clearing `end_date` when `actively_working` is `True`).
  - `CompanyWorkedCreate`: Creation payload schema inheriting base validation.
  - `CompanyWorkedUpdate`: Partial update payload schema supporting field-level updates and cross-field date checks.
  - `CompanyWorkedResponse`: Response schema with `from_attributes=True` for serializing database rows to JSON.
- `app/schemas/__init__.py`: Re-exported `CompanyWorkedBase`, `CompanyWorkedCreate`, `CompanyWorkedResponse`, and `CompanyWorkedUpdate`.
- `app/api/v1/endpoints/companies.py`: Implemented authenticated user-scoped CRUD endpoints:
  - `GET /api/v1/companies`: Lists companies worked in for the authenticated user ordered by `start_date` descending, with optional `actively_working` boolean filter.
  - `POST /api/v1/companies`: Creates a new company worked in entry (`201 Created`).
  - `GET /api/v1/companies/{company_id}`: Retrieves a single company worked in entry with user ownership check (`404` if not found).
  - `PATCH /api/v1/companies/{company_id}`: Partially updates a company worked in entry with date consistency validation.
  - `DELETE /api/v1/companies/{company_id}`: Deletes a company worked in entry (`204 No Content`) with user ownership check.
- `app/api/v1/router.py`: Mounted companies router under `/api/v1/companies` with tag `Companies Worked In`.

## 2. Why the Change Was Made (Rationale)
- The user requested a data model and CRUD API endpoints for storing "Companies worked in", specifically requiring: start date, end date, actively working (boolean), and company name.
- Storing discrete company work histories linked to `users.id` allows the careerTrack system to track a user's past and active employers, which serves as foundational data for logging achievements and generating tailored ATS resumes.
- User data isolation is enforced on every endpoint by filtering through `current_user.id`, ensuring users cannot inspect or manipulate other users' company entries.
- Async database sessions follow the repo's established pattern: routes perform `await db.flush()` without committing, relying on `get_db` to commit upon successful request completion.

## 3. Things to Lookout for in Future Development
- **Database Migration Prerequisite**: Ensure `alembic upgrade head` is run on any deployment or test environment to create the `companies_worked` table (revision `e14f776cf8d3`).
- **Date Handling**: `start_date` and `end_date` are stored as SQL `DATE` types (`YYYY-MM-DD`). Frontend consumers should format values as ISO date strings (`YYYY-MM-DD`).
- **Actively Working Semantics**: When `actively_working` is set to `True`, `end_date` is automatically normalized to `None`.
- **Cascade Deletion**: When a user account is deleted, all corresponding entries in `companies_worked` are automatically deleted via PostgreSQL `ON DELETE CASCADE`.
