"""Helpers for normalizing broker authentication failures."""

from __future__ import annotations

from typing import Any

from database.auth_db import revoke_auth_session, verify_api_key

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


def revoke_broker_session_for_api_key(api_key: str | None, error: Any) -> bool:
    """
    Revoke the locally cached broker session when the broker reports auth expiry.

    This converts broker-side token expiry into OpenAlgo's local revoked-session state,
    so subsequent requests short-circuit before hitting the broker again.
    """
    if not api_key or not is_broker_auth_error(error):
        return False

    user_id = verify_api_key(api_key)
    if not user_id:
        return False

    return revoke_auth_session(user_id, reason=str(error))
