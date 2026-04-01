import pytest
from unittest.mock import MagicMock
from datetime import datetime, timedelta, timezone
from app.core.services.auth.guest_auth_service import GuestAuthService


@pytest.fixture
def mock_jwt_port():
    port = MagicMock()
    port.generate_access_token.return_value = "mock_access_token"
    port.generate_refresh_token.return_value = "mock_refresh_token"
    port.get_access_token_expiration_ms.return_value = 1000
    port.get_refresh_token_expiration_ms.return_value = 2000
    return port


@pytest.fixture
def mock_persistence_port():
    port = MagicMock()
    port.create_guest_user.return_value = 1
    return port


def test_create_guest_session(mock_jwt_port, mock_persistence_port):
    service = GuestAuthService(mock_jwt_port, mock_persistence_port)
    session = service.create_guest_session()

    assert session.user_uuid is not None
    assert session.username.startswith("guest_")
    assert session.access_token == "mock_access_token"
    assert session.refresh_token == "mock_refresh_token"

    mock_persistence_port.create_guest_user.assert_called_once()
    mock_jwt_port.generate_access_token.assert_called_once()


def test_create_guest_session_username_format(mock_jwt_port, mock_persistence_port):
    """Username must be 'guest_' + first 8 chars of UUID."""
    service = GuestAuthService(mock_jwt_port, mock_persistence_port)
    session = service.create_guest_session()

    assert len(session.username) == len("guest_") + 8
    assert session.username == f"guest_{session.user_uuid[:8]}"


def test_create_guest_session_tokens_stored(mock_jwt_port, mock_persistence_port):
    """Refresh token must be stored in persistence."""
    service = GuestAuthService(mock_jwt_port, mock_persistence_port)
    service.create_guest_session()

    mock_persistence_port.store_refresh_token.assert_called_once()
    mock_persistence_port.update_last_access.assert_called_once()


def test_resume_guest_session_success(mock_jwt_port, mock_persistence_port):
    """Valid, non-expired cookie token resumes the session."""
    future = (datetime.now(timezone.utc) + timedelta(days=10)).isoformat()
    mock_persistence_port.find_guest_by_cookie_token.return_value = {
        "id": 1,
        "uuid": "test-uuid-1234",
        "username": "guest_test1234",
        "guest_expires_at": future,
    }
    service = GuestAuthService(mock_jwt_port, mock_persistence_port)
    session = service.resume_guest_session("valid-cookie-token")

    assert session is not None
    assert session.user_uuid == "test-uuid-1234"
    assert session.access_token == "mock_access_token"
    mock_persistence_port.store_refresh_token.assert_called_once()
    mock_persistence_port.update_last_access.assert_called_once()


def test_resume_guest_session_not_found(mock_jwt_port, mock_persistence_port):
    """Unknown cookie token returns None."""
    mock_persistence_port.find_guest_by_cookie_token.return_value = None
    service = GuestAuthService(mock_jwt_port, mock_persistence_port)

    result = service.resume_guest_session("unknown-token")

    assert result is None


def test_resume_guest_session_expired(mock_jwt_port, mock_persistence_port):
    """Expired session returns None."""
    past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    mock_persistence_port.find_guest_by_cookie_token.return_value = {
        "id": 2,
        "uuid": "expired-uuid",
        "username": "guest_expiredx",
        "guest_expires_at": past,
    }
    service = GuestAuthService(mock_jwt_port, mock_persistence_port)

    result = service.resume_guest_session("expired-cookie-token")

    assert result is None


def test_resume_guest_session_empty_token(mock_jwt_port, mock_persistence_port):
    """Empty cookie token returns None without hitting persistence."""
    service = GuestAuthService(mock_jwt_port, mock_persistence_port)

    result = service.resume_guest_session("")

    assert result is None
    mock_persistence_port.find_guest_by_cookie_token.assert_not_called()


def test_cleanup_expired_guest_sessions(mock_jwt_port, mock_persistence_port):
    """Cleanup delegates to persistence and returns deleted count."""
    mock_persistence_port.delete_expired_guests.return_value = 5
    service = GuestAuthService(mock_jwt_port, mock_persistence_port)

    deleted = service.cleanup_expired_guest_sessions()

    assert deleted == 5
    mock_persistence_port.delete_expired_guests.assert_called_once()

