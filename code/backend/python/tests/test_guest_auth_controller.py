import pytest
from fastapi.testclient import TestClient
from fastapi import FastAPI
from unittest.mock import MagicMock
from app.adapters.rest.auth.guest_auth_controller import GuestAuthController
from app.core.models.auth.guest_session import GuestSession
from app.core.models.auth.token_info import TokenInfo

@pytest.fixture
def mock_guest_port():
    return MagicMock()

@pytest.fixture
def mock_jwt_port():
    return MagicMock()

@pytest.fixture
def mock_token_port():
    return MagicMock()

@pytest.fixture
def client(mock_guest_port, mock_jwt_port, mock_token_port):
    app = FastAPI()
    controller = GuestAuthController(mock_guest_port, mock_jwt_port, mock_token_port)
    app.include_router(controller.router)
    return TestClient(app)

def test_create_guest(client, mock_guest_port, mock_jwt_port):
    session = GuestSession(user_uuid="u1", username="user1", access_token="a", refresh_token="r", access_token_expires_at=1, refresh_token_expires_at=2, guest_cookie_token="cookie")
    mock_guest_port.create_guest_session.return_value = session
    mock_jwt_port.generate_access_token.return_value = "access"
    mock_jwt_port.generate_refresh_token.return_value = "refresh"
    mock_jwt_port.get_access_token_expiration_ms.return_value = 1000
    mock_jwt_port.get_refresh_token_expiration_ms.return_value = 2000
    mock_jwt_port.parse_token.return_value = TokenInfo(sub="u1", iss="i", aud="a", exp=1, nbf=0, iat=0, jti="j", roles=[], username="u", type="refresh")
    
    response = client.post("/api/auth/guest")
    assert response.status_code == 201
    assert response.json()["accessToken"] == "access"

def test_resume_guest(client, mock_guest_port, mock_jwt_port):
    session = GuestSession(user_uuid="u1", username="user1", access_token="a", refresh_token="r", access_token_expires_at=1, refresh_token_expires_at=2, guest_cookie_token="cookie")
    mock_guest_port.resume_guest_session.return_value = session
    mock_jwt_port.generate_access_token.return_value = "access"
    mock_jwt_port.generate_refresh_token.return_value = "refresh"
    mock_jwt_port.get_access_token_expiration_ms.return_value = 1000
    mock_jwt_port.get_refresh_token_expiration_ms.return_value = 2000
    mock_jwt_port.parse_token.return_value = TokenInfo(sub="u1", iss="i", aud="a", exp=1, nbf=0, iat=0, jti="j", roles=[], username="u", type="refresh")
    
    # Via cookie
    client.cookies.set("pathsgames.guestcookie", "cookie")
    response = client.post("/api/auth/guest/resume")
    assert response.status_code == 200
    
    # Via body
    client.cookies.clear()
    response = client.post("/api/auth/guest/resume", json={"guestCookieToken": "cookie"})
    assert response.status_code == 200
    
    # Missing token
    response = client.post("/api/auth/guest/resume")
    assert response.status_code == 400
        
    # Expired session
    mock_guest_port.resume_guest_session.return_value = None
    response = client.post("/api/auth/guest/resume", json={"guestCookieToken": "cookie"})
    assert response.status_code == 401
