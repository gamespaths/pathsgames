"""Step 27 — FastAPI controller exposing the current weather of a match.

Endpoint (player, Bearer access token):
  GET /api/matches/{uuid}/weather  -> 200 | 404

The active weather is returned with its ``idCard`` and the resolved ``card``
(image, title, description, icon) so the frontend can render the real weather
card instead of a placeholder.
"""
import time
from dataclasses import asdict

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse

#: v1.11.0 the answer for a match the caller did not create (the 404 of the other match reads)
_NOT_ACCESSIBLE = {"error": "MATCH_NOT_FOUND", "message": "Match not found or not accessible"}


class WeatherController:
    def __init__(self, weather_service, content_query_service=None, match_persistence=None, user_access=None):
        self.weather_service = weather_service
        self.content_query_service = content_query_service
        # v1.11.0 the creator of the match: the weather is read by the owner only
        self.match_persistence = match_persistence
        self.user_access = user_access
        self.router = APIRouter()
        self.router.add_api_route(
            "/api/matches/{uuid}/weather", self.weather, methods=["GET"]
        )

    def _weather_to_camel(self, w: dict, lang: str) -> dict:
        card = None
        if self.content_query_service is not None and w.get("id_card") is not None:
            resolved = self.content_query_service.get_card_by_story_id_and_card_id(
                w.get("id_story"), w.get("id_card"), lang)
            if resolved is not None:
                card = asdict(resolved)
        return {
            "idWeather": w.get("id_weather"),
            "uuid": w.get("uuid"),
            "idTextName": w.get("id_text_name"),
            "idCard": w.get("id_card"),
            "card": card,
            "deltaEnergy": w.get("delta_energy"),
            "costMoveSafeLocation": w.get("cost_move_safe_location"),
            "costMoveNotSafeLocation": w.get("cost_move_not_safe_location"),
            "currentClock": w.get("current_clock"),
        }

    def _owned_by(self, match_uuid: str, user_uuid) -> bool:
        if not user_uuid or self.match_persistence is None or self.user_access is None:
            return False
        user = self.user_access.find_by_uuid(user_uuid)
        match = self.match_persistence.find_match_by_uuid(match_uuid)
        return bool(user and match and match.get("id_user_creator") == user.get("id"))

    def weather(self, uuid: str, request: Request, lang: str = Query("en")):
        if not self._owned_by(uuid, getattr(request.state, "user_uuid", None)):
            return JSONResponse(status_code=404, content={**_NOT_ACCESSIBLE, "timestamp": int(time.time() * 1000)})
        current = self.weather_service.current_weather(uuid)
        if current is None:
            return JSONResponse(
                status_code=404,
                content={"error": "WEATHER_NOT_FOUND",
                         "message": "No weather is currently set for this match",
                         "timestamp": int(time.time() * 1000)},
            )
        return JSONResponse(status_code=200, content=self._weather_to_camel(current, lang or "en"))
