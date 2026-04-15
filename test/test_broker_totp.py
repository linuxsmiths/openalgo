import os

import utils.broker_totp as broker_totp


class FakeTotpGenerator:
    def __init__(self, secret):
        self.secret = secret

    def now(self):
        return f"code-for-{self.secret}"


class InvalidTotpGenerator:
    def __init__(self, secret):
        self.secret = secret

    def now(self):
        raise ValueError("invalid base32 secret")


def test_generate_broker_totp_code_uses_broker_totp_key(monkeypatch):
    monkeypatch.setenv("BROKER_TOTP_KEY", "seed123")
    monkeypatch.setattr(broker_totp.pyotp, "TOTP", FakeTotpGenerator)

    code, error = broker_totp.generate_broker_totp_code()

    assert code == "code-for-seed123"
    assert error is None
    assert broker_totp.is_broker_totp_configured() is True


def test_resolve_broker_totp_code_uses_manual_value_before_env(monkeypatch):
    monkeypatch.setenv("BROKER_TOTP_KEY", "seed123")
    monkeypatch.setattr(broker_totp.pyotp, "TOTP", FakeTotpGenerator)

    code, error, used_env_totp = broker_totp.resolve_broker_totp_code("123456")

    assert code == "123456"
    assert error is None
    assert used_env_totp is False


def test_resolve_broker_totp_code_requires_manual_or_env_for_required_fields(monkeypatch):
    monkeypatch.delenv("BROKER_TOTP_KEY", raising=False)

    code, error, used_env_totp = broker_totp.resolve_broker_totp_code(None)

    assert code is None
    assert error == "TOTP code is required."
    assert used_env_totp is False


def test_invalid_broker_totp_key_does_not_block_optional_fallback(monkeypatch):
    monkeypatch.setenv("BROKER_TOTP_KEY", "invalid-seed")
    monkeypatch.setattr(broker_totp.pyotp, "TOTP", InvalidTotpGenerator)

    code, error, used_env_totp = broker_totp.resolve_broker_totp_code(
        "",
        required=False,
    )

    assert code is None
    assert error is None
    assert used_env_totp is False
    assert broker_totp.is_broker_totp_configured() is False
