from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Optional
from app.core.ports.auth.guest_auth_port import GuestAuthPort

class GuestResumeRequest(BaseModel):
    guestCookieToken: str

class GuestAuthController:
    def __init__(self, guest_auth_port: GuestAuthPort):
        self.guest_auth_port = guest_auth_port
        self.router = APIRouter(prefix="/api/auth/guest")
        self.router.add_api_route("", self.create_guest, methods=["POST"], status_code=status.HTTP_201_CREATED)
        self.router.add_api_route("/resume", self.resume_guest, methods=["POST"])

    async def create_guest(self):
        session = self.guest_auth_port.create_guest_session()
        return session.model_dump(by_alias=True)

    async def resume_guest(self, request: GuestResumeRequest):
        session = self.guest_auth_port.resume_guest_session(request.guestCookieToken)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error": "SESSION_EXPIRED_OR_NOT_FOUND",
                    "message": "Guest session expired or not found. Please create a new session."
                }
            )
        return session.model_dump(by_alias=True)
