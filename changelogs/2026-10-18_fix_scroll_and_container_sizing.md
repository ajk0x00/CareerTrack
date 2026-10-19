# Fix Scroll Leaking, Viewport Clipping, and Container Overflow

**Date**: 2026-10-18

## 1. Changes Made
- `frontend/src/hooks/useBodyScrollLock.ts`: Created reusable body scroll lock hook supporting multiple active locks (reference counter) and scrollbar-width compensation to prevent layout jumps and eliminate scroll chaining/page scrolling behind open modals.
- `frontend/src/index.css`:
  - `.modal-backdrop`: Added `overflow-y: auto`, `overscroll-behavior: contain`, and vertical padding to prevent modal clipping at the top on short/mobile viewports.
  - `.modal-container`: Switched from unbounded height with raw scrolling to a structured flex column dialog (`display: flex; flex-direction: column; max-height: 88vh; overflow: hidden; padding: 0; margin: auto;`).
  - Added `.modal-body-scroll` utility (`flex: 1; overflow-y: auto; min-height: 0; padding: 20px 24px; overscroll-behavior: contain;`) for smooth, isolated body scrolling inside dialogs.
  - Pinned modal headers (`.modal-header`, `flex-shrink: 0;`), toolbars (`.modal-toolbar`, `flex-shrink: 0;`), and footers (`.modal-footer`, `flex-shrink: 0; margin-top: 0;`) with explicit backgrounds and borders.
  - `.modal-xlarge`: Replaced fixed pixel min/max heights with fluid viewport bounds (`min-height: min(580px, 90vh); max-height: min(760px, 92vh); margin: auto;`) and reset `min-height: 0` for mobile screens (`@media (max-width: 820px)`).
  - Bounded 2-column workspace layout on desktop (`@media (min-width: 1024px)`): `.workspace-root` bounded to `100vh / 100dvh; overflow: hidden;`, `.workspace-body` to `calc(100vh - 64px)`, and decoupled left JD panel and right Resume Canvas into independent scroll containers with static headers/CTAs, eliminating window-level dual scrollbars.
  - `.canvas-top-bar`: Fixed mobile sticky offset from `top: 0` to `top: 64px` to prevent sliding underneath the main navigation bar.
  - `.ws-items-list`: Constrained dropdown list to `max-height: 280px; overflow-y: auto; overscroll-behavior: contain;`.
  - `.pipeline-column`: Bounded Kanban column height on desktop to `max-height: calc(100vh - 220px); overflow: hidden;`, made `.pipeline-col-header` `flex-shrink: 0`, and set `.pipeline-card-list` to `flex: 1; overflow-y: auto; min-height: 0; overscroll-behavior: contain;` (unconstrained on mobile).
  - `.md-raw-textarea`: Replaced rigid `height: 680px; resize: none;` with responsive `min-height: 480px; flex: 1; resize: vertical;`.
  - `.skills-modal-container`, `.skills-modal-header`, `.skills-modal-body`, `.skills-modal-footer`: Added `margin: auto`, pinned header/footer, and internal body scrolling with `overscroll-behavior: contain`.
  - `.settings-sidebar`, `.settings-content-pane`: Added `overscroll-behavior: contain` to prevent scroll bleeding to parent containers.
- `frontend/src/components/workspace/ExperienceModal.tsx`: Wired `useBodyScrollLock(isOpen)` and wrapped drawer form and logged experience records inside `.modal-body-scroll`, keeping toolbar and footer pinned.
- `frontend/src/components/workspace/JobModal.tsx`: Wired `useBodyScrollLock(isOpen)`, wrapped form fields inside `.modal-body-scroll`, and pulled action buttons into pinned `.modal-footer`.
- `frontend/src/components/workspace/ResumeUploadModal.tsx`: Wired `useBodyScrollLock(isOpen)`, wrapped dropzone, buffer textarea, and success states into `.modal-body-scroll`, and pulled action buttons into pinned `.modal-footer`.
- `frontend/src/components/workspace/SkillsModal.tsx`: Wired `useBodyScrollLock(isOpen)` and cleaned up modal container bounds.
- `frontend/src/components/workspace/SettingsModal.tsx`: Wired `useBodyScrollLock(isOpen)` before conditional rendering.

## 2. Why the Change Was Made (Rationale)
- The user reported scroll and size issues inside the application, specifically:
  1. Main page behind modals was still scrollable when modals were open (scroll chaining / scroll leaking).
  2. Containers growing over their parents without bounds, causing dual scrollbars and awkward scrolling behavior.
  3. Modals on smaller laptop or mobile screens were getting clipped at the top because flexbox `align-items: center` without `margin: auto` pushed overflowing elements above `y: 0`.
  4. Modal headers and action buttons (e.g. Save, Cancel, Done) scrolled out of view on long forms, forcing users to hunt for them.
  5. The 2-column workspace caused double scrollbars on desktop because the window had its own scrollbar while internal panels also scrolled.
- Rather than applying ad-hoc styles or adding heavy third-party modal libraries, we used a centralized hook (`useBodyScrollLock`) with scrollbar width compensation to eliminate layout shift, standardized a 3-tier modal architecture (pinned header, scrolling body `.modal-body-scroll`, pinned footer), and constrained viewport heights cleanly with CSS tokens.

## 3. Things to Lookout for in Future Development
- When creating any new modal in the future, follow the standardized layout pattern:
  - Call `useBodyScrollLock(isOpen)`.
  - Root container: `<div className="modal-container ...">`.
  - Header: `<div className="modal-header">`.
  - Body: `<div className="modal-body-scroll">`.
  - Footer: `<div className="modal-footer">`.
- Remember to invoke `useBodyScrollLock` before any conditional early returns (`if (!isOpen) return null;`) in React components so hook execution counts remain constant across renders.
- If additional columns or stages are added to the Job Pipeline Kanban, the `max-height: calc(100vh - 220px)` and card-list scrolling ensure column headers remain aligned and visible regardless of how many cards are placed in a single column.
