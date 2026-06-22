"""Tests for common/data_utils.py — safe_int, resolve_raw_text, resolve_card_from_raw."""

from common.data_utils import safe_int, resolve_raw_text, resolve_card_from_raw


# ─── safe_int ────────────────────────────────────────────────────────────────

def test_safe_int_none_returns_default():
    assert safe_int(None) == 0
    assert safe_int(None, default=-1) == -1


def test_safe_int_string_number():
    assert safe_int('5') == 5
    assert safe_int('0') == 0


def test_safe_int_int():
    assert safe_int(42) == 42


def test_safe_int_invalid_returns_default():
    assert safe_int('abc', default=-1) == -1
    assert safe_int('abc') == 0


# ─── resolve_raw_text ────────────────────────────────────────────────────────

RAW_TEXTS = [
    {'idText': 1, 'lang': 'en', 'shortText': 'Hello'},
    {'idText': 1, 'lang': 'it', 'shortText': 'Ciao'},
    {'idText': 2, 'lang': 'en', 'longText': 'Long English'},
]


def test_resolve_raw_text_exact_lang():
    assert resolve_raw_text(RAW_TEXTS, 1, 'it') == 'Ciao'


def test_resolve_raw_text_fallback_to_en():
    assert resolve_raw_text(RAW_TEXTS, 1, 'fr') == 'Hello'


def test_resolve_raw_text_none_id():
    assert resolve_raw_text(RAW_TEXTS, None, 'en') is None


def test_resolve_raw_text_not_found():
    assert resolve_raw_text(RAW_TEXTS, 99, 'en') is None


def test_resolve_raw_text_uses_long_text_fallback():
    assert resolve_raw_text(RAW_TEXTS, 2, 'en') == 'Long English'


def test_resolve_raw_text_string_id():
    assert resolve_raw_text(RAW_TEXTS, '1', 'en') == 'Hello'


# ─── resolve_card_from_raw ───────────────────────────────────────────────────

RAW_CARDS = [
    {
        'id': 10,
        'uuid': 'card-uuid-10',
        'cardType': 'IMAGE',
        'urlImage': 'http://example.com/img.jpg',
        'alternativeImage': None,
        'awesomeIcon': 'fa-star',
        'styleMain': 'style-a',
        'styleDetail': 'detail-a',
        'styleImageLittle': 'lit',
        'styleImageMedium': 'med',
        'styleImageLarge': 'lrg',
        'idTextTitle': 1,
        'idTextDescription': 2,
        'idTextCopyright': None,
        'linkCopyright': None,
    }
]


def test_resolve_card_found():
    card = resolve_card_from_raw(RAW_CARDS, RAW_TEXTS, 10, 'en')
    assert card is not None
    assert card['uuid'] == 'card-uuid-10'
    assert card['title'] == 'Hello'
    assert card['description'] == 'Long English'
    assert card['copyrightText'] is None


def test_resolve_card_none_id():
    assert resolve_card_from_raw(RAW_CARDS, RAW_TEXTS, None, 'en') is None


def test_resolve_card_not_found():
    assert resolve_card_from_raw(RAW_CARDS, RAW_TEXTS, 99, 'en') is None


def test_resolve_card_string_id():
    card = resolve_card_from_raw(RAW_CARDS, RAW_TEXTS, '10', 'it')
    assert card is not None
    assert card['title'] == 'Ciao'
