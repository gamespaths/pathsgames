"""Tests for the configurable bind host (Settings.host).

Default is loopback (127.0.0.1) for safe local dev; in Docker it is overridden via
the HOST env var to 0.0.0.0 so the published public/admin ports are reachable.
"""
from app.config import Settings


def test_host_defaults_to_loopback():
    settings = Settings()
    assert settings.host == "127.0.0.1"


def test_host_overridden_by_env(monkeypatch):
    monkeypatch.setenv("HOST", "0.0.0.0")
    settings = Settings()
    assert settings.host == "0.0.0.0"
