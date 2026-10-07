"""Coverage for story/handler.py pure helpers and the admin-guard branches."""
import os
from unittest.mock import patch

from helpers import make_event


def test_safe_int_and_resolve_text():
    from story.handler import _safe_int, _resolve_text
    assert _safe_int(None) == 0 and _safe_int('5') == 5 and _safe_int('x', -1) == -1
    texts = {'en': {'title': 'Hello'}, 'it': {'title': 'Ciao'}}
    assert _resolve_text(texts, 'it', 'title') == 'Ciao'
    # missing language falls back to English
    assert _resolve_text(texts, 'fr', 'title') == 'Hello'


def test_resolve_raw_text_with_language_fallback():
    from story.handler import _resolve_raw_text
    raw = [
        {'idText': 1, 'lang': 'en', 'shortText': 'Hello'},
        {'idText': 1, 'lang': 'it', 'shortText': 'Ciao'},
    ]
    assert _resolve_raw_text(raw, 1, 'it') == 'Ciao'
    assert _resolve_raw_text(raw, 1, 'fr') == 'Hello'   # fallback to en
    assert _resolve_raw_text(raw, None, 'en') is None


def test_check_admin_ip_whitelist_branches():
    from story.handler import _check_admin_ip
    ev = {'requestContext': {'http': {'sourceIp': '5.5.5.5'}}}
    with patch.dict(os.environ, {'ADMIN_IP_WHITELIST': ''}, clear=False):
        assert _check_admin_ip(ev) is None
    with patch.dict(os.environ, {'ADMIN_IP_WHITELIST': '1.1.1.1'}, clear=False):
        err = _check_admin_ip(ev)
        assert err is not None and err['statusCode'] == 403


def test_require_admin_jwt_branch():
    from story import handler
    ev = make_event('GET', '/x', headers={'Authorization': 'Bearer realjwt'})
    claims = {'uuid': 'u-jwt', 'source': 'jwt', 'username': 'bob', 'role': 'ADMIN'}
    # jwt admin present in DB
    with patch('story.handler.jwt_utils.verify_access_token', return_value=claims), \
         patch('story.handler.db_utils.get_item', return_value={'uuid': 'u-jwt', 'role': 'ADMIN'}):
        user, err = handler._require_admin(ev)
    assert err is None and user['uuid'] == 'u-jwt'

    # jwt admin not in DB → synthetic admin dict
    with patch('story.handler.jwt_utils.verify_access_token', return_value=claims), \
         patch('story.handler.db_utils.get_item', return_value=None):
        user2, err2 = handler._require_admin(ev)
    assert err2 is None and user2['role'] == 'ADMIN'

    # jwt non-admin → 403
    with patch('story.handler.jwt_utils.verify_access_token',
               return_value={'uuid': 'p', 'source': 'jwt', 'role': 'PLAYER'}):
        _, err3 = handler._require_admin(ev)
    assert err3['statusCode'] == 403


def test_assign_uuids_and_ids_on_an_empty_list():
    from story.handler import _assign_ids, _assign_uuids
    assert _assign_uuids(None) == [] and _assign_uuids([]) == []
    assert _assign_ids(None, 'id') == [] and _assign_ids([], 'id') == []


def test_assign_uuids_keeps_the_uuid_an_entity_already_has():
    from story.handler import _assign_uuids
    entities = [{'uuid': 'kept'}, {}]
    assigned = _assign_uuids(entities)
    assert assigned[0]['uuid'] == 'kept'
    assert assigned[1]['uuid']


def test_assign_ids_reads_the_fallback_id_fields():
    from story.handler import _assign_ids
    assert _assign_ids([{'idText': '7'}], 'id')[0]['id'] == 7
    assert _assign_ids([{'id_tipo': 3}], 'id')[0]['id'] == 3


def test_assign_ids_generates_the_missing_ones():
    from story.handler import _assign_ids
    assigned = _assign_ids([{'id': 1}, {}, {}], 'id')
    ids = [e['id'] for e in assigned]
    assert ids[0] == 1
    assert len(set(ids)) == 3
