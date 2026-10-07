"""v0.41.2 Step 41 F — KPI counters on AWS: the per-request accumulator and its ONE UpdateItem ADD,
the hooks (start, end, coma, choice, first visit, missions) and GET /api/admin/reports/kpi."""
import json
from contextlib import contextmanager
from unittest.mock import patch

import pytest
from boto3.dynamodb.conditions import ConditionExpressionBuilder
from botocore.exceptions import ClientError

from common import db_utils
from common import kpi
from match import handler as h
from match import missions
from helpers import make_event, FakeTable, patch_table
from test_step40_alpha_ux import (
    MATCH_UUID, STORY_UUID, LOC_A, PLAYER, _char, _choice_story, _event, _match, _open_cycle_match,
    _post, _story,
)

ADMIN = {'PK': 'USER#admin-uuid-001', 'SK': 'METADATA', 'uuid': 'admin-uuid-001',
         'username': 'admin', 'role': 'ADMIN', 'state': 2}
PLAYER_TOKEN = {'Authorization': 'Bearer player'}
ADMIN_TOKEN = {'Authorization': 'Bearer admin'}
TODAY = kpi.today()


class KpiTable:
    """The two table calls of common/kpi.py, on a dict; anything else answers offline."""

    def __init__(self, fail=False):
        self.items = {}
        self.updates = []
        self.fail = fail

    def update_item(self, Key, UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues):
        if self.fail:
            raise ClientError({'Error': {'Code': 'Boom', 'Message': 'down'}}, 'UpdateItem')
        self.updates.append((Key, UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues))
        item = self.items.setdefault((Key['PK'], Key['SK']), dict(Key))
        for part in UpdateExpression[len('ADD '):].split(', '):
            name, value = part.split(' ')
            attribute = ExpressionAttributeNames[name]
            item[attribute] = item.get(attribute, 0) + ExpressionAttributeValues[value]

    def query(self, KeyConditionExpression, **_kw):
        built = ConditionExpressionBuilder().build_expression(KeyConditionExpression, is_key_condition=True)
        pk, low, high = (built.attribute_value_placeholders[k] for k in sorted(built.attribute_value_placeholders))
        rows = [dict(v) for (p, s), v in sorted(self.items.items()) if p == pk and low <= s <= high]
        return {'Items': rows}

    def __getattr__(self, name):
        def _raise(*_a, **_k):
            raise ClientError({'Error': {'Code': 'Offline', 'Message': name}}, name)
        return _raise


@pytest.fixture
def kpi_table(monkeypatch):
    table = KpiTable()
    monkeypatch.setattr(db_utils, '_get_table', lambda: table)
    kpi.begin()
    yield table
    kpi.begin()


def _claims(token):
    return {'uuid': 'admin-uuid-001' if token == 'admin' else 'player-uuid-001'}


@contextmanager
def _env(items):
    table = FakeTable([PLAYER, ADMIN, *items])
    with patch('match.handler.jwt_utils.verify_access_token', side_effect=_claims), patch_table(table):
        yield table


def _body(result):
    return json.loads(result['body'])


def _counters(kpi_table, story=STORY_UUID, day=TODAY):
    item = dict(kpi_table.items.get((f'KPI#{story}', f'DAY#{day}')) or {})
    item.pop('PK', None)
    item.pop('SK', None)
    return item


# ── the accumulator ──────────────────────────────────────────────────────────

def test_one_request_is_one_update_item_add_per_story_and_day(kpi_table):
    kpi.add('s1', kpi.MATCHES_STARTED)
    kpi.add('s1', kpi.COMA, 2)
    kpi.choice('s1', 'ch-1')
    kpi.location_visit('s1', 'loc-1')
    kpi.mission('s1', 'm-1', 'AVAILABLE', 'ACTIVE')
    kpi.add('s2', kpi.COMA)
    assert kpi.flush() == 2
    assert len(kpi_table.updates) == 2
    key, expression, names, values = kpi_table.updates[0]
    assert key == {'PK': 'KPI#s1', 'SK': f'DAY#{TODAY}'}
    assert expression.startswith('ADD ') and len(names) == 5
    assert _counters(kpi_table, 's1') == {'matchesStarted': 1, 'coma': 2, 'c#ch-1': 1, 'l#loc-1': 1,
                                          'm#m-1#ACTIVE': 1}
    assert kpi.pending() == {} and kpi.flush() == 0


def test_blank_inputs_and_non_transitions_queue_nothing(kpi_table):
    kpi.add(None, kpi.COMA)
    kpi.add('s1', None)
    kpi.add('s1', kpi.COMA, 0)
    kpi.choice('s1', None)
    kpi.location_visit('s1', '')
    kpi.mission('s1', 'm-1', 'ACTIVE', 'ACTIVE')
    kpi.mission('s1', 'm-1', None, 'AVAILABLE')
    kpi.mission('s1', None, None, 'ACTIVE')
    assert kpi.pending() == {}


def test_a_failed_flush_is_logged_and_never_raised(monkeypatch, capsys):
    monkeypatch.setattr(db_utils, '_get_table', lambda: KpiTable(fail=True))
    kpi.begin()
    kpi.add('s1', kpi.COMA)
    assert kpi.flush() == 0
    assert '"event": "KPI_FLUSH_FAILED"' in capsys.readouterr().out


def test_completion_adds_the_durations_from_the_start_else_the_creation(kpi_table):
    kpi.completed('s1', {'timestampStartMs': 1_000, 'tsInsert': 1, 'currentClock': 4}, now_ms=61_000)
    kpi.completed('s1', {'tsInsert': 31_000}, now_ms=61_000)
    kpi.completed('s1', {'currentClock': 2}, now_ms=61_000)
    counters = kpi.pending()[('s1', TODAY)]
    assert counters == {'matchesCompleted': 3, 'durationMsSum': 90_000, 'durationClocksSum': 6}
    kpi.begin()
    kpi.completed('s1', {'tsInsert': 1})
    assert kpi.pending()[('s1', TODAY)]['durationMsSum'] > 0


# ── the report ───────────────────────────────────────────────────────────────

def _seed(kpi_table, story, day, **counters):
    kpi_table.items[(f'KPI#{story}', f'DAY#{day}')] = {'PK': f'KPI#{story}', 'SK': f'DAY#{day}', **counters}


def test_report_day_rows_rates_and_uuid_tables(kpi_table):
    _seed(kpi_table, 's1', '2026-09-28', matchesStarted=3, matchesCompleted=2, durationMsSum=185_000,
          durationClocksSum=5, coma=1, **{'c#c-1': 1, 'ttl': 'x'})
    _seed(kpi_table, 's1', '2026-09-29', **{'c#c-1': 2, 'c#c-2': 3, 'l#l-1': 1, 'm#m-2#ACTIVE': 1,
                                            'm#m-1#COMPLETED': 1, 'm#m-1#FAILED': 2, 'm#m-3#BOGUS': 1})
    _seed(kpi_table, 's1', '2026-09-30', matchesStarted=9)
    r = kpi.report(' s1 ', '2026-09-28', '2026-09-29', 'DAY')
    assert (r['storyUuid'], r['from'], r['to'], r['groupBy']) == ('s1', '2026-09-28', '2026-09-29', 'day')
    assert r['rows'][0] == {'period': '2026-09-28', 'matchesStarted': 3, 'matchesCompleted': 2,
                            'completionRate': 0.6667, 'avgDurationMinutes': 1.54, 'avgDurationClocks': 2.5,
                            'comaCount': 1}
    assert r['rows'][1]['completionRate'] is None and r['rows'][1]['avgDurationMinutes'] is None
    assert r['choices'] == [{'uuid': 'c-1', 'count': 3}, {'uuid': 'c-2', 'count': 3}]
    assert r['locations'] == [{'uuid': 'l-1', 'count': 1}]
    assert r['missions'] == [{'uuid': 'm-1', 'activated': 0, 'completed': 1, 'failed': 2},
                             {'uuid': 'm-2', 'activated': 1, 'completed': 0, 'failed': 0}]


def test_report_month_total_and_every_story(kpi_table):
    _seed(kpi_table, 's1', '2026-08-31', matchesStarted=1)
    _seed(kpi_table, 's2', '2026-09-01', matchesStarted=2, matchesCompleted=1)
    stories = [{'GSI2_SK': 'STORY#s1'}, {'uuid': 's2'}, {'GSI2_SK': 'STORY#s1'}, {'GSI2_SK': 'junk'}]
    with patch('common.kpi.db_utils.query_gsi', return_value=stories) as gsi:
        month = kpi.report(None, '2026-08-30', '2026-09-02', 'month')
        total = kpi.report('', '2026-08-30', '2026-09-02', 'total')
    assert gsi.call_count == 2
    assert [(x['period'], x['matchesStarted']) for x in month['rows']] == [('2026-08', 1), ('2026-09', 2)]
    assert [(x['period'], x['matchesStarted'], x['completionRate']) for x in total['rows']] == [('total', 3, 0.3333)]
    assert month['storyUuid'] is None


def test_report_defaults_and_bad_input(kpi_table):
    default = kpi.report('s1', None, None, None, today_fn=lambda: '2026-09-29')
    assert (default['from'], default['to'], len(default['rows'])) == ('2026-08-31', '2026-09-29', 30)
    assert kpi.report('s1', None, '2026-09-30', 'day')['from'] == '2026-09-01'
    assert len(kpi.report('s1', '2025-09-29', '2026-09-29', None)['rows']) == 366
    for args in ((None, None, 'week'), ('2026/09/01', None, None), ('2026-02-30', None, None),
                 (None, 'yesterday', None), ('2026-09-10', '2026-09-01', None),
                 ('2025-09-28', '2026-09-29', None)):
        with pytest.raises(kpi.KpiError):
            kpi.report('s1', *args)
    assert kpi.ratio(1, 8, 2) == 0.13


# ── the admin route ──────────────────────────────────────────────────────────

def _get(qs, headers=ADMIN_TOKEN, method='GET'):
    return h.lambda_handler(make_event(method, '/api/admin/reports/kpi', headers=dict(headers), qs=qs), None)


def test_admin_route_answers_the_report_and_refuses_the_rest(kpi_table):
    _seed(kpi_table, STORY_UUID, TODAY, matchesStarted=2)
    with _env([]):
        ok = _get({'storyUuid': STORY_UUID, 'groupBy': 'total'})
        bad = _get({'from': 'nope'})
        player = _get({}, headers=PLAYER_TOKEN)
        post = _get({}, method='POST')
    assert ok['statusCode'] == 200 and _body(ok)['rows'][0]['matchesStarted'] == 2
    assert bad['statusCode'] == 400 and _body(bad)['error'] == 'INVALID_INPUT'
    assert player['statusCode'] == 403
    assert post['statusCode'] == 404


def test_admin_route_honours_the_ip_allow_list(kpi_table, monkeypatch):
    monkeypatch.setenv('ADMIN_IP_EMPTY_MEANS', 'nobody')
    monkeypatch.setenv('ADMIN_IP_WHITELIST', '')
    with _env([]):
        assert _get({})['statusCode'] == 403


# ── the hooks, through the handler ───────────────────────────────────────────

def test_start_counts_match_started_and_stamps_the_start(kpi_table):
    created = dict(_match(), status='CREATED')
    with _env([_story(), created, _char()]) as table:
        result = h.lambda_handler(make_event('POST', f'/api/matches/{MATCH_UUID}/start', headers=PLAYER_TOKEN,
                                             path_params={'uuidMatch': MATCH_UUID}), None)
        stored = table.get_item(f'MATCH#{MATCH_UUID}')
    assert result['statusCode'] == 200
    assert stored['timestampStartMs'] > 0
    assert _counters(kpi_table) == {'matchesStarted': 1}


def _end_story():
    story = _story(events=[_event(40, 'evt-end', type='END')])
    story['idEventEndGame'] = 40
    story['missions'] = [{'id': 1, 'uuid': 'mission-1'}]
    return story


def _end(status='RUNNING'):
    match = dict(_match(clock=3), status=status, timestampStartMs=1)
    match['registry'] = [{'key': 'mission:mission-1', 'idMission': 1, 'stringValue': 'ACTIVE'}]
    return match


def test_end_counts_completion_durations_and_the_failed_mission(kpi_table):
    with _env([_end_story(), _end(), _char()]):
        result = h.lambda_handler(make_event(
            'PATCH', f'/api/match/{MATCH_UUID}/end/evt-end', headers=PLAYER_TOKEN,
            path_params={'uuidMatch': MATCH_UUID, 'uuidEvent': 'evt-end'}), None)
    assert result['statusCode'] == 200
    counters = _counters(kpi_table)
    assert counters['matchesCompleted'] == 1 and counters['durationClocksSum'] == 3
    assert counters['durationMsSum'] > 0
    assert counters['m#mission-1#FAILED'] == 1


def test_ending_a_match_already_over_counts_no_completion(kpi_table):
    with _env([_end_story(), _end('ENDED'), _char()]):
        h.lambda_handler(make_event(
            'PATCH', f'/api/match/{MATCH_UUID}/end/evt-end', headers=PLAYER_TOKEN,
            path_params={'uuidMatch': MATCH_UUID, 'uuidEvent': 'evt-end'}), None)
    assert 'matchesCompleted' not in _counters(kpi_table)


def test_select_choice_counts_the_choice(kpi_table):
    with _env([_choice_story(), _open_cycle_match(), _char()]):
        assert h.lambda_handler(_post('action/select-choice', {'choiceUuid': 'ch-gift'}), None)['statusCode'] == 200
    assert _counters(kpi_table)['c#ch-gift'] == 1


def test_only_the_first_visit_of_a_location_counts(kpi_table):
    with _env([_story(), _match(), _char()]):
        h.lambda_handler(_post('movements/start', {'targetLocationUuid': 'loc-b'}), None)
        h.lambda_handler(_post('movements/start', {'targetLocationUuid': 'loc-a'}), None)
        h.lambda_handler(_post('movements/start', {'targetLocationUuid': 'loc-b'}), None)
    counters = _counters(kpi_table)
    assert counters.get('l#loc-b') == 1 and 'l#loc-a' not in counters


def test_mark_location_visited_says_when_it_flipped():
    match = {'uuid': MATCH_UUID, 'locations': [{'idLocation': LOC_A, 'flagVisited': 1}]}
    assert h._mark_location_visited(match, LOC_A) is False
    assert h._mark_location_visited(match, 5) is True
    assert h._mark_location_visited(match, 5) is False


def test_a_coma_edge_state_counts_and_a_recovery_does_not(kpi_table):
    match = {'storyUuid': STORY_UUID, 'currentClock': 1}
    h._log_edge_state(match, {'uuid': 'c1'}, None, 'COMA c1')
    h._log_edge_state(match, {'uuid': 'c1'}, None, 'COMA_RECOVERED c1')
    h._log_edge_state(match, None, None, 'ALL_PLAYER_COMA m1')
    assert kpi.pending()[(STORY_UUID, TODAY)] == {'coma': 1}


def test_mission_transitions_count_into_active_completed_failed(kpi_table):
    match = {'storyUuid': STORY_UUID, 'registry': []}
    mission = {'id': 1, 'uuid': 'mission-1'}
    missions._write(match, mission, None, None, missions.STATUS_AVAILABLE, None, [], True, 1)
    state = match['registry'][0]
    missions._write(match, mission, state, 'AVAILABLE', missions.STATUS_ACTIVE, 5, [], False, 1)
    missions._write(match, mission, state, 'ACTIVE', missions.STATUS_ACTIVE, 6, [], False, 1)
    missions._write(match, mission, state, 'ACTIVE', missions.STATUS_COMPLETED, 7, [], False, 1)
    assert kpi.pending()[(STORY_UUID, TODAY)] == {'m#mission-1#ACTIVE': 1, 'm#mission-1#COMPLETED': 1}
