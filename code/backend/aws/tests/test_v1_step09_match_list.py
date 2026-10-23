"""v1.7.0 step 9 on AWS: tsUpdate (ISO) in the match summary, list order and envelope, merge rule."""
import json
from unittest.mock import patch

from helpers import make_event
from common import match_summary, sso

PLAYER = {'PK': 'USER#player-uuid-001', 'SK': 'METADATA', 'uuid': 'player-uuid-001', 'username': 'player',
          'role': 'PLAYER', 'state': 2}


def _row(uuid, status, ts_update=None, ts_insert=1):
    # a GSI1 row: the summary map plus the projected live fields
    row = {'PK': f'MATCH#{uuid}', 'summary': {'uuid': uuid, 'status': status, 'storyUuid': 's', 'tsInsert': ts_insert},
           'currentClock': 0}
    if ts_update is not None:
        row['ts_update'] = ts_update
    return row


def _list(rows, qs=None):
    from match.handler import lambda_handler
    event = make_event('GET', '/api/matches', headers={'Authorization': 'Bearer MOCK_ACCESS_player-uuid-001'}, qs=qs)
    with patch('match.handler.jwt_utils.verify_access_token', return_value={'uuid': 'player-uuid-001'}), \
            patch('match.handler.db_utils.get_item', return_value=PLAYER), \
            patch('match.handler.db_utils.query_gsi', return_value=rows):
        result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    return json.loads(result['body'])


# ── tsUpdate ────────────────────────────────────────────────────────────────

def test_iso_ms_is_the_java_instant_form():
    assert match_summary.iso_ms(1_761_127_200_000) == '2025-10-22T10:00:00Z'
    assert match_summary.iso_ms(1_761_127_200_123) == '2025-10-22T10:00:00.123Z'
    assert match_summary.iso_ms('1761127200000') == '2025-10-22T10:00:00Z'
    assert match_summary.iso_ms(None) is None and match_summary.iso_ms('x') is None
    assert match_summary.iso_ms(True) is None


def test_the_list_answers_ts_update_as_iso_and_it_moves_with_a_write():
    row = _row('m1', 'RUNNING', 1_761_127_200_000)
    assert _list([row])['items'][0]['tsUpdate'] == '2025-10-22T10:00:00Z'
    row['ts_update'] = 1_761_127_500_001
    item = _list([row])['items'][0]
    assert item['tsUpdate'] == '2025-10-22T10:05:00.001Z' and item['matchVersion'] == '1761127500001'
    assert _list([_row('m2', 'RUNNING')])['items'][0]['tsUpdate'] is None


# ── order and envelope ──────────────────────────────────────────────────────

def test_active_first_then_last_played():
    body = _list([_row('cancelled', 'CANCELLED', 900), _row('running-old', 'RUNNING', 100),
                  _row('ended', 'ENDED', 800), _row('paused', 'PAUSED', 500), _row('created', 'CREATED', 300)])
    assert [m['uuid'] for m in body['items']] == ['paused', 'created', 'running-old', 'cancelled', 'ended']
    assert body['nextCursor'] is None and body['limit'] == 50


def test_missing_ts_update_falls_back_on_ts_insert_then_uuid():
    ordered = match_summary.sort_for_list([_row('b', 'RUNNING', None, 10), _row('a', 'RUNNING', 'x', 20),
                                           {'status': 'RUNNING'}, _row('c', 'RUNNING', None, 0)])
    assert [m.get('uuid') for m in ordered] == ['a', 'b', None, 'c']
    assert match_summary.sort_for_list(None) == []


def test_next_cursor_is_null_up_to_fifty_then_a_position():
    fifty = [_row(f'm{i:02d}', 'ENDED', 1000 + i) for i in range(50)]
    assert _list(fifty)['nextCursor'] is None
    many = fifty + [_row('m50', 'ENDED', 1)]
    first = _list(many)
    assert len(first['items']) == 50 and first['nextCursor'] == '50'
    second = _list(many, {'cursor': first['nextCursor']})
    assert [m['uuid'] for m in second['items']] == ['m50'] and second['nextCursor'] is None
    small = _list(many, {'limit': '2', 'cursor': '2'})
    assert small['limit'] == 2 and small['nextCursor'] == '4'


def test_limit_and_cursor_are_clamped():
    assert match_summary.list_limit(None) == 50 and match_summary.list_limit(' ') == 50
    assert match_summary.list_limit('x') == 50 and match_summary.list_limit('0') == 1
    assert match_summary.list_limit(500) == 200
    assert match_summary.list_offset(None) == 0 and match_summary.list_offset('abc') == 0
    assert match_summary.list_offset('-4') == 0 and match_summary.list_offset(' 7 ') == 7
    assert match_summary.page([_row('a', 'ENDED')], 10, '999') == ([], None, 10)


# ── merge rule ──────────────────────────────────────────────────────────────

def _m(uuid, story, status, ts=None):
    return {'uuid': uuid, 'storyUuid': story, 'status': status, 'ts_update': ts}


def _uuids(cancel):
    return [m['uuid'] for m in cancel]


def test_a_newer_guest_match_still_loses():
    assert _uuids(sso.matches_to_cancel([_m('t', 's', 'CREATED', 1)], [_m('g', 's', 'RUNNING', 999)])) == ['g']


def test_no_google_match_keeps_the_guest_match():
    assert sso.matches_to_cancel([], [_m('g', 's', 'RUNNING')]) == []
    assert sso.matches_to_cancel(None, [_m('g', 's', 'RUNNING')]) == []


def test_different_stories_and_ended_matches_are_kept():
    assert sso.matches_to_cancel([_m('t', 's1', 'RUNNING')], [_m('g', 's2', 'RUNNING')]) == []
    assert sso.matches_to_cancel([_m('t', 's', 'ENDED'), _m('c', 's', 'CANCELLED')], [_m('g', 's', 'PAUSED')]) == []
    assert sso.matches_to_cancel([_m('t', 's', 'RUNNING')], [_m('e', 's', 'ENDED'), _m('o', 's', 'GAMEOVER')]) == []


def test_inside_one_side_the_latest_stays():
    cancel = sso.matches_to_cancel([], [_m('a', 's', 'RUNNING', 1), _m('b', 's', 'CREATED', 1),
                                        _m('x', 'z', 'RUNNING', 9), _m('y', 'z', 'RUNNING', 2)])
    assert _uuids(cancel) == ['a', 'y']
    both = sso.matches_to_cancel([_m('t1', 's', 'RUNNING', 1), _m('t2', 's', 'PAUSED', 3)], [_m('g', 's', 'RUNNING', 5)])
    assert _uuids(both) == ['t1', 'g']
