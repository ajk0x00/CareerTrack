# Frontend Resume Persistence, ATS Reporting, and PDF Download

**Date**: 2026-10-24

## 1. Changes Made
- `frontend/src/types/resume.ts`: Added `ResumeSummary`, `ResumeDetail`, `ResumeDraft`, `AtsReport`, `ResumeCreateInput`, and `ResumeUpdateInput` interfaces matching the backend schemas with no `any`.
- `frontend/src/api/resumes.ts`: Added a typed fetch client with an exported `ApiError` class (`status` + backend `detail`) for `listResumes`, `getResumeDraft`, `createResume`, `getResume`, `updateResume`, `deleteResume`, `exportResume` (returns `{ blob, fileName }` parsed from `Content-Disposition`), and `getAtsReport`.
- `frontend/src/components/workspace/TailoredResumeWorkspace.tsx`: Removed `DEFAULT_MARKDOWN`, `INITIAL_EXPERIENCES`, and `INITIAL_SKILLS`; the canvas now starts empty and resolves a stored job resume, stored canonical resume, or live draft on mount. Replaced the fake 900 ms `handleGenerate` with a real `GET /resumes/draft` rebuild, and added `handleSave` (POST/PATCH with canonical 409 fallback), `handleDownload` (ATS-safe PDF via object URL), and ATS report loading.
- `frontend/src/components/workspace/ResumeCanvas.tsx`: Added save/download/ATS props, real ATS stat rows driven by `AtsReport`, Save and Download PDF buttons, and loading/error/empty canvas states.
- `frontend/src/components/workspace/JobDetailModal.tsx`: Added a compact "Submitted resume" section backed by `listResumes`, with the linked resume title, updated date, and a Download PDF action.
- `frontend/src/index.css`: Added styles for disabled canvas actions, the ATS warning state, canvas loading/error/empty states, and the submitted-resume block.

## 2. Why the Change Was Made (Rationale)
- The backend half of the feature (`6612d10`) can generate, persist, verify, and export ATS-safe resumes, but the workspace still rendered hardcoded sample data and a simulated 900 ms "generation" with invented ATS numbers. The frontend now treats the API as the source of truth so the canvas reflects the user's real career data and the ATS block only ever shows measured values.
- The draft endpoint is used as the seed when nothing is saved yet, so a first-time user sees their real career data instead of a demo resume, and `Generate` re-runs that same deterministic builder rather than pretending to call an LLM.
- Save is create-then-update rather than upsert because the API enforces one resume per job and one canonical resume per user with 409s; the client falls back to `PATCH` on the existing canonical row so a repeated save never fails on that rule.
- `ApiError` carries the backend `detail` so 409/422 messages (including `Line N: markdown tables are not supported`) reach the user verbatim instead of being replaced by generic copy.
- ATS reports are fetched only for persisted resumes because the report is computed by re-rendering the stored markdown on the server; unsaved edits therefore never masquerade as verified output.

## 3. Things to Lookout for in Future Development
- Deleting a job rewrites its tailored resume to `job_id = NULL`, so the master-resume lookup (`job_id === null`, newest updated first) can surface an orphaned historical resume as if it were the canonical master. Labeling those rows as historical needs a backend discriminator.
- A second "Save" after clicking "Generate" patches the resume that was already loaded instead of creating a new version. Creating historical versions would require an explicit "Save as new" action and a clear title field.
- `handleSave` sends the whole markdown and has no optimistic concurrency check, so two tabs editing the same resume will overwrite each other silently.
- ATS fetch failures (including 422 for tables or unsupported markdown) are swallowed and hide the ATS block; only export surfaces the 422 detail. Consider showing a warning row when the report fails for a saved resume.
- The ATS report describes the last saved markdown, not the live editor buffer, and is only refreshed after a save; the UI does not indicate that the report is stale while editing.
- `Download PDF` saves any unsaved edits first and then exports, so the file always matches what is on screen; the button is enabled whenever the buffer has content. The canvas shows an `Unsaved changes` badge whenever the buffer differs from what was loaded or last saved (a freshly seeded draft counts as the loaded baseline).
- The old browser-print `Export PDF` button was replaced by the server-rendered `Download PDF`; the `Download DOCX` button still only shows a placeholder alert and is unrelated to this feature.
- The exported blob URL is revoked on a 1 s timer rather than immediately after the anchor click, so browsers that defer the download do not lose the file.
- The canvas header still carries designer copy that is not wired to data (`v3.2 - Stripe, Inc. Tailored`, `Last synthesized: Just now`) and the left panel seeds a sample Stripe description. These are inert labels, not measured values, and should be driven by the stored resume title and `updated_at` in a follow-up.
- The canvas empty state now guards `RenderedResume`, whose no-markdown fallback still contains demo content; do not render it without a non-empty markdown buffer.
