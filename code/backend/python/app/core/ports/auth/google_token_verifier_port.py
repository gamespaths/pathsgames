"""v1.2.0 checks a Google ID token signature and reads its claims; raises AuthError INVALID_TOKEN or
PROVIDER_UNAVAILABLE (JWKS fetch failure)."""
from abc import ABC, abstractmethod

from app.core.models.auth.identity import GoogleIdentityClaims


class GoogleTokenVerifierPort(ABC):
    @abstractmethod
    def verify(self, id_token: str) -> GoogleIdentityClaims: ...

    @abstractmethod
    def client_id(self) -> str: ...
