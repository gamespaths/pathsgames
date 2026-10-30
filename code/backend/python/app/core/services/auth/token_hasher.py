"""v1.2.0 SHA-256 (lowercase hex) of refresh, guest cookie and ID tokens; until LEGACY_FALLBACK_UNTIL a
clear value stored before 1.2.0 is still looked up (lazy migration, 180 days after the release)."""
import hashlib
from datetime import datetime, timezone
from typing import Optional

LEGACY_FALLBACK_UNTIL = datetime(2027, 5, 1, tzinfo=timezone.utc)


def sha256(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def legacy(clear_value: Optional[str], now: Optional[datetime] = None) -> Optional[str]:
    """The clear value for the lazy migration lookup, or None once the fallback window is over."""
    now = now or datetime.now(timezone.utc)
    return clear_value if now < LEGACY_FALLBACK_UNTIL else None
