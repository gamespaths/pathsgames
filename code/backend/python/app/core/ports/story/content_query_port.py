from abc import ABC, abstractmethod
from typing import Optional
from app.core.models.story.card_info import CardInfo
from app.core.models.story.text_info import TextInfo
from app.core.models.story.creator_info import CreatorInfo


class ContentQueryPort(ABC):
    @abstractmethod
    def get_card_by_story_and_card_uuid(self, story_uuid: str, card_uuid: str, lang: str) -> Optional[CardInfo]:
        pass

    @abstractmethod
    def get_text_by_story_and_id_text(self, story_uuid: str, id_text: int, lang: str) -> Optional[TextInfo]:
        pass

    @abstractmethod
    def get_creator_by_story_and_creator_uuid(self, story_uuid: str, creator_uuid: str, lang: str) -> Optional[CreatorInfo]:
        pass
