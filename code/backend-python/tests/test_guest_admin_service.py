import pytest
from unittest.mock import MagicMock
from app.core.services.auth.guest_admin_service import GuestAdminService
from app.core.models.auth.guest_info import GuestInfo
from app.core.models.auth.guest_stats import GuestStats


@pytest.fixture
def mock_persistence_port():
    port = MagicMock()
    return port


def test_list_all_guests(mock_persistence_port):
    mock_persistence_port.find_all_guests.return_value = [
        {
            "uuid": "uuid1",
            "username": "user1",
            "state": 6,
            "guest_cookie_token": "cookie1",
            "ts_registration": "2026-03-31T12:00:00Z",
        }
    ]
    service = GuestAdminService(mock_persistence_port)
    guests = service.list_all_guests()

    assert len(guests) == 1
    assert guests[0].user_uuid == "uuid1"
    assert guests[0].username == "user1"


def test_list_all_guests_empty(mock_persistence_port):
    mock_persistence_port.find_all_guests.return_value = []
    service = GuestAdminService(mock_persistence_port)

    assert service.list_all_guests() == []


def test_get_guest_stats(mock_persistence_port):
    mock_persistence_port.count_all_guests.return_value = 10
    mock_persistence_port.count_active_guests.return_value = 7
    mock_persistence_port.count_expired_guests.return_value = 3

    service = GuestAdminService(mock_persistence_port)
    stats = service.get_guest_stats()

    assert stats.total_guests == 10
    assert stats.active_guests == 7
    assert stats.expired_guests == 3


def test_get_guest_by_uuid_found(mock_persistence_port):
    mock_persistence_port.find_guest_by_uuid.return_value = {
        "uuid": "uuid1",
        "username": "user1",
        "state": 6,
        "guest_cookie_token": "cookie1",
    }
    service = GuestAdminService(mock_persistence_port)
    guest = service.get_guest_by_uuid("uuid1")

    assert guest is not None
    assert guest.user_uuid == "uuid1"


def test_get_guest_by_uuid_not_found(mock_persistence_port):
    mock_persistence_port.find_guest_by_uuid.return_value = None
    service = GuestAdminService(mock_persistence_port)
    guest = service.get_guest_by_uuid("nonexistent")

    assert guest is None


def test_get_guest_by_uuid_empty_string(mock_persistence_port):
    """Empty UUID string returns None without hitting persistence."""
    service = GuestAdminService(mock_persistence_port)
    guest = service.get_guest_by_uuid("")

    assert guest is None
    mock_persistence_port.find_guest_by_uuid.assert_not_called()


def test_delete_guest_success(mock_persistence_port):
    mock_persistence_port.delete_guest_by_uuid.return_value = True
    service = GuestAdminService(mock_persistence_port)

    assert service.delete_guest("uuid1") is True
    mock_persistence_port.delete_guest_by_uuid.assert_called_once_with("uuid1")


def test_delete_guest_not_found(mock_persistence_port):
    mock_persistence_port.delete_guest_by_uuid.return_value = False
    service = GuestAdminService(mock_persistence_port)

    assert service.delete_guest("nonexistent") is False


def test_delete_guest_empty_uuid(mock_persistence_port):
    """Empty UUID string returns False without hitting persistence."""
    service = GuestAdminService(mock_persistence_port)

    assert service.delete_guest("") is False
    mock_persistence_port.delete_guest_by_uuid.assert_not_called()


def test_delete_expired_guests(mock_persistence_port):
    mock_persistence_port.delete_expired_guests.return_value = 4
    service = GuestAdminService(mock_persistence_port)

    assert service.delete_expired_guests() == 4
    mock_persistence_port.delete_expired_guests.assert_called_once()

