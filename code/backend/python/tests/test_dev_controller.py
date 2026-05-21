"""Tests for the dev-only DevController (POST /api/dev/cleanup)."""
from unittest.mock import MagicMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.adapters.rest.dev.dev_controller import DevController
from app.core.models.dev.cleanup_result import CleanupResult


def _client(cleanup_port, enabled):
    app = FastAPI()
    controller = DevController(cleanup_port, enabled)
    app.include_router(controller.router)
    return TestClient(app)


def test_cleanup_returns_counts_when_enabled():
    cleanup_port = MagicMock()
    cleanup_port.cleanup_test_data.return_value = CleanupResult(deleted_guests=5, deleted_matches=2)
    client = _client(cleanup_port, True)

    response = client.post("/api/dev/cleanup")

    assert response.status_code == 200
    assert response.json() == {"deletedGuests": 5, "deletedMatches": 2}
    cleanup_port.cleanup_test_data.assert_called_once()


def test_cleanup_returns_403_when_disabled():
    cleanup_port = MagicMock()
    client = _client(cleanup_port, False)

    response = client.post("/api/dev/cleanup")

    assert response.status_code == 403
    # FastAPI wraps HTTPException.detail under the "detail" key
    assert response.json()["detail"]["error"] == "DEV_ENDPOINTS_DISABLED"
    cleanup_port.cleanup_test_data.assert_not_called()
