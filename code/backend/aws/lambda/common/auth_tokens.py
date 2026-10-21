"""v1.2.0 hashed sessions on DynamoDB: REFRESH#<sha256> items (one per refresh token, GSI1 USER_SESSIONS#<uuid>
while active), the guest cookie by hash with the lazy rewrite of a clear value, the ID-token replay items."""
import hashlib
import time

from common import db_utils

GRACE_SECONDS = 30
MAX_SESSIONS = 5
#: 180 days (the guest session length) after release 1.2.0: then the clear cookie lookup stops
LEGACY_FALLBACK_UNTIL_S = 1_809_129_600  # 2027-05-01T00:00:00Z


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


def _close(item, rotated_ms=None):
    """Revoked and out of the active-session index; a rotation also opens the grace window."""
    values = {'revoked': True}
    if rotated_ms is not None:
        values['ts_rotated'] = int(rotated_ms)
    db_utils.update_attributes(item['PK'], item.get('SK', 'METADATA'), values, remove=('GSI1_PK', 'GSI1_SK'))


def mark_rotated(item, now_ms=None):
    _close(item, now_ms if now_ms is not None else _now_ms())


def revoke(item):
    """Logout of one session; False when it was already revoked."""
    if not item or item.get('revoked'):
        return False
    _close(item)
    return True


def in_grace(item, now_ms=None):
    rotated = item.get('ts_rotated')
    if rotated is None:
        return False
    return (now_ms or _now_ms()) <= int(rotated) + GRACE_SECONDS * 1000


def active_sessions(user_uuid):
    rows = db_utils.query_gsi('GSI1', f'USER_SESSIONS#{user_uuid}') or []
    return sorted(rows, key=lambda r: str(r.get('GSI1_SK', '')))


def revoke_all(user_uuid):
    for row in active_sessions(user_uuid):
        _close(row)


def enforce_cap(user_uuid, max_sessions=MAX_SESSIONS):
    """The oldest active sessions beyond the cap are revoked."""
    rows = active_sessions(user_uuid)
    for row in rows[:max(0, len(rows) - max_sessions)]:
        _close(row)


def guest_by_cookie(clear):
    """The guest USER# row of a cookie: by hash, else (lazy migration) by the clear value, rewritten."""
    if not clear:
        return None
    hashed = sha256(clear)
    rows = db_utils.query_gsi('GSI1', f'GUEST_TOKEN#{hashed}') or []
    if rows:
        return rows[0]
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
    return row


def mark_id_token_seen(id_token, exp_s):
    """False when this ID token was already used (GOOGLEJTI#<hash> kept until its exp by the table TTL)."""
    return db_utils.put_item_if_absent({'PK': f'GOOGLEJTI#{sha256(id_token)}', 'SK': 'METADATA',
                                        'ttl': int(exp_s)})
