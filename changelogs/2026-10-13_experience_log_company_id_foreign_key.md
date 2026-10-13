# Experience Log Company Worked Foreign Key Migration

**Date**: 2026-10-13

## 1. Changes Made
- `app/models/experience_log.py`:
  - Replaced `company_name: String(255)` with `company_id: Integer` foreign key referencing `companies_worked.id` (`ondelete="CASCADE"`).
  - Added eager relationship `company: Mapped["CompanyWorked"] = relationship("CompanyWorked", lazy="joined")`.
  - Added helper property `company_name` that dynamically returns the associated company's name for serialization.
- `app/schemas/experience_log.py`:
  - Updated `ExperienceLogBase`, `ExperienceLogCreate`, and `ExperienceLogUpdate` to require/accept `company_id: int`.
  - Updated `ExperienceLogResponse` to serialize both `company_id: int` and `company_name: str`.
- `app/api/v1/endpoints/experience_logs.py`:
  - Validates that `company_id` exists and belongs to the authenticated user on create and update operations.
  - Updated listing endpoint to support filtering by `company_id` and by `company_name` via SQL join on `companies_worked`.
- `alembic/versions/ca60cb1b1d78_change_experience_log_company_name_to_.py`: Created and applied migration altering `experience_logs` to drop `company_name` and add `company_id` foreign key constraint and index.
- `frontend/src/types/workspace.ts`: Updated `ExperienceLogItem`, `ExperienceLogCreateInput`, and `ExperienceLogUpdateInput` to include `company_id: number`.
- `frontend/src/components/workspace/ExperienceModal.tsx`:
  - Bound the company selection dropdown to `company_id` (numeric ID of the company in `companies_worked`).
  - Removed custom company name text inputs, ensuring experience logs are strictly linked to the user's recorded companies.

## 2. Why the Change Was Made (Rationale)
- The user requested changing the company name in Experience Log from a freeform `VARCHAR` into a relational foreign key referencing the `companies_worked` table.
- Using a foreign key enforces referential integrity, guarantees consistent employer naming across career logs, and ensures cascade cleanup when companies are deleted.

## 3. Things to Lookout for in Future Development
- **Database Migration Prerequisite**: Run `alembic upgrade head` in production to migrate the `experience_logs` table schema to use the `company_id` foreign key.
- **Empty Companies State**: If a user has no companies configured in Career Settings, the experience modal prompts them to add their employer first before creating experience logs.
