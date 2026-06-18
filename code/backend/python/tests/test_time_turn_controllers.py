"""Unit tests for the time-clock and turn-cycle FastAPI controllers (Steps 24-25).

The controller methods read the authenticated user from ``request.state`` (set
by the JWT middleware in production). Here we drive them directly with a tiny
fake request + a stub port, covering the auth-missing, success and
``TurnCycleError`` → HTTP-status mappings without spinning up a server.
"""
import json
import types

from app.adapters.rest.match.time_clock_controller import TimeClockController
from app.adapters.rest.match.turn_cycle_controller import TurnCycleController
from app.core.models.match.time_models import ClockCharacter, ClockResult, SleepResult
from app.core.models.match.turn_models import (
    PassResult,
    TurnCycleError,
    TurnEntry,
    TurnSequenceResult,
)


def _req(user_uuid="user-1"):
    return types.SimpleNamespace(state=types.SimpleNamespace(user_uuid=user_uuid))


def _body(resp):
    return json.loads(resp.body)


# ── TimeClockController ─────────────────────────────────────────────────────────

class _TimePort:
    def __init__(self, *, sleep_result=None, clock_result=None, raise_exc=None):
        self._sleep = sleep_result
        self._clock = clock_result
        self._raise = raise_exc

    def sleep(self, uuid_match, user_uuid):
        if self._raise:
            raise self._raise
        return self._sleep

    def clock(self, uuid_match, user_uuid):
        if self._raise:
            raise self._raise
        return self._clock


def test_sleep_requires_authentication():
    ctrl = TimeClockController(_TimePort())
    resp = ctrl.sleep("m1", _req(user_uuid=None))
    assert resp.status_code == 401
    assert _body(resp)["error"] == "UNAUTHENTICATED"


def test_sleep_success():
    sr = SleepResult(match_uuid="m1", character_uuid="c1", is_sleeping=True,
                     time_end_triggered=False, current_clock=3)
    ctrl = TimeClockController(_TimePort(sleep_result=sr))
    resp = ctrl.sleep("m1", _req())
    assert resp.status_code == 200
    body = _body(resp)
    assert body["isSleeping"] is True and body["currentClock"] == 3


def test_sleep_maps_turn_cycle_error_to_409():
    err = TurnCycleError(TurnCycleError.MATCH_NOT_RUNNING, "not running")
    ctrl = TimeClockController(_TimePort(raise_exc=err))
    resp = ctrl.sleep("m1", _req())
    assert resp.status_code == 409
    assert _body(resp)["error"] == "MATCH_NOT_RUNNING"


def test_clock_success_and_auth():
    cr = ClockResult(match_uuid="m1", current_clock=4, clock_label_singular="hour",
                     clock_label_plural="hours", any_character_sleeping=True,
                     characters=[ClockCharacter(character_uuid="c1", is_sleeping=True, energy=2)])
    ctrl = TimeClockController(_TimePort(clock_result=cr))
    assert ctrl.clock("m1", _req(user_uuid=None)).status_code == 401
    resp = ctrl.clock("m1", _req())
    assert resp.status_code == 200
    body = _body(resp)
    assert body["clockLabelSingular"] == "hour"
    assert body["characters"][0]["characterUuid"] == "c1"


def test_clock_maps_not_found_to_404():
    err = TurnCycleError(TurnCycleError.MATCH_NOT_FOUND, "missing")
    ctrl = TimeClockController(_TimePort(raise_exc=err))
    resp = ctrl.clock("m1", _req())
    assert resp.status_code == 404


# ── TurnCycleController ─────────────────────────────────────────────────────────

class _TurnPort:
    def __init__(self, *, result=None, pass_result=None, raise_exc=None):
        self._result = result
        self._pass = pass_result
        self._raise = raise_exc

    def start_match(self, uuid_match, user_uuid):
        if self._raise:
            raise self._raise
        return self._result

    def pass_turn(self, uuid_match, user_uuid):
        if self._raise:
            raise self._raise
        return self._pass

    def get_turn_sequence(self, uuid_match, user_uuid):
        if self._raise:
            raise self._raise
        return self._result


def _sequence():
    return TurnSequenceResult(
        match_uuid="m1", current_clock=1, status="RUNNING", active_character_uuid="c1",
        queue=[TurnEntry(character_uuid="c1", id_character=1, name="Hero", priority=9,
                         clock=1, status="ACTIVE", pass_counter=0,
                         timestamp_start=None, timestamp_end=None)],
    )


def test_start_requires_authentication():
    ctrl = TurnCycleController(_TurnPort())
    assert ctrl.start("m1", _req(user_uuid=None)).status_code == 401


def test_start_success_serializes_queue():
    ctrl = TurnCycleController(_TurnPort(result=_sequence()))
    resp = ctrl.start("m1", _req())
    assert resp.status_code == 200
    body = _body(resp)
    assert body["activeCharacterUuid"] == "c1"
    assert body["queue"][0]["name"] == "Hero"


def test_start_maps_not_startable_to_409():
    err = TurnCycleError(TurnCycleError.MATCH_NOT_STARTABLE, "nope")
    ctrl = TurnCycleController(_TurnPort(raise_exc=err))
    assert ctrl.start("m1", _req()).status_code == 409


def test_pass_turn_success_and_auth():
    pr = PassResult(match_uuid="m1", passed_character_uuid="c1",
                    next_active_character_uuid="c2", status="RUNNING")
    ctrl = TurnCycleController(_TurnPort(pass_result=pr))
    assert ctrl.pass_turn("m1", _req(user_uuid=None)).status_code == 401
    resp = ctrl.pass_turn("m1", _req())
    assert resp.status_code == 200
    assert _body(resp)["nextActiveCharacterUuid"] == "c2"


def test_pass_turn_maps_not_your_turn_to_409():
    err = TurnCycleError(TurnCycleError.NOT_YOUR_TURN, "wait")
    ctrl = TurnCycleController(_TurnPort(raise_exc=err))
    assert ctrl.pass_turn("m1", _req()).status_code == 409


def test_turn_sequence_success_and_auth():
    ctrl = TurnCycleController(_TurnPort(result=_sequence()))
    assert ctrl.turn_sequence("m1", _req(user_uuid=None)).status_code == 401
    resp = ctrl.turn_sequence("m1", _req())
    assert resp.status_code == 200
    assert _body(resp)["status"] == "RUNNING"


def test_turn_sequence_maps_unknown_error_to_400():
    err = TurnCycleError("SOMETHING_ELSE", "weird")
    ctrl = TurnCycleController(_TurnPort(raise_exc=err))
    assert ctrl.turn_sequence("m1", _req()).status_code == 400
