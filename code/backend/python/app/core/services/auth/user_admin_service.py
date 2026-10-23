"""v1.7.0 step 10 — admin user management (mirror of UserAdminService.java): list (email exact, nickname prefix,
state; default = active users by last access), detail, ban / suspend / unblock / re-link / deletion with the log."""
import base64
from datetime import datetime, timedelta, timezone
from typing import Callable, List, Optional

from app.core.models.auth import revoke_reasons
from app.core.models.auth import user_admin as ua
from app.core.models.auth.auth_error import UserStates
from app.core.models.auth.identity import PROVIDER_GOOGLE
from app.core.models.auth.profile import UserStats
from app.core.models.auth.user_admin import AdminUserActionResult, AdminUserDetail, AdminUserPage, UserAdminError
from app.core.models.match import match_statuses
from app.core.services.auth.account_guard_service import iso

DEFAULT_LIMIT = 50
MAX_LIMIT = 200
SUSPEND_MAX_DAYS = 90
SEP = "|"


def clamp(limit) -> int:
    if limit is None:
        return DEFAULT_LIMIT
    return max(1, min(int(limit), MAX_LIMIT))


def parse_state(state) -> Optional[int]:
    if state is None or not str(state).strip():
        return None
    try:
        value = int(str(state).strip())
    except ValueError:
        value = 0
    if 1 <= value <= 7 and value != UserStates.GUEST:
        return value
    raise UserAdminError("INVALID_INPUT", "state must be 1-7 (6, guests, is not listable)")


def encode_cursor(key: str, uuid: str) -> str:
    return base64.urlsafe_b64encode(f"{key}{SEP}{uuid}".encode("utf-8")).decode("ascii").rstrip("=")


def decode_cursor(cursor: Optional[str]):
    """[key, uuid] of an opaque cursor; None (first page) when missing or malformed."""
    if not cursor or not cursor.strip():
        return None
    try:
        text = cursor.strip()
        raw = base64.urlsafe_b64decode(text + "=" * (-len(text) % 4)).decode("utf-8")
    except (ValueError, UnicodeDecodeError):
        return None
    sep = raw.rfind(SEP)
    if sep < 0 or sep == len(raw) - 1:
        return None
    return [raw[:sep], raw[sep + 1:]]


def check_reason(reason: Optional[str]) -> str:
    if not reason or not str(reason).strip():
        raise UserAdminError("INVALID_INPUT", "A reason is required")
    text = str(reason).strip()
    if len(text) > ua.REASON_MAX:
        raise UserAdminError("INVALID_INPUT", "The reason is longer than 500 characters")
    return text


class UserAdminService:
    def __init__(self, identities, persistence, tokens, user_state, interventions, hasher, matches,
                 match_commands, accounts=None, clock: Callable[[], datetime] = lambda: datetime.now(timezone.utc)):
        self.identities = identities
        self.persistence = persistence
        self.tokens = tokens
        self.user_state = user_state
        self.interventions = interventions
        self.hasher = hasher
        self.matches = matches
        self.match_commands = match_commands
        self.accounts = accounts
        self.clock = clock

    # ── list and detail ──

    def list(self, email=None, nickname=None, state=None, cursor=None, limit=None) -> AdminUserPage:
        size = clamp(limit)
        wanted = parse_state(state)
        if email and str(email).strip():
            hit = self.persistence.find_by_email(str(email).strip().lower())
            items = [hit] if hit is not None and (wanted is None or hit.state == wanted) else []
            return AdminUserPage(items, None, size)
        position = decode_cursor(cursor)
        after_key, after_uuid = (position[0], position[1]) if position else (None, None)
        by_nickname = wanted is not None or bool(nickname and str(nickname).strip())
        if by_nickname:
            prefix = str(nickname).strip().lower() if nickname and str(nickname).strip() else ""
            rows = self.persistence.list_by_nickname(wanted, prefix, after_key, after_uuid, size + 1)
        else:
            rows = self.persistence.list_by_last_access(UserStates.ACTIVE, after_key, after_uuid, size + 1)
        more = len(rows) > size
        page = list(rows[:size])
        next_cursor = None
        if more:
            last = page[-1]
            key = (last.nickname or "").lower() if by_nickname else (last.ts_last_access or "")
            next_cursor = encode_cursor(key, last.uuid)
        return AdminUserPage(page, next_cursor, size)

    def detail(self, user_uuid: str) -> Optional[AdminUserDetail]:
        user = self.persistence.find_by_uuid(user_uuid)
        if user is None:
            return None
        stats = self.accounts.stats(user.uuid) if self.accounts is not None else UserStats()
        return AdminUserDetail("GUEST" if user.is_guest else user.account_type, user.suspended_until,
                               self.persistence.is_relink_pending(user.id),
                               self.persistence.has_banned_hashes(user.uuid),
                               self.tokens.count_active_by_user_id(user.id), stats,
                               self.identities.find_identities_of_user(user.id))

    # ── actions ──

    def ban(self, admin_uuid, user_uuid, reason) -> AdminUserActionResult:
        why = check_reason(reason)
        user = self._bannable(user_uuid)
        if user.state == UserStates.BANNED:
            raise UserAdminError("INVALID_STATE_TRANSITION", "The user is already banned")
        google = self._google_identity(user.id)
        email = self.persistence.find_email(user.id) or (google.email if google else None)
        self.persistence.store_banned_hashes(user.uuid, self.hasher.subject(google.subject if google else None),
                                             self.hasher.email(email))
        # A user already deleting keeps state 7: the deletion job continues, the hashes stay.
        state = UserStates.DELETING if user.state == UserStates.DELETING else UserStates.BANNED
        self.persistence.update_state_and_suspension(user.id, state, None)
        self._cut_access(user)
        banned = self._ban_active_matches(user.id)
        self.interventions.record(admin_uuid, ua.BAN, user.uuid, why)
        return AdminUserActionResult(user.uuid, ua.BAN, state, None, False, banned)

    def suspend(self, admin_uuid, user_uuid, until, reason) -> AdminUserActionResult:
        why = check_reason(reason)
        user = self._bannable(user_uuid)
        if user.state not in (UserStates.ACTIVE, UserStates.BLOCKED):
            raise UserAdminError("INVALID_STATE_TRANSITION", "Only an active or suspended user")
        end = self.check_until(until)
        self.persistence.update_state_and_suspension(user.id, UserStates.BLOCKED, end)
        self._cut_access(user)
        self.interventions.record(admin_uuid, ua.SUSPEND, user.uuid, why)
        return AdminUserActionResult(user.uuid, ua.SUSPEND, UserStates.BLOCKED, end)

    def unblock(self, admin_uuid, user_uuid, reason) -> AdminUserActionResult:
        why = check_reason(reason)
        user = self._existing(user_uuid)
        if user.state not in (UserStates.BLOCKED, UserStates.BANNED):
            raise UserAdminError("INVALID_STATE_TRANSITION", "Only a suspended or banned user")
        self.persistence.update_state_and_suspension(user.id, UserStates.ACTIVE, None)
        self.persistence.delete_banned_hashes(user.uuid)
        self._evict(user.uuid)
        self.interventions.record(admin_uuid, ua.UNBLOCK, user.uuid, why)
        return AdminUserActionResult(user.uuid, ua.UNBLOCK, UserStates.ACTIVE)

    def relink_subject(self, admin_uuid, user_uuid, reason) -> AdminUserActionResult:
        why = check_reason(reason)
        user = self._existing(user_uuid)
        if user.is_guest or user.state == UserStates.DELETING or self._google_identity(user.id) is None:
            raise UserAdminError("INVALID_STATE_TRANSITION", "Only a Google user can be re-linked")
        self.persistence.set_relink_pending(user.id, True)
        self.interventions.record(admin_uuid, ua.RELINK_SUBJECT, user.uuid, why)
        return AdminUserActionResult(user.uuid, ua.RELINK_SUBJECT, user.state, user.suspended_until, True)

    def delete_user(self, admin_uuid, user_uuid, reason) -> AdminUserActionResult:
        why = check_reason(reason)
        user = self._bannable(user_uuid)
        if user.state == UserStates.DELETING:
            raise UserAdminError("INVALID_STATE_TRANSITION", "The user is already being deleted")
        self.identities.update_state(user.id, UserStates.DELETING)
        self._cut_access(user)
        self.interventions.record(admin_uuid, ua.DELETE_OLD_USER, user.uuid, why)
        return AdminUserActionResult(user.uuid, ua.DELETE_OLD_USER, UserStates.DELETING)

    def purge_intervention_log(self) -> int:
        now = self.clock()
        bound = _minus_months(now, ua.RETENTION_MONTHS)
        return self.interventions.delete_older_than(iso(bound))

    # ── helpers ──

    def check_until(self, until) -> str:
        if not until or not str(until).strip():
            raise UserAdminError("SUSPEND_UNTIL_INVALID", "until is required")
        text = str(until).strip()
        try:
            if len(text) == 10:
                end = datetime.fromisoformat(text).replace(tzinfo=timezone.utc)
            else:
                end = datetime.fromisoformat(text.replace("Z", "+00:00"))
                end = end if end.tzinfo else end.replace(tzinfo=timezone.utc)
        except ValueError:
            raise UserAdminError("SUSPEND_UNTIL_INVALID", "until is not an ISO-8601 date")
        now = self.clock()
        if end <= now or end > now + timedelta(days=SUSPEND_MAX_DAYS):
            raise UserAdminError("SUSPEND_UNTIL_INVALID", "until must be in the next 90 days")
        return iso(end)

    def _existing(self, user_uuid):
        if not user_uuid or not str(user_uuid).strip():
            raise UserAdminError("USER_NOT_FOUND", "A user uuid is required")
        user = self.persistence.find_by_uuid(str(user_uuid).strip())
        if user is None:
            raise UserAdminError("USER_NOT_FOUND", "No user has this uuid")
        return user

    def _bannable(self, user_uuid):
        user = self._existing(user_uuid)
        if user.is_guest:
            raise UserAdminError("GUEST_NOT_BANNABLE", "Guests are limited per IP, not banned")
        if user.is_admin:
            raise UserAdminError("ADMIN_NOT_BANNABLE", "An ADMIN can never be banned or suspended")
        return user

    def _evict(self, user_uuid):
        if self.user_state is not None:
            self.user_state.evict(user_uuid)

    def _cut_access(self, user):
        """v1.7.0 sessions revoked with reason ADMIN and the access tokens issued until now refused."""
        from app.core.services.auth.session_service import valid_after
        self.tokens.revoke_all_by_user_id(user.id, revoke_reasons.ADMIN)
        self.tokens.set_sessions_valid_after(user.id, valid_after(self.clock()))
        self._evict(user.uuid)

    def _ban_active_matches(self, user_id) -> List[str]:
        banned = []
        for uuid in self.matches.find_match_uuids_by_user_creator(user_id, match_statuses.ACTIVE):
            if self.match_commands.update_match(uuid, match_statuses.BANNED, None, ua.BAN) == "UPDATED":
                banned.append(uuid)
        return banned

    def _google_identity(self, user_id):
        for identity in self.identities.find_identities_of_user(user_id):
            if identity.provider == PROVIDER_GOOGLE:
                return identity
        return None


def _minus_months(dt: datetime, months: int) -> datetime:
    month = dt.month - 1 - months
    year = dt.year + month // 12
    month = month % 12 + 1
    day = min(dt.day, [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28, 31, 30, 31, 30,
                       31, 31, 30, 31, 30, 31][month - 1])
    return dt.replace(year=year, month=month, day=day)
