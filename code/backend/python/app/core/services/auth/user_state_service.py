"""v1.2.0 role and state of a token's user, one query per user every 60 seconds; evict() drops a user at a
state change (ban, suspend, deletion) so the refusal is immediate."""
import time
from typing import Callable, Dict, Optional, Tuple

from app.core.models.auth.identity import UserStatus
from app.core.ports.auth.identity_persistence_port import IdentityPersistencePort

DEFAULT_TTL_SECONDS = 60.0
SWEEP_ABOVE = 10_000


class UserStateService:
    def __init__(self, persistence: IdentityPersistencePort, ttl_seconds: float = DEFAULT_TTL_SECONDS,
                 clock: Callable[[], float] = time.monotonic):
        self.persistence = persistence
        self.ttl = ttl_seconds
        self.clock = clock
        self._cache: Dict[str, Tuple[Optional[UserStatus], float]] = {}

    def current(self, user_uuid: Optional[str]) -> Optional[UserStatus]:
        if not user_uuid or not user_uuid.strip():
            return None
        now = self.clock()
        hit = self._cache.get(user_uuid)
        if hit is not None and now - hit[1] < self.ttl:
            return hit[0]
        loaded = self.persistence.find_user_by_uuid(user_uuid)
        if len(self._cache) > SWEEP_ABOVE:
            self._cache = {k: v for k, v in self._cache.items() if now - v[1] < self.ttl}
        self._cache[user_uuid] = (loaded, now)
        return loaded

    def evict(self, user_uuid: Optional[str]) -> None:
        if user_uuid is not None:
            self._cache.pop(user_uuid, None)
