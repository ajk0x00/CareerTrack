# Markdown Live AST Rendering & Dynamic Resume Preview

**Date**: 2026-10-06

## 1. Changes Made
- `frontend/src/components/workspace/MarkdownRenderer.tsx`: Implemented a standalone, zero-dependency Markdown-to-JSX AST parser and renderer supporting:
  - Block parsing: Headings (`#` through `######`), horizontal rules (`---`, `***`), ordered and unordered bullet lists with nested indentations, blockquotes, code blocks with language badges, and tables.
  - Inline tokenization: Bold (`**bold**`), italic (`*italic*`), bold-italic (`***bold italic***`), strikethrough (`~~text~~`), inline code (`` `code` ``), links (`[text](url)`), line breaks (`\n`, `  \n`), and metric badge detection (`%`, `$`, `\d+x`, `\d+\+`).
  - Resume layout optimizations: Candidate name & contact block detection, section headers with divider lines (`.section-title-row`), job experience metadata lines (`**Company** | Period | Location`), and key-value competency list styling (`**Category:** items`).
  - Empty buffer fallback state.
- `frontend/src/components/workspace/RenderedResume.tsx`: Added `markdown?: string` prop to render dynamic content via `MarkdownRenderer`, falling back to static props when markdown is empty.
- `frontend/src/components/workspace/ResumeCanvas.tsx`: Passed `markdownContent` to `RenderedResume`, connecting the user's live markdown edits directly into the rendered preview tab. Updated `handleExportPDF` to invoke native high-resolution browser print (`window.print()`).
- `frontend/src/components/workspace/MarkdownEditor.tsx`: Replaced "Coming Soon" placeholder banner with an active synchronization status bar displaying real-time buffer statistics (line count, word count, character count) and added Tab key indentation handling in the textarea.
- `frontend/src/components/index.ts`: Re-exported `MarkdownRenderer`.
- `frontend/src/index.css`: Added styles for rendered markdown elements (subheadings, inline code, code blocks, blockquotes, tables, links, empty state) and `@media print` rules for clean PDF export.

## 2. Why the Change Was Made (Rationale)
- The user requested checking the Markdown edit and render in the codebase so that the rendered preview actually reflects whatever is currently in the markdown buffer.
- Previously, the "Rendered Preview" tab was displaying a hardcoded static template while the Markdown editor displayed a "Markdown Rendering Engine — Coming Soon" banner. Edits made in the markdown buffer had no effect on the rendered preview.
- By implementing a pure TypeScript/React markdown parser and renderer adhering strictly to approved dependencies, any changes made in the markdown buffer immediately reflect in the "Rendered Preview" tab with executive ATS resume typography.

## 3. Things to Lookout for in Future Development
- **Custom Markdown Extensions**: If users require custom markup (e.g. multi-column layout shortcodes or LaTeX math symbols), additional tokenizer rules can be added to `MarkdownRenderer.tsx`.
- **Bidirectional AST Syncing**: Currently the flow is Markdown -> Rendered Preview. If rich-text direct manipulation in the rendered view is desired in the future, a structured AST serializer would be needed.
