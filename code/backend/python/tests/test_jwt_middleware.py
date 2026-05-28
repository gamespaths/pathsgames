import pytest
from unittest.mock import MagicMock, AsyncMock
from fastapi import Request, Response
from app.adapters.rest.middleware.jwt_middleware import JwtMiddleware
from app.core.models.auth.token_info import TokenInfo

@pytest.fixture
def mock_session_service():
    return MagicMock()

@pytest.fixture
def mock_app():
    return MagicMock()

@pytest.mark.anyio
async def test_dispatch_public_path(mock_app, mock_session_service):
    middleware = JwtMiddleware(mock_app, mock_session_service, public_paths=["/api/public"])
    request = MagicMock(spec=Request)
    request.url.path = "/api/public"
    
    call_next = AsyncMock(return_value=Response())
    
    await middleware.dispatch(request, call_next)
    call_next.assert_called_once()

@pytest.mark.anyio
async def test_dispatch_wildcard_path(mock_app, mock_session_service):
    middleware = JwtMiddleware(mock_app, mock_session_service, public_paths=["/api/wildcard/**"])
    request = MagicMock(spec=Request)
    request.url.path = "/api/wildcard/anything"
    
    call_next = AsyncMock(return_value=Response())
    
    await middleware.dispatch(request, call_next)
    call_next.assert_called_once()

@pytest.mark.anyio
async def test_dispatch_options_method(mock_app, mock_session_service):
    middleware = JwtMiddleware(mock_app, mock_session_service, public_paths=[])
    request = MagicMock(spec=Request)
    request.url.path = "/api/private"
    request.method = "OPTIONS"
    
    call_next = AsyncMock(return_value=Response())
    
    await middleware.dispatch(request, call_next)
    call_next.assert_called_once()

@pytest.mark.anyio
async def test_dispatch_missing_token(mock_app, mock_session_service):
    middleware = JwtMiddleware(mock_app, mock_session_service, public_paths=[])
    request = MagicMock(spec=Request)
    request.url.path = "/api/private"
    request.headers = {}
    
    response = await middleware.dispatch(request, None)
    assert response.status_code == 401
    assert b"MISSING_TOKEN" in response.body

@pytest.mark.anyio
async def test_dispatch_invalid_token(mock_app, mock_session_service):
    middleware = JwtMiddleware(mock_app, mock_session_service, public_paths=[])
    request = MagicMock(spec=Request)
    request.url.path = "/api/private"
    request.headers = {"Authorization": "Bearer invalid"}
    
    mock_session_service.validate_access_token.side_effect = ValueError("Invalid")
    
    response = await middleware.dispatch(request, None)
    assert response.status_code == 401
    assert b"INVALID_TOKEN" in response.body

@pytest.mark.anyio
async def test_dispatch_forbidden_admin(mock_app, mock_session_service):
    middleware = JwtMiddleware(mock_app, mock_session_service, public_paths=[])
    request = MagicMock(spec=Request)
    request.url.path = "/api/admin/system"
    request.headers = {"Authorization": "Bearer valid"}
    
    token_info = MagicMock(spec=TokenInfo)
    token_info.is_admin.return_value = False
    mock_session_service.validate_access_token.return_value = token_info
    
    response = await middleware.dispatch(request, None)
    assert response.status_code == 403
    assert b"FORBIDDEN" in response.body

@pytest.mark.anyio
async def test_dispatch_success_enriches_request(mock_app, mock_session_service):
    middleware = JwtMiddleware(mock_app, mock_session_service, public_paths=[])
    request = MagicMock(spec=Request)
    request.url.path = "/api/private"
    request.headers = {"Authorization": "Bearer valid"}
    request.state = MagicMock()
    
    token_info = MagicMock(spec=TokenInfo)
    token_info.is_admin.return_value = False
    token_info.user_uuid = "u1"
    token_info.username = "user1"
    token_info.role = "GUEST"
    mock_session_service.validate_access_token.return_value = token_info
    
    call_next = AsyncMock(return_value=Response())
    
    await middleware.dispatch(request, call_next)
    
    assert request.state.user_uuid == "u1"
    assert request.state.username == "user1"
    assert request.state.role == "GUEST"
    call_next.assert_called_once()
