from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.core.ports.story.story_read_port import StoryReadPort
from app.adapters.persistence.story.models import (
    StoryEntity, TextEntity, StoryDifficultyEntity, 
    LocationEntity, EventEntity, ItemEntity,
    ClassEntity, CharacterTemplateEntity, TraitEntity, CardEntity,
    CreatorEntity
)

class StoryReadAdapter(StoryReadPort):
    def __init__(self, session_factory):
        self.session_factory = session_factory

    def find_public_stories(self) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            stories = session.query(StoryEntity)\
                .filter(StoryEntity.visibility == "PUBLIC")\
                .order_by(StoryEntity.priority.desc())\
                .all()
            return [self._to_dict(s) for s in stories]

    def find_all_stories(self) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            stories = session.query(StoryEntity).order_by(StoryEntity.priority.desc()).all()
            return [self._to_dict(s) for s in stories]

    def find_story_by_uuid(self, uuid: str) -> Optional[Dict[str, Any]]:
        with self.session_factory() as session:
            story = session.query(StoryEntity).filter(StoryEntity.uuid == uuid).first()
            return self._to_dict(story) if story else None

    def find_texts_for_story(self, story_id: int) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            texts = session.query(TextEntity).filter(TextEntity.id_story == story_id).all()
            return [{"id_text": t.id_text, "lang": t.lang, "short_text": t.short_text, "long_text": t.long_text} for t in texts]

    def find_difficulties_for_story(self, story_id: int) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            diffs = session.query(StoryDifficultyEntity).filter(StoryDifficultyEntity.id_story == story_id).all()
            return [
                {
                    "uuid": d.uuid,
                    "id_text_description": d.id_text_description,
                    "exp_cost": d.exp_cost,
                    "max_weight": d.max_weight,
                    "min_character": d.min_character,
                    "max_character": d.max_character,
                    "cost_help_coma": d.cost_help_coma,
                    "cost_max_characteristics": d.cost_max_characteristics,
                    "number_max_free_action": d.number_max_free_action
                }
                for d in diffs
            ]

    def count_locations_for_story(self, story_id: int) -> int:
        with self.session_factory() as session:
            return session.query(LocationEntity).filter(LocationEntity.id_story == story_id).count()

    def count_events_for_story(self, story_id: int) -> int:
        with self.session_factory() as session:
            return session.query(EventEntity).filter(EventEntity.id_story == story_id).count()

    def count_items_for_story(self, story_id: int) -> int:
        with self.session_factory() as session:
            return session.query(ItemEntity).filter(ItemEntity.id_story == story_id).count()

    def find_unique_categories(self) -> List[str]:
        with self.session_factory() as session:
            rows = session.query(StoryEntity.category).filter(StoryEntity.visibility == "PUBLIC").distinct().all()
            return [str(r[0]) for r in rows if r[0]]

    def find_unique_groups(self) -> List[str]:
        with self.session_factory() as session:
            rows = session.query(StoryEntity.group_name).filter(StoryEntity.visibility == "PUBLIC").distinct().all()
            return [str(r[0]) for r in rows if r[0]]

    def find_stories_by_category(self, category: str) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            stories = session.query(StoryEntity)\
                .filter(StoryEntity.visibility == "PUBLIC")\
                .filter(StoryEntity.category == category)\
                .order_by(StoryEntity.priority.desc())\
                .all()
            return [self._to_dict(s) for s in stories]

    def find_stories_by_group(self, group: str) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            stories = session.query(StoryEntity)\
                .filter(StoryEntity.visibility == "PUBLIC")\
                .filter(StoryEntity.group_name == group)\
                .order_by(StoryEntity.priority.desc())\
                .all()
            return [self._to_dict(s) for s in stories]

    def find_classes_for_story(self, story_id: int) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            classes = session.query(ClassEntity).filter(ClassEntity.id_story == story_id).all()
            return [self._to_dict(c) for c in classes]

    def find_character_templates_for_story(self, story_id: int) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            tmps = session.query(CharacterTemplateEntity).filter(CharacterTemplateEntity.id_story == story_id).all()
            return [self._to_dict(t) for t in tmps]

    def find_traits_for_story(self, story_id: int) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            traits = session.query(TraitEntity).filter(TraitEntity.id_story == story_id).all()
            return [self._to_dict(t) for t in traits]

    def find_card_for_story(self, story_id: int, card_id: int) -> Optional[Dict[str, Any]]:
        with self.session_factory() as session:
            card = session.query(CardEntity).filter(
                CardEntity.id_story == story_id,
                CardEntity.id == card_id
            ).first()
            return self._to_dict(card) if card else None

    # Step 16: Content detail queries

    def find_card_by_story_id_and_uuid(self, story_id: int, uuid: str) -> Optional[Dict[str, Any]]:
        with self.session_factory() as session:
            card = session.query(CardEntity).filter(
                CardEntity.id_story == story_id,
                CardEntity.uuid == uuid
            ).first()
            return self._to_dict(card) if card else None

    def find_text_by_story_id_text_and_lang(self, story_id: int, id_text: int, lang: str) -> Optional[Dict[str, Any]]:
        with self.session_factory() as session:
            text = session.query(TextEntity).filter(
                TextEntity.id_story == story_id,
                TextEntity.id_text == id_text,
                TextEntity.lang == lang
            ).first()
            return self._to_dict(text) if text else None

    def find_creator_by_story_id_and_uuid(self, story_id: int, uuid: str) -> Optional[Dict[str, Any]]:
        with self.session_factory() as session:
            creator = session.query(CreatorEntity).filter(
                CreatorEntity.id_story == story_id,
                CreatorEntity.uuid == uuid
            ).first()
            return self._to_dict(creator) if creator else None

    def find_creators_for_story(self, story_id: int) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            creators = session.query(CreatorEntity).filter(
                CreatorEntity.id_story == story_id
            ).all()
            return [self._to_dict(c) for c in creators]

    def _to_dict(self, obj) -> Dict[str, Any]:
        result = {}
        for column in obj.__table__.columns:
            result[column.name] = getattr(obj, column.name)
        return result
