"""
match/handler.py — Paths Games AWS Lambda — Step 19.

Implements the single-player match endpoints introduced in Step 19. The HTTP
contract follows the OpenAPI document
``code/backend/java/adapter-rest/src/main/resources/openapi/v0.19.0-match-creation-api.yaml``.

Routes registered in ``template/match.yaml``:

  POST /api/matches                  → create_match
  GET  /api/matches                  → list_user_matches
  GET  /api/match/{uuidMatch}/info   → get_match_info

DynamoDB layout:
  PK = MATCH#{uuid}, SK = METADATA
    Match metadata + embedded ``locations`` / ``registry`` lists.
    GSI1_PK = USER_MATCHES#{userUuid}, GSI1_SK = MATCH#{tsInsertMs}#{uuid}
"""

import json
import time
import uuid as uuid_lib
import decimal

from common import db_utils
from common import jwt_utils

# ─── shared helpers ──────────────────────────────────────────────────────────

HEADERS = {"Content-Type": "application/json"}

_BANNED_STATES = {3, 4}
_MAINTENANCE_VALUE = "MAINTENANCE"


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


def _get_match_info(user, match_uuid):
    if not match_uuid:
        return _err(400, 'INVALID_INPUT', 'Match uuid is required')
    item = db_utils.get_item(f'MATCH#{match_uuid}')
    if item is None or item.get('userCreatorUuid') != user['uuid']:
        return _err(404, 'MATCH_NOT_FOUND', 'Match not found or not accessible')
    return _ok(_detail_from_item(item))


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

    return _err(404, 'NOT_FOUND', f'Unknown route {method} {path}')
