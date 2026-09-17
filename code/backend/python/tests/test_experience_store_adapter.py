"""Step 38 — the SQLAlchemy adapter behind use-exp, on an in-memory SQLite."""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.adapters.persistence.database import Base
from app.adapters.persistence.match.experience_store_adapter import ExperienceStoreAdapter
from app.adapters.persistence.match.models import (
    GamingCharacterInstanceEntity,
    GamingMatchEntity,
    LogEventsEntity,
)
from app.adapters.persistence.story.models import LocationEntity, StoryDifficultyEntity, StoryEntity
import app.adapters.persistence.auth.models  # noqa: F401  registers users

_NOW = "2024-01-01T00:00:00"


@pytest.fixture()
def session_factory():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    with factory() as s:
        s.add(StoryEntity(id=5, uuid="s5", author="a"))
        s.add(StoryDifficultyEntity(id=2, id_story=5, uuid="d2", exp_cost=2, exp_cost_base=3, max_stat_value=12))
        s.add(LocationEntity(id=7, id_story=5, uuid="l7", secure_param=1))
        s.add(LocationEntity(id=8, id_story=5, uuid="l8", secure_param=None))
        s.add(GamingMatchEntity(id=1, uuid="m1", id_story=5, id_difficulty=2, status="RUNNING",
                                current_clock=3, id_user_creator=100, id_character_current_turn=10,
                                exp_cost=2, ts_insert=_NOW, ts_update=_NOW))
        s.add(GamingCharacterInstanceEntity(id=10, id_match=1, uuid="c1", id_user=100,
                                            id_character_template=1, dexterity=10, intelligence=12,
                                            constitution=4, exp=40, is_sleeping=False, is_coma=False,
                                            id_location=7, ts_insert=_NOW, ts_update=_NOW))
        s.commit()
    yield factory
    engine.dispose()


def test_reads(session_factory):
    adapter = ExperienceStoreAdapter(session_factory)
    m = adapter.find_match_by_uuid("m1")
    assert (m["id"], m["status"], m["id_story"], m["id_difficulty"], m["exp_cost"], m["current_clock"],
            m["id_character_current_turn"]) == (1, "RUNNING", 5, 2, 2, 3, 10)
    assert adapter.find_match_by_uuid("nope") is None
    c = adapter.find_character_by_match_and_user(1, 100)
    assert (c["id"], c["uuid"], c["dexterity"], c["intelligence"], c["constitution"], c["exp"],
            c["is_sleeping"], c["is_coma"], c["id_location"]) == (10, "c1", 10, 12, 4, 40, False, False, 7)
    assert adapter.find_character_by_match_and_user(1, 1) is None
    assert adapter.find_location_secure_param(5, 7) == 1
    assert adapter.find_location_secure_param(5, 8) == 0
    assert adapter.find_location_secure_param(5, 9) is None
    assert adapter.find_difficulty(5, 2) == {"exp_cost": 2, "exp_cost_base": 3, "max_stat_value": 12}
    assert adapter.find_difficulty(5, 3) is None


def test_update_character_and_log(session_factory):
    adapter = ExperienceStoreAdapter(session_factory)
    adapter.update_character(1, 10, 11, 12, 4, -1)
    c = adapter.find_character_by_match_and_user(1, 100)
    assert (c["dexterity"], c["exp"]) == (11, 0)
    adapter.update_character(1, 99, 1, 1, 1, 1)  # no such character: nothing happens
    adapter.log_exp_use(1, 10, 3, "EXP_USE dex 10->11 cost 23")
    with session_factory() as s:
        rows = s.query(LogEventsEntity).all()
        assert len(rows) == 1
        assert (rows[0].id_match, rows[0].id_character_match, rows[0].clock, rows[0].log_message) == \
            (1, 10, 3, "EXP_USE dex 10->11 cost 23")
        assert rows[0].uuid and rows[0].timestamp
