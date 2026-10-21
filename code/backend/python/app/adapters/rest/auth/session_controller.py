from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, Request, Response, HTTPException, status
from fastapi.responses import JSONResponse
from app.adapters.rest.auth.auth_errors import auth_error_response
from app.core.models.auth.auth_error import AuthError
from app.core.ports.auth.session_port import SessionPort
import time

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
        # v0.37.7 — the CSRF token of this bearer, so a client that lost it need not log in again
        if self.csrf_token_service is not None:
            header = request.headers.get("Authorization") or ""
            bearer = header[7:].strip() if header.startswith("Bearer ") else None
            body["csrfToken"] = self.csrf_token_service.token_for(bearer)
        return body

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
            response.delete_cookie(key="pathsgames.refreshToken", path="/")
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

        # 4. Set new HttpOnly rotated refresh token
        response.set_cookie(
            key="pathsgames.refreshToken",
            value=refreshed.refresh_token,
            httponly=True,
            samesite="none",
            secure=True,
            path="/",
            max_age=180 * 24 * 60 * 60  # 6 months
        )

        return response

    def logout(self, request: Request):
        refresh_token = request.cookies.get("pathsgames.refreshToken")
        if refresh_token:
            self.session_service.logout(refresh_token)

        # Create Response
        response = JSONResponse(content={"status": "OK", "message": "Logged out successfully", "timestamp": int(time.time() * 1000)})

        # Clear cookies
        response.delete_cookie(key="pathsgames.refreshToken", path="/")
        response.delete_cookie(key="pathsgames.guestcookie", path="/")

        return response

    def logout_all(self, request: Request):
        user_uuid = getattr(request.state, "user_uuid", None)
        if user_uuid:
            self.session_service.logout_all(user_uuid)

        # Create Response
        response = JSONResponse(content={"status": "OK", "message": "All sessions revoked successfully", "timestamp": int(time.time() * 1000)})

        # Clear cookies
        response.delete_cookie(key="pathsgames.refreshToken", path="/")
        response.delete_cookie(key="pathsgames.guestcookie", path="/")

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
        response.delete_cookie(key="pathsgames.refreshToken", path="/")
        response.delete_cookie(key="pathsgames.guestcookie", path="/")
        return response
