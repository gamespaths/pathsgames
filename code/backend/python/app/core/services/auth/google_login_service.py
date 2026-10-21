"""v1.2.0 POST /api/auth/google: checks the GIS ID token (aud, iss, exp, nonce, replay, verified gmail.com
email, sub + email pair), finds or creates the user, merges the guest (mirror of GoogleLoginService.java)."""
import uuid as uuidlib
from datetime import datetime, timezone
from typing import Callable, Optional

from app.core.models.auth.auth_error import AuthError, UserStates
from app.core.models.auth.identity import (PROVIDER_GOOGLE, AuthenticatedSession, DuplicateUserError,
                                           GoogleIdentityClaims, NewUser, UserIdentity, UserProfile, UserStatus)
from app.core.services.auth import nickname_generator, token_hasher

GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}
ALLOWED_DOMAIN = "gmail.com"
LANGUAGES = {"en", "it"}
CREATE_ATTEMPTS = 5


def check_claims(c: Optional[GoogleIdentityClaims], client_id: Optional[str], expected_nonce: Optional[str],
                 now: datetime) -> None:
    if c is None or not c.subject:
        raise AuthError("INVALID_TOKEN", "The Google token has no subject")
    if not client_id or client_id != c.audience:
        raise AuthError("INVALID_TOKEN", "The Google token audience is wrong")
    if c.issuer not in GOOGLE_ISSUERS:
        raise AuthError("INVALID_TOKEN", "The Google token issuer is wrong")
    if c.expires_at <= int(now.timestamp()):
        raise AuthError("INVALID_TOKEN", "The Google token is expired")
    if expected_nonce is not None and expected_nonce != c.nonce:
        raise AuthError("INVALID_NONCE", "The login nonce does not match")


def check_email(c: GoogleIdentityClaims) -> str:
    """The lowercase email of a verified gmail.com account; nothing is written before this passes."""
    if not c.email_verified or not c.email or not c.email.strip():
        raise AuthError("EMAIL_NOT_VERIFIED", "The Google email is not verified")
    email = c.email.strip().lower()
    at = email.rfind("@")
    if at <= 0 or email[at + 1:] != ALLOWED_DOMAIN:
        raise AuthError("EMAIL_DOMAIN_NOT_ALLOWED", "Only Gmail accounts are accepted")
    return email


def language(preferred: Optional[str], locale: Optional[str]) -> str:
    """The device preference, else the Google locale, else English."""
    if preferred and preferred.strip().lower() in LANGUAGES:
        return preferred.strip().lower()
    if locale and len(locale) >= 2 and locale[:2].lower() in LANGUAGES:
        return locale[:2].lower()
    return "en"


class GoogleLoginService:
    def __init__(self, verifier, identities, jwt_port, tokens, guests, merge_service, enabled: bool = True,
                 max_tokens_per_user: int = 5, user_state=None,
                 clock: Callable[[], datetime] = lambda: datetime.now(timezone.utc)):
        self.verifier = verifier
        self.identities = identities
        self.jwt_port = jwt_port
        self.tokens = tokens
        self.guests = guests
        self.merge_service = merge_service
        self.enabled = enabled
        self.max_tokens_per_user = max_tokens_per_user
        self.user_state = user_state
        self.clock = clock

    def client_id(self) -> str:
        return self.verifier.client_id()

    def login(self, id_token: Optional[str], nonce: Optional[str], language_pref: Optional[str] = None,
              guest_access_token: Optional[str] = None, guest_cookie_token: Optional[str] = None
              ) -> AuthenticatedSession:
        if not self.enabled:
            raise AuthError("GOOGLE_DISABLED", "Google sign-in is disabled on this server")
        if not id_token or not id_token.strip() or not nonce or not nonce.strip():
            raise AuthError("INVALID_REQUEST", "idToken and nonce are required")
        now = self.clock()
        claims = self.verifier.verify(id_token)
        check_claims(claims, self.verifier.client_id(), nonce, now)
        email = check_email(claims)

        existing = self.identities.find_identity_by_email(PROVIDER_GOOGLE, email)
        if existing is not None:
            known = self._known_user(existing, claims)
        else:
            # A user with this email but no identity yet (an old import): the email identifies it.
            known = self.identities.find_user_by_email(email)
            if known is not None:
                UserStates.require_usable(known.state)
        self._mark_seen(id_token, claims)

        now_iso = now.isoformat()
        profile = UserIdentity.from_google(claims, email, now_iso)
        created = known is None
        if created:
            user = self._create_google_user(claims, email, language(language_pref, claims.locale), now_iso)
        elif existing is not None:
            self.identities.update_identity_profile(existing.id, profile)
            user = known
        else:
            self.identities.create_identity(known.id, profile)
            user = known
        self.identities.update_last_access(user.id)

        merged_guest, cancelled = None, 0
        guest = self._resolve_guest(guest_access_token, guest_cookie_token)
        if guest is not None and guest["id"] != user.id:
            result = self.merge_service.merge(guest["id"], user.id)
            merged_guest = guest["uuid"]
            cancelled = len(result.cancelled_match_ids)
            if self.user_state is not None:
                self.user_state.evict(merged_guest)

        access = self.jwt_port.generate_access_token(user.uuid, user.username, user.role)
        refresh = self.jwt_port.generate_refresh_token(user.uuid)
        refresh_ms = self.jwt_port.get_refresh_token_expiration_ms()
        self.tokens.store_refresh_token(user.id, token_hasher.sha256(refresh),
                                        datetime.fromtimestamp(refresh_ms / 1000, tz=timezone.utc).isoformat())
        self.tokens.enforce_token_limit(user.id, self.max_tokens_per_user)
        return AuthenticatedSession(UserProfile.of(user, profile), access, refresh,
                                    self.jwt_port.get_access_token_expiration_ms(), refresh_ms, created,
                                    merged_guest, cancelled)

    def _known_user(self, identity: UserIdentity, claims: GoogleIdentityClaims) -> UserStatus:
        if claims.subject != identity.subject:
            raise AuthError("IDENTITY_MISMATCH", "This email belongs to another Google account: contact support")
        user = self.identities.find_user_by_id(identity.user_id)
        if user is None:
            raise AuthError("INVALID_TOKEN", "Identity without user")
        UserStates.require_usable(user.state)
        return user

    def _mark_seen(self, id_token: str, claims: GoogleIdentityClaims) -> None:
        expires = datetime.fromtimestamp(claims.expires_at, tz=timezone.utc).isoformat()
        if not self.identities.mark_id_token_seen(token_hasher.sha256(id_token), expires):
            raise AuthError("TOKEN_REPLAYED", "This Google token was already used")

    def _create_google_user(self, claims, email: str, lang: str, now: str) -> UserStatus:
        nick_base = nickname_generator.base(email)
        start = 1
        for _ in range(CREATE_ATTEMPTS):
            user_uuid = str(uuidlib.uuid4())
            nickname = nickname_generator.first_free(nick_base, start, self.identities.nickname_exists, user_uuid)
            new_user = NewUser(user_uuid, "google_" + user_uuid[:8], nickname, email, UserStates.ROLE_PLAYER,
                               UserStates.ACTIVE, lang)
            try:
                user_id = self.identities.create_user(new_user, UserIdentity.from_google(claims, email, now))
                return UserStatus(user_id, user_uuid, new_user.username, nickname, new_user.role, new_user.state, lang)
            except DuplicateUserError as clash:
                if clash.field != "nickname":
                    # A concurrent first login of the same account won the email: use that user.
                    winner = self.identities.find_identity_by_email(PROVIDER_GOOGLE, email)
                    if winner is None:
                        raise AuthError("INVALID_REQUEST", "Concurrent sign-in, retry")
                    return self._known_user(winner, claims)
                start = _suffix_of(nickname, nick_base) + 1
        raise AuthError("NICKNAME_TAKEN", "No free nickname, retry")

    def _resolve_guest(self, guest_access_token: Optional[str], guest_cookie_token: Optional[str]):
        if guest_access_token and self.jwt_port.validate_token(guest_access_token):
            try:
                info = self.jwt_port.parse_token(guest_access_token)
            except ValueError:
                info = None
            if info is not None and info.is_access_token():
                guest = self.identities.find_user_by_uuid(info.user_uuid)
                if guest is not None and guest.is_guest:
                    return {"id": guest.id, "uuid": guest.uuid}
        if guest_cookie_token:
            row = self.guests.find_guest_by_cookie_token(token_hasher.sha256(guest_cookie_token),
                                                         token_hasher.legacy(guest_cookie_token))
            if row and row.get("id") is not None:
                return {"id": row["id"], "uuid": row.get("uuid")}
        return None


def _suffix_of(nickname: str, nick_base: str) -> int:
    if nickname == nick_base:
        return 1
    try:
        return int(nickname[len(nick_base) + 1:])
    except ValueError:
        return nickname_generator.MAX_SUFFIX
