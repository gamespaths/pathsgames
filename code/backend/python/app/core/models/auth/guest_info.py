from pydantic import BaseModel, Field, ConfigDict
from typing import Optional

class GuestInfo(BaseModel):
    user_uuid: str = Field(..., alias="userUuid")
    username: str
    nickname: Optional[str] = None
    role: str
    state: int
    guest_cookie_token: str = Field(..., alias="guestCookieToken")
    guest_expires_at: Optional[str] = Field(None, alias="guestExpiresAt")
    language: Optional[str] = None
    ts_registration: Optional[str] = Field(None, alias="tsRegistration")
    ts_last_access: Optional[str] = Field(None, alias="tsLastAccess")
    expired: bool = False

    model_config = ConfigDict(populate_by_name=True)
