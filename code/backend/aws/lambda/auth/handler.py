"""
auth/handler.py — Paths Games AWS Lambda
Handles every route registered for AuthFunction in template.yaml.

Routes (API contracts match Java OpenAPI specs):
  POST /api/auth/guest               → create_guest
  POST /api/auth/guest/resume        → resume_guest
  POST /api/auth/refresh             → refresh_token
  POST /api/auth/logout              → logout
  POST /api/auth/logout/all          → logout_all
  GET  /api/auth/me                  → get_me

  GET    /api/admin/guests           → list_guests         (ADMIN)
  GET    /api/admin/guests/stats     → guest_stats         (ADMIN)
  DELETE /api/admin/guests/expired   → cleanup_expired     (ADMIN)
  GET    /api/admin/guests/stale     → preview_stale_guests (ADMIN; v0.41.0 withoutMatches)
  DELETE /api/admin/guests/stale     → delete_stale_guests  (ADMIN; v0.41.0 withoutMatches)
  GET    /api/admin/guests/{uuid}    → get_guest_by_uuid   (ADMIN)
  DELETE /api/admin/guests/{uuid}    → delete_guest        (ADMIN)

Scheduled (v0.41.0, GuestCleanupFunction): scheduled_cleanup — the idle-guest job.

Response shapes follow:
  GuestLoginResponse      (v0.12.0-guest-auth-api.yaml)
  GuestInfoResponse       (v0.12.0-guest-auth-api.yaml)
  RefreshTokenResponse    (v0.13.0-session-api.yaml)
  UserInfo                (v0.13.0-session-api.yaml)
  SuccessResponse         (v0.13.0-session-api.yaml)
  ErrorResponse           (shared)
"""

import base64
import json
import os
import re
import uuid
import time
from datetime import datetime, timezone

from common import db_utils
from common import log_utils
from common import jwt_utils
from common import security_utils
from common import test_data_ttl
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Key

from common.response import dumps as _dumps, ok as _ok, HEADERS, finalize as _finalize
from common.http_utils import (normalize_path as _normalize_path,
                               get_source_ip as _get_source_ip,
                               bearer_token as _bearer_token,
                               check_admin_ip as _check_admin_ip_common)

# v0.38.1 — botocore "Found credentials in environment variables" at INFO is noise on every cold start.
log_utils.quiet_botocore()

# ─── helpers ─────────────────────────────────────────────────────────────────

COOKIE_MAX_ACCESS  = 1_800        # 30 min  (access token lifetime)
COOKIE_MAX_REFRESH = 15_552_000   # 6 months (refresh token; 180 * 86400)
COOKIE_MAX_GUEST   = 15_552_000   # 6 months (guest cookie; 180 * 86400)
GUEST_LIST_PK = 'GUEST_LIST'
# v0.37.5 — what GSI2 projects of a guest (one ``summary`` map): everything the admin
# list, the purge and the stats read, so none of them ever touches the table.
GUEST_SUMMARY_FIELDS = ('uuid', 'username', 'nickname', 'role', 'state', 'guest_token',
                        'guest_expires_at', 'language', 'ts_registration', 'ts_insert',
                        'ts_last_access')


def _guest_summary(user):
    return {k: user.get(k) for k in GUEST_SUMMARY_FIELDS if user.get(k) is not None}


def _guest_rows():
    """Every guest as its GSI2 row, ``summary`` lifted next to the table keys."""
    rows = db_utils.query_gsi('GSI2', GUEST_LIST_PK) or []
    return [_lift_guest(r) for r in rows]


def _lift_guest(row):
    return {**(row.get('summary') or {}), **row}

def _now_ms():
    return int(time.time() * 1000)

def _iso(ms):
    return datetime.fromtimestamp(int(ms) / 1000, tz=timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

def _err(status, code, message):
    return {
        "statusCode": status,
        "headers": HEADERS,
        "body": _dumps({
            "error":     code,
            "message":   message,
            "timestamp": _now_ms()
        })
    }

def _check_admin_ip(event):
    """The shared allow-list rule (v0.41.0, ADMIN_IP_EMPTY_MEANS), in this handler's error shape."""
    return _check_admin_ip_common(event, _err)

def _get_cookie(event, name):
    for c in event.get('cookies', []):
        if c.startswith(f'{name}='):
            return c[len(name) + 1:]
    return None

def _require_auth(event):
    """Return (user_dict, None) or (None, error_response).

    Accepts both real HS256 JWT tokens and MOCK_ACCESS_ tokens.
    For real JWTs the claims are trusted directly (no DB lookup required).
    For mock tokens a DynamoDB lookup fills in role/username.
    """
    token = _bearer_token(event)
    claims = jwt_utils.verify_access_token(token)
    if not claims or not claims.get('uuid'):
        return None, _err(401, 'UNAUTHORIZED', 'Valid access token required')

    user_uuid = claims['uuid']

    if claims['source'] == 'jwt':
        # Trust JWT claims; optionally enrich from DB
        user = db_utils.get_item(f'USER#{user_uuid}')
        if user:
            return user, None
        # User exists only in the Java backend — build a synthetic dict from claims
        return {
            'uuid':     user_uuid,
            'username': claims.get('username'),
            'role':     claims.get('role', 'PLAYER'),
        }, None

    # mock token — must exist in DynamoDB
    user = db_utils.get_item(f'USER#{user_uuid}')
    if not user:
        return None, _err(401, 'UNAUTHORIZED', 'User not found')
    return user, None

def _require_admin(event):
    """Return (user_item, None) or (None, error_response)."""
    ip_err = _check_admin_ip(event)
    if ip_err:
        return None, ip_err
    user, err = _require_auth(event)
    if err:
        return None, err
    if user.get('role') != 'ADMIN':
        return None, _err(403, 'FORBIDDEN', 'ADMIN role required')
    return user, None

def _guest_info(user):
    """Build GuestInfoResponse from a DynamoDB user item."""
    exp_at    = user.get('guest_expires_at', 0)
    reg_ms    = user.get('ts_registration', user.get('ts_insert', 0))
    last_ms   = user.get('ts_last_access')
    expired   = bool(_now_ms() > exp_at) if exp_at else False
    return {
        "userUuid":        user.get('uuid'),
        "username":        user.get('username'),
        "nickname":        user.get('nickname'),
        "role":            user.get('role', 'PLAYER'),
        "state":           user.get('state', 6),
        "guestCookieToken":user.get('guest_token'),
        "guestExpiresAt":  _iso(exp_at) if exp_at else None,
        "language":        user.get('language'),
        "tsRegistration":  _iso(reg_ms) if reg_ms else None,
        "tsLastAccess":    _iso(last_ms) if last_ms else None,
        "expired":         expired
    }

def _refresh_cookies(user_uuid, guest_token, token_version=0):
    """Return two Set-Cookie strings (refresh + guest).

    Uses ``SameSite=None; Secure`` so the browser keeps the cookies on cross-
    origin requests (e.g. ``http://localhost:5174`` → ``https://api-dev.paths.games``).
    Chrome rejects Lax cookies on cross-site fetch/XHR and would silently drop
    them, which would block ``POST /api/auth/guest/resume`` with 400
    MISSING_GUEST_COOKIE on every reload.

    ``token_version`` is embedded in the refresh token so that logout and
    refresh-rotation can revoke previously issued tokens (mock tokens carry it as
    a ``.{ver}`` suffix; real JWTs in the ``ver`` claim).
    """
    if jwt_utils.ALLOW_MOCK_ACCESS:
        refresh_tok = f'MOCK_REFRESH_{user_uuid}.{token_version}'
    else:
        refresh_tok = jwt_utils.generate_refresh_token(
            user_uuid, exp_seconds=COOKIE_MAX_REFRESH, token_version=token_version)
    return [
        f'pathsgames.refreshToken={refresh_tok}; Path=/api/auth; HttpOnly; Secure; SameSite=None; Max-Age={COOKIE_MAX_REFRESH}',
        f'pathsgames.guestcookie={guest_token}; Path=/api/auth; HttpOnly; Secure; SameSite=None; Max-Age={COOKIE_MAX_GUEST}',
    ]

def _clear_cookies():
    return [
        'pathsgames.refreshToken=; Path=/api/auth; HttpOnly; Secure; SameSite=None; Max-Age=0',
        'pathsgames.guestcookie=; Path=/api/auth; HttpOnly; Secure; SameSite=None; Max-Age=0',
    ]

# ─── router ──────────────────────────────────────────────────────────────────

def lambda_handler(event, context):
    """v0.41.0 — 500 MISCONFIGURED on a non dev/test stack with the committed secret; finalize always."""
    path = _normalize_path(event.get('rawPath', event.get('path', '')))
    if jwt_utils.misconfigured():
        return _finalize(jwt_utils.misconfigured_response(), path)
    return _finalize(_route(event, context), path)


def _route(event, context):
    path   = _normalize_path(event.get('rawPath', event.get('path', '')))
    method = (event.get('requestContext', {})
                   .get('http', {})
                   .get('method', event.get('httpMethod', '')))
    params = event.get('pathParameters') or {}

    # public / auth
    if path == '/api/auth/guest' and method == 'POST':
        return create_guest(event)
    if path == '/api/auth/guest/resume' and method == 'POST':
        return resume_guest(event)
    if path == '/api/auth/refresh' and method == 'POST':
        return refresh_token(event)
    if path == '/api/auth/logout' and method == 'POST':
        return logout(event)
    if path == '/api/auth/logout/all' and method == 'POST':
        return logout_all(event)
    if path == '/api/auth/me' and method == 'GET':
        return get_me(event)

    # admin guests — static routes before parameterised ones
    if path == '/api/admin/guests' and method == 'GET':
        return list_guests(event)
    if path == '/api/admin/guests/stats' and method == 'GET':
        return guest_stats(event)
    if path == '/api/admin/guests/stale' and method == 'GET':
        return preview_stale_guests(event)
    if path == '/api/admin/guests/stale' and method == 'DELETE':
        return delete_stale_guests(event)
    if path == '/api/admin/guests/expired' and method == 'DELETE':
        return cleanup_expired(event)
    # parameterised
    if path.startswith('/api/admin/guests/') and method == 'GET':
        uid = params.get('uuid') or path.split('/')[-1]
        return get_guest_by_uuid(event, uid)
    if path.startswith('/api/admin/guests/') and method == 'DELETE':
        uid = params.get('uuid') or path.split('/')[-1]
        return delete_guest(event, uid)

    return _err(404, 'NOT_FOUND', f'Resource {path} not found')

# ─── endpoint handlers ────────────────────────────────────────────────────────

ROBOT_TEST_MARKER_MAX_LEN = 30


def _test_marker(event):
    """Returns the sanitized X-Test-Marker header value, or None.

    The header tags the guest as test data so it can be removed by
    POST /api/dev/cleanup. Honoured only when ENV=dev or ENV=test (v0.39.1: the
    Robot runs on AWS use the test stack), so production guests are never affected.
    """
    if os.environ.get("ENV", "dev") not in test_data_ttl.TEST_ENVS:
        return None
    headers = event.get('headers') or {}
    raw = headers.get('x-test-marker') or headers.get('X-Test-Marker')
    if not raw or not raw.strip():
        return None
    sanitized = re.sub(r'[^a-z0-9]', '', raw.lower())
    return sanitized[:ROBOT_TEST_MARKER_MAX_LEN] or None


MAX_AGE_DAYS = 3650


def _test_age_days(event, marker):
    """v0.41.0 — X-Test-Guest-Age-Days, only with a valid marker (dev/test); 1..3650 else ignored."""
    if not marker:
        return None
    headers = event.get('headers') or {}
    raw = headers.get('x-test-guest-age-days') or headers.get('X-Test-Guest-Age-Days')
    try:
        days = int(str(raw).strip())
    except (TypeError, ValueError):
        return None
    return days if 1 <= days <= MAX_AGE_DAYS else None


def create_guest(event):
    # Step 41 — at most RATE_LIMIT_GUEST_PER_IP new guests per source address and window
    limit = security_utils.guest_per_ip()
    if limit > 0:
        verdict = security_utils.rate_limit('guest', _get_source_ip(event), limit)
        if not verdict.allowed:
            return security_utils.rate_limited(verdict, 'Too many guest sessions from this address')
    now       = _now_ms()
    user_uuid = str(uuid.uuid4())
    guest_tok = str(uuid.uuid4())
    marker    = _test_marker(event)
    username  = (f'{marker}_' if marker else 'guest_') + user_uuid[:8]
    age_days  = _test_age_days(event, marker)
    born      = now - age_days * 86_400_000 if age_days else now

    guest = {
        'PK':              f'USER#{user_uuid}',
        'SK':              'METADATA',
        'uuid':            user_uuid,
        'username':        username,
        'role':            'PLAYER',
        'state':           6,
        'is_guest':        True,
        'guest_token':     guest_tok,
        'guest_expires_at': born + COOKIE_MAX_GUEST * 1000,
        'ts_registration': born,
        'ts_last_access':  born,
        'token_version':   0,
        # GSI1: lookup by guest token (resume); GSI2: the guest list (admin, purge, stats)
        'GSI1_PK':         f'GUEST_TOKEN#{guest_tok}',
        'GSI1_SK':         'METADATA',
        'GSI2_PK':         GUEST_LIST_PK,
        'GSI2_SK':         f'USER#{user_uuid}',
    }
    guest['summary'] = _guest_summary(guest)
    # v0.39.1 — a tagged guest expires through the table TTL instead of a paid cleanup delete
    expires_at = test_data_ttl.expiry() if marker else None
    if expires_at:
        guest[test_data_ttl.TTL_ATTRIBUTE] = expires_at
    db_utils.put_item(guest)

    access_exp  = now + COOKIE_MAX_ACCESS  * 1000
    refresh_exp = now + COOKIE_MAX_REFRESH * 1000

    if jwt_utils.ALLOW_MOCK_ACCESS:
        access_token = f'MOCK_ACCESS_{user_uuid}'
    else:
        access_token = jwt_utils.generate_access_token(user_uuid, username, 'PLAYER', exp_seconds=COOKIE_MAX_ACCESS)

    body = {
        'userUuid':            user_uuid,
        'username':            username,
        'accessToken':         access_token,
        'accessTokenExpiresAt':  access_exp,
        'refreshTokenExpiresAt': refresh_exp,
        'csrfToken':             security_utils.csrf_token_for(access_token),
    }
    return _ok(body, status=201, cookies=_refresh_cookies(user_uuid, guest_tok))


def resume_guest(event):
    guest_tok = _get_cookie(event, 'pathsgames.guestcookie')
    if not guest_tok:
        return _err(400, 'MISSING_GUEST_COOKIE',
                    'Missing required guestToken cookie. Please create a new guest session.')

    items = db_utils.query_gsi('GSI1', f'GUEST_TOKEN#{guest_tok}')
    if not items:
        return _err(401, 'SESSION_EXPIRED_OR_NOT_FOUND',
                    'Guest session is expired or does not exist. Please create a new guest session.')

    user      = items[0]
    user_uuid = user['uuid']
    now       = _now_ms()
    access_exp  = now + COOKIE_MAX_ACCESS  * 1000
    refresh_exp = now + COOKIE_MAX_REFRESH * 1000

    db_utils.update_ts_last_access(f'USER#{user_uuid}', now, in_summary=True)

    if jwt_utils.ALLOW_MOCK_ACCESS:
        access_token = f'MOCK_ACCESS_{user_uuid}'
    else:
        access_token = jwt_utils.generate_access_token(user_uuid, user.get('username'), user.get('role', 'PLAYER'), exp_seconds=COOKIE_MAX_ACCESS)

    body = {
        'userUuid':            user_uuid,
        'username':            user.get('username'),
        'accessToken':         access_token,
        'accessTokenExpiresAt':  access_exp,
        'refreshTokenExpiresAt': refresh_exp,
        'csrfToken':             security_utils.csrf_token_for(access_token),
    }
    cur_ver = int(user.get('token_version', 0) or 0)
    return _ok(body, cookies=_refresh_cookies(user_uuid, user.get('guest_token', guest_tok), cur_ver))


def _invalid_refresh():
    return _err(401, 'INVALID_REFRESH_TOKEN',
                'Refresh token is invalid, expired, or revoked. Please login again.')


def refresh_token(event):
    refresh_tok = _get_cookie(event, 'pathsgames.refreshToken')

    if jwt_utils.ALLOW_MOCK_ACCESS:
        if not refresh_tok or not refresh_tok.startswith('MOCK_REFRESH_'):
            return _invalid_refresh()
        rest = refresh_tok[len('MOCK_REFRESH_'):]
        if '.' in rest:
            user_uuid, ver_str = rest.rsplit('.', 1)
        else:
            user_uuid, ver_str = rest, '0'
        try:
            token_ver = int(ver_str)
        except ValueError:
            return _invalid_refresh()
    else:
        payload = jwt_utils.decode_refresh_token(refresh_tok)
        if not payload or not payload.get('sub'):
            return _invalid_refresh()
        user_uuid = payload['sub']
        token_ver = int(payload.get('ver', 0) or 0)

    user = db_utils.get_item(f'USER#{user_uuid}')
    if not user:
        return _invalid_refresh()

    # Token rotation / revocation: the token's version must match the user's
    # current token_version. A successful refresh bumps it, so the just-used
    # (and any earlier) refresh token is revoked.
    cur_ver = int(user.get('token_version', 0) or 0)
    if token_ver != cur_ver:
        return _invalid_refresh()
    new_ver = cur_ver + 1
    user['token_version'] = new_ver
    db_utils.put_item(user)

    now         = _now_ms()
    access_exp  = now + COOKIE_MAX_ACCESS  * 1000
    refresh_exp = now + COOKIE_MAX_REFRESH * 1000
    guest_tok   = user.get('guest_token', '')
    role        = user.get('role', 'PLAYER')

    if jwt_utils.ALLOW_MOCK_ACCESS:
        access_token = f'MOCK_ACCESS_{user_uuid}'
    else:
        access_token = jwt_utils.generate_access_token(user_uuid, user.get('username'), role, exp_seconds=COOKIE_MAX_ACCESS)

    body = {
        'userUuid':            user_uuid,
        'username':            user.get('username'),
        'role':                role,
        'accessToken':         access_token,
        'accessTokenExpiresAt':  access_exp,
        'refreshTokenExpiresAt': refresh_exp,
        'csrfToken':             security_utils.csrf_token_for(access_token),
    }
    return _ok(body, cookies=_refresh_cookies(user_uuid, guest_tok, new_ver))


def logout(event):
    user, err = _require_auth(event)
    if err:
        return err
    # Revoke the user's refresh tokens by bumping the stored token_version, so a
    # replayed refresh cookie no longer validates.
    user['token_version'] = int(user.get('token_version', 0) or 0) + 1
    db_utils.put_item(user)
    return _ok({'status': 'OK', 'message': 'Token revoked successfully', 'timestamp': _now_ms()},
               cookies=_clear_cookies())


def logout_all(event):
    user, err = _require_auth(event)
    if err:
        return err
    return _ok({'status': 'OK', 'message': 'All sessions revoked successfully', 'timestamp': _now_ms()},
               cookies=_clear_cookies())


def get_me(event):
    user, err = _require_auth(event)
    if err:
        return err
    body = {
        'userUuid':  user.get('uuid'),
        'username':  user.get('username'),
        'role':      user.get('role', 'PLAYER'),
        # v0.37.7 — the CSRF token of this bearer, so a client that lost it need not log in again
        'csrfToken': security_utils.csrf_token_for(_bearer_token(event)),
        'timestamp': _now_ms(),
    }
    return _ok(body)


# ─── admin / guests ───────────────────────────────────────────────────────────

#: Page size when the caller names none, and the ceiling whatever it names.
DEFAULT_PAGE_LIMIT = 50
MAX_PAGE_LIMIT = 200


def _seen_at(user):
    """When a guest was last seen, in epoch millis: its last access, or its registration if
    it never came back. One expression, so the page order and the purge bound agree."""
    return _nzms(user.get('ts_last_access')) or _nzms(
        user.get('ts_registration', user.get('ts_insert')))


def _nzms(value):
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _clamp_limit(requested):
    try:
        return max(1, min(int(requested), MAX_PAGE_LIMIT))
    except (TypeError, ValueError):
        return DEFAULT_PAGE_LIMIT


def _bound_ms(older_than_days):
    """The epoch-millis instant N days ago, or None when the caller named no bound."""
    try:
        days = int(older_than_days)
    except (TypeError, ValueError):
        return None
    return None if days < 0 else _now_ms() - days * 86400000


def list_guests(event):
    """GET /api/admin/guests — v0.36.2, ONE page at a time, most recently seen first.

    This used to scan the whole table to completion and time out at 15s. The scan is now
    bounded per request; ``nextCursor`` carries DynamoDB's LastEvaluatedKey back.

    Because DynamoDB applies Limit before the filter, a page may come back short or even
    empty while nextCursor is still set: an empty page is not the end of the data.
    """
    _, err = _require_admin(event)
    if err:
        return err
    qs = event.get('queryStringParameters') or {}
    limit = _clamp_limit(qs.get('limit'))
    bound = _bound_ms(qs.get('olderThanDays'))
    start_key = _decode_cursor(qs.get('cursor'))

    items, last_key = db_utils.query_index_page('GSI2', 'GSI2_PK', GUEST_LIST_PK, limit=limit,
                                                start_key=start_key, ascending=True)
    guests = [g for g in map(_lift_guest, items) if bound is None or _seen_at(g) < bound]
    guests.sort(key=_seen_at, reverse=True)
    return _ok({
        'items': [_guest_info(g) for g in guests],
        'nextCursor': _encode_cursor(last_key),
        'limit': limit,
    })


def _encode_cursor(last_key):
    """DynamoDB's LastEvaluatedKey as one opaque string. None when there is no next page."""
    if not last_key:
        return None
    return base64.urlsafe_b64encode(
        json.dumps(last_key, default=str).encode('utf-8')).decode('ascii').rstrip('=')


def _decode_cursor(cursor):
    """None for a missing or malformed token, so the scan restarts at page one, never fails."""
    if not cursor:
        return None
    try:
        padded = cursor + '=' * (-len(cursor) % 4)
        decoded = json.loads(base64.urlsafe_b64decode(padded).decode('utf-8'))
        return decoded if isinstance(decoded, dict) else None
    except (ValueError, TypeError):
        return None


def _without_matches(event):
    """v0.41.0 — (flag, error): withoutMatches is optional; present, only true/false."""
    raw = (event.get('queryStringParameters') or {}).get('withoutMatches')
    if raw is None:
        return False, None
    if raw not in ('true', 'false'):
        return None, _err(400, 'INVALID_INPUT', 'withoutMatches must be true or false')
    return raw == 'true', None


def preview_stale_guests(event):
    """GET /api/admin/guests/stale?olderThanDays=N — the dry run: how many guests, and how
    many of their matches, the deletion below would take (v0.41.0: withoutMatches)."""
    _, err = _require_admin(event)
    if err:
        return err
    bound = _bound_ms(((event.get('queryStringParameters') or {}).get('olderThanDays')))
    if bound is None:
        return _err(400, 'INVALID_INPUT', 'olderThanDays is required and must be >= 0')
    without, err = _without_matches(event)
    if err:
        return err
    if without:
        idle = _idle_guests(bound, _max_per_run(), _request_deadline())
        return _ok({'guests': len(idle), 'matches': 0})
    stale = _stale_guests(bound)
    return _ok({'guests': len(stale), 'matches': len(_matches_of(stale))})


def delete_stale_guests(event):
    """DELETE /api/admin/guests/stale?olderThanDays=N — remove every guest not seen for N days
    AND every match they created, whatever its status. Matches go first, as they do on the SQL
    backends where the creator is a foreign key. Distinct from DELETE /expired, which only ever
    removes sessions whose own expiry has passed and never touches a match."""
    _, err = _require_admin(event)
    if err:
        return err
    bound = _bound_ms(((event.get('queryStringParameters') or {}).get('olderThanDays')))
    if bound is None:
        return _err(400, 'INVALID_INPUT', 'olderThanDays is required and must be >= 0')
    without, err = _without_matches(event)
    if err:
        return err
    if without:
        removed = _cleanup_idle_guests(bound, _max_per_run(), _request_deadline())
        return _ok({'guests': removed, 'matches': 0, 'status': 'CLEANUP_COMPLETE'})
    stale = _stale_guests(bound)
    matches = _matches_of(stale)
    for match in matches:
        # v0.37.5 — drop the whole partition (CHARACTER#, TURN#, LOG#), not only METADATA.
        db_utils.delete_all_by_pk(match['PK'])
    for guest in stale:
        db_utils.delete_item(guest['PK'], guest.get('SK', 'METADATA'))
    return _ok({'guests': len(stale), 'matches': len(matches),
                'status': 'CLEANUP_COMPLETE'})


def _stale_guests(bound_ms):
    """Every guest last seen before the bound. Unbounded on purpose: a purge must see the
    whole table, and it is a deliberate admin action, not a page the console polls."""
    return [g for g in _guest_rows() if _seen_at(g) < bound_ms]


def _matches_of(guests):
    """Every match these guests created, whatever its status.

    v0.38.0 — ONE read of the GSI2 "by type" partition (GSI2_PK = MATCH, the same index the
    admin match list pages through; userCreatorUuid is projected) filtered in memory, instead
    of one USER_MATCHES# query per guest: with olderThanDays=0 every guest is stale, and a
    table that had grown to a few hundred test guests took the preview past the 30 s Lambda
    timeout — API Gateway answered 503. Nobody to purge: nothing is read at all.
    """
    stale = {g.get('uuid') for g in guests if g.get('uuid')}
    if not stale:
        return []
    return [m for m in (db_utils.query_gsi('GSI2', 'MATCH') or [])
            if m.get('SK', 'METADATA') == 'METADATA' and m.get('userCreatorUuid') in stale]


# ─── v0.41.0: guests with matches are kept; the idle-guest job ────────────────

#: GUEST_LIST rows read per page, and the time left over when a run stops paging.
_CLEANUP_PAGE = 100
_REQUEST_BUDGET_MS = 25_000
_SCHEDULED_MARGIN_MS = 15_000


def _env_int(name, default):
    try:
        return int(os.environ.get(name, str(default)) or default)
    except ValueError:
        return default


def _max_per_run():
    return max(1, _env_int('GUEST_CLEANUP_MAX_PER_RUN', 500))


def _request_deadline():
    """An API call stops paging before API Gateway's 30 s integration timeout."""
    stop_at = _now_ms() + _REQUEST_BUDGET_MS
    return lambda: _now_ms() >= stop_at


def _has_match(user_uuid):
    """One GSI1 Query (Limit 1) on USER_MATCHES#<uuid>; on a read error the guest is kept."""
    if not user_uuid:
        return False
    try:
        response = db_utils._get_table().query(
            IndexName='GSI1', KeyConditionExpression=Key('GSI1_PK').eq(f'USER_MATCHES#{user_uuid}'),
            Limit=1)
        return bool(response.get('Items'))
    except ClientError as exc:
        print(f'Guest cleanup: match check failed for {user_uuid}: {exc}')
        return True


def _idle_guests(bound_ms, cap, deadline):
    """Pages GUEST_LIST: match-less guests seen before the bound, at most ``cap``, until ``deadline()``."""
    picked, start_key = [], None
    while len(picked) < cap and not deadline():
        items, start_key = db_utils.query_index_page('GSI2', 'GSI2_PK', GUEST_LIST_PK,
                                                     limit=_CLEANUP_PAGE, start_key=start_key,
                                                     ascending=True)
        for guest in map(_lift_guest, items):
            if len(picked) >= cap:
                break
            if _seen_at(guest) < bound_ms and not _has_match(guest.get('uuid')):
                picked.append(guest)
        if not start_key:
            break
    return picked


def _cleanup_idle_guests(bound_ms, cap, deadline):
    """Deletes what _idle_guests found; returns how many went. No match is ever touched."""
    idle = _idle_guests(bound_ms, cap, deadline)
    for guest in idle:
        db_utils.delete_item(guest['PK'], guest.get('SK', 'METADATA'))
    return len(idle)


def scheduled_cleanup(event, context):
    """GuestCleanupFunction (Scheduler, 00:42 UTC): DELETE /stale?withoutMatches=true with AGE_DAYS."""
    if os.environ.get('GUEST_CLEANUP_ENABLED', 'true').strip().lower() in ('false', '0', 'no'):
        return {'status': 'DISABLED', 'guests': 0}
    age_days = _env_int('GUEST_CLEANUP_AGE_DAYS', 60)
    bound = _bound_ms(age_days)
    if bound is None:
        return {'status': 'DISABLED', 'guests': 0}
    remaining = getattr(context, 'get_remaining_time_in_millis', None)
    deadline = ((lambda: remaining() < _SCHEDULED_MARGIN_MS) if callable(remaining)
                else _request_deadline())
    removed = _cleanup_idle_guests(bound, _max_per_run(), deadline)
    print(_dumps({'event': 'GUEST_CLEANUP', 'guests': removed, 'ageDays': age_days,
                  'maxPerRun': _max_per_run()}))
    return {'status': 'CLEANUP_COMPLETE', 'guests': removed}


def guest_stats(event):
    _, err = _require_admin(event)
    if err:
        return err
    now    = _now_ms()
    guests = _guest_rows()
    total   = len(guests)
    expired = sum(1 for g in guests if _now_ms() > g.get('guest_expires_at', now + 1))
    return _ok({
        'totalGuests':   total,
        'activeGuests':  total - expired,
        'expiredGuests': expired,
    })


def cleanup_expired(event):
    _, err = _require_admin(event)
    if err:
        return err
    now    = _now_ms()
    guests = _guest_rows()
    count  = 0
    for g in guests:
        # v0.41.0 — an expired guest that still owns a match is kept (no orphan matches)
        if now > g.get('guest_expires_at', now + 1) and not _has_match(g.get('uuid')):
            db_utils.delete_item(g['PK'], g.get('SK', 'METADATA'))
            count += 1
    return _ok({'status': 'CLEANUP_COMPLETE', 'deletedCount': count})


def get_guest_by_uuid(event, uid):
    _, err = _require_admin(event)
    if err:
        return err
    user = db_utils.get_item(f'USER#{uid}')
    if not user:
        return _err(404, 'GUEST_NOT_FOUND', f'No guest user found with UUID: {uid}')
    return _ok(_guest_info(user))


def delete_guest(event, uid):
    _, err = _require_admin(event)
    if err:
        return err
    user = db_utils.get_item(f'USER#{uid}')
    if not user:
        return _err(404, 'GUEST_NOT_FOUND', f'No guest user found with UUID: {uid}')
    db_utils.delete_item(f'USER#{uid}')
    return _ok({'status': 'DELETED', 'uuid': uid})
