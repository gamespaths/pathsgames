"""v1.1.0 — V1 step 1: smoke-test handler, checks a→g with the HTTP client, the in-process creation,
the TTL sweep and SNS all faked; covers every hard failure, the skips and the warnings."""
import itertools
import json

import pytest

from smoke import client, handler, inprocess, notify, ttl

API = 'https://api.example.test/test'
SITE = 'https://site.example.test'
ORDER = ['website', 'echo', 'stories', 'story-detail', 'guest', 'create-match', 'join', 'start', 'info',
         'clock', 'locations', 'movement', 'movement', 'pass', 'sleep', 'clock-after-sleep', 'turnstile']


def _clocks(*answers):
    """A clock route answering ``answers`` in turn, cycling (one run = before and after the sleep)."""
    answers = itertools.cycle(answers)
    return lambda body: next(answers)



def _routes():
    return {
        ('GET', 'SITE/'): (200, '<html><title>Paths Games</title></html>'),
        ('GET', '/api/echo/status'): (200, {'status': 'UP', 'properties': {'version': '1.0.0'}}),
        ('GET', '/api/stories?lang=en'): (200, [{'uuid': 'robottest-s', 'title': 'x'},
                                                {'uuid': 's1', 'title': 'A RobotTest tale'},
                                                {'uuid': 'story-1', 'title': 'The Tale'}]),
        ('GET', '/api/stories/story-1?lang=en'): (200, {
            'difficulties': [{'uuid': 'd1'}, {'uuid': 'd2'}],
            'characterTemplates': [{'uuid': 'ct1', 'idClassPermitted': '2', 'idClassProhibited': None}],
            'classes': [{'uuid': 'c1', 'id': 1}, {'uuid': 'c2', 'id': 2}]}),
        ('POST', '/api/auth/guest'): (201, {'userUuid': 'u1', 'accessToken': 'tok', 'csrfToken': 'csrf'}),
        ('POST', '/api/matches/m1/join'): (201, {'uuid': 'ch1'}),
        ('POST', '/api/matches/m1/start'): (200, {'status': 'RUNNING'}),
        ('GET', '/api/match/m1/info?lang=en'): (200, {'match': {'status': 'RUNNING'}}),
        ('GET', '/api/match/m1/clock'): _clocks((200, {'currentClock': 0}), (200, {'currentClock': 1})),
        ('GET', '/api/match/m1/locations?lang=en'): (200, {'locations': [
            {'uuid': 'L0', 'characterCount': 0, 'neighbors': [{'uuid': 'X'}]},
            {'uuid': 'L1', 'characterCount': 1, 'neighbors': [{'uuid': None}, {'uuid': 'L2'}, {'uuid': 'L3'}]}]}),
        ('POST', '/api/gameplay/m1/movements/start'):
            lambda body: (409, {'error': 'NOT_A_NEIGHBOR'}) if body['targetLocationUuid'] == 'L2' else (200, {}),
        ('POST', '/api/gameplay/m1/action/pass'): (200, {'status': 'RUNNING'}),
        ('POST', '/api/gameplay/m1/action/sleep'): (200, {'timeEndTriggered': True, 'currentClock': 1}),
        ('POST', '/api/matches'): (400, {'error': 'TURNSTILE_VALIDATION_FAILED'}),
    }


class FakeApi:
    def __init__(self):
        self.routes = _routes()
        self.calls = []
        self.ms = {}

    def __call__(self, method, url, body=None, headers=None, timeout=20):
        path = url.replace(API, '').replace(SITE, 'SITE')
        self.calls.append({'method': method, 'path': path, 'body': body, 'headers': headers, 'timeout': timeout})
        value = self.routes[(method, path)]
        if isinstance(value, Exception):
            raise value
        if callable(value):
            value = value(body)
        status, payload = value
        text = payload if isinstance(payload, str) else json.dumps(payload)
        parsed = None if isinstance(payload, str) else payload
        return client.Response(status, parsed, text, self.ms.get(path, 10))

    def call(self, path):
        return next(c for c in self.calls if c['path'] == path)


@pytest.fixture
def env(monkeypatch):
    for key, value in {'ENV': 'test', 'APP_VERSION': '1.0.0', 'SMOKE_API_BASE_URL': API + '/',
                       'SMOKE_WEBSITE_URL': SITE, 'TURNSTILE_ENABLED': 'true', 'SMOKE_TTL_DAYS': '7',
                       'SMOKE_LATENCY_WARN_MS': '5000', 'SMOKE_ALARM_TOPIC_ARN': 'arn:aws:sns:r:1:t'}.items():
        monkeypatch.setenv(key, value)
    monkeypatch.delenv('AWS_LAMBDA_LOG_GROUP_NAME', raising=False)
    api = FakeApi()
    state = {'created': (201, {'uuid': 'm1'}), 'create_calls': [], 'ttl': [], 'notify': []}

    def fake_create(token, csrf, body, user_agent):
        state['create_calls'].append({'token': token, 'csrf': csrf, 'body': body, 'ua': user_agent})
        if isinstance(state['created'], Exception):
            raise state['created']
        return state['created']

    monkeypatch.setattr(client, 'request', api)
    monkeypatch.setattr(inprocess, 'create_match', fake_create)
    monkeypatch.setattr(ttl, 'apply', lambda u, m, d: state['ttl'].append((u, m, d)))
    monkeypatch.setattr(notify, 'publish', lambda topic, summary, group: state['notify'].append((topic, summary, group)))
    state['api'] = api
    return state


def _fail(trigger=None):
    with pytest.raises(handler.SmokeTestFailed) as info:
        handler.lambda_handler(trigger, None)
    return json.loads(str(info.value))


# ── happy path ───────────────────────────────────────────────────────────

def test_happy_path_runs_every_check_in_order_and_passes(env, capsys):
    summary = handler.lambda_handler({'trigger': 'deploy'}, None)
    assert summary['result'] == 'PASS'
    assert (summary['env'], summary['version'], summary['trigger']) == ('test', '1.0.0', 'deploy')
    assert [s['name'] for s in summary['steps']] == ORDER
    assert [s['status'] for s in summary['steps']].count('FAIL') == 0
    assert summary['steps'][11]['status'] == 'REFUSED' and summary['steps'][12]['status'] == 'PASS'
    assert env['api'].call('/api/gameplay/m1/action/sleep')['body'] is None
    assert (summary['userUuid'], summary['matchUuid']) == ('u1', 'm1')
    assert summary['failedCheck'] is None and summary['warnings'] == []
    assert isinstance(summary['totalMs'], int)
    assert all({'name', 'status', 'httpStatus', 'ms', 'slow'} <= set(s) for s in summary['steps'])
    assert env['ttl'] == [('u1', 'm1', 7)]
    assert env['notify'] == []
    lines = [json.loads(line) for line in capsys.readouterr().out.splitlines()]
    assert [line['event'] for line in lines].count('SMOKE_SUMMARY') == 1


def test_happy_path_picks_story_class_and_sends_the_loadout(env):
    handler.lambda_handler({}, None)
    created = env['create_calls'][0]
    assert (created['token'], created['csrf']) == ('tok', 'csrf')
    assert created['ua'] == 'PathsGamesSmokeTest/1.0.0'
    body = created['body']
    assert body['storyUuid'] == 'story-1' and body['difficultyUuid'] == 'd1'
    assert (body['characterTemplateUuid'], body['classUuid'], body['traitUuids']) == ('ct1', 'c2', [])
    assert body['singlePlayer'] == 1 and body['name'].startswith('smoketest-')
    assert 'turnstileToken' not in body
    join = env['api'].call('/api/matches/m1/join')
    assert join['body'] == {'characterTemplateUuid': 'ct1', 'classUuid': 'c2', 'traitUuids': []}


def test_headers_bearer_after_guest_csrf_only_on_the_turnstile_create(env):
    handler.lambda_handler({}, None)
    api = env['api']
    assert 'Authorization' not in api.call('/api/echo/status')['headers']
    assert api.call('/api/echo/status')['headers']['User-Agent'] == 'PathsGamesSmokeTest/1.0.0'
    assert api.call('/api/echo/status')['headers']['Content-Type'] == 'application/json'
    join = api.call('/api/matches/m1/join')['headers']
    assert join['Authorization'] == 'Bearer tok' and 'X-CSRF-TOKEN' not in join
    check = api.call('/api/matches')
    assert check['headers']['X-CSRF-TOKEN'] == 'csrf'
    assert 'turnstileToken' not in check['body']
    assert (check['body']['storyUuid'], check['body']['difficultyUuid']) == ('story-1', 'd1')
    assert all(c['timeout'] == 20 for c in api.calls)


def test_trigger_defaults_to_schedule_and_handles_a_non_dict_event(env):
    assert handler.lambda_handler({'trigger': 'schedule'}, None)['trigger'] == 'schedule'
    assert handler.lambda_handler(None, None)['trigger'] == 'schedule'
    assert handler.lambda_handler('x', None)['trigger'] == 'schedule'


# ── skips and warnings ──────────────────────────────────────────────────

def test_website_and_turnstile_skipped_when_not_configured(env, monkeypatch, capsys):
    monkeypatch.setenv('SMOKE_WEBSITE_URL', '')
    monkeypatch.setenv('TURNSTILE_ENABLED', 'false')
    summary = handler.lambda_handler({}, None)
    assert summary['result'] == 'PASS'
    steps = {s['name']: s for s in summary['steps']}
    assert steps['website']['status'] == 'SKIPPED' and steps['turnstile']['status'] == 'SKIPPED'
    paths = [c['path'] for c in env['api'].calls]
    assert 'SITE/' not in paths and '/api/matches' not in paths
    assert capsys.readouterr().out.count('SMOKE_SKIPPED') == 2


def test_no_movement_accepted_is_a_warning_and_the_run_passes(env, capsys):
    env['api'].routes[('POST', '/api/gameplay/m1/movements/start')] = (409, {'error': 'INSUFFICIENT_ENERGY'})
    summary = handler.lambda_handler({}, None)
    assert summary['result'] == 'PASS'
    assert summary['warnings'] == ['no movement accepted']
    assert [s['status'] for s in summary['steps'] if s['name'] == 'movement'] == ['REFUSED', 'REFUSED', 'WARNING']
    assert '"level": "WARNING"' in capsys.readouterr().out


def test_bad_request_on_movement_tries_the_next_neighbour(env):
    env['api'].routes[('POST', '/api/gameplay/m1/movements/start')] = (
        lambda body: (400, {}) if body['targetLocationUuid'] == 'L2' else (200, {}))
    assert handler.lambda_handler({}, None)['warnings'] == []


def test_no_location_with_a_character_is_a_warning(env):
    env['api'].routes[('GET', '/api/match/m1/locations?lang=en')] = (200, {'locations': []})
    summary = handler.lambda_handler({}, None)
    assert summary['result'] == 'PASS'
    assert summary['warnings'] == ['no neighbour to move to']
    assert not any(c['path'].endswith('/movements/start') for c in env['api'].calls)


def test_slow_call_is_only_a_warning(env):
    env['api'].ms['/api/echo/status'] = 6000
    summary = handler.lambda_handler({}, None)
    assert summary['result'] == 'PASS'
    echo = next(s for s in summary['steps'] if s['name'] == 'echo')
    assert echo['slow'] is True and echo['ms'] == 6000
    assert summary['warnings'] == ['echo slow: 6000 ms over 5000 ms']


def test_info_status_may_sit_at_the_top_level(env):
    env['api'].routes[('GET', '/api/match/m1/info?lang=en')] = (200, {'status': 'RUNNING'})
    assert handler.lambda_handler({}, None)['result'] == 'PASS'


# ── hard failures ────────────────────────────────────────────────────────

def _set(route, value):
    def mutate(env):
        env['api'].routes[route] = value
    return mutate


FAILURES = [
    ('website-status', _set(('GET', 'SITE/'), (503, 'down')), 'website', 503),
    ('website-marker', _set(('GET', 'SITE/'), (200, '<title>Other</title>')), 'website', 200),
    ('echo-status', _set(('GET', '/api/echo/status'), (200, {'status': 'DOWN', 'properties': {'version': '1.0.0'}})), 'echo', 200),
    ('echo-version', _set(('GET', '/api/echo/status'), (200, {'status': 'UP', 'properties': {'version': '0.42.0'}})), 'echo', 200),
    ('echo-500', _set(('GET', '/api/echo/status'), (500, {'error': 'BOOM'})), 'echo', 500),
    ('no-story', _set(('GET', '/api/stories?lang=en'), (200, [])), 'stories', 200),
    ('only-robottest', _set(('GET', '/api/stories?lang=en'), (200, [{'uuid': 'a', 'title': 'robottest x'}])), 'stories', 200),
    ('stories-not-list', _set(('GET', '/api/stories?lang=en'), (200, {'items': []})), 'stories', 200),
    ('detail-404', _set(('GET', '/api/stories/story-1?lang=en'), (404, {'error': 'STORY_NOT_FOUND'})), 'story-detail', 404),
    ('detail-no-difficulty', _set(('GET', '/api/stories/story-1?lang=en'), (200, {'difficulties': []})), 'story-detail', 200),
    ('guest-429', _set(('POST', '/api/auth/guest'), (429, {'error': 'RATE_LIMITED'})), 'guest', 429),
    ('guest-no-token', _set(('POST', '/api/auth/guest'), (201, {'userUuid': 'u1'})), 'guest', 201),
    ('join', _set(('POST', '/api/matches/m1/join'), (409, {'error': 'CLASS_NOT_COMPATIBLE'})), 'join', 409),
    ('start', _set(('POST', '/api/matches/m1/start'), (409, {})), 'start', 409),
    ('info-not-running', _set(('GET', '/api/match/m1/info?lang=en'), (200, {'match': {'status': 'CREATED'}})), 'info', 200),
    ('clock-500', _set(('GET', '/api/match/m1/clock'), (500, None)), 'clock', 500),
    ('clock-missing', _set(('GET', '/api/match/m1/clock'), (200, {})), 'clock', 200),
    ('locations', _set(('GET', '/api/match/m1/locations?lang=en'), (500, {})), 'locations', 500),
    ('movement-500', _set(('POST', '/api/gameplay/m1/movements/start'), (500, {})), 'movement', 500),
    ('pass', _set(('POST', '/api/gameplay/m1/action/pass'), (409, {'error': 'NOT_YOUR_TURN'})), 'pass', 409),
    ('sleep-409', _set(('POST', '/api/gameplay/m1/action/sleep'), (409, {'error': 'MATCH_NOT_RUNNING'})), 'sleep', 409),
    ('sleep-no-time-end', _set(('POST', '/api/gameplay/m1/action/sleep'), (200, {'timeEndTriggered': False})),
     'sleep', 200),
    ('clock-not-advanced', _set(('GET', '/api/match/m1/clock'), _clocks((200, {'currentClock': 3}))),
     'clock-after-sleep', 200),
    ('clock-went-back', _set(('GET', '/api/match/m1/clock'), _clocks((200, {'currentClock': 3}), (200, {'currentClock': 2}))),
     'clock-after-sleep', 200),
    ('clock-after-500', _set(('GET', '/api/match/m1/clock'), _clocks((200, {'currentClock': 0}), (500, {}))),
     'clock-after-sleep', 500),
    ('turnstile-201', _set(('POST', '/api/matches'), (201, {'uuid': 'm2'})), 'turnstile', 201),
    ('turnstile-other-400', _set(('POST', '/api/matches'), (400, {'error': 'INVALID_INPUT'})), 'turnstile', 400),
    ('create-409', lambda env: env.update(created=(409, {'error': 'ACTIVE_MATCH_ALREADY_EXISTS'})), 'create-match', 409),
    ('create-no-uuid', lambda env: env.update(created=(201, {})), 'create-match', 201),
    ('create-no-body', lambda env: env.update(created=(500, None)), 'create-match', 500),
]


@pytest.mark.parametrize('case, mutate, check, status', FAILURES, ids=[f[0] for f in FAILURES])
def test_every_hard_failure_stops_the_run_notifies_and_raises(env, case, mutate, check, status):
    mutate(env)
    summary = _fail({'trigger': 'deploy'})
    assert summary['result'] == 'FAIL'
    assert (summary['failedCheck'], summary['httpStatus']) == (check, status)
    assert summary['error']
    assert summary['steps'][-1]['name'] == check and summary['steps'][-1]['status'] == 'FAIL'
    assert len(env['notify']) == 1
    topic, notified, group = env['notify'][0]
    assert topic == 'arn:aws:sns:r:1:t' and notified == summary
    assert group == '/aws/lambda/pathsgames-test-SmokeTestFunction'
    assert len(env['ttl']) == 1


def test_failure_message_names_the_error_code(env):
    env['api'].routes[('POST', '/api/matches/m1/join')] = (409, {'error': 'CLASS_NOT_COMPATIBLE'})
    assert _fail()['error'] == 'expected HTTP 201, got 409 CLASS_NOT_COMPATIBLE'


def test_failure_before_the_guest_sweeps_no_partition(env):
    env['api'].routes[('GET', '/api/echo/status')] = (503, {})
    summary = _fail()
    assert env['ttl'] == [(None, None, 7)]
    assert summary['userUuid'] is None and summary['matchUuid'] is None


def test_failure_after_the_match_sweeps_both_partitions(env):
    env['api'].routes[('POST', '/api/gameplay/m1/action/pass')] = (409, {})
    _fail()
    assert env['ttl'] == [('u1', 'm1', 7)]


def test_http_timeout_is_a_hard_failure(env):
    env['api'].routes[('GET', '/api/match/m1/clock')] = client.HttpCallError('GET clock failed: timed out', 20000)
    summary = _fail()
    assert summary['failedCheck'] == 'clock' and summary['httpStatus'] is None
    assert 'timed out' in summary['error']
    assert summary['steps'][-1] == {'name': 'clock', 'status': 'FAIL', 'httpStatus': None, 'ms': 20000, 'slow': True}


def test_a_broken_in_process_import_is_a_reported_failure(env):
    env['created'] = ImportError('no module match')
    summary = _fail()
    assert summary['failedCheck'] == 'create-match'
    assert summary['error'] == 'ImportError: no module match'


def test_empty_api_base_url_fails_on_config(env, monkeypatch):
    monkeypatch.setenv('SMOKE_API_BASE_URL', '')
    summary = _fail()
    assert summary['failedCheck'] == 'config' and summary['steps'] == []


def test_failure_raised_after_sns_even_without_topic(env, monkeypatch):
    monkeypatch.setenv('SMOKE_ALARM_TOPIC_ARN', '')
    monkeypatch.setenv('AWS_LAMBDA_LOG_GROUP_NAME', '/aws/lambda/custom')
    env['api'].routes[('GET', '/api/echo/status')] = (503, {})
    _fail()
    assert env['notify'][0][0] == '' and env['notify'][0][2] == '/aws/lambda/custom'


# ── helpers ──────────────────────────────────────────────────────────────

def test_pick_class_follows_the_template_restrictions():
    classes = [{'uuid': 'a', 'id': 1}, {'uuid': 'b', 'id': '2'}, {'uuid': 'c', 'id': 3}]
    assert handler.pick_class(None, classes)['uuid'] == 'a'
    assert handler.pick_class({'idClassPermitted': '', 'idClassProhibited': ' '}, classes)['uuid'] == 'a'
    assert handler.pick_class({'idClassPermitted': 2}, classes)['uuid'] == 'b'
    assert handler.pick_class({'idClassProhibited': '1'}, classes)['uuid'] == 'b'
    assert handler.pick_class({'idClassPermitted': 9}, classes) is None
    assert handler.pick_class({'idClassPermitted': 'abc'}, classes)['uuid'] == 'a'
    assert handler.pick_class({}, None) is None


def test_pick_story_skips_robottest_in_title_or_uuid_and_missing_uuid():
    assert handler.pick_story([{'uuid': 'ROBOTTEST-1', 'title': 'x'}, {'title': 'no uuid'},
                               {'uuid': 'ok', 'title': None}])['uuid'] == 'ok'
    assert handler.pick_story(None) is None


def test_int_env_falls_back_on_garbage(monkeypatch):
    monkeypatch.setenv('SMOKE_TTL_DAYS', 'seven')
    assert handler._int_env('SMOKE_TTL_DAYS', 7) == 7
    monkeypatch.setenv('SMOKE_TTL_DAYS', '')
    assert handler._int_env('SMOKE_TTL_DAYS', 7) == 7
    monkeypatch.setenv('SMOKE_TTL_DAYS', ' 3 ')
    assert handler._int_env('SMOKE_TTL_DAYS', 7) == 3


def test_config_defaults(monkeypatch):
    for key in ('ENV', 'APP_VERSION', 'SMOKE_API_BASE_URL', 'SMOKE_WEBSITE_URL', 'SMOKE_TTL_DAYS',
                'SMOKE_LATENCY_WARN_MS', 'SMOKE_HTTP_TIMEOUT_S', 'SMOKE_ALARM_TOPIC_ARN', 'TURNSTILE_ENABLED',
                'AWS_LAMBDA_LOG_GROUP_NAME'):
        monkeypatch.delenv(key, raising=False)
    cfg = handler._config()
    assert (cfg['env'], cfg['ttl_days'], cfg['warn_ms'], cfg['timeout']) == ('dev', 7, 5000, 20)
    assert cfg['turnstile'] is False and cfg['topic'] == '' and cfg['api'] == ''
    assert cfg['log_group'] == '/aws/lambda/pathsgames-dev-SmokeTestFunction'
    assert handler._Run(cfg, 'x').user_agent == 'PathsGamesSmokeTest/unknown'


def test_sleep_without_time_end_flag_relies_on_the_clock_only(env):
    env['api'].routes[('POST', '/api/gameplay/m1/action/sleep')] = (200, {'currentClock': 1})
    assert handler.lambda_handler({}, None)['result'] == 'PASS'


def test_clock_not_advanced_message(env):
    env['api'].routes[('GET', '/api/match/m1/clock')] = _clocks((200, {'currentClock': 4}))
    assert _fail()['error'] == 'clock not advanced by sleep: 4 -> 4'
