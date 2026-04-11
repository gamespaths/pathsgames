import pytest
from unittest.mock import MagicMock
from app.core.services.story.story_query_service import StoryQueryService

@pytest.fixture
def mock_read_port():
    port = MagicMock()
    port.find_public_stories.return_value = []
    port.find_all_stories.return_value = []
    port.find_story_by_uuid.return_value = None
    port.find_texts_for_story.return_value = []
    port.find_difficulties_for_story.return_value = []
    port.count_locations_for_story.return_value = 0
    port.count_events_for_story.return_value = 0
    port.count_items_for_story.return_value = 0
    return port

def test_list_public_stories_empty(mock_read_port):
    service = StoryQueryService(mock_read_port)
    assert len(service.list_public_stories()) == 0

def test_list_public_stories_with_data(mock_read_port):
    mock_read_port.find_public_stories.return_value = [
        {"id": 1, "uuid": "u1", "id_text_title": 10}
    ]
    mock_read_port.find_texts_for_story.return_value = [
        {"id_text": 10, "lang": "en", "short_text": "Story T"}
    ]
    service = StoryQueryService(mock_read_port)
    results = service.list_public_stories()
    assert len(results) == 1
    assert results[0].title == "Story T"
    assert results[0].uuid == "u1"

def test_list_all_stories(mock_read_port):
    mock_read_port.find_all_stories.return_value = [
        {"id": 1, "uuid": "u1", "visibility": "PRIVATE"}
    ]
    service = StoryQueryService(mock_read_port)
    results = service.list_all_stories()
    assert len(results) == 1
    assert results[0].visibility == "PRIVATE"

def test_get_story_detail_not_found(mock_read_port):
    service = StoryQueryService(mock_read_port)
    assert service.get_story_detail("u1") is None

def test_get_story_detail_success(mock_read_port):
    mock_read_port.find_story_by_uuid.return_value = {
        "id": 1, "uuid": "u1", "id_text_title": 10, "peghi": 2
    }
    mock_read_port.find_texts_for_story.return_value = [
        {"id_text": 10, "lang": "en", "long_text": "Title Long"}
    ]
    mock_read_port.find_difficulties_for_story.return_value = [
        {"uuid": "d1", "exp_cost": 5}
    ]
    mock_read_port.count_locations_for_story.return_value = 5

    service = StoryQueryService(mock_read_port)
    detail = service.get_story_detail("u1", "en")
    
    assert detail is not None
    assert detail.title == "Title Long"
    assert detail.peghi == 2
    assert detail.locationCount == 5
    assert len(detail.difficulties) == 1
    assert detail.difficulties[0].expCost == 5

def test_resolve_text_fallback(mock_read_port):
    mock_read_port.find_story_by_uuid.return_value = {"id": 1, "id_text_title": 10}
    
    # Text only in generic other language, fallback to English doesn't exist, generic is chosen
    mock_read_port.find_texts_for_story.return_value = [
        {"id_text": 10, "lang": "it", "short_text": "Titolo"}
    ]

    service = StoryQueryService(mock_read_port)
    detail = service.get_story_detail("x", "en")
    assert detail.title == "Titolo"

def test_resolve_text_en_fallback(mock_read_port):
    mock_read_port.find_story_by_uuid.return_value = {"id": 1, "id_text_title": 10}
    
    mock_read_port.find_texts_for_story.return_value = [
        {"id_text": 10, "lang": "it", "short_text": "Titolo"},
        {"id_text": 10, "lang": "en", "short_text": "Title"}
    ]

    service = StoryQueryService(mock_read_port)
    # Asking for 'fr' shouldn't find 'fr', so it falls back to 'en'
    detail = service.get_story_detail("x", "fr")
    assert detail.title == "Title"

def test_resolve_text_null_id(mock_read_port):
    service = StoryQueryService(mock_read_port)
    res = service._resolve_text([], None, "en")
    assert res is None

def test_resolve_text_no_candidates(mock_read_port):
    service = StoryQueryService(mock_read_port)
    res = service._resolve_text([{"id_text": 99}], 10, "en")
    assert res is None
