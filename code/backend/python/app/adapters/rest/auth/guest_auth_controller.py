from fastapi import APIRouter, HTTPException, status, Request, Response
from pydantic import BaseModel
from typing import Optional
from app.core.ports.auth.guest_auth_port import GuestAuthPort
from app.core.ports.auth.jwt_port import JwtPort
from app.core.ports.auth.token_persistence_port import TokenPersistencePort

from fastapi.responses import JSONResponse

class GuestResumeRequest(BaseModel):
    guestCookieToken: Optional[str] = None

class GuestAuthController:
    def __init__(self, guest_auth_port: GuestAuthPort, jwt_port: JwtPort, token_persistence: TokenPersistencePort):
        self.guest_auth_port = guest_auth_port
        self.jwt_port = jwt_port
        self.token_persistence = token_persistence
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
        
        response = JSONResponse(content=data)

        # 4. Set HttpOnly cookies with SameSite=None and Secure=True
        response.set_cookie(
            key="pathsgames.refreshToken",
            value=refresh_token,
            httponly=True,
            samesite="none",
            secure=True,
            path="/",
            max_age=7 * 24 * 60 * 60  # 7 days
        )

        response.set_cookie(
            key="pathsgames.guestcookie",
            value=session.guest_cookie_token,
            httponly=True,
            samesite="none",
            secure=True,
            path="/",
            max_age=30 * 24 * 60 * 60  # 30 days
        )

        return response

    def create_guest(self, request: Request):
        session = self.guest_auth_port.create_guest_session()
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
