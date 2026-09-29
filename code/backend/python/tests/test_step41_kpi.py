"""v0.41.2 Step 41 F — KPI counters: the service (best effort, day/month/total, validation), the
SQLAlchemy adapter (ON CONFLICT upsert), the admin endpoint and the hooks. Mirrors the Java tests."""
from datetime import date, datetime, timedelta, timezone
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import sessionmaker

from app.adapters.persistence.auth.models import Base, User
from app.adapters.persistence.match.kpi_store_adapter import KpiStoreAdapter, upsert_statement
from app.adapters.persistence.match.match_persistence_adapter import MatchPersistenceAdapter
from app.adapters.persistence.match.models import GamingMatchEntity, SystemKpiDailyEntity
from app.adapters.persistence.match.turn_cycle_store_adapter import TurnCycleStoreAdapter
from app.adapters.persistence.story.models import LocationEntity, StoryEntity
from app.adapters.rest.match.kpi_admin_controller import KpiAdminController
from app.core.ports.match import kpi_ports as k
from app.core.ports.match.kpi_ports import KpiCount, KpiDailyRow, KpiError, KpiMission, KpiPort, KpiStorePort
from app.core.ports.match.turn_ports import TurnCycleStorePort
from app.core.services.match import edge_state_evaluator as ese
from app.core.services.match.kpi_service import KpiService, ratio
from app.core.services.match.match_command_service import MatchCommandService, millis_since
from app.core.services.match.mission_service import MissionService
from app.core.services.match.time_start_recovery_service import TimeStartRecoveryService
from app.core.services.match.turn_cycle_service import TurnCycleService

TODAY = date(2026, 9, 29)
MATCH_ID, USER_ID = 500, 7


def _service(store=None):
    return KpiService(store or MagicMock(), today=lambda: TODAY)


def _row(day, metric, ref="", value=1):
    return KpiDailyRow("s-1", day, metric, ref, value)


# ── service: writes ──────────────────────────────────────────────────────────

def test_record_writes_today_with_an_empty_ref_by_default():
    store = MagicMock()
    _service(store).record("s-1", k.MATCH_STARTED, None, 1)
    _service(store).record("s-1", k.CHOICE, "c-1", 2)
    assert [c.args for c in store.increment.call_args_list] == [
        ("s-1", "2026-09-29", "MATCH_STARTED", "", 1), ("s-1", "2026-09-29", "CHOICE", "c-1", 2)]


def test_record_skips_a_blank_story_an_unknown_metric_and_a_zero_delta():
    store = MagicMock()
    service = _service(store)
    service.record(None, k.COMA, None, 1)
    service.record("  ", k.COMA, None, 1)
    service.record("s-1", "NOPE", None, 1)
    service.record("s-1", k.COMA, None, 0)
    store.increment.assert_not_called()


def test_a_store_failure_never_reaches_the_caller(caplog):
    store = MagicMock()
    store.increment.side_effect = RuntimeError("db down")
    store.find_story_uuid_by_match.side_effect = RuntimeError("db down")
    store.find_location_uuid.side_effect = RuntimeError("db down")
    service = _service(store)
    service.record("s-1", k.COMA, None, 1)
    service.record_for_match(7, k.COMA, None, 1)
    service.record_location_visit(7, 9, 3)
    assert caplog.text.count("KPI_RECORD_FAILED") == 3


def test_record_for_match_and_location_visit_resolve_the_uuids():
    store = MagicMock()
    store.find_story_uuid_by_match.side_effect = lambda m: "s-1" if m == 7 else None
    store.find_location_uuid.side_effect = lambda s, loc: "loc-3" if loc == 3 else None
    service = _service(store)
    service.record_for_match(7, k.COMA, None, 1)
    service.record_for_match(8, k.COMA, None, 1)
    service.record_location_visit(7, 9, 3)
    service.record_location_visit(7, 9, 4)
    assert [c.args for c in store.increment.call_args_list] == [
        ("s-1", "2026-09-29", "COMA", "", 1), ("s-1", "2026-09-29", "LOCATION_VISIT", "loc-3", 1)]


def test_default_today_is_utc():
    store = MagicMock()
    KpiService(store).record("s-1", k.COMA, None, 1)
    assert store.increment.call_args.args[1] == datetime.now(timezone.utc).date().isoformat()


# ── service: report ──────────────────────────────────────────────────────────

def test_default_range_is_the_last_30_days_with_zero_rows():
    store = MagicMock()
    store.find_rows.return_value = []
    r = _service(store).report(None, None, None, None)
    store.find_rows.assert_called_once_with(None, "2026-08-31", "2026-09-29")
    assert (r.story_uuid, r.from_day, r.to_day, r.group_by) == (None, "2026-08-31", "2026-09-29", "day")
    assert len(r.rows) == 30 and r.rows[0].period == "2026-08-31"
    assert r.rows[0].completion_rate is None and r.rows[0].avg_duration_minutes is None
    assert r.rows[0].avg_duration_clocks is None and r.choices == []


def test_day_report_rates_averages_and_uuid_tables():
    store = MagicMock()
    store.find_rows.return_value = [
        _row("2026-09-28", k.MATCH_STARTED, value=3), _row("2026-09-28", k.MATCH_COMPLETED, value=2),
        _row("2026-09-28", k.DURATION_MS, value=185_000), _row("2026-09-28", k.DURATION_CLOCKS, value=5),
        _row("2026-09-28", k.COMA), _row("2026-09-28", k.CHOICE, "c-1"),
        _row("2026-09-29", k.CHOICE, "c-1", 2), _row("2026-09-29", k.CHOICE, "c-2", 3),
        _row("2026-09-29", k.LOCATION_VISIT, "l-1"), _row("2026-09-29", k.MISSION_ACTIVE, "m-2"),
        _row("2026-09-29", k.MISSION_COMPLETED, "m-1"), _row("2026-09-29", k.MISSION_FAILED, "m-1", 2),
        _row("2026-09-29", "UNKNOWN_METRIC", value=9), _row(None, k.COMA, value=9),
        KpiDailyRow("s-1", "2026-09-29", k.COMA, None, None)]
    r = _service(store).report(" s-1 ", "2026-09-28", "2026-09-29", "DAY")
    store.find_rows.assert_called_once_with("s-1", "2026-09-28", "2026-09-29")
    first = r.rows[0]
    assert (first.matches_started, first.matches_completed, first.coma_count) == (3, 2, 1)
    assert (first.completion_rate, first.avg_duration_minutes, first.avg_duration_clocks) == (0.6667, 1.54, 2.5)
    assert r.rows[1].coma_count == 0
    assert r.choices == [KpiCount("c-1", 3), KpiCount("c-2", 3)]
    assert r.locations == [KpiCount("l-1", 1)]
    assert r.missions == [KpiMission("m-1", 0, 1, 2), KpiMission("m-2", 1, 0, 0)]


def test_month_and_total_fold_the_days():
    store = MagicMock()
    store.find_rows.return_value = [_row("2026-08-31", k.MATCH_STARTED), _row("2026-09-01", k.MATCH_STARTED, value=2),
                                    _row("2026-09-01", k.MATCH_COMPLETED)]
    month = _service(store).report("s-1", "2026-08-30", "2026-09-02", "month")
    assert [x.period for x in month.rows] == ["2026-08", "2026-09"]
    assert [x.matches_started for x in month.rows] == [1, 2]
    total = _service(store).report("s-1", "2026-08-30", "2026-09-02", "total")
    assert [(x.period, x.matches_started, x.completion_rate) for x in total.rows] == [("total", 3, 0.3333)]


def test_one_bound_defaults_the_other():
    store = MagicMock()
    store.find_rows.return_value = []
    assert _service(store).report("", None, "2026-09-30", "day").from_day == "2026-09-01"
    assert _service(store).report(None, "2026-09-20", " ", "total").to_day == "2026-09-29"


@pytest.mark.parametrize("args", [
    (None, None, "week"), ("2026/09/01", None, None), ("2026-02-30", None, None),
    (None, "yesterday", None), ("2026-09-10", "2026-09-01", None), ("2025-09-28", "2026-09-29", None)])
def test_bad_input_is_invalid_input(args):
    with pytest.raises(KpiError) as exc:
        _service().report(None, *args)
    assert exc.value.code == "INVALID_INPUT"


def test_366_days_are_allowed():
    store = MagicMock()
    store.find_rows.return_value = []
    assert len(_service(store).report(None, "2025-09-29", "2026-09-29", None).rows) == 366


def test_ratio_rounds_half_up():
    assert ratio(1, 8, 2) == 0.13
    assert ratio(2, 3, 4) == 0.6667


def test_ports_are_abstract():
    with pytest.raises(TypeError):
        KpiPort()
    with pytest.raises(TypeError):
        KpiStorePort()
    assert TurnCycleStorePort.stamp_match_start(MagicMock(), 1) is None


# ── adapter ──────────────────────────────────────────────────────────────────

@pytest.fixture()
def session_factory():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    now = "2026-09-29T10:00:00+00:00"
    with factory() as s:
        s.add(User(id=USER_ID, uuid="user-uuid", username="guest", state=6))
        s.add(StoryEntity(id=9, uuid="story-9"))
        s.add(LocationEntity(id=3, id_story=9, uuid="loc-3"))
        s.add(GamingMatchEntity(id=MATCH_ID, uuid="m-1", id_story=9, id_difficulty=1, status="CREATED",
                                current_clock=0, id_user_creator=USER_ID, ts_insert=now, ts_update=now))
        s.commit()
    yield factory
    engine.dispose()


def test_adapter_upsert_adds_the_delta_in_place(session_factory):
    adapter = KpiStoreAdapter(session_factory)
    adapter.increment("s-1", "2026-09-29", k.MATCH_STARTED, "", 1)
    adapter.increment("s-1", "2026-09-29", k.MATCH_STARTED, None, 2)
    adapter.increment("s-1", "2026-09-29", k.CHOICE, "c-1", 1)
    with session_factory() as s:
        rows = s.query(SystemKpiDailyEntity).order_by(SystemKpiDailyEntity.id).all()
        assert [(r.metric, r.ref_uuid, r.value) for r in rows] == [("MATCH_STARTED", "", 3), ("CHOICE", "c-1", 1)]


def test_adapter_reads_the_inclusive_range(session_factory):
    adapter = KpiStoreAdapter(session_factory)
    for day, story, value in (("2026-09-27", "s-1", 1), ("2026-09-28", "s-1", 2),
                              ("2026-09-29", "s-2", 4), ("2026-09-30", "s-2", 8)):
        adapter.increment(story, day, k.COMA, "", value)
    assert adapter.find_rows("s-1", "2026-09-28", "2026-09-29") == [KpiDailyRow("s-1", "2026-09-28", "COMA", "", 2)]
    assert len(adapter.find_rows(None, "2026-09-28", "2026-09-29")) == 2


def test_adapter_lookups(session_factory):
    adapter = KpiStoreAdapter(session_factory)
    assert adapter.find_story_uuid_by_match(MATCH_ID) == "story-9"
    assert adapter.find_story_uuid_by_match(1) is None
    assert adapter.find_location_uuid(9, 3) == "loc-3"
    assert adapter.find_location_uuid(8, 3) is None


def test_postgresql_statement_is_the_same_upsert():
    sql = str(upsert_statement("postgresql", {"uuid": "u", "story_uuid": "s", "day": "d", "metric": "m",
                                              "ref_uuid": "", "value": 1, "ts_insert": "t", "ts_update": "t"})
              .compile(dialect=postgresql.dialect()))
    assert "ON CONFLICT (story_uuid, day, metric, ref_uuid) DO UPDATE" in sql
    assert "system_kpi_daily.value + excluded.value" in sql


def test_turn_store_stamps_the_start_once_and_the_match_dict_carries_it(session_factory):
    store = TurnCycleStoreAdapter(session_factory)
    store.stamp_match_start(MATCH_ID)
    first = MatchPersistenceAdapter(session_factory).find_match_by_uuid("m-1")["timestamp_start"]
    assert first
    store.stamp_match_start(MATCH_ID)
    store.stamp_match_start(999)
    assert MatchPersistenceAdapter(session_factory).find_match_by_uuid("m-1")["timestamp_start"] == first


# ── admin endpoint ───────────────────────────────────────────────────────────

def _client(port):
    app = FastAPI()
    app.include_router(KpiAdminController(port).router)
    return TestClient(app)


def test_endpoint_answers_the_camel_case_report():
    port = MagicMock()
    port.report.return_value = k.KpiReport("s-1", "2026-09-01", "2026-09-02", "total",
                                           [k.KpiRow("total", 2, 1, 0.5, 1.25, 3.0, 1)],
                                           [KpiCount("c-1", 4)], [KpiCount("l-1", 1)],
                                           [KpiMission("m-1", 1, 1, 0)])
    body = _client(port).get("/api/admin/reports/kpi", params={
        "storyUuid": "s-1", "from": "2026-09-01", "to": "2026-09-02", "groupBy": "total"}).json()
    port.report.assert_called_once_with("s-1", "2026-09-01", "2026-09-02", "total")
    assert body == {"storyUuid": "s-1", "from": "2026-09-01", "to": "2026-09-02", "groupBy": "total",
                    "rows": [{"period": "total", "matchesStarted": 2, "matchesCompleted": 1,
                              "completionRate": 0.5, "avgDurationMinutes": 1.25, "avgDurationClocks": 3.0,
                              "comaCount": 1}],
                    "choices": [{"uuid": "c-1", "count": 4}], "locations": [{"uuid": "l-1", "count": 1}],
                    "missions": [{"uuid": "m-1", "activated": 1, "completed": 1, "failed": 0}]}


def test_endpoint_bad_input_is_400():
    port = MagicMock()
    port.report.side_effect = KpiError("from must be a date")
    response = _client(port).get("/api/admin/reports/kpi", params={"from": "nope"})
    assert response.status_code == 400
    assert response.json()["error"] == "INVALID_INPUT"


# ── hooks ────────────────────────────────────────────────────────────────────

def test_start_stamps_and_counts_match_started():
    store, kpi = MagicMock(), MagicMock()
    store.find_user_id_by_uuid.return_value = USER_ID
    store.find_match_by_uuid.return_value = {"id": MATCH_ID, "uuid": "m-1", "status": "CREATED",
                                             "current_clock": 0, "id_user_creator": USER_ID}
    store.find_characters_by_match_id.return_value = [{"id": 10, "uuid": "c", "dexterity": 1,
                                                       "intelligence": 1, "constitution": 1, "life": 5}]
    service = TurnCycleService(store)
    service.set_kpi(kpi)
    service.start_match("m-1", "user-uuid")
    store.stamp_match_start.assert_called_once_with(MATCH_ID)
    kpi.record_for_match.assert_called_once_with(MATCH_ID, "MATCH_STARTED", None, 1)


def _end(match):
    persistence, story_read, users, kpi = MagicMock(), MagicMock(), MagicMock(), MagicMock()
    persistence.find_match_by_uuid.return_value = match
    users.find_by_uuid.return_value = {"id": USER_ID}
    story_read.find_story_by_id.return_value = {"id": 2, "uuid": "story-uuid", "id_event_end_game": 50}
    story_read.find_event_by_story_id_and_uuid.return_value = {"id": 50}
    service = MatchCommandService(story_read, persistence, users, MagicMock(), registry_service=MagicMock())
    service.set_kpi(kpi)
    assert service.end_match("m-1", "ev", "u") == "COMPLETED"
    return {c.args[1]: c.args for c in kpi.record.call_args_list}


def _match(**over):
    base = {"id": MATCH_ID, "id_user_creator": USER_ID, "id_story": 2, "status": "RUNNING", "current_clock": 4}
    base.update(over)
    return base


def test_end_counts_completion_and_both_durations():
    start = (datetime.now(timezone.utc) - timedelta(seconds=120)).isoformat()
    calls = _end(_match(timestamp_start=start))
    assert calls["MATCH_COMPLETED"] == ("story-uuid", "MATCH_COMPLETED", None, 1)
    assert 120_000 <= calls["DURATION_MS"][3] < 180_000
    assert calls["DURATION_CLOCKS"] == ("story-uuid", "DURATION_CLOCKS", None, 4)


def test_end_duration_falls_back_to_the_creation_and_skips_a_bad_stamp():
    created = (datetime.now(timezone.utc) - timedelta(seconds=60)).strftime("%Y-%m-%dT%H:%M:%S")
    assert _end(_match(ts_insert=created))["DURATION_MS"][3] >= 60_000
    assert "DURATION_MS" not in _end(_match(timestamp_start="not-a-date"))
    assert millis_since(None) is None and millis_since(" ") is None
    assert millis_since("2999-01-01T00:00:00Z") == 0


def test_end_of_a_match_already_over_counts_nothing():
    assert _end(_match(status="ENDED")) == {}


def test_edge_persist_counts_one_coma_and_never_an_overflow():
    kpi = MagicMock()
    coma = ese.evaluate(ese.CharacterState(1, 0, 0, 50, 10, False))
    overflow = ese.evaluate(ese.CharacterState(1, 30, 50, 50, 10, False))
    ese.persist(MagicMock(), MATCH_ID, coma, 9, 42, kpi)
    ese.persist(MagicMock(), MATCH_ID, overflow, 9, None, kpi)
    ese.persist(MagicMock(), MATCH_ID, coma, 9, 42)
    kpi.record_for_match.assert_called_once_with(MATCH_ID, "COMA", None, 1)


def test_recovery_passes_its_kpi_to_the_edge_rules():
    store, kpi = MagicMock(), MagicMock()
    store.load_recovery_context.return_value = {"id_story": 9, "difficulty_energy": 0, "current_clock": 4}
    store.find_recovery_characters.return_value = [{
        "id": 10, "uuid": "c", "id_location": 100, "id_class": 5, "dexterity": 1, "intelligence": 1,
        "constitution": 10, "energy": 10, "life": 8, "sad": 0, "energy_max": 100, "life_max": 100,
        "sad_max": 50, "is_coma": False}]
    store.find_location_safety.return_value = [{"id_location": 100, "secure_param": 0}]
    store.find_class_bonuses.return_value = [{"id_class": 5, "statistic": "sad", "value": 60}]
    store.find_state_locations.return_value = []
    service = TimeStartRecoveryService(store, MagicMock())
    service.kpi = kpi
    service.apply_at_time_start(MATCH_ID)
    kpi.record_for_match.assert_called_once_with(MATCH_ID, "COMA", None, 1)


def test_mission_transitions_count_active_completed_failed():
    kpi = MagicMock()
    service = MissionService(MagicMock())
    service.kpi = kpi
    service._record_transition(MATCH_ID, "m-1", None, "AVAILABLE")
    service._record_transition(MATCH_ID, "m-1", "AVAILABLE", "ACTIVE")
    service._record_transition(MATCH_ID, "m-1", "ACTIVE", "ACTIVE")
    service._record_transition(MATCH_ID, "m-1", "ACTIVE", "COMPLETED")
    service._record_transition(MATCH_ID, "m-2", "ACTIVE", "FAILED")
    assert [c.args for c in kpi.record_for_match.call_args_list] == [
        (MATCH_ID, "MISSION_ACTIVE", "m-1", 1), (MATCH_ID, "MISSION_COMPLETED", "m-1", 1),
        (MATCH_ID, "MISSION_FAILED", "m-2", 1)]


def test_mission_story_end_counts_failed_for_what_is_open():
    kpi, store = MagicMock(), MagicMock()
    store.find_story_id_by_match.return_value = None
    store.find_mission_states.return_value = [{"id_mission": 1, "status": "ACTIVE"},
                                              {"id_mission": 2, "status": "COMPLETED"}]
    service = MissionService(store)
    service.kpi = kpi
    service.on_story_end(MATCH_ID)
    kpi.record_for_match.assert_called_once_with(MATCH_ID, "MISSION_FAILED", "1", 1)
