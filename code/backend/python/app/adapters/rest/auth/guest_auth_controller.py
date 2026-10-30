from fastapi import APIRouter, HTTPException, status, Request, Response, Header
from pydantic import BaseModel
from typing import Optional
from app.core.ports.auth.guest_auth_port import GuestAuthPort
from app.core.ports.auth.jwt_port import JwtPort
from app.core.ports.auth.token_persistence_port import TokenPersistencePort

from fastapi.responses import JSONResponse

RATE_BUCKET = "guest"
#: v0.41.0 — dev/test only, honoured with a valid X-Test-Marker: an N-days-old guest.
AGE_HEADER = "X-Test-Guest-Age-Days"

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
        # v1.2.0 the tokens issued (and stored as hash) by the service, never a second pair
        data = {
            "userUuid": session.user_uuid,
            "username": session.username,
            "role": "PLAYER",
            "accessToken": session.access_token,
            "accessTokenExpiresAt": session.access_token_expires_at,
            "refreshTokenExpiresAt": session.refresh_token_expires_at
        }
        if self.csrf_token_service is not None:
            data["csrfToken"] = self.csrf_token_service.token_for(session.access_token)
        response = JSONResponse(content=data)
        set_auth_cookie(response, "pathsgames.refreshToken", session.refresh_token)
        set_auth_cookie(response, "pathsgames.guestcookie", session.guest_cookie_token)
        return response

    def create_guest(self, request: Request,
                     x_test_marker: Optional[str] = Header(default=None)):
        # The X-Test-Marker header tags the guest as test data so it can be
        # removed by POST /api/dev/cleanup. Honoured only when dev test
        # endpoints are enabled; ignored in production.
        # Step 41 — at most guest_per_ip new guests per source address and window
        if self.rate_limit_service is not None and self.guest_per_ip > 0:
            ip = self.rate_limit_service.client_ip_of(request.headers.get("X-Forwarded-For"),
                                                      request.client.host if request.client else None)
            verdict = self.rate_limit_service.try_acquire(RATE_BUCKET, ip, self.guest_per_ip)
            if not verdict.allowed:
                return _rate_limited(verdict, "Too many guest sessions from this address")
        marker = x_test_marker if self.test_endpoints_enabled else None
        age = _parse_age(request.headers.get(AGE_HEADER)) if self.test_endpoints_enabled else None
        if age is None:
            session = self.guest_auth_port.create_guest_session(marker)
        else:
            session = self.guest_auth_port.create_guest_session(marker, age)
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


REFRESH_COOKIE = "pathsgames.refreshToken"
#: v1.7.0 the refresh cookie lives 250 days (renewed at each refresh), the guest cookie 180 days
REFRESH_COOKIE_MAX_AGE = 250 * 24 * 60 * 60
GUEST_COOKIE_MAX_AGE = 180 * 24 * 60 * 60
_SAME_SITE_VALUES = ("lax", "strict", "none")


def same_site(value: Optional[str] = None) -> str:
    """v1.7.0 COOKIE_SAME_SITE (default lax; none only when the API is not on the same site as the page)."""
    from app.config import settings
    chosen = (value if value is not None else settings.cookie_same_site or "").strip().lower()
    return chosen if chosen in _SAME_SITE_VALUES else "lax"


#: v1.11.0 like Java and AWS: the auth cookies are sent only to /api/auth/**; "/" was the Python path until 1.10.0
COOKIE_PATH = "/api/auth"
LEGACY_COOKIE_PATH = "/"


def set_auth_cookie(response, key: str, value: str) -> None:
    """HttpOnly, Secure, SameSite from the settings; refresh cookie 250 days, guest cookie 180 days.
    v1.11.0 the copy a browser still keeps on the old "/" path is deleted, so only one cookie of the name is sent."""
    max_age = REFRESH_COOKIE_MAX_AGE if key == REFRESH_COOKIE else GUEST_COOKIE_MAX_AGE
    response.delete_cookie(key=key, path=LEGACY_COOKIE_PATH)
    response.set_cookie(key=key, value=value, httponly=True, samesite=same_site(), secure=True, path=COOKIE_PATH,
                        max_age=max_age)


def clear_auth_cookie(response, key: str) -> None:
    """v1.11.0 the cookie removed on the current path and on the legacy "/" one."""
    response.delete_cookie(key=key, path=COOKIE_PATH)
    response.delete_cookie(key=key, path=LEGACY_COOKIE_PATH)


def _parse_age(raw: Optional[str]) -> Optional[int]:
    """A number or nothing: a malformed header is ignored, never an error."""
    if raw is None or not raw.strip():
        return None
    try:
        return int(raw.strip())
    except ValueError:
        return None


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
