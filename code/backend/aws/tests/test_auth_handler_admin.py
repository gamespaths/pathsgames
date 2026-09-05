"""Extra coverage for auth/handler.py admin guest-management endpoints and the
self endpoints (get_me / logout_all). db_utils is patched so no DynamoDB calls
are made; the MOCK_ACCESS_ token resolves the user via get_item."""
import json
from unittest.mock import patch

from helpers import make_event, admin_event

ADMIN_USER = {
    'PK': 'USER#admin-uuid-001', 'SK': 'METADATA', 'uuid': 'admin-uuid-001',
    'username': 'admin', 'role': 'ADMIN', 'state': 6, 'is_guest': True,
    'guest_token': 'gt-admin', 'guest_expires_at': 9_999_999_999_000,
    'ts_registration': 1_700_000_000_000,
}

GUESTS = [
    {'PK': 'USER#g1', 'SK': 'METADATA', 'uuid': 'g1', 'username': 'guest1',
     'is_guest': True, 'guest_expires_at': 9_999_999_999_000},
    {'PK': 'USER#g2', 'SK': 'METADATA', 'uuid': 'g2', 'username': 'guest2',
     'is_guest': True, 'guest_expires_at': 1},  # expired
]


def _body(result):
    return json.loads(result['body'])


def _call(event):
    from auth.handler import lambda_handler
    return lambda_handler(event, {})


def test_list_guests_requires_admin():
    # a non-admin player token → 403
    with patch('auth.handler.db_utils.get_item', return_value={**ADMIN_USER, 'role': 'PLAYER'}):
        result = _call(make_event('GET', '/api/admin/guests',
                                  headers={'Authorization': 'Bearer MOCK_ACCESS_admin-uuid-001'}))
    assert result['statusCode'] == 403


def test_list_guests_returns_guest_infos():
    """v0.36.2 — one bounded page, in the {items, nextCursor, limit} envelope."""
    with patch('auth.handler.db_utils.get_item', return_value=ADMIN_USER), \
         patch('auth.handler.db_utils.scan_filter_page', return_value=(GUESTS, None)):
        result = _call(admin_event('GET', '/api/admin/guests'))
    assert result['statusCode'] == 200
    body = _body(result)
    assert len(body['items']) == 2
    assert body['limit'] == 50


def test_list_guests_is_one_bounded_scan_page_not_the_whole_table():
    """The whole-table scan is what timed out at 15s; the page must carry the cursor on."""
    seen = {}

    def _page(attr, value, limit=None, start_key=None, extra_filter=None):
        seen['limit'] = limit
        return GUESTS[:1], {'PK': 'USER#g-2'}

    with patch('auth.handler.db_utils.get_item', return_value=ADMIN_USER), \
         patch('auth.handler.db_utils.scan_filter_page', side_effect=_page):
        result = _call(admin_event('GET', '/api/admin/guests', qs={'limit': '1'}))
    body = _body(result)
    assert seen['limit'] == 1
    assert body['nextCursor'] is not None

    # The cursor round-trips: the next request resumes exactly where this page stopped.
    with patch('auth.handler.db_utils.get_item', return_value=ADMIN_USER), \
         patch('auth.handler.db_utils.scan_filter_page', return_value=([], None)) as nxt:
        _call(admin_event('GET', '/api/admin/guests', qs={'cursor': body['nextCursor']}))
    assert nxt.call_args.args[3] == {'PK': 'USER#g-2'}


def test_stale_guests_refuses_without_a_bound():
    """Without olderThanDays the purge would take EVERY guest: refuse, never guess."""
    with patch('auth.handler.db_utils.get_item', return_value=ADMIN_USER):
        result = _call(admin_event('DELETE', '/api/admin/guests/stale'))
    assert result['statusCode'] == 400
    assert _body(result)['error'] == 'INVALID_INPUT'


def test_delete_stale_guests_takes_their_matches_first():
    deleted = []
    stale = [{'PK': 'USER#g-1', 'uuid': 'g-1', 'is_guest': True, 'ts_last_access': 1}]
    matches = [{'PK': 'MATCH#m-1', 'SK': 'METADATA', 'userCreatorUuid': 'g-1'}]
    with patch('auth.handler.db_utils.get_item', return_value=ADMIN_USER), \
         patch('auth.handler.db_utils.scan_filter', return_value=stale), \
         patch('auth.handler.db_utils.scan_pk_prefix', return_value=matches), \
         patch('auth.handler.db_utils.delete_item',
               side_effect=lambda pk, sk=None: deleted.append(pk)):
        result = _call(admin_event('DELETE', '/api/admin/guests/stale', qs={'olderThanDays': '1'}))
    body = _body(result)
    assert body == {'guests': 1, 'matches': 1, 'status': 'CLEANUP_COMPLETE'}
    # The match goes before its creator, as the SQL backends' foreign key requires.
    assert deleted == ['MATCH#m-1', 'USER#g-1']


def test_guest_stats_counts_expired():
    with patch('auth.handler.db_utils.get_item', return_value=ADMIN_USER), \
         patch('auth.handler.db_utils.scan_filter', return_value=GUESTS):
        result = _call(admin_event('GET', '/api/admin/guests/stats'))
    body = _body(result)
    assert body['totalGuests'] == 2
    assert body['expiredGuests'] == 1
    assert body['activeGuests'] == 1


def test_cleanup_expired_deletes_expired_guests():
    deleted = []
    with patch('auth.handler.db_utils.get_item', return_value=ADMIN_USER), \
         patch('auth.handler.db_utils.scan_filter', return_value=GUESTS), \
         patch('auth.handler.db_utils.delete_item', side_effect=lambda pk, sk: deleted.append(pk)):
        result = _call(admin_event('DELETE', '/api/admin/guests/expired'))
    assert result['statusCode'] == 200
    assert _body(result)['deletedCount'] == 1


def test_get_guest_by_uuid_found_and_missing():
    with patch('auth.handler.db_utils.get_item', side_effect=[ADMIN_USER, GUESTS[0]]):
        ok = _call(admin_event('GET', '/api/admin/guests/g1'))
    assert ok['statusCode'] == 200

    with patch('auth.handler.db_utils.get_item', side_effect=[ADMIN_USER, None]):
        missing = _call(admin_event('GET', '/api/admin/guests/nope'))
    assert missing['statusCode'] == 404


def test_delete_guest_found_and_missing():
    with patch('auth.handler.db_utils.get_item', side_effect=[ADMIN_USER, GUESTS[0]]), \
         patch('auth.handler.db_utils.delete_item', return_value=True):
        ok = _call(admin_event('DELETE', '/api/admin/guests/g1'))
    assert ok['statusCode'] in (200, 204)

    with patch('auth.handler.db_utils.get_item', side_effect=[ADMIN_USER, None]):
        missing = _call(admin_event('DELETE', '/api/admin/guests/nope'))
    assert missing['statusCode'] == 404


def test_logout_all_revokes_sessions():
    with patch('auth.handler.db_utils.get_item', return_value=ADMIN_USER):
        result = _call(make_event('POST', '/api/auth/logout/all',
                                  headers={'Authorization': 'Bearer MOCK_ACCESS_admin-uuid-001'}))
    assert result['statusCode'] == 200
    assert _body(result)['status'] == 'OK'
