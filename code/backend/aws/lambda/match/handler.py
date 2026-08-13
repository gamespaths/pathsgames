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
      v0.32.1 — also backs the duplicate-match guard of POST /api/matches: the
      creator's own partition is queried and filtered on storyUuid + status, so
      a second active match on the same story answers 409
      ACTIVE_MATCH_ALREADY_EXISTS.
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

# The player-facing message for a refused move; the CODE is what clients switch on.
# INSUFFICIENT_ENERGY is spelled out at the refusal site, with the cost breakdown.
_MOVE_REASON_MESSAGES = {
    'MATCH_NOT_RUNNING': _MATCH_NOT_RUNNING_MSG,
    'COMA': 'Character cannot move while in coma',
    'SLEEPING': 'Character cannot move while sleeping',
    'MOVEMENT_CONDITION_NOT_MET': 'Movement condition not met',
    'OVERWEIGHT': 'Carried weight exceeds capacity',
    'LOCATION_FULL': 'Target location is at capacity',
    'CHARACTER_CANNOT_ACT': 'Character cannot act',
}
_API_MATCHES_PATH = "/api/matches/"
_API_GAMEPLAY_PATH = "/api/gameplay/"

# Lifecycle statuses of a match. A match is "stopped" (terminal) when it is
# ENDED or GAMEOVER; only stopped matches may be deleted by an admin.
MATCH_STATUSES = ["CREATED", "RUNNING", "PAUSED", "ENDED", "GAMEOVER"]
TERMINAL_STATUSES = {"ENDED", "GAMEOVER"}
# v0.32.1 — active (non-terminal) statuses. A match in one of these still occupies
# its creator's slot on the story, so a second one cannot be created. PAUSED counts:
# an admin-paused match is not over, it is suspended.
ACTIVE_STATUSES = {"CREATED", "RUNNING", "PAUSED"}


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


def _detail_from_item(item, players=None, lang='en', all_locations=False):
    """Build the match-info payload.

    ``all_locations`` keeps EVERY story location in ``locations`` instead of only
    the visited ones. Set by the admin endpoint, which needs the full runtime table."""
    players = players or []
    lang = lang if lang and lang.strip() else 'en'
    # Locations currently occupied by one or more players (insertion-ordered).
    active_loc_ids = []
    for c in players:
        loc = c.get("idLocation")
        if loc is not None and loc not in active_loc_ids:
            active_loc_ids.append(loc)

    # v0.28.6 fog of war — visited set (positions ∪ movement log), same as
    # _visited_locations_payload; hides the neighbor location-card fallback for
    # never-visited destinations.
    visited_loc_ids = set(active_loc_ids)
    for m in (item.get('movementLog') or []):
        if m.get('idLocationFrom') is not None:
            visited_loc_ids.add(m.get('idLocationFrom'))
        if m.get('idLocationTo') is not None:
            visited_loc_ids.add(m.get('idLocationTo'))

    # The STORY item carries the enriched locations/neighbors/events (with cards).
    story = db_utils.get_item(f'STORY#{item.get("storyUuid")}') or {}

    # Current location reflects where the player actually is; fall back to the
    # value stored on the match (the story start location set at creation).
    current_id = active_loc_ids[0] if active_loc_ids else item.get("currentLocationId")
    current_uuid = item.get("currentLocationUuid")
    if active_loc_ids:
        loc = next((l for l in (story.get("locations") or [])
                    if l.get("id") == current_id), None)
        if loc:
            current_uuid = loc.get("uuid")

    # v0.28.6 — the player endpoint projects only the VISITED locations; the admin
    # endpoint keeps them all. The synthetic `name` is stripped here rather than only
    # at write time, because matches created before this version already persisted it
    # on the MATCH item.
    location_states = [
        {k: v for k, v in l.items() if k != "name"}
        for l in (item.get("locations") or [])
        if all_locations or l.get("idLocation") in visited_loc_ids
    ]

    return {
        "match": _summary_from_item(item),
        "currentLocationId": current_id,
        "currentLocationUuid": current_uuid,
        "locations": location_states,
        "registry": item.get("registry", []),
        "events": [],
        "choices": [],
        # Step 21 — the players/characters of the match (summary rows).
        "players": [_character_summary(c) for c in players],
        # Step 27.x — enriched, player-occupied locations with card/neighbors/events.
        # Step 29 — ONE context for every event of the payload: the checker is a pure
        # function over it, so a story with many events costs no more than one with few.
        # The move verdict on every neighbor works the same way, from its own context.
        "locationsActive": _build_locations_active(
            story, active_loc_ids, lang, visited_loc_ids,
            _events.build_context(item, story, _reference_character(players, item)),
            _move_judge(item, story, players)),
    }


def _move_judge(match, story, players):
    """Everything the move verdict needs, loaded once per request: the mover's state, the
    weather rule in force and how many characters stand on each location (for LOCATION_FULL).

    The mover is the same reference character the event verdict speaks about, so the two
    cannot describe different players.
    """
    caller = _reference_character(players, match)
    counts = {}
    for c in (players or []):
        if c.get('idLocation') is not None:
            counts[c['idLocation']] = counts.get(c['idLocation'], 0) + 1
    return {
        'ctx': _movements.move_check_context(match, caller),
        'weatherRule': _current_weather_rule(match, story),
        'countsByLocation': counts,
        'registry': (match or {}).get('registry'),
    }


def _judge_neighbor(judge, edge, target):
    """The verdict on one neighbor edge, from the pre-loaded ``_move_judge``.

    The cost is the movement system's own formula (edge + target entry + weather modifier,
    safe or not), so match-info greys out exactly the paths ``action/move`` would refuse.
    """
    if not judge:
        return False, 'CHARACTER_CANNOT_ACT'
    if target is None:
        return False, 'NOT_A_NEIGHBOR'
    total_cost, _ = _movement_total_cost(edge, target, judge.get('weatherRule'))
    cond_key = edge.get('conditionKey') or edge.get('conditionRegistryKey')
    condition_met = True
    if cond_key:
        cond_value = edge.get('conditionValue') or edge.get('conditionRegistryValue')
        condition_met = _registry_value(judge.get('registry'), cond_key) == cond_value
    return _movements.check(judge.get('ctx'), _movements.edge_check(
        condition_met,
        total_cost,
        target.get('maxCharacters'),
        (judge.get('countsByLocation') or {}).get(target.get('id'), 0)))


from common.data_utils import resolve_card_from_raw as _resolve_card_from_raw
from match import choices as _choices
from match import events as _events
from match import movements as _movements


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


def _reference_character(players, match):
    """The match's reference character — in single-player the only one, and the creator's.

    The admin view uses the same one, so the console sees exactly the flags the player
    would. Per-character availability arrives with multiplayer.
    """
    creator = match.get('userCreatorUuid') or match.get('idUserCreator')
    for c in (players or []):
        if c.get('userUuid') == creator:
            return c
    return (players or [None])[0]


def _build_locations_active(story, active_loc_ids, lang='en', visited_loc_ids=None,
                            check_ctx=None, move_judge=None):
    """Build the enriched ``locationsActive`` list from the STORY item: each
    player-occupied location with its card, the neighbor links touching it (both
    directions) and the events specific to it.

    Cards are ALWAYS resolved from idCard against the story's raw_cards/raw_texts
    at read time — any stale `card` object embedded on the stored item is ignored,
    matching the Java/Python backends (which resolve from id_card via list_cards).

    v0.28.6 fog of war — a neighbor's authored LINK card is always shown, but the
    fallback to the destination LOCATION's card is hidden until that location has
    been visited (``visited_loc_ids``). ``None`` disables the gating."""
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
                # One-way link (flagBack=NO): hide it when standing on the
                # destination, since you cannot go back.
                if not _neighbor_traversable_from(n, loc_id):
                    continue
                other_id = n.get("idLocationFrom")
            else:
                continue
            other = loc_by_id.get(other_id)
            # idCard is the source of truth; fall back to the destination
            # location's idCard when the link itself carries none — but only when
            # that location has been visited (v0.28.6 fog of war).
            other_visited = visited_loc_ids is None or other_id in visited_loc_ids
            neighbor_card_id = n.get("idCard")
            if neighbor_card_id is None and other is not None and other_visited:
                neighbor_card_id = other.get("idCard")
            # Step 0.28.2 — optional "return" card: falls back to the forward card
            # (idCard) when the link defines no idCardBack.
            neighbor_card_back_id = n.get("idCardBack")
            if neighbor_card_back_id is None:
                neighbor_card_back_id = neighbor_card_id
            # v0.28.6 — the card of the LOCATION at each endpoint of the edge,
            # gated on that endpoint's OWN visited flag.
            def _loc_card(loc_id_):
                if loc_id_ is None or (visited_loc_ids is not None
                                       and loc_id_ not in visited_loc_ids):
                    return None
                endpoint = loc_by_id.get(loc_id_)
                if endpoint is None:
                    return None
                return _resolve_card_from_raw(
                    raw_cards, raw_texts, endpoint.get("idCard"), lang)

            # No lookup in this loop either: the move context was loaded once.
            available, reason = _judge_neighbor(move_judge, n, other)
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
                "cardLocationFrom": _loc_card(n.get("idLocationFrom")),
                "cardLocationTo": _loc_card(n.get("idLocationTo")),
                # The verdict action/move would give this path, and its code when refused.
                "available": available,
                "reason": reason,
            })

        event_infos = []
        for e in events:
            if _event_location(e) != loc_id:
                continue
            # Step 29 — the verdict of the same check procedure execute-event enforces.
            available, reason = _events.check(e, check_ctx)
            event_infos.append({
                "uuid": e.get("uuid"), "type": e.get("type"),
                "endGame": end_event_id is not None and e.get("id") == end_event_id,
                "card": _resolve_card_from_raw(raw_cards, raw_texts, e.get("idCard"), lang),
                "available": available,
                "reason": reason,
                # The energy the event costs to trigger; 0 when it is free.
                "energy": _nz(e.get("costEnery")),
            })

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
        "isSleeping": int(item.get("isSleeping", 0)),
        "isComa": int(item.get("isComa", 0)),
        # Step 30 — the clock at which the coma opened; 0 while not comatose.
        "clockInComa": int(item.get("clockInComa", 0)),
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
        "isSleeping": int(item.get("isSleeping", 0)),
        "isComa": int(item.get("isComa", 0)),
        # Step 30 — the clock at which the coma opened; 0 while not comatose.
        "clockInComa": int(item.get("clockInComa", 0)),
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

def _has_active_match_for_story(user, story_uuid):
    """v0.32.1 — True when the caller already owns a non-terminal match on that
    story. Reads the user's own GSI1 partition (the same access path as
    `_list_user_matches`, which is fully paginated) and filters in memory:
    `storyUuid` is not part of GSI1_SK, so it cannot narrow the key condition."""
    items = db_utils.query_gsi('GSI1', f'USER_MATCHES#{user["uuid"]}') or []
    return any(i.get('storyUuid') == story_uuid and i.get('status') in ACTIVE_STATUSES
               for i in items)


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

    # v0.32.1 — one active match per user and story. It runs last, after every 404
    # and 400: a malformed request keeps reporting its own error whatever the state
    # is, and the state conflict is the only thing left to refuse. Still before
    # anything is written — a rejected creation persists nothing. GSI1 already holds
    # the caller's matches with `status` and `storyUuid` projected, so this is a
    # Query on the user's own partition — never a Scan.
    if _has_active_match_for_story(user, story_uuid):
        return _err(409, 'ACTIVE_MATCH_ALREADY_EXISTS',
                    'An active match already exists for this user and story')

    now_ms = _ts_ms()
    match_uuid = _new_match_uuid()

    raw_single_player = (body or {}).get('singlePlayer')
    single_player = int(raw_single_player) if raw_single_player is not None else 1

    # Step 27 — deterministic per-match RNG seed (explicit or random).
    raw_seed = (body or {}).get('rngSeed')
    rng_seed = int(raw_seed) if raw_seed is not None else secrets.randbits(63)

    # Step 33 — the party starts IN the starting location, it never "enters" it. Seeding it
    # as already visited is what makes walking BACK there fire idEventNotFirstTime instead
    # of announcing as a discovery the place the story opened in. idLocationStart is
    # story-level, so this is deterministic however many players join, in whatever order.
    id_location_start = story.get('idLocationStart')
    location_states = []
    for loc in locations:
        loc_id = int(loc.get('id', 0))
        location_states.append({
            "idLocation": loc_id,
            "uuid": str(uuid_lib.uuid4()),
            "flagAlreadyActived": 0,
            # Not flagAlreadyActived, which means "this location's counter has been
            # consumed" and latches the counter re-seed: overloading it would break both.
            "flagVisited": 1 if (id_location_start is not None
                                 and loc_id == _nz(id_location_start)) else 0,
            "clockCounter": int(loc.get('counterTime') or loc.get('counter_time') or 0),
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
        "movementLog": [],
        "sleepLog": [],
        "expCost": int(matched_diff.get('expCost') or 5),
        "userCreatorUuid": user['uuid'],
        "tsInsert": now_ms,
        "currentLocationId": int(start_id) if start_id is not None else None,
        "currentLocationUuid": (start_loc or {}).get('uuid'),
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
    # State flags: absent (null) means "leave as it is" — the -1 of the numeric fields.
    sleeping = body.get('sleeping')
    coma = body.get('coma')

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

    # Pulling a character OUT of a coma must leave a state it can act from: a comatose
    # character is also asleep, and with life <= 0 the engine would drop it right back in. So
    # clearing coma also clears sleep and lifts life to 1 when the admin left it at 0.
    if coma is False:
        sleeping = False
        new_life = life if life is not None else _nz(item.get('life'))
        if new_life <= 0:
            life = 1

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
    if sleeping is not None: updates['isSleeping'] = 1 if sleeping else 0
    if coma     is not None: updates['isComa']     = 1 if coma else 0

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
    return _ok(_detail_from_item(item, _match_characters(match_uuid), all_locations=True))


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
        # v0.30.1 — a comatose character who rested in a safe location wakes. Safe recovery has
        # already lifted its life above zero (life += COS + secure_param, both >= 1), so it
        # cannot wake awake-but-dead to re-coma next clock. Independent of the others in the
        # location. NOTE: this backend's recovery does not run the full edge evaluator (Java and
        # Python do); the wake is the one edge rule the recovery path needs.
        if _nz(c.get('isComa')) == 1 and safe and life > 0:
            c['isComa'] = 0
            _log_edge_state(match, c, None,
                            f"{_events.MSG_COMA_RECOVERED} {c.get('uuid')}")
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

    # Decrement location counters on the embedded match state; flag zeros and collect the
    # events they owe. A counter is a ONE-SHOT FUSE: `current <= 0` skips an exhausted one
    # and flagAlreadyActived latches it, so the event fires exactly once per match.
    pending = []
    clock = _nz(match.get('currentClock'))
    for ls in (match.get('locations') or []):
        current = _nz(ls.get('clockCounter'))
        if current <= 0:
            continue
        nxt = current - 1
        ls['clockCounter'] = nxt
        if nxt == 0:
            id_location = _nz(ls.get('idLocation'))
            loc = story_locations.get(id_location) or {}
            id_event = loc.get('idEventIfCounterZero')
            ls['pendingEvent'] = id_event
            ls['flagAlreadyActived'] = 1
            # Step 33 — the row the other two backends have always written. Without it the
            # AWS timeline said nothing at all when a counter ran out.
            message = f'counter reached zero at location {id_location}'
            if id_event is not None:
                message += f'; pending event {_nz(id_event)}'
            match.setdefault('eventLog', []).append({
                "characterUuid": None,
                "idEvent": _nz(id_event) if id_event is not None else None,
                "idLocation": id_location,
                "clock": clock,
                "timestamp": _ts_ms(),
                "message": message,
            })
            _add_pending_automatic(pending, _events.TRIGGER_COUNTER_ZERO, id_location,
                                   id_event, _nominal_actor(characters, id_location), loc)

    # Step 33 — a time unit BEGINNING where a character stands is its own trigger,
    # independent of any counter. One entry per occupied location, not per character: the
    # event describes the place, and the nominal actor is who it happens to.
    for id_location in occupied_ids:
        loc = story_locations.get(id_location) or {}
        _add_pending_automatic(pending, _events.TRIGGER_CHARACTER_START_TIME, id_location,
                               loc.get('idEventIfCharacterStartTime'),
                               _nominal_actor(characters, id_location), loc)

    # Deterministic across locations: priorityAutomaticEvent first, then location id.
    pending.sort(key=lambda p: (p['priority'], p['idLocation']))
    return recaps, pending


def _add_pending_automatic(out, trigger, id_location, id_event, id_actor_uuid, loc):
    """Skips a null or non-positive event id — an unauthored trigger is not a trigger."""
    if id_event is None or _nz(id_event) <= 0:
        return
    out.append({
        "trigger": trigger,
        "idLocation": id_location,
        "idEvent": _nz(id_event),
        "actorUuid": id_actor_uuid,
        "priority": _nz(loc.get('priorityAutomaticEvent')),
    })


def _nominal_actor(characters, id_location):
    """The lowest-id character standing in a location, or None when nobody is.

    An automatic location event belongs to the place, not to a player, but its effects
    still have to resolve ``target = ONLY_ONE`` against somebody and ``target = ALL``
    against everyone *there*. Picking the lowest id makes that choice deterministic;
    picking nobody, when the place is empty, is equally correct — the world still changes,
    it just changes around no one.
    """
    here = [c for c in (characters or []) if _nz(c.get('idLocation')) == id_location]
    if not here:
        return None
    here.sort(key=lambda c: str(c.get('uuid') or ''))
    return here[0].get('uuid')


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


def _ms_to_iso(ts_ms):
    """Convert millisecond timestamp to ISO string; return None if ts_ms is None."""
    if ts_ms is None:
        return None
    try:
        import datetime
        moment = datetime.datetime.fromtimestamp(int(ts_ms) / 1000, datetime.timezone.utc)
        return moment.strftime('%Y-%m-%dT%H:%M:%S.') + f'{int(ts_ms) % 1000:03d}Z'
    except Exception:
        return str(ts_ms)


LOGS_DEFAULT_LIMIT = 50
LOGS_MAX_LIMIT = 200
_CURSOR_PREFIX = 'offset:'
LOGS_ORDER_ASC = 'asc'
LOGS_ORDER_DESC = 'desc'


def _normalize_logs_order(order):
    """Only `desc` flips the timeline; anything else (None, junk) keeps `asc`."""
    if order and str(order).strip().lower() == LOGS_ORDER_DESC:
        return LOGS_ORDER_DESC
    return LOGS_ORDER_ASC


def _clamp_logs_limit(limit):
    """Clamps the requested page size into [1, LOGS_MAX_LIMIT]; None → default."""
    if limit is None or str(limit).strip() == '':
        return LOGS_DEFAULT_LIMIT
    try:
        return max(1, min(int(limit), LOGS_MAX_LIMIT))
    except (TypeError, ValueError):
        return LOGS_DEFAULT_LIMIT


def _encode_logs_cursor(offset):
    """Encodes the offset of the next page into an opaque url-safe token."""
    import base64
    raw = f'{_CURSOR_PREFIX}{offset}'.encode('utf-8')
    return base64.urlsafe_b64encode(raw).decode('ascii').rstrip('=')


def _decode_logs_cursor(cursor):
    """Decodes an opaque cursor into an offset. Unreadable cursors restart from 0."""
    import base64
    if not cursor or not str(cursor).strip():
        return 0
    try:
        padded = cursor + '=' * (-len(cursor) % 4)
        raw = base64.urlsafe_b64decode(padded.encode('ascii')).decode('utf-8')
        if not raw.startswith(_CURSOR_PREFIX):
            return 0
        return max(0, int(raw[len(_CURSOR_PREFIX):]))
    except (ValueError, TypeError):
        return 0


def _assemble_match_logs(match, match_uuid):
    """The whole timeline, sorted by timestamp ascending, with no enrichment yet."""
    entries = []

    # WEATHER from weatherLog
    for w in (match.get('weatherLog') or []):
        entries.append({
            "type": "WEATHER",
            "clock": w.get('clock'),
            "timestamp": _ms_to_iso(w.get('timestampStart')),
            "idWeather": w.get('idWeather'),
        })

    # MOVEMENT from movementLog
    for m in (match.get('movementLog') or []):
        entries.append({
            "type": "MOVEMENT",
            "clock": None,
            "timestamp": _ms_to_iso(m.get('timestampStart')),
            "characterUuid": m.get('characterUuid'),
            "idLocationFrom": m.get('idLocationFrom'),
            "idLocationTo": m.get('idLocationTo'),
            "energyCost": m.get('energyCost'),
        })

    # Step 29 — EVENT from eventLog (an event the player triggered).
    #
    # v0.30.3 — eventLog is a shared list: Step 30 also appends SADNESS_OVERFLOW/COMA
    # audit rows to it. Only messages the Java/Python backends recognise as an executed
    # event reach the timeline here too, so all three backends agree on what an EVENT
    # entry is — anything else is dropped, not shown as garbage.
    for e in (match.get('eventLog') or []):
        message = e.get('message')
        if not message:
            continue
        if message.startswith(_events.MSG_EVENT_EXECUTED):
            entry_type = "EVENT"
        elif message.startswith('counter'):
            # Step 33 — a counter running out and a character healing are unrelated
            # events, so COUNTER_ZERO is its own type. The location rides in
            # idLocationTo so it enriches like a MOVEMENT does. Until v0.33.0 this
            # backend wrote no row at all when a counter ran out.
            entry_type = "COUNTER_ZERO"
        elif message.startswith(_events.MSG_AUTOMATIC_EVENT):
            entry_type = "AUTOMATIC_EVENT"
        else:
            continue
        entries.append({
            "type": entry_type,
            "clock": e.get('clock'),
            "timestamp": _ms_to_iso(e.get('timestamp')),
            "characterUuid": e.get('characterUuid'),
            "idLocationTo": e.get('idLocation'),
            "message": message,
            "idEvent": e.get('idEvent'),
        })

    # SLEEP from sleepLog
    for s in (match.get('sleepLog') or []):
        entries.append({
            "type": "SLEEP",
            "clock": s.get('clock'),
            "timestamp": _ms_to_iso(s.get('timestamp')),
            "characterUuid": s.get('characterUuid'),
        })

    # CLOCK_ADVANCE from the CLOCK#<n> items written by _advance_time under the
    # match partition (they are separate items, not embedded in the match).
    for c in (db_utils.query_by_pk(f'MATCH#{match_uuid}') or []):
        if not str(c.get('SK') or '').startswith('CLOCK#'):
            continue
        entries.append({
            "type": "CLOCK_ADVANCE",
            "clock": _nz(c.get('clock')),
            "timestamp": _ms_to_iso(c.get('timestampStart')),
        })

    # Sort by timestamp ascending; None timestamps sort last
    entries.sort(key=lambda x: x.get('timestamp') or '9999')
    return entries


def _enrich_match_logs(page, match, match_uuid, lang):
    """v0.28.7 — adds the card of every WEATHER (its own) and MOVEMENT entry (the
    destination location's), plus the name of the character behind character-scoped
    entries. The story and character lookups run once per page, not per entry.

    v0.30.3 — EVENT entries carry the triggered event's own card, resolved the same way."""
    if not page:
        return []

    story = db_utils.get_item(f'STORY#{match.get("storyUuid")}') or {}
    raw_cards = story.get('raw_cards') or []
    raw_texts = story.get('raw_texts') or []
    weather_cards = {_nz(w.get('id')): w.get('idCard')
                     for w in (story.get('weatherRules') or [])}
    location_cards = {_nz(loc.get('id')): loc.get('idCard')
                      for loc in (story.get('locations') or [])}
    template_cards = {t.get('uuid'): t.get('idCard')
                      for t in (story.get('characterTemplates') or [])}
    event_cards = {_nz(ev.get('id')): ev.get('idCard')
                   for ev in (story.get('events') or [])}
    characters = {c.get('uuid'): c for c in _match_characters(match_uuid)}

    out = []
    for e in page:
        entry = dict(e)

        id_card = None
        if entry['type'] == 'WEATHER' and entry.get('idWeather') is not None:
            id_card = weather_cards.get(_nz(entry['idWeather']))
        elif entry['type'] == 'MOVEMENT' and entry.get('idLocationTo') is not None:
            id_card = location_cards.get(_nz(entry['idLocationTo']))
        elif entry['type'] == 'EVENT' and entry.get('idEvent') is not None:
            id_card = event_cards.get(_nz(entry['idEvent']))
        elif entry['type'] == 'AUTOMATIC_EVENT' and entry.get('idEvent') is not None:
            # Step 33 — the event's own card, like a player-triggered one.
            id_card = event_cards.get(_nz(entry['idEvent']))
        elif entry['type'] == 'COUNTER_ZERO' and entry.get('idLocationTo') is not None:
            # Step 33 — a counter belongs to a place, so the place's card names it.
            id_card = location_cards.get(_nz(entry['idLocationTo']))
        entry['idCard'] = id_card
        entry['card'] = _resolve_card_from_raw(raw_cards, raw_texts, id_card, lang)

        character = characters.get(entry.get('characterUuid'))
        if character is not None:
            template_card = _resolve_card_from_raw(
                raw_cards, raw_texts,
                template_cards.get(character.get('characterTemplateUuid')), lang)
            entry['characterName'] = (template_card or {}).get('title')

        out.append(entry)
    return out


def _build_match_logs(match, match_uuid, lang='en', limit=None, cursor=None, order=None):
    """One page of the consolidated log (Step 28.7, paginated + enriched in v0.28.7).

    `order=desc` flips the whole timeline (newest first) before the page is cut, so the
    cursor keeps walking away from the first returned entry — with `desc` "load more"
    moves towards the older entries."""
    entries = _assemble_match_logs(match, match_uuid)
    effective_order = _normalize_logs_order(order)
    if effective_order == LOGS_ORDER_DESC:
        entries.reverse()

    effective_limit = _clamp_logs_limit(limit)
    offset = min(_decode_logs_cursor(cursor), len(entries))
    end = min(offset + effective_limit, len(entries))
    page = _enrich_match_logs(entries[offset:end], match, match_uuid, lang or 'en')

    return {
        "matchUuid": match_uuid,
        "currentClock": _nz(match.get('currentClock')),
        "logs": page,
        "nextCursor": _encode_logs_cursor(end) if end < len(entries) else None,
        "limit": effective_limit,
        "total": len(entries),
        "order": effective_order,
    }


def _get_match_logs(user, match_uuid, lang='en', limit=None, cursor=None, order=None):
    """GET /api/matches/{uuid}/logs — consolidated log timeline, owner-only (Step 28.7)."""
    if not match_uuid or not match_uuid.strip():
        return _err(400, 'INVALID_INPUT', 'Match uuid is required')
    match = db_utils.get_item(f'MATCH#{match_uuid}')
    if match is None:
        return _err(404, 'MATCH_NOT_FOUND', 'Match not found or not accessible')
    # Owner check
    if user is None or match.get('userCreatorUuid') != user.get('uuid'):
        return _err(404, 'MATCH_NOT_FOUND', 'Match not found or not accessible')
    return _ok(_build_match_logs(match, match_uuid, lang, limit, cursor, order))


def _get_admin_match_logs(match_uuid, lang='en', limit=None, cursor=None, order=None):
    """GET /api/admin/matches/{uuid}/logs — admin log timeline, no ownership check (Step 28.7)."""
    if not match_uuid or not match_uuid.strip():
        return _err(400, 'INVALID_INPUT', 'Match uuid is required')
    match = db_utils.get_item(f'MATCH#{match_uuid}')
    if match is None:
        return _err(404, 'MATCH_NOT_FOUND', f'Match not found: {match_uuid}')
    return _ok(_build_match_logs(match, match_uuid, lang, limit, cursor, order))


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
    recovery, pending = _apply_time_start_recovery(match, match_uuid, story)
    # Step 33: the events that pass collected — counters that reached zero, and the
    # locations whose idEventIfCharacterStartTime fires because a time unit began with
    # somebody standing there.
    fired = _run_pending_automatic_events(match, match_uuid, story, pending)
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
    return new_clock, recovery, fired


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

    # Step 28.7 — log the sleep action for the match logs timeline.
    sleep_log = match.get('sleepLog') or []
    sleep_log.append({
        "characterUuid": caller.get('uuid'),
        "clock": _nz(match.get('currentClock')),
        "timestamp": _ts_ms(),
    })
    match['sleepLog'] = sleep_log
    db_utils.put_item(match)

    # Re-read so the trigger sees the just-applied sleep flag.
    characters = _match_characters(match_uuid)
    triggered = _all_characters_done(characters)

    current_clock = _nz(match.get('currentClock'))
    recovery = []
    counter_zero = []
    if triggered:
        current_clock, recovery, fired = _advance_time(match, match_uuid)
        # Step 33 — the same events, told to THIS player. The caller is the only recipient
        # with an open request; the rest learn about it over the broadcast once Steps 49-54
        # land, through this very path called once per player.
        story = db_utils.get_item(f'STORY#{match.get("storyUuid")}') or {}
        counter_zero = _describe_for_recipient(match, match_uuid, story,
                                               caller.get('uuid'), fired, current_clock)

    return _ok({
        "matchUuid": match.get('uuid'),
        "characterUuid": caller.get('uuid'),
        "isSleeping": not triggered,  # woke up at time start when triggered
        "timeEndTriggered": triggered,
        "currentClock": current_clock,
        "recovery": recovery,
        # Step 33 — what happened in the world while the party slept. A LIST: several
        # counters can run out on one time-start. Already filtered for this caller: `card`
        # is absent entirely when visibility is ANONYMOUS.
        "counterZero": counter_zero,
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


def _neighbor_traversable_from(n, loc_id):
    """Forward (loc_id == idLocationFrom) is always allowed; backward (loc_id ==
    idLocationTo) only when flagBack == 1 (a two-way link)."""
    if n.get('idLocationFrom') == loc_id:
        return True
    return n.get('idLocationTo') == loc_id and _nz(n.get('flagBack')) == 1


def _find_edge(neighbors, from_id, to_id):
    for n in (neighbors or []):
        a, b = n.get('idLocationFrom'), n.get('idLocationTo')
        if ((a == from_id and b == to_id) or (a == to_id and b == from_id)) \
                and _neighbor_traversable_from(n, from_id):
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

    # The mover's own state (match RUNNING, coma, sleep) is judged before the target is even
    # resolved, so an asleep player is told they are asleep rather than that their destination
    # is not a neighbor. Passing no edge asks the checker for exactly that prefix of the
    # verdict; NOT_A_NEIGHBOR is its way of saying "so far so good, now give me an edge".
    ctx = _movements.move_check_context(match, caller)
    available, reason = _movements.check(ctx, None)
    if not available and reason != 'NOT_A_NEIGHBOR':
        return _err(409, reason, _MOVE_REASON_MESSAGES.get(reason, 'Movement refused'))
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

    total_cost, cost_breakdown = _movement_total_cost(
        edge, target, _current_weather_rule(match, story))
    energy = _nz(caller.get('energy'))

    max_chars = _nz(target.get('maxCharacters'))
    characters_at_target = 0
    if max_chars > 0:
        characters_at_target = sum(
            1 for c in _match_characters(match_uuid) if c.get('idLocation') == target.get('id'))

    cond_key = edge.get('conditionKey') or edge.get('conditionRegistryKey')
    condition_met = True
    if cond_key:
        cond_value = edge.get('conditionValue') or edge.get('conditionRegistryValue')
        condition_met = _registry_value(match.get('registry'), cond_key) == cond_value

    available, reason = _movements.check(ctx, _movements.edge_check(
        condition_met, total_cost, max_chars, characters_at_target))
    if not available:
        # Energy is the one refusal worth explaining in prose: the player wants to know what
        # the trip would have cost, and why.
        if reason == 'INSUFFICIENT_ENERGY':
            return _err(
                409, reason,
                "Not enough energy: have {have}, need {need} "
                "(edge {edge} + entry {entry} + weather {weather}; target {safety})".format(
                    have=energy, need=total_cost,
                    edge=cost_breakdown['edge'], entry=cost_breakdown['entry'],
                    weather=cost_breakdown['weather'],
                    safety='safe' if cost_breakdown['safe'] else 'unsafe'))
        return _err(409, reason, _MOVE_REASON_MESSAGES.get(reason, 'Movement refused'))

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

    # Step 33 — the move is committed, so the arrival is real: ask the destination what it
    # does about somebody walking in. Deliberately after both writes, because the trigger
    # resolution reads the character's new position back.
    automatic_events = []
    _resolve_arrival(match, match_uuid, story, caller.get('uuid'), _nz(target.get('id')),
                     'en', 0, automatic_events)
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
        # What the destination did about the arrival. The board already has the new
        # location for its left page; these belong on the right.
        "automaticEvents": automatic_events,
    })


# ── Step 29 — normal (player-triggered) events ─────────────────────────────

def _log_edge_state(match, character, id_event, message):
    """A Step 30 audit row on the match event log.

    ``character`` may be None for the party-wide row, which belongs to the match rather
    than to any one character.
    """
    match.setdefault('eventLog', []).append({
        "characterUuid": character.get('uuid') if character else None,
        "idEvent": id_event,
        "clock": _nz(match.get('currentClock')),
        "timestamp": _ts_ms(),
        "message": message,
    })


def _resolve_all_player_coma(match, match_uuid, caller, touched, edge_state, events_by_id,
                             ctx, story, raw_cards, raw_texts, lang, already_resolved):
    """Decide whether the all-players-in-coma epilogue runs, and return its event.

    Returns None — and the chain simply stops — when the party is not fully down, when the
    epilogue was already resolved this request, when the story authors none, when the id is
    dangling, or when a ONCE epilogue was already spent earlier in the match.

    Moving the match to GAMEOVER is deliberately NOT done here: that, and the rescue
    endpoints, belong to step 59.
    """
    if already_resolved:
        return None

    # The touched copies carry the flags this execution just raised; everyone else is read
    # as stored. Both are needed — a character nothing touched may already be comatose.
    roster = []
    for c in _match_characters(match_uuid):
        roster.append(touched.get(c.get('uuid'), c))
    if not _events.all_in_coma(roster):
        return None

    edge_state['allPlayersInComa'] = True
    _log_edge_state(match, caller, None, f"{_events.MSG_ALL_PLAYER_COMA} {match_uuid}")

    coma_event_id = story.get('idEventAllPlayerComa')
    if not coma_event_id:
        return None  # a story need not author an epilogue
    coma_event = events_by_id.get(_events._nz(coma_event_id))
    if coma_event is None:
        return None  # dangling idEventAllPlayerComa
    if str(coma_event.get('type') or '').strip().upper() == _events.TYPE_ONCE \
            and _events._nz(coma_event.get('id')) in ctx['consumedEventIds']:
        return None  # a ONCE epilogue fires once per match, not once per collapse

    edge_state['comaEventUuid'] = coma_event.get('uuid')
    edge_state['comaEventCard'] = _resolve_card_from_raw(
        raw_cards, raw_texts, coma_event.get('idCard'), lang)
    return coma_event


def _execute_event(user, match_uuid, body, lang='en'):
    """POST /api/gameplay/{uuidMatch}/action/execute-event.

    Refuses exactly the events match-info already marked unavailable, with exactly that
    reason: both go through ``events.check``. The energy/coin cost is paid ONCE, for the
    event the player asked for; the id_event_next chain that follows is a consequence, not
    a choice — its links are neither re-checked nor charged.
    """
    if not match_uuid:
        return _err(400, 'INVALID_INPUT', 'Match uuid is required')
    event_uuid = (body or {}).get('eventUuid')
    if not event_uuid or not str(event_uuid).strip():
        return _err(400, 'MISSING_EVENT', 'eventUuid is required')

    match = db_utils.get_item(f'MATCH#{match_uuid}')
    if match is None:
        return _err(404, 'MATCH_NOT_FOUND', 'Match not found or not accessible')

    characters = _match_characters(match_uuid)
    caller = next((c for c in characters if c.get('userUuid') == user.get('uuid')), None)
    if caller is None:
        # An unknown match and a caller who is not in it are deliberately indistinguishable.
        return _err(404, 'MATCH_NOT_FOUND', 'Match not found or not accessible')

    if match.get('status') != 'RUNNING':
        return _err(409, 'MATCH_NOT_RUNNING', _MATCH_NOT_RUNNING_MSG)

    story = db_utils.get_item(f'STORY#{match.get("storyUuid")}') or {}
    all_events = story.get('events') or []
    event = next((e for e in all_events if e.get('uuid') == event_uuid), None)
    if event is None:
        return _err(404, 'EVENT_NOT_FOUND', 'Event not found in this story')

    ctx = _events.build_context(match, story, caller)

    # Step 31: an event owning options presents them instead of applying anything. The
    # availability verdict moves inside the branch — an already-open cycle must bypass
    # it, having been paid for when it opened.
    event_choices = _choices.choices_for_event(story, event.get('id'))
    if event_choices:
        return _execute_choice_event(match, match_uuid, story, event, event_choices,
                                     caller, characters, ctx, lang)

    available, reason = _events.check(event, ctx)
    if not available:
        return _err(409, reason, f'Event cannot be executed: {reason}')

    # Resolve the class id of every character once — target_class narrows on it.
    classes_by_uuid = {c.get('uuid'): c.get('id') for c in (story.get('classes') or [])}
    for c in characters:
        c['classId'] = classes_by_uuid.get(c.get('classUuid'))

    item_uuids = {_events._nz(i.get('id')): i.get('uuid') for i in (story.get('items') or [])}
    trait_uuids = {_events._nz(t.get('id')): t.get('uuid') for t in (story.get('traits') or [])}
    location_uuids = {_events._nz(l.get('id')): l.get('uuid')
                      for l in (story.get('locations') or [])}
    effects_by_event = _events.effects_by_event(story)
    end_game_id = story.get('idEventEndGame')
    events_by_id = {_events._nz(e.get('id')): e for e in all_events if e.get('id') is not None}

    # ── pay, once, for the event the player asked for ──
    energy_spent = _events._nz(event.get('costEnery'))
    coin_spent = _events._nz(event.get('coinCost'))
    if energy_spent:
        caller['energy'] = max(0, _nz(caller.get('energy')) - energy_spent)
    if coin_spent:
        caller['coin'] = max(0, _nz(caller.get('coin')) - coin_spent)

    stat_changes, registry_changes = [], []
    trait_changes, item_changes, characteristic_changes = [], [], []
    location_changes = []
    applied_effects, executed_uuids = [], []
    touched = {caller.get('uuid'): caller}
    flags = {'itemAdded': False, 'itemRemoved': False, 'weatherApplied': False,
             'movementApplied': False,
             'comaTriggered': False, 'gameOver': False, 'endTime': False,
             # Step 30 — a sadness overflow forces sleep without a coma, so this cannot be
             # derived from comaTriggered alone.
             'forcedSleep': False}
    # Step 30 — the epilogue is kept apart from executedEventUuids / effects so the board
    # can tell the narrative the player triggered from the engine's answer to the collapse.
    edge_state = {'sadnessOverflowUuids': [], 'comaUuids': [], 'allPlayersInComa': False,
                  'comaEventUuid': None, 'comaEventCard': None,
                  'comaExecutedEventUuids': [], 'comaEffects': []}
    visited = set()
    raw_cards = story.get('raw_cards') or []
    raw_texts = story.get('raw_texts') or []

    current = event
    epilogue_phase = False
    all_coma_resolved = False
    while current is not None:
        event_id = _events._nz(current.get('id'))
        visited.add(event_id)
        ctx['consumedEventIds'].add(event_id)
        if current.get('uuid'):
            executed_uuids.append(current.get('uuid'))

        for effect in effects_by_event.get(event_id, []):
            recipients = _events.resolve_recipients(effect, caller, characters)

            # Weather is a property of the MATCH: applied once per effect row, no matter
            # how many characters that row targets.
            id_weather = effect.get('idWeather')
            if id_weather:
                match['currentWeatherId'] = _events._nz(id_weather)
                ctx['currentWeatherId'] = _events._nz(id_weather)
                flags['weatherApplied'] = True

            for target_char in recipients:
                touched[target_char.get('uuid')] = target_char
                _events.apply_stat(target_char, effect, stat_changes)
                added, removed = _events.apply_item(target_char, effect, item_uuids,
                                                    item_changes)
                flags['itemAdded'] = flags['itemAdded'] or added
                flags['itemRemoved'] = flags['itemRemoved'] or removed
                _events.apply_traits(target_char, effect, trait_uuids, trait_changes)
                _events.apply_characteristics(target_char, effect, characteristic_changes)
                moved = _events.apply_location(match, target_char, effect, location_uuids,
                                               location_changes, _ts_ms())
                flags['movementApplied'] = flags['movementApplied'] or moved

            # The registry is match-scoped too: written once, by the actor.
            key = effect.get('keyToAdd')
            if key:
                value = effect.get('keyValueToAdd')
                _events.apply_registry(match, key, value, registry_changes)
                ctx['registry'][key] = value

            applied_effects.append({
                "eventUuid": current.get('uuid'),
                "effectUuid": effect.get('uuid'),
                "statistic": effect.get('statistics'),
                "value": effect.get('value'),
                "target": effect.get('target'),
                "targetClass": effect.get('targetClass'),
                "characterUuids": [c.get('uuid') for c in recipients],
                # The EFFECT's own card is the narrative to render — not the event's.
                "card": _resolve_card_from_raw(raw_cards, raw_texts, effect.get('idCard'), lang),
            })

        if _events._nz(current.get('flagEndTime')) == 1:
            flags['endTime'] = True
        if end_game_id is not None and _events._nz(end_game_id) == event_id:
            flags['gameOver'] = True

        # Step 30 edge states: sadness overflow, then coma, over every character this
        # event touched. Only touched characters can have changed.
        for c in touched.values():
            v = _events.evaluate_edge_state(c)
            if not v['anything']:
                continue
            if v['sadnessOverflow']:
                stat_changes.append({
                    "characterUuid": c.get('uuid'), "statistic": "life",
                    "before": _nz(c.get('life')), "after": v['lifeAfter'],
                    "delta": v['lifeAfter'] - _nz(c.get('life')),
                })
                stat_changes.append({
                    "characterUuid": c.get('uuid'), "statistic": "sad",
                    "before": _nz(c.get('sad')), "after": 0, "delta": -_nz(c.get('sad')),
                })
                c['life'] = v['lifeAfter']
                # Resetting sad is also the idempotency latch: the next event of the chain
                # re-runs this block and finds nothing left to fire.
                c['sad'] = 0
                c['isSleeping'] = 1
                edge_state['sadnessOverflowUuids'].append(c.get('uuid'))
                if c.get('uuid') == caller.get('uuid'):
                    flags['forcedSleep'] = True
                _log_edge_state(match, c, event_id,
                                f"{_events.MSG_SADNESS_OVERFLOW} {c.get('uuid')}")
            if v['comaTriggered']:
                c['isComa'] = 1
                c['isSleeping'] = 1
                c['clockInComa'] = _nz(match.get('currentClock'))
                edge_state['comaUuids'].append(c.get('uuid'))
                _log_edge_state(match, c, event_id, f"{_events.MSG_COMA} {c.get('uuid')}")
                if c.get('uuid') == caller.get('uuid'):
                    flags['comaTriggered'] = True

        event_log = match.setdefault('eventLog', [])
        event_log.append({
            "characterUuid": caller.get('uuid'),
            "idEvent": event_id,
            "clock": _nz(match.get('currentClock')),
            "timestamp": _ts_ms(),
            "message": f'{_events.MSG_EVENT_EXECUTED} {event_id}',
        })

        if flags['comaTriggered'] and not epilogue_phase:
            # Coma stops the chain, and flag_end_time with it — but if the WHOLE party is
            # down the story epilogue runs first. The actor is necessarily one of the
            # comatose (a comatose character is rejected before an execution even starts),
            # so this break is exactly where the party collapse can be detected.
            coma_event = _resolve_all_player_coma(
                match, match_uuid, caller, touched, edge_state, events_by_id, ctx,
                story, raw_cards, raw_texts, lang, all_coma_resolved)
            all_coma_resolved = True
            if coma_event is None:
                break
            edge_state['comaEventMark'] = len(executed_uuids)
            edge_state['comaEffectMark'] = len(applied_effects)
            epilogue_phase = True
            current = coma_event
            continue

        nxt = current.get('idEventNext')
        if not nxt or _events._nz(nxt) <= 0:
            break
        next_id = _events._nz(nxt)
        if next_id in visited or len(visited) >= _events.MAX_CHAIN:
            break  # an authored loop, or a chain long enough to be a bug
        nxt_event = events_by_id.get(next_id)
        if nxt_event is None:
            break  # dangling idEventNext
        if str(nxt_event.get('type') or '').strip().upper() == _events.TYPE_ONCE \
                and next_id in ctx['consumedEventIds']:
            break  # a spent ONCE event stays spent, even mid-chain
        current = nxt_event  # not re-checked, not charged

    for c in touched.values():
        db_utils.put_item(c)

    current_clock = _nz(match.get('currentClock'))
    time_ended = False
    if flags['endTime'] and not flags['comaTriggered']:
        for c in _match_characters(match_uuid):
            c['isSleeping'] = 1
            db_utils.put_item(c)
        current_clock, _recovery, _fired = _advance_time(match, match_uuid)
        time_ended = True
    else:
        db_utils.put_item(match)

    # The epilogue is sliced off the tail so the board can tell it from the player's chain.
    if edge_state['comaEventUuid'] is None:
        chain_event_uuids, chain_effects = executed_uuids, applied_effects
        coma_event_uuids, coma_effects = [], []
    else:
        mark_e = edge_state['comaEventMark']
        mark_f = edge_state['comaEffectMark']
        chain_event_uuids, coma_event_uuids = executed_uuids[:mark_e], executed_uuids[mark_e:]
        chain_effects, coma_effects = applied_effects[:mark_f], applied_effects[mark_f:]

    changed = any([time_ended, flags['itemAdded'], flags['itemRemoved'],
                   flags['weatherApplied'], flags['movementApplied'],
                   flags['comaTriggered'], flags['gameOver'],
                   edge_state['sadnessOverflowUuids'], edge_state['comaUuids'],
                   edge_state['allPlayersInComa'],
                   stat_changes, registry_changes, trait_changes, characteristic_changes])

    return _ok({
        "matchUuid": match_uuid,
        "eventUuid": event.get('uuid'),
        "eventType": event.get('type'),
        # Step 31: the 0-choice flow — effects ran. Choice-events answer CHOICES_PENDING.
        "status": "APPLIED",
        "card": _resolve_card_from_raw(raw_cards, raw_texts, event.get('idCard'), lang),
        "executedEventUuids": chain_event_uuids,
        "energySpent": energy_spent,
        "coinSpent": coin_spent,
        "newEnergy": _nz(caller.get('energy')),
        "newCoin": _nz(caller.get('coin')),
        "currentClock": current_clock,
        # v0.29.0 — execute-event never touches the turn queue (Step 61 revisits this).
        "turnConsumed": False,
        "timeEnded": time_ended,
        "itemAdded": flags['itemAdded'],
        "itemRemoved": flags['itemRemoved'],
        "weatherApplied": flags['weatherApplied'],
        "movementApplied": flags['movementApplied'],
        "forcedSleep": time_ended or flags['comaTriggered'] or flags['forcedSleep'],
        "comaTriggered": flags['comaTriggered'],
        "gameOver": flags['gameOver'],
        "refreshRecommended": bool(changed),
        "statChanges": stat_changes,
        "registryChanges": registry_changes,
        "traitChanges": trait_changes,
        "itemChanges": item_changes,
        "characteristicChanges": characteristic_changes,
        "locationChanges": location_changes,
        "effects": chain_effects,
        # Empty by definition on APPLIED — the options ride on CHOICES_PENDING only.
        "pendingChoices": [],
        "edgeState": {
            "sadnessOverflowUuids": edge_state['sadnessOverflowUuids'],
            "comaUuids": edge_state['comaUuids'],
            "allPlayersInComa": edge_state['allPlayersInComa'],
            "comaEventUuid": edge_state['comaEventUuid'],
            "comaEventCard": edge_state['comaEventCard'],
            "comaExecutedEventUuids": coma_event_uuids,
            "comaEffects": coma_effects,
        },
    })


def _execute_choice_event(match, match_uuid, story, event, event_choices,
                          caller, characters, ctx, lang='en'):
    """Step 31 — a choice-event stops at its threshold: pay, mark, present — never apply.

    The whole Step 29 tail (effects, chain, flag_end_time, edge states, epilogue,
    gameOver) belongs to the resolution, which is Step 32's select-choice.

    An OPEN cycle — EVENT_EXECUTED markers outnumbering CHOICE_SELECTED markers —
    re-serves the options as a pure read: no verdict, no cost, no marker, no writes.
    Bypassing the verdict is deliberate: the open already deducted energy and consumed
    the ONCE, so re-checking would reject the very event the player has paid for.
    Option availability, in contrast, is re-evaluated fresh on every serve.
    """
    event_id = _events._nz(event.get('id'))
    open_cycle = event_id in ctx['consumedEventIds'] and (
        _choices.count_log_markers(match, event_id, _events.MSG_EVENT_EXECUTED)
        > _choices.count_log_markers(match, event_id, _choices.MSG_CHOICE_SELECTED))

    energy_spent = 0
    coin_spent = 0
    if not open_cycle:
        available, reason = _events.check(event, ctx)
        if not available:
            return _err(409, reason, f'Event cannot be executed: {reason}')
        # Pay, once, and write the same marker row the Step 29 flow writes — the ONCE
        # accounting and the log timeline cannot tell the two flows apart.
        energy_spent = _events._nz(event.get('costEnery'))
        coin_spent = _events._nz(event.get('coinCost'))
        if energy_spent:
            caller['energy'] = max(0, _nz(caller.get('energy')) - energy_spent)
        if coin_spent:
            caller['coin'] = max(0, _nz(caller.get('coin')) - coin_spent)
        ctx['consumedEventIds'].add(event_id)
        match.setdefault('eventLog', []).append({
            "characterUuid": caller.get('uuid'),
            "idEvent": event_id,
            "clock": _nz(match.get('currentClock')),
            "timestamp": _ts_ms(),
            "message": f'{_events.MSG_EVENT_EXECUTED} {event_id}',
        })
        db_utils.put_item(caller)
        db_utils.put_item(match)

    raw_cards = story.get('raw_cards') or []
    raw_texts = story.get('raw_texts') or []
    conditions = _choices.conditions_by_choice(story)
    cctx = _choices.build_choice_context(match, story, caller, characters, ctx,
                                         event_choices, conditions)
    pending = []
    for choice in event_choices:  # already priority-then-id sorted
        available, reason = _choices.check_choice(
            choice, conditions.get(_events._nz(choice.get('id')), []), cctx)
        pending.append({
            "uuid": choice.get('uuid'),
            "priority": choice.get('priority'),
            "name": _resolve_raw_text(raw_texts, choice.get('idTextName'), lang),
            "description": _resolve_raw_text(raw_texts, choice.get('idTextDescription'), lang),
            "card": _resolve_card_from_raw(raw_cards, raw_texts, choice.get('idCard'), lang),
            "available": available,
            # The choice's narrative (idTextNarrative) is deliberately absent — it would
            # leak the outcome of a choice not yet made (Step 32 reveals it).
            "reason": reason,
        })

    return _ok({
        "matchUuid": match_uuid,
        "eventUuid": event.get('uuid'),
        "eventType": event.get('type'),
        "status": "CHOICES_PENDING",
        "card": _resolve_card_from_raw(raw_cards, raw_texts, event.get('idCard'), lang),
        # "Index 0 is always the event" holds on a re-fetch too, so the frontend cannot
        # tell a page refresh from the first open (beside energySpent=0).
        "executedEventUuids": [event.get('uuid')],
        "energySpent": energy_spent,
        "coinSpent": coin_spent,
        "newEnergy": _nz(caller.get('energy')),
        "newCoin": _nz(caller.get('coin')),
        "currentClock": _nz(match.get('currentClock')),
        "turnConsumed": False,
        "timeEnded": False,
        "itemAdded": False,
        "itemRemoved": False,
        "weatherApplied": False,
        "movementApplied": False,
        "forcedSleep": False,
        "comaTriggered": False,
        "gameOver": False,
        "refreshRecommended": False,
        "statChanges": [],
        "registryChanges": [],
        "traitChanges": [],
        "itemChanges": [],
        "characteristicChanges": [],
        "locationChanges": [],
        "effects": [],
        "pendingChoices": pending,
        "edgeState": {
            "sadnessOverflowUuids": [], "comaUuids": [], "allPlayersInComa": False,
            "comaEventUuid": None, "comaEventCard": None,
            "comaExecutedEventUuids": [], "comaEffects": [],
        },
    })


def _select_choice(user, match_uuid, body, lang='en'):
    """POST /api/gameplay/{uuidMatch}/action/select-choice — Step 32.

    Resolve the option the player picked out of an open choice-event: apply its
    choiceEffects, run the events they and idEventTorun point at, record the milestone,
    close the cycle.

    **Nothing is charged.** The energy, the coins and the ONCE were all spent when the
    event was opened (Step 31), which is what makes the open-cycle count — not the Step 29
    availability procedure — the right gate here: re-running that procedure would reject
    the very event the player has already paid for. The count comparison doubles as the
    cost-bypass guard, since it is false both for an event never opened and for one
    already resolved.
    """
    if not match_uuid:
        return _err(400, 'INVALID_INPUT', 'Match uuid is required')
    choice_uuid = (body or {}).get('choiceUuid')
    if not choice_uuid or not str(choice_uuid).strip():
        return _err(400, 'MISSING_CHOICE', 'choiceUuid is required')

    match = db_utils.get_item(f'MATCH#{match_uuid}')
    if match is None:
        return _err(404, 'MATCH_NOT_FOUND', 'Match not found or not accessible')

    characters = _match_characters(match_uuid)
    caller = next((c for c in characters if c.get('userUuid') == user.get('uuid')), None)
    if caller is None:
        # An unknown match and a caller who is not in it are deliberately indistinguishable.
        return _err(404, 'MATCH_NOT_FOUND', 'Match not found or not accessible')

    if match.get('status') != 'RUNNING':
        return _err(409, 'MATCH_NOT_RUNNING', _MATCH_NOT_RUNNING_MSG)

    story = db_utils.get_item(f'STORY#{match.get("storyUuid")}') or {}
    choice = _choices.choice_by_uuid(story, choice_uuid)
    if choice is None:
        return _err(404, 'CHOICE_NOT_FOUND', 'Choice not found in this story')

    # Coma outranks sleep, as everywhere else: a comatose character is also flagged
    # asleep, and the two are not the same news — one waits, the other needs a rescue.
    if _nz(caller.get('isComa')) == 1:
        return _err(409, 'COMA', 'Character is in a coma')
    if _nz(caller.get('isSleeping')) == 1:
        return _err(409, 'SLEEPING', 'Character is sleeping')

    # R8 (Step 31) makes idEvent mandatory on import, but the CRUD path is lenient, so an
    # orphan option can reach the engine — it resolves to no cycle and is rejected.
    event_id = _events._nz(choice.get('idEvent'))
    all_events = story.get('events') or []
    events_by_id = {_events._nz(e.get('id')): e for e in all_events if e.get('id') is not None}
    event = events_by_id.get(event_id)
    if event is None:
        return _err(404, 'EVENT_NOT_FOUND', 'The event owning this choice does not exist')

    if _choices.count_log_markers(match, event_id, _events.MSG_EVENT_EXECUTED) \
            <= _choices.count_log_markers(match, event_id, _choices.MSG_CHOICE_SELECTED):
        return _err(409, 'CHOICE_NOT_OPEN',
                    'No open choice cycle for this event: open it before resolving it')

    ctx = _events.build_context(match, story, caller)
    classes_by_uuid = {c.get('uuid'): c.get('id') for c in (story.get('classes') or [])}
    for c in characters:
        c['classId'] = classes_by_uuid.get(c.get('classUuid'))

    # The option's verdict, re-evaluated now rather than trusted from the open: the world
    # may have moved since the options were served, and an option that has become
    # impossible must not resolve.
    conditions = _choices.conditions_by_choice(story)
    cctx = _choices.build_choice_context(match, story, caller, characters, ctx,
                                         [choice], conditions)
    available, reason = _choices.check_choice(
        choice, conditions.get(_events._nz(choice.get('id')), []), cctx)
    if not available:
        return _err(409, 'CHOICE_NOT_AVAILABLE', f'Choice cannot be selected: {reason}')

    return _resolve_choice(match, match_uuid, story, event, event_id, choice, caller,
                           characters, ctx, events_by_id, lang)


def _resolve_choice(match, match_uuid, story, event, event_id, choice, caller,
                    characters, ctx, events_by_id, lang):
    """The write half of select-choice, once every guard has passed."""
    raw_cards = story.get('raw_cards') or []
    raw_texts = story.get('raw_texts') or []
    item_uuids = {_events._nz(i.get('id')): i.get('uuid') for i in (story.get('items') or [])}
    location_uuids = {_events._nz(l.get('id')): l.get('uuid')
                      for l in (story.get('locations') or [])}

    acc = _new_accumulator(caller)
    linked = []

    # ── the option's own effect rows, in authored order ──
    for effect in _choices.effects_for_choice(story, _events._nz(choice.get('id'))):
        recipients = _choices.choice_recipients(effect, caller, characters)

        # Weather belongs to the MATCH: once per row, however many characters it targets.
        id_weather = effect.get('idWeather')
        if id_weather:
            match['currentWeatherId'] = _events._nz(id_weather)
            ctx['currentWeatherId'] = _events._nz(id_weather)
            acc['flags']['weatherApplied'] = True

        for target_char in recipients:
            acc['touched'][target_char.get('uuid')] = target_char
            _events.apply_stat(target_char, effect, acc['statChanges'])
            added, removed = _events.apply_item(target_char, effect, item_uuids,
                                                acc['itemChanges'])
            acc['flags']['itemAdded'] = acc['flags']['itemAdded'] or added
            acc['flags']['itemRemoved'] = acc['flags']['itemRemoved'] or removed
            moved = _events.apply_location(match, target_char, effect, location_uuids,
                                           acc['locationChanges'], _ts_ms())
            acc['flags']['movementApplied'] = acc['flags']['movementApplied'] or moved

        _apply_choice_registry(match, ctx, effect, acc['registryChanges'])

        acc['effects'].append({
            "eventUuid": event.get('uuid'),
            "effectUuid": effect.get('uuid'),
            "statistic": effect.get('statistics'),
            "value": effect.get('value'),
            "target": "ALL" if _events._nz(effect.get('flagGroup')) == 1 else "ONLY_ONE",
            "targetClass": None,
            "characterUuids": [c.get('uuid') for c in recipients],
            # The row's OWN card is the narrative, exactly as for an event effect.
            "card": _resolve_card_from_raw(raw_cards, raw_texts, effect.get('idCard'), lang),
        })
        if effect.get('idEvent'):
            linked.append(_events._nz(effect.get('idEvent')))

    # No event ran for those rows, so the Step 30 pass has to be given here — once, over
    # everyone they touched, exactly where the event flow runs it. A lethal row therefore
    # does NOT silence its siblings; what a coma stops is the consequences below.
    _apply_edge_states(match, caller, acc, event_id)

    # ── the consequences: the effect links first, then the option's outcome event ──
    status = 'APPLIED'
    pending = []
    for link in linked + [_events._nz(choice.get('idEventTorun'))]:
        if acc['flags']['comaTriggered'] or status == 'CHOICES_PENDING':
            break  # down, or waiting on the player again: the rest is not ours to run
        status, pending = _run_linked_event(match, match_uuid, story, link, caller,
                                            characters, ctx, events_by_id, acc,
                                            item_uuids, location_uuids, lang)

    for c in acc['touched'].values():
        db_utils.put_item(c)

    # ── close the cycle: the marker, the history row, the milestone ──
    clock = _nz(match.get('currentClock'))
    # The CHOICE_SELECTED marker carries the OWNING EVENT's id, never the option's:
    # count_log_markers pairs it against EVENT_EXECUTED by event, and a row stamped with
    # the choice id would leave the cycle open for ever.
    match.setdefault('eventLog', []).append({
        "characterUuid": caller.get('uuid'),
        "idEvent": event_id,
        "clock": clock,
        "timestamp": _ts_ms(),
        "message": f'{_choices.MSG_CHOICE_SELECTED} {event_id}',
    })
    choice_id = _events._nz(choice.get('id'))
    match.setdefault('choiceLog', []).append({
        "idEvent": event_id,
        "idChoise": choice_id,
        "clock": clock,
        "timestamp": _ts_ms(),
        "message": f'{_choices.MSG_CHOICE_SELECTED} {choice_id}',
    })
    progress_recorded = _events._nz(choice.get('isProgress')) == 1
    if progress_recorded:
        match.setdefault('storyProgress', []).append({
            "idEvent": event_id,
            "idChoise": choice_id,
            "clock": clock,
            "timestamp": _ts_ms(),
        })

    current_clock = clock
    time_ended = False
    if acc['flags']['endTime'] and not acc['flags']['comaTriggered']:
        for c in _match_characters(match_uuid):
            c['isSleeping'] = 1
            db_utils.put_item(c)
        current_clock, _recovery, _fired = _advance_time(match, match_uuid)
        time_ended = True
    else:
        db_utils.put_item(match)

    changed = any([time_ended, acc['flags']['itemAdded'], acc['flags']['itemRemoved'],
                   acc['flags']['weatherApplied'], acc['flags']['movementApplied'],
                   acc['flags']['comaTriggered'], acc['flags']['gameOver'],
                   acc['edgeState']['sadnessOverflowUuids'], acc['edgeState']['comaUuids'],
                   acc['statChanges'], acc['registryChanges'], acc['traitChanges'],
                   acc['characteristicChanges']])

    return _ok({
        "matchUuid": match_uuid,
        # The event that owned the option — the payload is about it, as on execute-event.
        "eventUuid": event.get('uuid'),
        "eventType": event.get('type'),
        "status": status,
        "card": _resolve_card_from_raw(raw_cards, raw_texts, event.get('idCard'), lang),
        "executedEventUuids": acc['executedUuids'],
        # Always 0: the open already paid, and resolving is what that payment bought.
        "energySpent": 0,
        "coinSpent": 0,
        "newEnergy": _nz(caller.get('energy')),
        "newCoin": _nz(caller.get('coin')),
        "currentClock": current_clock,
        "turnConsumed": False,
        "timeEnded": time_ended,
        "itemAdded": acc['flags']['itemAdded'],
        "itemRemoved": acc['flags']['itemRemoved'],
        "weatherApplied": acc['flags']['weatherApplied'],
        "movementApplied": acc['flags']['movementApplied'],
        "forcedSleep": time_ended or acc['flags']['comaTriggered'] or acc['flags']['forcedSleep'],
        "comaTriggered": acc['flags']['comaTriggered'],
        "gameOver": acc['flags']['gameOver'],
        "refreshRecommended": bool(changed),
        "statChanges": acc['statChanges'],
        "registryChanges": acc['registryChanges'],
        "traitChanges": acc['traitChanges'],
        "itemChanges": acc['itemChanges'],
        "characteristicChanges": acc['characteristicChanges'],
        "locationChanges": acc['locationChanges'],
        "effects": acc['effects'],
        "pendingChoices": pending,
        "edgeState": {
            "sadnessOverflowUuids": acc['edgeState']['sadnessOverflowUuids'],
            "comaUuids": acc['edgeState']['comaUuids'],
            "allPlayersInComa": acc['edgeState']['allPlayersInComa'],
            "comaEventUuid": None, "comaEventCard": None,
            "comaExecutedEventUuids": [], "comaEffects": [],
        },
        # ── what only a resolution knows ──
        "choiceUuid": choice.get('uuid'),
        # Withheld by Step 31 (it would have leaked the consequence of a choice not yet
        # made), revealed now that the choice is irreversible.
        "narrative": _resolve_raw_text(raw_texts, choice.get('idTextNarrative'), lang),
        "choiceCard": _resolve_card_from_raw(raw_cards, raw_texts, choice.get('idCard'), lang),
        "choiceEventUuid": acc['choiceEventUuid'],
        "choiceEventCard": acc['choiceEventCard'],
        "progressRecorded": progress_recorded,
    })


def _new_accumulator(caller):
    """The mutable state of one resolution, in one dict so the helpers can share it."""
    return {
        'statChanges': [], 'registryChanges': [], 'traitChanges': [], 'itemChanges': [],
        'characteristicChanges': [], 'locationChanges': [], 'effects': [],
        'executedUuids': [], 'touched': {caller.get('uuid'): caller},
        # The events THIS resolution has already run. It is what stops a link from
        # running twice within one call — deliberately NOT the match-wide
        # consumedEventIds, which only governs the ONCE rule: a NORMAL event stays
        # re-runnable however many times it has been executed before.
        'visited': set(),
        'choiceEventUuid': None, 'choiceEventCard': None,
        'edgeState': {'sadnessOverflowUuids': [], 'comaUuids': [], 'allPlayersInComa': False},
        'flags': {'itemAdded': False, 'itemRemoved': False, 'weatherApplied': False,
                  'movementApplied': False, 'comaTriggered': False, 'gameOver': False,
                  'endTime': False, 'forcedSleep': False},
    }


def _apply_choice_registry(match, ctx, effect, changes):
    """The registry pair of a choice effect. ``valueToAdd`` sets the key;
    ``valueToRemove`` clears it, but only when the stored value actually matches — an
    option must not be able to wipe a key some other branch of the story has since moved
    on. Written once per row: the registry is match-scoped."""
    key = effect.get('key')
    if not key:
        return
    old = ctx['registry'].get(key)
    add = effect.get('valueToAdd')
    remove = effect.get('valueToRemove')
    if add:
        value = add
    elif remove and remove == old:
        value = None  # the key reads as unset afterwards
    else:
        return
    _events.apply_registry(match, key, value, changes)
    ctx['registry'][key] = value


def _apply_edge_states(match, caller, acc, event_id):
    """Step 30 — the sadness-overflow and coma rules over everyone the rows touched."""
    for c in acc['touched'].values():
        v = _events.evaluate_edge_state(c)
        if not v['anything']:
            continue
        if v['sadnessOverflow']:
            acc['statChanges'].append({
                "characterUuid": c.get('uuid'), "statistic": "life",
                "before": _nz(c.get('life')), "after": v['lifeAfter'],
                "delta": v['lifeAfter'] - _nz(c.get('life')),
            })
            acc['statChanges'].append({
                "characterUuid": c.get('uuid'), "statistic": "sad",
                "before": _nz(c.get('sad')), "after": 0, "delta": -_nz(c.get('sad')),
            })
            c['life'] = v['lifeAfter']
            # Resetting sad is also the idempotency latch for the rest of the resolution.
            c['sad'] = 0
            c['isSleeping'] = 1
            acc['edgeState']['sadnessOverflowUuids'].append(c.get('uuid'))
            if caller is not None and c.get('uuid') == caller.get('uuid'):
                acc['flags']['forcedSleep'] = True
            _log_edge_state(match, c, event_id,
                            f"{_events.MSG_SADNESS_OVERFLOW} {c.get('uuid')}")
        if v['comaTriggered']:
            c['isComa'] = 1
            c['isSleeping'] = 1
            c['clockInComa'] = _nz(match.get('currentClock'))
            acc['edgeState']['comaUuids'].append(c.get('uuid'))
            _log_edge_state(match, c, event_id, f"{_events.MSG_COMA} {c.get('uuid')}")
            if caller is not None and c.get('uuid') == caller.get('uuid'):
                acc['flags']['comaTriggered'] = True


def _run_linked_event(match, match_uuid, story, id_event, caller, characters, ctx,
                      events_by_id, acc, item_uuids, location_uuids, lang):
    """Run an event a choice points at — ``idEventTorun`` on the option, or ``idEvent`` on
    one of its effect rows — with its whole ``idEventNext`` chain.

    A linked event is a **consequence**, so it is neither re-checked nor charged (the Step
    29 chain rule). If it is itself a choice-event the resolution does not apply its
    effects — they are withheld by definition — but presents its options instead, so a
    story that chains a choice onto a choice keeps working; the options are served free,
    the open having already been paid for by the choice that led here.

    Returns ``(status, pendingChoices)``.
    """
    if not id_event or id_event <= 0:
        return 'APPLIED', []
    linked = events_by_id.get(id_event)
    if linked is None or id_event in acc['visited']:
        return 'APPLIED', []  # dangling id, or already run in THIS resolution
    # Only a ONCE event is barred by having been executed before. Testing every type
    # against consumedEventIds — as this did until v0.32.0 — silently skipped any NORMAL
    # link the match had ever run, so an option's "event to run" fired at most once per
    # match and then quietly stopped, effects still applying.
    if str(linked.get('type') or '').strip().upper() == _events.TYPE_ONCE \
            and id_event in ctx['consumedEventIds']:
        return 'APPLIED', []

    nested = _choices.choices_for_event(story, id_event)
    if nested:
        acc['visited'].add(id_event)
        ctx['consumedEventIds'].add(id_event)
        if linked.get('uuid'):
            acc['executedUuids'].append(linked.get('uuid'))
        match.setdefault('eventLog', []).append({
            "characterUuid": caller.get('uuid'),
            "idEvent": id_event,
            "clock": _nz(match.get('currentClock')),
            "timestamp": _ts_ms(),
            "message": f'{_events.MSG_EVENT_EXECUTED} {id_event}',
        })
        raw_cards = story.get('raw_cards') or []
        raw_texts = story.get('raw_texts') or []
        conditions = _choices.conditions_by_choice(story)
        cctx = _choices.build_choice_context(match, story, caller, characters, ctx,
                                             nested, conditions)
        pending = []
        for opt in nested:  # already priority-then-id sorted
            ok, why = _choices.check_choice(
                opt, conditions.get(_events._nz(opt.get('id')), []), cctx)
            pending.append({
                "uuid": opt.get('uuid'),
                "priority": opt.get('priority'),
                "name": _resolve_raw_text(raw_texts, opt.get('idTextName'), lang),
                "description": _resolve_raw_text(raw_texts, opt.get('idTextDescription'), lang),
                "card": _resolve_card_from_raw(raw_cards, raw_texts, opt.get('idCard'), lang),
                "available": ok,
                "reason": why,
            })
        return 'CHOICES_PENDING', pending

    if acc['choiceEventUuid'] is None:
        raw_cards = story.get('raw_cards') or []
        raw_texts = story.get('raw_texts') or []
        acc['choiceEventUuid'] = linked.get('uuid')
        acc['choiceEventCard'] = _resolve_card_from_raw(
            raw_cards, raw_texts, linked.get('idCard'), lang)
    _run_event_chain(match, story, linked, caller, characters, ctx, events_by_id, acc,
                     item_uuids, location_uuids, lang)
    return 'APPLIED', []


def _run_event_chain(match, story, first, caller, characters, ctx, events_by_id, acc,
                     item_uuids, location_uuids, lang):
    """Apply an event and its ``idEventNext`` chain: effects, edge states, log. Neither is
    re-checked nor charged — the whole chain is one consequence."""
    effects_by_event = _events.effects_by_event(story)
    end_game_id = story.get('idEventEndGame')
    raw_cards = story.get('raw_cards') or []
    raw_texts = story.get('raw_texts') or []
    # Shared with the caller, so an event already run by an earlier link of the SAME
    # resolution is not run again — and so the MAX_CHAIN belt spans the whole resolution.
    visited = acc['visited']

    current = first
    while current is not None:
        event_id = _events._nz(current.get('id'))
        visited.add(event_id)
        ctx['consumedEventIds'].add(event_id)
        if current.get('uuid'):
            acc['executedUuids'].append(current.get('uuid'))

        for effect in effects_by_event.get(event_id, []):
            recipients = _events.resolve_recipients(effect, caller, characters)
            id_weather = effect.get('idWeather')
            if id_weather:
                match['currentWeatherId'] = _events._nz(id_weather)
                ctx['currentWeatherId'] = _events._nz(id_weather)
                acc['flags']['weatherApplied'] = True
            for target_char in recipients:
                acc['touched'][target_char.get('uuid')] = target_char
                _events.apply_stat(target_char, effect, acc['statChanges'])
                added, removed = _events.apply_item(target_char, effect, item_uuids,
                                                    acc['itemChanges'])
                acc['flags']['itemAdded'] = acc['flags']['itemAdded'] or added
                acc['flags']['itemRemoved'] = acc['flags']['itemRemoved'] or removed
                _events.apply_traits(target_char, effect, {}, acc['traitChanges'])
                _events.apply_characteristics(target_char, effect,
                                              acc['characteristicChanges'])
                moved = _events.apply_location(match, target_char, effect, location_uuids,
                                               acc['locationChanges'], _ts_ms())
                acc['flags']['movementApplied'] = acc['flags']['movementApplied'] or moved
            key = effect.get('keyToAdd')
            if key:
                value = effect.get('keyValueToAdd')
                _events.apply_registry(match, key, value, acc['registryChanges'])
                ctx['registry'][key] = value
            acc['effects'].append({
                "eventUuid": current.get('uuid'),
                "effectUuid": effect.get('uuid'),
                "statistic": effect.get('statistics'),
                "value": effect.get('value'),
                "target": effect.get('target'),
                "targetClass": effect.get('targetClass'),
                "characterUuids": [c.get('uuid') for c in recipients],
                "card": _resolve_card_from_raw(raw_cards, raw_texts, effect.get('idCard'), lang),
            })

        if _events._nz(current.get('flagEndTime')) == 1:
            acc['flags']['endTime'] = True
        if end_game_id is not None and _events._nz(end_game_id) == event_id:
            acc['flags']['gameOver'] = True

        _apply_edge_states(match, caller, acc, event_id)
        match.setdefault('eventLog', []).append({
            # Step 33 — an automatic event in an empty location has no actor at all.
            "characterUuid": caller.get('uuid') if caller else None,
            "idEvent": event_id,
            "clock": _nz(match.get('currentClock')),
            "timestamp": _ts_ms(),
            "message": f'{_events.MSG_EVENT_EXECUTED} {event_id}',
        })

        if acc['flags']['comaTriggered']:
            return  # coma stops the chain, and flagEndTime with it
        nxt = current.get('idEventNext')
        if not nxt or _events._nz(nxt) <= 0:
            return
        next_id = _events._nz(nxt)
        if next_id in visited or len(visited) >= _events.MAX_CHAIN:
            return  # an authored loop, or a chain long enough to be a bug
        nxt_event = events_by_id.get(next_id)
        if nxt_event is None:
            return  # dangling idEventNext
        if str(nxt_event.get('type') or '').strip().upper() == _events.TYPE_ONCE \
                and next_id in ctx['consumedEventIds']:
            return  # a spent ONCE event stays spent, even mid-chain
        current = nxt_event


def _visited_location_ids(match, match_uuid):
    """The locations the party has ever been to — current positions plus every endpoint in
    the match's movementLog. The same set Step 28 derives for fog of war, and what decides
    whether a counter-zero notice may name the place it happened in."""
    ids = []
    for c in _match_characters(match_uuid):
        loc = c.get('idLocation')
        if loc is not None and _nz(loc) not in ids:
            ids.append(_nz(loc))
    for m in (match.get('movementLog') or []):
        for loc in (m.get('idLocationFrom'), m.get('idLocationTo')):
            if loc is not None and _nz(loc) not in ids:
                ids.append(_nz(loc))
    return ids


# ── Step 33 — automatic location events ──────────────────────────────────────

def _location_triggers(story, id_location):
    """The trigger columns of one story location, or None when it is unknown."""
    for l in (story.get('locations') or []):
        if _nz(l.get('id')) == id_location:
            return l
    return None


def _flag_visited(match, id_location):
    """``flagVisited`` on the embedded location state. 0 when there is no row —
    a location nobody has been to."""
    for ls in (match.get('locations') or []):
        if _nz(ls.get('idLocation')) == id_location:
            return _nz(ls.get('flagVisited'))
    return 0


def _mark_location_visited(match, id_location):
    """Latch the location as visited by the party. Idempotent."""
    for ls in (match.get('locations') or []):
        if _nz(ls.get('idLocation')) == id_location:
            ls['flagVisited'] = 1
            return


def _log_automatic_event(match, actor_uuid, id_location, id_event, clock, message):
    match.setdefault('eventLog', []).append({
        "characterUuid": actor_uuid,
        "idEvent": id_event,
        "idLocation": id_location,
        "clock": clock,
        "timestamp": _ts_ms(),
        "message": message,
    })


def _resolve_arrival(match, match_uuid, story, actor_uuid, id_location, lang, depth, out):
    """The dispatch table of an arrival.

    The order is fixed rather than authored: the history trigger (first or subsequent —
    never both) comes before the occupancy one, which is orthogonal to it and may fire
    alongside either.

    ``flagVisited`` is latched AFTER the triggers have been read, so the first arrival
    still evaluates as a first arrival; and it is latched even when the location authors
    no trigger at all, because the flag describes the party's history, not what happened
    to fire.
    """
    clock = _nz(match.get('currentClock'))
    if depth >= _events.MAX_ENTRY_DEPTH:
        _log_automatic_event(
            match, actor_uuid, id_location, None, clock,
            f'{_events.MSG_AUTOMATIC_EVENT} aborted: entry depth '
            f'{_events.MAX_ENTRY_DEPTH} exceeded at location {id_location} — the story '
            f'loops a forced movement back on itself')
        return
    triggers = _location_triggers(story, id_location)
    visited = _flag_visited(match, id_location) == 1
    if triggers is not None:
        history_event = (triggers.get('idEventNotFirstTime') if visited
                         else triggers.get('idEventIfFirstTime'))
        history_trigger = (_events.TRIGGER_SUBSEQUENT_ENTRY if visited
                           else _events.TRIGGER_FIRST_ENTRY)
        _run_automatic_event(match, match_uuid, story, actor_uuid, history_event,
                             id_location, history_trigger, lang, depth, out)

        others = [c for c in _match_characters(match_uuid)
                  if _nz(c.get('idLocation')) == id_location
                  and c.get('uuid') != actor_uuid]
        if not others:
            _run_automatic_event(match, match_uuid, story, actor_uuid,
                                 triggers.get('idEventIfCharacterEnterEmptyLocation'),
                                 id_location, _events.TRIGGER_MOVE_INTO_EMPTY_LOCATION, lang,
                                 depth, out)
    _mark_location_visited(match, id_location)


def _run_automatic_event(match, match_uuid, story, actor_uuid, id_event, id_location,
                         trigger, lang, depth, out):
    """Run one automatic event and its whole ``idEventNext`` chain.

    What makes it different from ``_execute_event``:

    * **Nobody pays.** No energy, no coins — the player did not ask for this.
    * **No availability verdict.** The type gate would refuse it outright (AUTOMATIC is
      not in EXECUTABLE_TYPES), and the sleep/coma guards would refuse it on behalf of a
      character that never volunteered.
    * **The actor may be absent.** A counter-zero fuse belongs to a location, and the
      location may be empty. Effects that need a recipient are then skipped while
      registry, weather and the chain still run.
    * **It may not own choices.** There is no response to carry the options and no
      select-choice could ever close the cycle, so the event is refused and logged instead
      of wedging the match with a decision nobody can answer.
    """
    if id_event is None or _nz(id_event) <= 0:
        return  # a null column is simply not a trigger
    id_event = _nz(id_event)
    clock = _nz(match.get('currentClock'))
    if str(match.get('status') or '') != 'RUNNING':
        return

    events_by_id = {_nz(e.get('id')): e for e in (story.get('events') or [])}
    event = events_by_id.get(id_event)
    if event is None:
        return  # dangling id: authored noise, not an error
    if _choices.choices_for_event(story, id_event):
        _log_automatic_event(
            match, actor_uuid, id_location, id_event, clock,
            f'{_events.MSG_AUTOMATIC_EVENT} skipped {id_event} ({trigger}): '
            f'an automatic event may not own choices')
        return

    characters = _match_characters(match_uuid)
    classes_by_uuid = {c.get('uuid'): c.get('id') for c in (story.get('classes') or [])}
    for c in characters:
        c['classId'] = classes_by_uuid.get(c.get('classUuid'))
    actor = next((c for c in characters if c.get('uuid') == actor_uuid), None)
    ctx = _events.build_context(match, story, actor)

    acc = _new_accumulator(actor) if actor is not None else _new_accumulator_no_actor()
    item_uuids = {_nz(i.get('id')): i.get('uuid') for i in (story.get('items') or [])}
    location_uuids = {_nz(l.get('id')): l.get('uuid') for l in (story.get('locations') or [])}

    _run_event_chain(match, story, event, actor, characters, ctx, events_by_id, acc,
                     item_uuids, location_uuids, lang)

    for touched in acc['touched'].values():
        if touched is not None:
            db_utils.put_item(touched)
    db_utils.put_item(match)

    _log_automatic_event(
        match, actor_uuid, id_location, id_event, _nz(match.get('currentClock')),
        f'{_events.MSG_AUTOMATIC_EVENT} {id_event} ({trigger}) at location {id_location}')

    raw_cards = story.get('raw_cards') or []
    raw_texts = story.get('raw_texts') or []
    out.append({
        "trigger": trigger,
        "idLocation": id_location,
        "eventUuid": event.get('uuid'),
        "card": _resolve_card_from_raw(raw_cards, raw_texts, event.get('idCard'), lang),
        "effects": list(acc['effects']),
        "statChanges": list(acc['statChanges']),
        "locationChanges": list(acc['locationChanges']),
        "gameOver": bool(acc['flags']['gameOver']),
    })

    # The events this one caused by pushing somebody somewhere: a forced move is an
    # arrival like any other.
    for change in list(acc['locationChanges']):
        moved_uuid = change.get('characterUuid')
        moved_to = location_uuids_inverse(location_uuids, change.get('toLocationUuid'))
        if moved_to is not None:
            _resolve_arrival(match, match_uuid, story, moved_uuid, moved_to, lang,
                             depth + 1, out)


def location_uuids_inverse(location_uuids, uuid):
    """Location uuid back to its story id; None when unknown."""
    if not uuid:
        return None
    for loc_id, loc_uuid in location_uuids.items():
        if loc_uuid == uuid:
            return loc_id
    return None


def _new_accumulator_no_actor():
    """The accumulator of an automatic event nobody is present for."""
    acc = _new_accumulator({'uuid': None})
    acc['touched'] = {}
    return acc


def _run_pending_automatic_events(match, match_uuid, story, pending, lang='en'):
    """Run the events a time-start collected — counter-zero fuses and
    idEventIfCharacterStartTime — in the order the recovery pass produced them."""
    out = []
    for p in (pending or []):
        _run_automatic_event(match, match_uuid, story, p.get('actorUuid'),
                             p.get('idEvent'), p.get('idLocation'), p.get('trigger'),
                             lang, 0, out)
    return out


def _describe_for_recipient(match, match_uuid, story, recipient_uuid, fired, clock,
                            lang='en'):
    """Describe an already-run list of automatic events TO ONE RECIPIENT (fog of war).

    Deliberately separate from running them: the engine produces the list once and
    unfiltered, and the telling is per person, because every player has their own visited
    set. Single-player is simply the one-recipient case — filtering while the list is
    assembled would bake it in and force a rewrite when the broadcast lands.

    Each entry carries three cards (v0.33.1): `card` is the EVENT's — what happened;
    `cardEffects` are the effect rows it applied, each with its own card, which is the
    narrative the board renders; `cardLocation` is the place. Until v0.33.1 only the place
    travelled, so the player woke to a name instead of the news.
    """
    if not fired:
        return []
    here = None
    visited = set()
    if recipient_uuid is not None:
        recipient = next((c for c in _match_characters(match_uuid)
                          if c.get('uuid') == recipient_uuid), None)
        if recipient is not None:
            here = _nz(recipient.get('idLocation'))
        visited = set(_visited_location_ids(match, match_uuid))

    raw_cards = story.get('raw_cards') or []
    raw_texts = story.get('raw_texts') or []
    out = []
    for f in fired:
        id_location = f.get('idLocation')
        if here is not None and here == id_location:
            visibility = _events.VISIBILITY_FULL
        elif id_location in visited:
            visibility = _events.VISIBILITY_NAMED
        else:
            visibility = _events.VISIBILITY_ANONYMOUS
        # The cards are resolved only when the recipient may see them: a name that never
        # leaves the server cannot leak. The event's card and its effect rows already ride
        # on the fired event — only the location card costs a lookup.
        card = None
        card_location = None
        card_effects = []
        if visibility != _events.VISIBILITY_ANONYMOUS:
            loc = _location_triggers(story, id_location) or {}
            card_location = _resolve_card_from_raw(raw_cards, raw_texts, loc.get('idCard'), lang)
            card = f.get('card')
            card_effects = list(f.get('effects') or [])
        out.append({
            "trigger": f.get('trigger'),
            "idLocation": id_location,
            "card": card,
            "cardLocation": card_location,
            "cardEffects": card_effects,
            "eventUuid": f.get('eventUuid'),
            "clock": clock,
            "visibility": visibility,
        })
    return out


def _visited_locations_payload(match, match_uuid, lang='en'):
    """Build the visited-locations payload with character counts, per-neighbor
    totalEnergyCost resolved for the current weather and the resolved location
    cards (Step 28). Cards are resolved from idCard against the story's
    raw_cards/raw_texts, exactly like ``_build_locations_active``."""
    story = db_utils.get_item(f'STORY#{match.get("storyUuid")}') or {}
    locations = story.get('locations') or []
    neighbors = _story_neighbors(story)
    loc_by_id = {l.get('id'): l for l in locations}
    raw_cards = story.get('raw_cards') or []
    raw_texts = story.get('raw_texts') or []
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
                # One-way link (flagBack=NO): not offered as a way back.
                if not _neighbor_traversable_from(n, loc_id):
                    continue
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
            # Fog of war (v0.28.6): hide the neighbor's LOCATION card (idCard +
            # card) until that location has been visited.
            other_visited = other_id in seen
            neighbor_id_card = other.get('idCard') if other_visited else None
            neighbor_costs.append({
                "idLocation": other_id,
                "uuid": other.get('uuid'),
                "direction": n.get('direction'),
                "idCard": neighbor_id_card,
                "card": _resolve_card_from_raw(raw_cards, raw_texts, neighbor_id_card, lang),
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
            "card": _resolve_card_from_raw(raw_cards, raw_texts, loc.get('idCard'), lang),
            "safe": _nz(loc.get('secureParam')) > 0,
            "characterCount": count,
            "neighbors": neighbor_costs,
        })
    return {"matchUuid": match_uuid, "locations": result}


def _get_locations(user, match_uuid, lang='en'):
    match, err = _require_owned_match(user, match_uuid)
    if err:
        return err
    return _ok(_visited_locations_payload(match, match_uuid, lang))


def _get_admin_locations(match_uuid, lang='en'):
    if not match_uuid or not match_uuid.strip():
        return _err(400, 'INVALID_INPUT', 'Match uuid is required')
    match = db_utils.get_item(f'MATCH#{match_uuid}')
    if match is None:
        return _err(404, 'MATCH_NOT_FOUND', f'Match not found: {match_uuid}')
    return _ok(_visited_locations_payload(match, match_uuid, lang))


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
        if path.endswith('/logs') and method == 'GET':
            qs = (event.get('queryStringParameters') or {})
            return _get_admin_match_logs(match_uuid, qs.get('lang') or 'en',
                                         qs.get('limit'), qs.get('cursor'), qs.get('order'))
        if path.endswith('/locations') and method == 'GET':
            lang = (event.get('queryStringParameters') or {}).get('lang') or 'en'
            return _get_admin_locations(match_uuid, lang)
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

    # Step 28.7 — GET /api/matches/{uuidMatch}/logs
    if (path.startswith(_API_MATCHES_PATH) and path.endswith('/logs') and method == 'GET'):
        params = (event.get('pathParameters') or {})
        match_uuid = params.get('uuidMatch')
        if not match_uuid:
            segments = path.split('/')
            match_uuid = segments[3] if len(segments) > 4 else ''
        qs = (event.get('queryStringParameters') or {})
        return _get_match_logs(user, match_uuid, qs.get('lang') or 'en',
                               qs.get('limit'), qs.get('cursor'), qs.get('order'))

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

    # ── Step 29 — normal events ──
    if (path.startswith(_API_GAMEPLAY_PATH) and path.endswith('/action/execute-event')
            and method == 'POST'):
        params = event.get('pathParameters') or {}
        match_uuid = params.get('uuidMatch') or ''
        if not match_uuid:
            segments = path.split('/')  # /api/gameplay/{uuidMatch}/action/execute-event
            match_uuid = segments[3] if len(segments) > 3 else ''
        try:
            body = json.loads(event.get('body') or '{}')
        except (TypeError, ValueError):
            return _err(400, 'INVALID_INPUT', 'Body must be valid JSON')
        lang = (event.get('queryStringParameters') or {}).get('lang') or 'en'
        return _execute_event(user, match_uuid, body, lang)

    # ── Step 32 — choice resolution ──
    if (path.startswith(_API_GAMEPLAY_PATH) and path.endswith('/action/select-choice')
            and method == 'POST'):
        params = event.get('pathParameters') or {}
        match_uuid = params.get('uuidMatch') or ''
        if not match_uuid:
            segments = path.split('/')  # /api/gameplay/{uuidMatch}/action/select-choice
            match_uuid = segments[3] if len(segments) > 3 else ''
        try:
            body = json.loads(event.get('body') or '{}')
        except (TypeError, ValueError):
            return _err(400, 'INVALID_INPUT', 'Body must be valid JSON')
        lang = (event.get('queryStringParameters') or {}).get('lang') or 'en'
        return _select_choice(user, match_uuid, body, lang)

    if (path.startswith('/api/match/') and path.endswith('/locations') and method == 'GET'):
        params = event.get('pathParameters') or {}
        match_uuid = params.get('uuidMatch') or ''
        if not match_uuid:
            segments = path.split('/')  # /api/match/{uuidMatch}/locations
            match_uuid = segments[3] if len(segments) > 4 else ''
        lang = (event.get('queryStringParameters') or {}).get('lang') or 'en'
        return _get_locations(user, match_uuid, lang)

    return _err(404, 'NOT_FOUND', f'Unknown route {method} {path}')
