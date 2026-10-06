# MCP & API Keys Text Fields and Credentials UI Restyling

**Date**: 2026-10-06

## 1. Changes Made
- `frontend/src/index.css`: Added dedicated styling rules for the MCP & API Keys tab matching the design system tokens:
  - `.mcp-info-banner`: Informative overview header explaining MCP capabilities.
  - `.mcp-input-wrap`, `.mcp-input-icon`, `.mcp-text-input`: Modern text input container with focus ring, leading icon, and proper typography tokens.
  - `.mcp-generate-btn`: Primary action button with icon, hover elevation, and disabled states.
  - `.mcp-presets-wrap`, `.mcp-preset-chip`: Quick pre-fill suggestion tags (Claude Desktop, Cursor IDE, etc.).
  - `.mcp-created-card`, `.mcp-created-warning-box`: Security-focused one-time credential display card.
  - `.mcp-cred-row`, `.mcp-cred-input-box`, `.mcp-cred-input`, `.mcp-copy-btn`: Monospace read-only credential display inputs with one-click copy feedback.
  - `.mcp-code-card`, `.mcp-code-header`, `.mcp-code-pre`: IDE-themed JSON configuration snippet container with header and copy button.
  - `.mcp-clients-list`, `.mcp-client-item`, `.mcp-id-chip`, `.mcp-revoke-btn`: Styled active client credential cards with status indicator and revocation button.
- `frontend/src/components/workspace/settings/IntegrationsTab.tsx`: Refactored form inputs, credential boxes, and client cards to use the dedicated design system classes, integrated `useToast` for copy feedback, added quick-fill presets, and updated the configuration snippet generator to output SSE configuration (`url` with `headers`) by default with interactive tabs for `SSE (Headers)`, `SSE (URL Query)`, and `Stdio (CLI)`.
- `frontend/vite.config.ts`: Added `/mcp` to Vite dev server proxy to ensure SSE requests proxy cleanly to the FastAPI backend.

## 2. Why the Change Was Made (Rationale)
- The user reported that text fields in the "MCP & API Keys" tab looked ugly, and that the example MCP config JSON displayed the server as stdio (`command: "python"`) while in reality the running server operates over SSE (`/mcp/sse`).
- Previously, the inputs relied on undefined CSS class names (`input-field`, `input-label`) and non-existent CSS variables (`--bg-subtle`, `--border`), causing the browser to render default unstyled HTML input controls with raw bevels and inconsistent font sizing.
- By replacing these with dedicated classes referencing the established design system tokens (`var(--surface-container-lowest)`, `var(--outline-variant)`, `var(--primary)`, `var(--font-mono)`), the text inputs and credential display blocks now seamlessly match the rest of the application.
- The example MCP config JSON now defaults to the standard SSE configuration using `url: "http://localhost:8000/mcp/sse"` with `headers: { "X-Client-ID": ..., "X-Client-Secret": ... }`, and includes format switcher tabs for query-parameter URLs and local CLI stdio fallback.

## 3. Things to Lookout for in Future Development
- **Single-Display Credentials**: The generated Client Secret is only displayed once upon creation. The input field allows click-to-select and quick copying, but once dismissed it cannot be re-queried from PostgreSQL.
- **Copy Feedback**: Inline "Copied!" state and toast feedback are synchronized to guarantee clear confirmation when copying credentials or JSON configurations.
- **SSE Client Compatibility**: Most modern MCP clients (Cursor, Antigravity, etc.) support headers on SSE; for clients that only support plain URLs without custom headers, the `SSE (URL Query)` tab provides the pre-authenticated `?client_id=...&client_secret=...` query string.

