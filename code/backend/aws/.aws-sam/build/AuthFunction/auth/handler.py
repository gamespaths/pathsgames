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

import json
import uuid
import time
import decimal
from datetime import datetime, timezone

from common import db_utils
from common import jwt_utils

class _DecimalEncoder(json.JSONEncoder):
    """Serialise DynamoDB Decimal values as int or float."""
    def default(self, obj):
        if isinstance(obj, decimal.Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super().default(obj)

def _dumps(obj):
    return json.dumps(obj, cls=_DecimalEncoder)

# ─── helpers ─────────────────────────────────────────────────────────────────

HEADERS = {"Content-Type": "application/json"}

COOKIE_MAX_ACCESS  = 1_800       # 30 min  (access token lifetime)
COOKIE_MAX_REFRESH = 604_800     # 7 days  (refresh token)
COOKIE_MAX_GUEST   = 2_592_000   # 30 days (guest cookie)

def _now_ms():
    return int(time.time() * 1000)

def _iso(ms):
    return datetime.fromtimestamp(int(ms) / 1000, tz=timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

def _ok(body, status=200, cookies=None):
    resp = {"statusCode": status, "headers": HEADERS, "body": _dumps(body)}
    if cookies:
        resp["cookies"] = cookies
    return resp

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

def _normalize_path(raw_path):
    """Strip API Gateway stage prefix  /dev/api/... → /api/..."""
    if raw_path.startswith('/api/'):
        return raw_path
    idx = raw_path.find('/api/')
    return raw_path[idx:] if idx >= 0 else raw_path

def _get_cookie(event, name):
    for c in event.get('cookies', []):
        if c.startswith(f'{name}='):
            return c[len(name) + 1:]
    return None

def _bearer_token(event):
    auth = (event.get('headers') or {}).get('authorization',
           (event.get('headers') or {}).get('Authorization', ''))
    if auth.startswith('Bearer '):
        return auth[7:]
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

def _refresh_cookies(user_uuid, guest_token):
    """Return two Set-Cookie strings (refresh + guest)."""
    refresh_token = f'MOCK_REFRESH_{user_uuid}'
    return [
        f'pathsgames.refreshToken={refresh_token}; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age={COOKIE_MAX_REFRESH}',
        f'pathsgames.guestcookie={guest_token}; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age={COOKIE_MAX_GUEST}',
    ]

def _clear_cookies():
    return [
        'pathsgames.refreshToken=; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=0',
        'pathsgames.guestcookie=; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=0',
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

def create_guest(event):
    now       = _now_ms()
    user_uuid = str(uuid.uuid4())
    guest_tok = str(uuid.uuid4())
    username  = f'guest_{user_uuid[:8]}'

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
        # GSI for lookup by guest token
        'GSI1_PK':         f'GUEST_TOKEN#{guest_tok}',
        'GSI1_SK':         'METADATA',
    })

    access_exp  = now + COOKIE_MAX_ACCESS  * 1000
    refresh_exp = now + COOKIE_MAX_REFRESH * 1000

    body = {
        'userUuid':            user_uuid,
        'username':            username,
        'accessToken':         f'MOCK_ACCESS_{user_uuid}',
        'accessTokenExpiresAt':  access_exp,
        'refreshTokenExpiresAt': refresh_exp,
    }
    return _ok(body, status=201, cookies=_refresh_cookies(user_uuid, guest_tok))


def resume_guest(event):
    guest_tok = _get_cookie(event, 'pathsgames.guestcookie')
    if not guest_tok:
        return _err(401, 'SESSION_EXPIRED_OR_NOT_FOUND',
                    'Guest session is expired or does not exist. Please create a new guest session.')

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

    body = {
        'userUuid':            user_uuid,
        'username':            user.get('username'),
        'accessToken':         f'MOCK_ACCESS_{user_uuid}',
        'accessTokenExpiresAt':  access_exp,
        'refreshTokenExpiresAt': refresh_exp,
    }
    return _ok(body, cookies=_refresh_cookies(user_uuid, user.get('guest_token', guest_tok)))


def refresh_token(event):
    refresh_tok = _get_cookie(event, 'pathsgames.refreshToken')
    if not refresh_tok or not refresh_tok.startswith('MOCK_REFRESH_'):
        return _err(401, 'INVALID_REFRESH_TOKEN',
                    'Refresh token is invalid, expired, or revoked. Please login again.')

    user_uuid = refresh_tok[len('MOCK_REFRESH_'):]
    user      = db_utils.get_item(f'USER#{user_uuid}')
    if not user:
        return _err(401, 'INVALID_REFRESH_TOKEN',
                    'Refresh token is invalid, expired, or revoked. Please login again.')

    now         = _now_ms()
    access_exp  = now + COOKIE_MAX_ACCESS  * 1000
    refresh_exp = now + COOKIE_MAX_REFRESH * 1000
    guest_tok   = user.get('guest_token', '')

    body = {
        'userUuid':            user_uuid,
        'username':            user.get('username'),
        'role':                user.get('role', 'PLAYER'),
        'accessToken':         f'MOCK_ACCESS_{user_uuid}',
        'accessTokenExpiresAt':  access_exp,
        'refreshTokenExpiresAt': refresh_exp,
    }
    return _ok(body, cookies=_refresh_cookies(user_uuid, guest_tok))


def logout(event):
    user, err = _require_auth(event)
    if err:
        return err
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

def list_guests(event):
    _, err = _require_admin(event)
    if err:
        return err
    guests = db_utils.scan_filter('is_guest', True)
    return _ok([_guest_info(g) for g in guests])


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
