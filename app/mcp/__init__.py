"""CareerTrack MCP (Model Context Protocol) package.

Exposes user skills, career preferences, work experience, workspaces,
and career context via standardized MCP tools and resources.
"""

from typing import Any

__all__ = ["create_mcp_server", "create_mcp_asgi_app", "server"]


def __getattr__(name: str) -> Any:
    if name in ("create_mcp_server", "create_mcp_asgi_app", "server"):
        from app.mcp.server import create_mcp_asgi_app, create_mcp_server, server

        if name == "create_mcp_server":
            return create_mcp_server
        if name == "create_mcp_asgi_app":
            return create_mcp_asgi_app
        return server
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
