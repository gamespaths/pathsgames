from typing import Optional
from app.core.models.story.card_info import CardInfo
from app.core.models.story.text_info import TextInfo
from app.core.models.story.creator_info import CreatorInfo
from app.core.ports.story.content_query_port import ContentQueryPort
from app.core.ports.story.story_read_port import StoryReadPort


class ContentQueryService(ContentQueryPort):
    def __init__(self, read_port: StoryReadPort):
        self.read_port = read_port

    def get_card_by_story_and_card_uuid(self, story_uuid: str, card_uuid: str, lang: str) -> Optional[CardInfo]:
        if not story_uuid or not story_uuid.strip():
            return None
        if not card_uuid or not card_uuid.strip():
            return None

        story = self.read_port.find_story_by_uuid(story_uuid)
        if not story:
            return None

        story_id = story.get("id")
        card = self.read_port.find_card_by_story_id_and_uuid(story_id, card_uuid)
        if not card:
            return None

        title = self._resolve_text(story_id, card.get("id_text_title"), lang)
        description = self._resolve_text(story_id, card.get("id_text_description"), lang)
        copyright_text = self._resolve_text(story_id, card.get("id_text_copyright"), lang)
        creator = self._resolve_creator(story_id, card.get("id_creator"), lang)

        return CardInfo(
            uuid=card.get("uuid"),
            imageUrl=card.get("image_url"),
            alternativeImage=card.get("alternative_image"),
            awesomeIcon=card.get("awesome_icon"),
            styleMain=card.get("style_main"),
            styleDetail=card.get("style_detail"),
            title=title,
            description=description,
            copyrightText=copyright_text,
            linkCopyright=card.get("link_copyright"),
            creator=creator
        )

    def get_text_by_story_and_id_text(self, story_uuid: str, id_text: int, lang: str) -> Optional[TextInfo]:
        if not story_uuid or not story_uuid.strip():
            return None

        story = self.read_port.find_story_by_uuid(story_uuid)
        if not story:
            return None

        story_id = story.get("id")
        effective_lang = lang if lang and lang.strip() else "en"

        text = self.read_port.find_text_by_story_id_text_and_lang(story_id, id_text, effective_lang)
        resolved_lang = effective_lang

        if not text and effective_lang != "en":
            text = self.read_port.find_text_by_story_id_text_and_lang(story_id, id_text, "en")
            if text:
                resolved_lang = "en"

        if not text:
            return None

        copyright_text = self._resolve_text(story_id, text.get("id_text_copyright"), effective_lang)
        creator = self._resolve_creator(story_id, text.get("id_creator"), effective_lang)

        return TextInfo(
            idText=text.get("id_text"),
            lang=effective_lang,
            resolvedLang=resolved_lang,
            shortText=text.get("short_text"),
            longText=text.get("long_text"),
            copyrightText=copyright_text,
            linkCopyright=text.get("link_copyright"),
            creator=creator
        )

    def get_creator_by_story_and_creator_uuid(self, story_uuid: str, creator_uuid: str, lang: str) -> Optional[CreatorInfo]:
        if not story_uuid or not story_uuid.strip():
            return None
        if not creator_uuid or not creator_uuid.strip():
            return None

        story = self.read_port.find_story_by_uuid(story_uuid)
        if not story:
            return None

        story_id = story.get("id")
        creator = self.read_port.find_creator_by_story_id_and_uuid(story_id, creator_uuid)
        if not creator:
            return None

        name = self._resolve_text(story_id, creator.get("id_text"), lang)

        return CreatorInfo(
            uuid=creator.get("uuid"),
            name=name,
            link=creator.get("link"),
            url=creator.get("url"),
            urlImage=creator.get("url_image"),
            urlEmote=creator.get("url_emote"),
            urlInstagram=creator.get("url_instagram")
        )

    # === Private helpers ===

    def _resolve_text(self, story_id: int, id_text: Optional[int], lang: str) -> Optional[str]:
        if id_text is None:
            return None
        effective_lang = lang if lang and lang.strip() else "en"

        text = self.read_port.find_text_by_story_id_text_and_lang(story_id, id_text, effective_lang)
        if text:
            return text.get("short_text")

        if effective_lang != "en":
            fallback = self.read_port.find_text_by_story_id_text_and_lang(story_id, id_text, "en")
            if fallback:
                return fallback.get("short_text")

        return None

    def _resolve_creator(self, story_id: int, id_creator: Optional[int], lang: str) -> Optional[CreatorInfo]:
        if id_creator is None:
            return None

        creators = self.read_port.find_creators_for_story(story_id)
        for c in creators:
            if c.get("id") is not None and int(c["id"]) == id_creator:
                name = self._resolve_text(story_id, c.get("id_text"), lang)
                return CreatorInfo(
                    uuid=c.get("uuid"),
                    name=name,
                    link=c.get("link"),
                    url=c.get("url"),
                    urlImage=c.get("url_image"),
                    urlEmote=c.get("url_emote"),
                    urlInstagram=c.get("url_instagram")
                )
        return None
