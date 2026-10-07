"""v0.41.2 — SQLAlchemy adapter of KpiStorePort. Mirrors ``KpiStoreAdapter.java``: one
INSERT ... ON CONFLICT DO UPDATE per counter (SQLite and PostgreSQL dialects), its own session."""
import uuid as uuid_lib
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy.dialects import postgresql, sqlite

from app.adapters.persistence.match.models import GamingMatchEntity, SystemKpiDailyEntity
from app.adapters.persistence.story.models import LocationEntity, StoryEntity
from app.core.ports.match.kpi_ports import KpiDailyRow, KpiStorePort

KPI = SystemKpiDailyEntity.__table__


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def upsert_statement(dialect_name: str, values: dict):
    """The dialect's INSERT ... ON CONFLICT (story_uuid, day, metric, ref_uuid) DO UPDATE value + delta."""
    insert = postgresql.insert if dialect_name == "postgresql" else sqlite.insert
    stmt = insert(KPI).values(**values)
    return stmt.on_conflict_do_update(
        index_elements=["story_uuid", "day", "metric", "ref_uuid"],
        set_={"value": KPI.c.value + stmt.excluded.value, "ts_update": stmt.excluded.ts_update})


class KpiStoreAdapter(KpiStorePort):

    def __init__(self, session_factory) -> None:
        self.session_factory = session_factory

    def increment(self, story_uuid: str, day: str, metric: str, ref_uuid: str, delta: int) -> None:
        now = _now()
        with self.session_factory() as session:
            session.execute(upsert_statement(session.get_bind().dialect.name, {
                "uuid": str(uuid_lib.uuid4()), "story_uuid": story_uuid, "day": day, "metric": metric,
                "ref_uuid": ref_uuid or "", "value": int(delta), "ts_insert": now, "ts_update": now}))
            session.commit()

    def find_rows(self, story_uuid: Optional[str], from_day: str, to_day: str) -> List[KpiDailyRow]:
        with self.session_factory() as session:
            q = session.query(SystemKpiDailyEntity).filter(SystemKpiDailyEntity.day >= from_day,
                                                           SystemKpiDailyEntity.day <= to_day)
            if story_uuid is not None:
                q = q.filter(SystemKpiDailyEntity.story_uuid == story_uuid)
            return [KpiDailyRow(r.story_uuid, r.day, r.metric, r.ref_uuid, int(r.value or 0)) for r in q.all()]

    def find_story_uuid_by_match(self, id_match: int) -> Optional[str]:
        with self.session_factory() as session:
            row = (session.query(StoryEntity.uuid)
                   .join(GamingMatchEntity, GamingMatchEntity.id_story == StoryEntity.id)
                   .filter(GamingMatchEntity.id == id_match).first())
            return row[0] if row else None

    def find_location_uuid(self, id_story: int, id_location: int) -> Optional[str]:
        with self.session_factory() as session:
            row = (session.query(LocationEntity.uuid)
                   .filter(LocationEntity.id == id_location, LocationEntity.id_story == id_story).first())
            return row[0] if row else None
