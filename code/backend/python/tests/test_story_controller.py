import pytest
from fastapi.testclient import TestClient
from fastapi import FastAPI
from unittest.mock import MagicMock
from app.adapters.rest.story.story_controller import StoryController
from app.core.models.story.story_summary import StorySummary
from app.core.models.story.story_detail import StoryDetail

@pytest.fixture
def mock_query_port():
    return MagicMock()

@pytest.fixture
def client(mock_query_port):
    app = FastAPI()
    controller = StoryController(mock_query_port)
    app.include_router(controller.router)
    return TestClient(app)

def test_list_stories(client, mock_query_port):
    mock_query_port.list_public_stories.return_value = [StorySummary(uuid="s1")]
    response = client.get("/api/stories?lang=it")
    assert response.status_code == 200
    assert len(response.json()) == 1
    mock_query_port.list_public_stories.assert_called_with("it")

def test_get_story_success(client, mock_query_port):
    mock_query_port.get_story_detail.return_value = StoryDetail(uuid="s1")
    response = client.get("/api/stories/s1")
    assert response.status_code == 200
    assert response.json()["uuid"] == "s1"

def test_get_story_not_found(client, mock_query_port):
    mock_query_port.get_story_detail.return_value = None
    response = client.get("/api/stories/not-found")
    assert response.status_code == 404
    assert response.json()["detail"]["error"] == "STORY_NOT_FOUND"

def test_list_categories(client, mock_query_port):
    mock_query_port.list_categories.return_value = ["Cat1"]
    response = client.get("/api/stories/categories")
    assert response.status_code == 200
    assert response.json() == ["Cat1"]

def test_list_groups(client, mock_query_port):
    mock_query_port.list_groups.return_value = ["Group1"]
    response = client.get("/api/stories/groups")
    assert response.status_code == 200
    assert response.json() == ["Group1"]

def test_list_stories_by_category(client, mock_query_port):
    mock_query_port.list_stories_by_category.return_value = []
    response = client.get("/api/stories/category/Cat1")
    assert response.status_code == 200

def test_list_stories_by_group(client, mock_query_port):
    mock_query_port.list_stories_by_group.return_value = []
    response = client.get("/api/stories/group/G1")
    assert response.status_code == 200
