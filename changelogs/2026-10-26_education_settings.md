# Education Settings: Model, CRUD API, Resume Section & Settings Tab

**Date**: 2026-10-26

## 1. Changes Made
- `app/models/education.py`: Added the `Education` model (`education` table) with `id`, `user_id` (FK to `users.id`, `ON DELETE CASCADE`), `degree`, `institution`, `cgpa` as `Numeric(4, 2, asdecimal=False)`, plus `created_at`/`updated_at`.
- `app/models/__init__.py`: Re-exported `Education` in imports and `__all__`.
- `alembic/versions/9343d7397c39_create_education_table.py`: Added the single migration creating the `education` table with the final schema (`degree`, `institution`, `description`, `start_date`, `end_date`, timestamps) plus `ix_education_id` and `ix_education_user_id`; the downgrade drops both indexes and the table. Revision id `9343d7397c39`, parent `21926661fcc7`.
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
- `alembic/versions/9343d7397c39_create_education_table.py`: Squashed the review follow-up into this single revision so a fresh upgrade creates the final `description`/`start_date`/`end_date` schema directly; `cgpa` never exists and the intermediate `7ab241dbbf83` revision was deleted.
- `app/schemas/education.py`: `EducationBase` now requires `description` (1-2000 chars), `start_date`, and optional `end_date`, with a model validator rejecting `end_date < start_date`. `EducationUpdate` accepts the same optional fields, keeps the at-least-one-field rule, and validates the date range when both dates are supplied. Every `cgpa` reference is gone.
- `app/api/v1/endpoints/education.py`: Create and update now persist `description`, `start_date`, and `end_date`; `end_date` is explicitly nullable on patch so an ongoing qualification can be marked complete.
- `app/services/resume.py`: Education rows now render as one bullet `- **{degree}, {institution}** ({start} – {end}): {description}` using `%b %Y`, `Present` for a null end date, and omitting the date group when `start_date` is null or the description suffix when the description is blank.
- `frontend/src/api/education.ts`: New typed education client mirroring `api/resumes.ts`, with `ApiError` (status + backend detail), `listEducation`, `createEducation`, `updateEducation`, and `deleteEducation`.
- `frontend/src/types/workspace.ts`: `EducationItem`/`EducationCreateInput` now use `description` and ISO `start_date`/`end_date` (`end_date` nullable; legacy rows may return a null `start_date`); added `EducationUpdateInput`; removed `cgpa`.
- `frontend/src/components/workspace/settings/EducationTab.tsx`: Removed all inline `fetch` calls and routed load/create/patch/delete through `api/education`. The form now collects degree, institution, start date, optional end date (blank = ongoing), and a multiline description; client-side validation covers required fields and the date order; record cards render degree, institution plus formatted date range, and the description.
- `frontend/src/index.css`: Replaced the CGPA badge rule with date-grid, date-input, hint, description textarea, record meta/date/description styles, and stacking for the date grid on narrow screens.
- `frontend/src/api/profile.ts`: New typed profile client with `ApiError` (status + backend detail) plus `getProfile` and `updateProfile`.
- `frontend/src/api/career.ts`: New typed companies client with `ApiError`, `listCompanies` (all/active/employment-type filters), `createCompany`, `updateCompany`, and `deleteCompany`.
- `frontend/src/api/preferences.ts`: New typed preferences client with `ApiError`, `listPreferences` (all/importance filters), `createPreference`, `updatePreference`, and `deletePreference`.
- `frontend/src/api/integrations.ts`: New typed API-client module with `ApiError`, `listApiClients`, `createApiClient`, and `deleteApiClient`.
- `frontend/src/components/workspace/settings/ProfileTab.tsx`: Removed both inline `fetch` calls and routed profile load/save through `api/profile`, preserving the existing form state, validation, save flow, and toasts.
- `frontend/src/components/workspace/settings/CareerTab.tsx`: Removed all four inline `fetch` calls and routed company list/create/update/delete through `api/career`, preserving filters, timeline rendering, and toasts.
- `frontend/src/components/workspace/settings/PreferencesTab.tsx`: Removed all four inline `fetch` calls and routed preference list/create/update/delete through `api/preferences`, preserving filters, editing state, and toasts.
- `frontend/src/components/workspace/settings/IntegrationsTab.tsx`: Removed all four inline `fetch` calls and routed API-client list/create/revoke through `api/integrations`, preserving credential display, copy actions, and toasts.


## 2. Why the Change Was Made (Rationale)
- The feature request called for a dedicated Education section in settings with exactly three user fields per record: degree type, institution, and passing CGPA. The model and schemas deliberately exclude dates, location, and field of study so the API surface stays minimal and matches the product definition.
- Education is user-level data, not job-scoped, so the same rows feed every resume draft. Adding the section directly to `ResumeDraftService.build_draft` keeps draft generation deterministic without introducing a new persistence path or a fourth `has_*` flag.
- The router, session handling, ownership checks, and frontend fetch/error patterns mirror the existing skills and career implementations, which keeps behaviour consistent and avoids new dependencies or abstractions.
- The frontend reuses the established `pref-*` form/card classes and only adds education-specific layout classes, so the tab inherits the same visual language as Career and Preferences.
- **Review follow-up**: The reviewer asked for study dates and a free-form description instead of a single CGPA number, and for the frontend to follow the typed API-client pattern. `description` replaces `cgpa` because one free-text field can hold CGPA, honours, coursework, and any other detail without further schema changes. Dates and the description are first-class columns so the resume draft can format and order them deterministically. The new `api/education.ts` module mirrors `api/resumes.ts`, which keeps error parsing, auth headers, and endpoint shapes consistent across features.
- **Settings-tab refactor**: The reviewer flagged inline `fetch` in components as non-standard, so Profile, Career, Preferences, and Integrations now match `EducationTab` with one typed client module per feature. Auth headers, backend `detail` extraction, and endpoint paths stay in one place without changing the tabs' state, validation, or markup.

## 3. Things to Lookout for in Future Development
- **Nullable legacy dates on read**: The API still tolerates `NULL` `start_date`/`end_date` on existing rows (the model and response type allow it), so the UI omits the date range and the resume draft omits the `(start – end)` group for those rows. New records require a start date and a non-blank description.
- **Single migration**: The education schema ships as ONE migration (`9343d7397c39`) because the branch was squashed before merge; `alembic heads` must stay at exactly one head.
- **Settings tabs still using inline `fetch`**: `JobPipeline`, `TailoredResumeWorkspace`, `JobDetailModal`, `ExperienceModal`, `SkillsModal`, `WorkspaceSwitcher`, and `ResumeUploadModal` still call `fetch` directly; migrating them to `ApiError`-style typed clients is follow-up work.
- **Migration order**: This chain depends on the merge head `21926661fcc7` through the single education revision `9343d7397c39`. If another branch merges a new head first, regenerate the education revision on top of it and keep `alembic heads` at exactly one head.
- **CGPA precision (superseded)**: The original `Numeric(4, 2)` CGPA column was removed before merge in favour of free-text `description`, so CGPA precision is no longer enforceable at the schema level.
- **Ordering**: Both the list endpoint and resume section order by `created_at DESC, id DESC`. Editing a record does not reorder it because `created_at` is unchanged.
- **Resume scope**: Education rows are not scoped to a job. If job-specific education selection is ever needed, the draft service and schema will need a scoping field.
- **Backend process**: The running local uvicorn serves a baked copy of the code without `--reload`, so it must be rebuilt/restarted outside this task before the new `/api/v1/education` route is reachable on port 8000.
