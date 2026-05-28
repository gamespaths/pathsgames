from pydantic import BaseModel, Field, ConfigDict
from typing import Optional

class TokenInfo(BaseModel):
    user_uuid: str = Field(..., alias="sub")
    username: str
    role: str = "PLAYER"
    type: str
    iat: int
    exp: int
    jti: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)

    def is_admin(self) -> bool:
        return self.role == "ADMIN"

    def is_access_token(self) -> bool:
        return self.type == "access"

    def is_refresh_token(self) -> bool:
        return self.type == "refresh"
