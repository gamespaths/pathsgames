"""The one place a story card is turned into what the API answers with.

v0.35.8 — the raw ``list_cards`` row is snake_case and keeps its ``id_text_*``
references unresolved. Several services shipped it as-is, so a client reading
``card.title`` / ``card.description`` / ``card.urlImage`` found nothing to render.
This mirrors CardInfoResponse (Java), which is what the frontend speaks.
"""
from typing import Any, Dict, Optional


def resolve_card_text(read_port, story_id, id_text, lang: str) -> Optional[str]:
    """A story text in the requested language, falling back to English."""
    if id_text is None or story_id is None or read_port is None:
        return None
    effective = lang if lang and lang.strip() else "en"
    text = read_port.find_text_by_story_id_text_and_lang(story_id, id_text, effective)
    if text is None and effective != "en":
        text = read_port.find_text_by_story_id_text_and_lang(story_id, id_text, "en")
    return text.get("short_text") if text else None


def card_response(read_port, story_id, raw: Optional[Dict[str, Any]],
                  lang: str = "en") -> Optional[Dict[str, Any]]:
    """Map a raw card row onto the API contract, resolving its texts."""
    if not raw:
        return None
    # The title lives on id_text_title; a card that only names itself uses id_text_name.
    title_id = raw.get("id_text_title") or raw.get("id_text_name")
    return {
        "uuid": raw.get("uuid"),
        "cardType": raw.get("card_type"),
        "urlImage": raw.get("url_image"),
        "alternativeImage": raw.get("alternative_image"),
        "awesomeIcon": raw.get("awesome_icon"),
        "styleMain": raw.get("style_main"),
        "styleDetail": raw.get("style_detail"),
        "styleImageLittle": raw.get("style_image_little"),
        "styleImageMedium": raw.get("style_image_medium"),
        "styleImageLarge": raw.get("style_image_large"),
        "title": resolve_card_text(read_port, story_id, title_id, lang),
        "description": resolve_card_text(read_port, story_id, raw.get("id_text_description"), lang),
        "copyrightText": resolve_card_text(read_port, story_id, raw.get("id_text_copyright"), lang),
        "linkCopyright": raw.get("link_copyright"),
    }


def resolve_card(read_port, story_id, id_card, lang: str = "en") -> Optional[Dict[str, Any]]:
    """Read a card by its story-local id and map it onto the API contract."""
    if id_card is None or story_id is None or read_port is None:
        return None
    return card_response(read_port, story_id,
                         read_port.find_card_by_story_id_and_card_id(story_id, id_card), lang)
