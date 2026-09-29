"""v0.41.1 Step 41 A — logging gaps: the writer port and adapter, the timeline mapping and the
service hooks (pass, lifecycle, admin actions, stats). Mirrors the Java tests of the same patch."""
import logging
from unittest.mock import MagicMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.adapters.persistence.auth.models import Base, User
from app.adapters.persistence.match.match_log_writer_adapter import MatchLogWriterAdapter
from app.adapters.persistence.match.models import (
    GamingMatchEntity, LogClockHistoryEntity, LogEventsEntity,
)
from app.core.models.match import turn_models as tm
from app.core.ports.match import log_writer_ports as lw
from app.core.services.match.character_command_service import CharacterCommandService
from app.core.services.match.match_command_service import MatchCommandService
from app.core.services.match.match_logs_service import MatchLogsService, step41_entry
from app.core.services.match.turn_cycle_service import TurnCycleService
import app.adapters.persistence.story.models  # noqa: F401  registers list_stories

MATCH_ID, MATCH_UUID, USER_ID, NOW = 500, "match-uuid", 7, "2024-01-01T00:00:00"


@pytest.fixture()
def session_factory():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    with factory() as s:
        s.add(User(id=USER_ID, uuid="user-uuid", username="guest", state=6))
        s.add(GamingMatchEntity(id=MATCH_ID, uuid=MATCH_UUID, id_story=1, id_difficulty=1,
                                status="RUNNING", current_clock=2, id_user_creator=USER_ID,
                                ts_insert=NOW, ts_update=NOW))
        s.commit()
    yield factory
    engine.dispose()


# ── port helpers ─────────────────────────────────────────────────────────────

def test_port_helpers_build_the_stored_messages():
    assert lw.lifecycle(lw.LIFECYCLE_STARTED) == "MATCH_STARTED"
    assert lw.admin(lw.ADMIN_STOP) == "ADMIN_STOP"
    assert lw.admin_status("paused") == "ADMIN_STATUS PAUSED"
    assert lw.snapshot_restored(5) == "ADMIN_SNAPSHOT_RESTORED clock=5"


def test_stats_message_lists_the_applied_fields_in_order():
    assert lw.stats_message({"coma": False, "energy": 100, "life": 1, "coin": 3,
                             "sleeping": False}) == \
        "ADMIN_STATS energy=100 life=1 coin=3 sleeping=false coma=false"
    assert lw.stats_message({"sleeping": True}) == "ADMIN_STATS sleeping=true"
    assert lw.stats_message({"dex": None}) is None


# ── adapter ──────────────────────────────────────────────────────────────────

def test_adapter_writes_one_log_events_row(session_factory):
    MatchLogWriterAdapter(session_factory).write(MATCH_ID, None, 9, 2, "MATCH_CREATED")
    with session_factory() as s:
        row = s.query(LogEventsEntity).one()
    assert (row.id_match, row.id_character_match, row.id_event, row.clock, row.log_message) == \
        (MATCH_ID, None, 9, 2, "MATCH_CREATED")
    assert row.timestamp and row.uuid


def test_adapter_counts_every_log_table_and_warns_once(session_factory, caplog):
    adapter = MatchLogWriterAdapter(session_factory, warn_rows=2)
    adapter.write(MATCH_ID, None, None, 0, "MATCH_CREATED")
    assert adapter.count_rows(MATCH_ID) == 1
    with session_factory() as s:
        s.add(LogClockHistoryEntity(id=1, id_match=MATCH_ID, uuid="c1", clock=1,
                                    timestamp_start=NOW, ts_insert=NOW, ts_update=NOW))
        s.commit()
    with caplog.at_level(logging.WARNING):
        assert adapter.count_rows(MATCH_ID) == 2
        assert adapter.count_rows(MATCH_ID) == 2
    assert [r.message for r in caplog.records if "LOG_SIZE" in r.message] == \
        [f"LOG_SIZE match {MATCH_ID} has 2 log rows (warn threshold 2)"]
    assert adapter.count_rows(999) == 0


def test_a_zero_threshold_switches_the_check_off(session_factory, caplog):
    adapter = MatchLogWriterAdapter(session_factory, warn_rows=0)
    adapter.write(MATCH_ID, None, None, 0, "MATCH_CREATED")
    with caplog.at_level(logging.WARNING):
        assert adapter.count_rows(MATCH_ID) == 1
    assert not [r for r in caplog.records if "LOG_SIZE" in r.message]


# ── timeline mapping ─────────────────────────────────────────────────────────

class _Row:
    def __init__(self, message, id_character=2, id_event=None):
        self.clock, self.timestamp = 4, NOW
        self.id_character_match, self.id_event, self.log_message = id_character, id_event, message


@pytest.mark.parametrize("message, entry_type, detail", [
    ("ACTION_PASS", "PASS", None),
    ("COMA 2", "EDGE_STATE", "COMA"),
    ("COMA_RECOVERED 2", "EDGE_STATE", "COMA_RECOVERED"),
    ("ALL_PLAYER_COMA 500", "EDGE_STATE", "ALL_PLAYER_COMA"),
    ("SADNESS_OVERFLOW 2", "EDGE_STATE", "SADNESS_OVERFLOW"),
    ("TRAIT_ADD trait-uuid", "TRAIT_CHANGE", "ADD trait-uuid"),
    ("TRAIT_REMOVE trait-uuid", "TRAIT_CHANGE", "REMOVE trait-uuid"),
    ("MATCH_CREATED", "MATCH_LIFECYCLE", "CREATED"),
    ("MATCH_ENDED", "MATCH_LIFECYCLE", "ENDED"),
    ("ADMIN_PAUSE", "ADMIN_ACTION", "PAUSE"),
    ("ADMIN_STATUS PAUSED", "ADMIN_ACTION", "STATUS PAUSED"),
    ("ADMIN_STATS life=3", "ADMIN_ACTION", "STATS life=3"),
    ("ADMIN_SNAPSHOT_RESTORED clock=3", "ADMIN_ACTION", "SNAPSHOT_RESTORED clock=3"),
])
def test_step41_rows_map_to_their_type(message, entry_type, detail):
    entry = step41_entry(_Row(message, id_event=9), message)
    assert (entry["type"], entry["message"], entry["clock"], entry["idEvent"]) == \
        (entry_type, detail, 4, 9)


@pytest.mark.parametrize("message", ["TRAIT_ADD", "COMATOSE 2", "weather event 7"])
def test_lookalikes_are_not_step41_rows(message):
    assert step41_entry(_Row(message), message) is None


def test_the_timeline_carries_the_step41_rows(session_factory):
    with session_factory() as s:
        for i, msg in enumerate(("MATCH_CREATED", "ACTION_PASS", "COMA 2")):
            s.add(LogEventsEntity(id=i + 1, id_match=MATCH_ID, uuid=f"e{i}",
                                  timestamp=f"2024-01-01T00:00:0{i}", log_message=msg,
                                  ts_insert=NOW, ts_update=NOW))
        s.commit()
    logs = MatchLogsService(session_factory).get_match_logs_for_admin(MATCH_UUID)["logs"]
    assert [(e["type"], e["message"]) for e in logs] == \
        [("MATCH_LIFECYCLE", "CREATED"), ("PASS", None), ("EDGE_STATE", "COMA")]


def test_equal_timestamps_keep_the_java_table_order_and_desc_reverses_it(session_factory):
    """v0.41.1 — ties read weather, clock, items, then log_events (Java's order); desc is the exact reverse."""
    from app.adapters.persistence.match.models import LogItemUsageEntity, LogWeatherEntity
    with session_factory() as s:
        s.add(LogEventsEntity(id=1, id_match=MATCH_ID, uuid="e1", timestamp=NOW,
                              log_message="MATCH_STARTED", ts_insert=NOW, ts_update=NOW))
        s.add(LogItemUsageEntity(id=1, id_match=MATCH_ID, uuid="i1", id_character_match=2,
                                 id_item=3, action="ADD", timestamp=NOW, ts_insert=NOW,
                                 ts_update=NOW))
        s.add(LogWeatherEntity(id=1, id_match=MATCH_ID, uuid="w1", clock=0, id_weather=1,
                               timestamp_start=NOW, ts_insert=NOW, ts_update=NOW))
        s.commit()
    service = MatchLogsService(session_factory)
    asc = [e["type"] for e in service.get_match_logs_for_admin(MATCH_UUID)["logs"]]
    desc = [e["type"] for e in service.get_match_logs_for_admin(MATCH_UUID, order="desc")["logs"]]
    assert asc == ["WEATHER", "ITEM_ADD", "MATCH_LIFECYCLE"]
    assert desc == list(reversed(asc))


def test_count_logs_for_admin(session_factory):
    assert MatchLogsService(session_factory).count_logs_for_admin(MATCH_UUID) is None
    writer = MagicMock()
    writer.count_rows.return_value = 17
    service = MatchLogsService(session_factory, log_writer=writer)
    assert service.count_logs_for_admin(MATCH_UUID) == 17
    writer.count_rows.assert_called_once_with(MATCH_ID)
    assert service.count_logs_for_admin("unknown") is None


# ── turn cycle ───────────────────────────────────────────────────────────────

class _TurnStore:
    def __init__(self, status):
        self.match = {"id": MATCH_ID, "uuid": MATCH_UUID, "status": status, "current_clock": 3,
                      "id_user_creator": USER_ID, "id_character_current_turn": 10}
        self.queue = [{"id_character_match": 10, "clock": 3, "priority": 5, "status": tm.ACTIVE,
                       "pass_counter": 0}]

    def find_match_by_uuid(self, uuid):
        return dict(self.match)

    def find_characters_by_match_id(self, id_match):
        return [{"id": 10, "uuid": "char-a", "id_user": USER_ID, "dexterity": 3,
                 "intelligence": 3, "constitution": 3, "life": 10}]

    def replace_queue(self, id_match, rows):
        self.queue = rows

    def find_queue_by_match_id(self, id_match):
        return [dict(r) for r in self.queue]

    def save_queue_row(self, id_match, row):
        pass

    def update_match_status_and_turn(self, id_match, status, current):
        pass

    def find_user_id_by_uuid(self, user_uuid):
        return USER_ID


def test_start_writes_match_started_before_the_weather():
    order = []
    writer, weather = MagicMock(), MagicMock()
    writer.write.side_effect = lambda *a: order.append(("row",) + a)
    weather.apply_at_time_start.side_effect = lambda *a: order.append(("weather",))
    service = TurnCycleService(_TurnStore("CREATED"), weather)
    service.set_log_writer(writer)
    service.start_match(MATCH_UUID, "user-uuid")
    assert order == [("row", MATCH_ID, None, None, 3, "MATCH_STARTED"), ("weather",)]


def test_pass_writes_action_pass_for_the_character_that_passed():
    writer = MagicMock()
    service = TurnCycleService(_TurnStore("RUNNING"))
    service.set_log_writer(writer)
    service.pass_turn(MATCH_UUID, "user-uuid")
    writer.write.assert_called_once_with(MATCH_ID, 10, None, 3, "ACTION_PASS")


# ── match command ────────────────────────────────────────────────────────────

def _command_service():
    persistence = MagicMock()
    persistence.find_match_by_uuid.return_value = {"id": MATCH_ID, "current_clock": None,
                                                   "id_user_creator": USER_ID, "id_story": 2}
    service = MatchCommandService(MagicMock(), persistence, MagicMock(), MagicMock(),
                                  registry_service=MagicMock())
    writer = MagicMock()
    service.set_log_writer(writer)
    return service, persistence, writer


def test_admin_actions_write_their_rows():
    service, persistence, writer = _command_service()
    persistence.update_match_fields.return_value = True
    assert service.update_match(MATCH_UUID, "PAUSED", None, lw.ADMIN_PAUSE) == "UPDATED"
    service.update_match(MATCH_UUID, "ENDED", "n")
    service.update_match(MATCH_UUID, None, "only a name")
    assert [c.args for c in writer.write.call_args_list] == [
        (MATCH_ID, None, None, 0, "ADMIN_PAUSE"), (MATCH_ID, None, None, 0, "ADMIN_STATUS ENDED")]


def test_an_unknown_or_invalid_update_writes_nothing():
    service, persistence, writer = _command_service()
    persistence.update_match_fields.return_value = False
    assert service.update_match(MATCH_UUID, "PAUSED", None, lw.ADMIN_PAUSE) == "NOT_FOUND"
    assert service.update_match(MATCH_UUID, "BOGUS", None) == "INVALID_STATUS"
    persistence.update_match_fields.return_value = True
    persistence.find_match_by_uuid.return_value = None
    service.update_match(MATCH_UUID, "PAUSED", None)
    writer.write.assert_not_called()


def test_the_log_writer_is_optional():
    service, persistence, _ = _command_service()
    service.set_log_writer(None)
    persistence.update_match_fields.return_value = True
    assert service.update_match(MATCH_UUID, "PAUSED", None, lw.ADMIN_PAUSE) == "UPDATED"


def test_create_and_end_write_the_lifecycle_rows():
    service, persistence, writer = _command_service()
    story_read = service.story_read_port
    service.user_access_port.find_by_uuid.return_value = {"id": USER_ID, "uuid": "u", "state": 2}
    service.system_mode_port.is_maintenance.return_value = False
    story_read.find_story_by_uuid.return_value = {"id": 2, "uuid": "s"}
    story_read.find_difficulty_by_uuid.return_value = {"id": 3, "uuid": "d", "exp_cost": 5}
    story_read.find_locations_by_story_id.return_value = [{"id": 10}]
    story_read.find_keys_by_story_id.return_value = []
    persistence.has_active_match_for_story.return_value = False
    persistence.save_match.return_value = {"id": 99, "uuid": "m", "status": "CREATED",
                                           "current_clock": 0, "exp_cost": 5, "ts_insert": NOW}
    from app.core.models.match.match_models import MatchCreateCommand
    service.create_match(MatchCreateCommand(user_uuid="u", story_uuid="s", difficulty_uuid="d"))
    writer.write.assert_called_once_with(99, None, None, 0, "MATCH_CREATED")

    writer.reset_mock()
    story_read.find_story_by_id.return_value = {"id": 2, "id_event_end_game": 50}
    story_read.find_event_by_story_id_and_uuid.return_value = {"id": 50}
    service.user_access_port.find_by_uuid.return_value = {"id": USER_ID}
    assert service.end_match(MATCH_UUID, "ev", "u") == "COMPLETED"
    writer.write.assert_called_once_with(MATCH_ID, None, None, 0, "MATCH_ENDED")


# ── change statistics ────────────────────────────────────────────────────────

def _stats_env(writer=None):
    match_p, char_p = MagicMock(), MagicMock()
    match_p.find_match_by_uuid.return_value = {"id": 1, "current_clock": 6}
    char_p.find_character_by_match_and_uuid.return_value = {
        "id": 2, "uuid": "p", "energy_max": 100, "life_max": 120, "sad_max": 8, "life": 0}
    service = CharacterCommandService(story_read_port=MagicMock(), match_persistence_port=match_p,
                                      user_access_port=MagicMock(), character_persistence_port=char_p)
    if writer is not None:
        service.set_log_writer(writer)
    return service


def test_change_statistics_writes_one_admin_stats_row():
    writer = MagicMock()
    _stats_env(writer).change_statistics("m", "p", None, None, None, 500, None, None, 3, None,
                                         None, coma=False)
    writer.write.assert_called_once_with(
        1, 2, None, 6, "ADMIN_STATS energy=100 life=1 coin=3 sleeping=false coma=false")


def test_an_empty_change_writes_no_row_and_the_writer_is_optional():
    writer = MagicMock()
    assert _stats_env(writer).change_statistics(
        "m", "p", None, None, None, None, None, None, None, None, None) == "UPDATED"
    writer.write.assert_not_called()
    assert _stats_env().change_statistics(
        "m", "p", None, None, None, 5, None, None, None, None, None) == "UPDATED"
