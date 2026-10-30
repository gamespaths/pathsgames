"""v1.2.0 profile of GET /api/auth/me, DELETE /api/auth/me (fresh Google token, state 7) and the chunked,
idempotent jobs: deletion of state-7 users and the 24-month inactivity retirement."""
import logging
from datetime import datetime, timedelta, timezone
from typing import Callable, List, Optional

from app.core.models.auth.auth_error import AuthError, UserStates
from app.core.models.auth.identity import PROVIDER_GOOGLE, UserIdentity, UserProfile
from app.core.models.auth.profile import (DEFAULT_LANGUAGES, DEFAULT_THEMES, THEME_DEFAULT, UserPreferences,
                                          UserStats)
from app.core.models.match import match_statuses
from app.core.services.auth import token_hasher
from app.core.services.auth.google_login_service import check_claims, check_email

logger = logging.getLogger(__name__)
FRESH_TOKEN_SECONDS = 300
DEFAULT_CHUNK = 100
DEFAULT_RETENTION_MONTHS = 24


def months_ago(now: datetime, months: int) -> datetime:
    """The same day-of-month ``months`` earlier (clamped to the month length)."""
    year, month = divmod(now.year * 12 + now.month - 1 - months, 12)
    month += 1
    for day in (now.day, 30, 29, 28):
        try:
            return now.replace(year=year, month=month, day=day)
        except ValueError:
            continue
    return now.replace(year=year, month=month, day=28)  # pragma: no cover


class AccountService:
    def __init__(self, identities, verifier, tokens, matches, user_state, chunk: int = DEFAULT_CHUNK,
                 retention_months: int = DEFAULT_RETENTION_MONTHS,
                 clock: Callable[[], datetime] = lambda: datetime.now(timezone.utc)):
        self.identities = identities
        self.verifier = verifier
        self.tokens = tokens
        self.matches = matches
        self.user_state = user_state
        self.chunk = chunk if chunk > 0 else DEFAULT_CHUNK
        self.retention_months = retention_months if retention_months > 0 else DEFAULT_RETENTION_MONTHS
        self.clock = clock
        self.languages = list(DEFAULT_LANGUAGES)
        self.themes = list(DEFAULT_THEMES)

    def configure_preferences(self, languages: Optional[List[str]], themes: Optional[List[str]]) -> None:
        """v1.7.0 the supported-languages and supported-themes lists; None or empty keeps the default."""
        self.languages = list(languages) if languages else list(DEFAULT_LANGUAGES)
        self.themes = list(themes) if themes else list(DEFAULT_THEMES)

    def _google_identity(self, user_id: int) -> Optional[UserIdentity]:
        for identity in self.identities.find_identities_of_user(user_id):
            if identity.provider == PROVIDER_GOOGLE:
                return identity
        return None

    def profile(self, user_uuid: str) -> Optional[UserProfile]:
        user = self.identities.find_user_by_uuid(user_uuid)
        if user is None:
            return None
        return UserProfile.of(user, self._google_identity(user.id))

    def stats(self, user_uuid: str) -> UserStats:
        """v1.7.0 the statistics of the matches the user created, computed on the fly."""
        user = self.identities.find_user_by_uuid(user_uuid)
        if user is None:
            return UserStats()
        return UserStats.of(self.matches.totals_by_status(user.id, match_statuses.PLAYED))

    def preferences(self, user_uuid: str) -> Optional[UserPreferences]:
        user = self.identities.find_user_by_uuid(user_uuid)
        if user is None:
            return None
        return UserPreferences(user.language, self.identities.find_theme_selected(user.id) or THEME_DEFAULT)

    def update_preferences(self, user_uuid: str, language: Optional[str], theme: Optional[str]) -> UserPreferences:
        """v1.7.0 PATCH /api/auth/me: a None field is left unchanged; guests are refused."""
        user = self.identities.find_user_by_uuid(user_uuid)
        if user is None:
            raise AuthError("INVALID_TOKEN", "Unknown user")
        if user.is_guest:
            raise AuthError("GOOGLE_ACCOUNT_REQUIRED", "Sign in with Google to keep preferences in the profile")
        if language is None and theme is None:
            raise AuthError("INVALID_REQUEST", "Nothing to update")
        if language is not None and language not in self.languages:
            raise AuthError("INVALID_REQUEST", f"Unsupported language: {language}")
        if theme is not None and theme not in self.themes:
            raise AuthError("INVALID_REQUEST", f"Unsupported theme: {theme}")
        self.identities.update_preferences(user.id, language, theme)
        self.user_state.evict(user.uuid)
        current = self.identities.find_theme_selected(user.id) or THEME_DEFAULT
        return UserPreferences(language if language is not None else user.language,
                               theme if theme is not None else current)

    def request_deletion(self, user_uuid: str, id_token: Optional[str], nonce: Optional[str]) -> None:
        if not id_token or not id_token.strip():
            raise AuthError("FRESH_TOKEN_REQUIRED", "A fresh Google sign-in is required")
        user = self.identities.find_user_by_uuid(user_uuid)
        if user is None:
            raise AuthError("INVALID_TOKEN", "Unknown user")
        UserStates.require_usable(user.state)
        identity = self._google_identity(user.id)
        if identity is None:
            raise AuthError("NOT_A_GOOGLE_ACCOUNT", "Only Google accounts can be deleted")
        now = self.clock()
        claims = self.verifier.verify(id_token)
        check_claims(claims, self.verifier.client_id(), nonce if nonce and nonce.strip() else None, now)
        if int(now.timestamp()) - claims.issued_at > FRESH_TOKEN_SECONDS:
            raise AuthError("FRESH_TOKEN_REQUIRED", "Sign in with Google again")
        email = check_email(claims)
        if identity.subject != claims.subject or identity.email != email:
            raise AuthError("IDENTITY_MISMATCH", "The Google account is not this user")
        expires = datetime.fromtimestamp(claims.expires_at, tz=timezone.utc).isoformat()
        if not self.identities.mark_id_token_seen(token_hasher.sha256(id_token), expires):
            raise AuthError("TOKEN_REPLAYED", "This Google token was already used")
        self.identities.update_state(user.id, UserStates.DELETING)
        self.tokens.revoke_all_by_user_id(user.id)
        self.user_state.evict(user.uuid)

    def run_deletion_job(self) -> int:
        ids: List[int] = self.identities.find_user_ids_by_state(UserStates.DELETING, self.chunk)
        for user_id in ids:
            # Matches first (the creator FK), then identities, tokens and the user: a rerun resumes here.
            self.matches.delete_matches_by_user_creator_ids([user_id])
            self.identities.delete_user_fully(user_id)
        self.identities.delete_expired_id_tokens(self.clock().isoformat())
        if ids:
            logger.info("[ACCOUNT DELETION] %d users removed", len(ids))
        return len(ids)

    def retire_inactive_users(self) -> int:
        bound = months_ago(self.clock(), self.retention_months).isoformat()
        ids = self.identities.find_inactive_identity_user_ids(bound, self.chunk)
        for user_id in ids:
            self.identities.update_state(user_id, UserStates.DELETING)
            user = self.identities.find_user_by_id(user_id)
            if user is not None:
                self.user_state.evict(user.uuid)
        return len(ids)
