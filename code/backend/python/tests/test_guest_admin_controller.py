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
    mock_port.list_all_guests.return_value = [
        GuestInfo(user_uuid="g1", username="u1", role="PLAYER", state=6, guest_cookie_token="cookie")
    ]
    response = client.get("/api/admin/guests")
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["userUuid"] == "g1"

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
