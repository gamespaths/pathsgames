"""v1.7.0 step 10 — admin user management on DynamoDB (mirror of UserAdminService.java): list on GSI1 USERSTATE#<n>
(alphabetical, nickname prefix) or GSI2 GOOGLE_USER_LIST (last access, active filtered in memory), detail, actions."""
import base64
from datetime import datetime, timedelta, timezone

from common import account_guard, admin_log, auth_tokens, db_utils, match_summary, profile, sso, user_lookup

DEFAULT_LIMIT = 50
MAX_LIMIT = 200
SUSPEND_MAX_DAYS = 90
REASON_MAX = 500
LISTABLE_STATES = (1, 2, 3, 4, 5, 7)
ACTIVE_STATUSES = ('CREATED', 'RUNNING', 'PAUSED')
CODES = {'INVALID_INPUT': 400, 'GUEST_NOT_BANNABLE': 400, 'ADMIN_NOT_BANNABLE': 400, 'SUSPEND_UNTIL_INVALID': 400,
         'USER_NOT_FOUND': 404, 'INVALID_STATE_TRANSITION': 409}


class UserAdminError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code, self.message = code, message

    @property
    def status(self):
        return CODES.get(self.code, 400)


def _now_ms():
    return db_utils.stamp_ms()


def clamp(limit):
    try:
        value = int(limit) if limit not in (None, '') else DEFAULT_LIMIT
    except (TypeError, ValueError):
        value = DEFAULT_LIMIT
    return max(1, min(value, MAX_LIMIT))


def parse_state(state):
    if state is None or not str(state).strip():
        return None
    try:
        value = int(str(state).strip())
    except ValueError:
        value = 0
    if value in LISTABLE_STATES:
        return value
    raise UserAdminError('INVALID_INPUT', 'state must be 1-7 (6, guests, is not listable)')


def encode_cursor(sort_key):
    return base64.urlsafe_b64encode(str(sort_key).encode('utf-8')).decode('ascii').rstrip('=')


def decode_cursor(cursor):
    if not cursor or not str(cursor).strip():
        return None
    text = str(cursor).strip()
    try:
        return base64.urlsafe_b64decode(text + '=' * (-len(text) % 4)).decode('utf-8') or None
    except (ValueError, UnicodeDecodeError):
        return None


def check_reason(reason):
    if not isinstance(reason, str) or not reason.strip():
        raise UserAdminError('INVALID_INPUT', 'A reason is required')
    if len(reason.strip()) > REASON_MAX:
        raise UserAdminError('INVALID_INPUT', 'The reason is longer than 500 characters')
    return reason.strip()


def item_of(summary):
    """One list row from the projected summary (never the email); times as ISO-8601 like the user view."""
    s = summary or {}
    return {'uuid': s.get('uuid'), 'nickname': s.get('nickname'), 'state': sso.state_of(s),
            'role': s.get('role') or 'PLAYER', 'accountType': s.get('account_type') or 'INTERNAL',
            'tsRegistration': user_lookup._iso(s.get('ts_registration')),
            'tsLastAccess': user_lookup._iso(s.get('ts_last_access')), 'suspendedUntil': s.get('suspended_until')}


# ── list ────────────────────────────────────────────────────────────────────

def _by_nickname(state, prefix, after, size):
    rows = []
    for n in ([state] if state is not None else LISTABLE_STATES):
        pk = f'{sso.USER_STATE_PREFIX}{n}'
        if after is not None:
            found = db_utils.query_gsi_range('GSI1', pk, 'between', after, prefix + '￿') if prefix \
                else db_utils.query_gsi_range('GSI1', pk, 'gt', after)
            found = [r for r in found or [] if str(r.get('GSI1_SK')) > after]
        elif prefix:
            found = db_utils.query_gsi_range('GSI1', pk, 'begins_with', prefix)
        else:
            found = db_utils.query_gsi_range('GSI1', pk)
        rows.extend(found or [])
    rows.sort(key=lambda r: str(r.get('GSI1_SK')))
    return rows[:size + 1], 'GSI1_SK'


def _by_last_access(after, size):
    found = db_utils.query_gsi_range('GSI2', sso.GOOGLE_USER_LIST, 'lt', after, ascending=False) if after \
        else db_utils.query_gsi_range('GSI2', sso.GOOGLE_USER_LIST, ascending=False)
    active = [r for r in found or [] if sso.state_of(r.get('summary') or {}) == sso.STATE_ACTIVE]
    return active[:size + 1], 'GSI2_SK'


def list_users(params):
    """GET /api/admin/users — the cursor envelope {items, nextCursor, limit}; guests are never listed."""
    params = params or {}
    size = clamp(params.get('limit'))
    state = parse_state(params.get('state'))
    email = str(params.get('email') or '').strip().lower()
    if email:
        user = db_utils.find_user_by_email(email)
        hit = user is not None and sso.state_of(user) != sso.STATE_GUEST \
            and (state is None or sso.state_of(user) == state)
        return {'items': [item_of(sso.user_summary(user))] if hit else [], 'nextCursor': None, 'limit': size}
    nickname = str(params.get('nickname') or '').strip().lower()
    after = decode_cursor(params.get('cursor'))
    if state is not None or nickname:
        rows, sort = _by_nickname(state, nickname, after, size)
    else:
        rows, sort = _by_last_access(after, size)
    page = rows[:size]
    next_cursor = encode_cursor(page[-1][sort]) if len(rows) > size else None
    return {'items': [item_of(r.get('summary')) for r in page], 'nextCursor': next_cursor, 'limit': size}


# ── detail ──────────────────────────────────────────────────────────────────

def detail(user):
    """What GET /api/admin/users/{identifier} adds to the user view (the real last access is in the view)."""
    identities = [{'provider': i.get('provider'), 'subject': i.get('provider_subject'), 'email': i.get('email'),
                   'profileName': i.get('profile_name'), 'givenName': i.get('given_name'),
                   'familyName': i.get('family_name'), 'pictureUrl': i.get('picture_url'), 'locale': i.get('locale'),
                   'tsProfileUpdate': user_lookup._iso(i.get('ts_profile_update'))}
                  for i in sso.identities_of(user.get('uuid'))]
    guest = sso.state_of(user) == sso.STATE_GUEST
    return {'accountType': 'GUEST' if guest else sso.account_type(user),
            'suspendedUntil': user.get('suspended_until'), 'relinkPending': bool(user.get('relink_pending')),
            'banned': bool(user.get('ban_hashes')), 'sessions': len(auth_tokens.active_sessions(user.get('uuid'))),
            'stats': profile.stats(user.get('uuid')), 'identities': identities}


# ── actions ─────────────────────────────────────────────────────────────────

def _existing(user_uuid):
    if not user_uuid or not str(user_uuid).strip():
        raise UserAdminError('USER_NOT_FOUND', 'A user uuid is required')
    user = db_utils.get_item(f'USER#{str(user_uuid).strip()}')
    if user is None:
        raise UserAdminError('USER_NOT_FOUND', 'No user has this uuid')
    return user


def _bannable(user_uuid):
    user = _existing(user_uuid)
    if sso.state_of(user) == sso.STATE_GUEST:
        raise UserAdminError('GUEST_NOT_BANNABLE', 'Guests are limited per IP, not banned')
    if str(user.get('role') or '') == 'ADMIN':
        raise UserAdminError('ADMIN_NOT_BANNABLE', 'An ADMIN can never be banned or suspended')
    return user


def _result(user, action, state, until=None, relink=False, banned=None):
    return {'uuid': user['uuid'], 'action': action, 'state': state, 'suspendedUntil': until,
            'relinkPending': relink, 'bannedMatchUuids': banned or []}


def _ban_active_matches(user_uuid):
    """The active matches (GSI1 USER_MATCHES#, status in the summary) become BANNED; the version moves on."""
    banned = []
    for row in db_utils.query_gsi('GSI1', f'USER_MATCHES#{user_uuid}') or []:
        if match_summary.flatten(row).get('status') not in ACTIVE_STATUSES:
            continue
        meta = db_utils.get_item(row['PK'])
        if meta is None or meta.get('status') not in ACTIVE_STATUSES:
            continue
        previous, stamp = int(meta.get('ts_update') or 0), db_utils.stamp_ms()
        db_utils.update_attributes(row['PK'], 'METADATA', {
            'status': 'BANNED', 'ts_update': stamp if stamp > previous else previous + 1,
            'summary': match_summary.build({**meta, 'status': 'BANNED'})})
        banned.append(meta.get('uuid'))
    return banned


def ban(admin_uuid, user_uuid, reason):
    why = check_reason(reason)
    user = _bannable(user_uuid)
    if sso.state_of(user) == sso.STATE_BANNED:
        raise UserAdminError('INVALID_STATE_TRANSITION', 'The user is already banned')
    identity = sso.google_identity(user['uuid'])
    owned = account_guard.store(user['uuid'], (identity or {}).get('provider_subject'),
                                user.get('email') or (identity or {}).get('email'))
    # A user already deleting keeps state 7: the deletion job continues, the hashes stay.
    state = sso.STATE_DELETING if sso.state_of(user) == sso.STATE_DELETING else sso.STATE_BANNED
    sso.save_state(user, state, extra={'ban_hashes': owned} if owned else None, remove=('suspended_until',))
    auth_tokens.cut_sessions(user['uuid'], auth_tokens.ADMIN)
    banned = _ban_active_matches(user['uuid'])
    admin_log.record(admin_uuid, 'BAN', user['uuid'], why)
    return _result(user, 'BAN', state, banned=banned)


def check_until(until, now_ms=None):
    if not isinstance(until, str) or not until.strip():
        raise UserAdminError('SUSPEND_UNTIL_INVALID', 'until is required')
    text = until.strip()
    try:
        end = datetime.fromisoformat(text.replace('Z', '+00:00'))
    except ValueError:
        raise UserAdminError('SUSPEND_UNTIL_INVALID', 'until is not an ISO-8601 date')
    end = end if end.tzinfo else end.replace(tzinfo=timezone.utc)
    now = datetime.fromtimestamp((now_ms if now_ms is not None else _now_ms()) / 1000, tz=timezone.utc)
    if end <= now or end > now + timedelta(days=SUSPEND_MAX_DAYS):
        raise UserAdminError('SUSPEND_UNTIL_INVALID', 'until must be in the next 90 days')
    return end.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')


def suspend(admin_uuid, user_uuid, until, reason):
    why = check_reason(reason)
    user = _bannable(user_uuid)
    if sso.state_of(user) not in (sso.STATE_ACTIVE, sso.STATE_BLOCKED):
        raise UserAdminError('INVALID_STATE_TRANSITION', 'Only an active or suspended user')
    end = check_until(until)
    sso.save_state(user, sso.STATE_BLOCKED, extra={'suspended_until': end})
    auth_tokens.cut_sessions(user['uuid'], auth_tokens.ADMIN)
    admin_log.record(admin_uuid, 'SUSPEND', user['uuid'], why)
    return _result(user, 'SUSPEND', sso.STATE_BLOCKED, until=end)


def unblock(admin_uuid, user_uuid, reason):
    why = check_reason(reason)
    user = _existing(user_uuid)
    if sso.state_of(user) not in (sso.STATE_BLOCKED, sso.STATE_BANNED):
        raise UserAdminError('INVALID_STATE_TRANSITION', 'Only a suspended or banned user')
    account_guard.remove(user.get('ban_hashes'))
    sso.save_state(user, sso.STATE_ACTIVE, remove=('suspended_until', 'ban_hashes'))
    admin_log.record(admin_uuid, 'UNBLOCK', user['uuid'], why)
    return _result(user, 'UNBLOCK', sso.STATE_ACTIVE)


def relink_subject(admin_uuid, user_uuid, reason):
    why = check_reason(reason)
    user = _existing(user_uuid)
    if sso.state_of(user) in (sso.STATE_GUEST, sso.STATE_DELETING) or sso.google_identity(user['uuid']) is None:
        raise UserAdminError('INVALID_STATE_TRANSITION', 'Only a Google user can be re-linked')
    db_utils.update_attributes(user['PK'], 'METADATA', {'relink_pending': True})
    admin_log.record(admin_uuid, 'RELINK_SUBJECT', user['uuid'], why)
    return _result(user, 'RELINK_SUBJECT', sso.state_of(user), until=user.get('suspended_until'), relink=True)


def delete_user(admin_uuid, user_uuid, reason):
    why = check_reason(reason)
    user = _bannable(user_uuid)
    if sso.state_of(user) == sso.STATE_DELETING:
        raise UserAdminError('INVALID_STATE_TRANSITION', 'The user is already being deleted')
    sso.save_state(user, sso.STATE_DELETING)
    auth_tokens.cut_sessions(user['uuid'], auth_tokens.ADMIN)
    admin_log.record(admin_uuid, 'DELETE_OLD_USER', user['uuid'], why)
    return _result(user, 'DELETE_OLD_USER', sso.STATE_DELETING)
