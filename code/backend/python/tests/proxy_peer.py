"""v1.10.0 test helper: requests that arrive from a trusted proxy, so X-Forwarded-For names the client."""
from app.core.services.security.rate_limit_service import parse_trusted_proxies

PROXY_PEER = "10.0.0.1"
PROXIES = parse_trusted_proxies("10.0.0.0/8")


def behind_proxy(app, limiter=None, peer=PROXY_PEER):
    """The ASGI app seen from ``peer``; the limiter (if any) trusts it."""
    if limiter is not None:
        limiter.trusted_proxies = PROXIES

    async def wrapped(scope, receive, send):
        if scope["type"] in ("http", "websocket"):
            scope = {**scope, "client": (peer, 50000)}
        await app(scope, receive, send)

    return wrapped
