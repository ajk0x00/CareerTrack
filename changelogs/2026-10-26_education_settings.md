# Education Settings: Model, CRUD API, Resume Section & Settings Tab

**Date**: 2026-10-26

## 1. Changes Made
- `app/models/education.py`: Added the `Education` model (`education` table) with `id`, `user_id` (FK to `users.id`, `ON DELETE CASCADE`), `degree`, `institution`, `cgpa` as `Numeric(4, 2, asdecimal=False)`, plus `created_at`/`updated_at`.
- `app/models/__init__.py`: Re-exported `Education` in imports and `__all__`.
- `alembic/versions/9343d7397c39_create_education_table.py`: Added the migration creating the `education` table with `ix_education_id` and `ix_education_user_id`; the downgrade drops both indexes and the table. Revision id `9343d7397c39`, parent `21926661fcc7`.
- `app/schemas/education.py`: Added `EducationBase`, `EducationCreate`, `EducationUpdate`, and `EducationResponse` with whitespace-stripping validators, CGPA bounds `0-99.99`, and an at-least-one-field update validator.
- `app/schemas/__init__.py`: Re-exported the four education schemas.
- `app/api/v1/endpoints/education.py`: Added user-scoped `GET /api/v1/education`, `POST /api/v1/education`, `PATCH /api/v1/education/{id}`, and `DELETE /api/v1/education/{id}` with ownership 404s and `flush`-only writes.
- `app/api/v1/router.py`: Mounted the education router at `/education` with the `Education` tag.
- `app/services/resume.py`: `ResumeDraftService.build_draft` now appends an `## Education` section after Skills, newest first, formatted as `- **{degree}, {institution}** (CGPA: {cgpa:.2f})`; omitted when no rows exist and existing `has_*` flags are unchanged.
- `frontend/src/types/workspace.ts`: Added `EducationItem` and `EducationCreateInput`.
- `frontend/src/components/workspace/settings/EducationTab.tsx`: Added the education tab with authenticated loading, inline add/edit form, client-side validation, record cards, confirmation-backed delete, empty state, and toast feedback.
- `frontend/src/components/workspace/settings/SettingsSidebar.tsx`: Added `'education'` to `SettingsTabId` and the Education nav entry (`school` icon) after Career.
- `frontend/src/components/workspace/settings/index.ts`: Re-exported `EducationTab`.
- `frontend/src/components/workspace/SettingsModal.tsx`: Rendered `<EducationTab token={token} />` for the new tab.
- `frontend/src/index.css`: Added education tab, form grid, record card, CGPA badge, and empty-state styles using existing settings tokens and card conventions.

### Review follow-up (2026-10-25)
- `app/models/education.py`: Removed `cgpa`; added `description` as non-null `Text` with `server_default=""`, plus nullable `start_date` and `end_date` (`Date`). `end_date=None` means the qualification is ongoing.
- `alembic/versions/7ab241dbbf83_replace_education_cgpa_with_description.py`: New revision (parent `9343d7397c39`) adding `description`/`start_date`/`end_date`, dropping `cgpa`, and dropping the temporary description server default after backfill. Downgrade re-adds `cgpa` with `server_default='0'` so existing rows satisfy `NOT NULL`.
- `app/schemas/education.py`: `EducationBase` now requires `description` (1-2000 chars), `start_date`, and optional `end_date`, with a model validator rejecting `end_date < start_date`. `EducationUpdate` accepts the same optional fields, keeps the at-least-one-field rule, and validates the date range when both dates are supplied. Every `cgpa` reference is gone.
- `app/api/v1/endpoints/education.py`: Create and update now persist `description`, `start_date`, and `end_date`; `end_date` is explicitly nullable on patch so an ongoing qualification can be marked complete.
- `app/services/resume.py`: Education rows now render as one bullet `- **{degree}, {institution}** ({start} – {end}): {description}` using `%b %Y`, `Present` for a null end date, and omitting the date group when `start_date` is null or the description suffix when the description is blank.
- `frontend/src/api/education.ts`: New typed education client mirroring `api/resumes.ts`, with `ApiError` (status + backend detail), `listEducation`, `createEducation`, `updateEducation`, and `deleteEducation`.
- `frontend/src/types/workspace.ts`: `EducationItem`/`EducationCreateInput` now use `description` and ISO `start_date`/`end_date` (`end_date` nullable; legacy rows may return a null `start_date`); added `EducationUpdateInput`; removed `cgpa`.
- `frontend/src/components/workspace/settings/EducationTab.tsx`: Removed all inline `fetch` calls and routed load/create/patch/delete through `api/education`. The form now collects degree, institution, start date, optional end date (blank = ongoing), and a multiline description; client-side validation covers required fields and the date order; record cards render degree, institution plus formatted date range, and the description.
- `frontend/src/index.css`: Replaced the CGPA badge rule with date-grid, date-input, hint, description textarea, record meta/date/description styles, and stacking for the date grid on narrow screens.


## 2. Why the Change Was Made (Rationale)
- The feature request called for a dedicated Education section in settings with exactly three user fields per record: degree type, institution, and passing CGPA. The model and schemas deliberately exclude dates, location, and field of study so the API surface stays minimal and matches the product definition.
- Education is user-level data, not job-scoped, so the same rows feed every resume draft. Adding the section directly to `ResumeDraftService.build_draft` keeps draft generation deterministic without introducing a new persistence path or a fourth `has_*` flag.
- The router, session handling, ownership checks, and frontend fetch/error patterns mirror the existing skills and career implementations, which keeps behaviour consistent and avoids new dependencies or abstractions.
- The frontend reuses the established `pref-*` form/card classes and only adds education-specific layout classes, so the tab inherits the same visual language as Career and Preferences.
- **Review follow-up**: The reviewer asked for study dates and a free-form description instead of a single CGPA number, and for the frontend to follow the typed API-client pattern. `description` replaces `cgpa` because one free-text field can hold CGPA, honours, coursework, and any other detail without further schema changes. Dates and the description are first-class columns so the resume draft can format and order them deterministically. The new `api/education.ts` module mirrors `api/resumes.ts`, which keeps error parsing, auth headers, and endpoint shapes consistent across features.

## 3. Things to Lookout for in Future Development
- **Legacy null dates**: `start_date`/`end_date` were added after the `education` table already existed, so rows created before revision `7ab241dbbf83` keep `NULL` dates and an empty `description`. The API allows a null `start_date` on reads, the UI omits the date range for those rows, and the resume draft omits the `(start – end)` group. New records require a start date and a non-blank description.
- **Two-step migration history**: `9343d7397c39` was already committed and applied, so the schema change lives in a second revision (`7ab241dbbf83`). Do not squash them or edit the first migration; `alembic heads` must stay at a single head.
- **Other settings tabs were not refactored**: `CareerTab` and several older settings components still call `fetch` inline. Only `EducationTab` moved to the typed client in this task; migrating the rest is follow-up work and they keep using the same `ApiError`-style error handling only after migration.
- **Migration order**: This chain depends on the merge head `21926661fcc7` through `9343d7397c39`; the review change is revision `7ab241dbbf83`. Rebase and regenerate the latest revision if another branch merges a new head first, and keep `alembic heads` at exactly one head.
- **CGPA precision (superseded)**: The original `Numeric(4, 2)` CGPA column was dropped by `7ab241dbbf83` in favour of free-text `description`. Any CGPA precision concerns now live inside the description text and are no longer enforceable at the schema level.
- **Ordering**: Both the list endpoint and resume section order by `created_at DESC, id DESC`. Editing a record does not reorder it because `created_at` is unchanged.
- **Resume scope**: Education rows are not scoped to a job. If job-specific education selection is ever needed, the draft service and schema will need a scoping field.
- **Backend process**: The running local uvicorn serves a baked copy of the code without `--reload`, so it must be rebuilt/restarted outside this task before the new `/api/v1/education` route is reachable on port 8000.
