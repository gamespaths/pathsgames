"""v1.2.0 Google ID token verification with PyJWT + PyJWKClient (Google keys cached in the process, no
client secret) and the test-only fake provider (HS256, kid paths-games-fake-google, test endpoints only)."""
import hashlib
import hmac
import time
import uuid
from typing import Any, Dict, Optional

import jwt

from app.core.models.auth.auth_error import AuthError
from app.core.models.auth.identity import GoogleIdentityClaims
from app.core.ports.auth.google_token_verifier_port import GoogleTokenVerifierPort

GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
FAKE_KID = "paths-games-fake-google"
DEFAULT_ISSUER = "https://accounts.google.com"
DEFAULT_LIFETIME_SECONDS = 3600


def derive_fake_key(jwt_secret: str) -> bytes:
    """HMAC-SHA256(jwtSecret, "paths-games-fake-google"): the same on Java, Python and AWS."""
    return hmac.new(jwt_secret.encode("utf-8"), FAKE_KID.encode("utf-8"), hashlib.sha256).digest()


def _claims(payload: Dict[str, Any]) -> GoogleIdentityClaims:
    aud = payload.get("aud")
    if isinstance(aud, list):
        aud = aud[0] if aud else None
    return GoogleIdentityClaims(
        subject=payload.get("sub"), email=payload.get("email"),
        email_verified=payload.get("email_verified") in (True, "true"),
        name=payload.get("name"), given_name=payload.get("given_name"), family_name=payload.get("family_name"),
        picture=payload.get("picture"), locale=payload.get("locale"), nonce=payload.get("nonce"),
        issuer=payload.get("iss"), audience=aud, expires_at=int(payload.get("exp") or 0),
        issued_at=int(payload.get("iat") or 0))


def _int(value, fallback: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


class FakeGoogleTokens:
    """Test-only provider: mints and verifies ID tokens while the test endpoints are enabled."""

    def __init__(self, enabled: bool, client_id: str, jwt_secret: str):
        self.enabled = enabled
        self.client_id = client_id
        self.key = derive_fake_key(jwt_secret)

    def mint(self, claims: Optional[Dict[str, Any]]) -> str:
        if not self.enabled:
            raise RuntimeError("The fake Google provider is disabled")
        c = dict(claims or {})
        now = int(time.time())
        iat = now + _int(c.pop("iatOffsetSeconds", 0), 0)
        exp = now + _int(c.pop("expOffsetSeconds", DEFAULT_LIFETIME_SECONDS), DEFAULT_LIFETIME_SECONDS)
        c.setdefault("iss", DEFAULT_ISSUER)
        c.setdefault("aud", self.client_id)
        c.setdefault("email_verified", True)
        # each minted token is unique, as Google's are (the replay check keys on the token hash)
        c.setdefault("jti", str(uuid.uuid4()))
        c["iat"] = iat
        c["exp"] = exp
        return jwt.encode(c, self.key, algorithm="HS256", headers={"kid": FAKE_KID})

    @staticmethod
    def is_fake(id_token: Optional[str]) -> bool:
        if not id_token:
            return False
        try:
            return jwt.get_unverified_header(id_token).get("kid") == FAKE_KID
        except jwt.PyJWTError:
            return False

    def verify(self, id_token: str) -> GoogleIdentityClaims:
        """Signature and expiry; aud, iss and nonce are checked by the core service."""
        if not self.enabled:
            raise AuthError("INVALID_TOKEN", "Unknown Google token key")
        try:
            payload = jwt.decode(id_token, self.key, algorithms=["HS256"], options={"verify_aud": False})
        except jwt.PyJWTError:
            raise AuthError("INVALID_TOKEN", "The Google token is invalid or expired")
        return _claims(payload)


class GoogleIdTokenVerifier(GoogleTokenVerifierPort):
    """RS256 Google tokens through the cached JWKS client; a fake token goes to the fake provider."""

    def __init__(self, client_id: str, fake: Optional[FakeGoogleTokens] = None, jwks_client=None):
        self._client_id = client_id
        self.fake = fake
        self._jwks = jwks_client

    @property
    def jwks(self):
        if self._jwks is None:
            # lifespan-long cache of Google's keys (refetched when an unknown kid shows up)
            self._jwks = jwt.PyJWKClient(GOOGLE_JWKS_URL, cache_keys=True, lifespan=3600)
        return self._jwks

    def client_id(self) -> str:
        return self._client_id

    def verify(self, id_token: str) -> GoogleIdentityClaims:
        if self.fake is not None and self.fake.enabled and FakeGoogleTokens.is_fake(id_token):
            return self.fake.verify(id_token)
        if not id_token:
            raise AuthError("INVALID_TOKEN", "The Google token is malformed")
        try:
            key = self.jwks.get_signing_key_from_jwt(id_token)
        except jwt.PyJWKClientConnectionError:
            raise AuthError("PROVIDER_UNAVAILABLE", "Google keys are not reachable")
        except jwt.PyJWTError:
            raise AuthError("INVALID_TOKEN", "The Google token is malformed")
        try:
            payload = jwt.decode(id_token, key.key, algorithms=["RS256"], audience=self._client_id,
                                 issuer=["accounts.google.com", "https://accounts.google.com"], leeway=60)
        except jwt.PyJWTError:
            raise AuthError("INVALID_TOKEN", "The Google token is invalid or expired")
        return _claims(payload)
