import pytest
from unittest.mock import MagicMock
from app.core.services.story.content_query_service import ContentQueryService
from app.core.models.story.card_info import CardInfo
from app.core.models.story.text_info import TextInfo
from app.core.models.story.creator_info import CreatorInfo


@pytest.fixture
def mock_read_port():
    port = MagicMock()
    port.find_story_by_uuid.return_value = None
    port.find_card_by_story_id_and_uuid.return_value = None
    port.find_text_by_story_id_text_and_lang.return_value = None
    port.find_creator_by_story_id_and_uuid.return_value = None
    port.find_creators_for_story.return_value = []
    return port


# ── Card tests ───────────────────────────────────────────────────────────────

def test_get_card_null_story_uuid(mock_read_port):
    service = ContentQueryService(mock_read_port)
    assert service.get_card_by_story_and_card_uuid(None, "card-uuid", "en") is None

def test_get_card_blank_story_uuid(mock_read_port):
    service = ContentQueryService(mock_read_port)
    assert service.get_card_by_story_and_card_uuid("  ", "card-uuid", "en") is None

def test_get_card_empty_story_uuid(mock_read_port):
    service = ContentQueryService(mock_read_port)
    assert service.get_card_by_story_and_card_uuid("", "card-uuid", "en") is None

def test_get_card_null_card_uuid(mock_read_port):
    service = ContentQueryService(mock_read_port)
    assert service.get_card_by_story_and_card_uuid("story-uuid", None, "en") is None

def test_get_card_blank_card_uuid(mock_read_port):
    service = ContentQueryService(mock_read_port)
    assert service.get_card_by_story_and_card_uuid("story-uuid", "  ", "en") is None

def test_get_card_empty_card_uuid(mock_read_port):
    service = ContentQueryService(mock_read_port)
    assert service.get_card_by_story_and_card_uuid("story-uuid", "", "en") is None

def test_get_card_story_not_found(mock_read_port):
    service = ContentQueryService(mock_read_port)
    assert service.get_card_by_story_and_card_uuid("unknown", "card-uuid", "en") is None

def test_get_card_card_not_found(mock_read_port):
    mock_read_port.find_story_by_uuid.return_value = {"id": 1, "uuid": "s1"}
    service = ContentQueryService(mock_read_port)
    assert service.get_card_by_story_and_card_uuid("s1", "unknown", "en") is None

def test_get_card_success(mock_read_port):
    mock_read_port.find_story_by_uuid.return_value = {"id": 1, "uuid": "s1"}
    mock_read_port.find_card_by_story_id_and_uuid.return_value = {
        "uuid": "card-uuid", "image_url": "https://img.png",
        "alternative_image": "alt", "awesome_icon": "fa-star",
        "style_main": "bg-dark", "style_detail": "text-light",
        "id_text_title": 10, "id_text_description": 11,
        "id_text_copyright": 12, "link_copyright": "https://lic.com",
        "id_creator": None
    }
    mock_read_port.find_text_by_story_id_text_and_lang.side_effect = lambda sid, tid, lang: {
        (1, 10, "en"): {"short_text": "Card Title"},
        (1, 11, "en"): {"short_text": "Card Desc"},
        (1, 12, "en"): {"short_text": "Card (c)"},
    }.get((sid, tid, lang))

    service = ContentQueryService(mock_read_port)
    card = service.get_card_by_story_and_card_uuid("s1", "card-uuid", "en")

    assert card is not None
    assert isinstance(card, CardInfo)
    assert card.uuid == "card-uuid"
    assert card.imageUrl == "https://img.png"
    assert card.alternativeImage == "alt"
    assert card.awesomeIcon == "fa-star"
    assert card.styleMain == "bg-dark"
    assert card.styleDetail == "text-light"
    assert card.title == "Card Title"
    assert card.description == "Card Desc"
    assert card.copyrightText == "Card (c)"
    assert card.linkCopyright == "https://lic.com"
    assert card.creator is None

def test_get_card_with_creator(mock_read_port):
    mock_read_port.find_story_by_uuid.return_value = {"id": 1, "uuid": "s1"}
    mock_read_port.find_card_by_story_id_and_uuid.return_value = {
        "uuid": "card-uuid", "image_url": None,
        "alternative_image": None, "awesome_icon": None,
        "style_main": None, "style_detail": None,
        "id_text_title": None, "id_text_description": None,
        "id_text_copyright": None, "link_copyright": None,
        "id_creator": 5
    }
    mock_read_port.find_creators_for_story.return_value = [
        {"id": 5, "uuid": "cr-uuid", "id_text": 20, "link": "http://cr.com",
         "url": "http://cr.com/p", "url_image": "http://cr.com/img",
         "url_emote": "http://cr.com/emote", "url_instagram": "http://ig.com/cr"}
    ]
    mock_read_port.find_text_by_story_id_text_and_lang.side_effect = lambda sid, tid, lang: {
        (1, 20, "en"): {"short_text": "Creator Name"},
    }.get((sid, tid, lang))

    service = ContentQueryService(mock_read_port)
    card = service.get_card_by_story_and_card_uuid("s1", "card-uuid", "en")

    assert card is not None
    assert card.creator is not None
    assert isinstance(card.creator, CreatorInfo)
    assert card.creator.uuid == "cr-uuid"
    assert card.creator.name == "Creator Name"
    assert card.creator.link == "http://cr.com"
    assert card.creator.url == "http://cr.com/p"
    assert card.creator.urlImage == "http://cr.com/img"
    assert card.creator.urlEmote == "http://cr.com/emote"
    assert card.creator.urlInstagram == "http://ig.com/cr"

def test_get_card_creator_not_in_list(mock_read_port):
    mock_read_port.find_story_by_uuid.return_value = {"id": 1, "uuid": "s1"}
    mock_read_port.find_card_by_story_id_and_uuid.return_value = {
        "uuid": "card-uuid", "image_url": None,
        "alternative_image": None, "awesome_icon": None,
        "style_main": None, "style_detail": None,
        "id_text_title": None, "id_text_description": None,
        "id_text_copyright": None, "link_copyright": None,
        "id_creator": 99
    }
    mock_read_port.find_creators_for_story.return_value = [
        {"id": 5, "uuid": "cr-uuid", "id_text": 20, "link": None,
         "url": None, "url_image": None, "url_emote": None, "url_instagram": None}
    ]

    service = ContentQueryService(mock_read_port)
    card = service.get_card_by_story_and_card_uuid("s1", "card-uuid", "en")

    assert card is not None
    assert card.creator is None


# ── Text tests ───────────────────────────────────────────────────────────────

def test_get_text_null_story_uuid(mock_read_port):
    service = ContentQueryService(mock_read_port)
    assert service.get_text_by_story_and_id_text(None, 1, "en") is None

def test_get_text_blank_story_uuid(mock_read_port):
    service = ContentQueryService(mock_read_port)
    assert service.get_text_by_story_and_id_text("  ", 1, "en") is None

def test_get_text_empty_story_uuid(mock_read_port):
    service = ContentQueryService(mock_read_port)
    assert service.get_text_by_story_and_id_text("", 1, "en") is None

def test_get_text_story_not_found(mock_read_port):
    service = ContentQueryService(mock_read_port)
    assert service.get_text_by_story_and_id_text("unknown", 1, "en") is None

def test_get_text_text_not_found(mock_read_port):
    mock_read_port.find_story_by_uuid.return_value = {"id": 1, "uuid": "s1"}
    service = ContentQueryService(mock_read_port)
    assert service.get_text_by_story_and_id_text("s1", 99999, "en") is None

def test_get_text_success(mock_read_port):
    mock_read_port.find_story_by_uuid.return_value = {"id": 1, "uuid": "s1"}
    mock_read_port.find_text_by_story_id_text_and_lang.side_effect = lambda sid, tid, lang: {
        (1, 1, "en"): {"id_text": 1, "lang": "en", "short_text": "TUTORIAL",
                        "long_text": "Full tutorial text",
                        "id_text_copyright": None, "link_copyright": None, "id_creator": None},
    }.get((sid, tid, lang))

    service = ContentQueryService(mock_read_port)
    text = service.get_text_by_story_and_id_text("s1", 1, "en")

    assert text is not None
    assert isinstance(text, TextInfo)
    assert text.idText == 1
    assert text.lang == "en"
    assert text.resolvedLang == "en"
    assert text.shortText == "TUTORIAL"
    assert text.longText == "Full tutorial text"
    assert text.copyrightText is None
    assert text.creator is None

def test_get_text_language_fallback(mock_read_port):
    mock_read_port.find_story_by_uuid.return_value = {"id": 1, "uuid": "s1"}
    mock_read_port.find_text_by_story_id_text_and_lang.side_effect = lambda sid, tid, lang: {
        (1, 1, "en"): {"id_text": 1, "lang": "en", "short_text": "TUTORIAL",
                        "long_text": None,
                        "id_text_copyright": None, "link_copyright": None, "id_creator": None},
    }.get((sid, tid, lang))

    service = ContentQueryService(mock_read_port)
    text = service.get_text_by_story_and_id_text("s1", 1, "fr")

    assert text is not None
    assert text.lang == "fr"
    assert text.resolvedLang == "en"
    assert text.shortText == "TUTORIAL"

def test_get_text_no_fallback_available(mock_read_port):
    mock_read_port.find_story_by_uuid.return_value = {"id": 1, "uuid": "s1"}
    service = ContentQueryService(mock_read_port)
    text = service.get_text_by_story_and_id_text("s1", 1, "fr")
    assert text is None

def test_get_text_null_lang_defaults_to_en(mock_read_port):
    mock_read_port.find_story_by_uuid.return_value = {"id": 1, "uuid": "s1"}
    mock_read_port.find_text_by_story_id_text_and_lang.side_effect = lambda sid, tid, lang: {
        (1, 1, "en"): {"id_text": 1, "lang": "en", "short_text": "English text",
                        "long_text": None,
                        "id_text_copyright": None, "link_copyright": None, "id_creator": None},
    }.get((sid, tid, lang))

    service = ContentQueryService(mock_read_port)
    text = service.get_text_by_story_and_id_text("s1", 1, None)

    assert text is not None
    assert text.lang == "en"
    assert text.resolvedLang == "en"

def test_get_text_blank_lang_defaults_to_en(mock_read_port):
    mock_read_port.find_story_by_uuid.return_value = {"id": 1, "uuid": "s1"}
    mock_read_port.find_text_by_story_id_text_and_lang.side_effect = lambda sid, tid, lang: {
        (1, 1, "en"): {"id_text": 1, "lang": "en", "short_text": "English text",
                        "long_text": None,
                        "id_text_copyright": None, "link_copyright": None, "id_creator": None},
    }.get((sid, tid, lang))

    service = ContentQueryService(mock_read_port)
    text = service.get_text_by_story_and_id_text("s1", 1, "  ")

    assert text is not None
    assert text.lang == "en"

def test_get_text_with_copyright_and_creator(mock_read_port):
    mock_read_port.find_story_by_uuid.return_value = {"id": 1, "uuid": "s1"}
    mock_read_port.find_text_by_story_id_text_and_lang.side_effect = lambda sid, tid, lang: {
        (1, 1, "en"): {"id_text": 1, "lang": "en", "short_text": "Text",
                        "long_text": None,
                        "id_text_copyright": 50, "link_copyright": "https://lic.com",
                        "id_creator": 3},
        (1, 50, "en"): {"short_text": "(c) Author"},
    }.get((sid, tid, lang))
    mock_read_port.find_creators_for_story.return_value = [
        {"id": 3, "uuid": "cr-uuid", "id_text": 60, "link": "http://cr.com",
         "url": None, "url_image": None, "url_emote": None, "url_instagram": None}
    ]

    service = ContentQueryService(mock_read_port)
    text = service.get_text_by_story_and_id_text("s1", 1, "en")

    assert text is not None
    assert text.copyrightText == "(c) Author"
    assert text.linkCopyright == "https://lic.com"
    assert text.creator is not None
    assert text.creator.uuid == "cr-uuid"

def test_get_text_italian_exact_match(mock_read_port):
    mock_read_port.find_story_by_uuid.return_value = {"id": 1, "uuid": "s1"}
    mock_read_port.find_text_by_story_id_text_and_lang.side_effect = lambda sid, tid, lang: {
        (1, 1, "it"): {"id_text": 1, "lang": "it", "short_text": "TUTORIAL",
                        "long_text": None,
                        "id_text_copyright": None, "link_copyright": None, "id_creator": None},
        (1, 1, "en"): {"id_text": 1, "lang": "en", "short_text": "TUTORIAL",
                        "long_text": None,
                        "id_text_copyright": None, "link_copyright": None, "id_creator": None},
    }.get((sid, tid, lang))

    service = ContentQueryService(mock_read_port)
    text = service.get_text_by_story_and_id_text("s1", 1, "it")

    assert text is not None
    assert text.lang == "it"
    assert text.resolvedLang == "it"

def test_get_text_en_no_fallback_needed(mock_read_port):
    """When lang is 'en' and text not found, no fallback attempt (already en)."""
    mock_read_port.find_story_by_uuid.return_value = {"id": 1, "uuid": "s1"}
    service = ContentQueryService(mock_read_port)
    text = service.get_text_by_story_and_id_text("s1", 999, "en")
    assert text is None


# ── Creator tests ────────────────────────────────────────────────────────────

def test_get_creator_null_story_uuid(mock_read_port):
    service = ContentQueryService(mock_read_port)
    assert service.get_creator_by_story_and_creator_uuid(None, "cr-uuid", "en") is None

def test_get_creator_blank_story_uuid(mock_read_port):
    service = ContentQueryService(mock_read_port)
    assert service.get_creator_by_story_and_creator_uuid("  ", "cr-uuid", "en") is None

def test_get_creator_empty_story_uuid(mock_read_port):
    service = ContentQueryService(mock_read_port)
    assert service.get_creator_by_story_and_creator_uuid("", "cr-uuid", "en") is None

def test_get_creator_null_creator_uuid(mock_read_port):
    service = ContentQueryService(mock_read_port)
    assert service.get_creator_by_story_and_creator_uuid("story-uuid", None, "en") is None

def test_get_creator_blank_creator_uuid(mock_read_port):
    service = ContentQueryService(mock_read_port)
    assert service.get_creator_by_story_and_creator_uuid("story-uuid", "  ", "en") is None

def test_get_creator_empty_creator_uuid(mock_read_port):
    service = ContentQueryService(mock_read_port)
    assert service.get_creator_by_story_and_creator_uuid("story-uuid", "", "en") is None

def test_get_creator_story_not_found(mock_read_port):
    service = ContentQueryService(mock_read_port)
    assert service.get_creator_by_story_and_creator_uuid("unknown", "cr-uuid", "en") is None

def test_get_creator_creator_not_found(mock_read_port):
    mock_read_port.find_story_by_uuid.return_value = {"id": 1, "uuid": "s1"}
    service = ContentQueryService(mock_read_port)
    assert service.get_creator_by_story_and_creator_uuid("s1", "unknown", "en") is None

def test_get_creator_success(mock_read_port):
    mock_read_port.find_story_by_uuid.return_value = {"id": 1, "uuid": "s1"}
    mock_read_port.find_creator_by_story_id_and_uuid.return_value = {
        "uuid": "cr-uuid", "id_text": 30, "link": "http://cr.com",
        "url": "http://cr.com/p", "url_image": "http://cr.com/img",
        "url_emote": "http://cr.com/emote", "url_instagram": "http://ig.com/cr"
    }
    mock_read_port.find_text_by_story_id_text_and_lang.side_effect = lambda sid, tid, lang: {
        (1, 30, "en"): {"short_text": "John Doe"},
    }.get((sid, tid, lang))

    service = ContentQueryService(mock_read_port)
    creator = service.get_creator_by_story_and_creator_uuid("s1", "cr-uuid", "en")

    assert creator is not None
    assert isinstance(creator, CreatorInfo)
    assert creator.uuid == "cr-uuid"
    assert creator.name == "John Doe"
    assert creator.link == "http://cr.com"
    assert creator.url == "http://cr.com/p"
    assert creator.urlImage == "http://cr.com/img"
    assert creator.urlEmote == "http://cr.com/emote"
    assert creator.urlInstagram == "http://ig.com/cr"

def test_get_creator_name_fallback_to_en(mock_read_port):
    mock_read_port.find_story_by_uuid.return_value = {"id": 1, "uuid": "s1"}
    mock_read_port.find_creator_by_story_id_and_uuid.return_value = {
        "uuid": "cr-uuid", "id_text": 30, "link": None,
        "url": None, "url_image": None, "url_emote": None, "url_instagram": None
    }
    mock_read_port.find_text_by_story_id_text_and_lang.side_effect = lambda sid, tid, lang: {
        (1, 30, "en"): {"short_text": "English Name"},
    }.get((sid, tid, lang))

    service = ContentQueryService(mock_read_port)
    creator = service.get_creator_by_story_and_creator_uuid("s1", "cr-uuid", "fr")

    assert creator is not None
    assert creator.name == "English Name"

def test_get_creator_no_id_text(mock_read_port):
    mock_read_port.find_story_by_uuid.return_value = {"id": 1, "uuid": "s1"}
    mock_read_port.find_creator_by_story_id_and_uuid.return_value = {
        "uuid": "cr-uuid", "id_text": None, "link": None,
        "url": None, "url_image": None, "url_emote": None, "url_instagram": None
    }

    service = ContentQueryService(mock_read_port)
    creator = service.get_creator_by_story_and_creator_uuid("s1", "cr-uuid", "en")

    assert creator is not None
    assert creator.name is None


# ── _resolve_text private method tests ───────────────────────────────────────

def test_resolve_text_null_id_text(mock_read_port):
    service = ContentQueryService(mock_read_port)
    assert service._resolve_text(1, None, "en") is None

def test_resolve_text_found(mock_read_port):
    mock_read_port.find_text_by_story_id_text_and_lang.side_effect = lambda sid, tid, lang: {
        (1, 10, "en"): {"short_text": "Hello"},
    }.get((sid, tid, lang))

    service = ContentQueryService(mock_read_port)
    assert service._resolve_text(1, 10, "en") == "Hello"

def test_resolve_text_fallback_to_en(mock_read_port):
    mock_read_port.find_text_by_story_id_text_and_lang.side_effect = lambda sid, tid, lang: {
        (1, 10, "en"): {"short_text": "English"},
    }.get((sid, tid, lang))

    service = ContentQueryService(mock_read_port)
    assert service._resolve_text(1, 10, "fr") == "English"

def test_resolve_text_not_found(mock_read_port):
    service = ContentQueryService(mock_read_port)
    assert service._resolve_text(1, 10, "en") is None

def test_resolve_text_null_lang_defaults_to_en(mock_read_port):
    mock_read_port.find_text_by_story_id_text_and_lang.side_effect = lambda sid, tid, lang: {
        (1, 10, "en"): {"short_text": "English"},
    }.get((sid, tid, lang))

    service = ContentQueryService(mock_read_port)
    assert service._resolve_text(1, 10, None) == "English"

def test_resolve_text_blank_lang_defaults_to_en(mock_read_port):
    mock_read_port.find_text_by_story_id_text_and_lang.side_effect = lambda sid, tid, lang: {
        (1, 10, "en"): {"short_text": "English"},
    }.get((sid, tid, lang))

    service = ContentQueryService(mock_read_port)
    assert service._resolve_text(1, 10, "  ") == "English"


# ── _resolve_creator private method tests ────────────────────────────────────

def test_resolve_creator_null_id_creator(mock_read_port):
    service = ContentQueryService(mock_read_port)
    assert service._resolve_creator(1, None, "en") is None

def test_resolve_creator_no_match(mock_read_port):
    mock_read_port.find_creators_for_story.return_value = [
        {"id": 5, "uuid": "u", "id_text": None, "link": None,
         "url": None, "url_image": None, "url_emote": None, "url_instagram": None}
    ]
    service = ContentQueryService(mock_read_port)
    assert service._resolve_creator(1, 99, "en") is None

def test_resolve_creator_match(mock_read_port):
    mock_read_port.find_creators_for_story.return_value = [
        {"id": 5, "uuid": "cr-uuid", "id_text": 20, "link": "http://link",
         "url": None, "url_image": None, "url_emote": None, "url_instagram": None}
    ]
    mock_read_port.find_text_by_story_id_text_and_lang.side_effect = lambda sid, tid, lang: {
        (1, 20, "en"): {"short_text": "Name"},
    }.get((sid, tid, lang))

    service = ContentQueryService(mock_read_port)
    cr = service._resolve_creator(1, 5, "en")
    assert cr is not None
    assert cr.uuid == "cr-uuid"
    assert cr.name == "Name"
    assert cr.link == "http://link"

def test_resolve_creator_empty_list(mock_read_port):
    mock_read_port.find_creators_for_story.return_value = []
    service = ContentQueryService(mock_read_port)
    assert service._resolve_creator(1, 5, "en") is None
