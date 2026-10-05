# Company Employment Type (Backend Model, API, and UI)

**Date**: 2026-10-05

## 1. Changes Made
- `app/models/company.py`: Defined `EmploymentType` StrEnum (`full_time`, `part_time`, `contract`, `internship`) and added `employment_type` column (`server_default='full_time'`, not nullable, indexed) to `CompanyWorked`.
- `app/models/__init__.py`: Re-exported `EmploymentType`.
- `app/schemas/company.py`: Added `employment_type` field with validation and case normalization across `CompanyWorkedBase`, `CompanyWorkedCreate`, `CompanyWorkedUpdate`, and `CompanyWorkedResponse`.
- `app/api/v1/endpoints/companies.py`: Updated `GET /api/v1/companies` to support optional filtering by `employment_type`, and updated creation and update handlers to accept and persist `employment_type`.
- `alembic/versions/63dde4a5ed56_add_employment_type_to_companies_worked.py`: Alembic migration to add `employment_type` column with server default to `companies_worked`.
- `frontend/src/types/workspace.ts`: Added `EmploymentType` union type and updated `CompanyWorkedItem`, `CompanyWorkedCreateInput`, and `CompanyWorkedUpdateInput`.
- `frontend/src/components/workspace/settings/CompanyForm.tsx`: Added segmented choice buttons to select employment type (`Full-Time`, `Part-Time`, `Contract`, `Internship`) when adding or modifying a company.
- `frontend/src/components/workspace/settings/CompanyTimelineItem.tsx`: Added employment type badges with distinct color-coding and icons (`badge` for full-time, `schedule` for part-time, etc.) and passed employment type to the edit form.
- `frontend/src/components/workspace/settings/CareerTab.tsx`: Added filter tabs and tailored empty state descriptions for `Full-Time` and `Part-Time` filters.
- `frontend/src/index.css`: Added styles for `.company-type-selector`, `.company-type-choice`, and `.company-type-badge` using existing design tokens and responsive grid layouts.

## 2. Why the Change Was Made (Rationale)
- The user requested tracking the type of employment (`full_time` or `part_time`) in the backend and updating the UI accordingly.
- Accurately distinguishing between full-time, part-time, contract, and internship roles is critical when tailoring ATS-friendly resumes to specific job requirements.
- By defaulting existing records to `full_time` with a database server default, existing data remains fully valid and migration requires zero downtime or manual backfill.

## 3. Things to Lookout for in Future Development
- If new employment classifications are added in the future, keep the backend `EmploymentType` StrEnum and frontend `EmploymentType` TypeScript union in sync.
- The ATS resume compilation step should inspect `employment_type` to appropriately annotate role entries in generated resumes or cover letters.
