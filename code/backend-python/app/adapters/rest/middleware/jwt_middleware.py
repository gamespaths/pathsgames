from fastapi import Request, Response, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.ports.auth.session_port import SessionPort
import json
import time

class JwtMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, session_service: SessionPort, public_paths: list, admin_path_prefix: str = "/api/admin/"):
        super().__init__(app)
        self.session_service = session_service
        self.public_paths = public_paths
        self.admin_path_prefix = admin_path_prefix

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # 1. Skip check for public paths
        is_public = any(self._is_path_match(path, p) for p in self.public_paths)
        if is_public:
            return await call_next(request)

        # 2. Options pre-flight
        if request.method == "OPTIONS":
            return await call_next(request)

        # 3. Extract Bearer token
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.lower().startswith("bearer "):
            return self._error_response("MISSING_TOKEN", "Authorization header required", 401)

        token = auth_header[7:]

        # 4. Validate through SessionPort
        try:
            token_info = self.session_service.validate_access_token(token)
        except ValueError as e:
            return self._error_response("INVALID_TOKEN", str(e), 401)

        # 5. Check Admin Authorization
        if path.startswith(self.admin_path_prefix) and not token_info.is_admin():
            return self._error_response("FORBIDDEN", "Access denied: admins only", 403)

        # 6. Enrich request with token data
        request.state.user_uuid = token_info.user_uuid
        request.state.username = token_info.username
        request.state.role = token_info.role

        return await call_next(request)

    def _is_path_match(self, path: str, pattern: str) -> bool:
        if pattern.endswith("/**"):
            base = pattern[:-3]
            return path.startswith(base)
        return path == pattern

    def _error_response(self, code: str, message: str, status: int) -> Response:
        content = json.dumps({
            "error": code,
            "message": message,
            "timestamp": int(time.time() * 1000)
        })
        return Response(
            content=content,
            status_code=status,
            media_type="application/json"
        )
