import pytest
import time
from unittest.mock import MagicMock
from app.core.models.auth.token_info import TokenInfo
from app.core.services.auth.session_service import SessionService

@pytest.fixture
def jwt_port():
    return MagicMock()

@pytest.fixture
def token_persistence():
    return MagicMock()

@pytest.fixture
def session_service(jwt_port, token_persistence):
    return SessionService(jwt_port, token_persistence, 5)

def test_refresh_session_success(session_service, jwt_port, token_persistence):
    old_token = "old-refresh"
    user_uuid = "u-uuid"
    username = "u-name"
    
    old_info = TokenInfo(sub=user_uuid, username=username, role="PLAYER", type="refresh", iat=int(time.time()), exp=int(time.time())+3600, jti="j1")
    
    jwt_port.validate_token.return_value = True
    jwt_port.parse_token.side_effect = lambda t: {
        old_token: old_info,
        "new-refresh": TokenInfo(sub=user_uuid, username=username, role="PLAYER", type="refresh", iat=int(time.time()), exp=int(time.time())+7200, jti="j2")
    }.get(t)
    
    token_persistence.is_refresh_token_valid.return_value = True
    token_persistence.find_user_id_by_uuid.return_value = 1
    
    jwt_port.generate_access_token.return_value = "new-access"
    jwt_port.generate_refresh_token.return_value = "new-refresh"
    jwt_port.get_access_token_expiration_ms.return_value = 3600000
    jwt_port.get_refresh_token_expiration_ms.return_value = 7200000

    result = session_service.refresh_session(old_token)

    assert result.access_token == "new-access"
    assert result.refresh_token == "new-refresh"
    token_persistence.revoke_all_by_user_uuid.assert_called_with(user_uuid)
    token_persistence.save_refresh_token.assert_called()
    token_persistence.enforce_token_limit.assert_called_with(1, 5)

def test_refresh_session_invalid_token(session_service, jwt_port):
    jwt_port.validate_token.return_value = False
    with pytest.raises(ValueError, match="INVALID_REFRESH_TOKEN"):
        session_service.refresh_session("bad")

def test_refresh_session_not_refresh_type(session_service, jwt_port):
    info = TokenInfo(sub="u", username="n", type="access", iat=0, exp=0)
    jwt_port.validate_token.return_value = True
    jwt_port.parse_token.return_value = info
    with pytest.raises(ValueError, match="NOT_A_REFRESH_TOKEN"):
        session_service.refresh_session("access-token")

def test_refresh_session_revoked(session_service, jwt_port, token_persistence):
    info = TokenInfo(sub="u", username="n", type="refresh", iat=0, exp=3600)
    jwt_port.validate_token.return_value = True
    jwt_port.parse_token.return_value = info
    token_persistence.is_refresh_token_valid.return_value = False
    with pytest.raises(ValueError, match="REVOKED_REFRESH_TOKEN"):
        session_service.refresh_session("revoked")

def test_refresh_session_user_not_found(session_service, jwt_port, token_persistence):
    info = TokenInfo(sub="u", username="n", type="refresh", iat=0, exp=3600)
    jwt_port.validate_token.return_value = True
    jwt_port.parse_token.return_value = info
    token_persistence.is_refresh_token_valid.return_value = True
    token_persistence.find_user_id_by_uuid.return_value = None
    with pytest.raises(ValueError, match="USER_NOT_FOUND"):
        session_service.refresh_session("token")

def test_logout(session_service, token_persistence):
    session_service.logout("t")
    token_persistence.revoke_token.assert_called_with("t")

def test_logout_all(session_service, token_persistence):
    session_service.logout_all("u")
    token_persistence.revoke_all_by_user_uuid.assert_called_with("u")

def test_validate_access_token_success(session_service, jwt_port):
    info = TokenInfo(sub="u", username="n", type="access", iat=0, exp=3600)
    jwt_port.validate_token.return_value = True
    jwt_port.parse_token.return_value = info
    result = session_service.validate_access_token("token")
    assert result == info

def test_validate_access_token_invalid(session_service, jwt_port):
    jwt_port.validate_token.return_value = False
    with pytest.raises(ValueError, match="INVALID_ACCESS_TOKEN"):
        session_service.validate_access_token("bad")

def test_validate_access_token_wrong_type(session_service, jwt_port):
    info = TokenInfo(sub="u", username="n", type="refresh", iat=0, exp=3600)
    jwt_port.validate_token.return_value = True
    jwt_port.parse_token.return_value = info
    with pytest.raises(ValueError, match="NOT_AN_ACCESS_TOKEN"):
        session_service.validate_access_token("refresh-token")
