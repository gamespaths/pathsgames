"""v0.41.4 — SHA-256 of the canonical story projection: uuid/tsInsert/tsUpdate/idStory dropped at any depth
(and the root server id), nulls dropped, arrays of objects sorted by id. Mirrors ``StoryFingerprint.java``."""
from typing import Any, Dict

from app.core.services.match import canonical_json

_DROPPED = frozenset(("uuid", "tsInsert", "tsUpdate", "idStory"))


def _rank(value):
    """Absent first, then numbers by value, then text by code point (Java compares the same tuple)."""
    if value is None:
        return (0, 0)
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return (1, value)
    if isinstance(value, bool):
        return (2, "true" if value else "false")
    return (2, str(value))


def _order(row):
    return tuple(_rank(row.get(k)) for k in ("id", "idText", "lang")) + (canonical_json.write(row),)


def _project(value):
    if isinstance(value, dict):
        return {k: _project(v) for k, v in value.items() if v is not None and k not in _DROPPED}
    if isinstance(value, list):
        out = [_project(v) for v in value]
        if all(isinstance(v, dict) for v in out):
            out.sort(key=_order)
        return out
    return value


def projection(story_data) -> Dict[str, Any]:
    root = _project(story_data or {})
    root.pop("id", None)
    return root


def of(story_data) -> str:
    return canonical_json.sha256(projection(story_data))
