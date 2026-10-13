"""v1.1.0 — V1 step 1: the in-process match creation through the REAL match.handler on a FakeTable:
201 without a Turnstile secret, CSRF honoured, sourceIp 42.42.42.42 used by the per-IP limit."""
import json
from datetime import datetime, timezone
from unittest.mock import patch

import pytest

import helpers
from common import security_utils
from match import handler as h
from smoke import inprocess

TOKEN = 'MOCK_ACCESS_player-uuid-001'
USER = {'PK': 'USER#player-uuid-001', 'SK': 'METADATA', 'uuid': 'player-uuid-001', 'username': 'guest_x',
        'role': 'PLAYER', 'state': 6}
STORY = {
    'PK': 'STORY#story-uuid-1', 'SK': 'METADATA', 'uuid': 'story-uuid-1', 'idLocationStart': 1,
    'difficulties': [{'uuid': 'diff-uuid-1', 'expCost': 5}],
    'locations': [{'id': 1, 'uuid': 'loc-1', 'counterTime': 0}, {'id': 2, 'uuid': 'loc-2', 'counterTime': 0}],
    'characterTemplates': [{'uuid': 'ct', 'id_tipo': 1}],
    'classes': [{'id': 30, 'uuid': 'cl'}],
    'traits': [],
}
BODY = {'storyUuid': 'story-uuid-1', 'difficultyUuid': 'diff-uuid-1', 'name': 'smoketest-20261013-0442',
        'characterTemplateUuid': 'ct', 'classUuid': 'cl', 'traitUuids': [], 'singlePlayer': 1}


@pytest.fixture
def table():
    fake = helpers.FakeTable([USER, STORY])
    with helpers.patch_table(fake), \
         patch('match.handler.db_utils.query_gsi', return_value=[]), \
         patch.object(h.jwt_utils, 'ALLOW_MOCK_ACCESS', True), \
         patch.object(h, '_TURNSTILE_SECRET', ''):
        yield fake


def test_synthetic_event_has_the_http_api_v2_shape():
    event = inprocess.build_event('tok', 'csrf', BODY, 'PathsGamesSmokeTest/1.0.0')
    assert (event['version'], event['routeKey'], event['rawPath']) == ('2.0', 'POST /api/matches', '/api/matches')
    assert event['headers'] == {'authorization': 'Bearer tok', 'x-csrf-token': 'csrf',
                                'content-type': 'application/json', 'user-agent': 'PathsGamesSmokeTest/1.0.0'}
    assert event['requestContext']['http'] == {'method': 'POST', 'path': '/api/matches', 'sourceIp': '42.42.42.42'}
    assert event['requestContext']['requestId'].startswith('smoke-')
    assert json.loads(event['body']) == BODY
    assert inprocess.build_event('tok', None, {}, 'ua')['headers']['x-csrf-token'] == ''


def test_match_name_never_starts_with_robottest():
    assert inprocess.match_name(datetime(2026, 10, 13, 4, 42, tzinfo=timezone.utc)) == 'smoketest-20261013-0442'
    assert inprocess.match_name().startswith('smoketest-')


def test_created_with_no_turnstile_secret(table):
    status, body = inprocess.create_match(TOKEN, None, BODY, 'ua')
    assert status == 201
    assert body['status'] == 'CREATED' and body['userCreatorUuid'] == 'player-uuid-001'
    saved = table.get_item(f"MATCH#{body['uuid']}")
    assert saved['name'] == 'smoketest-20261013-0442'
    assert (saved['characterTemplateUuid'], saved['classUuid']) == ('ct', 'cl')
    assert 'ttl' not in saved


def test_a_turnstile_secret_would_refuse_it(table):
    with patch.object(h, '_TURNSTILE_SECRET', 'real-secret'):
        status, body = inprocess.create_match(TOKEN, None, BODY, 'ua')
    assert (status, body['error']) == (400, 'TURNSTILE_VALIDATION_FAILED')


def test_csrf_header_is_honoured(table, monkeypatch):
    monkeypatch.setenv('CSRF_ENFORCED', 'true')
    assert inprocess.create_match(TOKEN, None, BODY, 'ua')[1]['error'] == 'CSRF_TOKEN_MISSING'
    assert inprocess.create_match(TOKEN, 'wrong', BODY, 'ua')[1]['error'] == 'CSRF_TOKEN_INVALID'
    status, _ = inprocess.create_match(TOKEN, security_utils.csrf_token_for(TOKEN), BODY, 'ua')
    assert status == 201


def test_source_ip_feeds_the_per_ip_limit(table, monkeypatch):
    monkeypatch.setenv('RATE_LIMIT_MATCH_PER_IP', '3')
    seen = []

    def fake_limit(bucket, ip, limit, now=None, window=None):
        seen.append((bucket, ip, limit))
        return security_utils.Verdict(True, limit, limit - 1, 0)

    with patch.object(security_utils, 'rate_limit', side_effect=fake_limit):
        assert inprocess.create_match(TOKEN, None, BODY, 'ua')[0] == 201
    assert ('match', '42.42.42.42', 3) in seen


def test_non_json_answer_parses_to_none():
    with patch.object(h, 'lambda_handler', return_value={'statusCode': 502, 'body': 'oops'}):
        assert inprocess.create_match('t', 'c', {}, 'ua') == (502, None)
    with patch.object(h, 'lambda_handler', return_value=None):
        assert inprocess.create_match('t', 'c', {}, 'ua') == (None, None)
