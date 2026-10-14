# Job Pipeline Backend API Integration & Navigation Fix

**Date**: 2026-10-14

## 1. Changes Made
- `frontend/src/components/workspace/JobModal.tsx`: Created a reusable modal component for adding and editing job opportunities in the pipeline, supporting company name, title, stage, workplace type, location, compensation (min/max/currency/interval), job posting URL, priority rating, private notes, and job description with full client validation.
- `frontend/src/components/workspace/JobPipeline.tsx`:
  - Replaced static mock data (`INITIAL_PIPELINE`) with live backend data from `GET /api/v1/jobs`.
  - Implemented stage progression updates with optimistic UI updates calling `PATCH /api/v1/jobs/{id}` and automatic error rollback.
  - Implemented opportunity deletion with confirmation calling `DELETE /api/v1/jobs/{id}`.
  - Added "+ Track Opportunity" button in header and per-column quick-add buttons opening `JobModal`.
  - Implemented search filtering across job title, company name, location, and description.
  - Added loading indicator and empty state hero view when no applications are tracked in the database.
  - Removed erroneous `currentWorkspace="Job Pipeline"` and `onSelectWorkspace={(name) => { if (name.includes('Resume')) navigate('/') }}` callback props from `WorkspaceNavbar`.
- `frontend/src/components/workspace/WorkspaceNavbar.tsx`: Made `currentWorkspace` and `onSelectWorkspace` optional in `WorkspaceNavbarProps`. Rendered static "Job Application Pipeline" breadcrumb text when on the `/pipeline` route instead of mounting `WorkspaceSwitcher`.
- `frontend/src/components/workspace/WorkspaceSwitcher.tsx`: Made `currentWorkspace` and `onSelectWorkspace` optional in `WorkspaceSwitcherProps`, added default value for `currentWorkspace`, and guarded all invocations of `onSelectWorkspace` with optional chaining (`?.`).
- `frontend/src/index.css`: Added styles for `.pipeline-col-header-right`, `.pipeline-col-add-btn`, `.pipeline-add-stage-btn`, `.pipeline-card-actions`, and `.pipeline-hero-empty`.
- `compose.yaml`: Changed default host port binding fallback from `8000` to `80` (`${PORT:-80}:8000`).

## 2. Why the Change Was Made (Rationale)
- The user reported an unexpected redirect back to `/` after clicking "Job Pipeline". This occurred because `WorkspaceNavbar` mounted `WorkspaceSwitcher` on `/pipeline`, which fetched `/api/v1/workspaces`, noticed `"Job Pipeline"` wasn't a database workspace, and triggered an auto-select callback that navigated to `/`.
- Furthermore, the user confirmed that the `/pipeline` Kanban board should display real tracked opportunities from the database `Job` model rather than hardcoded mock data.
- Connecting `JobPipeline` to `/api/v1/jobs` enables end-to-end opportunity tracking, status progression, notes logging, and tailored resume generation based on active job applications.

## 3. Things to Lookout for in Future Development
- **Drag-and-Drop Kanban**: Future enhancement can add drag-and-drop column transitions (e.g., using `@hello-pangea/dnd` or HTML5 Drag & Drop API) calling `handleMoveStage`.
- **Resume Tailoring Integration**: Clicking "Tailor" on a job card passes `?company=...&role=...`. Future tasks can also auto-load the job's `description` directly into `JobDescriptionPanel` via a `?jobId=...` query parameter.
