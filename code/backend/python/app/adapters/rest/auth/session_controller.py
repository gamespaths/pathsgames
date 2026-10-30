from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, Request, Response, HTTPException, status
from fastapi.responses import JSONResponse
from app.adapters.rest.auth.auth_errors import auth_error_response
from app.adapters.rest.auth.guest_auth_controller import clear_auth_cookie, set_auth_cookie
from app.core.models.auth.auth_error import AuthError
from app.core.models.auth.profile import THEME_DEFAULT, THEME_HIGH_CONTRAST
from app.core.ports.auth.session_port import SessionPort
from app.core.services.security import csrf_token_service as _csrf
import time


def _bearer_of(request: Request) -> Optional[str]:
    header = request.headers.get("Authorization") or ""
    return header[7:].strip() if header.startswith("Bearer ") else None


def _error(code: str, message: str, status_code: int) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": code, "message": message,
                                                         "timestamp": int(time.time() * 1000)})

class SessionController:
    def __init__(self, session_service: SessionPort, csrf_token_service=None, account_service=None):
        self.router = APIRouter()
        self.session_service = session_service
        # v0.37.7 — a refreshed access token comes with the CSRF token that goes with it
        self.csrf_token_service = csrf_token_service
        # v1.2.0 — the profile of GET /me and the account deletion of DELETE /me
        self.account_service = account_service
        self._setup_routes()

    def _setup_routes(self):
        self.router.add_api_route("/me", self.me, methods=["GET"])
        self.router.add_api_route("/me", self.delete_me, methods=["DELETE"], status_code=202)
        self.router.add_api_route("/me", self.update_me, methods=["PATCH"])
        self.router.add_api_route("/refresh", self.refresh, methods=["POST"])
        self.router.add_api_route("/logout", self.logout, methods=["POST"])
        self.router.add_api_route("/logout/all", self.logout_all, methods=["POST"])

    def me(self, request: Request):
        # Data populated by JwtMiddleware
        user_uuid = getattr(request.state, "user_uuid", None)
        username = getattr(request.state, "username", None)
        role = getattr(request.state, "role", None)

        if not user_uuid:
            raise HTTPException(status_code=401, detail="Not authenticated")
        return self._me_body(request, user_uuid, username, role)

    def _me_body(self, request: Request, user_uuid: str, username=None, role=None) -> dict:
        """The body of GET and PATCH /me: profile, v1.7.0 preferences and statistics, CSRF token."""
        profile = self.account_service.profile(user_uuid) if self.account_service is not None else None
        if profile is not None:
            # v1.2.0 nickname, displayName, pictureUrl and the account type, read from the DB
            body = profile.to_body()
            body["timestamp"] = int(time.time() * 1000)
        else:
            body = {
                "userUuid": user_uuid,
                "username": username,
                "role": role,
                "timestamp": int(time.time() * 1000)
            }
        # v1.7.0 the sessions used in the last 30 days, shown next to "Log out of all devices"
        active = self.session_service.active_sessions(user_uuid)
        body["activeSessions"] = active if isinstance(active, int) else 0
        if self.account_service is not None:
            preferences = self.account_service.preferences(user_uuid)
            if preferences is not None:
                body["preferences"] = preferences.to_body()
            body["stats"] = self.account_service.stats(user_uuid).to_body()
        # v0.37.7 — the CSRF token of this bearer, so a client that lost it need not log in again
        if self.csrf_token_service is not None:
            body["csrfToken"] = self.csrf_token_service.token_for(_bearer_of(request))
        return body

    def update_me(self, request: Request, body: Optional[Dict[str, Any]] = Body(default=None)):
        """v1.7.0 PATCH /me {language?, highContrast?, theme?}: CSRF header, guests refused, values checked."""
        user_uuid = getattr(request.state, "user_uuid", None)
        if not user_uuid or self.account_service is None:
            return _error("UNAUTHORIZED", "Valid access token required", 401)
        if self.csrf_token_service is not None and self.csrf_token_service.enforced:
            presented = request.headers.get(_csrf.HEADER)
            if not presented or not presented.strip():
                return _error("CSRF_TOKEN_MISSING", f"{_csrf.HEADER} header is required to change the profile", 403)
            if not self.csrf_token_service.matches(_bearer_of(request), presented):
                return _error("CSRF_TOKEN_INVALID", f"{_csrf.HEADER} does not match the access token", 403)
        b = body if isinstance(body, dict) else {}
        language, high_contrast, theme = b.get("language"), b.get("highContrast"), b.get("theme")
        if (language is not None and not isinstance(language, str)) or (theme is not None and not isinstance(theme, str)) \
                or (high_contrast is not None and not isinstance(high_contrast, bool)):
            return _error("INVALID_REQUEST", "language and theme must be strings, highContrast a boolean", 400)
        if theme is None and high_contrast is not None:
            theme = THEME_HIGH_CONTRAST if high_contrast else THEME_DEFAULT
        try:
            self.account_service.update_preferences(user_uuid, language, theme)
        except AuthError as e:
            return auth_error_response(e)
        return self._me_body(request, user_uuid)

    def refresh(self, request: Request):
        # 1. Get refresh token from HttpOnly cookie
        refresh_token = request.cookies.get("pathsgames.refreshToken")

        if not refresh_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token cookie is missing"
            )

        # 2. Perform refresh with rotation
        try:
            refreshed = self.session_service.refresh_session(refresh_token)
        except AuthError as e:
            # v1.2.0 SESSION_REVOKED (closed from another device) or a disabled / deleting account
            response = auth_error_response(e)
            clear_auth_cookie(response, "pathsgames.refreshToken")
            return response
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"error": "INVALID_REFRESH_TOKEN", "message": str(e)}
            )

        # 3. Create JSON response
        data = refreshed.model_dump(by_alias=True, exclude={"refresh_token"})
        if self.csrf_token_service is not None:
            data["csrfToken"] = self.csrf_token_service.token_for(refreshed.access_token)
        response = JSONResponse(content=data)

        # 4. Set new HttpOnly rotated refresh token (v1.7.0 250 days, sliding)
        set_auth_cookie(response, "pathsgames.refreshToken", refreshed.refresh_token)

        return response

    def logout(self, request: Request):
        refresh_token = request.cookies.get("pathsgames.refreshToken")
        if refresh_token:
            self.session_service.logout(refresh_token)

        # Create Response
        response = JSONResponse(content={"status": "OK", "message": "Logged out successfully", "timestamp": int(time.time() * 1000)})

        # Clear cookies
        clear_auth_cookie(response, "pathsgames.refreshToken")
        clear_auth_cookie(response, "pathsgames.guestcookie")

        return response

    def logout_all(self, request: Request):
        user_uuid = getattr(request.state, "user_uuid", None)
        if user_uuid:
            self.session_service.logout_all(user_uuid)

        # Create Response
        response = JSONResponse(content={"status": "OK", "message": "All sessions revoked successfully", "timestamp": int(time.time() * 1000)})

        # Clear cookies
        clear_auth_cookie(response, "pathsgames.refreshToken")
        clear_auth_cookie(response, "pathsgames.guestcookie")

        return response

    def delete_me(self, request: Request, body: Optional[Dict[str, Any]] = Body(default=None)):
        """v1.2.0 account deletion: a Google ID token issued less than 5 minutes ago; state 7, 202."""
        user_uuid = getattr(request.state, "user_uuid", None)
        if not user_uuid or self.account_service is None:
            raise HTTPException(status_code=401, detail={"error": "UNAUTHORIZED",
                                                         "message": "Valid access token required"})
        b = body if isinstance(body, dict) else {}
        id_token = b.get("idToken") if isinstance(b.get("idToken"), str) else None
        nonce = b.get("nonce") if isinstance(b.get("nonce"), str) else None
        try:
            self.account_service.request_deletion(user_uuid, id_token, nonce)
        except AuthError as e:
            return auth_error_response(e)
        response = JSONResponse(status_code=202, content={
            "status": "DELETING", "message": "The account and its data are being deleted",
            "timestamp": int(time.time() * 1000)})
        clear_auth_cookie(response, "pathsgames.refreshToken")
        clear_auth_cookie(response, "pathsgames.guestcookie")
        return response
