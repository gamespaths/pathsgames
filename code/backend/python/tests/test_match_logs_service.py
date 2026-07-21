"""Tests for the Step 28.7 match logs service (Python backend).

Exercises :class:`MatchLogsService` against an in-memory SQLite database: the
consolidated timeline assembles WEATHER, MOVEMENT, SLEEP, CLOCK_ADVANCE and
RECOVERY entries from the four append-only log tables, sorted by timestamp.
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.adapters.persistence.auth.models import Base, User
from app.adapters.persistence.match.models import (
    GamingCharacterInstanceEntity,
    GamingMatchEntity,
    LogClockHistoryEntity,
    LogEventsEntity,
    LogMovementEntity,
    LogWeatherEntity,
)
from app.adapters.persistence.story.models import (
    CharacterTemplateEntity,
    LocationEntity,
    WeatherRuleEntity,
)
from app.core.models.story.card_info import CardInfo
from app.core.services.match.match_logs_service import MatchLogsService
import app.adapters.persistence.match.models  # noqa: F401  registers gaming_* tables
import app.adapters.persistence.story.models  # noqa: F401  registers list_stories

MATCH_UUID = "match-uuid"
USER_UUID = "user-uuid"
USER_ID = 7
MATCH_ID = 500
STORY_ID = 1
_NOW = "2024-01-01T00:00:00"


@pytest.fixture()
def session_factory():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    yield factory
    engine.dispose()


def _seed_match(session_factory, *, current_clock=2):
    with session_factory() as s:
        s.add(User(id=USER_ID, uuid=USER_UUID, username="guest", state=6))
        s.add(GamingMatchEntity(
            id=MATCH_ID, uuid=MATCH_UUID, id_story=STORY_ID, id_difficulty=1,
            status="RUNNING", current_clock=current_clock, id_user_creator=USER_ID,
            ts_insert=_NOW, ts_update=_NOW,
        ))
        s.commit()


def _seed_logs(session_factory):
    """One entry of each type, inserted out of chronological order on purpose."""
    with session_factory() as s:
        s.add(LogWeatherEntity(id=1, id_match=MATCH_ID, uuid="w1", clock=1, id_weather=3,
                               timestamp_start="2024-01-01T10:00:00",
                               ts_insert=_NOW, ts_update=_NOW))
        s.add(LogClockHistoryEntity(id=1, id_match=MATCH_ID, uuid="c1", clock=2,
                                    timestamp_start="2024-01-01T13:00:00",
                                    ts_insert=_NOW, ts_update=_NOW))
        s.add(LogMovementEntity(id=1, id_match=MATCH_ID, uuid="m1", id_character_match=10,
                                id_location_from=1, id_location_to=2, energy_cost=4,
                                ts_insert="2024-01-01T11:00:00", ts_update=_NOW))
        s.add(LogEventsEntity(id=1, id_match=MATCH_ID, uuid="e1", id_character_match=10,
                              timestamp="2024-01-01T12:00:00", clock=1,
                              log_message="ACTION_SLEEP", ts_insert=_NOW, ts_update=_NOW))
        s.add(LogEventsEntity(id=2, id_match=MATCH_ID, uuid="e2", id_character_match=10,
                              timestamp="2024-01-01T14:00:00", clock=2,
                              log_message="recovery safe=1 p=50 dEnergy=3",
                              ts_insert=_NOW, ts_update=_NOW))
        # Unrelated message → not part of the timeline.
        s.add(LogEventsEntity(id=3, id_match=MATCH_ID, uuid="e3", id_character_match=10,
                              timestamp="2024-01-01T15:00:00", clock=2,
                              log_message="Weather 9 triggered event 4",
                              ts_insert=_NOW, ts_update=_NOW))
        # Null message → skipped.
        s.add(LogEventsEntity(id=4, id_match=MATCH_ID, uuid="e4", id_character_match=10,
                              timestamp="2024-01-01T16:00:00", clock=2,
                              log_message=None, ts_insert=_NOW, ts_update=_NOW))
        s.commit()


def test_get_match_logs_returns_none_when_match_unknown(session_factory):
    service = MatchLogsService(session_factory)
    assert service.get_match_logs("nope", USER_UUID) is None
    assert service.get_match_logs_for_admin("nope") is None


def test_get_match_logs_returns_none_when_user_unknown(session_factory):
    _seed_match(session_factory)
    service = MatchLogsService(session_factory)
    assert service.get_match_logs(MATCH_UUID, "ghost-uuid") is None


def test_get_match_logs_returns_none_when_user_is_not_the_creator(session_factory):
    _seed_match(session_factory)
    with session_factory() as s:
        s.add(User(id=99, uuid="other-uuid", username="other", state=6))
        s.commit()
    service = MatchLogsService(session_factory)
    assert service.get_match_logs(MATCH_UUID, "other-uuid") is None


def test_get_match_logs_empty_on_fresh_match(session_factory):
    _seed_match(session_factory, current_clock=0)
    result = MatchLogsService(session_factory).get_match_logs(MATCH_UUID, USER_UUID)
    assert result == {
        "matchUuid": MATCH_UUID, "currentClock": 0, "logs": [],
        "nextCursor": None, "limit": 50, "total": 0, "order": "asc",
    }


def test_get_match_logs_assembles_all_types_sorted_by_timestamp(session_factory):
    _seed_match(session_factory)
    _seed_logs(session_factory)
    result = MatchLogsService(session_factory).get_match_logs(MATCH_UUID, USER_UUID)

    assert result["matchUuid"] == MATCH_UUID
    assert result["currentClock"] == 2
    assert [e["type"] for e in result["logs"]] == [
        "WEATHER", "MOVEMENT", "SLEEP", "CLOCK_ADVANCE", "RECOVERY",
    ]


def test_weather_and_movement_entries_carry_their_detail_fields(session_factory):
    _seed_match(session_factory)
    _seed_logs(session_factory)
    logs = MatchLogsService(session_factory).get_match_logs(MATCH_UUID, USER_UUID)["logs"]

    weather = next(e for e in logs if e["type"] == "WEATHER")
    assert weather["idWeather"] == 3
    assert weather["clock"] == 1

    movement = next(e for e in logs if e["type"] == "MOVEMENT")
    assert movement["idLocationFrom"] == 1
    assert movement["idLocationTo"] == 2
    assert movement["energyCost"] == 4
    assert movement["idCharacterMatch"] == 10


def test_sleep_and_recovery_entries_carry_their_detail_fields(session_factory):
    _seed_match(session_factory)
    _seed_logs(session_factory)
    logs = MatchLogsService(session_factory).get_match_logs(MATCH_UUID, USER_UUID)["logs"]

    sleep = next(e for e in logs if e["type"] == "SLEEP")
    assert sleep["clock"] == 1
    assert sleep["idCharacterMatch"] == 10

    recovery = next(e for e in logs if e["type"] == "RECOVERY")
    assert recovery["message"].startswith("recovery")


def test_counter_zero_event_is_reported_as_recovery(session_factory):
    _seed_match(session_factory)
    with session_factory() as s:
        s.add(LogEventsEntity(id=9, id_match=MATCH_ID, uuid="e9", timestamp=_NOW,
                              log_message="counter reached zero at location 3",
                              ts_insert=_NOW, ts_update=_NOW))
        s.commit()
    logs = MatchLogsService(session_factory).get_match_logs_for_admin(MATCH_UUID)["logs"]
    assert [e["type"] for e in logs] == ["RECOVERY"]


def test_executed_event_is_reported_as_event(session_factory):
    """Step 29 — log_events derives its type from the message prefix and drops what it does
    not recognise, so an executed event needs its own EVENT branch."""
    _seed_match(session_factory)
    with session_factory() as s:
        s.add(LogEventsEntity(id=11, id_match=MATCH_ID, uuid="e11", id_character_match=10,
                              clock=4, timestamp=_NOW, id_event=90010,
                              log_message="EVENT_EXECUTED 90010",
                              ts_insert=_NOW, ts_update=_NOW))
        s.commit()
    logs = MatchLogsService(session_factory).get_match_logs_for_admin(MATCH_UUID)["logs"]
    assert [e["type"] for e in logs] == ["EVENT"]
    assert logs[0]["message"] == "EVENT_EXECUTED 90010"
    assert logs[0]["idCharacterMatch"] == 10


def test_admin_variant_skips_the_ownership_check(session_factory):
    _seed_match(session_factory)
    _seed_logs(session_factory)
    result = MatchLogsService(session_factory).get_match_logs_for_admin(MATCH_UUID)
    assert len(result["logs"]) == 5


# ── v0.28.7: cursor pagination ──────────────────────────────────────────────

def _seed_clock_entries(session_factory, count):
    """Inserts `count` CLOCK_ADVANCE rows with ascending timestamps."""
    with session_factory() as s:
        for i in range(count):
            s.add(LogClockHistoryEntity(
                id=100 + i, id_match=MATCH_ID, uuid=f"c{i}", clock=i,
                timestamp_start=f"2024-01-01T{i:02d}:00:00",
                ts_insert=_NOW, ts_update=_NOW))
        s.commit()


def test_cursor_helpers_round_trip():
    from app.core.services.match import match_logs_service as mod
    assert mod.decode_cursor(mod.encode_cursor(42)) == 42
    assert mod.decode_cursor(None) == 0
    assert mod.decode_cursor("") == 0
    assert mod.decode_cursor("###") == 0


def test_clamp_limit_bounds():
    from app.core.services.match.match_logs_service import (
        DEFAULT_LIMIT, MAX_LIMIT, clamp_limit)
    assert clamp_limit(None) == DEFAULT_LIMIT
    assert clamp_limit(9999) == MAX_LIMIT
    assert clamp_limit(0) == 1
    assert clamp_limit(-5) == 1


def test_first_page_is_capped_and_exposes_next_cursor(session_factory):
    _seed_match(session_factory)
    _seed_clock_entries(session_factory, 5)
    result = MatchLogsService(session_factory).get_match_logs_for_admin(
        MATCH_UUID, limit=2)
    assert len(result["logs"]) == 2
    assert result["limit"] == 2
    assert result["total"] == 5
    assert result["nextCursor"] is not None
    assert [e["clock"] for e in result["logs"]] == [0, 1]


def test_next_cursor_walks_to_the_end_then_goes_none(session_factory):
    _seed_match(session_factory)
    _seed_clock_entries(session_factory, 5)
    service = MatchLogsService(session_factory)
    page1 = service.get_match_logs_for_admin(MATCH_UUID, limit=2)
    page2 = service.get_match_logs_for_admin(MATCH_UUID, limit=2, cursor=page1["nextCursor"])
    page3 = service.get_match_logs_for_admin(MATCH_UUID, limit=2, cursor=page2["nextCursor"])

    assert [e["clock"] for e in page2["logs"]] == [2, 3]
    assert [e["clock"] for e in page3["logs"]] == [4]
    assert page3["nextCursor"] is None


def test_offset_past_the_end_returns_an_empty_page(session_factory):
    from app.core.services.match.match_logs_service import encode_cursor

    _seed_match(session_factory)
    _seed_clock_entries(session_factory, 2)
    result = MatchLogsService(session_factory).get_match_logs_for_admin(
        MATCH_UUID, limit=2, cursor=encode_cursor(99))
    assert result["logs"] == []
    assert result["nextCursor"] is None
    assert result["total"] == 2


def test_garbage_cursor_restarts_from_the_first_page(session_factory):
    _seed_match(session_factory)
    _seed_clock_entries(session_factory, 3)
    result = MatchLogsService(session_factory).get_match_logs_for_admin(
        MATCH_UUID, limit=2, cursor="not-a-cursor")
    assert result["logs"][0]["clock"] == 0


# ── order=asc|desc ──────────────────────────────────────────────────────────

def test_normalize_order_accepts_only_desc():
    from app.core.services.match.match_logs_service import normalize_order
    assert normalize_order(None) == "asc"
    assert normalize_order("") == "asc"
    assert normalize_order("nonsense") == "asc"
    assert normalize_order("asc") == "asc"
    assert normalize_order("desc") == "desc"
    assert normalize_order("  DESC ") == "desc"


def test_desc_starts_from_the_newest_entry(session_factory):
    _seed_match(session_factory)
    _seed_clock_entries(session_factory, 5)
    result = MatchLogsService(session_factory).get_match_logs_for_admin(
        MATCH_UUID, order="desc")
    assert result["order"] == "desc"
    assert [e["clock"] for e in result["logs"]] == [4, 3, 2, 1, 0]


def test_desc_cursor_walks_towards_the_older_entries(session_factory):
    _seed_match(session_factory)
    _seed_clock_entries(session_factory, 5)
    service = MatchLogsService(session_factory)
    page1 = service.get_match_logs_for_admin(MATCH_UUID, limit=2, order="desc")
    page2 = service.get_match_logs_for_admin(MATCH_UUID, limit=2, order="desc",
                                             cursor=page1["nextCursor"])
    assert [e["clock"] for e in page1["logs"]] == [4, 3]
    assert [e["clock"] for e in page2["logs"]] == [2, 1]


def test_desc_reverses_entries_of_every_type(session_factory):
    _seed_match(session_factory)
    _seed_logs(session_factory)
    result = MatchLogsService(session_factory).get_match_logs_for_admin(
        MATCH_UUID, order="desc")
    assert [e["type"] for e in result["logs"]] == [
        "RECOVERY", "CLOCK_ADVANCE", "SLEEP", "MOVEMENT", "WEATHER",
    ]


def test_unknown_order_falls_back_to_ascending(session_factory):
    _seed_match(session_factory)
    _seed_clock_entries(session_factory, 3)
    result = MatchLogsService(session_factory).get_match_logs_for_admin(
        MATCH_UUID, order="sideways")
    assert result["order"] == "asc"
    assert [e["clock"] for e in result["logs"]] == [0, 1, 2]


def test_owner_endpoint_honours_the_order_too(session_factory):
    _seed_match(session_factory)
    _seed_clock_entries(session_factory, 3)
    result = MatchLogsService(session_factory).get_match_logs(
        MATCH_UUID, USER_UUID, order="desc")
    assert [e["clock"] for e in result["logs"]] == [2, 1, 0]


# ── v0.28.7: card + character enrichment ────────────────────────────────────

class _FakeContentQueryService:
    """Returns a CardInfo whose title encodes the card id it was asked for."""

    def __init__(self, titles):
        self.titles = titles
        self.calls = []

    def get_card_by_story_id_and_card_id(self, story_id, id_card, lang):
        self.calls.append((story_id, id_card, lang))
        title = self.titles.get(id_card)
        return None if title is None else CardInfo(uuid=f"card-{id_card}", title=title)


def _seed_story_content(session_factory):
    """A weather, a location and a character template, each with its own card."""
    with session_factory() as s:
        s.add(WeatherRuleEntity(id=3, id_story=STORY_ID, uuid="w-3", id_card=300))
        s.add(LocationEntity(id=2, id_story=STORY_ID, uuid="loc-2", id_card=400))
        s.add(CharacterTemplateEntity(id_tipo=9, id_story=STORY_ID, uuid="tpl-9", id_card=500))
        s.add(GamingCharacterInstanceEntity(
            id=10, id_match=MATCH_ID, uuid="char-uuid", id_user=USER_ID,
            id_character_template=9, ts_insert=_NOW, ts_update=_NOW))
        s.commit()


def test_weather_entry_carries_its_own_card(session_factory):
    _seed_match(session_factory)
    _seed_logs(session_factory)
    _seed_story_content(session_factory)
    content = _FakeContentQueryService({300: "Thunderstorm", 400: "Dark Forest", 500: "Ranger"})

    logs = MatchLogsService(session_factory, content).get_match_logs_for_admin(MATCH_UUID)["logs"]
    weather = next(e for e in logs if e["type"] == "WEATHER")
    assert weather["idCard"] == 300
    assert weather["card"]["title"] == "Thunderstorm"


def test_movement_entry_carries_destination_card_and_character(session_factory):
    _seed_match(session_factory)
    _seed_logs(session_factory)
    _seed_story_content(session_factory)
    content = _FakeContentQueryService({300: "Thunderstorm", 400: "Dark Forest", 500: "Ranger"})

    logs = MatchLogsService(session_factory, content).get_match_logs_for_admin(MATCH_UUID)["logs"]
    movement = next(e for e in logs if e["type"] == "MOVEMENT")
    assert movement["idCard"] == 400
    assert movement["card"]["title"] == "Dark Forest"
    assert movement["characterUuid"] == "char-uuid"
    assert movement["characterName"] == "Ranger"


def test_cards_are_resolved_in_the_requested_language(session_factory):
    _seed_match(session_factory)
    _seed_logs(session_factory)
    _seed_story_content(session_factory)
    content = _FakeContentQueryService({300: "Temporale"})

    MatchLogsService(session_factory, content).get_match_logs_for_admin(MATCH_UUID, lang="it")
    assert all(lang == "it" for (_, _, lang) in content.calls)


def test_entries_without_a_card_resolve_to_null(session_factory):
    _seed_match(session_factory)
    _seed_logs(session_factory)
    # no story content seeded → no id_card mapping exists
    logs = MatchLogsService(session_factory, _FakeContentQueryService({})) \
        .get_match_logs_for_admin(MATCH_UUID)["logs"]
    weather = next(e for e in logs if e["type"] == "WEATHER")
    assert weather["idCard"] is None
    assert weather["card"] is None


def test_without_a_content_service_entries_keep_ids_but_carry_no_cards(session_factory):
    _seed_match(session_factory)
    _seed_logs(session_factory)
    _seed_story_content(session_factory)

    logs = MatchLogsService(session_factory).get_match_logs_for_admin(MATCH_UUID)["logs"]
    weather = next(e for e in logs if e["type"] == "WEATHER")
    assert weather["idCard"] == 300
    assert weather["card"] is None
