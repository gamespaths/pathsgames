from fastapi import APIRouter, Query, Path, HTTPException
from typing import Optional
from app.core.ports.story.content_query_port import ContentQueryPort


class ContentController:
    def __init__(self, query_port: ContentQueryPort):
        self.query_port = query_port
        self.router = APIRouter(prefix="/api/content", tags=["Content"])

        self.router.add_api_route(
            "/{uuid_story}/cards/{uuid_card}",
            self.get_card, methods=["GET"]
        )
        self.router.add_api_route(
            "/{uuid_story}/texts/{id_text}/lang/{lang}",
            self.get_text, methods=["GET"]
        )
        self.router.add_api_route(
            "/{uuid_story}/creators/{uuid_creator}",
            self.get_creator, methods=["GET"]
        )

    async def get_card(
        self,
        uuid_story: str = Path(...),
        uuid_card: str = Path(...),
        lang: str = Query("en")
    ):
        card = self.query_port.get_card_by_story_and_card_uuid(uuid_story, uuid_card, lang)
        if not card:
            raise HTTPException(status_code=404, detail={
                "error": "CARD_NOT_FOUND",
                "message": f"No card found with UUID: {uuid_card} in story: {uuid_story}"
            })
        result = {
            "uuid": card.uuid,
            "imageUrl": card.imageUrl,
            "alternativeImage": card.alternativeImage,
            "awesomeIcon": card.awesomeIcon,
            "styleMain": card.styleMain,
            "styleDetail": card.styleDetail,
            "title": card.title,
            "description": card.description,
            "copyrightText": card.copyrightText,
            "linkCopyright": card.linkCopyright,
            "creator": self._creator_to_dict(card.creator) if card.creator else None
        }
        return result

    async def get_text(
        self,
        uuid_story: str = Path(...),
        id_text: int = Path(...),
        lang: str = Path(...)
    ):
        text = self.query_port.get_text_by_story_and_id_text(uuid_story, id_text, lang)
        if not text:
            raise HTTPException(status_code=404, detail={
                "error": "TEXT_NOT_FOUND",
                "message": f"No text found with id_text: {id_text} in story: {uuid_story}"
            })
        result = {
            "idText": text.idText,
            "lang": text.lang,
            "resolvedLang": text.resolvedLang,
            "shortText": text.shortText,
            "longText": text.longText,
            "copyrightText": text.copyrightText,
            "linkCopyright": text.linkCopyright,
            "creator": self._creator_to_dict(text.creator) if text.creator else None
        }
        return result

    async def get_creator(
        self,
        uuid_story: str = Path(...),
        uuid_creator: str = Path(...),
        lang: str = Query("en")
    ):
        creator = self.query_port.get_creator_by_story_and_creator_uuid(uuid_story, uuid_creator, lang)
        if not creator:
            raise HTTPException(status_code=404, detail={
                "error": "CREATOR_NOT_FOUND",
                "message": f"No creator found with UUID: {uuid_creator} in story: {uuid_story}"
            })
        return self._creator_to_dict(creator)

    def _creator_to_dict(self, creator) -> dict:
        return {
            "uuid": creator.uuid,
            "name": creator.name,
            "link": creator.link,
            "url": creator.url,
            "urlImage": creator.urlImage,
            "urlEmote": creator.urlEmote,
            "urlInstagram": creator.urlInstagram
        }
