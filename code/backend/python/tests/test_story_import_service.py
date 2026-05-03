import pytest
from unittest.mock import MagicMock
from app.core.services.story.story_import_service import StoryImportService

@pytest.fixture
def mock_persistence_port():
    port = MagicMock()
    port.find_story_id_by_uuid.return_value = 1
    port.save_story.return_value = 1
    port.exists_story_id.return_value = False
    port.exists_entity_id.return_value = False
    port.next_scoped_id.return_value = 1
    port.next_global_id.return_value = 1
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

def test_import_story_full_coverage(mock_persistence_port):
    service = StoryImportService(mock_persistence_port)
    data = {
        "uuid": "u-full",
        "keys": [{"name": "k1"}],
        "traits": [{"idTextName": 1}],
        "characterTemplates": [{"idTextName": 2}],
        "weatherRules": [{"idTextName": 3}],
        "globalRandomEvents": [{"probability": 0.5}],
        "missions": [{"idTextName": 10, "steps": [{"stepOrder": 1}]}],
        "creators": [{"creator_name": "C1"}],
        "cards": [{"card_type": "T1"}]
    }

    service.import_story(data)

    mock_persistence_port.save_keys.assert_called_once()
    mock_persistence_port.save_traits.assert_called_once()
    mock_persistence_port.save_character_templates.assert_called_once()
    mock_persistence_port.save_weather_rules.assert_called_once()
    mock_persistence_port.save_global_random_events.assert_called_once()
    mock_persistence_port.save_creators.assert_called_once()
    mock_persistence_port.save_cards.assert_called_once()
    mock_persistence_port.save_missions.assert_called_once()

# === NEW TESTS: Explicit-ID import ===

def test_import_story_with_explicit_story_id(mock_persistence_port):
    """Import with explicit story id succeeds when id is free."""
    service = StoryImportService(mock_persistence_port)
    data = {"uuid": "u-exp", "id": 990001, "author": "robot"}
    result = service.import_story(data)
    assert result.status == "IMPORTED"
    mock_persistence_port.exists_story_id.assert_called_with(990001)

def test_import_story_duplicate_story_id_raises(mock_persistence_port):
    """Import with explicit story id that already exists raises ValueError."""
    mock_persistence_port.exists_story_id.return_value = True
    service = StoryImportService(mock_persistence_port)
    data = {"uuid": "u-dup", "id": 990001, "author": "robot"}
    with pytest.raises(ValueError, match="story/list_stories id=990001 already present"):
        service.import_story(data)

def test_import_story_with_explicit_entity_ids(mock_persistence_port):
    """Import with explicit sub-entity ids succeeds when ids are free."""
    service = StoryImportService(mock_persistence_port)
    data = {
        "uuid": "u-ent-id",
        "texts": [{"id": 971001, "idText": 1, "lang": "en", "shortText": "T1"}],
        "events": [{"id": 971010, "type": "NORMAL"}],
        "locations": [{"id": 971009, "isSafe": 0}],
    }
    result = service.import_story(data)
    assert result.status == "IMPORTED"
    assert result.textsImported == 1
    # exists_entity_id should have been called for each entity with explicit id
    assert mock_persistence_port.exists_entity_id.call_count >= 3

def test_import_story_duplicate_entity_id_raises(mock_persistence_port):
    """Import with explicit entity id that already exists raises ValueError."""
    mock_persistence_port.exists_entity_id.return_value = True
    service = StoryImportService(mock_persistence_port)
    data = {
        "uuid": "u-ent-dup",
        "texts": [{"id": 971001, "idText": 1, "lang": "en", "shortText": "T1"}],
    }
    with pytest.raises(ValueError, match="story/list_texts id=971001 already present"):
        service.import_story(data)

def test_import_story_same_entity_id_different_stories_ok(mock_persistence_port):
    """Same entity id in different stories (different id_story) should succeed."""
    service = StoryImportService(mock_persistence_port)
    # First import
    data1 = {"uuid": "u-scope-a", "events": [{"id": 1, "type": "NORMAL"}]}
    result1 = service.import_story(data1)
    assert result1.status == "IMPORTED"
    # Second import (same event id=1, but different story)
    data2 = {"uuid": "u-scope-b", "events": [{"id": 1, "type": "NORMAL"}]}
    result2 = service.import_story(data2)
    assert result2.status == "IMPORTED"

def test_import_story_sync_sequences_called(mock_persistence_port):
    """sync_sequences is called after import."""
    service = StoryImportService(mock_persistence_port)
    data = {"uuid": "u-sync", "author": "robot"}
    service.import_story(data)
    mock_persistence_port.sync_sequences.assert_called_once()

def test_import_story_id_as_string(mock_persistence_port):
    """Import with id as string value should be parsed as int."""
    service = StoryImportService(mock_persistence_port)
    data = {"uuid": "u-str-id", "id": "990002", "author": "robot"}
    result = service.import_story(data)
    assert result.status == "IMPORTED"
    mock_persistence_port.exists_story_id.assert_called_with(990002)
