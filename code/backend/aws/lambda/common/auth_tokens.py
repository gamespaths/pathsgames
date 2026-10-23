"""v1.2.0 hashed sessions on DynamoDB: REFRESH#<sha256> items (one per refresh token, GSI1 USER_SESSIONS#<uuid>
while active), the guest cookie by hash with the lazy rewrite of a clear value, the ID-token replay items.
v1.7.0 step 12: cap of 12 (SESSION_LIMIT), revocation reason, 7-day ttl of rotated/logged-out items."""
import hashlib
import os
import time

from common import db_utils

GRACE_SECONDS = 120
DEFAULT_MAX_SESSIONS = 12
MAX_SESSIONS = DEFAULT_MAX_SESSIONS
#: activeSessions counts only the sessions refreshed in the last 30 days
ACTIVE_SESSION_DAYS = 30
#: why a refresh token was revoked; ROTATED and LOGOUT items expire 7 days later through the table TTL
ROTATED, LOGOUT, LOGOUT_ALL, LIMIT, ADMIN = 'ROTATED', 'LOGOUT', 'LOGOUT_ALL', 'LIMIT', 'ADMIN'
SHORT_LIVED = (ROTATED, LOGOUT)
SHORT_RETENTION_SECONDS = 7 * 86_400
#: 180 days (the guest session length) after release 1.2.0: then the clear cookie lookup stops
LEGACY_FALLBACK_UNTIL_S = 1_809_129_600  # 2027-05-01T00:00:00Z


def max_sessions():
    """MAX_SESSIONS_PER_USER (SAM parameter MaxSessionsPerUser), default 12."""
    try:
        value = int(os.environ.get('MAX_SESSIONS_PER_USER', DEFAULT_MAX_SESSIONS))
    except (TypeError, ValueError):
        return DEFAULT_MAX_SESSIONS
    return value if value >= 1 else DEFAULT_MAX_SESSIONS


def sha256(value):
    if value is None:
        return None
    return hashlib.sha256(str(value).encode('utf-8')).hexdigest()


def legacy(clear, now_s=None):
    return clear if (now_s or time.time()) < LEGACY_FALLBACK_UNTIL_S else None


def _now_ms():
    return int(time.time() * 1000)


def store_refresh(user_uuid, token, expires_ms):
    now = _now_ms()
    db_utils.put_item({
        'PK': f'REFRESH#{sha256(token)}', 'SK': 'METADATA', 'user_uuid': user_uuid, 'revoked': False,
        'expires_at': int(expires_ms), 'ttl': int(expires_ms) // 1000,
        'GSI1_PK': f'USER_SESSIONS#{user_uuid}', 'GSI1_SK': f'REFRESH#{now:013d}',
    })


def find_refresh(token):
    """The REFRESH# item of a refresh token (by hash), or None."""
    if not token:
        return None
    return db_utils.get_item(f'REFRESH#{sha256(token)}')


def _close(item, reason, rotated_ms=None):
    """Revoked with its reason and out of the active-session index; a rotation also opens the grace window."""
    values = {'revoked': True, 'revoked_reason': reason}
    if rotated_ms is not None:
        values['ts_rotated'] = int(rotated_ms)
    if reason in SHORT_LIVED:
        keep = int(time.time()) + SHORT_RETENTION_SECONDS
        values['ttl'] = min(int(item['ttl']), keep) if item.get('ttl') else keep
    db_utils.update_attributes(item['PK'], item.get('SK', 'METADATA'), values, remove=('GSI1_PK', 'GSI1_SK'))


def mark_rotated(item, now_ms=None):
    _close(item, ROTATED, now_ms if now_ms is not None else _now_ms())


def revoke(item):
    """Logout of one session; False when it was already revoked."""
    if not item or item.get('revoked'):
        return False
    _close(item, LOGOUT)
    return True


def in_grace(item, now_ms=None):
    rotated = item.get('ts_rotated')
    if rotated is None:
        return False
    return (now_ms or _now_ms()) <= int(rotated) + GRACE_SECONDS * 1000


def expired_by_ttl(item, now_ms=None):
    """A short-lived item past its ttl not yet removed by DynamoDB (up to 48 hours late) is unknown."""
    ttl = item.get('ttl')
    return ttl is not None and (now_ms or _now_ms()) // 1000 > int(ttl)


def active_sessions(user_uuid):
    rows = db_utils.query_gsi('GSI1', f'USER_SESSIONS#{user_uuid}') or []
    return sorted(rows, key=lambda r: str(r.get('GSI1_SK', '')))


def recent_sessions(user_uuid, now_ms=None):
    """v1.7.0 activeSessions: the sessions issued (refreshed) in the last 30 days, a range on GSI1_SK."""
    bound = (now_ms or _now_ms()) - ACTIVE_SESSION_DAYS * 86_400_000
    rows = db_utils.query_gsi_range('GSI1', f'USER_SESSIONS#{user_uuid}', 'gt', f'REFRESH#{bound:013d}') or []
    return len(rows)


def revoke_all(user_uuid, reason=LOGOUT_ALL):
    for row in active_sessions(user_uuid):
        _close(row, reason)


def cut_sessions(user_uuid, reason=LOGOUT_ALL, now_s=None):
    """Every session revoked and USER#.sessions_valid_after set: older access tokens answer SESSION_REVOKED."""
    revoke_all(user_uuid, reason)
    db_utils.update_attributes(f'USER#{user_uuid}', 'METADATA',
                               {'sessions_valid_after': int(now_s if now_s is not None else time.time())})


def enforce_cap(user_uuid, cap=None):
    """The oldest active sessions beyond the cap are revoked with reason LIMIT (SESSION_LIMIT)."""
    limit = cap if cap is not None else max_sessions()
    rows = active_sessions(user_uuid)
    for row in rows[:max(0, len(rows) - limit)]:
        _close(row, LIMIT)


def guest_by_cookie(clear):
    """The guest USER# row of a cookie: by hash, else (lazy migration) by the clear value, rewritten."""
    if not clear:
        return None
    hashed = sha256(clear)
    rows = db_utils.query_gsi('GSI1', f'GUEST_TOKEN#{hashed}') or []
    if rows:
        return _lift(rows[0])
    old = legacy(clear)
    rows = db_utils.query_gsi('GSI1', f'GUEST_TOKEN#{old}') if old else []
    if not rows:
        return None
    row = rows[0]
    db_utils.update_attributes(row['PK'], row.get('SK', 'METADATA'),
                               {'GSI1_PK': f'GUEST_TOKEN#{hashed}', 'guest_token': hashed,
                                'summary.guest_token': hashed} if row.get('summary') is not None
                               else {'GSI1_PK': f'GUEST_TOKEN#{hashed}', 'guest_token': hashed})
    row['GSI1_PK'] = f'GUEST_TOKEN#{hashed}'
    return _lift(row)


def _lift(row):
    """v1.7.0 GSI1 projects the guest ``summary`` (uuid inside) but not ``uuid``: lifted, PK as fallback."""
    lifted = {**(row.get('summary') or {}), **row}
    lifted.setdefault('uuid', str(row.get('PK') or '').split('#', 1)[-1])
    return lifted


def mark_id_token_seen(id_token, exp_s):
    """False when this ID token was already used (GOOGLEJTI#<hash> kept until its exp by the table TTL)."""
    return db_utils.put_item_if_absent({'PK': f'GOOGLEJTI#{sha256(id_token)}', 'SK': 'METADATA',
                                        'ttl': int(exp_s)})
