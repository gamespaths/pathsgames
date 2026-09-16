"""Step 41 — fixed-window request counters keyed by bucket and caller (v0.37.7).

A limit of zero or less disables a bucket, which is the dev / Robot default. Mirrors the
Java ``RateLimitService``: an attempt is counted whether or not it is allowed, so a caller
hammering a closed window keeps it closed.
"""
import threading
import time
from dataclasses import dataclass
from typing import Callable, Dict, Optional, Tuple

_SWEEP_EVERY = 1024


@dataclass(frozen=True)
class Verdict:
    allowed: bool
    limit: int
    remaining: int
    retry_after_seconds: int

    @staticmethod
    def unlimited() -> "Verdict":
        return Verdict(True, 0, 2**31 - 1, 0)


def client_ip(forwarded_for: Optional[str], remote_addr: Optional[str]) -> str:
    """The first X-Forwarded-For hop, else the socket peer, else empty (never limited)."""
    if forwarded_for and forwarded_for.strip():
        first = forwarded_for.split(",")[0].strip()
        if first:
            return first
    return (remote_addr or "").strip()


class RateLimitService:
    def __init__(self, window_seconds: int, clock: Callable[[], float] = time.time):
        self._window = max(1, int(window_seconds))
        self._clock = clock
        self._lock = threading.Lock()
        self._windows: Dict[str, Tuple[float, int]] = {}
        self._calls = 0

    def try_acquire(self, bucket: str, key: Optional[str], limit: int) -> Verdict:
        if limit <= 0 or not key or not key.strip():
            return Verdict.unlimited()
        now = self._clock()
        with self._lock:
            self._calls += 1
            if self._calls % _SWEEP_EVERY == 0:
                self._windows = {k: v for k, v in self._windows.items()
                                 if now - v[0] < self._window}
            k = f"{bucket}|{key.strip()}"
            start, count = self._windows.get(k, (None, 0))
            if start is None or now - start >= self._window:
                start, count = now, 0
            count += 1
            self._windows[k] = (start, count)
        retry_after = max(1, int(-(-(start + self._window - now) // 1)))
        return Verdict(count <= limit, limit, max(0, limit - count), retry_after)

    def reset(self) -> None:
        """Forget every window."""
        with self._lock:
            self._windows.clear()
