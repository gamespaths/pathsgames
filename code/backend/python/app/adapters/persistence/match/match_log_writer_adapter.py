"""v0.41.1 — SQLAlchemy adapter of MatchLogWriterPort. Mirrors ``MatchLogWriterAdapter.java``:
log_events rows and the per-match row count behind the admin logCount and the log-size WARN."""
import logging
import uuid as uuid_lib
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func

from app.adapters.persistence.match.log_ids import next_log_id
from app.adapters.persistence.match.models import (
    LogChoicesExecutedEntity, LogClockHistoryEntity, LogEventsEntity, LogItemUsageEntity,
    LogMovementEntity, LogWeatherEntity,
)
from app.core.ports.match.log_writer_ports import MatchLogWriterPort

logger = logging.getLogger(__name__)

LOG_ENTITIES = (LogEventsEntity, LogMovementEntity, LogItemUsageEntity, LogWeatherEntity,
                LogClockHistoryEntity, LogChoicesExecutedEntity)


class MatchLogWriterAdapter(MatchLogWriterPort):

    def __init__(self, session_factory, warn_rows: int = 5000) -> None:
        self.session_factory = session_factory
        self.warn_rows = int(warn_rows or 0)
        self._warned = set()

    def write(self, id_match: int, id_character: Optional[int], id_event: Optional[int],
              clock: int, message: str) -> None:
        with self.session_factory() as session:
            now = datetime.now(timezone.utc).isoformat()
            session.add(LogEventsEntity(
                id=next_log_id(session, LogEventsEntity), id_match=id_match,
                uuid=str(uuid_lib.uuid4()), id_character_match=id_character, id_event=id_event,
                clock=clock, log_message=message, timestamp=now, ts_insert=now, ts_update=now))
            session.commit()

    def count_rows(self, id_match: int) -> int:
        with self.session_factory() as session:
            count = sum(int(session.query(func.count(e.id)).filter(e.id_match == id_match).scalar() or 0)
                        for e in LOG_ENTITIES)
        if self.warn_rows > 0 and count >= self.warn_rows and id_match not in self._warned:
            self._warned.add(id_match)
            logger.warning("LOG_SIZE match %s has %s log rows (warn threshold %s)",
                           id_match, count, self.warn_rows)
        return count
