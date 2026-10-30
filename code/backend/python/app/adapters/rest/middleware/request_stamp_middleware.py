"""v1.7.0 one match stamp per request (with its If-Match header, step 8); a JSON object answer of a request
that claimed a match version gets ``matchVersion``. Pure ASGI: the context reaches the endpoints."""
import json

from app.core.services.match.match_stamp import claimed_version, close_stamp, open_stamp

FIELD = "matchVersion"


def _header(scope, name: bytes):
    for key, value in scope.get("headers") or []:
        if key.lower() == name:
            return value.decode("latin-1")
    return None


def with_version(body: bytes, version: str) -> bytes:
    """The JSON body with matchVersion added; anything that is not a JSON object stays as it is."""
    try:
        data = json.loads(body or b"null")
    except ValueError:
        return body
    if not isinstance(data, dict) or FIELD in data:
        return body
    data[FIELD] = version
    return json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


class RequestStampMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return
        token = open_stamp(_header(scope, b"if-match"))
        try:
            await self.app(scope, receive, _VersionSender(send))
        finally:
            close_stamp(token)


class _VersionSender:
    """Holds a JSON answer of a claiming request until its body is complete, then adds matchVersion."""

    def __init__(self, send):
        self.send = send
        self.start = None
        self.version = None
        self.chunks = []

    async def __call__(self, message):
        kind = message.get("type")
        if kind == "http.response.start":
            version = claimed_version()
            content_type = (dict(message.get("headers") or []).get(b"content-type") or b"").lower()
            if version and b"application/json" in content_type:
                self.start, self.version = message, version
                return
        elif kind == "http.response.body" and self.start is not None:
            self.chunks.append(message.get("body", b""))
            if message.get("more_body"):
                return
            body = with_version(b"".join(self.chunks), self.version)
            headers = [(k, v) for k, v in self.start.get("headers") or [] if k.lower() != b"content-length"]
            headers.append((b"content-length", str(len(body)).encode("latin-1")))
            start, self.start = dict(self.start, headers=headers), None
            await self.send(start)
            await self.send({"type": "http.response.body", "body": body})
            return
        await self.send(message)
