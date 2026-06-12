"""Per-story loadout selection kept in the Flask session.

``session["config"][story_uuid]`` holds the chosen uuids:
``{"class", "character", "traits": [...], "difficulty"}``. Defaults fall back to
the first available option, mirroring the React start-book initial config.
"""
from flask import session


def _all(detail):
    return {
        "class": detail.get("classes", []),
        "character": detail.get("characterTemplates", []),
        "trait": detail.get("traits", []),
        "difficulty": detail.get("difficulties", []),
    }


def _find(options, uuid):
    return next((o for o in options if o.get("uuid") == uuid), None)


def get_raw(story_uuid):
    return session.get("config", {}).get(story_uuid, {})


def resolve(detail, story_uuid):
    """Return the resolved selection objects for a story (with sane defaults)."""
    opts = _all(detail)
    raw = get_raw(story_uuid)

    def one(kind):
        chosen = _find(opts[kind], raw.get(kind))
        if chosen:
            return chosen
        return opts[kind][0] if opts[kind] else None

    traits = [t for t in opts["trait"] if t.get("uuid") in (raw.get("traits") or [])]

    return {
        "class": one("class"),
        "character": one("character"),
        "difficulty": one("difficulty"),
        "traits": traits,
    }


def set_single(story_uuid, kind, uuid):
    """Persist a single-choice selection (class/character/difficulty)."""
    config = session.setdefault("config", {})
    entry = config.setdefault(story_uuid, {})
    entry[kind] = uuid
    session["config"] = config
    session.modified = True


def toggle_trait(story_uuid, uuid):
    """Add/remove a trait from the multi-select trait list."""
    config = session.setdefault("config", {})
    entry = config.setdefault(story_uuid, {})
    traits = list(entry.get("traits", []))
    if uuid in traits:
        traits.remove(uuid)
    else:
        traits.append(uuid)
    entry["traits"] = traits
    session["config"] = config
    session.modified = True
