from abc import ABC, abstractmethod
from app.core.models.auth.guest_session import GuestSession
from typing import Optional

class GuestAuthPort(ABC):
    @abstractmethod
    def create_guest_session(self) -> GuestSession:
        """Creates a new anonymous guest user and returns JWT tokens."""
        pass

    @abstractmethod
    def resume_guest_session(self, guest_cookie_token: str) -> Optional[GuestSession]:
        """Resumes an existing guest session using the cookie token."""
        pass

    @abstractmethod
    def cleanup_expired_guest_sessions(self) -> int:
        """Cleans up expired guest sessions from the persistence layer."""
        pass
