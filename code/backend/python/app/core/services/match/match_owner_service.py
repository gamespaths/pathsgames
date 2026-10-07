"""v0.41.6 — admin owner move: resolve uuid -> email -> username, refuse terminal, multi-character, not
eligible and duplicate-active targets, move creator and characters, log it. Mirrors ``MatchOwnerService.java``."""
import uuid as uuid_lib
from datetime import datetime, timezone
from typing import Callable, List, Optional

from app.core.models.auth.admin_user import REASON_EXPIRED, AdminUserView
from app.core.models.match import match_statuses
from app.core.models.match import match_owner as mo
from app.core.ports.match import log_writer_ports as lw
from app.core.ports.match import match_owner_ports as op
from app.core.ports.match.match_owner_ports import MatchOwnerError, MatchOwnerPort


def _blank(text) -> bool:
    return text is None or not str(text).strip()


def _is_uuid(text: str) -> bool:
    try:
        uuid_lib.UUID(text)
    except ValueError:
        return False
    return len(text) == 36


class MatchOwnerService(MatchOwnerPort):

    def __init__(self, persistence, characters, users, log_writer=None,
                 clock: Optional[Callable[[], datetime]] = None) -> None:
        self.persistence = persistence
        self.characters = characters
        self.users = users
        self.log_writer = log_writer
        self.clock = clock or (lambda: datetime.now(timezone.utc))

    def owner(self, uuid_match: str) -> AdminUserView:
        match = self._require_match(uuid_match)
        creator = self._creator(match)
        if creator is None:
            raise MatchOwnerError(op.USER_NOT_FOUND, "The owner of the match no longer exists")
        return self._counted(creator)

    def find_user(self, identifier: str) -> AdminUserView:
        return self._counted(self.resolve(identifier))

    def move(self, uuid_match: str, identifier: str) -> mo.MatchOwnerMoveResult:
        if _blank(identifier):
            raise MatchOwnerError(op.INVALID_INPUT, "Field 'user' is required")
        match = self._require_match(uuid_match)
        target = self.resolve(identifier)
        if match_statuses.is_terminal(match.get("status")):
            raise MatchOwnerError(op.MATCH_TERMINATED, "A terminated match cannot be moved")
        rows = self.characters.find_characters_by_match_id(match["id"]) or []
        previous = self._creator(match)
        before = mo.Owner(previous.uuid, previous.username) if previous else mo.Owner(None, None)
        after = mo.Owner(target.uuid, target.username)
        if match.get("id_user_creator") == target.id and all(c.get("id_user") == target.id for c in rows):
            return mo.MatchOwnerMoveResult(mo.UNCHANGED, match["uuid"], before, after, 0)
        # With one character, a target that already holds it can only be a half-written move: repaired.
        if len(rows) > 1:
            raise MatchOwnerError(op.MATCH_MULTI_CHARACTER, "A match with more than one character cannot be moved")
        reason = target.reason(self.clock())
        if reason is not None:
            raise MatchOwnerError(reason, "The target guest has expired" if reason == REASON_EXPIRED
                                  else "The target user cannot own a match")
        # A target that already is the creator (repair) owns this very match: not a duplicate.
        if match.get("id_user_creator") != target.id and self.persistence.has_active_match_for_story(
                target.id, match["id_story"], list(match_statuses.ACTIVE)):
            raise MatchOwnerError(op.ACTIVE_MATCH_ALREADY_EXISTS,
                                  "The target user already has an active match on this story")
        moved = self.persistence.change_owner(match["id"], target.id)
        if self.log_writer is not None:
            self.log_writer.write(match["id"], None, None, int(match.get("current_clock") or 0),
                                  lw.owner_changed(_label(before), _label(after)))
        return mo.MatchOwnerMoveResult(mo.MOVED, match["uuid"], before, after, int(moved or 0))

    def resolve(self, identifier: str) -> AdminUserView:
        """uuid first (when it parses as one), then a unique email, then a unique username."""
        if _blank(identifier):
            raise MatchOwnerError(op.INVALID_INPUT, "A user identifier is required")
        text = str(identifier).strip()
        if _is_uuid(text):
            hit = self.users.find_by_uuid(text)
            if hit is not None:
                return hit
        hit = _unique(self.users.find_by_email(text), "email")
        if hit is not None:
            return hit
        hit = _unique(self.users.find_by_username(text), "username")
        if hit is None:
            raise MatchOwnerError(op.USER_NOT_FOUND, f"No user matches: {text}")
        return hit

    def _require_match(self, uuid_match: str):
        if _blank(uuid_match):
            raise MatchOwnerError(op.INVALID_INPUT, "The match uuid is required")
        match = self.persistence.find_match_by_uuid(uuid_match)
        if match is None:
            raise MatchOwnerError(op.MATCH_NOT_FOUND, f"Match not found: {uuid_match}")
        return match

    def _creator(self, match) -> Optional[AdminUserView]:
        creator = match.get("id_user_creator")
        return None if creator is None else self.users.find_by_id(creator)

    def _counted(self, user: AdminUserView) -> AdminUserView:
        return user.with_match_count(self.persistence.count_matches_by_user_creator(user.id))


def _unique(hits: List[AdminUserView], what: str) -> Optional[AdminUserView]:
    if not hits:
        return None
    if len(hits) > 1:
        raise MatchOwnerError(op.USER_AMBIGUOUS, f"More than one user has this {what}")
    return hits[0]


def _label(owner: mo.Owner) -> str:
    return f"{owner.username}/{owner.uuid}"
