"""
match/handler.py — Paths Games AWS Lambda — Step 19.

Implements the single-player match endpoints introduced in Step 19. The HTTP
contract follows the OpenAPI document
``code/backend/java/adapter-rest/src/main/resources/openapi/v0.19.0-match-creation-api.yaml``.

Routes registered in ``template/match.yaml``:

  POST /api/matches                  → create_match
  GET  /api/matches                  → list_user_matches
  GET  /api/admin/matches            → list_all_matches (ADMIN)
  GET  /api/match/{uuidMatch}/info   → get_match_info

DynamoDB layout:
  PK = MATCH#{uuid}, SK = METADATA
    Match metadata + embedded ``locations`` / ``registry`` lists.
    GSI1_PK = USER_MATCHES#{userUuid}, GSI1_SK = MATCH#{tsInsertMs}#{uuid}
"""

import json
import os
import time
import uuid as uuid_lib
import decimal
import urllib.request
import urllib.parse

from common import db_utils
from common import jwt_utils

_TURNSTILE_SECRET = os.environ.get('TURNSTILE_SECRET_KEY', '')
# Optional Robot-test bypass token: when the current ENV is not "prod", the token
# is non-empty AND the incoming token equals this value, Turnstile verification
# is skipped. The env != prod guard is defense-in-depth on top of the deploy
# script that already refuses to inject this var in prod.
_TURNSTILE_BYPASS_TOKEN = os.environ.get('TURNSTILE_BYPASS_TOKEN', '')
_ENV = os.environ.get('ENV', 'dev')
_SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

# ─── shared helpers ──────────────────────────────────────────────────────────

HEADERS = {"Content-Type": "application/json"}

_BANNED_STATES = {3, 4}
_MAINTENANCE_VALUE = "MAINTENANCE"

# Lifecycle statuses of a match. A match is "stopped" (terminal) when it is
# ENDED or GAMEOVER; only stopped matches may be deleted by an admin.
MATCH_STATUSES = ["CREATED", "RUNNING", "PAUSED", "ENDED", "GAMEOVER"]
TERMINAL_STATUSES = {"ENDED", "GAMEOVER"}


class _DecimalEncoder(json.JSONEncoder):
    def default(self, obj):  # pragma: no cover - exercised via _dumps
        if isinstance(obj, decimal.Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super().default(obj)


def _dumps(obj):
    return json.dumps(obj, cls=_DecimalEncoder)


def _ok(body, status=200):
    return {"statusCode": status, "headers": HEADERS, "body": _dumps(body)}


def _err(status, code, message):
    return {
        "statusCode": status,
        "headers": HEADERS,
        "body": _dumps({
            "error": code,
            "message": message,
            "timestamp": int(time.time() * 1000),
        }),
    }


def _normalize_path(raw_path):
    if raw_path.startswith('/api/'):
        return raw_path
    parts = raw_path.split('/api/', 1)
    if len(parts) == 2:
        return '/api/' + parts[1]
    return raw_path


def _bearer_token(event):
    headers = {k.lower(): v for k, v in (event.get('headers') or {}).items()}
    auth = headers.get('authorization')
    if auth and auth.lower().startswith('bearer '):
        return auth[7:].strip()
    return ''


def _resolve_user(event):
    """Return ``(user_dict_or_None, error_response_or_None)``.

    ``user_dict`` always has ``uuid``, ``role`` and ``state``. When the JWT
    refers to a user that has never been seeded into DynamoDB we still return
    a synthetic dict so the match flow can run for users that exist only in
    the Java backend.
    """
    token = _bearer_token(event)
    if not token:
        return None, _err(401, 'UNAUTHENTICATED', 'Authorization header with Bearer token is required')
    claims = jwt_utils.verify_access_token(token)
    if not claims or not claims.get('uuid'):
        return None, _err(401, 'UNAUTHENTICATED', 'Access token is invalid or expired')

    user_uuid = claims['uuid']
    user = db_utils.get_item(f'USER#{user_uuid}')
    if user is None:
        if claims.get('source') == 'jwt':
            return ({
                'uuid': user_uuid,
                'username': claims.get('username'),
                'role': claims.get('role', 'PLAYER'),
                'state': 2,
            }, None)
        return None, _err(401, 'UNAUTHENTICATED', 'User not found')
    return user, None


def _is_maintenance():
    """Maintenance flag is read from the system-config singleton."""
    cfg = db_utils.get_item('SYSTEM#config') or {}
    return str(cfg.get('serverStatus', 'OK')).upper() == _MAINTENANCE_VALUE


def _apply_default(row, raw_value):
    """Mirror of the Java/Python/PHP default-value parser."""
    if raw_value is None:
        return
    text = str(raw_value).strip()
    if text == '':
        row['stringValue'] = ''
        return
    try:
        row['intValue'] = int(text)
    except ValueError:
        row['stringValue'] = text


def _verify_turnstile(token, remote_ip=None):
    """Verify a Cloudflare Turnstile token. Returns True when the secret key is
    not configured (dev bypass), when the environment is non-prod AND the token
    matches the Robot-test bypass token, or when the token passes verification
    against Cloudflare."""
    if not _TURNSTILE_SECRET:
        return True
    if _ENV != 'prod' and _TURNSTILE_BYPASS_TOKEN and token == _TURNSTILE_BYPASS_TOKEN:
        return True
    if not token:
        return False
    try:
        data = {'secret': _TURNSTILE_SECRET, 'response': token}
        if remote_ip:
            data['remoteip'] = remote_ip
        encoded = urllib.parse.urlencode(data).encode('utf-8')
        req = urllib.request.Request(_SITEVERIFY_URL, data=encoded, method='POST')
        with urllib.request.urlopen(req, timeout=5) as resp:
            result = json.loads(resp.read())
            return result.get('success') is True
    except Exception:
        return False


def _new_match_uuid():
    return str(uuid_lib.uuid4())


def _ts_ms():
    return int(time.time() * 1000)


def _summary_from_item(item):
    return {
        "uuid": item.get("uuid"),
        "storyUuid": item.get("storyUuid"),
        "difficultyUuid": item.get("difficultyUuid"),
        "name": item.get("name"),
        "status": item.get("status"),
        "currentClock": int(item.get("currentClock", 0)),
        "expCost": int(item.get("expCost", 0)),
        "userCreatorUuid": item.get("userCreatorUuid"),
        "tsInsert": item.get("tsInsert"),
        # Step 0.19.9 — creator loadout chosen at match creation.
        "singlePlayer": item.get("singlePlayer"),
        "characterTemplateUuid": item.get("characterTemplateUuid"),
        "classUuid": item.get("classUuid"),
        "traitUuids": item.get("traitUuids") or [],
    }


def _detail_from_item(item):
    return {
        "match": _summary_from_item(item),
        "currentLocationId": item.get("currentLocationId"),
        "currentLocationUuid": item.get("currentLocationUuid"),
        "currentLocationName": item.get("currentLocationName"),
        "locations": item.get("locations", []),
        "registry": item.get("registry", []),
        "events": [],
        "choices": [],
    }


# ─── domain operations ───────────────────────────────────────────────────────

def _create_match(user, body):
    story_uuid = (body or {}).get('storyUuid')
    difficulty_uuid = (body or {}).get('difficultyUuid')
    if not story_uuid or not difficulty_uuid:
        return _err(400, 'INVALID_INPUT', 'storyUuid and difficultyUuid are required')

    turnstile_token = (body or {}).get('turnstileToken')
    remote_ip = None  # API GW v2 remoteIp not always in body; skip for now
    if not _verify_turnstile(turnstile_token, remote_ip):
        return _err(400, 'TURNSTILE_VALIDATION_FAILED', 'Turnstile verification failed')

    if _is_maintenance():
        return _err(503, 'MAINTENANCE_MODE', 'Server is under maintenance, no new match can be created')

    if user.get('state') in _BANNED_STATES:
        return _err(403, 'USER_BANNED', 'User is not allowed to create matches')

    story = db_utils.get_item(f'STORY#{story_uuid}')
    if story is None:
        return _err(404, 'STORY_NOT_FOUND', f'Story not found: {story_uuid}')

    difficulties = story.get('difficulties') or []
    matched_diff = next((d for d in difficulties if d.get('uuid') == difficulty_uuid), None)
    if matched_diff is None:
        return _err(404, 'DIFFICULTY_NOT_FOUND', f'Difficulty not found: {difficulty_uuid}')

    locations = story.get('locations') or []
    if not locations:
        return _err(400, 'STORY_HAS_NO_LOCATIONS', 'Story has no locations defined')

    keys = story.get('keys') or []

    now_ms = _ts_ms()
    match_uuid = _new_match_uuid()

    raw_single_player = (body or {}).get('singlePlayer')
    single_player = int(raw_single_player) if raw_single_player is not None else 1

    location_states = []
    for loc in locations:
        location_states.append({
            "idLocation": int(loc.get('id', 0)),
            "uuid": str(uuid_lib.uuid4()),
            "flagAlreadyActived": 0,
            "clockCounter": int(loc.get('counterStart') or loc.get('counter_time') or 0),
            "name": loc.get('name'),
        })

    registry = []
    next_id = 1
    for k in keys:
        row = {
            "id": next_id,
            "uuid": str(uuid_lib.uuid4()),
            "key": k.get('keyName') or k.get('name') or '',
            "stringValue": None,
            "intValue": None,
        }
        _apply_default(row, k.get('keyValue') or k.get('value'))
        registry.append(row)
        next_id += 1

    start_id = story.get('idLocationStart')
    start_loc = next((l for l in locations if int(l.get('id', -1)) == int(start_id or -1)), None)

    item = {
        "PK": f'MATCH#{match_uuid}',
        "SK": 'METADATA',
        "uuid": match_uuid,
        "storyUuid": story_uuid,
        "difficultyUuid": difficulty_uuid,
        "name": (body or {}).get('name'),
        "singlePlayer": single_player,
        "characterTemplateUuid": (body or {}).get('characterTemplateUuid'),
        "classUuid": (body or {}).get('classUuid'),
        "traitUuids": (body or {}).get('traitUuids') or [],
        "status": "CREATED",
        "currentClock": 0,
        "expCost": int(matched_diff.get('expCost') or 5),
        "userCreatorUuid": user['uuid'],
        "tsInsert": now_ms,
        "currentLocationId": int(start_id) if start_id is not None else None,
        "currentLocationUuid": (start_loc or {}).get('uuid'),
        "currentLocationName": (start_loc or {}).get('name'),
        "locations": location_states,
        "registry": registry,
        # GSI to list all matches owned by the user, newest first
        "GSI1_PK": f'USER_MATCHES#{user["uuid"]}',
        "GSI1_SK": f'MATCH#{now_ms:020d}#{match_uuid}',
    }
    db_utils.put_item(item)
    return _ok(_summary_from_item(item), status=201)


def _list_user_matches(user):
    items = db_utils.query_gsi('GSI1', f'USER_MATCHES#{user["uuid"]}') or []
    items_sorted = sorted(items, key=lambda i: i.get('tsInsert', 0), reverse=True)
    return _ok([_summary_from_item(i) for i in items_sorted])


def _list_all_matches():
    """Admin view — every match in the table, newest first."""
    items = db_utils.scan_pk_prefix('MATCH#') or []
    items_sorted = sorted(items, key=lambda i: i.get('tsInsert', 0), reverse=True)
    return _ok([_summary_from_item(i) for i in items_sorted])


def _get_match_info(user, match_uuid):
    if not match_uuid:
        return _err(400, 'INVALID_INPUT', 'Match uuid is required')
    item = db_utils.get_item(f'MATCH#{match_uuid}')
    if item is None or item.get('userCreatorUuid') != user['uuid']:
        return _err(404, 'MATCH_NOT_FOUND', 'Match not found or not accessible')
    return _ok(_detail_from_item(item))


def _end_match(user, match_uuid, event_uuid):
    """Step 20.1 — PATCH /api/match/{uuidMatch}/end/{uuidEvent}.
    Completes the match (status → ENDED) when the supplied event uuid resolves
    to the story's idEventEndGame. Caller must own the match. The
    idEventEndGame value itself is never returned to callers."""
    if not match_uuid or not event_uuid:
        return _err(400, 'INVALID_INPUT', 'Match uuid and event uuid are required')

    item = db_utils.get_item(f'MATCH#{match_uuid}')
    if item is None or item.get('userCreatorUuid') != user.get('uuid'):
        return _err(404, 'MATCH_NOT_FOUND', 'Match not found or not accessible')

    story = db_utils.get_item(f'STORY#{item.get("storyUuid")}')
    if story is None:
        return _err(406, 'EVENT_NOT_END_GAME',
                    'The supplied event is not the end-game event for this match')

    end_event_id = story.get('idEventEndGame')
    if end_event_id is None:
        return _err(406, 'EVENT_NOT_END_GAME',
                    'The supplied event is not the end-game event for this match')

    events = story.get('events') or []
    matched_event = next((e for e in events if e.get('uuid') == event_uuid), None)
    if matched_event is None or int(matched_event.get('id', -1)) != int(end_event_id):
        return _err(406, 'EVENT_NOT_END_GAME',
                    'The supplied event is not the end-game event for this match')

    item['status'] = 'ENDED'
    db_utils.put_item(item)
    return _ok({'status': 'ENDED', 'uuid': match_uuid})


# ─── admin match control ─────────────────────────────────────────────────────

def _get_admin_match_info(match_uuid):
    """Admin match detail — full runtime state without the per-user ownership
    check enforced by GET /api/match/{uuid}/info."""
    if not match_uuid:
        return _err(400, 'INVALID_INPUT', 'Match uuid is required')
    item = db_utils.get_item(f'MATCH#{match_uuid}')
    if item is None:
        return _err(404, 'MATCH_NOT_FOUND', f'Match not found: {match_uuid}')
    return _ok(_detail_from_item(item))


def _list_match_statuses():
    """The valid match statuses, each flagged ``terminal`` when a match in that
    status is stopped (deletable)."""
    return _ok([
        {"value": s, "terminal": s in TERMINAL_STATUSES} for s in MATCH_STATUSES
    ])


def _update_match(match_uuid, status, name):
    """Admin update of a match's status and/or name."""
    if status is not None and status not in MATCH_STATUSES:
        return _err(400, 'INVALID_STATUS', f'status must be one of {MATCH_STATUSES}')
    item = db_utils.get_item(f'MATCH#{match_uuid}')
    if item is None:
        return _err(404, 'MATCH_NOT_FOUND', f'Match not found: {match_uuid}')
    if status is not None:
        item['status'] = status
    if name is not None:
        item['name'] = name
    db_utils.put_item(item)
    return _ok({'status': 'UPDATED', 'uuid': match_uuid})


def _delete_match(match_uuid):
    """Admin deletion of a match. Only terminal (stopped) matches may be removed."""
    item = db_utils.get_item(f'MATCH#{match_uuid}')
    if item is None:
        return _err(404, 'MATCH_NOT_FOUND', f'Match not found: {match_uuid}')
    if str(item.get('status')) not in TERMINAL_STATUSES:
        return _err(409, 'MATCH_NOT_STOPPED',
                    'Only stopped matches (ENDED or GAMEOVER) can be deleted')
    db_utils.delete_item(item['PK'], item.get('SK', 'METADATA'))
    return _ok({'status': 'DELETED', 'uuid': match_uuid})


# ─── router ──────────────────────────────────────────────────────────────────

def lambda_handler(event, context):
    raw_path = event.get('rawPath') or event.get('path') or ''
    path = _normalize_path(raw_path)
    method = (event.get('requestContext', {})
              .get('http', {})
              .get('method', event.get('httpMethod', '')))

    if method == 'OPTIONS':
        return _ok({}, status=200)

    user, err = _resolve_user(event)
    if err is not None:
        return err

    # ── admin match routes (all require the ADMIN role) ──
    if path.startswith('/api/admin/matches'):
        if str(user.get('role', '')).upper() != 'ADMIN':
            return _err(403, 'FORBIDDEN', 'Admin access required')

        if path == '/api/admin/matches' and method == 'GET':
            return _list_all_matches()
        if path == '/api/admin/matches/statuses' and method == 'GET':
            return _list_match_statuses()

        # Parameterised routes: /api/admin/matches/{uuid}[/action]
        params = event.get('pathParameters') or {}
        match_uuid = params.get('uuidMatch') or ''
        if not match_uuid:
            segments = path.split('/')
            match_uuid = segments[4] if len(segments) > 4 else ''

        if path.endswith('/info') and method == 'GET':
            return _get_admin_match_info(match_uuid)
        if path.endswith('/stop') and method == 'POST':
            return _update_match(match_uuid, 'ENDED', None)
        if path.endswith('/pause') and method == 'POST':
            return _update_match(match_uuid, 'PAUSED', None)
        if path.endswith('/resume') and method == 'POST':
            return _update_match(match_uuid, 'RUNNING', None)
        if method == 'PUT':
            try:
                body = json.loads(event.get('body') or '{}')
            except (TypeError, ValueError):
                return _err(400, 'INVALID_INPUT', 'Body must be valid JSON')
            status_val = body.get('status')
            name_val = body.get('name')
            if status_val is None and name_val is None:
                return _err(400, 'INVALID_INPUT',
                            'At least one of status or name must be provided')
            return _update_match(match_uuid, status_val, name_val)
        if method == 'DELETE':
            return _delete_match(match_uuid)

        return _err(404, 'NOT_FOUND', f'Unknown route {method} {path}')

    if path == '/api/matches' and method == 'POST':
        try:
            body = json.loads(event.get('body') or '{}')
        except (TypeError, ValueError):
            return _err(400, 'INVALID_INPUT', 'Body must be valid JSON')
        return _create_match(user, body)

    if path == '/api/matches' and method == 'GET':
        return _list_user_matches(user)

    if path.startswith('/api/match/') and path.endswith('/info') and method == 'GET':
        params = (event.get('pathParameters') or {})
        match_uuid = params.get('uuidMatch')
        if not match_uuid:
            # Fallback when API Gateway didn't expose the path parameter
            segments = path.split('/')
            match_uuid = segments[3] if len(segments) > 4 else ''
        return _get_match_info(user, match_uuid)

    # Step 20.1 — PATCH /api/match/{uuidMatch}/end/{uuidEvent}
    if (path.startswith('/api/match/') and '/end/' in path and method == 'PATCH'):
        params = (event.get('pathParameters') or {})
        match_uuid = params.get('uuidMatch') or ''
        event_uuid = params.get('uuidEvent') or ''
        if not match_uuid or not event_uuid:
            # Fallback when API Gateway didn't expose the path parameters
            segments = path.split('/')
            # /api/match/{uuidMatch}/end/{uuidEvent} → 0:'' 1:'api' 2:'match' 3:uuidMatch 4:'end' 5:uuidEvent
            if len(segments) >= 6 and segments[4] == 'end':
                match_uuid = match_uuid or segments[3]
                event_uuid = event_uuid or segments[5]
        return _end_match(user, match_uuid, event_uuid)

    return _err(404, 'NOT_FOUND', f'Unknown route {method} {path}')
