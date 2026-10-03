"""v0.41.6 — admin owner move: a user resolved by uuid, then email, then username, and its admin view
(eligibility, guest expiry, match count). Shared by the auth and match Lambdas; same codes as java/python."""
import time
import uuid as uuid_lib
from datetime import datetime, timezone

from common import db_utils

STATE_ACTIVE, STATE_GUEST = 2, 6
USER_NOT_FOUND = 'USER_NOT_FOUND'
USER_AMBIGUOUS = 'USER_AMBIGUOUS'
USER_NOT_ALLOWED = 'USER_NOT_ALLOWED'
USER_EXPIRED = 'USER_EXPIRED'


class UserLookupError(Exception):
    """404 USER_NOT_FOUND or 409 USER_AMBIGUOUS."""

    def __init__(self, status, code, message):
        super().__init__(message)
        self.status, self.code, self.message = status, code, message


def _now_ms():
    return int(time.time() * 1000)


def _int(value, default=0):
    try:
        return int(value) if value is not None else default
    except (TypeError, ValueError):
        return default


def _iso(ms):
    ms = _int(ms)
    if not ms:
        return None
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def _is_uuid(text):
    try:
        uuid_lib.UUID(text)
    except ValueError:
        return False
    return len(text) == 36


def _unique(items, what):
    if len(items) > 1:
        raise UserLookupError(409, USER_AMBIGUOUS, f'More than one user has this {what}')
    return items[0] if items else None


def by_uuid(user_uuid):
    return db_utils.get_item(f'USER#{user_uuid}', consistent=False) if user_uuid else None


def resolve(identifier):
    """The USER# item for a uuid, a unique email or a unique username; raises UserLookupError."""
    text = str(identifier or '').strip()
    if not text:
        raise UserLookupError(404, USER_NOT_FOUND, 'A user identifier is required')
    if _is_uuid(text):
        hit = by_uuid(text)
        if hit is not None:
            return hit
    hit = _unique(db_utils.find_users_by_email(text) or [], 'email')
    if hit is None:
        hit = _unique(db_utils.find_users_by_username(text) or [], 'username')
    if hit is None:
        raise UserLookupError(404, USER_NOT_FOUND, f'No user matches: {text}')
    return hit


def state_of(item):
    """The stored state, else 6 for a guest and 1 (registration) for anybody else."""
    state = item.get('state')
    if state is None:
        return STATE_GUEST if item.get('is_guest') else 1
    return _int(state, 1)


def is_guest(item):
    return state_of(item) == STATE_GUEST


def is_expired(item, now_ms=None):
    """A guest without expiry (an imported one) is not expired."""
    expires = _int(item.get('guest_expires_at'))
    return bool(is_guest(item) and expires and (now_ms or _now_ms()) > expires)


def reason(item, now_ms=None):
    """None when the user may receive a match, else USER_NOT_ALLOWED or USER_EXPIRED."""
    if str(item.get('role') or 'PLAYER').upper() == 'ADMIN' or state_of(item) not in (STATE_ACTIVE, STATE_GUEST):
        return USER_NOT_ALLOWED
    return USER_EXPIRED if is_expired(item, now_ms) else None


def match_count(user_uuid):
    """Every match the user created, any status: one GSI1 COUNT on USER_MATCHES#<uuid>."""
    return db_utils.count_gsi('GSI1', f'USER_MATCHES#{user_uuid}') if user_uuid else 0


def view(item, count=None, now_ms=None):
    """The AdminUserResponse of both admin GETs."""
    why = reason(item, now_ms)
    return {
        'uuid': item.get('uuid'), 'username': item.get('username'), 'nickname': item.get('nickname'),
        'email': item.get('email'), 'role': item.get('role') or 'PLAYER', 'state': state_of(item),
        'guest': is_guest(item), 'guestExpiresAt': _iso(item.get('guest_expires_at')),
        'expired': is_expired(item, now_ms),
        'tsRegistration': _iso(item.get('ts_registration', item.get('ts_insert'))),
        'tsLastAccess': _iso(item.get('ts_last_access')),
        'matchCount': match_count(item.get('uuid')) if count is None else int(count),
        'eligible': why is None, 'reason': why,
    }
