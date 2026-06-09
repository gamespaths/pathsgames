"""Step 19 — read-only access to story tables for the match domain."""
from typing import Any, Dict, List, Optional

from app.adapters.persistence.story.models import (
    CharacterTemplateEntity,
    ClassBonusEntity,
    ClassEntity,
    EventEntity,
    KeyEntity,
    LocationEntity,
    StoryDifficultyEntity,
    StoryEntity,
    TraitEntity,
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

    def find_event_by_story_id_and_uuid(self, story_id: int, uuid_event: str) -> Optional[Dict[str, Any]]:
        with self.session_factory() as session:
            entity = (
                session.query(EventEntity)
                .filter(EventEntity.id_story == story_id)
                .filter(EventEntity.uuid == uuid_event)
                .first()
            )
            return {"id": entity.id, "uuid": entity.uuid} if entity else None

    # === Step 21 — character template / class / trait lookups ===

    def find_character_template_by_uuid(self, story_id: int, uuid: str) -> Optional[Dict[str, Any]]:
        with self.session_factory() as session:
            entity = (
                session.query(CharacterTemplateEntity)
                .filter(CharacterTemplateEntity.id_story == story_id)
                .filter(CharacterTemplateEntity.uuid == uuid)
                .first()
            )
            return self._template_to_dict(entity) if entity else None

    def find_character_templates_by_story_id(self, story_id: int) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            rows = (
                session.query(CharacterTemplateEntity)
                .filter(CharacterTemplateEntity.id_story == story_id)
                .all()
            )
            return [self._template_to_dict(r) for r in rows]

    def find_class_by_uuid(self, story_id: int, uuid: str) -> Optional[Dict[str, Any]]:
        with self.session_factory() as session:
            entity = (
                session.query(ClassEntity)
                .filter(ClassEntity.id_story == story_id)
                .filter(ClassEntity.uuid == uuid)
                .first()
            )
            if entity is None:
                return None
            return {
                "id": entity.id,
                "uuid": entity.uuid,
                "weight_max": entity.weight_max,
                "dexterity_base": entity.dexterity_base,
                "intelligence_base": entity.intelligence_base,
                "constitution_base": entity.constitution_base,
            }

    def find_trait_by_uuid(self, story_id: int, uuid: str) -> Optional[Dict[str, Any]]:
        with self.session_factory() as session:
            entity = (
                session.query(TraitEntity)
                .filter(TraitEntity.id_story == story_id)
                .filter(TraitEntity.uuid == uuid)
                .first()
            )
            return self._trait_to_dict(entity) if entity else None

    def find_traits_by_story_id(self, story_id: int) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            rows = (
                session.query(TraitEntity)
                .filter(TraitEntity.id_story == story_id)
                .all()
            )
            return [self._trait_to_dict(r) for r in rows]

    def find_class_bonuses_by_story_id(self, story_id: int) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            rows = (
                session.query(ClassBonusEntity)
                .filter(ClassBonusEntity.id_story == story_id)
                .all()
            )
            return [
                {"id_class": r.id_class, "statistic": r.statistic, "value": r.value}
                for r in rows
            ]

    @staticmethod
    def _template_to_dict(entity: CharacterTemplateEntity) -> Dict[str, Any]:
        return {
            "id_tipo": entity.id_tipo,
            "uuid": entity.uuid,
            "life_max": entity.life_max,
            "energy_max": entity.energy_max,
            "sad_max": entity.sad_max,
            "dexterity_start": entity.dexterity_start,
            "intelligence_start": entity.intelligence_start,
            "constitution_start": entity.constitution_start,
            "id_class_permitted": entity.id_class_permitted,
            "id_class_prohibited": entity.id_class_prohibited,
        }

    @staticmethod
    def _trait_to_dict(entity: TraitEntity) -> Dict[str, Any]:
        return {
            "id": entity.id,
            "uuid": entity.uuid,
            "life": entity.life,
            "energy": entity.energy,
            "sad": entity.sad,
            "dexterity": entity.dexterity,
            "intelligence": entity.intelligence,
            "constitution": entity.constitution,
        }

    @staticmethod
    def _story_to_dict(entity: StoryEntity) -> Dict[str, Any]:
        return {
            "id": entity.id,
            "uuid": entity.uuid,
            "id_location_start": entity.id_location_start,
            "id_event_end_game": entity.id_event_end_game,
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
            # Step 21 — stat deltas applied to the character at join time.
            "life": entity.life,
            "energy": entity.energy,
            "sad": entity.sad,
            "dexterity": entity.dexterity,
            "intelligence": entity.intelligence,
            "constitution": entity.constitution,
        }
