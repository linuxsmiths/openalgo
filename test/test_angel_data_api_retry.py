import os

import httpx

os.environ.setdefault("BROKER_API_KEY", "test-broker-api-key")

from broker.angel.api import data as angel_data  # noqa: E402


class FakeResponse:
    def __init__(self, status_code: int, text: str):
        self.status_code = status_code
        self.text = text


class FlakyClient:
    def __init__(self):
        self.calls = 0

    def post(self, url, headers=None, content=None):
        self.calls += 1
        if self.calls == 1:
            raise httpx.RemoteProtocolError("Server disconnected without sending a response.")
        return FakeResponse(200, '{"status": true, "data": {"fetched": []}}')


class FailingClient:
    def __init__(self):
        self.calls = 0

    def post(self, url, headers=None, content=None):
        self.calls += 1
        raise httpx.RemoteProtocolError("Server disconnected without sending a response.")


def test_get_api_response_retries_transient_transport_failure(monkeypatch):
    client = FlakyClient()
    monkeypatch.setattr(angel_data, "get_httpx_client", lambda: client)
    monkeypatch.setattr(angel_data.time, "sleep", lambda *_args, **_kwargs: None)

    response = angel_data.get_api_response(
        "/rest/secure/angelbroking/market/v1/quote/",
        "auth-token",
        "POST",
        payload='{"mode":"FULL"}',
        max_retries=1,
    )

    assert response["status"] is True
    assert client.calls == 2


def test_get_api_response_returns_error_payload_after_retry_exhausted(monkeypatch):
    client = FailingClient()
    monkeypatch.setattr(angel_data, "get_httpx_client", lambda: client)
    monkeypatch.setattr(angel_data.time, "sleep", lambda *_args, **_kwargs: None)

    response = angel_data.get_api_response(
        "/rest/secure/angelbroking/market/v1/quote/",
        "auth-token",
        "POST",
        payload='{"mode":"FULL"}',
        max_retries=1,
    )

    assert response["status"] is False
    assert "Server disconnected without sending a response." in response["message"]
    assert client.calls == 2
