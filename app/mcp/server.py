"""Main entry point and CLI runner for the CareerTrack MCP server."""

import argparse
import logging
import os
import sys

import base64
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any
from urllib.parse import parse_qs

from mcp.server.auth.settings import AuthSettings
from mcp.server.mcpserver import MCPServer
from mcp.server.streamable_http_manager import StreamableHTTPSessionManager
from mcp.server.transport_security import TransportSecuritySettings
from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.config import get_settings
from app.core.database import async_session_factory
from app.core.security import create_access_token
from app.mcp.auth import CareerTrackTokenVerifier, verify_client_credentials
from app.mcp.resources import register_resources
from app.mcp.tools import register_tools

logger = logging.getLogger("careertrack.mcp")


def create_mcp_server() -> MCPServer:
    """Creates and configures the CareerTrack MCP server with tools and resources."""
    settings = get_settings()

    auth_settings = AuthSettings(
        issuer_url=f"http://{settings.HOST}:{settings.PORT}",
        resource_server_url=f"http://{settings.HOST}:{settings.PORT}",
        validate_token_resource=False,
    )

    server_instance = MCPServer(
        name="careertrack",
        title="CareerTrack MCP Server",
        description=(
            "Exposes user skills, career preferences, companies worked in, total years of work experience, "
            "and unified ATS-friendly career context for AI assistants and resume builders."
        ),
        version="0.1.0",
        token_verifier=CareerTrackTokenVerifier(),
        auth=auth_settings,
    )

    # Register all tools and resources
    register_tools(server_instance)
    register_resources(server_instance)

    return server_instance


# Shared default server instance
server = create_mcp_server()


class MCPAccessTokenMiddleware:
    """ASGI middleware extracting credentials from Client ID/Secret, headers, query params, or env."""

    _session_tokens: dict[str, str] = {}

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            headers = list(scope.get("headers", []))
            headers_dict = {k.decode("utf-8").lower(): v.decode("utf-8") for k, v in headers}
            has_auth = "authorization" in headers_dict
            active_token: str | None = None

            query_string = scope.get("query_string", b"").decode("utf-8")
            params = parse_qs(query_string)

            # Check if this is a message POST for an already authenticated session
            session_id = params.get("session_id", [None])[0]
            if session_id and session_id in self._session_tokens and not has_auth:
                cached_token = self._session_tokens[session_id]
                headers.append((b"authorization", f"Bearer {cached_token}".encode("utf-8")))
                scope["headers"] = headers
                has_auth = True
                active_token = cached_token

            # Check if Basic Auth was provided (Authorization: Basic <base64(client_id:client_secret)>)
            client_id: str | None = None
            client_secret: str | None = None

            if has_auth and headers_dict.get("authorization", "").lower().startswith("basic "):
                encoded = headers_dict["authorization"][6:].strip()
                try:
                    decoded = base64.b64decode(encoded).decode("utf-8")
                    if ":" in decoded:
                        client_id, client_secret = decoded.split(":", 1)
                        has_auth = False  # Will exchange for verified bearer token
                except Exception:
                    pass

            # Check custom headers: X-Client-ID and X-Client-Secret
            if not client_id and not has_auth:
                client_id = headers_dict.get("x-client-id")
                client_secret = headers_dict.get("x-client-secret")

            # Check query string (?client_id=...&client_secret=...)
            if not client_id and not has_auth:
                c_id_list = params.get("client_id", [])
                c_sec_list = params.get("client_secret", [])
                if c_id_list and c_sec_list:
                    client_id = c_id_list[0]
                    client_secret = c_sec_list[0]

            # Check environment for Client ID / Secret fallback
            if not client_id and not has_auth:
                env_cid = os.environ.get("CAREERTRACK_CLIENT_ID") or os.environ.get("CLIENT_ID")
                env_csec = os.environ.get("CAREERTRACK_CLIENT_SECRET") or os.environ.get("CLIENT_SECRET")
                if env_cid and env_csec:
                    client_id = env_cid.strip()
                    client_secret = env_csec.strip()

            # If Client ID and Secret are provided, verify against DB and create session token
            if client_id and client_secret:
                async with async_session_factory() as db:
                    user = await verify_client_credentials(db, client_id, client_secret)
                    await db.commit()
                    if user:
                        token = create_access_token(str(user.id))
                        headers = [h for h in headers if h[0].lower() != b"authorization"]
                        headers.append((b"authorization", f"Bearer {token}".encode("utf-8")))
                        scope["headers"] = headers
                        has_auth = True
                        active_token = token

            # If no auth yet, check token in query (?token=) or environment (CAREERTRACK_AUTH_TOKEN)
            if not has_auth:
                token = params.get("token", [None])[0] or params.get("access_token", [None])[0]
                if not token:
                    token = os.environ.get("CAREERTRACK_AUTH_TOKEN") or os.environ.get("AUTH_TOKEN")
                if token:
                    clean_token = token.strip()
                    if clean_token.lower().startswith("bearer "):
                        clean_token = clean_token[7:].strip()
                    headers.append((b"authorization", f"Bearer {clean_token}".encode("utf-8")))
                    scope["headers"] = headers
                    active_token = clean_token
            elif not active_token and has_auth and headers_dict.get("authorization", "").lower().startswith("bearer "):
                active_token = headers_dict["authorization"][7:].strip()

            # When an SSE connection is initialized, capture session_id to authenticate subsequent message POSTs
            if active_token and scope.get("path", "").endswith("/sse"):
                token_to_bind = active_token

                async def send_wrapper(message: Any) -> None:
                    if message.get("type") == "http.response.body":
                        body_bytes = message.get("body", b"")
                        if b"session_id=" in body_bytes:
                            try:
                                text = body_bytes.decode("utf-8")
                                if "session_id=" in text:
                                    sid = text.split("session_id=")[1].split("\n")[0].split("&")[0].strip()
                                    if sid:
                                        self._session_tokens[sid] = token_to_bind
                            except Exception:
                                pass
                    await send(message)

                await self.app(scope, receive, send_wrapper)
                return

        await self.app(scope, receive, send)


_streamable_manager: StreamableHTTPSessionManager | None = None


@asynccontextmanager
async def mcp_lifespan() -> AsyncIterator[None]:
    """Manages the lifecycle of the MCP Streamable HTTP session manager."""
    global _streamable_manager
    if _streamable_manager is None:
        create_mcp_asgi_app()

    if _streamable_manager is not None:
        async with _streamable_manager.run():
            yield
    else:
        yield


class HybridMCPApp:
    """Dispatches requests between SSE transport and Streamable HTTP transport.

    - POST to /sse, /, or "" routes to Streamable HTTP (for Antigravity, modern MCP clients).
    - GET to /sse or POST to /messages/ routes to SSE transport (for Cursor, legacy SSE clients).
    """

    def __init__(self, sse_app: ASGIApp, http_app: ASGIApp) -> None:
        self.sse_app = sse_app
        self.http_app = http_app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            method = scope.get("method", "GET")
            path = scope.get("path", "")

            # Ensure Accept header accommodates Streamable HTTP if missing or partial
            headers = list(scope.get("headers", []))
            headers_dict = {k.decode("utf-8").lower(): v.decode("utf-8") for k, v in headers}
            accept_val = headers_dict.get("accept", "")
            if method == "POST" and ("text/event-stream" not in accept_val and "*/*" not in accept_val):
                headers = [h for h in headers if h[0].lower() != b"accept"]
                headers.append((b"accept", b"application/json, text/event-stream"))
                scope["headers"] = headers

            # Route POST /sse, POST /, or POST "" to Streamable HTTP
            if method == "POST" and (path.endswith("/sse") or path in ("", "/")):
                scope_copy = dict(scope)
                scope_copy["path"] = "/sse"
                scope_copy["raw_path"] = b"/sse"
                await self.http_app(scope_copy, receive, send)
                return

            # Route other requests (e.g. GET /sse, POST /messages/) to SSE app
            await self.sse_app(scope, receive, send)
            return

        await self.sse_app(scope, receive, send)


def create_mcp_asgi_app() -> ASGIApp:
    """Creates a configured Starlette ASGI application supporting both SSE and Streamable HTTP."""
    global _streamable_manager
    transport_sec = TransportSecuritySettings(enable_dns_rebinding_protection=False)
    sse_subapp = server.sse_app(
        sse_path="/sse",
        message_path="/messages/",
        transport_security=transport_sec,
    )
    http_subapp = server.streamable_http_app(
        streamable_http_path="/sse",
        transport_security=transport_sec,
    )
    _streamable_manager = server._lowlevel_server._session_manager
    hybrid_app = HybridMCPApp(sse_subapp, http_subapp)
    return MCPAccessTokenMiddleware(hybrid_app)


def main() -> None:
    """CLI runner supporting stdio, sse, and streamable-http transports."""
    parser = argparse.ArgumentParser(
        description="Run CareerTrack MCP Server for AI assistants and agentic IDEs.",
    )
    parser.add_argument(
        "--transport",
        choices=["stdio", "sse", "streamable-http"],
        default="stdio",
        help="MCP transport protocol (default: stdio).",
    )
    parser.add_argument(
        "--token",
        type=str,
        default=None,
        help="JWT bearer token to authenticate as a user for this session.",
    )
    parser.add_argument(
        "--client-id",
        type=str,
        default=None,
        help="Client ID for API client authentication.",
    )
    parser.add_argument(
        "--client-secret",
        type=str,
        default=None,
        help="Client Secret corresponding to the Client ID.",
    )
    parser.add_argument(
        "--host",
        type=str,
        default="0.0.0.0",
        help="Host to bind for HTTP/SSE transports (default: 0.0.0.0).",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8001,
        help="Port to bind for HTTP/SSE transports (default: 8001).",
    )

    args = parser.parse_args()

    if args.client_id and args.client_secret:
        os.environ["CAREERTRACK_CLIENT_ID"] = args.client_id
        os.environ["CAREERTRACK_CLIENT_SECRET"] = args.client_secret

    if args.token:
        os.environ["CAREERTRACK_AUTH_TOKEN"] = args.token

    if args.transport == "stdio":
        server.run(transport="stdio")
    elif args.transport == "sse":
        server.run(transport="sse", host=args.host, port=args.port)
    elif args.transport == "streamable-http":
        server.run(transport="streamable-http", host=args.host, port=args.port)


if __name__ == "__main__":
    main()
