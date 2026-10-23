"""V1 step 8 (1.7.0) on AWS: If-Match, the conditional claim as first write, the chunked TransactWriteItems
flush, 409 STALE_MATCH, matchVersion in the answers, the echo parameters and the CORS header."""
import json
import logging
import os
from contextlib import contextmanager
from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import ClientError

import helpers
from helpers import FakeTable, make_event, patch_table
from common import db_utils
from echo import handler as echo
from match import handler as h
from match import repo

PLAYER = {'PK': 'USER#player-uuid-001', 'SK': 'METADATA', 'uuid': 'player-uuid-001', 'username': 'player',
          'role': 'PLAYER', 'state': 2}
V0 = 1_000_000


def _match(status='CREATED', ts=V0):
    return {'PK': 'MATCH#m1', 'SK': 'METADATA', 'uuid': 'm1', 'status': status, 'currentClock': 0,
            'userCreatorUuid': 'player-uuid-001', 'storyUuid': 's1', 'tsInsert': 1, 'ts_update': ts}


def _char(cid, uuid, dex=3):
    return {'PK': 'MATCH#m1', 'SK': f'CHARACTER#{uuid}', 'id': cid, 'uuid': uuid, 'userUuid': 'player-uuid-001',
            'dexterity': dex, 'intelligence': 3, 'constitution': 3, 'life': 10}


@contextmanager
def _env(items):
    table = FakeTable(items)
    with patch('match.handler.jwt_utils.verify_access_token', return_value={'uuid': 'player-uuid-001'}), \
            patch_table(table):
        yield table


def _event(method, path, if_match=None):
    headers = {'Authorization': 'Bearer MOCK_ACCESS_player-uuid-001'}
    if if_match is not None:
        headers['If-Match'] = if_match
    return make_event(method, path, headers=headers, path_params={'uuidMatch': 'm1'})


def _body(result):
    return json.loads(result['body'])


def _ts(table):
    return int(table.store[('MATCH#m1', 'METADATA')]['ts_update'])


# ── db_utils ─────────────────────────────────────────────────────────────────

def _client_error(code):
    return ClientError({'Error': {'Code': code, 'Message': code}}, 'op')


def test_claim_version_is_a_conditional_update():
    table = MagicMock()
    with patch.object(db_utils, '_table', table):
        assert helpers.REAL_CLAIM('MATCH#m1', 5, 9, 4) is True
        kwargs = table.update_item.call_args.kwargs
        assert kwargs['ConditionExpression'] == 'attribute_exists(PK) AND #ts = :old'
        assert kwargs['ExpressionAttributeValues'] == {':new': 9, ':d': 4, ':old': 5}
        assert helpers.REAL_CLAIM('MATCH#m1', None, 9) is True
        assert 'attribute_not_exists(#ts)' in table.update_item.call_args.kwargs['ConditionExpression']
        table.update_item.side_effect = _client_error('ConditionalCheckFailedException')
        assert helpers.REAL_CLAIM('MATCH#m1', 5, 9) is False
        table.update_item.side_effect = _client_error('ProvisionedThroughputExceededException')
        with pytest.raises(ClientError):
            helpers.REAL_CLAIM('MATCH#m1', 5, 9)


def test_chunks_respect_100_items_and_4_mb():
    small = [{'PK': 'P', 'SK': f'S{i}'} for i in range(250)]
    assert [len(c) for c in db_utils.transact_chunks(small)] == [100, 100, 50]
    big = [{'PK': 'P', 'SK': f'B{i}', 'blob': 'x' * 1_500_000} for i in range(5)]
    assert [len(c) for c in db_utils.transact_chunks(big)] == [2, 2, 1]
    assert db_utils.transact_chunks([]) == []


def _fake_table():
    table = MagicMock()
    table.name = 'T'
    return table


def test_transact_put_items_stamps_conditions_and_retries():
    table, sleeps = _fake_table(), []
    calls = table.meta.client.transact_write_items
    calls.side_effect = [_client_error('TransactionCanceledException'), None, None]
    items = [{'PK': 'MATCH#m1', 'SK': 'METADATA', 'n': 1.5}] + [{'PK': 'MATCH#m1', 'SK': f'LOG#{i}'} for i in range(100)]
    db_utils.set_request_stamp(42)
    try:
        with patch.object(db_utils, '_table', table):
            assert helpers.REAL_TRANSACT_PUT(items, {('MATCH#m1', 'METADATA'): 42}, sleep=sleeps.append) is True
    finally:
        db_utils.set_request_stamp(None)
    assert calls.call_count == 3 and sleeps == [db_utils.TRANSACT_BACKOFF_SECONDS]
    first = calls.call_args_list[1].kwargs['TransactItems']
    assert len(first) == 100 and first[0]['Put']['ConditionExpression'] == '#ts = :ts'
    assert first[0]['Put']['Item']['ts_update'] == {'N': '42'} and 'ConditionExpression' not in first[1]['Put']
    assert len(calls.call_args_list[2].kwargs['TransactItems']) == 1
    assert helpers.REAL_TRANSACT_PUT([]) is True


def test_a_chunk_that_keeps_failing_raises():
    table, sleeps = _fake_table(), []
    table.meta.client.transact_write_items.side_effect = _client_error('InternalServerError')
    with patch.object(db_utils, '_table', table):
        with pytest.raises(db_utils.TransactWriteFailed) as err:
            helpers.REAL_TRANSACT_PUT([{'PK': 'MATCH#m1', 'SK': 'METADATA'}], sleep=sleeps.append)
    assert err.value.chunk == 0 and err.value.attempts == db_utils.TRANSACT_ATTEMPTS and len(sleeps) == 2


# ── repo ─────────────────────────────────────────────────────────────────────

@pytest.fixture
def store():
    table = FakeTable([_match('RUNNING')])
    with patch_table(table, module='match.repo'):
        yield table
    repo.abandon()


def test_the_claim_moves_the_version_and_the_flush_writes_metadata_first(store):
    repo.begin()
    db_utils.set_request_stamp(V0 + 7_000)
    meta = repo.match('m1')
    repo.save({**_char(1, 'c1'), 'life': 9})
    assert repo.loaded_version('m1') == str(V0)
    assert repo.claim('m1', 300_000) == str(V0 + 7_000)
    assert meta['playMs'] == 7_000
    with patch.object(db_utils, 'transact_put_items', wraps=store.transact_put_items) as tx:
        repo.flush()
    items, conditions = tx.call_args.args
    assert items[0]['SK'] == 'METADATA' and conditions == {('MATCH#m1', 'METADATA'): V0 + 7_000}
    assert _ts(store) == V0 + 7_000 and store.store[('MATCH#m1', 'CHARACTER#c1')]['life'] == 9


def test_a_clock_tie_moves_the_version_by_one(store):
    repo.begin()
    db_utils.set_request_stamp(V0 - 5)
    assert repo.claim('m1', 300_000) == str(V0 + 1)
    assert db_utils.stamp_ms() == V0 + 1


def test_a_stale_expected_version_or_a_lost_race_is_refused(store):
    repo.begin()
    with pytest.raises(repo.StaleMatch) as err:
        repo.claim('m1', 300_000, expected='123')
    assert err.value.current_version == str(V0)
    repo.abandon()
    repo.begin()
    repo.match('m1')
    store.store[('MATCH#m1', 'METADATA')]['ts_update'] = V0 + 50  # another device won meanwhile
    with pytest.raises(repo.StaleMatch) as err:
        repo.claim('m1', 300_000)
    assert err.value.current_version == str(V0 + 50) and err.value.match_uuid == 'm1'


def test_a_failed_chunk_is_a_write_failure(store):
    repo.begin()
    repo.claim('m1', 300_000)
    store.store[('MATCH#m1', 'METADATA')]['ts_update'] = 1  # the condition of the first chunk fails
    with pytest.raises(repo.WriteFailed) as err:
        repo.flush()
    assert err.value.match_uuid == 'm1'


def test_abandon_writes_nothing_and_unknown_matches_claim_nothing(store):
    repo.begin()
    repo.save({**_char(1, 'c1'), 'life': 1})
    repo.abandon()
    assert ('MATCH#m1', 'CHARACTER#c1') not in store.store and repo.pending() == 0
    repo.begin()
    assert repo.claim('nope', 1) is None and repo.loaded_version('nope') is None


# ── handler ──────────────────────────────────────────────────────────────────

@pytest.mark.parametrize('raw, expected', [
    (None, None), ('', None), ('*', None), ('"v1"', 'v1'), ('W/"v1"', 'v1'), (' v2 ', 'v2'), ('"', '"')])
def test_if_match_header(raw, expected):
    headers = {} if raw is None else {'IF-MATCH': raw}
    assert h._if_match({'headers': headers}) == expected
    assert h._if_match({}) is None


@pytest.mark.parametrize('response, wins', [
    ({'statusCode': 200, 'body': '{}'}, True),
    ({'statusCode': 409, 'body': json.dumps({'error': 'NOT_YOUR_TURN'})}, True),
    ({'statusCode': 409, 'body': json.dumps({'error': 'MATCH_NOT_RUNNING'})}, False),
    ({'statusCode': 409, 'body': json.dumps({'error': 'MATCH_NOT_STARTABLE'})}, False),
    ({'statusCode': 404, 'body': '{}'}, False), ({'statusCode': 400, 'body': '{}'}, False),
    ({'statusCode': 409, 'body': 'not json'}, True), ({'statusCode': 409, 'body': '[1]'}, True)])
def test_what_a_stale_header_wins_over(response, wins):
    assert h._stale_wins(response) is wins


def test_the_version_flows_from_start_to_pass():
    items = [PLAYER, _match(), _char(1, 'c1', dex=9), _char(2, 'c2', dex=1)]
    with _env(items) as table:
        started = h.lambda_handler(_event('POST', '/api/matches/m1/start', if_match=str(V0)), None)
        version = _body(started)['matchVersion']
        assert started['statusCode'] == 200 and int(version) == _ts(table) > V0
        info = _body(h.lambda_handler(_event('GET', '/api/match/m1/info'), None))
        assert info['match']['matchVersion'] == version
        passed = h.lambda_handler(_event('POST', '/api/gameplay/m1/action/pass', if_match=f'"{version}"'), None)
        assert passed['statusCode'] == 200 and int(_body(passed)['matchVersion']) > int(version)


def test_an_old_version_is_stale_and_writes_nothing():
    items = [PLAYER, _match('RUNNING', ts=V0 + 10), _char(1, 'c1')]
    with _env(items) as table:
        before = {k: dict(v) for k, v in table.store.items()}
        result = h.lambda_handler(_event('POST', '/api/gameplay/m1/action/sleep', if_match=str(V0)), None)
        assert result['statusCode'] == 409
        body = _body(result)
        assert body['error'] == 'STALE_MATCH' and body['matchVersion'] == str(V0 + 10)
        assert table.store == before


def test_the_terminal_state_wins_over_stale():
    items = [PLAYER, _match('ENDED'), _char(1, 'c1')]
    with _env(items):
        result = h.lambda_handler(_event('POST', '/api/gameplay/m1/action/pass', if_match='1'), None)
    assert result['statusCode'] == 409 and _body(result)['error'] == 'MATCH_NOT_RUNNING'


def test_without_the_header_a_lost_race_is_stale():
    items = [PLAYER, _match('RUNNING'), _char(1, 'c1')]
    with _env(items):
        with patch.object(db_utils, 'claim_version', return_value=False):
            result = h.lambda_handler(_event('POST', '/api/gameplay/m1/action/sleep'), None)
    assert result['statusCode'] == 409 and _body(result)['matchVersion'] == str(V0)


def test_without_the_header_a_write_still_claims():
    items = [PLAYER, _match('RUNNING'), _char(1, 'c1')]
    with _env(items) as table:
        result = h.lambda_handler(_event('POST', '/api/gameplay/m1/action/sleep'), None)
        assert result['statusCode'] == 200 and _ts(table) > V0


def test_a_failed_write_answers_500_with_an_error_log(caplog):
    items = [PLAYER, _match('RUNNING'), _char(1, 'c1')]
    with _env(items), caplog.at_level(logging.ERROR, logger='pathsgames.match'):
        with patch.object(db_utils, 'transact_put_items',
                          side_effect=db_utils.TransactWriteFailed(1, 3, 'boom')):
            result = h.lambda_handler(_event('POST', '/api/gameplay/m1/action/sleep'), None)
    assert result['statusCode'] == 500 and _body(result)['error'] == 'WRITE_FAILED'
    assert 'MATCH_WRITE_FAILED match=m1' in caplog.text


def test_a_claim_without_a_json_object_body_keeps_the_answer():
    with patch.object(h._repo, 'claim', return_value='9'):
        raw = {'statusCode': 200, 'body': '[1]'}
        assert h._claim_match({'headers': {}}, 'm1', raw) is raw
        done = {'statusCode': 200, 'body': json.dumps({'matchVersion': 'x'})}
        assert h._claim_match({'headers': {}}, 'm1', done) is done
    with patch.object(h._repo, 'claim', return_value=None):
        plain = {'statusCode': 200, 'body': '{}'}
        assert h._claim_match({'headers': {}}, 'm1', plain) is plain


def test_the_create_answer_carries_the_first_version():
    db_utils.set_request_stamp(777)
    try:
        summary = h._summary_from_item({'uuid': 'm', 'ts_update': 777})
        assert summary['matchVersion'] == '777'
        assert h._summary_from_item({'uuid': 'm'})['matchVersion'] is None
    finally:
        db_utils.set_request_stamp(None)


# ── echo and template ────────────────────────────────────────────────────────

def test_echo_exposes_the_refetch_parameters(monkeypatch):
    body = json.loads(echo.lambda_handler({'rawPath': '/api/echo/status'}, None)['body'])
    assert body['matchRefetchBrowsers'] == ['webkit'] and body['matchRefetchMinHiddenSeconds'] == 30
    monkeypatch.setenv('MATCH_REFETCH_BROWSERS', 'all')
    monkeypatch.setenv('MATCH_REFETCH_MIN_HIDDEN_SECONDS', '45')
    assert echo.match_refetch_browsers() == ['all'] and echo.match_refetch_min_hidden_seconds() == 45
    monkeypatch.setenv('MATCH_REFETCH_MIN_HIDDEN_SECONDS', 'x')
    assert echo.match_refetch_min_hidden_seconds() == 30
    monkeypatch.setenv('MATCH_REFETCH_MIN_HIDDEN_SECONDS', '-1')
    assert echo.match_refetch_min_hidden_seconds() == 30


def _template(name):
    with open(os.path.join(os.path.dirname(__file__), '..', name), encoding='utf-8') as f:
        return f.read()


def test_the_public_api_allows_the_if_match_header():
    assert 'AllowHeaders: [Content-Type, Authorization, Cookie, X-CSRF-TOKEN, If-Match]' in _template('template.yaml')
    root, echo_stack = _template('template.yaml'), _template('template/echo.yaml')
    for name in ('MatchRefetchBrowsers', 'MatchRefetchMinHiddenSeconds'):
        assert f'{name}: !Ref {name}' in root and f'  {name}:' in echo_stack
    assert 'MATCH_REFETCH_BROWSERS: !Ref MatchRefetchBrowsers' in echo_stack
