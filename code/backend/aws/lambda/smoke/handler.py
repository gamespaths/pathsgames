"""v1.1.0 — V1 step 1 smoke test: website, echo, stories, guest, match (in-process), gameplay + sleep, Turnstile.
Stops at the first hard failure; the ttl sweep always runs; a failure publishes SNS and raises SmokeTestFailed."""
import json
import os
import time
import urllib.parse

from smoke import client, inprocess, notify, ttl

WEBSITE_MARKER = 'Paths Games'
ROBOT_MARKER = 'robottest'


class SmokeTestFailed(Exception):
    """The run failed: the invocation ends in error (Lambda Errors metric, CLI FunctionError)."""


class _CheckFailed(Exception):
    def __init__(self, check, message, status=None):
        super().__init__(message)
        self.check = check
        self.status = status


def _int_env(name, default):
    try:
        return int(str(os.environ.get(name, '')).strip() or default)
    except ValueError:
        return default


def _config():
    env = os.environ.get('ENV', 'dev')
    return {
        'env': env,
        'version': os.environ.get('APP_VERSION', ''),
        'api': os.environ.get('SMOKE_API_BASE_URL', '').strip().rstrip('/'),
        'website': os.environ.get('SMOKE_WEBSITE_URL', '').strip(),
        'ttl_days': _int_env('SMOKE_TTL_DAYS', 7),
        'warn_ms': _int_env('SMOKE_LATENCY_WARN_MS', 5000),
        'timeout': _int_env('SMOKE_HTTP_TIMEOUT_S', 20),
        'topic': os.environ.get('SMOKE_ALARM_TOPIC_ARN', '').strip(),
        'turnstile': os.environ.get('TURNSTILE_ENABLED', 'false').strip().lower() == 'true',
        'log_group': os.environ.get('AWS_LAMBDA_LOG_GROUP_NAME')
                     or f'/aws/lambda/pathsgames-{env}-SmokeTestFunction',
    }


def _log(level, event, **fields):
    print(json.dumps({'level': level, 'event': event, **fields}, default=str))


def _error_code(body):
    return body.get('error') if isinstance(body, dict) else None


def _class_ref(value):
    """Same reading as match.handler._class_ref: blank or unparseable = no restriction."""
    if value is None or str(value).strip() == '':
        return None
    try:
        return int(str(value).strip())
    except ValueError:
        return None


def pick_class(template, classes):
    """The first class the template accepts (idClassPermitted / idClassProhibited), else None."""
    permitted = _class_ref((template or {}).get('idClassPermitted'))
    prohibited = _class_ref((template or {}).get('idClassProhibited'))
    for clazz in classes or []:
        class_id = _class_ref(clazz.get('id'))
        if permitted is not None and permitted != class_id:
            continue
        if prohibited is not None and prohibited == class_id:
            continue
        return clazz
    return None


def pick_story(stories):
    for story in stories or []:
        text = f"{story.get('title') or ''} {story.get('uuid') or ''}".lower()
        if ROBOT_MARKER not in text and story.get('uuid'):
            return story
    return None


class _Run:
    def __init__(self, cfg, trigger):
        self.cfg = cfg
        self.trigger = trigger
        self.steps = []
        self.warnings = []
        self.current = 'config'
        self.user_uuid = None
        self.match_uuid = None
        self.token = None
        self.csrf = None
        self.user_agent = f"PathsGamesSmokeTest/{cfg['version'] or 'unknown'}"

    def warn(self, message, **fields):
        self.warnings.append(message)
        _log('WARNING', 'SMOKE_WARNING', message=message, **fields)

    def record(self, name, status, http_status, ms):
        slow = ms is not None and ms > self.cfg['warn_ms']
        row = {'name': name, 'status': status, 'httpStatus': http_status, 'ms': ms, 'slow': slow}
        self.steps.append(row)
        _log('INFO' if status != 'FAIL' else 'ERROR', 'SMOKE_STEP', **row)
        if slow:
            self.warn(f'{name} slow: {ms} ms over {self.cfg["warn_ms"]} ms', step=name)
        return row

    def fail(self, message, status=None):
        if self.steps and self.steps[-1]['name'] == self.current:
            self.steps[-1]['status'] = 'FAIL'
        raise _CheckFailed(self.current, message, status)

    def headers(self, csrf=False):
        headers = {'Content-Type': 'application/json', 'User-Agent': self.user_agent,
                   'Accept': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        if csrf and self.csrf:
            headers['X-CSRF-TOKEN'] = self.csrf
        return headers

    def call(self, name, method, url, body=None, expected=(200,), csrf=False, headers=None):
        self.current = name
        try:
            resp = client.request(method, url, body, headers or self.headers(csrf), self.cfg['timeout'])
        except client.HttpCallError as exc:
            self.record(name, 'FAIL', None, exc.ms)
            raise _CheckFailed(name, str(exc)) from exc
        ok = resp.status in expected
        self.record(name, 'PASS' if ok else 'FAIL', resp.status, resp.ms)
        if not ok:
            code = _error_code(resp.body)
            raise _CheckFailed(name, f'expected HTTP {"/".join(map(str, expected))}, got {resp.status}'
                               + (f' {code}' if code else ''), resp.status)
        return resp

    def api(self, path):
        return self.cfg['api'] + path

    # ── checks a→g ──

    def website(self):
        self.current = 'website'
        if not self.cfg['website']:
            self.record('website', 'SKIPPED', None, None)
            _log('INFO', 'SMOKE_SKIPPED', check='website', reason='SMOKE_WEBSITE_URL is empty')
            return
        url = self.cfg['website'].rstrip('/') + '/'
        resp = self.call('website', 'GET', url, headers={'User-Agent': self.user_agent, 'Accept': 'text/html'})
        if WEBSITE_MARKER not in (resp.text or ''):
            self.fail(f'marker "{WEBSITE_MARKER}" not found in {url}', resp.status)

    def echo(self):
        resp = self.call('echo', 'GET', self.api('/api/echo/status'))
        body = resp.body if isinstance(resp.body, dict) else {}
        if body.get('status') != 'UP':
            self.fail(f"echo status is {body.get('status')!r}, expected 'UP'", resp.status)
        version = (body.get('properties') or {}).get('version')
        if version != self.cfg['version']:
            self.fail(f'echo version {version!r} differs from APP_VERSION {self.cfg["version"]!r}', resp.status)

    def story(self):
        resp = self.call('stories', 'GET', self.api('/api/stories?lang=en'))
        stories = resp.body if isinstance(resp.body, list) else []
        if not stories:
            self.fail('no story in GET /api/stories', resp.status)
        story_uuid = (pick_story(stories) or {}).get('uuid')
        if not story_uuid:
            self.fail('only robottest stories in GET /api/stories', resp.status)
        quoted = urllib.parse.quote(str(story_uuid), safe='')
        resp = self.call('story-detail', 'GET', self.api(f'/api/stories/{quoted}?lang=en'))
        detail = resp.body if isinstance(resp.body, dict) else {}
        difficulties = detail.get('difficulties') or []
        if not difficulties:
            self.fail(f"story {story_uuid} has no difficulty", resp.status)
        templates = detail.get('characterTemplates') or []
        template = templates[0] if templates else None
        clazz = pick_class(template, detail.get('classes'))
        return {
            'storyUuid': story_uuid,
            'difficultyUuid': difficulties[0].get('uuid'),
            'characterTemplateUuid': (template or {}).get('uuid'),
            'classUuid': (clazz or {}).get('uuid'),
        }

    def guest(self):
        resp = self.call('guest', 'POST', self.api('/api/auth/guest'), body={}, expected=(201,))
        body = resp.body if isinstance(resp.body, dict) else {}
        self.user_uuid = body.get('userUuid')
        if not body.get('accessToken') or not body.get('csrfToken'):
            self.fail('guest answer has no accessToken or csrfToken', resp.status)
        self.token = body['accessToken']
        self.csrf = body['csrfToken']

    def create_match(self, pick):
        self.current = 'create-match'
        loadout = {'characterTemplateUuid': pick['characterTemplateUuid'], 'classUuid': pick['classUuid'],
                   'traitUuids': []}
        body = {'storyUuid': pick['storyUuid'], 'difficultyUuid': pick['difficultyUuid'],
                'name': inprocess.match_name(), **loadout, 'singlePlayer': 1}
        start = time.monotonic()
        status, answer = inprocess.create_match(self.token, self.csrf, body, self.user_agent)
        self.record('create-match', 'PASS' if status == 201 else 'FAIL', status,
                    int((time.monotonic() - start) * 1000))
        if status != 201:
            raise _CheckFailed('create-match', f'in-process POST /api/matches answered {status}'
                               + (f' {_error_code(answer)}' if _error_code(answer) else ''), status)
        self.match_uuid = (answer or {}).get('uuid')
        if not self.match_uuid:
            self.fail('in-process POST /api/matches answered no uuid', status)
        return loadout

    def gameplay(self, loadout):
        m = urllib.parse.quote(self.match_uuid, safe='')
        self.call('join', 'POST', self.api(f'/api/matches/{m}/join'), body=loadout, expected=(201,))
        self.call('start', 'POST', self.api(f'/api/matches/{m}/start'), body={})
        resp = self.call('info', 'GET', self.api(f'/api/match/{m}/info?lang=en'))
        body = resp.body if isinstance(resp.body, dict) else {}
        status = (body.get('match') or {}).get('status') or body.get('status')
        if status != 'RUNNING':
            self.fail(f'match status is {status!r}, expected RUNNING', resp.status)
        clock0 = self.clock('clock', m)
        resp = self.call('locations', 'GET', self.api(f'/api/match/{m}/locations?lang=en'))
        body = resp.body if isinstance(resp.body, dict) else {}
        self.move(m, body.get('locations') or [])
        self.call('pass', 'POST', self.api(f'/api/gameplay/{m}/action/pass'), body={})
        self.sleep(m, clock0)

    def clock(self, name, m):
        resp = self.call(name, 'GET', self.api(f'/api/match/{m}/clock'))
        if not isinstance(resp.body, dict) or resp.body.get('currentClock') is None:
            self.fail('clock answer has no currentClock', resp.status)
        return resp.body['currentClock']

    def sleep(self, m, clock0):
        # Owner decision: sleep must end the time (single player) and advance the clock past c0.
        resp = self.call('sleep', 'POST', self.api(f'/api/gameplay/{m}/action/sleep'))
        body = resp.body if isinstance(resp.body, dict) else {}
        if 'timeEndTriggered' in body and body['timeEndTriggered'] is not True:
            self.fail(f"sleep timeEndTriggered is {body['timeEndTriggered']!r}, expected true", resp.status)
        clock1 = self.clock('clock-after-sleep', m)
        if not clock1 > clock0:
            self.fail(f'clock not advanced by sleep: {clock0} -> {clock1}', 200)

    def move(self, m, locations):
        here = next((loc for loc in locations if (loc.get('characterCount') or 0) > 0), None)
        targets = [n.get('uuid') for n in ((here or {}).get('neighbors') or []) if n.get('uuid')]
        for target in targets:
            resp = self.call('movement', 'POST', self.api(f'/api/gameplay/{m}/movements/start'),
                             body={'targetLocationUuid': target}, expected=(200, 400, 409))
            if resp.status == 200:
                return target
            self.steps[-1]['status'] = 'REFUSED'
        self.current = 'movement'
        self.record('movement', 'WARNING', None, None)
        self.warn('no movement accepted' if targets else 'no neighbour to move to',
                  tried=len(targets), location=(here or {}).get('uuid'))
        return None

    def turnstile(self, pick):
        self.current = 'turnstile'
        if not self.cfg['turnstile']:
            self.record('turnstile', 'SKIPPED', None, None)
            _log('INFO', 'SMOKE_SKIPPED', check='turnstile', reason='TURNSTILE_ENABLED is false')
            return
        body = {'storyUuid': pick['storyUuid'], 'difficultyUuid': pick['difficultyUuid'],
                'name': inprocess.match_name(), 'traitUuids': [], 'singlePlayer': 1}
        resp = self.call('turnstile', 'POST', self.api('/api/matches'), body=body, expected=(400,), csrf=True)
        if _error_code(resp.body) != 'TURNSTILE_VALIDATION_FAILED':
            self.fail(f'expected TURNSTILE_VALIDATION_FAILED, got {_error_code(resp.body)!r}', resp.status)

    def run(self):
        if not self.cfg['api']:
            raise _CheckFailed('config', 'SMOKE_API_BASE_URL is empty')
        self.website()
        self.echo()
        pick = self.story()
        self.guest()
        loadout = self.create_match(pick)
        self.gameplay(loadout)
        self.turnstile(pick)

    def summary(self, failure, total_ms):
        return {
            'result': 'FAIL' if failure else 'PASS',
            'env': self.cfg['env'],
            'version': self.cfg['version'],
            'trigger': self.trigger,
            'failedCheck': failure.get('check') if failure else None,
            'httpStatus': failure.get('status') if failure else None,
            'error': failure.get('error') if failure else None,
            'userUuid': self.user_uuid,
            'matchUuid': self.match_uuid,
            'warnings': list(self.warnings),
            'totalMs': total_ms,
            'steps': list(self.steps),
        }


def lambda_handler(event, context):
    cfg = _config()
    trigger = str(event.get('trigger') or 'schedule')[:32] if isinstance(event, dict) else 'schedule'
    run = _Run(cfg, trigger)
    start = time.monotonic()
    failure = None
    try:
        run.run()
    except _CheckFailed as exc:
        failure = {'check': exc.check, 'status': exc.status, 'error': str(exc)}
    except Exception as exc:  # noqa: BLE001 - any bug or broken import is a failed run, never a crash
        failure = {'check': run.current, 'status': None, 'error': f'{type(exc).__name__}: {exc}'}
    finally:
        ttl.apply(run.user_uuid, run.match_uuid, cfg['ttl_days'])
    summary = run.summary(failure, int((time.monotonic() - start) * 1000))
    _log('ERROR' if failure else 'INFO', 'SMOKE_SUMMARY', **summary)
    if failure:
        notify.publish(cfg['topic'], summary, cfg['log_group'])
        raise SmokeTestFailed(json.dumps(summary, default=str))
    return summary
