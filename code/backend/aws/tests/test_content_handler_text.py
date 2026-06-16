"""Extra coverage for content/handler.py — the get_text route (with copyright +
creator resolution) and the small serialisation/path helpers."""
import decimal
import json
from unittest.mock import patch

from helpers import make_event


def _call(event):
    from content.handler import lambda_handler
    return lambda_handler(event, {})


def _body(result):
    return json.loads(result['body'])


STORY = {
    'PK': 'STORY#s1', 'SK': 'METADATA', 'uuid': 's1',
    'raw_texts': [
        {'idText': 1, 'lang': 'en', 'shortText': 'Hello', 'longText': 'Hello long',
         'idTextCopyright': 2, 'linkCopyright': 'http://cc', 'idCreator': 9},
        {'idText': 2, 'lang': 'en', 'shortText': '(c) Author'},
    ],
    'raw_creators': [{'id': 9, 'uuid': 'cr-9', 'idTextName': 1}],
}


def test_get_text_resolves_copyright_and_creator():
    with patch('content.handler.db_utils.get_item', return_value=STORY):
        result = _call(make_event('GET', '/api/content/s1/texts/1/lang/en'))
    assert result['statusCode'] == 200
    body = _body(result)
    assert body['shortText'] == 'Hello'
    assert body['copyrightText'] == '(c) Author'
    assert body['creator'] is not None


def test_get_text_story_missing_returns_404():
    with patch('content.handler.db_utils.get_item', return_value=None):
        result = _call(make_event('GET', '/api/content/s1/texts/1/lang/en'))
    assert result['statusCode'] == 404


def test_get_text_text_missing_returns_404():
    story = {**STORY, 'raw_texts': []}
    with patch('content.handler.db_utils.get_item', return_value=story):
        result = _call(make_event('GET', '/api/content/s1/texts/99/lang/en'))
    assert result['statusCode'] == 404


def test_helpers_decimal_encoder_and_normalize_path():
    from content.handler import _dumps, _normalize_path, _safe_int, _find_creator_by_id
    out = json.loads(_dumps({'a': decimal.Decimal('3'), 'b': decimal.Decimal('1.5')}))
    assert out == {'a': 3, 'b': 1.5}
    # path without a leading /api/ is left as-is; embedded /api/ is sliced
    assert _normalize_path('/stage/api/content/x') == '/api/content/x'
    assert _normalize_path('weird') == 'weird'
    assert _safe_int(None) == 0 and _safe_int('5') == 5 and _safe_int('x', -1) == -1
    assert _find_creator_by_id([], None) is None
    assert _find_creator_by_id([{'id': 9}], 9) == {'id': 9}
