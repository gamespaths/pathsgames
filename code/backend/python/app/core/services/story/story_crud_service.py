"""
StoryCrudService — Domain service implementing admin CRUD for all story entities.
Step 17: Provides create, read, update, delete for every story sub-table.
Mirrors Java StoryCrudService dispatch pattern.
"""
import uuid as uuid_mod
from typing import Dict, Any, List, Optional
from app.core.ports.story.story_crud_port import StoryCrudPort
from app.core.ports.story.story_read_port import StoryReadPort
from app.core.ports.story.story_persistence_port import StoryPersistencePort


ENTITY_TYPES = [
    "difficulties", "locations", "events", "items",
    "character-templates", "classes", "traits",
    "creators", "cards", "texts"
]


class StoryCrudService(StoryCrudPort):
    def __init__(self, read_port: StoryReadPort, persistence_port: StoryPersistencePort):
        self.read_port = read_port
        self.persistence_port = persistence_port

    def _resolve_story_id(self, story_uuid: str) -> Optional[int]:
        if not story_uuid or not story_uuid.strip():
            return None
        story = self.read_port.find_story_by_uuid(story_uuid)
        if not story:
            return None
        return story.get("id")

    # === list ===
    def list_entities(self, story_uuid: str, entity_type: str) -> Optional[List[Dict[str, Any]]]:
        if not story_uuid or not entity_type:
            return None
        sid = self._resolve_story_id(story_uuid)
        if sid is None:
            return None
        return self._list_by_type(sid, entity_type)

    # === get ===
    def get_entity(self, story_uuid: str, entity_type: str, entity_uuid: str) -> Optional[Dict[str, Any]]:
        if not story_uuid or not entity_type or not entity_uuid:
            return None
        sid = self._resolve_story_id(story_uuid)
        if sid is None:
            return None
        return self._get_by_type(sid, entity_type, entity_uuid)

    # === create ===
    def create_entity(self, story_uuid: str, entity_type: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if not story_uuid or not entity_type or not data:
            return None
        sid = self._resolve_story_id(story_uuid)
        if sid is None:
            return None
        return self._create_by_type(sid, entity_type, data)

    # === update ===
    def update_entity(self, story_uuid: str, entity_type: str, entity_uuid: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if not story_uuid or not entity_type or not entity_uuid or not data:
            return None
        sid = self._resolve_story_id(story_uuid)
        if sid is None:
            return None
        return self._update_by_type(sid, entity_type, entity_uuid, data)

    # === delete ===
    def delete_entity(self, story_uuid: str, entity_type: str, entity_uuid: str) -> bool:
        if not story_uuid or not entity_type or not entity_uuid:
            return False
        sid = self._resolve_story_id(story_uuid)
        if sid is None:
            return False
        return self._delete_by_type(sid, entity_type, entity_uuid)

    # === story-level CRUD ===
    def create_story(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if not data:
            return None
        from app.adapters.persistence.story.models import StoryEntity
        new_uuid = str(uuid_mod.uuid4())
        story_data = {"uuid": new_uuid}
        self._apply_story_fields(story_data, data)
        story_id = self.persistence_port.save_story(story_data)
        created = self.read_port.find_story_by_uuid(new_uuid)
        return created

    def update_story(self, story_uuid: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if not story_uuid or not data:
            return None
        story = self.read_port.find_story_by_uuid(story_uuid)
        if not story:
            return None
        sid = story.get("id")
        self.persistence_port.update_story_by_id(sid, data)
        return self.read_port.find_story_by_uuid(story_uuid)

    # === Dispatch: list ===
    def _list_by_type(self, sid: int, entity_type: str) -> List[Dict[str, Any]]:
        dispatch = {
            "difficulties": lambda: self.read_port.find_difficulties_for_story(sid),
            "locations": lambda: self.read_port.find_locations_for_story(sid),
            "events": lambda: self.read_port.find_events_for_story(sid),
            "items": lambda: self.read_port.find_items_for_story(sid),
            "character-templates": lambda: self.read_port.find_character_templates_for_story(sid),
            "classes": lambda: self.read_port.find_classes_for_story(sid),
            "traits": lambda: self.read_port.find_traits_for_story(sid),
            "creators": lambda: self.read_port.find_creators_for_story(sid),
            "cards": lambda: self.read_port.find_cards_for_story(sid),
            "texts": lambda: self.read_port.find_texts_for_story(sid),
        }
        fn = dispatch.get(entity_type)
        return fn() if fn else []

    # === Dispatch: get ===
    def _get_by_type(self, sid: int, entity_type: str, entity_uuid: str) -> Optional[Dict[str, Any]]:
        dispatch = {
            "difficulties": lambda: self.read_port.find_entity_by_story_and_uuid(sid, "list_stories_difficulty", entity_uuid),
            "locations": lambda: self.read_port.find_entity_by_story_and_uuid(sid, "list_locations", entity_uuid),
            "events": lambda: self.read_port.find_entity_by_story_and_uuid(sid, "list_events", entity_uuid),
            "items": lambda: self.read_port.find_entity_by_story_and_uuid(sid, "list_items", entity_uuid),
            "character-templates": lambda: self.read_port.find_entity_by_story_and_uuid(sid, "list_character_templates", entity_uuid),
            "classes": lambda: self.read_port.find_entity_by_story_and_uuid(sid, "list_classes", entity_uuid),
            "traits": lambda: self.read_port.find_entity_by_story_and_uuid(sid, "list_traits", entity_uuid),
            "creators": lambda: self.read_port.find_entity_by_story_and_uuid(sid, "list_creator", entity_uuid),
            "cards": lambda: self.read_port.find_entity_by_story_and_uuid(sid, "list_cards", entity_uuid),
            "texts": lambda: self.read_port.find_entity_by_story_and_uuid(sid, "list_texts", entity_uuid),
        }
        fn = dispatch.get(entity_type)
        return fn() if fn else None

    # === Dispatch: create ===
    def _create_by_type(self, sid: int, entity_type: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        new_uuid = str(uuid_mod.uuid4())
        data["uuid"] = new_uuid
        dispatch = {
            "difficulties": lambda: self.persistence_port.save_entity(sid, "list_stories_difficulty", data),
            "locations": lambda: self.persistence_port.save_entity(sid, "list_locations", data),
            "events": lambda: self.persistence_port.save_entity(sid, "list_events", data),
            "items": lambda: self.persistence_port.save_entity(sid, "list_items", data),
            "character-templates": lambda: self.persistence_port.save_entity(sid, "list_character_templates", data),
            "classes": lambda: self.persistence_port.save_entity(sid, "list_classes", data),
            "traits": lambda: self.persistence_port.save_entity(sid, "list_traits", data),
            "creators": lambda: self.persistence_port.save_entity(sid, "list_creator", data),
            "cards": lambda: self.persistence_port.save_entity(sid, "list_cards", data),
            "texts": lambda: self.persistence_port.save_entity(sid, "list_texts", data),
        }
        fn = dispatch.get(entity_type)
        if not fn:
            return None
        fn()
        return self.read_port.find_entity_by_story_and_uuid(sid, self._table_for_type(entity_type), new_uuid)

    # === Dispatch: update ===
    def _update_by_type(self, sid: int, entity_type: str, entity_uuid: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        table = self._table_for_type(entity_type)
        if not table:
            return None
        existing = self.read_port.find_entity_by_story_and_uuid(sid, table, entity_uuid)
        if not existing:
            return None
        self.persistence_port.update_entity(sid, table, entity_uuid, data)
        return self.read_port.find_entity_by_story_and_uuid(sid, table, entity_uuid)

    # === Dispatch: delete ===
    def _delete_by_type(self, sid: int, entity_type: str, entity_uuid: str) -> bool:
        table = self._table_for_type(entity_type)
        if not table:
            return False
        existing = self.read_port.find_entity_by_story_and_uuid(sid, table, entity_uuid)
        if not existing:
            return False
        self.persistence_port.delete_entity_by_uuid(table, entity_uuid)
        return True

    def _table_for_type(self, entity_type: str) -> Optional[str]:
        mapping = {
            "difficulties": "list_stories_difficulty",
            "locations": "list_locations",
            "events": "list_events",
            "items": "list_items",
            "character-templates": "list_character_templates",
            "classes": "list_classes",
            "traits": "list_traits",
            "creators": "list_creator",
            "cards": "list_cards",
            "texts": "list_texts",
        }
        return mapping.get(entity_type)

    def _apply_story_fields(self, story_data: Dict, data: Dict):
        field_map = {
            "author": "author", "category": "category", "group": "group",
            "visibility": "visibility", "priority": "priority", "peghi": "peghi",
            "versionMin": "versionMin", "versionMax": "versionMax",
            "idTextTitle": "idTextTitle", "idTextDescription": "idTextDescription",
        }
        for json_key, db_key in field_map.items():
            if json_key in data:
                story_data[db_key] = data[json_key]
