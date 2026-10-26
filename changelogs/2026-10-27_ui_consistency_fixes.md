# UI Consistency Pass: Real Resume Metadata, Job Description Overlap, Centred Empty States

**Date**: 2026-10-27

## 1. Changes Made
- `frontend/src/components/workspace/ResumeCanvas.tsx`: replaced the hardcoded `v3.2 - {company} Tailored` badge and `Last synthesized: Just now` timestamp with `documentTitle` / `documentTimestamp` props, and the heading now reads `SAVED RESUME` or `RESUME MARKDOWN RENDERED` depending on the dirty flag.
- `frontend/src/components/workspace/TailoredResumeWorkspace.tsx`: tracks `documentTitle` and `documentUpdatedAt` from the loaded/created/updated resume, plus a `formatSavedAt` helper that prints a time for today and a date for older saves; both are passed to the canvas.
- `frontend/src/components/workspace/JobDescriptionPanel.tsx`: moved the `Reload Sample` button out of the textarea wrapper into its own `.jd-sample-row`, so it no longer floats over the job description text.
- `frontend/src/index.css`: added `.jd-sample-row`, dropped the reserved bottom padding hack from `.jd-textarea`, and made `.pipeline-empty-col` grow and centre (`flex: 1`, `justify-content: center`).
- `changelogs/2026-10-27_ui_consistency_fixes.md`: this entry.

## 2. Why the Change Was Made (Rationale)
- The canvas header claimed a synthesis event that never happened (`v3.2`, `Just now`). Every other panel in the app is backed by real data, so those two strings were the only fabricated numbers left in the workspace; they now come from the stored resume row.
- `Reload Sample` was an absolutely positioned pill inside the textarea wrapper, so it covered the last lines of the description while the user was reading them. Moving it into normal flow removes the overlap without losing the affordance.
- Empty pipeline columns rendered their empty state at the top of a 480px-tall column, leaving a large void that read as a broken layout; centring it makes an empty stage look intentional.

## 3. Things to Lookout for in Future Development
- The canvas title now depends on `isDirty` and on the resume row actually being loaded; a future "duplicate resume" feature must set `documentTitle`/`documentUpdatedAt` on the copy or the header will show the previous document's metadata.
- `formatSavedAt` uses the browser locale and compares calendar days, so a resume saved at 23:59 and viewed at 00:01 shows a date rather than a time. Acceptable, but it is a client-local rendering of a server timestamp.
- `.pipeline-empty-col` now uses `flex: 1` inside `.pipeline-card-list`; if a future column footer is added below the empty state, the centring will need re-checking.
- Known issues found during the audit and deliberately NOT fixed: leftover sample requisition and `local.test` contact data, stale `Step 1 of 2`, `Saved & Researching` vs `Stage: Saved` naming, duplicate add actions in empty columns, inverted count-badge emphasis, `PDF verified` badge on a markdown-only tab, `Upload Resume` grouped with download actions, and ~12 controls per screen without accessible names plus sub-24px hit targets.
