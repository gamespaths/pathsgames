"""v1.7.0 one stamp per request; a gameplay write checks If-Match, then claims the next version before its
first write (step 8) and adds the capped play time. Mirrors ``MatchStampService.java`` / ``RequestStamp.java``."""
import functools
from contextvars import ContextVar
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional

from app.core.models.match.stale_match import StaleMatchError
from app.core.ports.match.match_stamp_ports import MatchStampStorePort

DEFAULT_CAP_SECONDS = 300
GAMEPLAY = "gameplay"
ADMIN = "admin"

class _Ctx:
    """The open request: its stamp, the If-Match version, the version seen by the checks and the claim."""
    __slots__ = ("stamp", "if_match", "seen_match", "seen_version", "claimed_match", "claimed_version")

    def __init__(self, if_match: Optional[str]):
        self.stamp = datetime.now(timezone.utc).isoformat()
        self.if_match = normalize_if_match(if_match)
        self.seen_match = self.seen_version = self.claimed_match = self.claimed_version = None


_CTX: ContextVar[Optional[_Ctx]] = ContextVar("pathsgames_request_stamp", default=None)


def normalize_if_match(raw: Optional[str]) -> Optional[str]:
    """The If-Match value without W/ and quotes; None when absent, empty or "*"."""
    if raw is None:
        return None
    value = str(raw).strip()
    if value.startswith("W/"):
        value = value[2:].strip()
    if len(value) >= 2 and value.startswith('"') and value.endswith('"'):
        value = value[1:-1]
    return None if value in ("", "*") else value


def open_stamp(if_match: Optional[str] = None):
    """Start of a request (with its If-Match header): every match write stores one stamp; answers the token."""
    return _CTX.set(_Ctx(if_match))


def close_stamp(token) -> None:
    _CTX.reset(token)


def request_now() -> str:
    """The stamp of the running request, or now when there is none."""
    ctx = _CTX.get()
    return ctx.stamp if ctx is not None else datetime.now(timezone.utc).isoformat()


def if_match() -> Optional[str]:
    ctx = _CTX.get()
    return ctx.if_match if ctx is not None else None


def record_seen(match_uuid: str, version: str) -> None:
    ctx = _CTX.get()
    if ctx is not None:
        ctx.seen_match, ctx.seen_version = match_uuid, version


def seen_version(match_uuid: Optional[str]) -> Optional[str]:
    ctx = _CTX.get()
    return ctx.seen_version if ctx is not None and match_uuid and ctx.seen_match == match_uuid else None


def record_claim(match_uuid: str, version: str) -> None:
    """The claimed version becomes the stamp of every later write of the request."""
    ctx = _CTX.get()
    if ctx is not None:
        ctx.claimed_match, ctx.claimed_version, ctx.stamp = match_uuid, version, version


def claimed_version(match_uuid: Optional[str] = None) -> Optional[str]:
    """The version claimed by this request (on that match when given), None otherwise."""
    ctx = _CTX.get()
    if ctx is None:
        return None
    if match_uuid is None:
        return ctx.claimed_version
    return ctx.claimed_version if ctx.claimed_match == match_uuid else None


def parse_ts(value) -> Optional[datetime]:
    """ISO-8601 (with or without offset) or SQL "yyyy-MM-dd HH:mm:ss[.f]" (read as UTC); None otherwise."""
    if value is None or not str(value).strip():
        return None
    text = str(value).strip().replace(" ", "T").replace("Z", "+00:00")
    if len(text) > 3 and text[-3] in "+-" and text[-2:].isdigit() and "T" in text and ":" not in text[-3:]:
        text += ":00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def iso_utc(value) -> Optional[str]:
    """v1.7.0 step 9 — a stored timestamp as ISO-8601 UTC ("...Z", like Java Instant); the raw text when unreadable."""
    parsed = parse_ts(value)
    if parsed is None:
        return None if value is None else str(value)
    parsed = parsed.astimezone(timezone.utc)
    micros = parsed.microsecond
    fraction = "" if micros == 0 else f".{micros // 1000:03d}" if micros % 1000 == 0 else f".{micros:06d}"
    return parsed.strftime("%Y-%m-%dT%H:%M:%S") + fraction + "Z"


def play_delta(previous, now, cap_ms: int) -> int:
    """The play time one write adds: the gap since the previous stamp, never negative, at most the cap."""
    start, end = parse_ts(previous), parse_ts(now)
    if start is None or end is None:
        return 0
    gap = int((end - start).total_seconds() * 1000)
    return max(0, min(gap, cap_ms))


def next_version(old, stamp) -> str:
    """The new version: the request stamp, or old + 1 microsecond when the clock did not move past old."""
    previous, now = parse_ts(old), parse_ts(stamp)
    if now is None:
        now = datetime.now(timezone.utc)
        stamp = now.isoformat()
    if previous is None or now > previous:
        return stamp
    return (previous + timedelta(microseconds=1)).isoformat()


class MatchStampService:
    def __init__(self, store: MatchStampStorePort, cap_seconds: int = DEFAULT_CAP_SECONDS):
        self.store = store
        self.cap_ms = (cap_seconds if cap_seconds and cap_seconds > 0 else DEFAULT_CAP_SECONDS) * 1000

    def check_gameplay(self, match_uuid: Optional[str]) -> Optional[str]:
        """Reads the version at request start and checks If-Match (StaleMatchError); None for no match."""
        if not match_uuid:
            return None
        known = claimed_version(match_uuid) or seen_version(match_uuid)
        if known is not None:
            return known
        seen = self.store.find_ts_update(match_uuid)
        if seen is None:
            return None
        expected = if_match()
        if expected is not None and expected != seen:
            raise StaleMatchError(match_uuid, seen)
        record_seen(match_uuid, seen)
        return seen

    def claim_gameplay(self, match_uuid: Optional[str]) -> Optional[str]:
        """Claims the next version before the first write: one conditional update (StaleMatchError)."""
        if not match_uuid:
            return None
        already = claimed_version(match_uuid)
        if already is not None:
            return already
        old = self.check_gameplay(match_uuid)
        if old is None:
            return None
        new = next_version(old, request_now())
        if not self.store.claim(match_uuid, old, new, play_delta(old, new, self.cap_ms)):
            raise StaleMatchError(match_uuid, self.store.find_ts_update(match_uuid))
        record_claim(match_uuid, new)
        return new

    def touch_admin(self, match_uuid: Optional[str]) -> None:
        if match_uuid:
            self.store.stamp(match_uuid, next_version(self.store.find_ts_update(match_uuid), request_now()), 0)


def stamp_check(service, match_uuid: Optional[str]) -> Optional[str]:
    """Gameplay check through ``service.match_stamp`` (None in the older tests)."""
    stamp = getattr(service, "match_stamp", None)
    return stamp.check_gameplay(match_uuid) if stamp is not None else None


def stamp_claim(service, match_uuid: Optional[str]) -> Optional[str]:
    """Gameplay claim through ``service.match_stamp`` (None in the older tests)."""
    stamp = getattr(service, "match_stamp", None)
    return stamp.claim_gameplay(match_uuid) if stamp is not None else None


def stamped(kind: str = ADMIN, uuid_of: Optional[Callable] = None, ok: Optional[Callable] = None):
    """Admin write: after a success (``ok``) stamps ts_update of the match (``uuid_of``), never checked."""
    def decorate(func):
        @functools.wraps(func)
        def wrapper(self, *args, **kwargs):
            result = func(self, *args, **kwargs)
            stamp = getattr(self, "match_stamp", None)
            if stamp is not None and (ok is None or ok(result)):
                match_uuid = uuid_of(args, kwargs) if uuid_of else (
                    args[0] if args else kwargs.get("match_uuid") or kwargs.get("uuid_match"))
                stamp.touch_admin(match_uuid)
            return result
        return wrapper
    return decorate
