"""SessionService: v1.2.0 hashed refresh tokens, rotation of the used token only, the 30-second grace,
SESSION_REVOKED, the user state check, logout and access validation."""
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import pytest

from app.core.models.auth.auth_error import AuthError
from app.core.models.auth.identity import StoredRefreshToken, UserStatus
from app.core.models.auth.token_info import TokenInfo
from app.core.services.auth import token_hasher
from app.core.services.auth.session_service import SessionService

NOW = datetime(2026, 10, 19, 10, 0, tzinfo=timezone.utc)
TOKEN = "refresh-jwt"
HASH = token_hasher.sha256(TOKEN)


@pytest.fixture
def jwt_port():
    j = MagicMock()
    j.validate_token.return_value = True
    j.parse_token.return_value = TokenInfo(sub="u", username="", type="refresh", iat=0, exp=0)
    j.generate_access_token.return_value = "access-2"
    j.generate_refresh_token.return_value = "refresh-2"
    j.get_access_token_expiration_ms.return_value = 1000
    j.get_refresh_token_expiration_ms.return_value = int((NOW + timedelta(days=7)).timestamp() * 1000)
    return j


@pytest.fixture
def tokens():
    t = MagicMock()
    t.find_refresh_token.return_value = StoredRefreshToken(10, 1, False, (NOW + timedelta(hours=1)).isoformat(), None)
    t.find_user_by_id.return_value = UserStatus(1, "u", "google_u", "mario", "PLAYER", 2, "en")
    return t


@pytest.fixture
def service(jwt_port, tokens):
    return SessionService(jwt_port, tokens, 5, clock=lambda: NOW)


def test_rotates_only_the_used_token(service, tokens):
    result = service.refresh_session(TOKEN)
    assert result.access_token == "access-2" and result.refresh_token == "refresh-2"
    assert result.username == "google_u" and result.role == "PLAYER"
    tokens.find_refresh_token.assert_called_with(HASH, TOKEN)
    tokens.mark_rotated.assert_called_once_with(10, NOW.isoformat())
    tokens.revoke_all_by_user_uuid.assert_not_called()
    tokens.store_refresh_token.assert_called_once()
    assert tokens.store_refresh_token.call_args[0][1] == token_hasher.sha256("refresh-2")
    tokens.enforce_token_limit.assert_called_with(1, 5)
    tokens.update_last_access.assert_called_with(1)


def test_invalid_inputs(service, jwt_port, tokens):
    with pytest.raises(ValueError):
        service.refresh_session("")
    jwt_port.validate_token.return_value = False
    with pytest.raises(ValueError, match="INVALID_REFRESH_TOKEN"):
        service.refresh_session(TOKEN)
    jwt_port.validate_token.return_value = True
    jwt_port.parse_token.return_value = TokenInfo(sub="u", username="", type="access", iat=0, exp=0)
    with pytest.raises(ValueError, match="NOT_A_REFRESH_TOKEN"):
        service.refresh_session(TOKEN)


def test_unknown_or_expired_token(service, jwt_port, tokens):
    tokens.find_refresh_token.return_value = None
    with pytest.raises(ValueError):
        service.refresh_session(TOKEN)
    tokens.find_refresh_token.return_value = StoredRefreshToken(10, 1, False, (NOW - timedelta(seconds=1)).isoformat(),
                                                                None)
    with pytest.raises(ValueError):
        service.refresh_session(TOKEN)
    tokens.find_refresh_token.return_value = StoredRefreshToken(10, 1, False, "garbage", None)
    with pytest.raises(ValueError):
        service.refresh_session(TOKEN)


def test_grace_window(service, tokens):
    tokens.find_refresh_token.return_value = StoredRefreshToken(
        10, 1, True, "2999-01-01T00:00:00", (NOW - timedelta(seconds=29)).isoformat())
    assert service.refresh_session(TOKEN).access_token == "access-2"
    tokens.mark_rotated.assert_not_called()


def test_revoked_after_grace_or_by_logout_is_session_revoked(service, tokens):
    tokens.find_refresh_token.return_value = StoredRefreshToken(
        10, 1, True, None, (NOW - timedelta(seconds=31)).isoformat())
    with pytest.raises(AuthError) as e:
        service.refresh_session(TOKEN)
    assert e.value.code == "SESSION_REVOKED" and e.value.http_status == 401
    tokens.find_refresh_token.return_value = StoredRefreshToken(10, 1, True, None, None)
    with pytest.raises(AuthError):
        service.refresh_session(TOKEN)


def test_missing_user_or_other_subject(service, tokens):
    tokens.find_user_by_id.return_value = None
    with pytest.raises(ValueError):
        service.refresh_session(TOKEN)
    tokens.find_user_by_id.return_value = UserStatus(1, "other", "x", "x", "PLAYER", 2)
    with pytest.raises(ValueError):
        service.refresh_session(TOKEN)


@pytest.mark.parametrize("state,code", [(3, "ACCOUNT_DISABLED"), (4, "ACCOUNT_DISABLED"),
                                        (7, "ACCOUNT_DELETION_IN_PROGRESS")])
def test_disabled_users_are_refused(service, tokens, state, code):
    tokens.find_user_by_id.return_value = UserStatus(1, "u", "g", "m", "PLAYER", state)
    with pytest.raises(AuthError) as e:
        service.refresh_session(TOKEN)
    assert e.value.code == code
    tokens.mark_rotated.assert_not_called()


def test_logout_and_logout_all(service, tokens):
    service.logout(TOKEN)
    tokens.revoke_refresh_token.assert_called_with(HASH, TOKEN)
    service.logout("")
    assert tokens.revoke_refresh_token.call_count == 1
    service.logout_all("u")
    tokens.revoke_all_by_user_uuid.assert_called_with("u")


def test_validate_access_token(service, jwt_port):
    jwt_port.parse_token.return_value = TokenInfo(sub="u", username="n", type="access", iat=0, exp=0)
    assert service.validate_access_token("a").user_uuid == "u"
    jwt_port.parse_token.return_value = TokenInfo(sub="u", username="n", type="refresh", iat=0, exp=0)
    with pytest.raises(ValueError, match="NOT_AN_ACCESS_TOKEN"):
        service.validate_access_token("a")
    jwt_port.validate_token.return_value = False
    with pytest.raises(ValueError, match="INVALID_ACCESS_TOKEN"):
        service.validate_access_token("a")
