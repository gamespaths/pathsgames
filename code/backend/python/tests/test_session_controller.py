import pytest
from fastapi.testclient import TestClient
from fastapi import FastAPI, Request
from unittest.mock import MagicMock
from app.adapters.rest.auth.session_controller import SessionController
from app.core.models.auth.refreshed_session import RefreshedSession

@pytest.fixture
def mock_session_service():
    return MagicMock()

@pytest.fixture
def app_with_auth(mock_session_service):
    app = FastAPI()
    
    @app.middleware("http")
    async def auth_middleware(request: Request, call_next):
        if request.headers.get("X-Test-Auth") == "true":
            request.state.user_uuid = "u1"
            request.state.username = "user1"
            request.state.role = "PLAYER"
        response = await call_next(request)
        return response

    controller = SessionController(mock_session_service)
    app.include_router(controller.router)
    return app

@pytest.fixture
def client(app_with_auth):
    return TestClient(app_with_auth)

def test_me(client):
    res = client.get("/me", headers={"X-Test-Auth": "true"})
    assert res.status_code == 200
    assert res.json()["userUuid"] == "u1"
    
    # unauth
    res_unauth = client.get("/me")
    assert res_unauth.status_code == 401

def test_refresh(client, mock_session_service):
    mock_session_service.refresh_session.return_value = RefreshedSession(
        user_uuid="u1", username="user1", role="PLAYER",
        access_token="new_access",
        refresh_token="new_refresh",
        access_token_expires_at=1000,
        refresh_token_expires_at=2000
    )
    
    client.cookies.set("pathsgames.refreshToken", "old_token")
    res = client.post("/refresh")
    assert res.status_code == 200
    assert res.json()["accessToken"] == "new_access"
    
    # missing cookie
    client.cookies.clear()
    res = client.post("/refresh")
    assert res.status_code == 401
    
    # refresh failed
    mock_session_service.refresh_session.side_effect = ValueError("invalid")
    client.cookies.set("pathsgames.refreshToken", "bad_token")
    res = client.post("/refresh")
    assert res.status_code == 401

def test_logout(client, mock_session_service):
    client.cookies.set("pathsgames.refreshToken", "tok")
    res = client.post("/logout")
    assert res.status_code == 200
    mock_session_service.logout.assert_called_once_with("tok")

def test_logout_all(client, mock_session_service):
    res = client.post("/logout/all", headers={"X-Test-Auth": "true"})
    assert res.status_code == 200
    mock_session_service.logout_all.assert_called_once_with("u1")
