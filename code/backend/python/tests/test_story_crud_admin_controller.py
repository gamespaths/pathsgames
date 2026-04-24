"""
Tests for StoryCrudAdminController — Step 17 REST endpoints.
Tests all 7 endpoints using FastAPI TestClient.
"""
import pytest
from unittest.mock import MagicMock
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.adapters.rest.story.story_crud_admin_controller import StoryCrudAdminController


@pytest.fixture
def mock_crud():
    return MagicMock()


@pytest.fixture
def app_client(mock_crud):
    app = FastAPI()
    ctrl = StoryCrudAdminController(mock_crud)
    app.include_router(ctrl.router)

    # Middleware to set admin role
    from starlette.middleware.base import BaseHTTPMiddleware
    class FakeAuthMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request, call_next):
            request.state.role = "ADMIN"
            return await call_next(request)
    app.add_middleware(FakeAuthMiddleware)

    return TestClient(app), mock_crud


@pytest.fixture
def guest_client(mock_crud):
    app = FastAPI()
    ctrl = StoryCrudAdminController(mock_crud)
    app.include_router(ctrl.router)

    from starlette.middleware.base import BaseHTTPMiddleware
    class GuestMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request, call_next):
            request.state.role = "GUEST"
            return await call_next(request)
    app.add_middleware(GuestMiddleware)

    return TestClient(app), mock_crud


# === Auth guard ===

class TestAuthGuard:
    def test_list_entities_requires_admin(self, guest_client):
        client, _ = guest_client
        resp = client.get("/api/admin/stories/uuid/locations")
        assert resp.status_code == 403

    def test_create_story_requires_admin(self, guest_client):
        client, _ = guest_client
        resp = client.post("/api/admin/stories", json={"author": "X"})
        assert resp.status_code == 403


# === List entities ===

class TestListEntities:
    def test_returns_list(self, app_client):
        client, crud = app_client
        crud.list_entities.return_value = [{"uuid": "e1"}]
        resp = client.get("/api/admin/stories/s-uuid/locations")
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    def test_story_not_found(self, app_client):
        client, crud = app_client
        crud.list_entities.return_value = None
        resp = client.get("/api/admin/stories/bad/locations")
        assert resp.status_code == 404


# === Get entity ===

class TestGetEntity:
    def test_returns_entity(self, app_client):
        client, crud = app_client
        crud.get_entity.return_value = {"uuid": "e1", "isSafe": 1}
        resp = client.get("/api/admin/stories/s-uuid/locations/e1")
        assert resp.status_code == 200
        assert resp.json()["uuid"] == "e1"

    def test_not_found(self, app_client):
        client, crud = app_client
        crud.get_entity.return_value = None
        resp = client.get("/api/admin/stories/s-uuid/locations/bad")
        assert resp.status_code == 404


# === Create entity ===

class TestCreateEntity:
    def test_creates(self, app_client):
        client, crud = app_client
        crud.create_entity.return_value = {"uuid": "new-e"}
        resp = client.post("/api/admin/stories/s-uuid/locations", json={"isSafe": 1})
        assert resp.status_code == 201

    def test_empty_body(self, app_client):
        client, crud = app_client
        resp = client.post("/api/admin/stories/s-uuid/locations", content=b"null",
                          headers={"Content-Type": "application/json"})
        assert resp.status_code == 400

    def test_story_not_found(self, app_client):
        client, crud = app_client
        crud.create_entity.return_value = None
        resp = client.post("/api/admin/stories/bad/locations", json={"k": "v"})
        assert resp.status_code == 404


# === Update entity ===

class TestUpdateEntity:
    def test_updates(self, app_client):
        client, crud = app_client
        crud.update_entity.return_value = {"uuid": "e1"}
        resp = client.put("/api/admin/stories/s-uuid/locations/e1", json={"isSafe": 0})
        assert resp.status_code == 200

    def test_not_found(self, app_client):
        client, crud = app_client
        crud.update_entity.return_value = None
        resp = client.put("/api/admin/stories/s-uuid/locations/bad", json={"k": "v"})
        assert resp.status_code == 404

    def test_empty_body(self, app_client):
        client, crud = app_client
        resp = client.put("/api/admin/stories/s-uuid/locations/e1", content=b"null",
                          headers={"Content-Type": "application/json"})
        assert resp.status_code == 400


# === Delete entity ===

class TestDeleteEntity:
    def test_deletes(self, app_client):
        client, crud = app_client
        crud.delete_entity.return_value = True
        resp = client.delete("/api/admin/stories/s-uuid/locations/e1")
        assert resp.status_code == 200
        assert resp.json()["status"] == "DELETED"

    def test_not_found(self, app_client):
        client, crud = app_client
        crud.delete_entity.return_value = False
        resp = client.delete("/api/admin/stories/s-uuid/locations/bad")
        assert resp.status_code == 404


# === Create story ===

class TestCreateStory:
    def test_creates(self, app_client):
        client, crud = app_client
        crud.create_story.return_value = {"uuid": "new-s"}
        resp = client.post("/api/admin/stories", json={"author": "Test"})
        assert resp.status_code == 201

    def test_empty_body(self, app_client):
        client, crud = app_client
        resp = client.post("/api/admin/stories", content=b"null",
                          headers={"Content-Type": "application/json"})
        assert resp.status_code == 400

    def test_invalid_data(self, app_client):
        client, crud = app_client
        crud.create_story.return_value = None
        resp = client.post("/api/admin/stories", json={"author": "Test"})
        assert resp.status_code == 400


# === Update story ===

class TestUpdateStory:
    def test_updates(self, app_client):
        client, crud = app_client
        crud.update_story.return_value = {"uuid": "s1"}
        resp = client.put("/api/admin/stories/s1", json={"author": "Updated"})
        assert resp.status_code == 200

    def test_not_found(self, app_client):
        client, crud = app_client
        crud.update_story.return_value = None
        resp = client.put("/api/admin/stories/bad", json={"author": "Updated"})
        assert resp.status_code == 404

    def test_empty_body(self, app_client):
        client, crud = app_client
        resp = client.put("/api/admin/stories/s1", content=b"null",
                          headers={"Content-Type": "application/json"})
        assert resp.status_code == 400
