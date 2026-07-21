"""Step 30 — the SQLAlchemy edge-state store adapter.

Exercises :class:`EdgeStateStoreAdapter` against an in-memory SQLite database: the
coma/sleeping flags, the coma clear and the append-only edge-state log.
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.adapters.persistence.auth.models import Base
from app.adapters.persistence.match.models import (
    GamingCharacterInstanceEntity, LogEventsEntity,
)
from app.adapters.persistence.match.edge_state_store_adapter import EdgeStateStoreAdapter
import app.adapters.persistence.match.models  # noqa: F401  registers gaming_* tables

_NOW = "2024-01-01T00:00:00"


@pytest.fixture()
def session_factory():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    yield factory
    engine.dispose()


@pytest.fixture()
def adapter(session_factory):
    return EdgeStateStoreAdapter(session_factory)


def _seed_character(session_factory, **overrides):
    fields = dict(id=3, id_match=1, uuid="char-uuid", id_user=7, id_character_template=1,
                  life=10, energy=5, is_sleeping=0, is_coma=0, clock_in_coma=0,
                  ts_insert=_NOW, ts_update=_NOW)
    fields.update(overrides)
    with session_factory() as s:
        s.add(GamingCharacterInstanceEntity(**fields))
        s.commit()


def _character(session_factory):
    with session_factory() as s:
        return s.query(GamingCharacterInstanceEntity).filter_by(id=3, id_match=1).one()


def test_set_coma_also_puts_the_character_to_sleep(session_factory, adapter):
    _seed_character(session_factory)

    adapter.set_coma(1, 3, 12)

    c = _character(session_factory)
    assert c.is_coma == 1
    assert c.is_sleeping == 1
    assert c.clock_in_coma == 12
    assert c.ts_update != _NOW


def test_set_coma_missing_character_is_a_no_op(session_factory, adapter):
    adapter.set_coma(1, 3, 12)

    with session_factory() as s:
        assert s.query(GamingCharacterInstanceEntity).count() == 0


def test_set_sleeping_leaves_the_coma_flag_alone(session_factory, adapter):
    _seed_character(session_factory)

    adapter.set_sleeping(1, 3)

    c = _character(session_factory)
    assert c.is_sleeping == 1
    assert c.is_coma == 0


def test_set_sleeping_missing_character_is_a_no_op(adapter):
    adapter.set_sleeping(1, 3)  # must not raise


def test_clear_coma_keeps_the_character_asleep(session_factory, adapter):
    _seed_character(session_factory, is_coma=1, is_sleeping=1, clock_in_coma=12)

    adapter.clear_coma(1, 3)

    c = _character(session_factory)
    assert c.is_coma == 0
    assert c.is_sleeping == 1   # waking up is the turn engine's job, not this one


def test_clear_coma_missing_character_is_a_no_op(adapter):
    adapter.clear_coma(1, 3)  # must not raise


def test_log_edge_state_appends_with_the_next_id(session_factory, adapter):
    adapter.log_edge_state(1, 3, 50, 12, "COMA_ENTERED")
    adapter.log_edge_state(1, None, None, 13, "COMA_CLEARED")

    with session_factory() as s:
        rows = s.query(LogEventsEntity).order_by(LogEventsEntity.id).all()
        assert [r.id for r in rows] == [1, 2]
        assert rows[0].id_character_match == 3
        assert rows[0].id_event == 50
        assert rows[0].clock == 12
        assert rows[0].log_message == "COMA_ENTERED"
        assert rows[0].timestamp
        assert rows[1].id_character_match is None
        assert rows[1].id_event is None
        assert rows[0].uuid != rows[1].uuid
