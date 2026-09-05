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
  GET    /api/admin/guests/stale     → preview_stale_guests (ADMIN)
  DELETE /api/admin/guests/stale     → delete_stale_guests  (ADMIN)
  GET    /api/admin/guests/{uuid}    → get_guest_by_uuid   (ADMIN)
  DELETE /api/admin/guests/{uuid}    → delete_guest        (ADMIN)

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
from common import jwt_utils
from common.response import dumps as _dumps, ok as _ok, HEADERS
from common.http_utils import (normalize_path as _normalize_path,
                               get_source_ip as _get_source_ip,
                               bearer_token as _bearer_token)

# ─── helpers ─────────────────────────────────────────────────────────────────

COOKIE_MAX_ACCESS  = 1_800        # 30 min  (access token lifetime)
COOKIE_MAX_REFRESH = 15_552_000   # 6 months (refresh token; 180 * 86400)
COOKIE_MAX_GUEST   = 15_552_000   # 6 months (guest cookie; 180 * 86400)

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
    """Return error response if caller IP not in ADMIN_IP_WHITELIST, else None."""
    whitelist_raw = os.environ.get('ADMIN_IP_WHITELIST', '').strip()
    if not whitelist_raw:
        return None
    allowed = [ip.strip() for ip in whitelist_raw.split(',') if ip.strip()]
    if not allowed:
        return None
    source_ip = _get_source_ip(event)
    if source_ip not in allowed:
        return _err(403, 'FORBIDDEN', 'Source IP not authorized for admin access')
    return None

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
    POST /api/dev/cleanup. Honoured only when ENV=dev, so production guests
    are never affected.
    """
    if os.environ.get("ENV", "dev") != "dev":
        return None
    headers = event.get('headers') or {}
    raw = headers.get('x-test-marker') or headers.get('X-Test-Marker')
    if not raw or not raw.strip():
        return None
    sanitized = re.sub(r'[^a-z0-9]', '', raw.lower())
    return sanitized[:ROBOT_TEST_MARKER_MAX_LEN] or None


def create_guest(event):
    now       = _now_ms()
    user_uuid = str(uuid.uuid4())
    guest_tok = str(uuid.uuid4())
    marker    = _test_marker(event)
    username  = (f'{marker}_' if marker else 'guest_') + user_uuid[:8]

    db_utils.put_item({
        'PK':              f'USER#{user_uuid}',
        'SK':              'METADATA',
        'uuid':            user_uuid,
        'username':        username,
        'role':            'PLAYER',
        'state':           6,
        'is_guest':        True,
        'guest_token':     guest_tok,
        'guest_expires_at': now + COOKIE_MAX_GUEST * 1000,
        'ts_registration': now,
        'ts_last_access':  now,
        'token_version':   0,
        # GSI for lookup by guest token
        'GSI1_PK':         f'GUEST_TOKEN#{guest_tok}',
        'GSI1_SK':         'METADATA',
    })

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

    db_utils.update_ts_last_access(f'USER#{user_uuid}', now)

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

    items, last_key = db_utils.scan_filter_page('is_guest', True, limit, start_key)
    guests = [g for g in items if bound is None or _seen_at(g) < bound]
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


def preview_stale_guests(event):
    """GET /api/admin/guests/stale?olderThanDays=N — the dry run: how many guests, and how
    many of their matches, the deletion below would take."""
    _, err = _require_admin(event)
    if err:
        return err
    bound = _bound_ms(((event.get('queryStringParameters') or {}).get('olderThanDays')))
    if bound is None:
        return _err(400, 'INVALID_INPUT', 'olderThanDays is required and must be >= 0')
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
    stale = _stale_guests(bound)
    matches = _matches_of(stale)
    for match in matches:
        db_utils.delete_item(match['PK'], match.get('SK', 'METADATA'))
    for guest in stale:
        db_utils.delete_item(guest['PK'], guest.get('SK', 'METADATA'))
    return _ok({'guests': len(stale), 'matches': len(matches),
                'status': 'CLEANUP_COMPLETE'})


def _stale_guests(bound_ms):
    """Every guest last seen before the bound. Unbounded on purpose: a purge must see the
    whole table, and it is a deliberate admin action, not a page the console polls."""
    return [g for g in db_utils.scan_filter('is_guest', True) if _seen_at(g) < bound_ms]


def _matches_of(guests):
    """Every match these guests created, whatever its status."""
    uuids = {g.get('uuid') for g in guests if g.get('uuid')}
    if not uuids:
        return []
    return [m for m in db_utils.scan_pk_prefix('MATCH#')
            if m.get('SK', 'METADATA') == 'METADATA' and m.get('userCreatorUuid') in uuids]


def guest_stats(event):
    _, err = _require_admin(event)
    if err:
        return err
    now    = _now_ms()
    guests = db_utils.scan_filter('is_guest', True)
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
    guests = db_utils.scan_filter('is_guest', True)
    count  = 0
    for g in guests:
        if now > g.get('guest_expires_at', now + 1):
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
