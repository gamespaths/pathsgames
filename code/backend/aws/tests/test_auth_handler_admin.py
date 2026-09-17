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

# v0.37.5 — what the GSI2 GUEST_LIST rows look like: keys + the projected ``summary``.
GUESTS = [
    {'PK': 'USER#g1', 'SK': 'METADATA', 'GSI2_PK': 'GUEST_LIST', 'GSI2_SK': 'USER#g1',
     'summary': {'uuid': 'g1', 'username': 'guest1', 'guest_expires_at': 9_999_999_999_000}},
    {'PK': 'USER#g2', 'SK': 'METADATA', 'GSI2_PK': 'GUEST_LIST', 'GSI2_SK': 'USER#g2',
     'summary': {'uuid': 'g2', 'username': 'guest2', 'guest_expires_at': 1}},  # expired
]
STALE = [{'PK': 'USER#g-1', 'SK': 'METADATA',
          'summary': {'uuid': 'g-1', 'username': 'old', 'ts_last_access': 1}}]
STALE_MATCHES = [{'PK': 'MATCH#m-1', 'SK': 'METADATA', 'uuid': 'm-1', 'userCreatorUuid': 'g-1'},
                 # somebody else's match on the same partition: never counted, never deleted
                 {'PK': 'MATCH#m-2', 'SK': 'METADATA', 'uuid': 'm-2', 'userCreatorUuid': 'alive'}]


def _guest_index(guests=None, matches=None):
    """A query_gsi stand-in answering the GUEST_LIST and the MATCH "by type" partitions —
    v0.38.0 reads every match once and filters by creator, no USER_MATCHES# query per guest."""
    def query(index, pk, sk_prefix=None):
        if index == 'GSI2' and pk == 'GUEST_LIST':
            return list(guests or [])
        if index == 'GSI2' and pk == 'MATCH':
            return list(matches or [])
        raise AssertionError(f'unexpected index read {index} {pk}')
    return query


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
         patch('auth.handler.db_utils.query_index_page', return_value=(GUESTS, None)) as page:
        result = _call(admin_event('GET', '/api/admin/guests'))
    assert result['statusCode'] == 200
    body = _body(result)
    assert len(body['items']) == 2
    assert body['limit'] == 50
    assert {i['username'] for i in body['items']} == {'guest1', 'guest2'}
    assert page.call_args.args[:3] == ('GSI2', 'GSI2_PK', 'GUEST_LIST')


def test_list_guests_is_one_index_page_not_the_whole_table():
    """v0.37.5 — one Query page of GSI2 (GUEST_LIST); the page carries the cursor on."""
    seen = {}

    def _page(index, pk_name, pk_val, limit=None, start_key=None, ascending=False, **_k):
        seen['limit'] = limit
        return GUESTS[:1], {'PK': 'USER#g-2'}

    with patch('auth.handler.db_utils.get_item', return_value=ADMIN_USER), \
         patch('auth.handler.db_utils.query_index_page', side_effect=_page):
        result = _call(admin_event('GET', '/api/admin/guests', qs={'limit': '1'}))
    body = _body(result)
    assert seen['limit'] == 1
    assert body['nextCursor'] is not None

    # The cursor round-trips: the next request resumes exactly where this page stopped.
    with patch('auth.handler.db_utils.get_item', return_value=ADMIN_USER), \
         patch('auth.handler.db_utils.query_index_page', return_value=([], None)) as nxt:
        _call(admin_event('GET', '/api/admin/guests', qs={'cursor': body['nextCursor']}))
    assert nxt.call_args.kwargs['start_key'] == {'PK': 'USER#g-2'}


def test_stale_guests_refuses_without_a_bound():
    """Without olderThanDays the purge would take EVERY guest: refuse, never guess."""
    with patch('auth.handler.db_utils.get_item', return_value=ADMIN_USER):
        result = _call(admin_event('DELETE', '/api/admin/guests/stale'))
    assert result['statusCode'] == 400
    assert _body(result)['error'] == 'INVALID_INPUT'


def test_delete_stale_guests_takes_their_matches_first():
    deleted = []
    with patch('auth.handler.db_utils.get_item', return_value=ADMIN_USER), \
         patch('auth.handler.db_utils.query_gsi', side_effect=_guest_index(STALE, STALE_MATCHES)), \
         patch('auth.handler.db_utils.delete_all_by_pk',
               side_effect=lambda pk: (deleted.append(pk), 1)[1]), \
         patch('auth.handler.db_utils.delete_item',
               side_effect=lambda pk, sk=None, consistent=True: deleted.append(pk)):
        result = _call(admin_event('DELETE', '/api/admin/guests/stale', qs={'olderThanDays': '1'}))
    body = _body(result)
    assert body == {'guests': 1, 'matches': 1, 'status': 'CLEANUP_COMPLETE'}
    # The match goes before its creator, as the SQL backends' foreign key requires.
    assert deleted == ['MATCH#m-1', 'USER#g-1']


def test_guest_stats_counts_expired():
    with patch('auth.handler.db_utils.get_item', return_value=ADMIN_USER), \
         patch('auth.handler.db_utils.query_gsi', side_effect=_guest_index(GUESTS)):
        result = _call(admin_event('GET', '/api/admin/guests/stats'))
    body = _body(result)
    assert body['totalGuests'] == 2
    assert body['expiredGuests'] == 1
    assert body['activeGuests'] == 1


def test_cleanup_expired_deletes_expired_guests():
    deleted = []
    with patch('auth.handler.db_utils.get_item', return_value=ADMIN_USER), \
         patch('auth.handler.db_utils.query_gsi', side_effect=_guest_index(GUESTS)), \
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


# ── GET /api/admin/guests/stale — the dry run before the purge ───────────────

def test_preview_stale_guests_refuses_without_a_bound():
    with patch('auth.handler.db_utils.get_item', return_value=ADMIN_USER):
        result = _call(admin_event('GET', '/api/admin/guests/stale'))
    assert result['statusCode'] == 400
    assert _body(result)['error'] == 'INVALID_INPUT'


def test_preview_stale_guests_refuses_a_negative_bound():
    with patch('auth.handler.db_utils.get_item', return_value=ADMIN_USER):
        result = _call(admin_event('GET', '/api/admin/guests/stale', qs={'olderThanDays': '-1'}))
    assert result['statusCode'] == 400


def test_preview_stale_guests_counts_without_deleting():
    with patch('auth.handler.db_utils.get_item', return_value=ADMIN_USER), \
         patch('auth.handler.db_utils.query_gsi', side_effect=_guest_index(STALE, STALE_MATCHES)), \
         patch('auth.handler.db_utils.delete_item') as deleter:
        result = _call(admin_event('GET', '/api/admin/guests/stale', qs={'olderThanDays': '1'}))
    assert _body(result) == {'guests': 1, 'matches': 1}
    deleter.assert_not_called()


def test_the_stale_matches_are_read_in_one_index_query_whatever_the_number_of_guests():
    """v0.38.0 — the preview timed out on a table of a few hundred guests: one GSI1 query
    per guest. Now the MATCH partition is read once and filtered by creator."""
    many = [{'PK': f'USER#g-{i}', 'SK': 'METADATA',
             'summary': {'uuid': f'g-{i}', 'username': f'old{i}', 'ts_last_access': 1}}
            for i in range(300)]
    matches = [{'PK': f'MATCH#m-{i}', 'SK': 'METADATA', 'uuid': f'm-{i}', 'userCreatorUuid': f'g-{i}'}
               for i in range(0, 300, 2)]
    with patch('auth.handler.db_utils.get_item', return_value=ADMIN_USER), \
         patch('auth.handler.db_utils.query_gsi', side_effect=_guest_index(many, matches)) as reads:
        result = _call(admin_event('GET', '/api/admin/guests/stale', qs={'olderThanDays': '1'}))
    assert _body(result) == {'guests': 300, 'matches': 150}
    # the guest list, then the match partition: two reads, not three hundred and one
    assert reads.call_count == 2


def test_preview_stale_guests_with_nobody_to_purge():
    with patch('auth.handler.db_utils.get_item', return_value=ADMIN_USER), \
         patch('auth.handler.db_utils.query_gsi', side_effect=_guest_index([])) as reads:
        result = _call(admin_event('GET', '/api/admin/guests/stale', qs={'olderThanDays': '1'}))
    assert _body(result) == {'guests': 0, 'matches': 0}
    # No guest, no match lookup: only the guest list itself was read.
    assert reads.call_count == 1


def test_nzms_falls_back_to_zero_on_a_value_that_is_not_a_number():
    from auth.handler import _nzms
    assert _nzms(None) == 0
    assert _nzms('12') == 12
    assert _nzms('not-a-number') == 0


def test_stale_guest_routes_require_admin():
    for method in ('GET', 'DELETE'):
        with patch('auth.handler.db_utils.get_item', return_value={**ADMIN_USER, 'role': 'PLAYER'}):
            result = _call(admin_event(method, '/api/admin/guests/stale',
                                       qs={'olderThanDays': '1'}))
        assert result['statusCode'] == 403


def test_a_cursor_that_is_not_base64_json_starts_from_the_beginning():
    with patch('auth.handler.db_utils.get_item', return_value=ADMIN_USER), \
         patch('auth.handler.db_utils.query_index_page', return_value=([], None)) as page:
        result = _call(admin_event('GET', '/api/admin/guests', qs={'cursor': 'not-a-cursor'}))
    assert result['statusCode'] == 200
    assert page.call_args.kwargs['start_key'] is None
