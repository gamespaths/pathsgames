import pytest
from fastapi.testclient import TestClient
from fastapi import FastAPI
from unittest.mock import MagicMock
from app.adapters.rest.story.content_controller import ContentController
from app.core.models.story.card_info import CardInfo
from app.core.models.story.text_info import TextInfo
from app.core.models.story.creator_info import CreatorInfo

@pytest.fixture
def mock_query_port():
    return MagicMock()

@pytest.fixture
def client(mock_query_port):
    app = FastAPI()
    controller = ContentController(mock_query_port)
    app.include_router(controller.router)
    return TestClient(app)

def test_get_card_success(client, mock_query_port):
    card = CardInfo(uuid="card-uuid", imageUrl="http://img.png", title="Card Title")
    mock_query_port.get_card_by_story_and_card_uuid.return_value = card
    
    response = client.get("/api/content/story-uuid/cards/card-uuid")
    
    assert response.status_code == 200
    data = response.json()
    assert data["uuid"] == "card-uuid"
    assert data["title"] == "Card Title"

def test_get_card_not_found(client, mock_query_port):
    mock_query_port.get_card_by_story_and_card_uuid.return_value = None
    
    response = client.get("/api/content/story-uuid/cards/not-found")
    
    assert response.status_code == 404
    assert response.json()["detail"]["error"] == "CARD_NOT_FOUND"

def test_get_text_success(client, mock_query_port):
    text = TextInfo(idText=123, lang="en", resolvedLang="en", shortText="Short")
    mock_query_port.get_text_by_story_and_id_text.return_value = text
    
    response = client.get("/api/content/story-uuid/texts/123/lang/en")
    
    assert response.status_code == 200
    data = response.json()
    assert data["idText"] == 123
    assert data["shortText"] == "Short"

def test_get_text_not_found(client, mock_query_port):
    mock_query_port.get_text_by_story_and_id_text.return_value = None
    
    response = client.get("/api/content/story-uuid/texts/123/lang/en")
    
    assert response.status_code == 404
    assert response.json()["detail"]["error"] == "TEXT_NOT_FOUND"

def test_get_creator_success(client, mock_query_port):
    creator = CreatorInfo(uuid="creator-uuid", name="Creator Name")
    mock_query_port.get_creator_by_story_and_creator_uuid.return_value = creator
    
    response = client.get("/api/content/story-uuid/creators/creator-uuid")
    
    assert response.status_code == 200
    data = response.json()
    assert data["uuid"] == "creator-uuid"
    assert data["name"] == "Creator Name"

def test_get_creator_not_found(client, mock_query_port):
    mock_query_port.get_creator_by_story_and_creator_uuid.return_value = None
    
    response = client.get("/api/content/story-uuid/creators/not-found")
    
    assert response.status_code == 404
    assert response.json()["detail"]["error"] == "CREATOR_NOT_FOUND"
