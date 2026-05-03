import uuid
from typing import Dict, Any, Optional
from app.core.models.story.story_import_result import StoryImportResult
from app.core.ports.story.story_import_port import StoryImportPort
from app.core.ports.story.story_persistence_port import StoryPersistencePort


def _get_long(data, *keys):
    """Try multiple keys to extract an integer value from data dict."""
    if data is None:
        return None
    for key in keys:
        value = data.get(key)
        if value is None:
            continue
        if isinstance(value, int):
            return value
        if isinstance(value, (float,)):
            return int(value)
        if isinstance(value, str):
            try:
                return int(value)
            except (ValueError, TypeError):
                continue
    return None


# Tables that use story-scoped id generation (id unique per id_story, not globally)
_SCOPED_TABLES = {
    "list_events", "list_events_effects",
    "list_choices", "list_choices_conditions", "list_choices_effects",
    "list_global_random_events", "list_missions", "list_missions_steps",
}


class StoryImportService(StoryImportPort):
    def __init__(self, persistence_port: StoryPersistencePort):
        self.persistence_port = persistence_port
        self._id_cache: Dict[str, int] = {}

    def delete_story(self, story_uuid: str) -> bool:
        if not story_uuid:
            return False

        story_id = self.persistence_port.find_story_id_by_uuid(story_uuid)
        if not story_id:
            return False

        self.persistence_port.delete_story_by_id(story_id)
        return True

    def import_story(self, data: Dict[str, Any]) -> StoryImportResult:
        if not data:
            raise ValueError("Empty import data")

        self._id_cache.clear()
        try:
            # 1. Provide UUID if missing
            story_uuid = data.get("uuid")
            if not story_uuid or not str(story_uuid).strip():
                story_uuid = str(uuid.uuid4())
                data["uuid"] = story_uuid

            # 2. Delete existing if any (Replace-on-conflict)
            self.delete_story(story_uuid)

            # 3. Check explicit story id
            story_id_input = _get_long(data, "id", "idStory", "id_story")
            if story_id_input is not None:
                if self.persistence_port.exists_story_id(story_id_input):
                    raise ValueError(f"story/list_stories id={story_id_input} already present")

            # 4. Insert Story Header
            story_id = self.persistence_port.save_story(data)

            # 5. Insert sub-entities with explicit-id support
            texts = data.get("texts", [])
            if texts:
                self._save_with_ids(story_id, texts, "list_texts", "id",
                                    self.persistence_port.save_texts)

            # Difficulties
            diffs = data.get("difficulties", [])
            if diffs:
                for d in diffs:
                    if not d.get("uuid"):
                        d["uuid"] = str(uuid.uuid4())
                self._save_with_ids(story_id, diffs, "list_stories_difficulty", "id",
                                    self.persistence_port.save_difficulties)

            # All other sub-entities
            entity_mapping = [
                ("locations", "list_locations", "id", self.persistence_port.save_locations),
                ("events", "list_events", "id", self.persistence_port.save_events),
                ("items", "list_items", "id", self.persistence_port.save_items),
                ("classes", "list_classes", "id", self.persistence_port.save_classes),
                ("choices", "list_choices", "id", self.persistence_port.save_choices),
                ("cards", "list_cards", "id", self.persistence_port.save_cards),
                ("keys", "list_keys", "id", self.persistence_port.save_keys),
                ("traits", "list_traits", "id", self.persistence_port.save_traits),
                ("characterTemplates", "list_character_templates", "id_tipo",
                 self.persistence_port.save_character_templates),
                ("weatherRules", "list_weather_rules", "id",
                 self.persistence_port.save_weather_rules),
                ("globalRandomEvents", "list_global_random_events", "id",
                 self.persistence_port.save_global_random_events),
                ("missions", "list_missions", "id", self.persistence_port.save_missions),
                ("creators", "list_creator", "id", self.persistence_port.save_creators),
            ]

            for json_key, table_name, id_col, save_fn in entity_mapping:
                arr = data.get(json_key, [])
                if arr:
                    self._save_with_ids(story_id, arr, table_name, id_col, save_fn)

            # 6. Sync PostgreSQL sequences
            self.persistence_port.sync_sequences()

            # Return result
            return StoryImportResult(
                storyUuid=story_uuid,
                status="IMPORTED",
                textsImported=len(texts),
                locationsImported=len(data.get("locations", [])),
                eventsImported=len(data.get("events", [])),
                itemsImported=len(data.get("items", [])),
                difficultiesImported=len(diffs),
                classesImported=len(data.get("classes", [])),
                choicesImported=len(data.get("choices", []))
            )
        finally:
            self._id_cache.clear()

    def _save_with_ids(self, story_id: int, items: list, table_name: str,
                       id_column: str, save_fn) -> None:
        """Validate explicit IDs in items before delegating to save_fn.
        If missing, generate them using scoped or global logic."""
        cache_key = self._cache_key(table_name, id_column, story_id)
        
        for item in items:
            item_id = _get_long(item, "id", "idTipo", "id_tipo")
            if item_id is not None:
                scope = f"story/{table_name}"
                if self.persistence_port.exists_entity_id(table_name, id_column, item_id, story_id):
                    raise ValueError(f"{scope} id={item_id} already present")
                # Update cache
                cached = self._id_cache.get(cache_key)
                if cached is None or cached <= item_id:
                    self._id_cache[cache_key] = item_id + 1
            else:
                # Generate ID
                cached = self._id_cache.get(cache_key)
                if cached is None:
                    if table_name in _SCOPED_TABLES:
                        cached = self.persistence_port.next_scoped_id(table_name, id_column, story_id)
                    else:
                        cached = self.persistence_port.next_global_id(table_name, id_column)
                item["id"] = cached
                if table_name == "list_character_templates":
                    item["idTipo"] = cached
                self._id_cache[cache_key] = cached + 1

        save_fn(story_id, items)

    def _cache_key(self, table_name: str, id_column: str, story_id: int) -> str:
        use_scoped = table_name in _SCOPED_TABLES
        scope = str(story_id) if use_scoped else "GLOBAL"
        return f"{table_name}#{id_column}#{scope}"
