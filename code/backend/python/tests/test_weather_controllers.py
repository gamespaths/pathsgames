"""Step 27 — unit tests for the weather REST + admin controllers."""
import json

from app.adapters.rest.match.weather_controller import WeatherController
from app.adapters.rest.match.match_admin_controller import MatchAdminController


class FakeWeatherService:
    def __init__(self, current=None, admin=None):
        self._current = current
        self._admin = admin

    def current_weather(self, uuid):
        return self._current

    def weather_admin(self, uuid):
        return self._admin


def _body(resp):
    return json.loads(bytes(resp.body))


class _Matches:
    def find_match_by_uuid(self, uuid):
        return {"id_user_creator": 5} if uuid == "m-1" else None


class _Users:
    def find_by_uuid(self, uuid):
        return {"owner": {"id": 5}, "other": {"id": 6}}.get(uuid)


def _request(user="owner"):
    from types import SimpleNamespace
    return SimpleNamespace(state=SimpleNamespace(user_uuid=user))


def _controller(svc, content=None):
    return WeatherController(svc, content, _Matches(), _Users())


class FakeContentService:
    def get_card_by_story_id_and_card_id(self, story_id, id_card, lang):
        from dataclasses import dataclass, field
        @dataclass
        class C:
            uuid: str = "card-9"
            cardType: str = "weather"
            urlImage: str = "http://img"
            title: str = "Storm"
        return C()


def test_weather_controller_returns_200_with_resolved_card():
    svc = FakeWeatherService(current={
        "id_weather": 9, "uuid": "w-9", "id_story": 7, "id_card": 55, "id_text_name": 100,
        "delta_energy": -5, "current_clock": 3})
    resp = _controller(svc, FakeContentService()).weather("m-1", _request())
    assert resp.status_code == 200
    body = _body(resp)
    assert body["idWeather"] == 9
    assert body["idCard"] == 55
    assert body["card"]["urlImage"] == "http://img"
    assert body["card"]["title"] == "Storm"
    assert body["deltaEnergy"] == -5
    assert body["currentClock"] == 3


def test_weather_controller_card_null_without_content_service():
    svc = FakeWeatherService(current={
        "id_weather": 9, "uuid": "w-9", "id_story": 7, "id_card": 55,
        "delta_energy": -5, "current_clock": 3})
    resp = _controller(svc).weather("m-1", _request())
    assert _body(resp)["card"] is None


def test_weather_controller_returns_404_when_none():
    resp = _controller(FakeWeatherService(current=None)).weather("m-1", _request())
    assert resp.status_code == 404
    assert _body(resp)["error"] == "WEATHER_NOT_FOUND"


def test_v1_11_weather_of_a_match_the_caller_did_not_create_is_404():
    svc = FakeWeatherService(current={"id_weather": 9, "uuid": "w-9", "current_clock": 3})
    for controller, match, user in ((_controller(svc), "m-1", "other"), (_controller(svc), "m-1", "nobody"),
                                    (_controller(svc), "m-9", "owner"), (_controller(svc), "m-1", None),
                                    (WeatherController(svc), "m-1", "owner")):
        resp = controller.weather(match, _request(user))
        assert resp.status_code == 404 and _body(resp)["error"] == "MATCH_NOT_FOUND"


def test_admin_weather_returns_200_with_seed_current_rules_and_log():
    svc = FakeWeatherService(admin={
        "rng_seed": 42,
        "current": {"id_weather": 9, "uuid": "w-9", "id_card": 55, "id_text_name": 100,
                    "delta_energy": -5, "current_clock": 3},
        "rules": [{"id": 9, "uuid": "w-9", "id_text_name": 100, "name": "Storm", "probability": 30,
                   "delta_energy": -5, "cost_move_safe_location": 1, "cost_move_not_safe_location": 3,
                   "active": True, "current": True},
                  {"id": 8, "uuid": "w-8", "id_text_name": 101, "name": "Clear", "probability": 70,
                   "delta_energy": 0, "cost_move_safe_location": 0, "cost_move_not_safe_location": 1,
                   "active": True, "current": False}],
        "log": [{"id": 1, "uuid": "l-1", "clock": 0, "id_weather": 9,
                 "weather_uuid": "w-9", "id_text_name": 100, "timestamp_start": "t"}],
    })
    ctrl = MatchAdminController(command_port=None, query_port=None,
                               character_command_port=None, weather_service=svc)
    resp = ctrl.get_admin_match_weather("m-1")
    assert resp.status_code == 200
    body = _body(resp)
    assert body["rngSeed"] == 42
    assert body["current"]["idWeather"] == 9
    assert body["current"]["idCard"] == 55
    assert len(body["rules"]) == 2
    assert body["rules"][0]["current"] is True
    assert body["rules"][0]["name"] == "Storm"
    assert body["rules"][0]["probability"] == 30
    assert body["rules"][0]["costMoveSafeLocation"] == 1
    assert body["rules"][0]["costMoveNotSafeLocation"] == 3
    assert body["log"][0]["weatherUuid"] == "w-9"


def test_admin_weather_returns_400_on_blank_uuid():
    ctrl = MatchAdminController(None, None, None, weather_service=FakeWeatherService())
    resp = ctrl.get_admin_match_weather("  ")
    assert resp.status_code == 400
    assert _body(resp)["error"] == "INVALID_INPUT"
