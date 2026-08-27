"""Coverage for the admin-guard early-returns, unknown-entity-type 404s and the
entity normalisation helpers in story/handler.py."""
import json
import os
from unittest.mock import patch

from helpers import make_event

ADMIN = {'uuid': 'admin-uuid-001', 'role': 'ADMIN'}
FORBIDDEN = {'statusCode': 403, 'headers': {}, 'body': json.dumps({'error': 'FORBIDDEN'})}

STORY = {'PK': 'STORY#s1', 'SK': 'METADATA', 'uuid': 's1', 'id': 1,
         'locations': [{'id': 1, 'uuid': 'loc-1', 'idStory': 1}]}


def _body(result):
    return json.loads(result['body'])


def _ev(method='GET', path='/x', **kw):
    return make_event(method, path, **kw)


# ── admin guard short-circuits every entity route ────────────────────────────

def test_admin_guard_blocks_every_entity_route():
    from story import handler
    calls = [
        (handler.get_admin_story, ('s1',)),
        (handler.validate_story, ('s1',)),
        (handler.get_entity, ('s1', 'locations', 'loc-1')),
        (handler.update_entity, ('s1', 'locations', 'loc-1')),
        (handler.delete_entity, ('s1', 'locations', 'loc-1')),
        (handler.create_story, ()),
    ]
    with patch.object(handler, '_require_admin', return_value=(None, FORBIDDEN)):
        for fn, args in calls:
            result = fn(_ev(), *args)
            assert result['statusCode'] == 403, fn.__name__


# ── _check_admin_ip: the "separators only" whitelist is treated as absent ────

def test_check_admin_ip_separators_only_allows():
    from story.handler import _check_admin_ip
    ev = {'requestContext': {'http': {'sourceIp': '5.5.5.5'}}}
    with patch.dict(os.environ, {'ADMIN_IP_WHITELIST': ' , ,'}, clear=False):
        assert _check_admin_ip(ev) is None
    with patch.dict(os.environ, {'ADMIN_IP_WHITELIST': '5.5.5.5, 6.6.6.6'}, clear=False):
        assert _check_admin_ip(ev) is None


def test_require_admin_rejects_whitelisted_ip_before_jwt():
    from story import handler
    ev = make_event('GET', '/x', headers={'Authorization': 'Bearer whatever'})
    ev['requestContext']['http']['sourceIp'] = '9.9.9.9'
    with patch.dict(os.environ, {'ADMIN_IP_WHITELIST': '1.1.1.1'}, clear=False):
        user, err = handler._require_admin(ev)
    assert user is None and err['statusCode'] == 403


def test_require_admin_mock_token_user_not_found():
    from story import handler
    ev = make_event('GET', '/x', headers={'Authorization': 'Bearer MOCK_ACCESS_ghost'})
    with patch('story.handler.jwt_utils.verify_access_token',
               return_value={'uuid': 'ghost', 'source': 'mock'}), \
         patch('story.handler.db_utils.get_item', return_value=None):
        user, err = handler._require_admin(ev)
    assert user is None and err['statusCode'] == 401


# ── unknown entity type → 404 on get/update/delete ───────────────────────────

def test_unknown_entity_type_returns_404():
    from story import handler
    for fn in (handler.get_entity, handler.update_entity, handler.delete_entity):
        with patch.object(handler, '_require_admin', return_value=(ADMIN, None)), \
             patch('story.handler.db_utils.get_item', return_value=dict(STORY)):
            result = fn(_ev(), 's1', 'not-a-type', 'x')
        assert result['statusCode'] == 404, fn.__name__
        assert _body(result)['error'] == 'ENTITY_NOT_FOUND'


def test_missing_story_returns_404_on_entity_routes():
    from story import handler
    for fn in (handler.get_entity, handler.update_entity, handler.delete_entity):
        with patch.object(handler, '_require_admin', return_value=(ADMIN, None)), \
             patch('story.handler.db_utils.get_item', return_value=None):
            result = fn(_ev(), 's1', 'locations', 'loc-1')
        assert result['statusCode'] == 404, fn.__name__
        assert _body(result)['error'] == 'STORY_NOT_FOUND'


def test_get_entity_returns_normalized_entity():
    from story import handler
    with patch.object(handler, '_require_admin', return_value=(ADMIN, None)), \
         patch('story.handler.db_utils.get_item', return_value=dict(STORY)):
        result = handler.get_entity(_ev(), 's1', 'locations', 'loc-1')
    assert result['statusCode'] == 200
    assert _body(result)['uuid'] == 'loc-1'


def test_get_entity_missing_uuid_returns_404():
    from story import handler
    with patch.object(handler, '_require_admin', return_value=(ADMIN, None)), \
         patch('story.handler.db_utils.get_item', return_value=dict(STORY)):
        result = handler.get_entity(_ev(), 's1', 'locations', 'nope')
    assert result['statusCode'] == 404


# ── update_entity body / validation branches ─────────────────────────────────

def test_update_entity_invalid_json_returns_400():
    from story import handler
    ev = _ev('PUT')
    ev['body'] = '{broken'
    with patch.object(handler, '_require_admin', return_value=(ADMIN, None)), \
         patch('story.handler.db_utils.get_item', return_value=dict(STORY)):
        result = handler.update_entity(ev, 's1', 'locations', 'loc-1')
    assert result['statusCode'] == 400
    assert _body(result)['error'] == 'INVALID_JSON'


def test_update_entity_local_validation_failure_returns_400():
    from story import handler
    with patch.object(handler, '_require_admin', return_value=(ADMIN, None)), \
         patch('story.handler.db_utils.get_item', return_value=dict(STORY)), \
         patch('story.handler.story_validator.validate_entity',
               return_value=[{'code': 'BAD', 'message': 'nope'}]):
        result = handler.update_entity(_ev('PUT', body={'x': 1}), 's1', 'locations', 'loc-1')
    assert result['statusCode'] == 400
    assert _body(result)['error'] == 'INVALID_STORY'
    assert _body(result)['errors'][0]['code'] == 'BAD'


def test_update_entity_cards_syncs_idcard_from_id():
    from story import handler
    story = {'PK': 'STORY#s1', 'uuid': 's1',
             'raw_cards': [{'id': 7, 'uuid': 'card-7'}]}
    put = []
    with patch.object(handler, '_require_admin', return_value=(ADMIN, None)), \
         patch('story.handler.db_utils.get_item', return_value=story), \
         patch('story.handler.db_utils.put_item', side_effect=lambda i: put.append(i)):
        result = handler.update_entity(_ev('PUT', body={'imageUrl': 'http://img'}),
                                       's1', 'cards', 'card-7')
    assert result['statusCode'] == 200
    body = _body(result)
    assert body['status'] == 'UPDATED'
    assert body['idCard'] == 7
    # imageUrl is promoted to the canonical urlImage and the alias dropped
    assert body['urlImage'] == 'http://img'
    assert 'imageUrl' not in body


# ── normalisation helpers ────────────────────────────────────────────────────

def test_normalize_entity_input_passes_through_non_dict():
    from story.handler import _normalize_entity_input
    assert _normalize_entity_input('cards', ['a']) == ['a']


def test_normalize_entity_output_passes_through_non_dict():
    from story.handler import _normalize_entity_output
    assert _normalize_entity_output('creators', 'plain') == 'plain'


def test_normalize_entity_output_creators_aliases_id_card_both_ways():
    from story.handler import _normalize_entity_output
    assert _normalize_entity_output('creators', {'id_card': 3})['idCard'] == 3
    assert _normalize_entity_output('creators', {'idCard': 4})['id_card'] == 4


def test_normalize_entity_output_cards_promotes_image_url():
    from story.handler import _normalize_entity_output
    out = _normalize_entity_output('cards', {'imageUrl': 'http://x'})
    assert out['urlImage'] == 'http://x'
