import binascii

import pyotp

from utils.config import get_broker_totp_key
from utils.logging import get_logger

logger = get_logger(__name__)


def generate_broker_totp_code() -> tuple[str | None, str | None]:
    """
    Generate the current broker TOTP from BROKER_TOTP_KEY.

    Returns:
        tuple[str | None, str | None]:
            (current_totp_code, error_message)
    """
    totp_key = (get_broker_totp_key() or "").strip()
    if not totp_key:
        return None, None

    try:
        return pyotp.TOTP(totp_key).now(), None
    except (TypeError, ValueError, binascii.Error) as exc:
        logger.warning(f"Invalid BROKER_TOTP_KEY configuration: {exc}")
        return (
            None,
            "Configured BROKER_TOTP_KEY is invalid. Update it in .env and restart OpenAlgo, or enter the TOTP manually.",
        )


def is_broker_totp_configured() -> bool:
    """
    Check whether BROKER_TOTP_KEY is present and can generate a valid TOTP code.
    """
    totp_code, error = generate_broker_totp_code()
    return bool(totp_code and not error)


def resolve_broker_totp_code(
    manual_code: str | None,
    *,
    required: bool = True,
    field_label: str = "TOTP code",
) -> tuple[str | None, str | None, bool]:
    """
    Prefer a manually entered TOTP, otherwise fall back to BROKER_TOTP_KEY.

    Returns:
        tuple[str | None, str | None, bool]:
            (totp_code, error_message, used_env_totp)
    """
    entered_code = (manual_code or "").strip()
    if entered_code:
        return entered_code, None, False

    generated_code, generation_error = generate_broker_totp_code()
    if generated_code:
        return generated_code, None, True

    if generation_error and required:
        return None, generation_error, False

    if required:
        return None, f"{field_label} is required.", False

    return None, None, False
