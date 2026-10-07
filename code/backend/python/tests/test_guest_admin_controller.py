import pytest
from fastapi.testclient import TestClient
from fastapi import FastAPI
from unittest.mock import MagicMock
from app.adapters.rest.auth.guest_admin_controller import GuestAdminController
from app.core.models.auth.guest_info import GuestInfo
from app.core.models.auth.guest_stats import GuestStats

@pytest.fixture
def mock_port():
    return MagicMock()

@pytest.fixture
def client(mock_port):
    app = FastAPI()
    controller = GuestAdminController(mock_port)
    app.include_router(controller.router)
    return TestClient(app)

def test_list_all_guests(client, mock_port):
    """v0.36.2 — the endpoint answers the paged envelope, not a bare array."""
    mock_port.list_guests_page.return_value = {
        "items": [GuestInfo(user_uuid="g1", username="u1", role="PLAYER", state=6,
                            guest_cookie_token="cookie")],
        "next_cursor": "next-page",
        "limit": 50,
    }
    response = client.get("/api/admin/guests")
    assert response.status_code == 200
    body = response.json()
    assert len(body["items"]) == 1
    assert body["items"][0]["userUuid"] == "g1"
    assert body["nextCursor"] == "next-page"
    assert body["limit"] == 50


def test_list_guests_passes_the_paging_arguments_through(client, mock_port):
    mock_port.list_guests_page.return_value = {"items": [], "next_cursor": None, "limit": 10}
    client.get("/api/admin/guests?limit=10&cursor=abc&olderThanDays=90")
    mock_port.list_guests_page.assert_called_once_with(90, "abc", 10)


def test_preview_stale_guests_reports_both_counts(client, mock_port):
    mock_port.preview_stale_guests.return_value = {"guests": 412, "matches": 517}
    response = client.get("/api/admin/guests/stale?olderThanDays=90")
    assert response.status_code == 200
    assert response.json() == {"guests": 412, "matches": 517}


def test_delete_stale_guests_takes_the_matches_with_them(client, mock_port):
    mock_port.delete_stale_guests.return_value = {"guests": 412, "matches": 517}
    response = client.delete("/api/admin/guests/stale?olderThanDays=90")
    assert response.status_code == 200
    assert response.json() == {"guests": 412, "matches": 517,
                               "status": "CLEANUP_COMPLETE"}


def test_stale_guests_refuses_without_a_bound(client, mock_port):
    """Without olderThanDays the purge would take EVERY guest: refuse, never guess."""
    response = client.delete("/api/admin/guests/stale")
    assert response.status_code == 400
    assert response.json()["error"] == "INVALID_INPUT"
    mock_port.delete_stale_guests.assert_not_called()

def test_get_guest_stats(client, mock_port):
    mock_port.get_guest_stats.return_value = GuestStats(total_guests=10, active_guests=5, expired_guests=5)
    response = client.get("/api/admin/guests/stats")
    assert response.status_code == 200
    assert response.json()["totalGuests"] == 10

def test_get_guest_by_uuid(client, mock_port):
    mock_port.get_guest_by_uuid.return_value = GuestInfo(user_uuid="g1", username="u1", role="PLAYER", state=6, guest_cookie_token="cookie")
    response = client.get("/api/admin/guests/g1")
    assert response.status_code == 200
    assert response.json()["userUuid"] == "g1"
    
    mock_port.get_guest_by_uuid.return_value = None
    response = client.get("/api/admin/guests/miss")
    assert response.status_code == 404

def test_delete_guest(client, mock_port):
    mock_port.delete_guest.return_value = True
    response = client.delete("/api/admin/guests/g1")
    assert response.status_code == 200
    assert response.json()["status"] == "DELETED"
    
    mock_port.delete_guest.return_value = False
    response = client.delete("/api/admin/guests/miss")
    assert response.status_code == 404

def test_delete_expired_guests(client, mock_port):
    mock_port.delete_expired_guests.return_value = 5
    response = client.delete("/api/admin/guests/expired")
    assert response.status_code == 200
    assert response.json()["deletedCount"] == 5
