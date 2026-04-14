"""Helpers for normalizing broker authentication failures."""

from __future__ import annotations

from typing import Any

AUTH_ERROR_MARKERS = (
    "invalid token",
    "token expired",
    "expired token",
    "auth token",
    "authentication failed",
    "unauthorized",
    "session expired",
    "ag8001",
    "e-session-0007",
)


def is_broker_auth_error(error: Any) -> bool:
    """Return True when an error message indicates an expired broker session."""
    error_text = str(error).lower()
    return any(marker in error_text for marker in AUTH_ERROR_MARKERS)


def broker_auth_error_response(message: str = "Broker session expired. Please re-authenticate."):
    """Standard auth error payload for broker session failures."""
    return (
        False,
        {
            "status": "error",
            "message": message,
            "auth_error": True,
        },
        401,
    )
