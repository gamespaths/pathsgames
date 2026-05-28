"""
Tests for StoryCrudService — Step 17 admin CRUD.
Covers all branches: validation, dispatch, story-level CRUD, entity CRUD.
"""
import pytest
from unittest.mock import MagicMock, patch
from app.core.services.story.story_crud_service import StoryCrudService


@pytest.fixture
def mock_read():
    return MagicMock()


@pytest.fixture
def mock_persist():
    return MagicMock()


@pytest.fixture
def service(mock_read, mock_persist):
    return StoryCrudService(mock_read, mock_persist)


STORY_DICT = {"id": 1, "uuid": "s-uuid-1", "author": "Test", "visibility": "PUBLIC"}


# === list_entities ===

class TestListEntities:
    def test_returns_none_when_uuid_blank(self, service):
        assert service.list_entities("", "locations") is None
        assert service.list_entities(None, "locations") is None

    def test_returns_none_when_type_blank(self, service):
        assert service.list_entities("s-uuid", "") is None
        assert service.list_entities("s-uuid", None) is None

    def test_returns_none_when_story_not_found(self, service, mock_read):
        mock_read.find_story_by_uuid.return_value = None
        assert service.list_entities("bad-uuid", "locations") is None

    def test_returns_empty_for_unknown_type(self, service, mock_read):
        mock_read.find_story_by_uuid.return_value = STORY_DICT
        assert service.list_entities("s-uuid-1", "unknown") == []

    def test_returns_list_for_locations(self, service, mock_read):
        mock_read.find_story_by_uuid.return_value = STORY_DICT
        mock_read.find_locations_for_story.return_value = [{"uuid": "loc1"}]
        result = service.list_entities("s-uuid-1", "locations")
        assert len(result) == 1
        mock_read.find_locations_for_story.assert_called_once_with(1)

    def test_returns_list_for_all_types(self, service, mock_read):
        mock_read.find_story_by_uuid.return_value = STORY_DICT
        for entity_type, method in [
            ("difficulties", "find_difficulties_for_story"),
            ("events", "find_events_for_story"),
            ("items", "find_items_for_story"),
            ("character-templates", "find_character_templates_for_story"),
            ("classes", "find_classes_for_story"),
            ("traits", "find_traits_for_story"),
            ("creators", "find_creators_for_story"),
            ("cards", "find_cards_for_story"),
            ("texts", "find_texts_for_story"),
        ]:
            getattr(mock_read, method).return_value = [{"uuid": "x"}]
            result = service.list_entities("s-uuid-1", entity_type)
            assert len(result) == 1


# === get_entity ===

class TestGetEntity:
    def test_returns_none_when_params_blank(self, service):
        assert service.get_entity("", "locations", "eu") is None
        assert service.get_entity("su", "", "eu") is None
        assert service.get_entity("su", "locations", "") is None

    def test_returns_none_when_story_not_found(self, service, mock_read):
        mock_read.find_story_by_uuid.return_value = None
        assert service.get_entity("bad", "locations", "eu") is None

    def test_returns_none_for_unknown_type(self, service, mock_read):
        mock_read.find_story_by_uuid.return_value = STORY_DICT
        assert service.get_entity("s-uuid-1", "unknown", "eu") is None

    def test_returns_entity(self, service, mock_read):
        mock_read.find_story_by_uuid.return_value = STORY_DICT
        mock_read.find_entity_by_story_and_uuid.return_value = {"uuid": "e1"}
        result = service.get_entity("s-uuid-1", "locations", "e1")
        assert result == {"uuid": "e1"}


# === create_entity ===

class TestCreateEntity:
    def test_returns_none_when_params_blank(self, service):
        assert service.create_entity("", "locations", {"k": "v"}) is None
        assert service.create_entity("su", "", {"k": "v"}) is None
        assert service.create_entity("su", "locations", None) is None
        assert service.create_entity("su", "locations", {}) is None

    def test_returns_none_when_story_not_found(self, service, mock_read):
        mock_read.find_story_by_uuid.return_value = None
        assert service.create_entity("bad", "locations", {"k": "v"}) is None

    def test_returns_none_for_unknown_type(self, service, mock_read):
        mock_read.find_story_by_uuid.return_value = STORY_DICT
        assert service.create_entity("s-uuid-1", "unknown", {"k": "v"}) is None

    @patch("app.core.services.story.story_crud_service.uuid_mod")
    def test_creates_entity(self, mock_uuid, service, mock_read, mock_persist):
        mock_uuid.uuid4.return_value = "new-uuid"
        mock_read.find_story_by_uuid.return_value = STORY_DICT
        mock_read.find_entity_by_story_and_uuid.return_value = {"uuid": "new-uuid"}
        result = service.create_entity("s-uuid-1", "locations", {"isSafe": 1})
        assert result == {"uuid": "new-uuid"}
        mock_persist.save_entity.assert_called_once()


# === update_entity ===

class TestUpdateEntity:
    def test_returns_none_when_params_blank(self, service):
        assert service.update_entity("", "locations", "eu", {"k": "v"}) is None
        assert service.update_entity("su", "", "eu", {"k": "v"}) is None
        assert service.update_entity("su", "locations", "", {"k": "v"}) is None
        assert service.update_entity("su", "locations", "eu", None) is None
        assert service.update_entity("su", "locations", "eu", {}) is None

    def test_returns_none_when_story_not_found(self, service, mock_read):
        mock_read.find_story_by_uuid.return_value = None
        assert service.update_entity("bad", "locations", "eu", {"k": "v"}) is None

    def test_returns_none_for_unknown_type(self, service, mock_read):
        mock_read.find_story_by_uuid.return_value = STORY_DICT
        assert service.update_entity("s-uuid-1", "unknown", "eu", {"k": "v"}) is None

    def test_returns_none_when_entity_not_found(self, service, mock_read):
        mock_read.find_story_by_uuid.return_value = STORY_DICT
        mock_read.find_entity_by_story_and_uuid.return_value = None
        assert service.update_entity("s-uuid-1", "locations", "eu", {"k": "v"}) is None

    def test_updates_entity(self, service, mock_read, mock_persist):
        mock_read.find_story_by_uuid.return_value = STORY_DICT
        mock_read.find_entity_by_story_and_uuid.return_value = {"uuid": "eu"}
        result = service.update_entity("s-uuid-1", "locations", "eu", {"isSafe": 0})
        assert result is not None
        mock_persist.update_entity.assert_called_once()


# === delete_entity ===

class TestDeleteEntity:
    def test_returns_false_when_params_blank(self, service):
        assert service.delete_entity("", "locations", "eu") is False
        assert service.delete_entity("su", "", "eu") is False
        assert service.delete_entity("su", "locations", "") is False

    def test_returns_false_when_story_not_found(self, service, mock_read):
        mock_read.find_story_by_uuid.return_value = None
        assert service.delete_entity("bad", "locations", "eu") is False

    def test_returns_false_for_unknown_type(self, service, mock_read):
        mock_read.find_story_by_uuid.return_value = STORY_DICT
        assert service.delete_entity("s-uuid-1", "unknown", "eu") is False

    def test_returns_false_when_entity_not_found(self, service, mock_read):
        mock_read.find_story_by_uuid.return_value = STORY_DICT
        mock_read.find_entity_by_story_and_uuid.return_value = None
        assert service.delete_entity("s-uuid-1", "locations", "eu") is False

    def test_deletes_entity(self, service, mock_read, mock_persist):
        mock_read.find_story_by_uuid.return_value = STORY_DICT
        mock_read.find_entity_by_story_and_uuid.return_value = {"uuid": "eu"}
        result = service.delete_entity("s-uuid-1", "locations", "eu")
        assert result is True
        mock_persist.delete_entity_by_uuid.assert_called_once()


# === create_story ===

class TestCreateStory:
    def test_returns_none_when_data_empty(self, service):
        assert service.create_story(None) is None
        assert service.create_story({}) is None

    @patch("app.core.services.story.story_crud_service.uuid_mod")
    def test_creates_story(self, mock_uuid, service, mock_read, mock_persist):
        mock_uuid.uuid4.return_value = "new-story-uuid"
        mock_persist.save_story.return_value = 42
        mock_read.find_story_by_uuid.return_value = {"uuid": "new-story-uuid", "id": 42}
        result = service.create_story({"author": "Test"})
        assert result["uuid"] == "new-story-uuid"


# === update_story ===

class TestUpdateStory:
    def test_returns_none_when_params_blank(self, service):
        assert service.update_story("", {"k": "v"}) is None
        assert service.update_story("uuid", None) is None
        assert service.update_story("uuid", {}) is None

    def test_returns_none_when_story_not_found(self, service, mock_read):
        mock_read.find_story_by_uuid.return_value = None
        assert service.update_story("bad", {"k": "v"}) is None

    def test_updates_story(self, service, mock_read, mock_persist):
        mock_read.find_story_by_uuid.return_value = STORY_DICT
        result = service.update_story("s-uuid-1", {"author": "Updated"})
        assert result is not None
        mock_persist.update_story_by_id.assert_called_once()
