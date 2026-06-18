"""Tests for the strict public/admin app split in launcher.py.

The public app (`app`, served on settings.port) must NOT expose any /api/admin/** route,
and the admin app (`app_admin`, served on settings.admin_port) must expose ONLY admin routes.
"""
from fastapi.testclient import TestClient

from app.launcher import app, app_admin


def _paths(application):
    return {route.path for route in application.routes if hasattr(route, "path")}


def test_public_app_has_no_admin_routes():
    public = _paths(app)
    assert "/api/matches" in public
    assert "/api/echo/status" in public
    assert not any(p.startswith("/api/admin/") for p in public)
    # Dev maintenance endpoints moved to the admin app.
    assert not any(p.startswith("/api/dev") for p in public)


def test_admin_app_has_only_admin_routes():
    admin = _paths(app_admin)
    # Admin surface present
    assert "/api/admin/matches" in admin
    assert "/api/admin/matches/statuses" in admin
    assert "/api/admin/stories" in admin
    assert "/api/admin/guests" in admin
    # Health check is intentionally exposed on the admin app too (same EchoService)
    assert "/api/echo/status" in admin
    # Dev-only maintenance endpoints are served only on the admin app
    assert "/api/dev/cleanup" in admin
    # No player/story public routes on the admin app
    assert "/api/matches" not in admin
    assert "/api/stories" not in admin


def test_public_app_does_not_serve_admin_path():
    # Route absent on the public app → never a 200.
    resp = TestClient(app).get("/api/admin/matches/statuses")
    assert resp.status_code != 200


def test_admin_app_does_not_serve_public_path():
    # /api/stories is a public path (JWT bypassed) but is not mounted on the admin app,
    # so it must 404 instead of returning data.
    resp = TestClient(app_admin).get("/api/stories")
    assert resp.status_code == 404


def test_admin_app_serves_health_check():
    # The /api/echo/status health check IS exposed on the admin app (same EchoService).
    resp = TestClient(app_admin).get("/api/echo/status")
    assert resp.status_code == 200
    assert resp.json().get("status") is not None
