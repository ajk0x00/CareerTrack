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

- `app/mcp/server.py`: Implemented `HybridMCPApp` and `mcp_lifespan()`, enabling concurrent support for both legacy SSE transport (`GET /sse`, `POST /messages/`) and modern Streamable HTTP transport (`POST /sse`, `POST /mcp`). Incoming HTTP `initialize` POST requests are routed to `StreamableHTTPASGIApp` while SSE event connections are routed to `SseServerTransport`.
- `app/main.py`: Connected `mcp_lifespan()` into the FastAPI application `lifespan` manager to properly maintain the `StreamableHTTPSessionManager` background task group.

## 2. Why the Change Was Made (Rationale)
- The user reported that text fields in the "MCP & API Keys" tab looked ugly, and that configuring the MCP server URL in `mcp_config.json` threw `Error: calling "initialize": sending "initialize": Method Not Allowed`.
- When MCP clients (like Antigravity, Gemini, or modern AI agents) connect to a remote MCP endpoint, they send a JSON-RPC `initialize` request via HTTP `POST /mcp/sse`. Because the server previously mounted only `sse_app` (which strictly defines `Route("/sse", methods=["GET"])`), any incoming POST to `/mcp/sse` returned HTTP 405 Method Not Allowed.
- By mounting a hybrid dispatcher (`HybridMCPApp`) combining `server.sse_app` and `server.streamable_http_app`, the server now accepts both `POST` requests for Streamable HTTP initialization and `GET` requests for SSE streams on `/mcp/sse`.
- Replaced unstyled input classes in `IntegrationsTab.tsx` with dedicated design system classes in `src/index.css`.

## 3. Things to Lookout for in Future Development
- **Single-Display Credentials**: The generated Client Secret is only displayed once upon creation. The input field allows click-to-select and quick copying, but once dismissed it cannot be re-queried from PostgreSQL.
- **Copy Feedback**: Inline "Copied!" state and toast feedback are synchronized to guarantee clear confirmation when copying credentials or JSON configurations.
- **Transport Compatibility**: The MCP server at `/mcp/sse` and `/mcp` now automatically negotiates both Streamable HTTP (POST directly to endpoint) and SSE (GET to establish event stream + POST to message endpoint).

