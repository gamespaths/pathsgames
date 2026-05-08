"""Step 19 — :class:`UserAccessPort` adapter against the SQLAlchemy users table."""
from typing import Any, Dict, Optional

from app.adapters.persistence.auth.models import User
from app.core.ports.match.match_ports import UserAccessPort


class UserAccessAdapter(UserAccessPort):
    def __init__(self, session_factory):
        self.session_factory = session_factory

    def find_by_uuid(self, user_uuid: str) -> Optional[Dict[str, Any]]:
        if not user_uuid:
            return None
        with self.session_factory() as session:
            entity = session.query(User).filter(User.uuid == user_uuid).first()
            if entity is None:
                return None
            return {
                "id": entity.id,
                "uuid": entity.uuid,
                "username": entity.username,
                "role": entity.role,
                "state": entity.state,
            }
