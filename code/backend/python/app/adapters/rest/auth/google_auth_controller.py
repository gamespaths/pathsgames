"""v1.2.0 POST /api/auth/google: a GIS ID token and its nonce for the usual access token (body) and refresh
cookie; the current guest (bearer or guest cookie) is merged into the Google user."""
from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, Request
from fastapi.responses import JSONResponse

from app.adapters.rest.auth.auth_errors import auth_error_response
from app.adapters.rest.auth.guest_auth_controller import _rate_limited, set_auth_cookie
from app.core.models.auth.auth_error import AuthError
from app.core.services.security import rate_limit_service as _rl

RATE_BUCKET = "google"


def _text(value) -> Optional[str]:
    return value if isinstance(value, str) else None


class GoogleAuthController:
    def __init__(self, google_login_service, rate_limit_service=None, google_per_ip: int = 0,
                 csrf_token_service=None):
        self.service = google_login_service
        self.rate_limit_service = rate_limit_service
        self.google_per_ip = google_per_ip
        self.csrf_token_service = csrf_token_service
        self.router = APIRouter(prefix="/api/auth")
        self.router.add_api_route("/google", self.login, methods=["POST"])

    def login(self, request: Request, body: Optional[Dict[str, Any]] = Body(default=None)):
        if self.rate_limit_service is not None and self.google_per_ip > 0:
            ip = _rl.client_ip(request.headers.get("X-Forwarded-For"),
                               request.client.host if request.client else None)
            verdict = self.rate_limit_service.try_acquire(RATE_BUCKET, ip, self.google_per_ip)
            if not verdict.allowed:
                return _rate_limited(verdict, "Too many sign-in attempts from this address")
        b = body if isinstance(body, dict) else {}
        header = request.headers.get("Authorization") or ""
        bearer = header[7:].strip() if header.startswith("Bearer ") else None
        try:
            session = self.service.login(_text(b.get("idToken")), _text(b.get("nonce")), _text(b.get("language")),
                                         bearer, request.cookies.get("pathsgames.guestcookie"))
        except AuthError as e:
            return auth_error_response(e)
        data = session.profile.to_body()
        data.update({
            "accessToken": session.access_token,
            "accessTokenExpiresAt": session.access_token_expires_at,
            "refreshTokenExpiresAt": session.refresh_token_expires_at,
            "csrfToken": (self.csrf_token_service.token_for(session.access_token)
                          if self.csrf_token_service is not None else None),
            "newUser": session.new_user,
            "mergedGuest": session.merged_guest_uuid is not None,
            "cancelledMatches": session.cancelled_matches,
            "cancelledMatchUuids": list(session.cancelled_match_uuids),
        })
        response = JSONResponse(content=data)
        set_auth_cookie(response, "pathsgames.refreshToken", session.refresh_token)
        if session.merged_guest_uuid is not None:
            response.delete_cookie(key="pathsgames.guestcookie", path="/")
        return response
