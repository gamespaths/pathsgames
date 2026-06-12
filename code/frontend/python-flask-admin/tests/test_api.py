import pytest

import app.api as api
from app import create_app
from app.config import Config


class _Resp:
    def __init__(self, ok=True, status=200, payload=None, content=b"{}"):
        self.ok = ok
        self.status_code = status
        self._payload = payload if payload is not None else {}
        self.content = content

    def json(self):
        if self._payload is _RAISE:
            raise ValueError("no json")
        return self._payload


_RAISE = object()


@pytest.fixture
def app():
    return create_app(Config)


def test_request_sends_bearer_and_builds_url(app, monkeypatch):
    captured = {}

    def fake_request(method, url, json=None, params=None, headers=None, timeout=None):
        captured.update(method=method, url=url, headers=headers, params=params)
        return _Resp(payload={"x": 1}, content=b'{"x":1}')

    monkeypatch.setattr(api.requests, "request", fake_request)
    with app.test_request_context():
        from flask import session
        session["admin_token"] = "eyJabc"
        out = api.request("GET", "/api/admin/stories", params={"lang": "en"})

    assert out == {"x": 1}
    assert captured["headers"]["Authorization"] == "Bearer eyJabc"
    assert captured["url"] == "http://localhost:8044/api/admin/stories"
    assert captured["params"] == {"lang": "en"}


def test_request_raises_apierror_on_http_error(app, monkeypatch):
    def fake_request(method, url, **kw):
        return _Resp(ok=False, status=400, payload={"message": "Bad request"}, content=b"{}")

    monkeypatch.setattr(api.requests, "request", fake_request)
    with app.test_request_context():
        with pytest.raises(api.ApiError) as exc:
            api.request("GET", "/api/admin/stories")
    assert "Bad request" in str(exc.value)
    assert exc.value.status == 400


def test_request_handles_204_no_content(app, monkeypatch):
    monkeypatch.setattr(api.requests, "request",
                        lambda *a, **k: _Resp(status=204, content=b""))
    with app.test_request_context():
        assert api.request("DELETE", "/api/admin/guests/abc") is None


def test_seg_rejects_unsafe_segment():
    assert api._seg("good-uuid_1") == "good-uuid_1"
    with pytest.raises(api.ApiError):
        api._seg("bad/segment")


def test_session_server_override(app, monkeypatch):
    captured = {}
    monkeypatch.setattr(api.requests, "request",
                        lambda method, url, **k: captured.update(url=url) or _Resp(content=b"{}"))
    with app.test_request_context():
        from flask import session
        session["admin_token"] = "eyJabc"
        session["admin_server"] = "http://other:9000"
        api.request("GET", "/api/echo/status")
    assert captured["url"] == "http://other:9000/api/echo/status"
