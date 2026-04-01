from pydantic import BaseModel, Field, ConfigDict
from typing import Optional

class GuestSession(BaseModel):
    user_uuid: str = Field(..., alias="userUuid")
    username: str
    access_token: str = Field(..., alias="accessToken")
    refresh_token: str = Field(..., alias="refreshToken")
    access_token_expires_at: int = Field(..., alias="accessTokenExpiresAt")
    refresh_token_expires_at: int = Field(..., alias="refreshTokenExpiresAt")
    guest_cookie_token: str = Field(..., alias="guestCookieToken")

    model_config = ConfigDict(populate_by_name=True)
