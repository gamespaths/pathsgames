"""v0.35.8 — the shared card mapper.

Several services shipped the raw ``list_cards`` row: snake_case keys and the
``id_text_*`` references unresolved, so a client reading ``card.title`` /
``card.description`` / ``card.urlImage`` rendered an empty card.
"""
from unittest.mock import MagicMock

from app.core.services.match.card_mapper import (
    card_response, resolve_card, resolve_card_text)

RAW = {
    "uuid": "card-uuid", "card_type": "location",
    "url_image": "http://img", "alternative_image": "http://alt", "awesome_icon": "fas fa-map",
    "style_main": "sm", "style_detail": "sd", "style_image_little": "sl",
    "style_image_medium": "smd", "style_image_large": "ob-c-20",
    "id_text_title": 362, "id_text_name": 999,
    "id_text_description": 366, "id_text_copyright": 365,
    "link_copyright": "http://unsplash",
}


def _port(texts):
    """A read port whose texts are keyed by (id_text, lang) — anything else is missing."""
    port = MagicMock()
    port.find_card_by_story_id_and_card_id.return_value = RAW
    port.find_text_by_story_id_text_and_lang.side_effect = \
        lambda story_id, id_text, lang: texts.get((id_text, lang))
    return port


def test_card_response_maps_every_field_and_resolves_the_texts():
    port = _port({(362, "it"): {"short_text": "Titolo"},
                  (366, "it"): {"short_text": "Descrizione"},
                  (365, "it"): {"short_text": "Autore"}})

    card = card_response(port, 101, RAW, "it")

    assert card == {
        "uuid": "card-uuid", "cardType": "location",
        "urlImage": "http://img", "alternativeImage": "http://alt",
        "awesomeIcon": "fas fa-map", "styleMain": "sm", "styleDetail": "sd",
        "styleImageLittle": "sl", "styleImageMedium": "smd", "styleImageLarge": "ob-c-20",
        "title": "Titolo", "description": "Descrizione",
        "copyrightText": "Autore", "linkCopyright": "http://unsplash",
    }
    # not a single snake_case key survives into the answer
    assert not [k for k in card if "_" in k]


def test_the_title_falls_back_to_the_cards_name():
    port = _port({(999, "en"): {"short_text": "By name"}})
    raw = dict(RAW, id_text_title=None)

    assert card_response(port, 101, raw, "en")["title"] == "By name"


def test_a_missing_translation_falls_back_to_english():
    port = _port({(362, "en"): {"short_text": "English title"}})

    assert card_response(port, 101, RAW, "it")["title"] == "English title"
    # a blank lang is the same as asking for English
    assert resolve_card_text(port, 101, 362, "") == "English title"
    assert resolve_card_text(port, 101, None, "en") is None


def test_resolve_card_reads_then_maps_and_tolerates_the_gaps():
    port = _port({(362, "en"): {"short_text": "Title"}})

    assert resolve_card(port, 101, 7, "en")["title"] == "Title"
    port.find_card_by_story_id_and_card_id.assert_called_once_with(101, 7)
    # nothing to read, nothing to map — and never an exception
    assert resolve_card(port, 101, None, "en") is None
    assert resolve_card(None, 101, 7, "en") is None
    assert resolve_card(port, None, 7, "en") is None
    port.find_card_by_story_id_and_card_id.return_value = None
    assert resolve_card(port, 101, 7, "en") is None
    assert card_response(port, 101, None, "en") is None
