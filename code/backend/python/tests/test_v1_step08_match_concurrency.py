"""V1 step 8 (1.7.0): the same match on several devices: If-Match, the claim before the first write,
409 STALE_MATCH, matchVersion in the answers and the echo refetch parameters."""
import asyncio
import threading
from datetime import datetime, timedelta
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.adapters.persistence.match.models  # noqa: F401  registers gaming_* tables
import app.adapters.persistence.story.models  # noqa: F401  registers list_* tables
from app import launcher
from app.adapters.persistence.auth.models import Base
from app.adapters.persistence.match.match_persistence_adapter import MatchPersistenceAdapter
from app.adapters.persistence.match.match_stamp_store_adapter import MatchStampStoreAdapter
from app.adapters.rest.echo_controller import EchoController
from app.adapters.rest.match.match_controller import _detail_to_camel, _summary_to_camel
from app.adapters.rest.middleware import request_stamp_middleware as rsm
from app.core.models.match.match_models import MatchDetail, MatchSummary
from app.core.models.match.stale_match import STALE_MATCH, StaleMatchError
from app.core.models.match.turn_models import TurnCycleError
from app.core.ports.echo_port import EchoPort
from app.core.services.echo_service import EchoService
from app.core.services.match import match_stamp as ms
from app.core.services.match.turn_cycle_service import TurnCycleService

V1 = "2026-10-22T10:00:00+00:00"
V2 = "2026-10-22T10:00:07+00:00"


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    yield sessionmaker(bind=engine, autocommit=False, autoflush=False)
    engine.dispose()


@pytest.fixture()
def request_ctx():
    tokens = []

    def open_(if_match=None):
        tokens.append(ms.open_stamp(if_match))

    yield open_
    for token in reversed(tokens):
        ms.close_stamp(token)


# ── request context ──────────────────────────────────────────────────────────

@pytest.mark.parametrize("raw, expected", [
    (None, None), ("", None), ("*", None), ('""', None), ('"v1"', "v1"), ('W/"v1"', "v1"), (" v2 ", "v2"),
    ('"', '"')])
def test_if_match_is_normalized(raw, expected):
    assert ms.normalize_if_match(raw) == expected


def test_seen_and_claimed_live_only_inside_a_request(request_ctx):
    ms.record_seen("m", "s")
    ms.record_claim("m", "c")
    assert ms.seen_version("m") is None and ms.claimed_version() is None and ms.if_match() is None
    request_ctx('"v"')
    assert ms.if_match() == "v"
    ms.record_seen("m", "s")
    assert ms.seen_version("m") == "s" and ms.seen_version("x") is None and ms.seen_version(None) is None
    ms.record_claim("m", "c")
    assert ms.claimed_version("m") == "c" and ms.claimed_version("x") is None and ms.claimed_version() == "c"
    assert ms.request_now() == "c"


def test_next_version_is_strictly_greater():
    assert ms.next_version(V1, V2) == V2
    assert ms.next_version(V1, V1) == "2026-10-22T10:00:00.000001+00:00"
    assert ms.next_version(V2, V1) == "2026-10-22T10:00:07.000001+00:00"
    assert ms.next_version("garbage", V2) == V2
    assert ms.next_version(None, V2) == V2
    assert ms.parse_ts(ms.next_version("2026-10-22 10:00:00", "bad")) > ms.parse_ts("2026-10-22T10:00:00Z")


# ── check and claim ──────────────────────────────────────────────────────────

class _Store:
    def __init__(self, *versions, wins=True):
        self.versions, self.wins, self.claims, self.stamps = list(versions), wins, [], []

    def find_ts_update(self, match_uuid):
        return self.versions.pop(0) if len(self.versions) > 1 else (self.versions[0] if self.versions else None)

    def claim(self, match_uuid, old, new, delta):
        self.claims.append((match_uuid, old, new, delta))
        return self.wins

    def stamp(self, match_uuid, ts_update, delta):
        self.stamps.append((match_uuid, ts_update, delta))
        return True


def test_claim_success_records_the_new_version(request_ctx):
    request_ctx(V1)
    store = _Store(V1)
    service = ms.MatchStampService(store, 300)
    new = service.claim_gameplay("m")
    assert store.claims == [("m", V1, new, ms.play_delta(V1, new, 300_000))]
    assert ms.claimed_version("m") == new and ms.parse_ts(new) > ms.parse_ts(V1)
    assert service.claim_gameplay("m") == new and service.check_gameplay("m") == new
    assert len(store.claims) == 1


def test_a_stale_header_fails_fast_without_writing(request_ctx):
    request_ctx("2026-10-22T09:00:00+00:00")
    store = _Store(V1)
    with pytest.raises(StaleMatchError) as err:
        ms.MatchStampService(store, 300).check_gameplay("m")
    assert err.value.current_version == V1 and err.value.code == STALE_MATCH and err.value.match_uuid == "m"
    assert store.claims == [] and ms.seen_version("m") is None


def test_without_header_a_lost_race_is_stale_with_the_winner_version(request_ctx):
    request_ctx()
    store = _Store(V1, V2, wins=False)
    service = ms.MatchStampService(store, 300)
    assert service.check_gameplay("m") == V1
    with pytest.raises(StaleMatchError) as err:
        service.claim_gameplay("m")
    assert err.value.current_version == V2
    assert store.claims[0][1] == V1 and ms.claimed_version() is None


def test_unknown_blank_and_no_port():
    service = ms.MatchStampService(_Store(), 300)
    assert service.check_gameplay("gone") is None and service.claim_gameplay("gone") is None
    assert service.check_gameplay("") is None and service.claim_gameplay(None) is None
    bare = object()
    assert ms.stamp_check(bare, "m") is None and ms.stamp_claim(bare, "m") is None
    holder = MagicMock()
    holder.match_stamp.check_gameplay.return_value = "c"
    holder.match_stamp.claim_gameplay.return_value = "v"
    assert ms.stamp_check(holder, "m") == "c" and ms.stamp_claim(holder, "m") == "v"


def test_admin_writes_move_the_version_without_check(request_ctx):
    request_ctx("2000-01-01T00:00:00+00:00")
    store = _Store(V1)
    ms.MatchStampService(store, 300).touch_admin("m")
    assert store.claims == [] and store.stamps[0][0] == "m" and store.stamps[0][2] == 0


def test_the_store_claim_is_a_conditional_update(db):
    saved = MatchPersistenceAdapter(db).save_match({"id_story": 1, "id_difficulty": 2, "id_user_creator": 7,
                                                    "status": "RUNNING"})
    store = MatchStampStoreAdapter(db)
    old = store.find_ts_update(saved["uuid"])
    assert store.claim(saved["uuid"], old, V1, 10) is True
    assert store.claim(saved["uuid"], old, V2, 10) is False
    assert store.find_ts_update(saved["uuid"]) == V1
    assert store.claim("none", V1, V2, 1) is False


def test_two_threads_with_the_same_version_only_one_wins(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'race.sqlite'}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    saved = MatchPersistenceAdapter(factory).save_match({"id_story": 1, "id_difficulty": 2, "id_user_creator": 7,
                                                         "status": "RUNNING"})
    store = MatchStampStoreAdapter(factory)
    old = store.find_ts_update(saved["uuid"])
    barrier, results = threading.Barrier(2), []

    def play(version):
        barrier.wait()
        results.append(store.claim(saved["uuid"], old, version, 1))

    threads = [threading.Thread(target=play, args=(v,)) for v in (V1, V2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    engine.dispose()
    assert sorted(results) == [False, True]


# ── a command with the real stamp service ───────────────────────────────────

def _turn_service(stamp_store, active_user=7, status="RUNNING"):
    store = MagicMock()
    store.find_user_id_by_uuid.return_value = 7
    store.find_match_by_uuid.return_value = {"id": 1, "uuid": "m", "status": status, "current_clock": 0,
                                             "id_user_creator": 7, "id_character_current_turn": 10}
    store.find_characters_by_match_id.return_value = [
        {"id": 10, "uuid": "c10", "id_user": active_user}, {"id": 20, "uuid": "c20", "id_user": 7}]
    store.find_queue_by_match_id.return_value = [
        {"id_character_match": 10, "status": "ACTIVE", "priority": 9, "clock": 0, "pass_counter": 0},
        {"id_character_match": 20, "status": "WAITING", "priority": 1, "clock": 0, "pass_counter": 0}]
    service = TurnCycleService(store)
    service.match_stamp = ms.MatchStampService(stamp_store, 300)
    return service, store


def test_the_claim_runs_before_the_first_write(request_ctx):
    request_ctx(V1)
    order = []
    stamp_store = _Store(V1)
    stamp_store.claim = lambda *a: order.append("claim") or True
    service, store = _turn_service(stamp_store)
    store.save_queue_row.side_effect = lambda *a: order.append("write")
    service.pass_turn("m", "u")
    assert order[0] == "claim" and "write" in order and ms.claimed_version("m") is not None


def test_a_stale_header_wins_over_the_domain_refusal(request_ctx):
    request_ctx("2026-10-22T09:00:00+00:00")
    service, store = _turn_service(_Store(V1), active_user=99)
    with pytest.raises(StaleMatchError):
        service.pass_turn("m", "u")
    store.save_queue_row.assert_not_called()


def test_a_domain_refusal_with_a_fresh_header_leaves_the_version(request_ctx):
    request_ctx(V1)
    stamp_store = _Store(V1)
    service, _ = _turn_service(stamp_store, active_user=99)
    with pytest.raises(TurnCycleError) as err:
        service.pass_turn("m", "u")
    assert err.value.code == TurnCycleError.NOT_YOUR_TURN and stamp_store.claims == []


def test_the_terminal_state_wins_over_stale(request_ctx):
    request_ctx("2026-10-22T09:00:00+00:00")
    service, _ = _turn_service(_Store(V1), status="ENDED")
    with pytest.raises(TurnCycleError) as err:
        service.pass_turn("m", "u")
    assert err.value.code == TurnCycleError.MATCH_NOT_RUNNING


# ── REST: middleware, handler, answers, echo ────────────────────────────────

def _app():
    app = FastAPI()
    app.add_exception_handler(StaleMatchError, launcher._stale_match_handler)

    @app.post("/claim")
    async def claim():
        assert ms.if_match() == "v1"
        ms.record_claim("m", "v2")
        return {"uuid": "m"}

    @app.post("/claim-sync")
    def claim_sync():
        ms.record_claim("m", "v3")
        return JSONResponse(status_code=409, content={"error": "NOT_YOUR_TURN"})

    @app.post("/stale")
    async def stale():
        raise StaleMatchError("m", "v9")

    @app.get("/list")
    async def as_list():
        ms.record_claim("m", "v2")
        return ["x"]

    @app.get("/text")
    async def as_text():
        ms.record_claim("m", "v2")
        return PlainTextResponse("ok")

    @app.get("/plain")
    async def plain():
        return {"uuid": "m"}

    app.add_middleware(rsm.RequestStampMiddleware)
    return TestClient(app)


def test_the_answer_of_a_claiming_request_carries_the_version():
    client = _app()
    res = client.post("/claim", headers={"If-Match": '"v1"'})
    assert res.json() == {"uuid": "m", "matchVersion": "v2"}
    assert res.headers["content-length"] == str(len(res.content))
    res = client.post("/claim-sync")
    assert res.status_code == 409 and res.json()["matchVersion"] == "v3"


def test_stale_answers_409_with_the_current_version():
    body = _app().post("/stale").json()
    assert body["error"] == "STALE_MATCH" and body["matchVersion"] == "v9" and body["timestamp"] > 0


def test_other_answers_are_untouched():
    client = _app()
    assert client.get("/list").json() == ["x"]
    assert client.get("/text").text == "ok"
    assert "matchVersion" not in client.get("/plain").json()
    assert rsm.with_version(b"not json", "v") == b"not json"
    assert rsm.with_version(b'{"matchVersion":"a"}', "v") == b'{"matchVersion":"a"}'


def test_a_body_in_chunks_is_joined():
    sent = []

    async def send(message):
        sent.append(message)

    async def inner(scope, receive, send_):
        ms.record_claim("m", "v2")
        await send_({"type": "http.response.start", "status": 200,
                     "headers": [(b"content-type", b"application/json"), (b"content-length", b"9")]})
        await send_({"type": "http.response.body", "body": b'{"a":', "more_body": True})
        await send_({"type": "http.response.body", "body": b"1}"})

    asyncio.run(rsm.RequestStampMiddleware(inner)({"type": "http", "headers": []}, None, send))
    assert sent[1]["body"] == b'{"a":1,"matchVersion":"v2"}'
    assert (b"content-length", str(len(sent[1]["body"])).encode()) in sent[0]["headers"]


def test_match_version_in_summary_and_info():
    summary = MatchSummary(uuid="m", story_uuid=None, difficulty_uuid=None, name=None, status="RUNNING",
                           current_clock=0, exp_cost=5, user_creator_uuid="u", ts_insert="t", match_version=V1)
    assert _summary_to_camel(summary)["matchVersion"] == V1
    detail = MatchDetail(match=summary)
    assert _detail_to_camel(detail)["matchVersion"] == V1


def test_echo_refetch_parameters():
    service = EchoService("OK", {})
    service.set_match_refetch(None, -1)
    assert service.get_match_refetch_browsers() == ["webkit"] and service.get_match_refetch_min_hidden_seconds() == 30
    service.set_match_refetch(["all"], 45)
    app = FastAPI()
    app.include_router(EchoController(service).router)
    body = TestClient(app).get("/api/echo/status").json()
    assert body["matchRefetchBrowsers"] == ["all"] and body["matchRefetchMinHiddenSeconds"] == 45

    class Bare(EchoPort):
        def get_server_status(self):
            return "OK"

        def get_timestamp(self):
            return 0

        def get_server_properties(self):
            return {}

    assert Bare().get_match_refetch_browsers() == ["webkit"] and Bare().get_match_refetch_min_hidden_seconds() == 30


def test_the_launcher_wires_the_echo_parameters():
    assert launcher.echo_service.get_match_refetch_browsers() == ["webkit"]
    assert launcher.echo_service.get_match_refetch_min_hidden_seconds() == 30
    assert datetime.fromisoformat(V2) - datetime.fromisoformat(V1) == timedelta(seconds=7)
