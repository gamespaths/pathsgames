import pytest
from unittest.mock import MagicMock
from app.core.services.story.story_import_service import StoryImportService

@pytest.fixture
def mock_persistence_port():
    port = MagicMock()
    port.find_story_id_by_uuid.return_value = 1
    port.save_story.return_value = 1
    return port

def test_delete_story_not_found(mock_persistence_port):
    mock_persistence_port.find_story_id_by_uuid.return_value = None
    service = StoryImportService(mock_persistence_port)
    assert service.delete_story("x") is False

def test_delete_story_empty_uuid(mock_persistence_port):
    service = StoryImportService(mock_persistence_port)
    assert service.delete_story("") is False

def test_delete_story_success(mock_persistence_port):
    service = StoryImportService(mock_persistence_port)
    assert service.delete_story("x") is True
    mock_persistence_port.delete_story_by_id.assert_called_once_with(1)

def test_import_story_empty_data(mock_persistence_port):
    service = StoryImportService(mock_persistence_port)
    with pytest.raises(ValueError):
        service.import_story({})

def test_import_story_auto_uuid(mock_persistence_port):
    service = StoryImportService(mock_persistence_port)
    mock_persistence_port.find_story_id_by_uuid.return_value = None # Not existing

    data = {"title": "x"}
    result = service.import_story(data)
    
    assert result.status == "IMPORTED"
    assert result.storyUuid is not None
    assert result.storyUuid == data["uuid"] # Should be populated
    mock_persistence_port.save_story.assert_called_once()

def test_import_story_with_sub_entities(mock_persistence_port):
    service = StoryImportService(mock_persistence_port)
    data = {
        "uuid": "u1",
        "texts": [{"idText": 1}],
        "difficulties": [{"idTextDescription": 2}],
        "locations": [{"idTextName": 3, "neighbors": [{"idLocationTo": 2}]}],
        "events": [{"idTextName": 4, "effects": [{"type": "DMG"}]}],
        "items": [{"idTextName": 5, "effects": [{"type": "HEAL"}]}],
        "classes": [{"idTextName": 6, "bonuses": [{"type": "STR"}]}],
        "choices": [{"idEvent": 7, "conditions": [{"type": "EQ"}], "effects": [{"type": "X"}]}],
        "missions": [{"idTextName": 8, "steps": [{"stepOrder": 1}]}]
    }

    result = service.import_story(data)

    assert result.storyUuid == "u1"
    assert result.textsImported == 1
    assert result.eventsImported == 1

    mock_persistence_port.save_texts.assert_called_once()
    mock_persistence_port.save_difficulties.assert_called_once()
    mock_persistence_port.save_locations.assert_called_once()
    mock_persistence_port.save_events.assert_called_once()
    mock_persistence_port.save_items.assert_called_once()
    mock_persistence_port.save_classes.assert_called_once()
    mock_persistence_port.save_choices.assert_called_once()
    mock_persistence_port.save_missions.assert_called_once()
    
    # Check that a difficulty missing a UUID got one
    diffs_saved_arg = mock_persistence_port.save_difficulties.call_args[0][1]
    assert diffs_saved_arg[0].get("uuid") is not None
