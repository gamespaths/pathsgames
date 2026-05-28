from pydantic import BaseModel, Field, ConfigDict

class RefreshedSession(BaseModel):
    user_uuid: str = Field(..., alias="userUuid")
    username: str
    role: str
    access_token: str = Field(..., alias="accessToken")
    refresh_token: str = Field(..., alias="refreshToken")
    access_token_expires_at: int = Field(..., alias="accessTokenExpiresAt")
    refresh_token_expires_at: int = Field(..., alias="refreshTokenExpiresAt")

    model_config = ConfigDict(populate_by_name=True)
