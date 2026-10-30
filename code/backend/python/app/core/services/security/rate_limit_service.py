"""Step 41 — fixed-window request counters keyed by bucket and caller (v0.37.7).

A limit of zero or less disables a bucket, which is the dev / Robot default. Mirrors the
Java ``RateLimitService``: an attempt is counted whether or not it is allowed, so a caller
hammering a closed window keeps it closed.
"""
import ipaddress
import threading
import time
from dataclasses import dataclass
from typing import Callable, Dict, Optional, Tuple, Union

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


def parse_trusted_proxies(spec: Optional[str]) -> tuple:
    """v1.10.0 TRUSTED_PROXIES: comma-separated CIDRs or single addresses; an unreadable entry is skipped."""
    networks = []
    for raw in (spec or "").split(","):
        try:
            networks.append(ipaddress.ip_network(raw.strip(), strict=False))
        except ValueError:
            continue
    return tuple(networks)


def _is_proxy(text: Optional[str], trusted: tuple) -> bool:
    try:
        ip = ipaddress.ip_address((text or "").strip().strip("[]"))  # a literal only, never resolved
    except ValueError:
        return False
    return any(ip.version == n.version and ip in n for n in trusted)


def client_ip(forwarded_for: Optional[str], remote_addr: Optional[str], trusted: tuple = ()) -> str:
    """v1.10.0 the socket peer (X-Forwarded-For is spoofable); behind a trusted proxy the right-most hop
    that is not a proxy; empty when unknown (never limited)."""
    peer = (remote_addr or "").strip()
    if not forwarded_for or not forwarded_for.strip() or not _is_proxy(peer, trusted):
        return peer
    for hop in reversed(forwarded_for.split(",")):
        hop = hop.strip()
        if hop and not _is_proxy(hop, trusted):
            return hop
    return peer


class RateLimitService:
    def __init__(self, window_seconds: int, clock: Callable[[], float] = time.time,
                 trusted_proxies: Union[str, tuple, None] = ()):
        self._window = max(1, int(window_seconds))
        self._clock = clock
        # v1.10.0 the proxies whose X-Forwarded-For names the client
        self.trusted_proxies = parse_trusted_proxies(trusted_proxies) if isinstance(trusted_proxies, str) \
            else tuple(trusted_proxies or ())
        self._lock = threading.Lock()
        # v0.41.0 — each counter keeps its own window length: (start, count, length)
        self._windows: Dict[str, Tuple[float, int, int]] = {}
        self._calls = 0

    def client_ip_of(self, forwarded_for: Optional[str], remote_addr: Optional[str]) -> str:
        return client_ip(forwarded_for, remote_addr, self.trusted_proxies)

    def try_acquire(self, bucket: str, key: Optional[str], limit: int,
                    window_seconds: Optional[int] = None) -> Verdict:
        if limit <= 0 or not key or not key.strip():
            return Verdict.unlimited()
        requested = self._window if window_seconds is None else max(1, int(window_seconds))
        now = self._clock()
        with self._lock:
            self._calls += 1
            if self._calls % _SWEEP_EVERY == 0:
                self._windows = {k: v for k, v in self._windows.items()
                                 if now - v[0] < v[2]}
            k = f"{bucket}|{key.strip()}"
            start, count, length = self._windows.get(k, (None, 0, requested))
            if start is None or now - start >= length:
                start, count, length = now, 0, requested
            count += 1
            self._windows[k] = (start, count, length)
        retry_after = max(1, int(-(-(start + length - now) // 1)))
        return Verdict(count <= limit, limit, max(0, limit - count), retry_after)

    def reset(self) -> None:
        """Forget every window."""
        with self._lock:
            self._windows.clear()
