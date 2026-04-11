import uuid
from typing import Dict, Any
from app.core.models.story.story_import_result import StoryImportResult
from app.core.ports.story.story_import_port import StoryImportPort
from app.core.ports.story.story_persistence_port import StoryPersistencePort

class StoryImportService(StoryImportPort):
    def __init__(self, persistence_port: StoryPersistencePort):
        self.persistence_port = persistence_port

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
            
        # 1. Provide UUID if missing
        story_uuid = data.get("uuid")
        if not story_uuid or not str(story_uuid).strip():
            story_uuid = str(uuid.uuid4())
            data["uuid"] = story_uuid

        # 2. Delete existing if any (Replace-on-conflict)
        self.delete_story(story_uuid)

        # 3. Insert Story Header
        story_id = self.persistence_port.save_story(data)

        # 4. Insert Sub-Entities (Texts)
        texts = data.get("texts", [])
        if texts:
            self.persistence_port.save_texts(story_id, texts)

        # Difficulties
        diffs = data.get("difficulties", [])
        if diffs:
            # Generate UUIDs for difficulties if absent
            for d in diffs:
                if not d.get("uuid"):
                    d["uuid"] = str(uuid.uuid4())
            self.persistence_port.save_difficulties(story_id, diffs)

        # General nested arrays mapping
        mapping = [
            ("locations", self.persistence_port.save_locations),
            ("events", self.persistence_port.save_events),
            ("items", self.persistence_port.save_items),
            ("classes", self.persistence_port.save_classes),
            ("choices", self.persistence_port.save_choices),
            ("cards", self.persistence_port.save_cards),
            ("keys", self.persistence_port.save_keys),
            ("traits", self.persistence_port.save_traits),
            ("characterTemplates", self.persistence_port.save_character_templates),
            ("weatherRules", self.persistence_port.save_weather_rules),
            ("globalRandomEvents", self.persistence_port.save_global_random_events),
            ("missions", self.persistence_port.save_missions),
            ("creators", self.persistence_port.save_creators),
        ]
        
        for key, save_fn in mapping:
            arr = data.get(key, [])
            if arr:
                save_fn(story_id, arr)

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
