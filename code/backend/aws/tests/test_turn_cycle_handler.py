"""Unit tests for the Step 24 turn cycle routes in ``lambda/match/handler.py``.

A tiny in-memory DynamoDB single-table store backs ``db_utils`` so the
start -> pass -> turn-sequence flow runs end-to-end without AWS.
"""
import json
from contextlib import contextmanager
from unittest.mock import patch

import pytest

from match import handler as h
from helpers import make_event


def _body(result):
    return json.loads(result['body'])


PLAYER = {
    'PK': 'USER#player-uuid-001', 'SK': 'METADATA',
    'uuid': 'player-uuid-001', 'username': 'player', 'role': 'PLAYER', 'state': 2,
}
OTHER = {
    'PK': 'USER#other-uuid-002', 'SK': 'METADATA',
    'uuid': 'other-uuid-002', 'username': 'other', 'role': 'PLAYER', 'state': 2,
}


def _match(uuid='m1', status='CREATED', owner='player-uuid-001'):
    return {
        'PK': f'MATCH#{uuid}', 'SK': 'METADATA', 'uuid': uuid,
        'status': status, 'currentClock': 0, 'userCreatorUuid': owner,
        'storyUuid': 's1', 'tsInsert': 1,
    }


def _char(match_uuid, cid, uuid, owner='player-uuid-001', dex=3, life=10):
    return {
        'PK': f'MATCH#{match_uuid}', 'SK': f'CHARACTER#{uuid}',
        'id': cid, 'uuid': uuid, 'userUuid': owner,
        'dexterity': dex, 'intelligence': 3, 'constitution': 3, 'life': life,
    }


class FakeTable:
    def __init__(self, items):
        self.store = {(i['PK'], i.get('SK', 'METADATA')): dict(i) for i in items}

    def get_item(self, pk, sk='METADATA'):
        it = self.store.get((pk, sk))
        return dict(it) if it else None

    def put_item(self, item):
        self.store[(item['PK'], item.get('SK', 'METADATA'))] = dict(item)

    def query_by_pk(self, pk):
        return [dict(v) for (p, _), v in self.store.items() if p == pk]


@contextmanager
def _env(items):
    table = FakeTable(items)
    with patch('match.handler.jwt_utils.verify_access_token',
               return_value={'uuid': 'player-uuid-001'}) as mock_jwt, \
         patch('match.handler.db_utils.get_item', side_effect=table.get_item), \
         patch('match.handler.db_utils.put_item', side_effect=table.put_item), \
         patch('match.handler.db_utils.query_by_pk', side_effect=table.query_by_pk):
        yield table, mock_jwt


def _event(method, path, uuid_match='m1', extra_params=None):
    params = {'uuidMatch': uuid_match}
    if extra_params:
        params.update(extra_params)
    return make_event(method, path,
                      headers={'Authorization': 'Bearer MOCK_ACCESS_player-uuid-001'},
                      path_params=params)


# ── start ────────────────────────────────────────────────────────────────────

def test_start_match_transitions_to_running():
    items = [PLAYER, _match(), _char('m1', 1, 'c1', dex=9), _char('m1', 2, 'c2', dex=1)]
    with _env(items) as (table, _):
        result = h.lambda_handler(_event('POST', '/api/matches/m1/start'), None)
    assert result['statusCode'] == 200
    body = _body(result)
    assert body['status'] == 'RUNNING'
    assert body['activeCharacterUuid'] == 'c1'  # higher dexterity
    actives = [e for e in body['queue'] if e['status'] == 'ACTIVE']
    assert len(actives) == 1


def test_start_match_queue_ordered_by_priority_desc():
    items = [PLAYER, _match(),
             _char('m1', 1, 'c1', dex=1), _char('m1', 2, 'c2', dex=9), _char('m1', 3, 'c3', dex=5)]
    with _env(items):
        body = _body(h.lambda_handler(_event('POST', '/api/matches/m1/start'), None))
    priorities = [e['priority'] for e in body['queue']]
    assert priorities == sorted(priorities, reverse=True)


def test_start_already_running_returns_409():
    items = [PLAYER, _match(status='RUNNING'), _char('m1', 1, 'c1')]
    with _env(items):
        result = h.lambda_handler(_event('POST', '/api/matches/m1/start'), None)
    assert result['statusCode'] == 409
    assert _body(result)['error'] == 'MATCH_NOT_STARTABLE'


def test_start_without_characters_returns_409():
    items = [PLAYER, _match()]
    with _env(items):
        result = h.lambda_handler(_event('POST', '/api/matches/m1/start'), None)
    assert result['statusCode'] == 409
    assert _body(result)['error'] == 'NO_CHARACTERS_JOINED'


def test_start_unknown_match_returns_404():
    items = [PLAYER]
    with _env(items):
        result = h.lambda_handler(_event('POST', '/api/matches/nope/start', uuid_match='nope'), None)
    assert result['statusCode'] == 404
    assert _body(result)['error'] == 'MATCH_NOT_FOUND'


def test_start_not_owner_returns_404():
    items = [PLAYER, _match(owner='other-uuid-002'), _char('m1', 1, 'c1')]
    with _env(items):
        result = h.lambda_handler(_event('POST', '/api/matches/m1/start'), None)
    assert result['statusCode'] == 404
    assert _body(result)['error'] == 'MATCH_NOT_FOUND'


# ── pass ─────────────────────────────────────────────────────────────────────

def test_pass_turn_advances_cycle():
    items = [PLAYER, _match(), _char('m1', 1, 'c1', dex=9), _char('m1', 2, 'c2', dex=1)]
    with _env(items):
        h.lambda_handler(_event('POST', '/api/matches/m1/start'), None)
        result = h.lambda_handler(_event('POST', '/api/gameplay/m1/action/pass'), None)
    assert result['statusCode'] == 200
    body = _body(result)
    assert body['status'] == 'RUNNING'
    assert body['passedCharacterUuid'] == 'c1'
    assert body['nextActiveCharacterUuid'] == 'c2'


def test_pass_turn_increments_pass_counter():
    items = [PLAYER, _match(), _char('m1', 1, 'c1', dex=9), _char('m1', 2, 'c2', dex=1)]
    with _env(items):
        h.lambda_handler(_event('POST', '/api/matches/m1/start'), None)
        h.lambda_handler(_event('POST', '/api/gameplay/m1/action/pass'), None)
        seq = _body(h.lambda_handler(_event('GET', '/api/match/m1/turn-sequence'), None))
    assert max(e['passCounter'] for e in seq['queue']) >= 1


def test_pass_single_character_new_round_reactivates():
    items = [PLAYER, _match(), _char('m1', 1, 'c1')]
    with _env(items):
        h.lambda_handler(_event('POST', '/api/matches/m1/start'), None)
        body = _body(h.lambda_handler(_event('POST', '/api/gameplay/m1/action/pass'), None))
    assert body['nextActiveCharacterUuid'] == 'c1'


def test_pass_on_non_running_returns_409():
    items = [PLAYER, _match(), _char('m1', 1, 'c1')]
    with _env(items):
        result = h.lambda_handler(_event('POST', '/api/gameplay/m1/action/pass'), None)
    assert result['statusCode'] == 409
    assert _body(result)['error'] == 'MATCH_NOT_RUNNING'


# ── turn-sequence ──────────────────────────────────────────────────────────────

def test_turn_sequence_returns_queue():
    items = [PLAYER, _match(), _char('m1', 1, 'c1'), _char('m1', 2, 'c2')]
    with _env(items):
        h.lambda_handler(_event('POST', '/api/matches/m1/start'), None)
        result = h.lambda_handler(_event('GET', '/api/match/m1/turn-sequence'), None)
    assert result['statusCode'] == 200
    body = _body(result)
    assert body['status'] == 'RUNNING'
    assert len(body['queue']) == 2
    entry = body['queue'][0]
    for key in ('characterUuid', 'priority', 'status', 'passCounter'):
        assert key in entry


def test_turn_sequence_without_token_returns_401():
    items = [PLAYER, _match()]
    with _env(items):
        ev = make_event('GET', '/api/match/m1/turn-sequence', path_params={'uuidMatch': 'm1'})
        result = h.lambda_handler(ev, None)
    assert result['statusCode'] == 401
