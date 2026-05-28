from abc import ABC, abstractmethod
from app.core.models.auth.guest_session import GuestSession
from typing import Optional

class GuestAuthPort(ABC):
    @abstractmethod
    def create_guest_session(self, test_marker: Optional[str] = None) -> GuestSession:
        """Creates a new anonymous guest user and returns JWT tokens.

        When ``test_marker`` is provided (and non-blank) the generated username
        is prefixed with the sanitized marker instead of ``guest_``, so the
        guest can later be removed by the dev-only test-data cleanup."""
        pass

    @abstractmethod
    def resume_guest_session(self, guest_cookie_token: str) -> Optional[GuestSession]:
        """Resumes an existing guest session using the cookie token."""
        pass

    @abstractmethod
    def cleanup_expired_guest_sessions(self) -> int:
        """Cleans up expired guest sessions from the persistence layer."""
        pass
