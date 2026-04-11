from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.core.ports.story.story_read_port import StoryReadPort
from app.adapters.persistence.story.models import (
    StoryEntity, TextEntity, StoryDifficultyEntity, 
    LocationEntity, EventEntity, ItemEntity
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

    def _to_dict(self, obj) -> Dict[str, Any]:
        result = {}
        for column in obj.__table__.columns:
            result[column.name] = getattr(obj, column.name)
        return result
