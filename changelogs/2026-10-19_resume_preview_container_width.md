# Resume Preview Container Width & Executive Paper Styling

**Date**: 2026-10-19

## 1. Changes Made
- `frontend/src/index.css`:
  - Standardized `.resume-view-container` to `max-width: 800px;` with `margin: 0 auto;`, aligning the resume preview and ATS tailoring notice banner with standard US Letter paper proportions (~8.5in at 96 DPI with standard margins).
  - Elevated `.resume-sheet` with crisp edge borders (`border: 1px solid rgba(211, 228, 254, 0.7);`), tailored paper border-radius (`10px`), refined drop shadows (`box-shadow: 0 1px 3px rgba(11, 28, 48, 0.04), 0 8px 24px -4px rgba(11, 28, 48, 0.08);`), authentic US Letter minimum height (`min-height: 1056px;`), and balanced internal padding (`padding: 48px 52px;`).
  - Updated `.markdown-rendered-sheet` with `min-height: 1056px;` to match physical document proportions across both rendered and markdown view modes.
  - Aligned `.markdown-editor-card` with identical paper elevation and border styling (`border: 1px solid rgba(211, 228, 254, 0.7); border-radius: 10px; padding: 24px;`).
  - Added `align-items: flex-start;` to `.resume-sheet-wrapper` (in base rules and `@media (min-width: 1024px)`) and `flex-shrink: 0; height: auto;` to `.resume-sheet`, `.markdown-rendered-sheet`, and `.markdown-editor-card`. This eliminates a flexbox layout bug where the scrollable wrapper with default `align-items: stretch` bounded `.resume-view-container` to the viewport height, causing flex children to shrink to their `min-height: 1056px` and spilling subsequent resume content (e.g. Technical Competencies and Education) out of the white container.
  - Enhanced `.resume-sheet-wrapper` padding to `padding: 32px 24px 64px 24px;` in both base and desktop (`@media (min-width: 1024px)`) contexts to provide balanced gutters and generous bottom clearance when scrolling.

## 2. Why the Change Was Made (Rationale)
- The user reported that the resume preview page did not look good, and upon scrolling to the bottom on `http://localhost:8000/`, the white paper container stopped around Coinbase and failed to pan or contain the remainder of the resume content (Technical Competencies and Education spilled onto the canvas).
- Investigation revealed two interacting issues:
  1. `.resume-view-container` was set to `max-width: 900px;` with no auto-margin centering, resulting in awkward ~36px side margins on a 1020px canvas, excessively wide 804px line lengths, and no edge border definition against the canvas.
  2. In CSS flexbox, `.resume-sheet-wrapper` had `display: flex; justify-content: center; overflow-y: auto;`. Because its default cross-axis alignment was `align-items: stretch`, the browser bounded the child `.resume-view-container` to the wrapper's viewport height (~478px). Inside the container, `.resume-sheet` was treated as a shrinking flex child clamped strictly to its `min-height: 1056px`, preventing the white paper element from expanding to its full natural content height (~1674px) and allowing content to spill out of the white card.
- By configuring `align-items: flex-start;` on `.resume-sheet-wrapper`, setting `height: auto;` on `.resume-view-container`, and adding `flex-shrink: 0; height: auto;` to `.resume-sheet`, the white paper document expands smoothly to wrap 100% of the resume content with proper padding and bottom drop shadow.

## 3. Things to Lookout for in Future Development
- When creating scrolling flex layouts with centered content, always set `align-items: flex-start;` on the scrolling flex container rather than leaving default `align-items: stretch` (or use block layout with `margin: 0 auto;`), otherwise child containers are clamped to the container's viewport height.
- If custom multi-page resume pagination or page-break visualizers are added in the future, each page sheet should maintain the `max-width: 800px` container constraint to preserve standard 8.5" x 11" US Letter proportions.
- Responsive mobile breakpoints (`@media (max-width: 640px)`) continue to allow `.resume-sheet` to adjust padding (`24px 20px`) and `min-height: auto` fluidly on small screens.
