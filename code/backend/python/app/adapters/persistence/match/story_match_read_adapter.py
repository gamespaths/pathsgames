"""Step 19 — read-only access to story tables for the match domain."""
from typing import Any, Dict, List, Optional

from app.adapters.persistence.story.models import (
    CardEntity,
    CharacterTemplateEntity,
    ClassBonusEntity,
    ClassEntity,
    EventEntity,
    ItemEntity,
    KeyEntity,
    LocationEntity,
    LocationNeighborEntity,
    StoryDifficultyEntity,
    StoryEntity,
    TextEntity,
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
                    "counter_time": r.counter_time,
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

    # === Step 27.x — match-info location/neighbor/event enrichment ===

    def find_location_neighbors_by_story_id(self, story_id: int) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            rows = (
                session.query(LocationNeighborEntity)
                .filter(LocationNeighborEntity.id_story == story_id)
                .all()
            )
            return [
                {
                    "id_location_from": r.id_location_from,
                    "id_location_to": r.id_location_to,
                    "direction": r.direction,
                    "energy_cost": r.energy_cost,
                    "id_card": r.id_card,
                    "id_card_back": r.id_card_back,
                }
                for r in rows
            ]

    def find_events_by_story_id(self, story_id: int) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            rows = (
                session.query(EventEntity)
                .filter(EventEntity.id_story == story_id)
                .all()
            )
            return [
                {
                    "id": r.id,
                    "uuid": r.uuid,
                    "type": r.event_type,
                    "id_location": r.id_location,
                    "id_card": r.id_card,
                }
                for r in rows
            ]

    def find_card_by_story_id_and_card_id(self, story_id: int, card_id: int) -> Optional[Dict[str, Any]]:
        with self.session_factory() as session:
            card = (
                session.query(CardEntity)
                .filter(CardEntity.id_story == story_id)
                .filter(CardEntity.id == card_id)
                .first()
            )
            if card is None:
                return None
            return {
                "uuid": card.uuid,
                "card_type": card.card_type,
                "url_image": card.url_image,
                "alternative_image": card.alternative_image,
                "awesome_icon": card.awesome_icon,
                "style_main": card.style_main,
                "style_detail": card.style_detail,
                "style_image_little": card.style_image_little,
                "style_image_medium": card.style_image_medium,
                "style_image_large": card.style_image_large,
                "id_text_title": card.id_text_title,
                "id_text_name": card.id_text_name,
                "id_text_description": card.id_text_description,
                "id_text_copyright": card.id_text_copyright,
                "link_copyright": card.link_copyright,
            }

    def find_text_by_story_id_text_and_lang(
        self, story_id: int, id_text: int, lang: str
    ) -> Optional[Dict[str, Any]]:
        with self.session_factory() as session:
            text = (
                session.query(TextEntity)
                .filter(TextEntity.id_story == story_id)
                .filter(TextEntity.id_text == id_text)
                .filter(TextEntity.lang == lang)
                .first()
            )
            if text is None:
                return None
            return {"short_text": text.short_text, "long_text": text.long_text}

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

    def find_items_by_story_id(self, story_id: int) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            rows = (
                session.query(ItemEntity)
                .filter(ItemEntity.id_story == story_id)
                .all()
            )
            return [{"id": r.id, "uuid": r.uuid, "weight": r.weight} for r in rows]

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
            "weight": entity.weight,
            # Step 23 — costs and class restrictions for trait validation
            "cost_positive": entity.cost_positive,
            "cost_negative": entity.cost_negative,
            "id_class_permitted": entity.id_class_permitted,
            "id_class_prohibited": entity.id_class_prohibited,
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
            # Step 23 — trait cost budgets; None = no limit
            "trait_cost_positive_budget": entity.trait_cost_positive_budget,
            "trait_cost_negative_budget": entity.trait_cost_negative_budget,
            # Step 21 — stat deltas applied to the character at join time.
            "life": entity.life,
            "energy": entity.energy,
            "sad": entity.sad,
            "dexterity": entity.dexterity,
            "intelligence": entity.intelligence,
            "constitution": entity.constitution,
            "weight": entity.weight,
        }
