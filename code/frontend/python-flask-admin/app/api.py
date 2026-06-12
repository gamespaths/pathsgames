"""Thin client over the Paths Games admin REST API.

Python port of react-admin ``src/api/*.js``. Every call carries the JWT bearer
token saved on the login screen (kept in the Flask session) and targets the
admin base url (default port 8044). On HTTP/network error an :class:`ApiError`
is raised carrying a human-readable message, mirroring the axios interceptor.
"""
import re

import requests
from flask import current_app, session

from .config import Config

# Path segments (uuids, entity slugs) only ever contain url-safe identifier
# characters. Validate before interpolation (SonarQube S5146/S5144 parity).
_SAFE_SEGMENT = re.compile(r"^[A-Za-z0-9_-]+$")

SESSION_TOKEN = "admin_token"
SESSION_SERVER = "admin_server"


class ApiError(Exception):
    def __init__(self, message, status=None):
        super().__init__(message)
        self.message = message
        self.status = status


def _seg(value):
    s = str(value)
    if not _SAFE_SEGMENT.match(s):
        raise ApiError(f'Invalid URL path segment: "{s}"')
    return s


def _base():
    return (session.get(SESSION_SERVER) or
            current_app.config.get("ADMIN_BASE_URL", Config.ADMIN_BASE_URL)).rstrip("/")


def _timeout():
    return current_app.config.get("BACKEND_TIMEOUT", Config.BACKEND_TIMEOUT)


def _headers():
    token = session.get(SESSION_TOKEN, "")
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def request(method, path, json=None, params=None):
    url = f"{_base()}{path}"
    try:
        res = requests.request(method, url, json=json, params=params,
                               headers=_headers(), timeout=_timeout())
    except requests.RequestException as exc:
        raise ApiError(str(exc)) from exc
    if not res.ok:
        msg = None
        try:
            body = res.json()
            msg = body.get("message") or body.get("error")
        except ValueError:
            msg = None
        raise ApiError(msg or f"HTTP {res.status_code}", status=res.status_code)
    if res.status_code == 204 or not res.content:
        return None
    try:
        return res.json()
    except ValueError:
        return None


# ── echo ──
def server_status():
    return request("GET", "/api/echo/status")


# ── guests ──
def list_guests():
    return request("GET", "/api/admin/guests")


def guest_stats():
    return request("GET", "/api/admin/guests/stats")


def get_guest(uuid):
    return request("GET", f"/api/admin/guests/{_seg(uuid)}")


def delete_guest(uuid):
    return request("DELETE", f"/api/admin/guests/{_seg(uuid)}")


def delete_expired_guests():
    return request("DELETE", "/api/admin/guests/expired")


# ── stories ──
def list_stories(lang="en"):
    return request("GET", "/api/admin/stories", params={"lang": lang})


def get_story(uuid):
    return request("GET", f"/api/admin/stories/{_seg(uuid)}")


def create_story(data):
    return request("POST", "/api/admin/stories", json=data)


def update_story(uuid, data):
    return request("PUT", f"/api/admin/stories/{_seg(uuid)}", json=data)


def delete_story(uuid):
    return request("DELETE", f"/api/admin/stories/{_seg(uuid)}")


def import_story(story_json):
    return request("POST", "/api/admin/stories/import", json=story_json)


def validate_story(uuid):
    return request("GET", f"/api/admin/stories/{_seg(uuid)}/validate")


# ── story sub-entities ──
def list_entities(uuid_story, entity_type):
    return request("GET", f"/api/admin/stories/{_seg(uuid_story)}/{_seg(entity_type)}")


def create_entity(uuid_story, entity_type, data):
    return request("POST", f"/api/admin/stories/{_seg(uuid_story)}/{_seg(entity_type)}", json=data)


def get_entity(uuid_story, entity_type, entity_uuid):
    return request("GET", f"/api/admin/stories/{_seg(uuid_story)}/{_seg(entity_type)}/{_seg(entity_uuid)}")


def update_entity(uuid_story, entity_type, entity_uuid, data):
    return request("PUT", f"/api/admin/stories/{_seg(uuid_story)}/{_seg(entity_type)}/{_seg(entity_uuid)}", json=data)


def delete_entity(uuid_story, entity_type, entity_uuid):
    return request("DELETE", f"/api/admin/stories/{_seg(uuid_story)}/{_seg(entity_type)}/{_seg(entity_uuid)}")


# ── matches ──
def list_matches():
    return request("GET", "/api/admin/matches")


def get_match_info(uuid):
    return request("GET", f"/api/admin/matches/{_seg(uuid)}/info")


def list_match_statuses():
    return request("GET", "/api/admin/matches/statuses")


def update_match(uuid, body):
    return request("PUT", f"/api/admin/matches/{_seg(uuid)}", json=body)


def stop_match(uuid):
    return request("POST", f"/api/admin/matches/{_seg(uuid)}/stop")


def pause_match(uuid):
    return request("POST", f"/api/admin/matches/{_seg(uuid)}/pause")


def resume_match(uuid):
    return request("POST", f"/api/admin/matches/{_seg(uuid)}/resume")


def delete_match(uuid):
    return request("DELETE", f"/api/admin/matches/{_seg(uuid)}")
