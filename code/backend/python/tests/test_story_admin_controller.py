import pytest
from fastapi.testclient import TestClient
from fastapi import FastAPI, Request
from unittest.mock import MagicMock
from app.adapters.rest.story.story_admin_controller import StoryAdminController
from app.core.models.story.story_summary import StorySummary
from app.core.models.story.story_import_result import StoryImportResult

@pytest.fixture
def mock_query_port():
    return MagicMock()

@pytest.fixture
def mock_import_port():
    return MagicMock()

@pytest.fixture
def app_with_auth(mock_query_port, mock_import_port):
    app = FastAPI()
    
    @app.middleware("http")
    async def auth_middleware(request: Request, call_next):
        if request.headers.get("X-Test-Admin") == "true":
            request.state.role = "ADMIN"
        elif request.headers.get("X-Test-Player") == "true":
            request.state.role = "PLAYER"
        response = await call_next(request)
        return response

    controller = StoryAdminController(mock_query_port, mock_import_port)
    app.include_router(controller.router)
    return app

@pytest.fixture
def client(app_with_auth):
    return TestClient(app_with_auth)

def test_list_all_stories(client, mock_query_port):
    mock_query_port.list_all_stories.return_value = [StorySummary(uuid="u1", title="t1")]
    
    response = client.get("/api/admin/stories?lang=en", headers={"X-Test-Admin": "true"})
    assert response.status_code == 200
    assert len(response.json()) == 1
    
    res_unauth = client.get("/api/admin/stories?lang=en", headers={"X-Test-Player": "true"})
    assert res_unauth.status_code == 403

def test_import_story(client, mock_import_port):
    mock_import_port.import_story.return_value = StoryImportResult(storyUuid="u1", status="SUCCESS")
    
    response = client.post("/api/admin/stories/import", json={"uuid": "u1"}, headers={"X-Test-Admin": "true"})
    assert response.status_code == 201
    assert response.json()["storyUuid"] == "u1"
    
    res_err = client.post("/api/admin/stories/import", json=None, headers={"X-Test-Admin": "true"})
    assert res_err.status_code == 400

def test_delete_story(client, mock_import_port):
    mock_import_port.delete_story.return_value = True
    response = client.delete("/api/admin/stories/u1", headers={"X-Test-Admin": "true"})
    assert response.status_code == 200
    
    mock_import_port.delete_story.return_value = False
    res_err = client.delete("/api/admin/stories/u1", headers={"X-Test-Admin": "true"})
    assert res_err.status_code == 404
