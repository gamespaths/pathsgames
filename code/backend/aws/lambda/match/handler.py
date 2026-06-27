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
    GSI2_PK = MATCH,                   GSI2_SK = {tsInsertMs:020d}#{uuid}
      v0.28.1 "by type" index — backs the paginated admin list
      (GET /api/admin/matches) as a single Query instead of a full Scan.
"""

import json
import os
import random
import secrets
import time
import uuid as uuid_lib
import urllib.request
import urllib.parse

from common import db_utils
from common import jwt_utils
from common.response import dumps as _dumps, ok as _ok, HEADERS
from common.http_utils import (normalize_path as _normalize_path,
                               get_source_ip as _get_source_ip,
                               bearer_token as _bearer_token)
from common.data_utils import safe_int as _safe_int, resolve_raw_text as _resolve_raw_text

_TURNSTILE_SECRET = os.environ.get('TURNSTILE_SECRET_KEY', '')
# Optional Robot-test bypass token: when the current ENV is not "prod", the token
# is non-empty AND the incoming token equals this value, Turnstile verification
# is skipped. The env != prod guard is defense-in-depth on top of the deploy
# script that already refuses to inject this var in prod.
_TURNSTILE_BYPASS_TOKEN = os.environ.get('TURNSTILE_BYPASS_TOKEN', '')
_ENV = os.environ.get('ENV', 'dev')
_SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

# ─── shared helpers ──────────────────────────────────────────────────────────

_BANNED_STATES = {3, 4}
_MAINTENANCE_VALUE = "MAINTENANCE"
_MATCH_NOT_RUNNING_MSG = "Match is not RUNNING"
_API_MATCHES_PATH = "/api/matches/"
_API_GAMEPLAY_PATH = "/api/gameplay/"

# Lifecycle statuses of a match. A match is "stopped" (terminal) when it is
# ENDED or GAMEOVER; only stopped matches may be deleted by an admin.
MATCH_STATUSES = ["CREATED", "RUNNING", "PAUSED", "ENDED", "GAMEOVER"]
TERMINAL_STATUSES = {"ENDED", "GAMEOVER"}


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


def _check_admin_ip(event):
    """Return error response if caller IP not in ADMIN_IP_WHITELIST, else None."""
    whitelist_raw = os.environ.get('ADMIN_IP_WHITELIST', '').strip()
    if not whitelist_raw:
        return None
    allowed = [ip.strip() for ip in whitelist_raw.split(',') if ip.strip()]
    if not allowed:
        return None
    source_ip = _get_source_ip(event)
    if source_ip not in allowed:
        return _err(403, 'FORBIDDEN', f'IP {source_ip} not authorized for admin access')
    return None


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
    """Mirror of the Java/Python/AWS default-value parser."""
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
        "rngSeed": item.get("rngSeed"),
        "userCreatorUuid": item.get("userCreatorUuid"),
        "tsInsert": item.get("tsInsert"),
        # Step 0.19.9 — creator loadout chosen at match creation.
        "singlePlayer": item.get("singlePlayer"),
        "characterTemplateUuid": item.get("characterTemplateUuid"),
        "classUuid": item.get("classUuid"),
        "traitUuids": item.get("traitUuids") or [],
    }


def _detail_from_item(item, players=None, lang='en'):
    players = players or []
    lang = lang if lang and lang.strip() else 'en'
    # Locations currently occupied by one or more players (insertion-ordered).
    active_loc_ids = []
    for c in players:
        loc = c.get("idLocation")
        if loc is not None and loc not in active_loc_ids:
            active_loc_ids.append(loc)

    # The STORY item carries the enriched locations/neighbors/events (with cards).
    story = db_utils.get_item(f'STORY#{item.get("storyUuid")}') or {}

    # Current location reflects where the player actually is; fall back to the
    # value stored on the match (the story start location set at creation).
    current_id = active_loc_ids[0] if active_loc_ids else item.get("currentLocationId")
    current_uuid = item.get("currentLocationUuid")
    current_name = item.get("currentLocationName")
    if active_loc_ids:
        loc = next((l for l in (story.get("locations") or [])
                    if l.get("id") == current_id), None)
        if loc:
            current_uuid = loc.get("uuid")
            current_name = loc.get("name")

    return {
        "match": _summary_from_item(item),
        "currentLocationId": current_id,
        "currentLocationUuid": current_uuid,
        "currentLocationName": current_name,
        "locations": item.get("locations", []),
        "registry": item.get("registry", []),
        "events": [],
        "choices": [],
        # Step 21 — the players/characters of the match (summary rows).
        "players": [_character_summary(c) for c in players],
        # Step 27.x — enriched, player-occupied locations with card/neighbors/events.
        "locationsActive": _build_locations_active(story, active_loc_ids, lang),
    }


from common.data_utils import resolve_card_from_raw as _resolve_card_from_raw


def _story_neighbors(story):
    """Authoritative neighbor list for gameplay.

    Admin CRUD edits the `locationNeighbors` array (the content-API copy), while
    the seed writes only the gameplay `neighbors` array. Read `locationNeighbors`
    first so admin edits (direction, energyCost, idCard, idCardBack, …) are
    reflected in match-info and movement; fall back to `neighbors` for seeded
    stories that never carried a `locationNeighbors` copy."""
    return (story or {}).get('locationNeighbors') or (story or {}).get('neighbors') or []


def _event_location(event):
    """Owning location id of an event. `idSpecificLocation` is the admin-canonical
    field (what the admin form writes); `idLocation` is a legacy alias set only at
    import time and NOT refreshed on admin edits. Prefer idSpecificLocation so a
    location change in admin is reflected; fall back to idLocation for seeded events
    that only carry the alias."""
    e = event or {}
    return e.get('idSpecificLocation') if e.get('idSpecificLocation') is not None else e.get('idLocation')


def _build_locations_active(story, active_loc_ids, lang='en'):
    """Build the enriched ``locationsActive`` list from the STORY item: each
    player-occupied location with its card, the neighbor links touching it (both
    directions) and the events specific to it.

    Cards are ALWAYS resolved from idCard against the story's raw_cards/raw_texts
    at read time — any stale `card` object embedded on the stored item is ignored,
    matching the Java/Python backends (which resolve from id_card via list_cards)."""
    if not active_loc_ids:
        return []
    locations = story.get("locations") or []
    neighbors = _story_neighbors(story)
    events = story.get("events") or []
    raw_cards = story.get("raw_cards") or []
    raw_texts = story.get("raw_texts") or []
    end_event_id = story.get("idEventEndGame")
    loc_by_id = {l.get("id"): l for l in locations}

    result = []
    for loc_id in active_loc_ids:
        loc = loc_by_id.get(loc_id)
        if loc is None:
            continue

        neighbor_infos = []
        for n in neighbors:
            if n.get("idLocationFrom") == loc_id:
                other_id = n.get("idLocationTo")
            elif n.get("idLocationTo") == loc_id:
                other_id = n.get("idLocationFrom")
            else:
                continue
            other = loc_by_id.get(other_id)
            # idCard is the source of truth; fall back to the destination
            # location's idCard when the link itself carries none.
            neighbor_card_id = n.get("idCard")
            if neighbor_card_id is None and other is not None:
                neighbor_card_id = other.get("idCard")
            # Step 0.28.2 — optional "return" card: falls back to the forward card
            # (idCard) when the link defines no idCardBack.
            neighbor_card_back_id = n.get("idCardBack")
            if neighbor_card_back_id is None:
                neighbor_card_back_id = neighbor_card_id
            neighbor_infos.append({
                "idLocation": other_id,
                "uuid": other.get("uuid") if other else None,
                "direction": n.get("direction"),
                "flagBack": n.get("flagBack"),
                "energyCost": n.get("energyCost"),
                "card": _resolve_card_from_raw(raw_cards, raw_texts, neighbor_card_id, lang),
                "secureParam": other.get("secureParam") if other else None,
                "idLocationFrom": n.get("idLocationFrom"),
                "idLocationTo": n.get("idLocationTo"),
                "cardBack": _resolve_card_from_raw(raw_cards, raw_texts, neighbor_card_back_id, lang),
            })

        event_infos = [
            {"uuid": e.get("uuid"), "type": e.get("type"),
             "endGame": end_event_id is not None and e.get("id") == end_event_id,
             "card": _resolve_card_from_raw(raw_cards, raw_texts, e.get("idCard"), lang)}
            for e in events if _event_location(e) == loc_id
        ]

        result.append({
            "idLocation": loc_id,
            "uuid": loc.get("uuid"),
            "idCard": loc.get("idCard"),
            "card": _resolve_card_from_raw(raw_cards, raw_texts, loc.get("idCard"), lang),
            "secureParam": loc.get("secureParam"),
            "neighbors": neighbor_infos,
            "events": event_infos,
        })
    return result


# ─── Step 21 — character presenters & helpers ────────────────────────────────

def _character_summary(item):
    """Lightweight character row (players list / MatchInfo.players)."""
    return {
        "uuid": item.get("uuid"),
        "userUuid": item.get("userUuid"),
        "characterTemplateUuid": item.get("characterTemplateUuid"),
        "dexterity": int(item.get("dexterity", 0)),
        "intelligence": int(item.get("intelligence", 0)),
        "constitution": int(item.get("constitution", 0)),
        "energy": int(item.get("energy", 0)),
        "life": int(item.get("life", 0)),
        "sad": int(item.get("sad", 0)),
        # Step 27 — max statistics, carried weight and items list. The DynamoDB
        # schema has no inventory table yet, so weight=0 / items=[] for parity.
        "lifeMax": int(item.get("lifeMax", 0)),
        "energyMax": int(item.get("energyMax", 0)),
        "sadMax": int(item.get("sadMax", 0)),
        "weightMax": int(item.get("weightMax", 0)),
        "weight": 0,
        "items": [],
        "idLocation": item.get("idLocation"),
        "locationName": item.get("locationName"),
        "isSleeping": int(item.get("isSleeping", 0)),
        "isComa": int(item.get("isComa", 0)),
        "classUuid": item.get("classUuid"),
        "traitUuids": item.get("traitUuids", []),
    }


def _character_full(item):
    """Full character detail (join / character endpoint)."""
    return {
        "uuid": item.get("uuid"),
        "matchUuid": item.get("matchUuid"),
        "userUuid": item.get("userUuid"),
        "characterTemplateUuid": item.get("characterTemplateUuid"),
        "classUuid": item.get("classUuid"),
        "dexterity": int(item.get("dexterity", 0)),
        "intelligence": int(item.get("intelligence", 0)),
        "constitution": int(item.get("constitution", 0)),
        "energy": int(item.get("energy", 0)),
        "life": int(item.get("life", 0)),
        "sad": int(item.get("sad", 0)),
        # Step 27 — max statistics, carried weight and items list. The DynamoDB
        # schema has no inventory table yet, so weight=0 / items=[] for parity.
        "lifeMax": int(item.get("lifeMax", 0)),
        "energyMax": int(item.get("energyMax", 0)),
        "sadMax": int(item.get("sadMax", 0)),
        "weightMax": int(item.get("weightMax", 0)),
        "weight": 0,
        "items": [],
        "idLocation": item.get("idLocation"),
        "locationUuid": item.get("locationUuid"),
        "locationName": item.get("locationName"),
        "isSleeping": int(item.get("isSleeping", 0)),
        "isComa": int(item.get("isComa", 0)),
        "traitUuids": item.get("traitUuids") or [],
        "food": int(item.get("food", 0)),
        "magic": int(item.get("magic", 0)),
        "coin": int(item.get("coin", 0)),
    }


def _match_characters(match_uuid):
    """Return the CHARACTER# items stored under the match partition."""
    items = db_utils.query_by_pk(f'MATCH#{match_uuid}') or []
    return [i for i in items if str(i.get('SK', '')).startswith('CHARACTER#')]


def _nz(value):
    try:
        return int(value) if value is not None else 0
    except (TypeError, ValueError):
        return 0


_BONUS_KEYS = {"dex": "dex", "int": "int", "con": "con", "life": "life", "energy": "energy"}


def _sum_trait(traits, key):
    return sum(_nz(t.get(key)) for t in traits)


def _sum_bonus(bonuses, stat):
    return sum(_nz(b.get('value')) for b in bonuses
              if str(b.get('statistic', '')).lower() == stat)


def _resolve_and_validate_traits(story, clazz, difficulty, trait_uuids):
    """Step 23 — strict trait selection validation shared by create and join.

    Returns (traits, error_response): unknown uuids, duplicates, class
    incompatibilities and difficulty cost-budget overruns are rejected.
    A None/missing budget means "no limit"; blank uuids are ignored.
    """
    all_traits = story.get('traits') or []
    class_id = clazz.get('id') if clazz else None
    resolved = []
    seen = set()
    for uuid in (trait_uuids or []):
        if not uuid or not str(uuid).strip():
            continue
        key = str(uuid).strip()
        if key in seen:
            return None, _err(400, 'TRAIT_DUPLICATED', f'Trait selected more than once: {key}')
        seen.add(key)
        trait = next((t for t in all_traits if t.get('uuid') == key), None)
        if trait is None:
            return None, _err(400, 'TRAIT_NOT_FOUND', f'Trait not found: {key}')
        permitted = trait.get('idClassPermitted')
        prohibited = trait.get('idClassProhibited')
        if permitted is not None and (class_id is None or int(permitted) != int(class_id)):
            return None, _err(400, 'TRAIT_NOT_COMPATIBLE',
                              f'Trait {key} is permitted only for another class')
        if prohibited is not None and class_id is not None and int(prohibited) == int(class_id):
            return None, _err(400, 'TRAIT_NOT_COMPATIBLE',
                              f'Trait {key} is prohibited for the selected class')
        resolved.append(trait)
    if difficulty and resolved:
        total_positive = sum(_nz(t.get('costPositive')) for t in resolved)
        total_negative = sum(_nz(t.get('costNegative')) for t in resolved)
        positive_budget = difficulty.get('traitCostPositiveBudget')
        negative_budget = difficulty.get('traitCostNegativeBudget')
        if positive_budget is not None and total_positive > int(positive_budget):
            return None, _err(400, 'TRAIT_COST_EXCEEDED',
                              f'Total positive trait cost {total_positive} exceeds the difficulty budget {positive_budget}')
        if negative_budget is not None and total_negative > int(negative_budget):
            return None, _err(400, 'TRAIT_COST_EXCEEDED',
                              f'Total negative trait cost {total_negative} exceeds the difficulty budget {negative_budget}')
    return resolved, None


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

    # Step 23 — validate the creator loadout traits; an unknown class uuid is
    # treated as "no class" (permitted-restricted traits then fail).
    loadout_class = next((c for c in (story.get('classes') or [])
                          if c.get('uuid') == (body or {}).get('classUuid')), None)
    _, trait_err = _resolve_and_validate_traits(
        story, loadout_class, matched_diff, (body or {}).get('traitUuids'))
    if trait_err:
        return trait_err

    locations = story.get('locations') or []
    if not locations:
        return _err(400, 'STORY_HAS_NO_LOCATIONS', 'Story has no locations defined')

    keys = story.get('keys') or []

    now_ms = _ts_ms()
    match_uuid = _new_match_uuid()

    raw_single_player = (body or {}).get('singlePlayer')
    single_player = int(raw_single_player) if raw_single_player is not None else 1

    # Step 27 — deterministic per-match RNG seed (explicit or random).
    raw_seed = (body or {}).get('rngSeed')
    rng_seed = int(raw_seed) if raw_seed is not None else secrets.randbits(63)

    location_states = []
    for loc in locations:
        location_states.append({
            "idLocation": int(loc.get('id', 0)),
            "uuid": str(uuid_lib.uuid4()),
            "flagAlreadyActived": 0,
            "clockCounter": int(loc.get('counterTime') or loc.get('counter_time') or 0),
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
        "rngSeed": rng_seed,
        "currentWeatherId": None,
        "weatherLog": [],
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
        # v0.28.1 — "by type" index for the admin list (GET /api/admin/matches).
        # Constant PK groups every match in one partition; the ts-prefixed SK keeps
        # them ordered newest-first and lets sinceDays be a cheap SK range query.
        "GSI2_PK": 'MATCH',
        "GSI2_SK": f'{now_ms:020d}#{match_uuid}',
    }
    db_utils.put_item(item)
    return _ok(_summary_from_item(item), status=201)


def _list_user_matches(user):
    items = db_utils.query_gsi('GSI1', f'USER_MATCHES#{user["uuid"]}') or []
    items_sorted = sorted(items, key=lambda i: i.get('tsInsert', 0), reverse=True)
    return _ok([_summary_from_item(i) for i in items_sorted])


# Admin-list pagination bounds (v0.28.1).
_ADMIN_LIST_DEFAULT_LIMIT = 50
_ADMIN_LIST_MAX_LIMIT = 200
_MS_PER_DAY = 86_400_000


def _admin_list_limit(params):
    """Clamp the requested page size to [1, _ADMIN_LIST_MAX_LIMIT]."""
    raw = params.get('limit')
    if raw is None or str(raw).strip() == '':
        return _ADMIN_LIST_DEFAULT_LIMIT
    try:
        limit = int(raw)
    except (TypeError, ValueError):
        return _ADMIN_LIST_DEFAULT_LIMIT
    return max(1, min(limit, _ADMIN_LIST_MAX_LIMIT))


def _since_days_sk(params, now_ms):
    """Translate ?sinceDays=N into a GSI2_SK lower bound ('{ts:020d}').

    Returns None when sinceDays is absent or not a positive integer."""
    raw = params.get('sinceDays')
    if raw is None or str(raw).strip() == '':
        return None
    try:
        days = int(raw)
    except (TypeError, ValueError):
        return None
    if days <= 0:
        return None
    threshold = max(0, now_ms - days * _MS_PER_DAY)
    return f'{threshold:020d}'


def _list_all_matches(event):
    """Admin view — paginated, filterable list of matches (v0.28.1).

    Backed by the GSI2 "by type" index (GSI2_PK='MATCH'), so this is a single
    Query (newest-first) instead of a full-table Scan. Query params:

      limit      page size (default 50, max 200)
      cursor     opaque token from a previous nextCursor
      status     exact status filter (CREATED/RUNNING/PAUSED/ENDED/GAMEOVER)
      userUuid   filter by creator
      storyUuid  filter by story
      sinceDays  only matches created within the last N days (SK range)

    Response envelope: {"items": [...], "nextCursor": str|null, "limit": int}.
    """
    params = event.get('queryStringParameters') or {}
    limit = _admin_list_limit(params)
    start_key = db_utils.decode_cursor(params.get('cursor'))
    sk_from = _since_days_sk(params, int(time.time() * 1000))
    eq_filters = {
        'status': (params.get('status') or '').strip() or None,
        'userCreatorUuid': (params.get('userUuid') or '').strip() or None,
        'storyUuid': (params.get('storyUuid') or '').strip() or None,
    }
    items, last_key = db_utils.query_index_page(
        'GSI2', 'GSI2_PK', 'MATCH', sk_name='GSI2_SK', sk_from=sk_from,
        eq_filters=eq_filters, limit=limit, start_key=start_key, ascending=False,
    )
    return _ok({
        'items': [_summary_from_item(i) for i in items],
        'nextCursor': db_utils.encode_cursor(last_key),
        'limit': limit,
    })


def _get_match_info(user, match_uuid, lang='en'):
    if not match_uuid:
        return _err(400, 'INVALID_INPUT', 'Match uuid is required')
    item = db_utils.get_item(f'MATCH#{match_uuid}')
    if item is None or item.get('userCreatorUuid') != user['uuid']:
        return _err(404, 'MATCH_NOT_FOUND', 'Match not found or not accessible')
    return _ok(_detail_from_item(item, _match_characters(match_uuid), lang))


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


# ─── Step 21 — character join / players / detail ─────────────────────────────

def _validate_class(template, clazz):
    class_id = clazz.get('id')
    permitted = template.get('idClassPermitted')
    prohibited = template.get('idClassProhibited')
    if permitted is not None and permitted != class_id:
        return _err(409, 'CLASS_NOT_COMPATIBLE', 'Selected class is not permitted for this character template')
    if prohibited is not None and prohibited == class_id:
        return _err(409, 'CLASS_NOT_COMPATIBLE', 'Selected class is prohibited for this character template')
    return None


def _resolve_match_access(user, match_uuid):
    """Return ``(match_item, None)`` when the user may view the match (creator or
    participant), else ``(None, error_response)``."""
    item = db_utils.get_item(f'MATCH#{match_uuid}')
    if item is None:
        return None, _err(404, 'MATCH_NOT_FOUND', 'Match not found or not accessible')
    if item.get('userCreatorUuid') == user['uuid']:
        return item, None
    if any(c.get('userUuid') == user['uuid'] for c in _match_characters(match_uuid)):
        return item, None
    return None, _err(404, 'MATCH_NOT_FOUND', 'Match not found or not accessible')


def _join_match(user, match_uuid, body):
    if not match_uuid:
        return _err(400, 'INVALID_INPUT', 'Match uuid is required')
    match = db_utils.get_item(f'MATCH#{match_uuid}')
    if match is None:
        return _err(404, 'MATCH_NOT_FOUND', f'Match not found: {match_uuid}')
    if str(match.get('status')) in TERMINAL_STATUSES:
        return _err(409, 'MATCH_NOT_JOINABLE', 'Match is in a terminal status and cannot be joined')
    if user.get('state') in _BANNED_STATES:
        return _err(403, 'USER_BANNED', 'User is not allowed to join matches')
    existing = _match_characters(match_uuid)
    if any(c.get('userUuid') == user['uuid'] for c in existing):
        return _err(409, 'ALREADY_JOINED', 'User already has a character in this match')

    story = db_utils.get_item(f'STORY#{match.get("storyUuid")}')
    if story is None:
        return _err(404, 'MATCH_NOT_FOUND', 'Match story not found')

    body = body or {}
    template_uuid = body.get('characterTemplateUuid') or match.get('characterTemplateUuid')
    class_uuid = body.get('classUuid') or match.get('classUuid')
    trait_uuids = body.get('traitUuids') or match.get('traitUuids') or []
    if not template_uuid:
        return _err(400, 'INVALID_INPUT',
                    'characterTemplateUuid is required (none provided and none stored on the match)')

    template = next((t for t in (story.get('characterTemplates') or []) if t.get('uuid') == template_uuid), None)
    if template is None:
        return _err(404, 'TEMPLATE_NOT_FOUND', f'Character template not found: {template_uuid}')

    clazz = None
    if class_uuid:
        clazz = next((c for c in (story.get('classes') or []) if c.get('uuid') == class_uuid), None)
        if clazz is None:
            return _err(404, 'CLASS_NOT_FOUND', f'Class not found: {class_uuid}')
        compat_err = _validate_class(template, clazz)
        if compat_err:
            return compat_err

    difficulty = next((d for d in (story.get('difficulties') or [])
                       if d.get('uuid') == match.get('difficultyUuid')), None)
    traits, trait_err = _resolve_and_validate_traits(story, clazz, difficulty, trait_uuids)
    if trait_err:
        return trait_err
    bonuses = [b for b in (story.get('classBonuses') or [])
               if clazz is not None and b.get('idClass') == clazz.get('id')]

    cb = clazz or {}
    df = difficulty or {}
    dexterity = (_nz(template.get('dexterityStart')) + _nz(cb.get('dexterityBase'))
                 + _nz(df.get('dexterity')) + _sum_trait(traits, 'dexterity') + _sum_bonus(bonuses, 'dex'))
    intelligence = (_nz(template.get('intelligenceStart')) + _nz(cb.get('intelligenceBase'))
                    + _nz(df.get('intelligence')) + _sum_trait(traits, 'intelligence') + _sum_bonus(bonuses, 'int'))
    constitution = (_nz(template.get('constitutionStart')) + _nz(cb.get('constitutionBase'))
                    + _nz(df.get('constitution')) + _sum_trait(traits, 'constitution') + _sum_bonus(bonuses, 'con'))
    life_max = (_nz(template.get('lifeMax')) + _nz(df.get('life'))
                + _sum_trait(traits, 'life') + _sum_bonus(bonuses, 'life'))
    energy_max = (_nz(template.get('energyMax')) + _nz(df.get('energy'))
                  + _sum_trait(traits, 'energy') + _sum_bonus(bonuses, 'energy'))
    sad_max = (_nz(template.get('sadMax')) + _nz(df.get('sad'))
               + _sum_trait(traits, 'sad') + _sum_bonus(bonuses, 'sad'))
    # weight_max has no character-template contribution: the carry-capacity base
    # lives on the class, with difficulty/trait/bonus deltas on top.
    weight_max = (_nz(cb.get('weightMax')) + _nz(df.get('weight'))
                  + _sum_trait(traits, 'weight') + _sum_bonus(bonuses, 'weight'))

    char_uuid = str(uuid_lib.uuid4())
    char = {
        "PK": f'MATCH#{match_uuid}',
        "SK": f'CHARACTER#{char_uuid}',
        "id": len(existing) + 1,
        "uuid": char_uuid,
        "matchUuid": match_uuid,
        "userUuid": user['uuid'],
        "idCharacterTemplate": _nz(template.get('id_tipo')),
        "characterTemplateUuid": template_uuid,
        "classUuid": class_uuid,
        "dexterity": dexterity,
        "intelligence": intelligence,
        "constitution": constitution,
        "energy": energy_max,   # start full
        "life": life_max,       # start full
        "sad": 0,
        "lifeMax": life_max,
        "energyMax": energy_max,
        "sadMax": sad_max,
        "weightMax": weight_max,
        "idLocation": match.get('currentLocationId'),
        "locationUuid": match.get('currentLocationUuid'),
        "locationName": match.get('currentLocationName'),
        "isSleeping": 0,
        "isComa": 0,
        "traitUuids": [t.get('uuid') for t in traits],
        "food": 0,
        "magic": 0,
        "coin": 0,
    }
    db_utils.put_item(char)
    return _ok(_character_full(char), status=201)


def _list_players(user, match_uuid):
    if not match_uuid:
        return _err(400, 'INVALID_INPUT', 'Match uuid is required')
    _match, err = _resolve_match_access(user, match_uuid)
    if err:
        return err
    return _ok([_character_summary(c) for c in _match_characters(match_uuid)])


def _get_character(user, match_uuid, char_uuid):
    if not match_uuid or not char_uuid:
        return _err(400, 'INVALID_INPUT', 'Match uuid and character uuid are required')
    _match, err = _resolve_match_access(user, match_uuid)
    if err:
        return err
    item = db_utils.get_item(f'MATCH#{match_uuid}', f'CHARACTER#{char_uuid}')
    if item is None:
        return _err(404, 'CHARACTER_NOT_FOUND', 'Character not found or not accessible')
    return _ok(_character_full(item))


# ─── admin character statistics change ───────────────────────────────────────

def _change_statistics(match_uuid, player_uuid, body):
    """POST /api/admin/matches/{uuid}/player/{uuid}/changeStatistics.
    Updates the character's statistics. Fields set to -1 or absent are skipped.
    For energy/life/sad the value is capped at the corresponding max."""
    if not match_uuid:
        return _err(400, 'INVALID_INPUT', 'Match uuid is required')
    if not player_uuid:
        return _err(400, 'INVALID_INPUT', 'Player uuid is required')

    item = db_utils.get_item(f'MATCH#{match_uuid}', f'CHARACTER#{player_uuid}')
    if item is None:
        # player_uuid might be the character uuid stored in uuid field — scan characters
        chars = _match_characters(match_uuid)
        item = next((c for c in chars if c.get('uuid') == player_uuid), None)
    if item is None:
        # Try by match existence first
        match_item = db_utils.get_item(f'MATCH#{match_uuid}', 'METADATA')
        if match_item is None:
            return _err(404, 'MATCH_NOT_FOUND', f'Match not found: {match_uuid}')
        return _err(404, 'PLAYER_NOT_FOUND', f'Character not found: {player_uuid}')

    def _skip(v):
        return None if (v is None or v == -1) else int(v)

    dex    = _skip(body.get('dex'))
    intel  = _skip(body.get('intel'))
    con    = _skip(body.get('con'))
    energy = _skip(body.get('energy'))
    life   = _skip(body.get('life'))
    sad    = _skip(body.get('sad'))
    coin   = _skip(body.get('coin'))
    food   = _skip(body.get('food'))
    magic  = _skip(body.get('magic'))

    # Cap bounded stats at their max values
    if energy is not None:
        energy_max = _nz(item.get('energyMax'))
        if energy_max > 0:
            energy = min(energy, energy_max)
    if life is not None:
        life_max = _nz(item.get('lifeMax'))
        if life_max > 0:
            life = min(life, life_max)
    if sad is not None:
        sad_max = _nz(item.get('sadMax'))
        if sad_max > 0:
            sad = min(sad, sad_max)

    updates = {}
    if dex    is not None: updates['dexterity']    = dex
    if intel  is not None: updates['intelligence'] = intel
    if con    is not None: updates['constitution'] = con
    if energy is not None: updates['energy']       = energy
    if life   is not None: updates['life']         = life
    if sad    is not None: updates['sad']          = sad
    if coin   is not None: updates['coin']         = coin
    if food   is not None: updates['food']         = food
    if magic  is not None: updates['magic']        = magic

    if updates:
        updated = dict(item)
        updated.update(updates)
        db_utils.put_item(updated)

    return _ok({'status': 'UPDATED', 'matchUuid': match_uuid, 'playerUuid': player_uuid})


# ─── admin match control ─────────────────────────────────────────────────────

def _get_admin_match_info(match_uuid):
    """Admin match detail — full runtime state without the per-user ownership
    check enforced by GET /api/match/{uuid}/info."""
    if not match_uuid:
        return _err(400, 'INVALID_INPUT', 'Match uuid is required')
    item = db_utils.get_item(f'MATCH#{match_uuid}')
    if item is None:
        return _err(404, 'MATCH_NOT_FOUND', f'Match not found: {match_uuid}')
    return _ok(_detail_from_item(item, _match_characters(match_uuid)))


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


# ─── Step 24 — single-player turn cycle engine ───────────────────────────────

# Turn statuses (explicit lifecycle, source of truth for the queue).
TURN_WAITING = 'WAITING'
TURN_ACTIVE = 'ACTIVE'
TURN_COMPLETED = 'COMPLETED'


def _turn_priority(dexterity, intelligence, constitution, life, id_character):
    """priority = (DEX*3 + INT*2 + COS*1) * 1000 + LIFE*10 + idCharacter (higher acts first)."""
    stats = _nz(dexterity) * 3 + _nz(intelligence) * 2 + _nz(constitution)
    return stats * 1000 + _nz(life) * 10 + _nz(id_character)


def _turn_items(match_uuid):
    """Return the TURN# queue items stored under the match partition."""
    items = db_utils.query_by_pk(f'MATCH#{match_uuid}') or []
    return [i for i in items if str(i.get('SK', '')).startswith('TURN#')]


def _turn_entry(item):
    return {
        "characterUuid": item.get('characterUuid'),
        "idCharacter": _nz(item.get('idCharacter')),
        "name": item.get('name'),
        "priority": _nz(item.get('priority')),
        "clock": _nz(item.get('clock')),
        "status": item.get('status'),
        "passCounter": _nz(item.get('passCounter')),
        "timestampStart": item.get('timestampStart'),
        "timestampEnd": item.get('timestampEnd'),
    }


def _sequence_response(match, rows):
    rows_sorted = sorted(rows, key=lambda r: _nz(r.get('priority')), reverse=True)
    return {
        "matchUuid": match.get('uuid'),
        "currentClock": _nz(match.get('currentClock')),
        "status": match.get('status'),
        "activeCharacterUuid": match.get('activeCharacterUuid'),
        "queue": [_turn_entry(r) for r in rows_sorted],
    }


def _require_owned_match(user, match_uuid):
    """Return ``(match_item, None)`` when the user owns the match, else
    ``(None, error_response)``. Ownership errors are reported as 404."""
    if not match_uuid:
        return None, _err(400, 'INVALID_INPUT', 'Match uuid is required')
    item = db_utils.get_item(f'MATCH#{match_uuid}')
    if item is None or item.get('userCreatorUuid') != user.get('uuid'):
        return None, _err(404, 'MATCH_NOT_FOUND', 'Match not found or not accessible')
    return item, None


def _start_match(user, match_uuid):
    match, err = _require_owned_match(user, match_uuid)
    if err:
        return err
    if match.get('status') != 'CREATED':
        return _err(409, 'MATCH_NOT_STARTABLE', 'Match is not in CREATED state')

    characters = _match_characters(match_uuid)
    if not characters:
        return _err(409, 'NO_CHARACTERS_JOINED', 'No character has joined the match')

    clock = _nz(match.get('currentClock'))
    rows = []
    for c in characters:
        priority = _turn_priority(c.get('dexterity'), c.get('intelligence'),
                                  c.get('constitution'), c.get('life'), c.get('id'))
        rows.append({
            "idCharacter": _nz(c.get('id')),
            "characterUuid": c.get('uuid'),
            "priority": priority,
            "clock": clock,
            "status": TURN_WAITING,
            "passCounter": 0,
        })
    rows.sort(key=lambda r: r['priority'], reverse=True)
    rows[0]['status'] = TURN_ACTIVE
    top = rows[0]

    for r in rows:
        db_utils.put_item({
            "PK": f'MATCH#{match_uuid}',
            "SK": f'TURN#{r["characterUuid"]}',
            **r,
        })

    match['status'] = 'RUNNING'
    match['activeCharacterUuid'] = top['characterUuid']

    # Step 27: select the initial weather for clock 0 when the match starts.
    story = db_utils.get_item(f'STORY#{match.get("storyUuid")}') or {}
    _apply_weather_at_time_start(match, match_uuid, story)

    db_utils.put_item(match)

    return _ok(_sequence_response(match, rows))


def _pass_turn(user, match_uuid):
    match, err = _require_owned_match(user, match_uuid)
    if err:
        return err
    if match.get('status') != 'RUNNING':
        return _err(409, 'MATCH_NOT_RUNNING', _MATCH_NOT_RUNNING_MSG)

    characters = {c.get('uuid'): c for c in _match_characters(match_uuid)}
    rows = sorted(_turn_items(match_uuid), key=lambda r: _nz(r.get('priority')), reverse=True)
    if not rows:
        return _err(409, 'MATCH_NOT_RUNNING', 'No active turn to pass')

    active = next((r for r in rows if r.get('status') == TURN_ACTIVE), None)
    if active is None and match.get('activeCharacterUuid'):
        active = next((r for r in rows
                       if r.get('characterUuid') == match.get('activeCharacterUuid')), None)
    if active is None:
        return _err(409, 'MATCH_NOT_RUNNING', 'No active turn to pass')

    active_char = characters.get(active.get('characterUuid'))
    if active_char is None or active_char.get('userUuid') != user.get('uuid'):
        return _err(409, 'NOT_YOUR_TURN', 'It is not your character\'s turn')

    # Complete the current turn.
    active['status'] = TURN_COMPLETED
    active['passCounter'] = _nz(active.get('passCounter')) + 1
    db_utils.put_item(active)

    # Find the next WAITING character; if none, start a new round (reset all to WAITING).
    waiting = [r for r in rows if r.get('status') == TURN_WAITING]
    if not waiting:
        for r in rows:
            r['status'] = TURN_WAITING
            db_utils.put_item(r)
        waiting = list(rows)
    waiting.sort(key=lambda r: _nz(r.get('priority')), reverse=True)
    nxt = waiting[0]

    nxt['status'] = TURN_ACTIVE
    db_utils.put_item(nxt)

    match['activeCharacterUuid'] = nxt.get('characterUuid')
    db_utils.put_item(match)

    return _ok({
        "matchUuid": match.get('uuid'),
        "passedCharacterUuid": active.get('characterUuid'),
        "nextActiveCharacterUuid": nxt.get('characterUuid'),
        "status": 'RUNNING',
    })


def _get_turn_sequence(user, match_uuid):
    match, err = _require_owned_match(user, match_uuid)
    if err:
        return err
    rows = _turn_items(match_uuid)
    return _ok(_sequence_response(match, rows))


# ─── Step 25 — time advancement & clock cycle ────────────────────────────────

def _all_characters_done(characters):
    """Time-end trigger: every character is sleeping OR out of energy.
    In single-player the list is size 1. An empty list never triggers."""
    if not characters:
        return False
    for c in characters:
        done = _nz(c.get('isSleeping')) == 1 or _nz(c.get('energy')) <= 0
        if not done:
            return False
    return True


def _clamp(value, low, high):
    if high < low:
        return low
    return max(low, min(high, value))


def _compute_recovery(dexterity, intelligence, constitution, energy, life, sad,
                      energy_max, life_max, sad_max, safe, p, difficulty_energy,
                      bonus_energy, bonus_life, bonus_sad):
    """Step 26 — pure recovery math (safe/unsafe + class bonuses + clamping)."""
    secure_param = p - difficulty_energy
    new_energy = energy + dexterity + p if safe else energy + difficulty_energy
    new_life = life
    new_sad = sad
    if safe:
        new_life = life + constitution + secure_param
        new_sad = sad - (intelligence + secure_param)
    new_energy += bonus_energy
    new_life += bonus_life
    new_sad += bonus_sad
    return (_clamp(new_energy, 0, energy_max),
            _clamp(new_life, 0, life_max),
            _clamp(new_sad, 0, sad_max))


def _apply_time_start_recovery(match, match_uuid, story):
    """Step 26 — recover stats, apply class bonuses, decrement location counters.

    Safe (secureParam > 0): energy += DEX + P, life += COS + secureParam, sadness -= INT + secureParam.
    Unsafe: energy += difficulty.energy only (no DEX, no secureParam).
    Counter-zero locations are flagged with a ``pendingEvent``
    marker (actual event execution is wired in Step 29). Returns the recovery
    recap (per-character deltas)."""
    diff = next((d for d in (story.get('difficulties') or [])
                 if d.get('uuid') == match.get('difficultyUuid')), {}) or {}
    difficulty_energy = _nz(diff.get('energy'))
    story_locations = {int(l.get('id', -1)): l for l in (story.get('locations') or [])}
    class_bonuses = story.get('classBonuses') or []
    class_id_by_uuid = {c.get('uuid'): c.get('id') for c in (story.get('classes') or [])}

    characters = list(_match_characters(match_uuid))
    occupied_ids = {_nz(c.get('idLocation')) for c in characters
                    if c.get('idLocation') is not None}

    recaps = []
    for c in characters:
        loc = story_locations.get(_nz(c.get('idLocation')))
        secure_param = _nz(loc.get('secureParam')) if loc else 0
        safe = secure_param > 0
        p = secure_param + difficulty_energy
        class_id = class_id_by_uuid.get(c.get('classUuid'))
        bonuses = [b for b in class_bonuses if b.get('idClass') == class_id]
        energy, life, sad = _compute_recovery(
            _nz(c.get('dexterity')), _nz(c.get('intelligence')), _nz(c.get('constitution')),
            _nz(c.get('energy')), _nz(c.get('life')), _nz(c.get('sad')),
            _nz(c.get('energyMax')), _nz(c.get('lifeMax')), _nz(c.get('sadMax')),
            safe, p, difficulty_energy,
            _sum_bonus(bonuses, 'energy'), _sum_bonus(bonuses, 'life'),
            _sum_bonus(bonuses, 'sad'))
        recaps.append({
            "characterUuid": c.get('uuid'),
            "energyDelta": energy - _nz(c.get('energy')),
            "lifeDelta": life - _nz(c.get('life')),
            "sadDelta": sad - _nz(c.get('sad')),
        })
        c['energy'], c['life'], c['sad'] = energy, life, sad
        db_utils.put_item(c)

    # Re-seed location counters that were pre-created with 0 (match created before
    # counter_time was set on the location) when the character is now occupying them.
    for ls in (match.get('locations') or []):
        id_location = _nz(ls.get('idLocation'))
        if id_location not in occupied_ids:
            continue
        if _nz(ls.get('clockCounter')) != 0:
            continue
        if _nz(ls.get('flagAlreadyActived')) != 0:
            continue
        loc = story_locations.get(id_location)
        counter_time = _nz((loc or {}).get('counterTime') or (loc or {}).get('counter_time'))
        if counter_time > 0:
            ls['clockCounter'] = counter_time

    # Decrement location counters on the embedded match state; flag zeros.
    for ls in (match.get('locations') or []):
        current = _nz(ls.get('clockCounter'))
        if current <= 0:
            continue
        nxt = current - 1
        ls['clockCounter'] = nxt
        if nxt == 0:
            loc = story_locations.get(_nz(ls.get('idLocation')))
            ls['pendingEvent'] = (loc or {}).get('idEventIfCounterZero')
            ls['flagAlreadyActived'] = 1
    return recaps


# ─── Step 27 — weather selection & effects ───────────────────────────────────

def _weather_time_matches(rule, clock):
    """A null bound is open; otherwise clock must fall inside [timeStart, timeEnd]."""
    time_from = rule.get('timeStart')
    time_to = rule.get('timeEnd')
    if time_from is not None and clock < time_from:
        return False
    return time_to is None or clock <= time_to


def _weather_condition_matches(rule, registry):
    """No conditionKey → always matches; otherwise the registry value must equal it."""
    key = rule.get('conditionKey')
    if not key:
        return True
    actual = None
    for r in (registry or []):
        if r.get('key') == key:
            if r.get('stringValue') is not None:
                actual = r.get('stringValue')
            elif r.get('intValue') is not None:
                actual = str(r.get('intValue'))
            break
    expected = rule.get('conditionValue')
    return actual is None if expected is None else expected == actual


def _weather_weighted_pick(eligible, seed):
    """Weighted roll across eligible rules (weight = probability); deterministic."""
    ordered = sorted(eligible, key=lambda r: _nz(r.get('id')))
    total = sum(max(0.0, float(r.get('probability') or 0)) for r in ordered)
    if total <= 0:
        return ordered[0]
    # Coerce to int: DynamoDB Decimal seeds are not accepted by random.Random().
    # Safe: seed is provided externally (deterministic, not for security).
    roll = random.Random(int(seed)).random() * total
    cumulative = 0.0
    for r in ordered:
        cumulative += max(0.0, float(r.get('probability') or 0))
        if roll < cumulative:
            return r
    return ordered[-1]


def _apply_weather_at_time_start(match, match_uuid, story):
    """Select the weather for the current clock, apply its energy delta, store it
    on the match and append a log_weather entry. Mirrors the Java/Python engine."""
    rules = story.get('weatherRules') or []
    clock = _nz(match.get('currentClock'))
    eligible = [r for r in rules
                if _nz(r.get('isActive', 1)) != 0
                and _weather_time_matches(r, clock)
                and _weather_condition_matches(r, match.get('registry'))]
    if not eligible:
        match['currentWeatherId'] = None
        return None

    # DynamoDB returns numbers as Decimal, but random.Random() only accepts
    # int/float/str/bytes — coerce the seed to int (Decimal would raise TypeError).
    seed_base = match.get('rngSeed')
    seed = _nz(seed_base) if seed_base is not None else _nz(story.get('id'))
    seed += clock
    chosen = _weather_weighted_pick(eligible, seed)

    match['currentWeatherId'] = chosen.get('id')
    log = match.get('weatherLog')
    if not isinstance(log, list):
        log = []
    log.append({"id": len(log) + 1, "clock": clock, "idWeather": chosen.get('id'),
                "weatherUuid": chosen.get('uuid'), "timestampStart": _ts_ms()})
    match['weatherLog'] = log

    delta = _nz(chosen.get('deltaEnergy'))
    if delta != 0:
        for c in _match_characters(match_uuid):
            new_energy = _clamp(_nz(c.get('energy')) + delta, 0, _nz(c.get('energyMax')))
            if new_energy != _nz(c.get('energy')):
                c['energy'] = new_energy
                db_utils.put_item(c)
    return chosen


def _resolve_weather_name(raw_cards, raw_texts, id_text_name, id_card, lang='en'):
    """A weather rule's display name: the id_text_name text, falling back to the
    title text of the weather's card (Step 27)."""
    name = _resolve_raw_text(raw_texts, id_text_name, lang)
    if name:
        return name
    card = _resolve_card_from_raw(raw_cards, raw_texts, id_card, lang)
    return card.get('title') if card else None


def _current_weather_payload(match, story, lang='en'):
    """Resolve the match's current weather rule into the REST response shape,
    including its idCard and the resolved card (Step 27)."""
    id_weather = match.get('currentWeatherId')
    if id_weather is None:
        return None
    rule = next((r for r in (story.get('weatherRules') or [])
                 if _nz(r.get('id')) == _nz(id_weather)), None)
    if rule is None:
        return None
    raw_cards = story.get('raw_cards') or []
    raw_texts = story.get('raw_texts') or []
    return {
        "idWeather": rule.get('id'),
        "uuid": rule.get('uuid'),
        "idTextName": rule.get('idTextName'),
        "idCard": rule.get('idCard'),
        "card": _resolve_card_from_raw(raw_cards, raw_texts, rule.get('idCard'), lang),
        "deltaEnergy": rule.get('deltaEnergy'),
        "costMoveSafeLocation": rule.get('costMoveSafeLocation'),
        "costMoveNotSafeLocation": rule.get('costMoveNotSafeLocation'),
        "currentClock": _nz(match.get('currentClock')),
    }


def _get_weather(match_uuid, lang='en'):
    """GET /api/matches/{uuid}/weather — current weather + card + movement modifiers."""
    if not match_uuid or not match_uuid.strip():
        return _err(400, 'INVALID_INPUT', 'Match uuid is required')
    match = db_utils.get_item(f'MATCH#{match_uuid}')
    if match is None:
        return _err(404, 'WEATHER_NOT_FOUND', 'No weather is currently set for this match')
    story = db_utils.get_item(f'STORY#{match.get("storyUuid")}') or {}
    payload = _current_weather_payload(match, story, lang)
    if payload is None:
        return _err(404, 'WEATHER_NOT_FOUND', 'No weather is currently set for this match')
    return _ok(payload)


def _get_admin_match_weather(match_uuid):
    """GET /api/admin/matches/{uuid}/weather — rng_seed + current + log_weather."""
    if not match_uuid or not match_uuid.strip():
        return _err(400, 'INVALID_INPUT', 'Match uuid is required')
    match = db_utils.get_item(f'MATCH#{match_uuid}')
    if match is None:
        return _err(404, 'MATCH_NOT_FOUND', f'Match not found: {match_uuid}')
    story = db_utils.get_item(f'STORY#{match.get("storyUuid")}') or {}
    all_rules = story.get('weatherRules') or []
    raw_cards = story.get('raw_cards') or []
    raw_texts = story.get('raw_texts') or []
    rules_by_id = {_nz(r.get('id')): r for r in all_rules}
    current_id = _nz(match.get('currentWeatherId')) if match.get('currentWeatherId') is not None else None
    rules = [{
        "id": r.get('id'),
        "uuid": r.get('uuid'),
        "idTextName": r.get('idTextName'),
        "name": _resolve_weather_name(raw_cards, raw_texts, r.get('idTextName'), r.get('idCard')),
        "probability": r.get('probability'),
        "deltaEnergy": r.get('deltaEnergy'),
        "costMoveSafeLocation": r.get('costMoveSafeLocation'),
        "costMoveNotSafeLocation": r.get('costMoveNotSafeLocation'),
        "active": _nz(r.get('isActive', 1)) != 0,
        "current": current_id is not None and _nz(r.get('id')) == current_id,
    } for r in all_rules]
    log = []
    for entry in (match.get('weatherLog') or []):
        rule = rules_by_id.get(_nz(entry.get('idWeather')))
        log.append({
            "id": entry.get('id'),
            "uuid": entry.get('weatherUuid'),
            "clock": entry.get('clock'),
            "idWeather": entry.get('idWeather'),
            "weatherUuid": (rule or {}).get('uuid') or entry.get('weatherUuid'),
            "idTextName": (rule or {}).get('idTextName'),
            "timestampStart": entry.get('timestampStart'),
        })
    return _ok({
        "rngSeed": match.get('rngSeed'),
        "current": _current_weather_payload(match, story),
        "rules": rules,
        "log": log,
    })


def _advance_time(match, match_uuid):
    """Advance the clock: log the advance, wake characters, rebuild the queue."""
    new_clock = _nz(match.get('currentClock')) + 1
    match['currentClock'] = new_clock

    # Append a clock-history item under the match partition.
    db_utils.put_item({
        "PK": f'MATCH#{match_uuid}',
        "SK": f'CLOCK#{new_clock}',
        "clock": new_clock,
        "timestampStart": _ts_ms(),
    })

    # Wake every character.
    for c in _match_characters(match_uuid):
        if _nz(c.get('isSleeping')) == 1:
            c['isSleeping'] = 0
            db_utils.put_item(c)

    # Step 26: per-character recovery, class bonuses and location counters.
    story = db_utils.get_item(f'STORY#{match.get("storyUuid")}') or {}
    recovery = _apply_time_start_recovery(match, match_uuid, story)
    # Step 27: select the weather for the new time unit and apply its energy delta.
    _apply_weather_at_time_start(match, match_uuid, story)

    # Rebuild the turn queue for the new clock (all WAITING, highest priority ACTIVE).
    characters = _match_characters(match_uuid)
    rows = []
    for c in characters:
        priority = _turn_priority(c.get('dexterity'), c.get('intelligence'),
                                  c.get('constitution'), c.get('life'), c.get('id'))
        rows.append({
            "idCharacter": _nz(c.get('id')),
            "characterUuid": c.get('uuid'),
            "priority": priority,
            "clock": new_clock,
            "status": TURN_WAITING,
            "passCounter": 0,
        })
    rows.sort(key=lambda r: r['priority'], reverse=True)
    if rows:
        rows[0]['status'] = TURN_ACTIVE
        match['activeCharacterUuid'] = rows[0]['characterUuid']
    for r in rows:
        db_utils.put_item({
            "PK": f'MATCH#{match_uuid}',
            "SK": f'TURN#{r["characterUuid"]}',
            **r,
        })

    db_utils.put_item(match)
    # A TimeAdvanced domain event would be published here (WebSocket broadcast: Step 64).
    return new_clock, recovery


def _sleep(user, match_uuid):
    if not match_uuid:
        return _err(400, 'INVALID_INPUT', 'Match uuid is required')
    match = db_utils.get_item(f'MATCH#{match_uuid}')
    if match is None:
        return _err(404, 'MATCH_NOT_FOUND', 'Match not found or not accessible')

    # The caller must own a character in this match (mask as not-found otherwise).
    caller = next((c for c in _match_characters(match_uuid)
                   if c.get('userUuid') == user.get('uuid')), None)
    if caller is None:
        return _err(404, 'MATCH_NOT_FOUND', 'Match not found or not accessible')

    if match.get('status') != 'RUNNING':
        return _err(409, 'MATCH_NOT_RUNNING', _MATCH_NOT_RUNNING_MSG)

    # Idempotent: setting sleeping on an already-sleeping character is a no-op effect.
    caller['isSleeping'] = 1
    db_utils.put_item(caller)

    # Re-read so the trigger sees the just-applied sleep flag.
    characters = _match_characters(match_uuid)
    triggered = _all_characters_done(characters)

    current_clock = _nz(match.get('currentClock'))
    recovery = []
    if triggered:
        current_clock, recovery = _advance_time(match, match_uuid)

    return _ok({
        "matchUuid": match.get('uuid'),
        "characterUuid": caller.get('uuid'),
        "isSleeping": not triggered,  # woke up at time start when triggered
        "timeEndTriggered": triggered,
        "currentClock": current_clock,
        "recovery": recovery,
    })


def _story_clock_label(story, direct_key, text_field, lang='en'):
    """Resolve a clock label from the STORY item.

    Prefers the pre-resolved description persisted on the item (seed / import),
    falling back to resolving it from the item's multi-lang ``texts`` map
    (``texts[lang][text_field]`` with English fallback). This keeps the clock
    labels populated regardless of which write path created the story.
    """
    direct = story.get(direct_key)
    if direct:
        return direct
    texts = story.get('texts') or {}
    lang_texts = texts.get(lang) or texts.get('en') or {}
    return lang_texts.get(text_field)


def _get_clock(user, match_uuid):
    match, err = _require_owned_match(user, match_uuid)
    if err:
        return err
    characters = _match_characters(match_uuid)
    story = db_utils.get_item(f'STORY#{match.get("storyUuid")}') or {}
    any_sleeping = any(_nz(c.get('isSleeping')) == 1 for c in characters)
    return _ok({
        "matchUuid": match.get('uuid'),
        "currentClock": _nz(match.get('currentClock')),
        "clockLabelSingular": _story_clock_label(story, 'clockSingularDescription', 'clockSingular'),
        "clockLabelPlural": _story_clock_label(story, 'clockPluralDescription', 'clockPlural'),
        "anyCharacterSleeping": any_sleeping,
        "characters": [
            {
                "characterUuid": c.get('uuid'),
                "isSleeping": _nz(c.get('isSleeping')) == 1,
                "energy": _nz(c.get('energy')),
            }
            for c in characters
        ],
    })


# ─── Step 28 — movement system ────────────────────────────────────────────────

def _registry_value(registry, key):
    """Current registry value for a key (string/int), or None when absent."""
    for r in (registry or []):
        if r.get('key') == key:
            if r.get('stringValue') is not None:
                return r.get('stringValue')
            if r.get('intValue') is not None:
                return str(r.get('intValue'))
            return None
    return None


def _current_weather_rule(match, story):
    """The match's current weather rule from the STORY item, or None."""
    id_weather = match.get('currentWeatherId')
    if id_weather is None:
        return None
    return next((r for r in (story.get('weatherRules') or [])
                 if _nz(r.get('id')) == _nz(id_weather)), None)


def _movement_total_cost(edge, target, weather_rule):
    """Returns (total, breakdown): edge cost + target entry cost + weather modifier
    (safe vs unsafe). The breakdown explains the total for diagnostics/logging."""
    safe = _nz(target.get('secureParam')) > 0
    weather_modifier = 0
    if weather_rule is not None:
        weather_modifier = _nz(weather_rule.get('costMoveSafeLocation') if safe
                               else weather_rule.get('costMoveNotSafeLocation'))
    edge_cost = _nz(edge.get('energyCost'))
    entry_cost = _nz(target.get('costEnergyEnter'))
    total = edge_cost + entry_cost + weather_modifier
    breakdown = {'edge': edge_cost, 'entry': entry_cost,
                 'weather': weather_modifier, 'safe': safe}
    return total, breakdown


def _find_edge(neighbors, from_id, to_id):
    for n in (neighbors or []):
        a, b = n.get('idLocationFrom'), n.get('idLocationTo')
        if (a == from_id and b == to_id) or (a == to_id and b == from_id):
            return n
    return None


def _start_movement(user, match_uuid, body):
    if not match_uuid:
        return _err(400, 'INVALID_INPUT', 'Match uuid is required')
    target_uuid = (body or {}).get('targetLocationUuid')
    if not target_uuid:
        return _err(400, 'MISSING_TARGET', 'targetLocationUuid is required')

    match = db_utils.get_item(f'MATCH#{match_uuid}')
    if match is None:
        return _err(404, 'MATCH_NOT_FOUND', 'Match not found or not accessible')

    caller = next((c for c in _match_characters(match_uuid)
                   if c.get('userUuid') == user.get('uuid')), None)
    if caller is None:
        return _err(404, 'MATCH_NOT_FOUND', 'Match not found or not accessible')

    if match.get('status') != 'RUNNING':
        return _err(409, 'MATCH_NOT_RUNNING', _MATCH_NOT_RUNNING_MSG)
    if _nz(caller.get('isSleeping')) == 1 or _nz(caller.get('isComa')) == 1:
        return _err(409, 'CHARACTER_CANNOT_ACT', 'Character cannot move while sleeping or in coma')
    if caller.get('idLocation') is None:
        return _err(409, 'NOT_A_NEIGHBOR', 'Character has no current location')

    story = db_utils.get_item(f'STORY#{match.get("storyUuid")}') or {}
    locations = story.get('locations') or []
    target = next((l for l in locations if l.get('uuid') == target_uuid), None)
    if target is None:
        return _err(409, 'NOT_A_NEIGHBOR', 'Target location is not a neighbor')

    from_id = caller.get('idLocation')
    edge = _find_edge(_story_neighbors(story), from_id, target.get('id'))
    if edge is None:
        return _err(409, 'NOT_A_NEIGHBOR', 'Target location is not a neighbor')

    cond_key = edge.get('conditionKey') or edge.get('conditionRegistryKey')
    if cond_key:
        cond_value = edge.get('conditionValue') or edge.get('conditionRegistryValue')
        if _registry_value(match.get('registry'), cond_key) != cond_value:
            return _err(409, 'MOVEMENT_CONDITION_NOT_MET', 'Movement condition not met')

    total_cost, cost_breakdown = _movement_total_cost(
        edge, target, _current_weather_rule(match, story))
    energy = _nz(caller.get('energy'))

    # Step 34 owns the weight formula; carried weight is 0 until inventory exists.
    if 0 > _nz(caller.get('weightMax')):
        return _err(409, 'OVERWEIGHT', 'Carried weight exceeds capacity')
    if energy < total_cost:
        return _err(
            409, 'INSUFFICIENT_ENERGY',
            "Not enough energy: have {have}, need {need} "
            "(edge {edge} + entry {entry} + weather {weather}; target {safety})".format(
                have=energy, need=total_cost,
                edge=cost_breakdown['edge'], entry=cost_breakdown['entry'],
                weather=cost_breakdown['weather'],
                safety='safe' if cost_breakdown['safe'] else 'unsafe'))

    max_chars = _nz(target.get('maxCharacters'))
    if max_chars > 0:
        count = sum(1 for c in _match_characters(match_uuid) if c.get('idLocation') == target.get('id'))
        if count >= max_chars:
            return _err(409, 'LOCATION_FULL', 'Target location is at capacity')

    new_energy = energy - total_cost
    caller['idLocation'] = target.get('id')
    caller['locationUuid'] = target.get('uuid')
    caller['energy'] = new_energy
    db_utils.put_item(caller)

    # Append a movement log entry on the match item (used to derive visited locations).
    movement_log = match.get('movementLog') or []
    movement_log.append({
        "characterUuid": caller.get('uuid'),
        "idLocationFrom": from_id,
        "idLocationTo": target.get('id'),
        "energyCost": total_cost,
        "timestampStart": _ts_ms(),
    })
    match['movementLog'] = movement_log
    db_utils.put_item(match)

    return _ok({
        "matchUuid": match.get('uuid'),
        "characterUuid": caller.get('uuid'),
        "fromLocationId": from_id,
        "fromLocationUuid": None,
        "toLocationId": target.get('id'),
        "toLocationUuid": target.get('uuid'),
        "energySpent": total_cost,
        "newEnergy": new_energy,
        "currentClock": _nz(match.get('currentClock')),
    })


def _visited_locations_payload(match, match_uuid):
    """Build the visited-locations payload with character counts and per-neighbor
    totalEnergyCost resolved for the current weather (Step 28)."""
    story = db_utils.get_item(f'STORY#{match.get("storyUuid")}') or {}
    locations = story.get('locations') or []
    neighbors = _story_neighbors(story)
    loc_by_id = {l.get('id'): l for l in locations}
    weather_rule = _current_weather_rule(match, story)
    characters = _match_characters(match_uuid)

    # visited = current character positions ∪ movementLog from/to.
    visited = []
    seen = set()

    def add(value):
        if value is not None and value not in seen:
            seen.add(value)
            visited.append(value)

    for c in characters:
        add(c.get('idLocation'))
    for m in (match.get('movementLog') or []):
        add(m.get('idLocationFrom'))
        add(m.get('idLocationTo'))

    result = []
    for loc_id in visited:
        loc = loc_by_id.get(loc_id)
        if loc is None:
            continue
        count = sum(1 for c in characters if c.get('idLocation') == loc_id)
        neighbor_costs = []
        for n in neighbors:
            a, b = n.get('idLocationFrom'), n.get('idLocationTo')
            if a == loc_id:
                other_id = b
            elif b == loc_id:
                other_id = a
            else:
                continue
            other = loc_by_id.get(other_id)
            if other is None:
                continue
            cond_key = n.get('conditionKey') or n.get('conditionRegistryKey')
            cond_met = True
            if cond_key:
                cond_value = n.get('conditionValue') or n.get('conditionRegistryValue')
                cond_met = _registry_value(match.get('registry'), cond_key) == cond_value
            safe = _nz(other.get('secureParam')) > 0
            weather_mod = 0
            if weather_rule is not None:
                weather_mod = _nz(weather_rule.get('costMoveSafeLocation') if safe
                                  else weather_rule.get('costMoveNotSafeLocation'))
            base = _nz(n.get('energyCost'))
            entry = _nz(other.get('costEnergyEnter'))
            neighbor_costs.append({
                "idLocation": other_id,
                "uuid": other.get('uuid'),
                "direction": n.get('direction'),
                "baseEnergyCost": base,
                "entryEnergyCost": entry,
                "weatherEnergyCost": weather_mod,
                "totalEnergyCost": base + entry + weather_mod,
                "conditionMet": cond_met,
            })
        result.append({
            "idLocation": loc_id,
            "uuid": loc.get('uuid'),
            "idCard": loc.get('idCard'),
            "safe": _nz(loc.get('secureParam')) > 0,
            "characterCount": count,
            "neighbors": neighbor_costs,
        })
    return {"matchUuid": match_uuid, "locations": result}


def _get_locations(user, match_uuid):
    match, err = _require_owned_match(user, match_uuid)
    if err:
        return err
    return _ok(_visited_locations_payload(match, match_uuid))


def _get_admin_locations(match_uuid):
    if not match_uuid or not match_uuid.strip():
        return _err(400, 'INVALID_INPUT', 'Match uuid is required')
    match = db_utils.get_item(f'MATCH#{match_uuid}')
    if match is None:
        return _err(404, 'MATCH_NOT_FOUND', f'Match not found: {match_uuid}')
    return _ok(_visited_locations_payload(match, match_uuid))


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
        ip_err = _check_admin_ip(event)
        if ip_err:
            return ip_err
        if str(user.get('role', '')).upper() != 'ADMIN':
            return _err(403, 'FORBIDDEN', 'Admin access required')

        if path == '/api/admin/matches' and method == 'GET':
            return _list_all_matches(event)
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
        if path.endswith('/weather') and method == 'GET':
            return _get_admin_match_weather(match_uuid)
        if path.endswith('/locations') and method == 'GET':
            return _get_admin_locations(match_uuid)
        if path.endswith('/stop') and method == 'POST':
            return _update_match(match_uuid, 'ENDED', None)
        if path.endswith('/pause') and method == 'POST':
            return _update_match(match_uuid, 'PAUSED', None)
        if path.endswith('/resume') and method == 'POST':
            return _update_match(match_uuid, 'RUNNING', None)
        # POST /api/admin/matches/{uuidMatch}/player/{uuidPlayer}/changeStatistics
        if '/player/' in path and path.endswith('/changeStatistics') and method == 'POST':
            segments = path.split('/')
            # /api/admin/matches/{uuid}/player/{uuid}/changeStatistics
            # idx:  0   1       2        3      4       5               6
            player_uuid = segments[6] if len(segments) > 6 else (
                (event.get('pathParameters') or {}).get('uuidPlayer') or ''
            )
            try:
                body = json.loads(event.get('body') or '{}')
            except (TypeError, ValueError):
                return _err(400, 'INVALID_INPUT', 'Body must be valid JSON')
            return _change_statistics(match_uuid, player_uuid, body)
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

    # Step 27 — GET /api/matches/{uuidMatch}/weather
    if (path.startswith(_API_MATCHES_PATH) and path.endswith('/weather') and method == 'GET'):
        params = (event.get('pathParameters') or {})
        match_uuid = params.get('uuidMatch')
        if not match_uuid:
            segments = path.split('/')
            match_uuid = segments[3] if len(segments) > 4 else ''
        lang = (event.get('queryStringParameters') or {}).get('lang') or 'en'
        return _get_weather(match_uuid, lang)

    if path.startswith('/api/match/') and path.endswith('/info') and method == 'GET':
        params = (event.get('pathParameters') or {})
        match_uuid = params.get('uuidMatch')
        if not match_uuid:
            # Fallback when API Gateway didn't expose the path parameter
            segments = path.split('/')
            match_uuid = segments[3] if len(segments) > 4 else ''
        lang = (event.get('queryStringParameters') or {}).get('lang') or 'en'
        return _get_match_info(user, match_uuid, lang)

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

    # ── Step 21 — character template & class selection ──
    if (path.startswith(_API_MATCHES_PATH) and path.endswith('/join') and method == 'POST'):
        params = event.get('pathParameters') or {}
        match_uuid = params.get('uuidMatch') or ''
        if not match_uuid:
            segments = path.split('/')  # /api/matches/{uuidMatch}/join
            match_uuid = segments[3] if len(segments) > 4 else ''
        try:
            body = json.loads(event.get('body') or '{}')
        except (TypeError, ValueError):
            return _err(400, 'INVALID_INPUT', 'Body must be valid JSON')
        return _join_match(user, match_uuid, body)

    if (path.startswith('/api/match/') and path.endswith('/players') and method == 'GET'):
        params = event.get('pathParameters') or {}
        match_uuid = params.get('uuidMatch') or ''
        if not match_uuid:
            segments = path.split('/')  # /api/match/{uuidMatch}/players
            match_uuid = segments[3] if len(segments) > 4 else ''
        return _list_players(user, match_uuid)

    if (path.startswith('/api/match/') and '/characters/' in path and method == 'GET'):
        params = event.get('pathParameters') or {}
        match_uuid = params.get('uuidMatch') or ''
        char_uuid = params.get('uuidCharacter') or ''
        if not match_uuid or not char_uuid:
            segments = path.split('/')  # /api/match/{uuidMatch}/characters/{uuidCharacter}
            if len(segments) >= 6 and segments[4] == 'characters':
                match_uuid = match_uuid or segments[3]
                char_uuid = char_uuid or segments[5]
        return _get_character(user, match_uuid, char_uuid)

    # ── Step 24 — single-player turn cycle ──
    if (path.startswith(_API_MATCHES_PATH) and path.endswith('/start') and method == 'POST'):
        params = event.get('pathParameters') or {}
        match_uuid = params.get('uuidMatch') or ''
        if not match_uuid:
            segments = path.split('/')  # /api/matches/{uuidMatch}/start
            match_uuid = segments[3] if len(segments) > 4 else ''
        return _start_match(user, match_uuid)

    if (path.startswith(_API_GAMEPLAY_PATH) and path.endswith('/action/pass') and method == 'POST'):
        params = event.get('pathParameters') or {}
        match_uuid = params.get('uuidMatch') or ''
        if not match_uuid:
            segments = path.split('/')  # /api/gameplay/{uuidMatch}/action/pass
            match_uuid = segments[3] if len(segments) > 3 else ''
        return _pass_turn(user, match_uuid)

    if (path.startswith('/api/match/') and path.endswith('/turn-sequence') and method == 'GET'):
        params = event.get('pathParameters') or {}
        match_uuid = params.get('uuidMatch') or ''
        if not match_uuid:
            segments = path.split('/')  # /api/match/{uuidMatch}/turn-sequence
            match_uuid = segments[3] if len(segments) > 4 else ''
        return _get_turn_sequence(user, match_uuid)

    # ── Step 25 — time advancement & clock cycle ──
    if (path.startswith(_API_GAMEPLAY_PATH) and path.endswith('/action/sleep') and method == 'POST'):
        params = event.get('pathParameters') or {}
        match_uuid = params.get('uuidMatch') or ''
        if not match_uuid:
            segments = path.split('/')  # /api/gameplay/{uuidMatch}/action/sleep
            match_uuid = segments[3] if len(segments) > 3 else ''
        return _sleep(user, match_uuid)

    if (path.startswith('/api/match/') and path.endswith('/clock') and method == 'GET'):
        params = event.get('pathParameters') or {}
        match_uuid = params.get('uuidMatch') or ''
        if not match_uuid:
            segments = path.split('/')  # /api/match/{uuidMatch}/clock
            match_uuid = segments[3] if len(segments) > 4 else ''
        return _get_clock(user, match_uuid)

    # ── Step 28 — movement system ──
    if (path.startswith(_API_GAMEPLAY_PATH) and path.endswith('/movements/start') and method == 'POST'):
        params = event.get('pathParameters') or {}
        match_uuid = params.get('uuidMatch') or ''
        if not match_uuid:
            segments = path.split('/')  # /api/gameplay/{uuidMatch}/movements/start
            match_uuid = segments[3] if len(segments) > 3 else ''
        try:
            body = json.loads(event.get('body') or '{}')
        except (TypeError, ValueError):
            return _err(400, 'INVALID_INPUT', 'Body must be valid JSON')
        return _start_movement(user, match_uuid, body)

    if (path.startswith('/api/match/') and path.endswith('/locations') and method == 'GET'):
        params = event.get('pathParameters') or {}
        match_uuid = params.get('uuidMatch') or ''
        if not match_uuid:
            segments = path.split('/')  # /api/match/{uuidMatch}/locations
            match_uuid = segments[3] if len(segments) > 4 else ''
        return _get_locations(user, match_uuid)

    return _err(404, 'NOT_FOUND', f'Unknown route {method} {path}')
