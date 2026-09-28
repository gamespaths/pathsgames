"""v0.41.0 — Step 41 C: the API security headers on every response of both apps. The FastAPI
docs pages are skipped so Swagger UI keeps its CDN assets (decision 34)."""

SECURITY_HEADERS = (
    (b"x-content-type-options", b"nosniff"),
    (b"x-frame-options", b"DENY"),
    (b"referrer-policy", b"no-referrer"),
    (b"content-security-policy", b"default-src 'none'; frame-ancestors 'none'"),
    (b"strict-transport-security", b"max-age=31536000"),
)
NO_STORE = (b"cache-control", b"no-store")
DOCS_PATHS = ("/docs", "/redoc", "/openapi.json")


def is_docs_path(path: str) -> bool:
    return any(path == p or path.startswith(p + "/") for p in DOCS_PATHS)


def is_no_store_path(path: str) -> bool:
    """Public story reads stay cacheable; tokens and admin data never are."""
    return path in ("/api/auth", "/api/admin") or path.startswith(("/api/auth/", "/api/admin/"))


class SecurityHeadersMiddleware:
    """Pure ASGI middleware: rewrites the response start message, never the body."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        path = scope.get("path", "")
        if scope.get("type") != "http" or is_docs_path(path):
            await self.app(scope, receive, send)
            return
        extra = list(SECURITY_HEADERS) + ([NO_STORE] if is_no_store_path(path) else [])
        names = {name for name, _ in extra}

        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                kept = [h for h in message.get("headers", []) if h[0].lower() not in names]
                message = {**message, "headers": kept + extra}
            await send(message)

        await self.app(scope, receive, send_with_headers)
