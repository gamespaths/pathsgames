"""Unit tests for authorizer/handler.py — the IP-allow-list Lambda authorizer that
gates the admin HTTP API. ADMIN_IP_WHITELIST is read at call time, so no reload needed."""
from authorizer.handler import lambda_handler


def _event(source_ip):
    return {"requestContext": {"http": {"sourceIp": source_ip}}}


def test_empty_whitelist_allows_all(monkeypatch):
    monkeypatch.delenv("ADMIN_IP_WHITELIST", raising=False)
    assert lambda_handler(_event("9.9.9.9"), {}) == {"isAuthorized": True}


def test_allowed_ip_passes(monkeypatch):
    monkeypatch.setenv("ADMIN_IP_WHITELIST", "1.2.3.4, 5.6.7.8")
    assert lambda_handler(_event("5.6.7.8"), {})["isAuthorized"] is True


def test_disallowed_ip_blocked(monkeypatch):
    monkeypatch.setenv("ADMIN_IP_WHITELIST", "1.2.3.4")
    assert lambda_handler(_event("9.9.9.9"), {})["isAuthorized"] is False


def test_falls_back_to_x_forwarded_for(monkeypatch):
    monkeypatch.setenv("ADMIN_IP_WHITELIST", "1.2.3.4")
    event = {"requestContext": {"http": {}}, "headers": {"x-forwarded-for": "1.2.3.4, 10.0.0.1"}}
    assert lambda_handler(event, {})["isAuthorized"] is True


def test_blank_whitelist_string_allows_all(monkeypatch):
    monkeypatch.setenv("ADMIN_IP_WHITELIST", "   ")
    assert lambda_handler(_event("9.9.9.9"), {}) == {"isAuthorized": True}
