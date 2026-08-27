"""Tests for the FastAPI match ADMIN controller — Step 20.x.

These admin-only endpoints were extracted from ``match_controller`` into
``match_admin_controller`` so they can be served on the dedicated admin app/port.
"""
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.adapters.rest.match.match_admin_controller import MatchAdminController
from app.core.models.match.match_models import (
    MatchDetail,
    MatchEventOption,
    MatchListFilter,
    MatchLocationState,
    MatchRegistryEntry,
    MatchSummary,
    MatchSummaryPage,
)


@pytest.fixture()
def env():
    command_port = MagicMock()
    query_port = MagicMock()
    controller = MatchAdminController(command_port, query_port)
    app = FastAPI()
    app.include_router(controller.router)
    return TestClient(app), command_port, query_port


def _summary():
    return MatchSummary(
        uuid="match-uuid",
        story_uuid="story-uuid",
        difficulty_uuid="diff-uuid",
        name="n",
        status="CREATED",
        current_clock=0,
        exp_cost=5,
        user_creator_uuid="user-uuid",
        ts_insert="now",
        single_player=1,
        character_template_uuid="ct",
        class_uuid="cl",
        trait_uuids=["t1", "t2"],
    )


def _detail():
    return MatchDetail(
        match=_summary(),
        current_location_id=10,
        current_location_uuid="loc-uuid",
        locations=[MatchLocationState(10, "ls", 0, 5)],
        registry=[MatchRegistryEntry("r", "k", "v", 1)],
        events=[MatchEventOption("e", "n", "EVENT")],
        choices=[MatchEventOption("c", "n", "CHOICE")],
    )


def test_list_all_matches_returns_envelope(env):
    client, _, query_port = env
    query_port.list_matches_page.return_value = MatchSummaryPage(
        items=[_summary()], next_cursor="next-tok", limit=50)
    response = client.get("/api/admin/matches")
    assert response.status_code == 200
    body = response.json()
    assert body["items"][0]["uuid"] == "match-uuid"
    assert body["nextCursor"] == "next-tok"
    assert body["limit"] == 50


def test_list_all_matches_empty_envelope(env):
    client, _, query_port = env
    query_port.list_matches_page.return_value = MatchSummaryPage(
        items=[], next_cursor=None, limit=50)
    body = client.get("/api/admin/matches").json()
    assert body == {"items": [], "nextCursor": None, "limit": 50}


def test_list_all_matches_forwards_query_params(env):
    client, _, query_port = env
    query_port.list_matches_page.return_value = MatchSummaryPage(
        items=[], next_cursor=None, limit=25)
    response = client.get("/api/admin/matches", params={
        "limit": 25, "cursor": "cur-1", "status": "RUNNING",
        "userUuid": "u-9", "storyUuid": "s-7", "sinceDays": 7,
    })
    assert response.status_code == 200
    query_port.list_matches_page.assert_called_once()
    sent = query_port.list_matches_page.call_args.args[0]
    assert sent == MatchListFilter(status="RUNNING", user_uuid="u-9", story_uuid="s-7",
                                   since_days=7, cursor="cur-1", limit=25)


def test_list_match_statuses(env):
    client, _, _ = env
    resp = client.get("/api/admin/matches/statuses")
    assert resp.status_code == 200
    data = resp.json()
    assert data[0] == {"value": "CREATED", "terminal": False}
    assert {"value": "ENDED", "terminal": True} in data


def test_update_match_returns_200(env):
    client, command_port, _ = env
    command_port.update_match.return_value = "UPDATED"
    resp = client.put("/api/admin/matches/m1", json={"status": "ENDED", "name": "x"})
    assert resp.status_code == 200
    assert resp.json() == {"status": "UPDATED", "uuid": "m1"}
    command_port.update_match.assert_called_once_with("m1", "ENDED", "x")


def test_update_match_empty_body_returns_400(env):
    client, _, _ = env
    resp = client.put("/api/admin/matches/m1", json={})
    assert resp.status_code == 400
    assert resp.json()["error"] == "INVALID_INPUT"


def test_update_match_invalid_status_returns_400(env):
    client, command_port, _ = env
    command_port.update_match.return_value = "INVALID_STATUS"
    resp = client.put("/api/admin/matches/m1", json={"status": "BOGUS"})
    assert resp.status_code == 400
    assert resp.json()["error"] == "INVALID_STATUS"


def test_update_match_not_found_returns_404(env):
    client, command_port, _ = env
    command_port.update_match.return_value = "NOT_FOUND"
    resp = client.put("/api/admin/matches/m1", json={"name": "x"})
    assert resp.status_code == 404


def test_stop_match_sets_ended(env):
    client, command_port, _ = env
    command_port.update_match.return_value = "UPDATED"
    resp = client.post("/api/admin/matches/m1/stop")
    assert resp.status_code == 200
    command_port.update_match.assert_called_once_with("m1", "ENDED", None)


def test_pause_and_resume(env):
    client, command_port, _ = env
    command_port.update_match.return_value = "UPDATED"
    client.post("/api/admin/matches/m1/pause")
    client.post("/api/admin/matches/m1/resume")
    command_port.update_match.assert_any_call("m1", "PAUSED", None)
    command_port.update_match.assert_any_call("m1", "RUNNING", None)


def test_delete_match_returns_200(env):
    client, command_port, _ = env
    command_port.delete_match.return_value = "DELETED"
    resp = client.delete("/api/admin/matches/m1")
    assert resp.status_code == 200
    assert resp.json()["status"] == "DELETED"


def test_delete_match_not_stopped_returns_409(env):
    client, command_port, _ = env
    command_port.delete_match.return_value = "NOT_STOPPED"
    resp = client.delete("/api/admin/matches/m1")
    assert resp.status_code == 409
    assert resp.json()["error"] == "MATCH_NOT_STOPPED"


def test_delete_match_not_found_returns_404(env):
    client, command_port, _ = env
    command_port.delete_match.return_value = "NOT_FOUND"
    resp = client.delete("/api/admin/matches/m1")
    assert resp.status_code == 404


def test_get_admin_match_info_returns_200(env):
    client, _, query_port = env
    query_port.get_match_info_for_admin.return_value = _detail()
    resp = client.get('/api/admin/matches/m1/info')
    assert resp.status_code == 200
    assert resp.json()['match']['uuid'] == 'match-uuid'
    query_port.get_match_info_for_admin.assert_called_once_with('m1')


def test_get_admin_match_info_returns_404(env):
    client, _, query_port = env
    query_port.get_match_info_for_admin.return_value = None
    resp = client.get('/api/admin/matches/m1/info')
    assert resp.status_code == 404
    assert resp.json()['error'] == 'MATCH_NOT_FOUND'


# ── Step 28.7 — GET /api/admin/matches/{uuid}/logs ──────────────────────────

@pytest.fixture()
def logs_env():
    """Same admin app as ``env`` but with a match-logs service wired in."""
    logs_service = MagicMock()
    controller = MatchAdminController(MagicMock(), MagicMock(),
                                      match_logs_service=logs_service)
    app = FastAPI()
    app.include_router(controller.router)
    return TestClient(app), logs_service


def test_get_admin_match_logs_returns_200(logs_env):
    client, logs_service = logs_env
    logs_service.get_match_logs_for_admin.return_value = {
        "matchUuid": "m1", "currentClock": 0, "logs": [],
    }
    resp = client.get("/api/admin/matches/m1/logs")
    assert resp.status_code == 200
    assert resp.json()["matchUuid"] == "m1"
    logs_service.get_match_logs_for_admin.assert_called_once_with("m1", "en", None, None, None)


def test_get_admin_match_logs_passes_lang_limit_cursor_and_order(logs_env):
    client, logs_service = logs_env
    logs_service.get_match_logs_for_admin.return_value = {
        "matchUuid": "m1", "currentClock": 0, "logs": [],
        "nextCursor": "next", "limit": 10, "total": 42,
    }
    resp = client.get("/api/admin/matches/m1/logs?lang=it&limit=10&cursor=cur&order=desc")
    assert resp.status_code == 200
    assert resp.json()["nextCursor"] == "next"
    logs_service.get_match_logs_for_admin.assert_called_once_with("m1", "it", 10, "cur", "desc")


def test_get_admin_match_logs_unknown_match_returns_404(logs_env):
    client, logs_service = logs_env
    logs_service.get_match_logs_for_admin.return_value = None
    resp = client.get("/api/admin/matches/m1/logs")
    assert resp.status_code == 404
    assert resp.json()["error"] == "MATCH_NOT_FOUND"


def test_get_admin_match_logs_without_service_returns_501(env):
    client, _, _ = env
    resp = client.get("/api/admin/matches/m1/logs")
    assert resp.status_code == 501
    assert resp.json()["error"] == "NOT_IMPLEMENTED"
