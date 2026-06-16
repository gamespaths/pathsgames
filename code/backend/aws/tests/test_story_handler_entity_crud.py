"""Coverage for the admin entity-CRUD handlers in story/handler.py (Step 17).

`_require_admin` is patched to return an admin user so we focus on the CRUD
logic; db_utils is patched so no DynamoDB calls are made."""
import json
from unittest.mock import patch

from helpers import make_event

ADMIN = {'uuid': 'admin-uuid-001', 'role': 'ADMIN'}

STORY = {
    'PK': 'STORY#s1', 'SK': 'METADATA', 'uuid': 's1', 'id': 1,
    'locations': [{'id': 1, 'uuid': 'loc-1', 'idStory': 1}],
}


def _body(result):
    return json.loads(result['body'])


def test_list_entities_success_and_story_missing():
    from story import handler
    with patch.object(handler, '_require_admin', return_value=(ADMIN, None)), \
         patch('story.handler.db_utils.get_item', return_value=dict(STORY)):
        ok = handler.list_entities(make_event('GET', '/x'), 's1', 'locations')
    assert ok['statusCode'] == 200
    assert len(_body(ok)) == 1

    with patch.object(handler, '_require_admin', return_value=(ADMIN, None)), \
         patch('story.handler.db_utils.get_item', return_value=None):
        missing = handler.list_entities(make_event('GET', '/x'), 's1', 'locations')
    assert missing['statusCode'] == 404


def test_list_entities_unknown_type_returns_empty():
    from story import handler
    with patch.object(handler, '_require_admin', return_value=(ADMIN, None)), \
         patch('story.handler.db_utils.get_item', return_value=dict(STORY)):
        result = handler.list_entities(make_event('GET', '/x'), 's1', 'not-a-type')
    assert result['statusCode'] == 200
    assert _body(result) == []


def test_create_entity_success_and_invalid_type():
    from story import handler
    put = []
    with patch.object(handler, '_require_admin', return_value=(ADMIN, None)), \
         patch('story.handler.db_utils.get_item', return_value=dict(STORY)), \
         patch('story.handler.db_utils.put_item', side_effect=lambda i: put.append(i)):
        ok = handler.create_entity(make_event('POST', '/x', body={'idTextName': 5}),
                                   's1', 'locations')
    assert ok['statusCode'] == 201
    assert _body(ok)['uuid']

    with patch.object(handler, '_require_admin', return_value=(ADMIN, None)), \
         patch('story.handler.db_utils.get_item', return_value=dict(STORY)):
        bad = handler.create_entity(make_event('POST', '/x', body={}), 's1', 'nope')
    assert bad['statusCode'] == 400


def test_create_entity_invalid_json():
    from story import handler
    ev = make_event('POST', '/x')
    ev['body'] = '{not json'
    with patch.object(handler, '_require_admin', return_value=(ADMIN, None)), \
         patch('story.handler.db_utils.get_item', return_value=dict(STORY)):
        result = handler.create_entity(ev, 's1', 'locations')
    assert result['statusCode'] == 400


def test_get_entity_found_and_missing():
    from story import handler
    with patch.object(handler, '_require_admin', return_value=(ADMIN, None)), \
         patch('story.handler.db_utils.get_item', return_value=dict(STORY)):
        ok = handler.get_entity(make_event('GET', '/x'), 's1', 'locations', 'loc-1')
        missing = handler.get_entity(make_event('GET', '/x'), 's1', 'locations', 'nope')
    assert ok['statusCode'] == 200
    assert missing['statusCode'] == 404


def test_update_entity_success_and_missing():
    from story import handler
    with patch.object(handler, '_require_admin', return_value=(ADMIN, None)), \
         patch('story.handler.db_utils.get_item', return_value=dict(STORY)), \
         patch('story.handler.db_utils.put_item', return_value=True):
        ok = handler.update_entity(make_event('PUT', '/x', body={'isSafe': 1}),
                                   's1', 'locations', 'loc-1')
        missing = handler.update_entity(make_event('PUT', '/x', body={'isSafe': 1}),
                                        's1', 'locations', 'nope')
    assert ok['statusCode'] == 200
    assert _body(ok)['status'] == 'UPDATED'
    assert missing['statusCode'] == 404


def test_delete_entity_branches():
    from story import handler
    with patch.object(handler, '_require_admin', return_value=(ADMIN, None)), \
         patch('story.handler.db_utils.get_item', return_value=dict(STORY)), \
         patch('story.handler.db_utils.put_item', return_value=True):
        ok = handler.delete_entity(make_event('DELETE', '/x'), 's1', 'locations', 'loc-1')
    assert ok['statusCode'] in (200, 204)
