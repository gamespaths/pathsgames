"""Step 19 — read-only access to story tables for the match domain."""
from typing import Any, Dict, List, Optional

from app.adapters.persistence.story.models import (
    KeyEntity,
    LocationEntity,
    StoryDifficultyEntity,
    StoryEntity,
)
from app.core.ports.match.match_ports import StoryMatchReadPort


class StoryMatchReadAdapter(StoryMatchReadPort):
    def __init__(self, session_factory):
        self.session_factory = session_factory

    def find_story_by_uuid(self, story_uuid: str) -> Optional[Dict[str, Any]]:
        with self.session_factory() as session:
            entity = session.query(StoryEntity).filter(StoryEntity.uuid == story_uuid).first()
            return self._story_to_dict(entity) if entity else None

    def find_story_by_id(self, story_id: int) -> Optional[Dict[str, Any]]:
        with self.session_factory() as session:
            entity = session.query(StoryEntity).filter(StoryEntity.id == story_id).first()
            return self._story_to_dict(entity) if entity else None

    def find_difficulty_by_uuid(self, story_id: int, difficulty_uuid: str) -> Optional[Dict[str, Any]]:
        with self.session_factory() as session:
            entity = (
                session.query(StoryDifficultyEntity)
                .filter(StoryDifficultyEntity.id_story == story_id)
                .filter(StoryDifficultyEntity.uuid == difficulty_uuid)
                .first()
            )
            return self._difficulty_to_dict(entity) if entity else None

    def find_difficulty_by_id(self, story_id: int, difficulty_id: int) -> Optional[Dict[str, Any]]:
        with self.session_factory() as session:
            entity = (
                session.query(StoryDifficultyEntity)
                .filter(StoryDifficultyEntity.id_story == story_id)
                .filter(StoryDifficultyEntity.id == difficulty_id)
                .first()
            )
            return self._difficulty_to_dict(entity) if entity else None

    def find_locations_by_story_id(self, story_id: int) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            rows = (
                session.query(LocationEntity)
                .filter(LocationEntity.id_story == story_id)
                .all()
            )
            return [
                {
                    "id": r.id,
                    "uuid": r.uuid,
                    "counter_start": r.counter_start,
                }
                for r in rows
            ]

    def find_keys_by_story_id(self, story_id: int) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            rows = (
                session.query(KeyEntity)
                .filter(KeyEntity.id_story == story_id)
                .all()
            )
            return [
                {
                    "id": r.id,
                    "uuid": r.uuid,
                    "key_name": r.key_name,
                    "key_value": r.key_value,
                }
                for r in rows
            ]

    @staticmethod
    def _story_to_dict(entity: StoryEntity) -> Dict[str, Any]:
        return {
            "id": entity.id,
            "uuid": entity.uuid,
            "id_location_start": entity.id_location_start,
            "category": entity.category,
            "visibility": entity.visibility,
        }

    @staticmethod
    def _difficulty_to_dict(entity: StoryDifficultyEntity) -> Dict[str, Any]:
        return {
            "id": entity.id,
            "uuid": entity.uuid,
            "exp_cost": entity.exp_cost,
            "max_weight": entity.max_weight,
            "min_character": entity.min_character,
            "max_character": entity.max_character,
        }
