"""
Unit tests for content/handler.py — public endpoints, db_utils mocked.
"""
import json
import pytest
from unittest.mock import patch
from helpers import make_event


def _body(result):
    return json.loads(result['body'])


STORY_ITEM = {
    'PK': 'STORY#story-1',
    'SK': 'METADATA',
    'uuid': 'story-1',
    'raw_texts': [
        {'idText': 1, 'lang': 'en', 'shortText': 'Hello', 'longText': None},
        {'idText': 2, 'lang': 'en', 'shortText': 'World', 'longText': None},
        {'idText': 10, 'lang': 'it', 'shortText': 'Ciao', 'longText': None},
    ],
    'raw_cards': [
        {
            'uuid': 'card-uuid-1',
            'idTextTitle': 1,
            'idTextDescription': 2,
            'idCreator': None,
            'imageUrl': 'http://img.test/1.png',
            'awesomeIcon': 'fa-sword',
            'styleMain': 'dark',
            'styleDetail': 'detail',
        }
    ],
    'raw_creators': [
        {
            'id': 1,
            'uuid': 'creator-uuid-1',
            'idText': 1,
            'link': 'http://creator.test',
            'url': None,
            'urlImage': None,
            'urlEmote': None,
            'urlInstagram': None,
        }
    ],
}


# ── routing ───────────────────────────────────────────────────────────────────

def test_unknown_route_returns_404():
    from content.handler import lambda_handler
    event = make_event('GET', '/api/content/no-match')
    result = lambda_handler(event, {})
    assert result['statusCode'] == 404

def test_post_method_returns_404():
    from content.handler import lambda_handler
    event = make_event('POST', '/api/content/story-1/cards/card-uuid-1')
    result = lambda_handler(event, {})
    assert result['statusCode'] == 404


# ── get_card ──────────────────────────────────────────────────────────────────

def test_get_card_success():
    with patch('content.handler.db_utils.get_item', return_value=STORY_ITEM):
        from content.handler import lambda_handler
        event = make_event('GET', '/api/content/story-1/cards/card-uuid-1')
        result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    body = _body(result)
    assert body['uuid'] == 'card-uuid-1'
    assert body['imageUrl'] == 'http://img.test/1.png'

def test_get_card_resolves_texts():
    with patch('content.handler.db_utils.get_item', return_value=STORY_ITEM):
        from content.handler import lambda_handler
        event = make_event('GET', '/api/content/story-1/cards/card-uuid-1')
        result = lambda_handler(event, {})
    body = _body(result)
    assert body['title'] == 'Hello'
    assert body['description'] == 'World'

def test_get_card_story_not_found_returns_404():
    with patch('content.handler.db_utils.get_item', return_value=None):
        from content.handler import lambda_handler
        event = make_event('GET', '/api/content/missing-story/cards/card-uuid-1')
        result = lambda_handler(event, {})
    assert result['statusCode'] == 404

def test_get_card_uuid_not_found_in_story_returns_404():
    with patch('content.handler.db_utils.get_item', return_value=STORY_ITEM):
        from content.handler import lambda_handler
        event = make_event('GET', '/api/content/story-1/cards/no-such-card')
        result = lambda_handler(event, {})
    assert result['statusCode'] == 404


# ── get_text ──────────────────────────────────────────────────────────────────

def test_get_text_success():
    with patch('content.handler.db_utils.get_item', return_value=STORY_ITEM):
        from content.handler import lambda_handler
        event = make_event('GET', '/api/content/story-1/texts/1/lang/en')
        result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    body = _body(result)
    assert body['shortText'] == 'Hello'
    assert body['lang'] == 'en'
    assert body['idText'] == 1

def test_get_text_italian_found():
    with patch('content.handler.db_utils.get_item', return_value=STORY_ITEM):
        from content.handler import lambda_handler
        event = make_event('GET', '/api/content/story-1/texts/10/lang/it')
        result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    assert _body(result)['shortText'] == 'Ciao'

def test_get_text_lang_fallback_to_english():
    with patch('content.handler.db_utils.get_item', return_value=STORY_ITEM):
        from content.handler import lambda_handler
        # idText=1 only exists in 'en', request 'fr' → should fallback
        event = make_event('GET', '/api/content/story-1/texts/1/lang/fr')
        result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    assert _body(result)['shortText'] == 'Hello'
    assert _body(result)['resolvedLang'] == 'en'

def test_get_text_not_found_returns_404():
    with patch('content.handler.db_utils.get_item', return_value=STORY_ITEM):
        from content.handler import lambda_handler
        event = make_event('GET', '/api/content/story-1/texts/999/lang/en')
        result = lambda_handler(event, {})
    assert result['statusCode'] == 404


# ── get_creator ───────────────────────────────────────────────────────────────

def test_get_creator_success():
    with patch('content.handler.db_utils.get_item', return_value=STORY_ITEM):
        from content.handler import lambda_handler
        event = make_event('GET', '/api/content/story-1/creators/creator-uuid-1')
        result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    body = _body(result)
    assert body['uuid'] == 'creator-uuid-1'
    assert body['name'] == 'Hello'  # resolved from idText=1

def test_get_creator_not_found_returns_404():
    with patch('content.handler.db_utils.get_item', return_value=STORY_ITEM):
        from content.handler import lambda_handler
        event = make_event('GET', '/api/content/story-1/creators/no-such-creator')
        result = lambda_handler(event, {})
    assert result['statusCode'] == 404

def test_get_creator_story_not_found_returns_404():
    with patch('content.handler.db_utils.get_item', return_value=None):
        from content.handler import lambda_handler
        event = make_event('GET', '/api/content/missing/creators/creator-uuid-1')
        result = lambda_handler(event, {})
    assert result['statusCode'] == 404
