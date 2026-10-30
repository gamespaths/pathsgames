"""v1.7.0 step 10 — AdminInterventionPort on admin_intervention_log (mirror of AdminInterventionAdapter.java):
one row per admin action (admin uuid, action, target uuid, reason), purged after 24 months."""
import uuid as uuidlib
from datetime import datetime, timezone

from app.adapters.persistence.auth.models import AdminInterventionLog
from app.core.ports.auth.user_admin_ports import AdminInterventionPort


class AdminInterventionAdapter(AdminInterventionPort):
    def __init__(self, session_factory):
        self.session_factory = session_factory

    def record(self, admin_uuid, action, target_uuid, reason) -> None:
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        with self.session_factory() as session:
            session.add(AdminInterventionLog(uuid=str(uuidlib.uuid4()), ts_insert=now,
                                             admin_uuid=admin_uuid if admin_uuid and admin_uuid.strip() else "UNKNOWN",
                                             action=action, target_uuid=target_uuid, reason=reason))
            session.commit()

    def delete_older_than(self, iso_bound: str) -> int:
        with self.session_factory() as session:
            deleted = session.query(AdminInterventionLog).filter(AdminInterventionLog.ts_insert < iso_bound).delete()
            session.commit()
            return deleted
