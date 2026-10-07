"""v0.38.1 — the log_* id allocation: PostgreSQL sequence or MAX(id) + 1, and the
startup alignment of the sequences."""
from unittest.mock import MagicMock, call

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.adapters.persistence.auth.models import Base
from app.adapters.persistence.match.log_ids import (
    LOG_TABLES, align_log_sequences, next_log_id, sequence_name)
from app.adapters.persistence.match.models import LogEventsEntity, LogMovementEntity
import app.adapters.persistence.match.models  # noqa: F401  registers the gaming_* tables
import app.adapters.persistence.story.models  # noqa: F401  registers the list_* tables


@pytest.fixture()
def session_factory():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    yield factory
    engine.dispose()


def _pg_session(scalar):
    session = MagicMock()
    session.get_bind.return_value.dialect.name = "postgresql"
    session.execute.return_value.scalar.return_value = scalar
    return session


def test_sequence_name_is_the_bigserial_one():
    assert sequence_name("log_events") == "log_events_id_seq"
    assert [sequence_name(t) for t in LOG_TABLES] == [f"{t}_id_seq" for t in LOG_TABLES]


def test_sqlite_takes_max_plus_one(session_factory):
    with session_factory() as session:
        assert next_log_id(session, LogEventsEntity) == 1
        session.add(LogEventsEntity(id=41, id_match=1, uuid="u-41", log_message="x",
                                    ts_insert="t", ts_update="t"))
        session.flush()
        assert next_log_id(session, LogEventsEntity) == 42
        # the other tables have their own counter
        assert next_log_id(session, LogMovementEntity) == 1


def test_postgres_takes_the_table_sequence():
    session = _pg_session(42)

    assert next_log_id(session, LogEventsEntity) == 42

    sql = str(session.execute.call_args.args[0])
    assert sql == "SELECT nextval('log_events_id_seq')"
    session.query.assert_not_called()


def test_postgres_sequence_follows_the_entity_table():
    session = _pg_session(7)

    assert next_log_id(session, LogMovementEntity) == 7

    assert "log_movements_id_seq" in str(session.execute.call_args.args[0])


def test_align_log_sequences_is_a_no_op_off_postgres():
    engine = create_engine("sqlite:///:memory:")

    assert align_log_sequences(engine) == []


def test_align_log_sequences_creates_and_moves_every_sequence():
    bind = MagicMock()
    bind.dialect.name = "postgresql"
    connection = bind.begin.return_value.__enter__.return_value

    statements = align_log_sequences(bind)

    assert len(statements) == 2 * len(LOG_TABLES)
    assert statements[0] == "CREATE SEQUENCE IF NOT EXISTS log_events_id_seq OWNED BY log_events.id"
    assert statements[1] == ("SELECT setval('log_events_id_seq', "
                             "COALESCE((SELECT MAX(id) FROM log_events), 0) + 1, false)")
    executed = [str(c.args[0]) for c in connection.execute.call_args_list]
    assert executed == statements
