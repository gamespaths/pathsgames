from fastapi import APIRouter, HTTPException, status, Request, Response, Header
from pydantic import BaseModel
from typing import Optional
from app.core.ports.auth.guest_auth_port import GuestAuthPort
from app.core.ports.auth.jwt_port import JwtPort
from app.core.ports.auth.token_persistence_port import TokenPersistencePort

from fastapi.responses import JSONResponse
from app.core.services.security import rate_limit_service as _rl

RATE_BUCKET = "guest"

class GuestResumeRequest(BaseModel):
    guestCookieToken: Optional[str] = None

class GuestAuthController:
    def __init__(self, guest_auth_port: GuestAuthPort, jwt_port: JwtPort, token_persistence: TokenPersistencePort,
                 test_endpoints_enabled: bool = False, rate_limit_service=None, guest_per_ip: int = 0,
                 csrf_token_service=None):
        self.guest_auth_port = guest_auth_port
        self.jwt_port = jwt_port
        self.token_persistence = token_persistence
        self.test_endpoints_enabled = test_endpoints_enabled
        # v0.37.7 — Step 41: the guest bucket of the rate limiter and the CSRF token issuer
        self.rate_limit_service = rate_limit_service
        self.guest_per_ip = guest_per_ip
        self.csrf_token_service = csrf_token_service
        self.router = APIRouter(prefix="/api/auth/guest")
        self.router.add_api_route("", self.create_guest, methods=["POST"], status_code=status.HTTP_201_CREATED)
        self.router.add_api_route("/resume", self.resume_guest, methods=["POST"])

    def _process_session_response(self, session):
        uuid = session.user_uuid
        username = session.username
        role = "PLAYER" # Guest default

        # 1. Generate JWT tokens
        access_token = self.jwt_port.generate_access_token(uuid, username, role)
        refresh_token = self.jwt_port.generate_refresh_token(uuid)

        # 2. Persist refresh token (Step 13)
        token_info = self.jwt_port.parse_token(refresh_token)
        self.token_persistence.save_refresh_token(uuid, refresh_token, token_info)

        # 3. Create JSON Response
        data = {
            "userUuid": uuid,
            "username": username,
            "role": role,
            "accessToken": access_token,
            "accessTokenExpiresAt": self.jwt_port.get_access_token_expiration_ms(),
            "refreshTokenExpiresAt": self.jwt_port.get_refresh_token_expiration_ms()
        }
        if self.csrf_token_service is not None:
            data["csrfToken"] = self.csrf_token_service.token_for(access_token)
        
        response = JSONResponse(content=data)

        # 4. Set HttpOnly cookies with SameSite=None and Secure=True
        response.set_cookie(
            key="pathsgames.refreshToken",
            value=refresh_token,
            httponly=True,
            samesite="none",
            secure=True,
            path="/",
            max_age=180 * 24 * 60 * 60  # 6 months
        )

        response.set_cookie(
            key="pathsgames.guestcookie",
            value=session.guest_cookie_token,
            httponly=True,
            samesite="none",
            secure=True,
            path="/",
            max_age=180 * 24 * 60 * 60  # 6 months
        )

        return response

    def create_guest(self, request: Request,
                     x_test_marker: Optional[str] = Header(default=None)):
        # The X-Test-Marker header tags the guest as test data so it can be
        # removed by POST /api/dev/cleanup. Honoured only when dev test
        # endpoints are enabled; ignored in production.
        # Step 41 — at most guest_per_ip new guests per source address and window
        if self.rate_limit_service is not None and self.guest_per_ip > 0:
            ip = _rl.client_ip(request.headers.get("X-Forwarded-For"),
                               request.client.host if request.client else None)
            verdict = self.rate_limit_service.try_acquire(RATE_BUCKET, ip, self.guest_per_ip)
            if not verdict.allowed:
                return _rate_limited(verdict, "Too many guest sessions from this address")
        marker = x_test_marker if self.test_endpoints_enabled else None
        session = self.guest_auth_port.create_guest_session(marker)
        response = self._process_session_response(session)
        response.status_code = status.HTTP_201_CREATED
        return response

    def resume_guest(self, request_in: Request, body: Optional[GuestResumeRequest] = None):
        # Step 13: Read from cookie first
        guest_cookie_token = request_in.cookies.get("pathsgames.guestcookie")
        
        # Fallback to body
        if not guest_cookie_token and body:
            guest_cookie_token = body.guestCookieToken

        if not guest_cookie_token:
            raise HTTPException(status_code=400, detail="Missing guestCookieToken (cookie or body)")

        session = self.guest_auth_port.resume_guest_session(guest_cookie_token)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error": "SESSION_EXPIRED_OR_NOT_FOUND",
                    "message": "Guest session expired or not found. Please create a new session."
                }
            )
        return self._process_session_response(session)


def _rate_limited(verdict, what: str) -> JSONResponse:
    import time
    return JSONResponse(
        status_code=429,
        headers={"Retry-After": str(verdict.retry_after_seconds)},
        content={"error": "RATE_LIMITED",
                 "message": f"{what}, retry in {verdict.retry_after_seconds} seconds",
                 "retryAfterSeconds": verdict.retry_after_seconds,
                 "timestamp": int(time.time() * 1000)},
    )
