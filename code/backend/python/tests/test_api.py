import pytest
from fastapi.testclient import TestClient
from app.launcher import app

client = TestClient(app)

def test_echo_status():
    response = client.get("/api/echo/status")
    assert response.status_code == 200
    assert response.json()["status"] == "OK"

def test_404_handler():
    # Use a public path base to avoid 401 from JwtMiddleware
    response = client.get("/api/stories/nonexistent/subpath")
    assert response.status_code == 404
    assert "error" in response.json()
    assert response.json()["error"] == "HTTP_EXCEPTION"

def test_validation_error_handler():
    # Trigger a 400 validation error on a public endpoint if possible, 
    # or just provide a dummy valid-looking token to reach the handler
    response = client.post(
        "/api/admin/stories/import", 
        content="invalid json",
        headers={"Authorization": "Bearer some.valid.token"}
    )
    # The middleware will try to parse 'some.valid.token' and fail with 401 
    # unless we mock the validation.
    # Better: Use a public POST endpoint with validation.
    
    # Let's try /api/auth/guest/resume with invalid JSON
    response = client.post("/api/auth/guest/resume", content="{ invalid")
    assert response.status_code == 400
    assert response.json()["error"] == "VALIDATION_ERROR"

def test_cors_middleware():
    response = client.options(
        "/api/echo/status",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "Content-Type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"

def test_public_paths_bypass_jwt():
    response = client.get("/api/stories")
    # Even if DB is empty, it should pass middleware and reach controller
    assert response.status_code in [200, 404] 
