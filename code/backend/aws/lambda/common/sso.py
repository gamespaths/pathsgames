"""v1.2.0 Google SSO on DynamoDB (mirror of the Java/Python services): login with the identity rules and the
guest merge, the requesting user (no synthetic user, state and role from the item), account deletion,
the deletion and retention jobs and the admin bootstrap. Items: USER#, EMAIL#, IDENTITY#GOOGLE#, NICK#, NICKNAME#, ADMIN#.
v1.7.0 step 10: USER# keys USERSTATE#<n> (GSI1) and GOOGLE_USER_LIST by last access (GSI2), ban, suspension, re-link.
v1.7.0 step 12: refresh 250 days (guests 180), SESSION_LIMIT, reuse detection, USER#.sessions_valid_after."""
import time
import uuid as uuid_lib
from datetime import datetime, timedelta, timezone

from common import account_guard, admin_log, auth_tokens, db_utils, google_verifier, jwt_utils, match_summary

ALLOWED_DOMAIN = 'gmail.com'
LANGUAGES = ('en', 'it')
STATE_ACTIVE, STATE_BLOCKED, STATE_BANNED, STATE_GUEST, STATE_DELETING = 2, 3, 4, 6, 7
ACTIVE_STATUSES = ('CREATED', 'RUNNING', 'PAUSED')
GOOGLE_USER_LIST = 'GOOGLE_USER_LIST'
DELETING_USERS = 'DELETING_USERS'
ACCESS_SECONDS = 1_800
#: v1.7.0 refresh tokens last 250 days, sliding; a guest's never outlives the 180-day guest cookie
REFRESH_SECONDS = 21_600_000
GUEST_REFRESH_SECONDS = 15_552_000
FRESH_TOKEN_SECONDS = 300
DEFAULT_CHUNK = 100
DEFAULT_RETENTION_MONTHS = 24
NICK_MAX = 90
NICK_ATTEMPTS = 10
USER_STATE_PREFIX = 'USERSTATE#'
DAY_MS = 86_400_000
AUTO_UNBLOCK_REASON = 'Suspension ended'

CODES = {
    'INVALID_REQUEST': 400, 'INVALID_TOKEN': 401, 'INVALID_NONCE': 401, 'TOKEN_REPLAYED': 401,
    'SESSION_REVOKED': 401, 'SESSION_LIMIT': 401, 'FRESH_TOKEN_REQUIRED': 401, 'EMAIL_NOT_VERIFIED': 403,
    'EMAIL_DOMAIN_NOT_ALLOWED': 403, 'ACCOUNT_DISABLED': 403, 'ACCOUNT_DELETION_IN_PROGRESS': 403,
    'NOT_A_GOOGLE_ACCOUNT': 403, 'GOOGLE_ACCOUNT_REQUIRED': 403, 'IDENTITY_MISMATCH': 409, 'NICKNAME_TAKEN': 409,
    'PROVIDER_UNAVAILABLE': 503, 'GOOGLE_DISABLED': 503,
}


class AuthError(Exception):
    def __init__(self, code, message, suspended_until=None):
        super().__init__(message)
        self.code, self.message = code, message
        # v1.7.0 ACCOUNT_DISABLED of a suspended user names the end of the suspension
        self.suspended_until = suspended_until

    @property
    def status(self):
        return CODES.get(self.code, 400)


def _now_ms():
    return int(time.time() * 1000)


def require_usable(state):
    if state in (STATE_BLOCKED, STATE_BANNED):
        raise AuthError('ACCOUNT_DISABLED', 'The account is disabled')
    if state == STATE_DELETING:
        raise AuthError('ACCOUNT_DELETION_IN_PROGRESS', 'The account is being deleted')


def state_of(user):
    state = user.get('state')
    if state is None:
        return STATE_GUEST if user.get('is_guest') else STATE_ACTIVE
    return int(state)


# ── the requesting user ─────────────────────────────────────────────────────

def resolve_user(token):
    """(user item, None) or (None, (status, code, message)): the user must exist, role and state from the item."""
    claims = jwt_utils.verify_access_token(token)
    if not claims or not claims.get('uuid'):
        return None, (401, 'INVALID_TOKEN', 'Access token is invalid, expired, or malformed')
    user = db_utils.get_item(f"USER#{claims['uuid']}", consistent=False)
    if user is None:
        return None, (401, 'INVALID_TOKEN', 'The user of this token does not exist')
    try:
        require_usable(state_of(user))
    except AuthError as e:
        return None, (e.status, e.code, e.message)
    # v1.7.0 step 12 — issued before "log out of all devices", a ban or a suspension (read on every request)
    valid_after, issued_at = user.get('sessions_valid_after'), claims.get('iat')
    if valid_after and issued_at is not None and int(issued_at) < int(valid_after):
        return None, (401, 'SESSION_REVOKED', 'The session was closed from another device')
    return user, None


# ── claims and email rules ──────────────────────────────────────────────────

def check_claims(c, expected_nonce, now_s=None):
    now_s = int(now_s if now_s is not None else time.time())
    if not c or not c.get('sub'):
        raise AuthError('INVALID_TOKEN', 'The Google token has no subject')
    if c.get('aud') != google_verifier.client_id():
        raise AuthError('INVALID_TOKEN', 'The Google token audience is wrong')
    if c.get('iss') not in google_verifier.GOOGLE_ISSUERS:
        raise AuthError('INVALID_TOKEN', 'The Google token issuer is wrong')
    if int(c.get('exp') or 0) <= now_s:
        raise AuthError('INVALID_TOKEN', 'The Google token is expired')
    if expected_nonce is not None and expected_nonce != c.get('nonce'):
        raise AuthError('INVALID_NONCE', 'The login nonce does not match')


def check_email(c):
    if not c.get('email_verified') or not str(c.get('email') or '').strip():
        raise AuthError('EMAIL_NOT_VERIFIED', 'The Google email is not verified')
    email = str(c['email']).strip().lower()
    at = email.rfind('@')
    if at <= 0 or email[at + 1:] != ALLOWED_DOMAIN:
        raise AuthError('EMAIL_DOMAIN_NOT_ALLOWED', 'Only Gmail accounts are accepted')
    return email


def _verified(id_token):
    try:
        return google_verifier.verify(id_token)
    except google_verifier.VerifyError as e:
        raise AuthError(e.code, e.message)


def language(preferred, locale):
    if preferred and str(preferred).strip().lower() in LANGUAGES:
        return str(preferred).strip().lower()
    if locale and len(str(locale)) >= 2 and str(locale)[:2].lower() in LANGUAGES:
        return str(locale)[:2].lower()
    return 'en'


def nickname_base(email):
    local = str(email or '').strip().lower().split('@', 1)[0].split('+', 1)[0]
    return local[:NICK_MAX] if local.strip() else 'player'


def claim_nickname(nickname, user_uuid):
    """Conditional NICKNAME#<nickname> item: True only for the first user claiming it."""
    return db_utils.put_item_if_absent({'PK': f'NICKNAME#{nickname}', 'SK': 'METADATA', 'user_uuid': user_uuid})


def allocate_nickname(base, user_uuid):
    """NICK#<base> counter for the suffix (base, base#2, ...) plus the NICKNAME# claim: one user per nickname."""
    for _ in range(NICK_ATTEMPTS):
        n = db_utils.increment_counter(f'NICK#{base}')
        nickname = base if n == 1 else f"{base}#{n or uuid_lib.uuid4().hex[:6]}"
        if claim_nickname(nickname, user_uuid):
            return nickname
    nickname = f'{base}#{user_uuid[:8]}'
    claim_nickname(nickname, user_uuid)
    return nickname


# ── identities ─────────────────────────────────────────────────────────────

def _identity_item(user_uuid, c, email, now):
    return {'PK': f"IDENTITY#GOOGLE#{c['sub']}", 'SK': f'EMAIL#{email}', 'user_uuid': user_uuid,
            'provider': 'GOOGLE', 'provider_subject': c['sub'], 'email': email, 'profile_name': c.get('name'),
            'given_name': c.get('given_name'), 'family_name': c.get('family_name'),
            'picture_url': c.get('picture'), 'locale': c.get('locale'), 'ts_profile_update': now,
            'GSI1_PK': f'USER_IDENTITIES#{user_uuid}', 'GSI1_SK': f"GOOGLE#{c['sub']}"}


def identities_of(user_uuid):
    rows = db_utils.query_gsi('GSI1', f'USER_IDENTITIES#{user_uuid}') or []
    return [i for i in (db_utils.get_item(r['PK'], r['SK'], consistent=False) for r in rows) if i]


def google_identity(user_uuid):
    for identity in identities_of(user_uuid):
        if identity.get('provider') == 'GOOGLE':
            return identity
    return None


def display_name(identity, nickname):
    if identity:
        given = str(identity.get('given_name') or '').strip()
        family = str(identity.get('family_name') or '').strip()
        if given or family:
            return f'{given} {family}'.strip()
        if str(identity.get('profile_name') or '').strip():
            return str(identity['profile_name']).strip()
    return nickname


def profile(user, identity=None):
    identity = identity if identity is not None else google_identity(user.get('uuid'))
    kind = 'GOOGLE' if identity else 'GUEST' if state_of(user) == STATE_GUEST else 'INTERNAL'
    return {'userUuid': user.get('uuid'), 'username': user.get('username'), 'nickname': user.get('nickname'),
            'displayName': display_name(identity, user.get('nickname')),
            'pictureUrl': identity.get('picture_url') if identity else None, 'role': user.get('role') or 'PLAYER',
            'accountType': kind, 'language': user.get('language')}


def _summary(user):
    return {k: user.get(k) for k in ('uuid', 'username', 'nickname', 'state', 'ts_registration', 'ts_last_access')
            if user.get(k) is not None}


# ── v1.7.0 step 10: index keys of a non-guest USER# item ───────────────────

def account_type(user):
    return 'GOOGLE' if user.get('email') else 'INTERNAL'


def user_summary(user):
    """The map GSI1 (USERSTATE#) and GSI2 (GOOGLE_USER_LIST) project: the admin list reads only this."""
    summary = {k: user.get(k) for k in ('uuid', 'username', 'nickname', 'role', 'ts_registration',
                                        'ts_last_access', 'suspended_until') if user.get(k) is not None}
    summary['state'] = state_of(user)
    summary['account_type'] = account_type(user)
    return summary


def access_sk(user):
    seen = int(user.get('ts_last_access') or user.get('ts_registration') or 0)
    return f"{seen:013d}#{user['uuid']}"


def index_keys(user):
    """GSI1 USERSTATE#<n> / <nickname_lower>#<uuid>; GSI2 GOOGLE_USER_LIST by last access (DELETING_USERS in
    state 7); the summary map. A guest keeps its own keys: empty."""
    state = state_of(user)
    if state == STATE_GUEST:
        return {}
    keys = {'GSI1_PK': f'{USER_STATE_PREFIX}{state}',
            'GSI1_SK': f"{str(user.get('nickname') or '').lower()}#{user['uuid']}",
            'summary': user_summary(user)}
    if state == STATE_DELETING:
        keys['GSI2_PK'], keys['GSI2_SK'] = DELETING_USERS, f"USER#{user['uuid']}"
    else:
        keys['GSI2_PK'], keys['GSI2_SK'] = GOOGLE_USER_LIST, access_sk(user)
    return keys


def save_state(user, state, extra=None, remove=()):
    """A state change rewrites the index keys and the summary; answers the updated item."""
    updated = {**user, 'state': state, **(extra or {})}
    for name in remove:
        updated.pop(name, None)
    db_utils.update_attributes(user['PK'], 'METADATA', {'state': state, **(extra or {}), **index_keys(updated)},
                               remove=remove)
    return updated


def touch_last_access(user, now):
    """ts_last_access every time; the indexed copy (summary, GSI2 SK) at most once a day; guests as before."""
    if state_of(user) == STATE_GUEST:
        values = {'ts_last_access': now}
        if user.get('summary') is not None:
            values['summary.ts_last_access'] = now
    elif int(user.get('ts_last_access') or 0) // DAY_MS != now // DAY_MS:
        values = {'ts_last_access': now, **index_keys({**user, 'ts_last_access': now})}
    else:
        values = {'ts_last_access': now}
    db_utils.update_attributes(user['PK'], 'METADATA', values)


def _iso_ms(text):
    try:
        parsed = datetime.fromisoformat(str(text).strip().replace('Z', '+00:00'))
    except (TypeError, ValueError):
        return None
    parsed = parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    return int(parsed.timestamp() * 1000)


def admit(user):
    """The state check of login and refresh: a suspension that ended unblocks the user (logged as SYSTEM),
    one still running answers ACCOUNT_DISABLED with suspendedUntil."""
    if user is not None and state_of(user) == STATE_BLOCKED and user.get('suspended_until'):
        end = _iso_ms(user['suspended_until'])
        if end is not None and _now_ms() >= end:
            user = save_state(user, STATE_ACTIVE, remove=('suspended_until',))
            admin_log.record(admin_log.SYSTEM, 'UNBLOCK', user['uuid'], AUTO_UNBLOCK_REASON)
            return user
        if end is not None:
            raise AuthError('ACCOUNT_DISABLED', 'The account is suspended', suspended_until=user['suspended_until'])
    if user is not None:
        require_usable(state_of(user))
    return user


def _relink(pointer, user, new_sub):
    """The armed re-link of an IDENTITY_MISMATCH: the pointer takes the new subject, the old identity goes."""
    old_sub = pointer.get('provider_subject')
    email = str(pointer.get('PK') or '')[len('EMAIL#'):]
    db_utils.update_attributes(pointer['PK'], 'METADATA', {'provider_subject': new_sub})
    db_utils.delete_item(f'IDENTITY#GOOGLE#{old_sub}', f'EMAIL#{email}')
    db_utils.update_attributes(user['PK'], 'METADATA', {}, remove=('relink_pending',))
    user.pop('relink_pending', None)


def _create_google_user(c, email, lang):
    now = _now_ms()
    user_uuid = str(uuid_lib.uuid4())
    if not db_utils.put_item_if_absent({'PK': f'EMAIL#{email}', 'SK': 'METADATA', 'user_uuid': user_uuid,
                                        'provider_subject': c['sub']}):
        return None
    user = {'PK': f'USER#{user_uuid}', 'SK': 'METADATA', 'uuid': user_uuid, 'username': f'google_{user_uuid[:8]}',
            'nickname': allocate_nickname(nickname_base(email), user_uuid), 'role': 'PLAYER', 'state': STATE_ACTIVE,
            'is_guest': False, 'email': email, 'language': lang, 'ts_registration': now, 'ts_last_access': now}
    user.update(index_keys(user))
    db_utils.put_item(user)
    db_utils.put_item(_identity_item(user_uuid, c, email, now))
    return user


def _known(pointer, c):
    subject = pointer.get('provider_subject')
    user = db_utils.get_item(f"USER#{pointer.get('user_uuid')}")
    if subject and subject != c['sub']:
        if user is None or not user.get('relink_pending'):
            raise AuthError('IDENTITY_MISMATCH', 'This email belongs to another Google account: contact support')
        _relink(pointer, user, c['sub'])
    return admit(user)


# ── login ───────────────────────────────────────────────────────────────────

def _guest_of(bearer, cookie):
    claims = jwt_utils.verify_access_token(bearer) if bearer else None
    if claims and claims.get('uuid'):
        user = db_utils.get_item(f"USER#{claims['uuid']}")
        if user is not None and state_of(user) == STATE_GUEST:
            return user
    if cookie:
        row = auth_tokens.guest_by_cookie(cookie)
        if row is not None:
            return db_utils.get_item(row['PK'])
    return None


def issue_tokens(user):
    """(access, refresh, access_exp_ms, refresh_exp_ms) with the refresh token stored as hash, cap of 12."""
    now = _now_ms()
    lifetime = GUEST_REFRESH_SECONDS if state_of(user) == STATE_GUEST else REFRESH_SECONDS
    if jwt_utils.ALLOW_MOCK_ACCESS:
        access, refresh = f"MOCK_ACCESS_{user['uuid']}", f'MOCK_REFRESH_{uuid_lib.uuid4()}'
    else:
        access = jwt_utils.generate_access_token(user['uuid'], user.get('username'), user.get('role') or 'PLAYER',
                                                 exp_seconds=ACCESS_SECONDS)
        refresh = jwt_utils.generate_refresh_token(user['uuid'], exp_seconds=lifetime)
    refresh_exp = now + lifetime * 1000
    auth_tokens.store_refresh(user['uuid'], refresh, refresh_exp)
    auth_tokens.enforce_cap(user['uuid'])
    return access, refresh, now + ACCESS_SECONDS * 1000, refresh_exp


def login(id_token, nonce, lang=None, bearer=None, guest_cookie=None):
    """The session dict of POST /api/auth/google; raises AuthError (nothing written on the identity errors)."""
    if not google_verifier.enabled():
        raise AuthError('GOOGLE_DISABLED', 'Google sign-in is disabled on this server')
    if not isinstance(id_token, str) or not id_token.strip() or not isinstance(nonce, str) or not nonce.strip():
        raise AuthError('INVALID_REQUEST', 'idToken and nonce are required')
    c = _verified(id_token)
    check_claims(c, nonce)
    email = check_email(c)
    if account_guard.is_banned(c['sub'], email):
        raise AuthError('ACCOUNT_DISABLED', 'The account is disabled')
    pointer = db_utils.get_item(f'EMAIL#{email}')
    user = _known(pointer, c) if pointer else None
    if pointer is not None and user is None:
        # a pointer left by an interrupted deletion: the email is free again
        db_utils.delete_item(f'EMAIL#{email}')
        pointer = None
    if not auth_tokens.mark_id_token_seen(id_token, c['exp']):
        raise AuthError('TOKEN_REPLAYED', 'This Google token was already used')
    now = _now_ms()
    created = user is None
    if created:
        user = _create_google_user(c, email, language(lang, c.get('locale')))
        if user is None:
            # a concurrent first login won the EMAIL# item: use that user
            pointer = db_utils.get_item(f'EMAIL#{email}')
            user = _known(pointer, c) if pointer else None
            if user is None:
                raise AuthError('INVALID_REQUEST', 'Concurrent sign-in, retry')
            created = False
    if not created:
        if pointer is not None and not pointer.get('provider_subject'):
            # an imported user known by its email only: the identity is linked now
            db_utils.update_attributes(pointer['PK'], 'METADATA', {'provider_subject': c['sub']})
        db_utils.put_item(_identity_item(user['uuid'], c, email, now))
        touch_last_access(user, now)
    merged, cancelled = None, []
    guest = _guest_of(bearer, guest_cookie)
    if guest is not None and guest.get('uuid') != user['uuid']:
        cancelled = [m.get('uuid') for m in merge_guest(guest, user['uuid'])]
        merged = guest.get('uuid')
    access, refresh, access_exp, refresh_exp = issue_tokens(user)
    identity = {'given_name': c.get('given_name'), 'family_name': c.get('family_name'),
                'profile_name': c.get('name'), 'picture_url': c.get('picture')}
    body = profile(user, identity)
    body.update({'accessToken': access, 'accessTokenExpiresAt': access_exp, 'refreshTokenExpiresAt': refresh_exp,
                 'newUser': created, 'mergedGuest': merged is not None, 'cancelledMatches': len(cancelled),
                 'cancelledMatchUuids': cancelled})
    return body, refresh, merged is not None


# ── guest merge ─────────────────────────────────────────────────────────────

def _matches(user_uuid):
    rows = db_utils.query_gsi('GSI1', f'USER_MATCHES#{user_uuid}') or []
    return [m for m in (db_utils.get_item(r['PK']) for r in rows) if m]


def _active_by_story(matches):
    by_story = {}
    for m in matches or []:
        if m.get('status') in ACTIVE_STATUSES:
            by_story.setdefault(m.get('storyUuid'), []).append(m)
    return by_story


def _older(started):
    """All the active matches of one story but the latest ts_update (ties: the greater uuid)."""
    winner = max(started, key=lambda m: (int(m.get('ts_update') or 0), str(m.get('uuid'))))
    return [m for m in started if m is not winner]


def matches_to_cancel(target, guest):
    """v1.7.0 step 9 — per story the Google user's active match always wins: every active guest match of that
    story is cancelled, otherwise the guest's survives. Inside one side only the latest stays (safety net)."""
    target_active, guest_active = _active_by_story(target), _active_by_story(guest)
    cancel = []
    for started in target_active.values():
        cancel.extend(_older(started))
    for story, started in guest_active.items():
        cancel.extend(started if story in target_active else _older(started))
    return cancel


def merge_guest(guest, target_uuid):
    """Ordered writes: the guest's matches and characters move (ts_update kept), the losers become
    CANCELLED, the guest sessions are revoked and the guest partition deleted. Answers the cancelled."""
    guest_uuid = guest.get('uuid')
    guest_matches = _matches(guest_uuid)
    cancel = matches_to_cancel(_matches(target_uuid), guest_matches)
    cancelled = {m.get('PK') for m in cancel}
    for m in guest_matches:
        # v1.7.0 — the summary map moves with the owner (GSI1 and GSI2 read it)
        moved = {**m, 'userCreatorUuid': target_uuid}
        if m.get('PK') in cancelled:
            moved['status'] = 'CANCELLED'
        db_utils.update_attributes(m['PK'], 'METADATA', {'userCreatorUuid': target_uuid,
                                                         'GSI1_PK': f'USER_MATCHES#{target_uuid}',
                                                         'summary': match_summary.build(moved)})
        for ch in db_utils.query_sk_prefix(m['PK'], 'CHARACTER#') or []:
            if ch.get('userUuid') == guest_uuid:
                db_utils.update_attributes(ch['PK'], ch['SK'], {'userUuid': target_uuid})
    for m in cancel:
        owner = target_uuid if m in guest_matches else m.get('userCreatorUuid')
        summary = match_summary.build({**m, 'status': 'CANCELLED', 'userCreatorUuid': owner})
        db_utils.update_attributes(m['PK'], 'METADATA', {'status': 'CANCELLED', 'ts_update': db_utils.stamp_ms(),
                                                         'summary': summary})
    auth_tokens.revoke_all(guest_uuid)
    db_utils.delete_all_by_pk(f'USER#{guest_uuid}')
    return cancel


# ── refresh ─────────────────────────────────────────────────────────────────

def refresh(token):
    """(user, access, refresh, access_exp, refresh_exp) or None (invalid); raises AuthError SESSION_LIMIT (revoked
    by the cap), SESSION_REVOKED (a ROTATED token reused after the grace first revokes every session) or the
    state refusals."""
    if not token:
        return None
    if token.startswith('MOCK_REFRESH_'):
        if not jwt_utils.ALLOW_MOCK_ACCESS:
            return None
    elif not jwt_utils.decode_refresh_token(token):
        return None
    item = auth_tokens.find_refresh(token)
    now = _now_ms()
    if item is None or (item.get('expires_at') and now > int(item['expires_at'])) \
            or auth_tokens.expired_by_ttl(item, now):
        return None
    if item.get('revoked') and not auth_tokens.in_grace(item, now):
        reason = item.get('revoked_reason')
        if reason == auth_tokens.LIMIT:
            raise AuthError('SESSION_LIMIT', 'Too many devices, sign in again')
        if reason == auth_tokens.ROTATED and db_utils.get_item(f"USER#{item.get('user_uuid')}") is not None:
            auth_tokens.cut_sessions(item.get('user_uuid'), auth_tokens.LOGOUT_ALL, now // 1000)
        raise AuthError('SESSION_REVOKED', 'The session was closed')
    user = db_utils.get_item(f"USER#{item.get('user_uuid')}")
    if user is None:
        return None
    user = admit(user)
    if not item.get('revoked'):
        auth_tokens.mark_rotated(item, now)
    touch_last_access(user, now)
    return (user,) + issue_tokens(user)


# ── account deletion and jobs ───────────────────────────────────────────────

def _evict_to_deleting(user):
    save_state(user, STATE_DELETING)
    auth_tokens.revoke_all(user['uuid'])


def request_deletion(user, id_token, nonce):
    if not isinstance(id_token, str) or not id_token.strip():
        raise AuthError('FRESH_TOKEN_REQUIRED', 'A fresh Google sign-in is required')
    identity = google_identity(user.get('uuid'))
    if identity is None:
        raise AuthError('NOT_A_GOOGLE_ACCOUNT', 'Only Google accounts can be deleted')
    c = _verified(id_token)
    check_claims(c, nonce if isinstance(nonce, str) and nonce.strip() else None)
    if int(time.time()) - int(c.get('iat') or 0) > FRESH_TOKEN_SECONDS:
        raise AuthError('FRESH_TOKEN_REQUIRED', 'Sign in with Google again')
    email = check_email(c)
    if identity.get('provider_subject') != c['sub'] or identity.get('email') != email:
        raise AuthError('IDENTITY_MISMATCH', 'The Google account is not this user')
    if not auth_tokens.mark_id_token_seen(id_token, c['exp']):
        raise AuthError('TOKEN_REPLAYED', 'This Google token was already used')
    _evict_to_deleting(user)


def delete_user_fully(user_uuid):
    """Matches (whole partitions: characters, logs, audit, snapshots), identities and their EMAIL# items,
    sessions, the admin pointer and the user; idempotent, a rerun resumes where it stopped."""
    for row in db_utils.query_gsi('GSI1', f'USER_MATCHES#{user_uuid}') or []:
        db_utils.delete_all_by_pk(row['PK'])
    for identity in identities_of(user_uuid):
        if identity.get('email'):
            db_utils.delete_item(f"EMAIL#{identity['email']}")
        db_utils.delete_item(identity['PK'], identity['SK'])
    auth_tokens.revoke_all(user_uuid)
    user = db_utils.get_item(f'USER#{user_uuid}') or {}
    if user.get('email'):
        db_utils.delete_item(f"EMAIL#{user['email']}")
    if str(user.get('role') or '') == 'ADMIN' and user.get('nickname'):
        db_utils.delete_item(f"ADMIN#{user['nickname']}")
    if user.get('nickname'):
        db_utils.delete_item(f"NICKNAME#{user['nickname']}")
    db_utils.delete_all_by_pk(f'USER#{user_uuid}')


def run_deletion_job(chunk=DEFAULT_CHUNK):
    rows = (db_utils.query_gsi('GSI2', DELETING_USERS) or [])[:chunk]
    for row in rows:
        delete_user_fully(row.get('uuid') or str(row['PK'])[len('USER#'):])
    return len(rows)


def retire_inactive_users(months=DEFAULT_RETENTION_MONTHS, chunk=DEFAULT_CHUNK, now_ms=None):
    """Google users not seen for ``months`` go to state 7; the deletion job removes them. v1.7.0: one SK range
    query of GOOGLE_USER_LIST (only the expired users are read); an ADMIN is never retired."""
    now = datetime.fromtimestamp((now_ms or _now_ms()) / 1000, tz=timezone.utc)
    bound = int((now - timedelta(days=round(months * 365.25 / 12))).timestamp() * 1000)
    retired = 0
    for row in db_utils.query_gsi_range('GSI2', GOOGLE_USER_LIST, 'lt', f'{bound:013d}') or []:
        if retired >= chunk:
            break
        user = db_utils.get_item(row['PK'])
        if user is not None and state_of(user) not in (STATE_GUEST, STATE_DELETING) \
                and str(user.get('role') or '') != 'ADMIN' and user.get('email') \
                and int(user.get('ts_last_access') or user.get('ts_registration') or 0) < bound:
            _evict_to_deleting(user)
            retired += 1
    return retired


# ── admin bootstrap ─────────────────────────────────────────────────────────

def admin_token_days():
    import os
    try:
        days = int(os.environ.get('ADMIN_TOKEN_DAYS') or 365)
    except ValueError:
        days = 365
    return days if days > 0 else 365


def create_admin(nickname):
    """A real admin user (ADMIN#<nickname> points to it) and a signed token; the same nickname again reuses it."""
    import re
    nick = str(nickname or '').strip()
    if not re.fullmatch(r'[A-Za-z0-9._-]{3,50}', nick):
        raise AuthError('INVALID_REQUEST', 'The nickname must be 3-50 letters, digits, dots, dashes or underscores')
    pointer = db_utils.get_item(f'ADMIN#{nick}')
    admin = db_utils.get_item(f"USER#{pointer['user_uuid']}") if pointer else None
    created = admin is None
    if admin is not None:
        require_usable(state_of(admin))
    else:
        user_uuid = str(uuid_lib.uuid4())
        if not claim_nickname(nick, user_uuid):
            raise AuthError('NICKNAME_TAKEN', 'The nickname belongs to another user')
        if not db_utils.put_item_if_absent({'PK': f'ADMIN#{nick}', 'SK': 'METADATA', 'user_uuid': user_uuid}):
            db_utils.put_item({'PK': f'ADMIN#{nick}', 'SK': 'METADATA', 'user_uuid': user_uuid})
        now = _now_ms()
        admin = {'PK': f'USER#{user_uuid}', 'SK': 'METADATA', 'uuid': user_uuid, 'username': f'admin_{user_uuid[:8]}',
                 'nickname': nick, 'role': 'ADMIN', 'state': STATE_ACTIVE, 'is_guest': False, 'language': 'en',
                 'ts_registration': now, 'ts_last_access': now}
        admin.update(index_keys(admin))
        db_utils.put_item(admin)
    seconds = admin_token_days() * 86400
    token = jwt_utils.generate_access_token(admin['uuid'], admin.get('username'), 'ADMIN', exp_seconds=seconds)
    return {'userUuid': admin['uuid'], 'username': admin.get('username'), 'nickname': nick, 'role': 'ADMIN',
            'created': created, 'accessToken': token, 'expiresAt': _now_ms() + seconds * 1000}
