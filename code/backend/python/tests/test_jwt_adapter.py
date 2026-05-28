import pytest
import jwt
from app.adapters.auth.jwt_adapter import JwtAdapter

@pytest.fixture
def jwt_adapter():
    return JwtAdapter(secret="this-is-a-32-character-secret-!!", access_token_minutes=30, refresh_token_days=7)

def test_generate_and_parse_access_token(jwt_adapter):
    token = jwt_adapter.generate_access_token("u1", "user1", "ADMIN")
    assert token is not None
    
    info = jwt_adapter.parse_token(token)
    assert info.user_uuid == "u1"
    assert info.username == "user1"
    assert info.role == "ADMIN"
    assert info.type == "access"

def test_generate_and_parse_refresh_token(jwt_adapter):
    token = jwt_adapter.generate_refresh_token("u1")
    assert token is not None
    
    info = jwt_adapter.parse_token(token)
    assert info.user_uuid == "u1"
    assert info.type == "refresh"

def test_validate_token_success(jwt_adapter):
    token = jwt_adapter.generate_access_token("u1", "user1", "PLAYER")
    assert jwt_adapter.validate_token(token) is True

def test_validate_token_failure(jwt_adapter):
    assert jwt_adapter.validate_token("invalid.token") is False

def test_parse_token_failure(jwt_adapter):
    with pytest.raises(ValueError, match="TOKEN_PARSE_ERROR"):
        jwt_adapter.parse_token("invalid.token")

def test_get_expirations(jwt_adapter):
    access_exp = jwt_adapter.get_access_token_expiration_ms()
    refresh_exp = jwt_adapter.get_refresh_token_expiration_ms()
    
    import time
    now_ms = int(time.time()) * 1000
    assert access_exp > now_ms
    assert refresh_exp > access_exp
