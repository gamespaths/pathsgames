"""Step 27 — FastAPI controller exposing the current weather of a match.

Endpoint (player, Bearer access token):
  GET /api/matches/{uuid}/weather  -> 200 | 404

The active weather is returned with its ``idCard`` and the resolved ``card``
(image, title, description, icon) so the frontend can render the real weather
card instead of a placeholder.
"""
import time
from dataclasses import asdict

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse


class WeatherController:
    def __init__(self, weather_service, content_query_service=None):
        self.weather_service = weather_service
        self.content_query_service = content_query_service
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

    def weather(self, uuid: str, lang: str = Query("en")):
        current = self.weather_service.current_weather(uuid)
        if current is None:
            return JSONResponse(
                status_code=404,
                content={"error": "WEATHER_NOT_FOUND",
                         "message": "No weather is currently set for this match",
                         "timestamp": int(time.time() * 1000)},
            )
        return JSONResponse(status_code=200, content=self._weather_to_camel(current, lang or "en"))
