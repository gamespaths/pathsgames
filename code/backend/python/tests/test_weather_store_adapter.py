"""Step 27 — the SQLAlchemy weather store adapter.

Exercises :class:`WeatherStoreAdapter` against an in-memory SQLite database: the
engine-facing context/rule reads, the energy and current-weather writes, the
``log_weather``/``log_events`` appends and the query-side projections including the
id_text_name → card-title name fallback.
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.adapters.persistence.auth.models import Base, User
from app.adapters.persistence.match.models import (
    GamingCharacterInstanceEntity,
    GamingMatchEntity,
    GamingStateRegistryEntity,
    LogEventsEntity,
    LogWeatherEntity,
)
from app.adapters.persistence.story.models import (
    CardEntity, StoryEntity, TextEntity, WeatherRuleEntity,
)
from app.adapters.persistence.match.weather_store_adapter import WeatherStoreAdapter
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
    return WeatherStoreAdapter(session_factory)


def _seed_match(session_factory, *, weather=None, seed=1234, id_story=9001):
    with session_factory() as s:
        s.add(StoryEntity(id=id_story, uuid="story-uuid", author="A"))
        s.add(User(id=7, uuid="user-uuid", username="bob", state=6))
        s.add(GamingMatchEntity(
            id=1, uuid="match-uuid", id_story=id_story, id_difficulty=1,
            id_user_creator=7, current_clock=6, status="RUNNING", rng_seed=seed,
            id_current_weather=weather, ts_insert=_NOW, ts_update=_NOW))
        s.commit()


def _seed_rules(session_factory):
    with session_factory() as s:
        s.add(WeatherRuleEntity(id=10, id_story=9001, uuid="w-sun", id_card=1,
                                id_text_name=500, probability=0.7, delta_energy=1,
                                cost_move_safe_location=1, cost_move_not_safe_location=2,
                                id_event=90, condition_key="k", condition_key_value="v",
                                time_from=0, time_to=12, active=1))
        s.add(WeatherRuleEntity(id=11, id_story=9001, uuid="w-rain", id_card=2,
                                probability=0.3, delta_energy=-2,
                                cost_move_safe_location=3, cost_move_not_safe_location=4,
                                time_from=12, time_to=24, active=0))
        s.add(TextEntity(id=1, id_story=9001, id_text=500, lang="en", short_text="Sun"))
        s.add(CardEntity(id=2, id_story=9001, uuid="card-rain", id_text_title=600))
        s.add(TextEntity(id=2, id_story=9001, id_text=600, lang="en", short_text="Rain"))
        s.commit()


# ── engine-facing reads ──────────────────────────────────────────────────────

def test_load_context(session_factory, adapter):
    _seed_match(session_factory)

    assert adapter.load_context(1) == {"id_story": 9001, "current_clock": 6,
                                       "rng_seed": 1234}
    assert adapter.load_context(99) is None


def test_find_active_weather_rules_skips_the_inactive_ones(session_factory, adapter):
    _seed_match(session_factory)
    _seed_rules(session_factory)

    rules = adapter.find_active_weather_rules(9001)
    assert [r["id"] for r in rules] == [10]
    assert rules[0]["uuid"] == "w-sun"
    assert rules[0]["probability"] == 0.7
    assert rules[0]["time_from"] == 0
    assert rules[0]["time_to"] == 12
    assert rules[0]["condition_key"] == "k"
    assert rules[0]["condition_key_value"] == "v"
    assert rules[0]["delta_energy"] == 1
    assert rules[0]["id_event"] == 90
    assert rules[0]["id_text_name"] == 500

    assert adapter.find_active_weather_rules(9999) == []


def test_find_registry_value_prefers_string_then_int(session_factory, adapter):
    with session_factory() as s:
        s.add(GamingStateRegistryEntity(id=1, id_match=1, uuid="r-a", key="door",
                                        string_value="open", ts_insert=_NOW, ts_update=_NOW))
        s.add(GamingStateRegistryEntity(id=2, id_match=1, uuid="r-b", key="count",
                                        int_value=7, ts_insert=_NOW, ts_update=_NOW))
        s.add(GamingStateRegistryEntity(id=3, id_match=1, uuid="r-c", key="empty",
                                        ts_insert=_NOW, ts_update=_NOW))
        s.commit()

    assert adapter.find_registry_value(1, "door") == "open"
    assert adapter.find_registry_value(1, "count") == "7"
    assert adapter.find_registry_value(1, "empty") is None
    assert adapter.find_registry_value(1, "ghost") is None


def test_find_characters_projects_energy(session_factory, adapter):
    _seed_match(session_factory)
    with session_factory() as s:
        s.add(GamingCharacterInstanceEntity(
            id=3, id_match=1, uuid="char-a", id_user=7, id_character_template=1,
            energy=4, energy_max=12, life=10, ts_insert=_NOW, ts_update=_NOW))
        s.commit()

    assert adapter.find_characters(1) == [{"id": 3, "energy": 4, "energy_max": 12}]
    assert adapter.find_characters(2) == []


# ── writes ───────────────────────────────────────────────────────────────────

def test_update_character_energy(session_factory, adapter):
    _seed_match(session_factory)
    with session_factory() as s:
        s.add(GamingCharacterInstanceEntity(
            id=3, id_match=1, uuid="char-a", id_user=7, id_character_template=1,
            energy=4, energy_max=12, life=10, ts_insert=_NOW, ts_update=_NOW))
        s.commit()

    adapter.update_character_energy(1, 3, 9)
    with session_factory() as s:
        assert s.query(GamingCharacterInstanceEntity).filter_by(id=3).one().energy == 9

    adapter.update_character_energy(1, 999, 9)  # unknown character, must not raise


def test_set_current_weather(session_factory, adapter):
    _seed_match(session_factory)

    adapter.set_current_weather(1, 10)
    with session_factory() as s:
        assert s.query(GamingMatchEntity).filter_by(id=1).one().id_current_weather == 10

    adapter.set_current_weather(99, 10)  # unknown match, must not raise


def test_insert_log_weather_uses_the_next_global_id(session_factory, adapter):
    _seed_match(session_factory)

    adapter.insert_log_weather(1, 6, 10)
    adapter.insert_log_weather(1, 7, None)

    with session_factory() as s:
        rows = s.query(LogWeatherEntity).order_by(LogWeatherEntity.id).all()
        assert [r.id for r in rows] == [1, 2]
        assert rows[0].clock == 6 and rows[0].id_weather == 10
        assert rows[1].id_weather is None
        assert rows[0].uuid != rows[1].uuid


def test_log_weather_event_appends(session_factory, adapter):
    _seed_match(session_factory)

    adapter.log_weather_event(1, 90, "WEATHER_EVENT sun")
    adapter.log_weather_event(1, None, "WEATHER_EVENT none")

    with session_factory() as s:
        rows = s.query(LogEventsEntity).order_by(LogEventsEntity.id).all()
        assert [r.id for r in rows] == [1, 2]
        assert rows[0].id_event == 90
        assert rows[1].id_event is None
        assert rows[1].log_message == "WEATHER_EVENT none"


# ── queries ──────────────────────────────────────────────────────────────────

def test_find_current_weather_by_uuid(session_factory, adapter):
    _seed_match(session_factory, weather=10)
    _seed_rules(session_factory)

    w = adapter.find_current_weather_by_uuid("match-uuid")
    assert w["id_weather"] == 10
    assert w["uuid"] == "w-sun"
    assert w["id_story"] == 9001
    assert w["id_card"] == 1
    assert w["id_text_name"] == 500
    assert w["delta_energy"] == 1
    assert w["cost_move_safe_location"] == 1
    assert w["cost_move_not_safe_location"] == 2
    assert w["current_clock"] == 6


def test_find_current_weather_by_uuid_edge_cases(session_factory, adapter):
    _seed_match(session_factory, weather=None)
    _seed_rules(session_factory)

    assert adapter.find_current_weather_by_uuid("ghost") is None
    # match exists but has no current weather
    assert adapter.find_current_weather_by_uuid("match-uuid") is None

    # current weather points at a rule that does not exist
    with session_factory() as s:
        s.query(GamingMatchEntity).filter_by(id=1).one().id_current_weather = 999
        s.commit()
    assert adapter.find_current_weather_by_uuid("match-uuid") is None


def test_find_weather_rules_for_match_resolves_names_and_current(session_factory, adapter):
    _seed_match(session_factory, weather=10)
    _seed_rules(session_factory)

    rules = {r["id"]: r for r in adapter.find_weather_rules_for_match("match-uuid")}
    assert rules[10]["name"] == "Sun"          # direct id_text_name
    assert rules[10]["active"] is True
    assert rules[10]["current"] is True
    assert rules[11]["name"] == "Rain"         # fallback via the card title
    assert rules[11]["active"] is False
    assert rules[11]["current"] is False
    assert rules[11]["probability"] == 0.3


def test_find_weather_rules_for_match_unknown_uuid(session_factory, adapter):
    _seed_match(session_factory)
    assert adapter.find_weather_rules_for_match("ghost") == []


def test_weather_name_is_none_without_text_or_card(session_factory, adapter):
    _seed_match(session_factory)
    with session_factory() as s:
        s.add(WeatherRuleEntity(id=12, id_story=9001, uuid="w-plain", active=1))
        # a card with no resolvable title text
        s.add(WeatherRuleEntity(id=13, id_story=9001, uuid="w-card", id_card=9,
                                active=1))
        s.add(CardEntity(id=9, id_story=9001, uuid="card-9"))
        s.commit()

    rules = {r["id"]: r for r in adapter.find_weather_rules_for_match("match-uuid")}
    assert rules[12]["name"] is None
    assert rules[13]["name"] is None


def test_find_rng_seed(session_factory, adapter):
    _seed_match(session_factory, seed=99)

    assert adapter.find_rng_seed("match-uuid") == 99
    assert adapter.find_rng_seed("ghost") is None


def test_find_weather_log_joins_the_rules(session_factory, adapter):
    _seed_match(session_factory)
    _seed_rules(session_factory)
    adapter.insert_log_weather(1, 7, 10)
    adapter.insert_log_weather(1, 6, 999)   # unknown rule id

    log = adapter.find_weather_log("match-uuid")
    assert [row["clock"] for row in log] == [6, 7]     # ordered by clock
    assert log[0]["weather_uuid"] is None
    assert log[0]["id_text_name"] is None
    assert log[1]["weather_uuid"] == "w-sun"
    assert log[1]["id_text_name"] == 500
    assert log[1]["timestamp_start"]


def test_find_weather_log_unknown_match(session_factory, adapter):
    _seed_match(session_factory)
    assert adapter.find_weather_log("ghost") == []
