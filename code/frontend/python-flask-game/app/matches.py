"""Mock match store — Python port of the offline branch of ``src/api/matches.js``.

Matches live in the Flask session (per-browser), so the user page and the
match page have plausible data without a backend. When ``BASE_URL`` points at a
live server this module still works as a local mirror of created matches.
"""
import time
import uuid as uuidlib

from flask import session

_KEY = "matches"


def _store():
    return session.setdefault(_KEY, [])


def _save(matches):
    session[_KEY] = matches
    session.modified = True


def create_match(payload):
    """Create a CREATED match mirroring the backend MatchSummary shape."""
    payload = payload or {}
    match = {
        "uuid": str(uuidlib.uuid4()),
        "storyUuid": payload.get("storyUuid"),
        "storyTitle": payload.get("storyTitle"),
        "difficultyUuid": payload.get("difficultyUuid"),
        "name": payload.get("name"),
        "status": "CREATED",
        "currentClock": 0,
        "expCost": 0,
        "tsInsert": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "singlePlayer": payload.get("singlePlayer", 1),
        "characterTemplateUuid": payload.get("characterTemplateUuid"),
        "classUuid": payload.get("classUuid"),
        "traitUuids": payload.get("traitUuids", []),
    }
    matches = _store()
    matches.insert(0, match)  # newest first
    _save(matches)
    return match


def list_matches():
    """Return the current browser's matches, newest first."""
    return list(_store())


def get_match(match_uuid):
    """Return one match by uuid, or ``None``."""
    return next((m for m in _store() if m.get("uuid") == match_uuid), None)


def join_match(match_uuid):
    """Mark a match RUNNING (the player entered the book). Returns the match."""
    matches = _store()
    for m in matches:
        if m.get("uuid") == match_uuid:
            if m.get("status") == "CREATED":
                m["status"] = "RUNNING"
            _save(matches)
            return m
    return None
