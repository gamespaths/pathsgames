"""Data layer — Python port of react-game ``src/api/stories.js``.

In mock mode (``BASE_URL == "mock"``) data comes from the bundled
``tutorial_story.json`` adapted by :mod:`app.adapter`. Otherwise requests hit
the live Java public API and fall back to the mock on any error — the same
``fetchWithFallback`` contract used by the React client.
"""
import copy
import json
import os

from .adapter import adapt_tutorial_story
from .config import MOCK_SERVER, Config

_HERE = os.path.dirname(os.path.abspath(__file__))
_DATA_DIR = os.path.join(_HERE, os.pardir, "static", "data")

_doc_cache = None

# A few cover images so the mock catalog shows a believable Netflix-style grid.
_DEMO_VARIANTS = [
    ("the-cursed-fortress", "adventure", "The Cursed Fortress",
     "https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=600&q=80"),
    ("whispers-in-the-mist", "adventure", "Whispers in the Mist",
     "https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=600&q=80"),
    ("the-dragon-vault", "fantasy", "The Dragon Vault",
     "https://images.unsplash.com/photo-1604147706283-d7119b5b822c?auto=format&fit=crop&w=600&q=80"),
    ("crown-of-ashes", "fantasy", "Crown of Ashes",
     "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=600&q=80"),
    ("the-hollow-keep", "mystery", "The Hollow Keep",
     "https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?auto=format&fit=crop&w=600&q=80"),
]


def _load_doc():
    global _doc_cache
    if _doc_cache is None:
        with open(os.path.join(_DATA_DIR, "tutorial_story.json"), encoding="utf-8") as fh:
            _doc_cache = json.load(fh)
    return _doc_cache


def _base_url():
    try:
        from flask import current_app
        return current_app.config.get("BASE_URL", Config.BASE_URL)
    except Exception:
        return Config.BASE_URL


def _timeout():
    try:
        from flask import current_app
        return current_app.config.get("BACKEND_TIMEOUT", Config.BACKEND_TIMEOUT)
    except Exception:
        return Config.BACKEND_TIMEOUT


def _fetch_with_fallback(path, mock_data):
    """GET ``{BASE_URL}{path}`` or return ``mock_data`` in mock/offline mode."""
    base = _base_url()
    if base == MOCK_SERVER:
        return mock_data
    try:
        import requests
        res = requests.get(f"{base}{path}", timeout=_timeout())
        res.raise_for_status()
        return res.json()
    except Exception:
        return mock_data


def _mock_catalog():
    """Build a small multi-story catalog by cloning the single mock story."""
    base = adapt_tutorial_story(_load_doc())
    stories = []
    for uuid, category, title, image in _DEMO_VARIANTS:
        clone = copy.deepcopy(base)
        clone["uuid"] = uuid
        clone["title"] = title
        clone["category"] = category
        if clone.get("card"):
            clone["card"]["urlImage"] = image
            clone["card"]["title"] = title
        stories.append(clone)
    return stories


def get_stories():
    """List all stories (catalog)."""
    return _fetch_with_fallback("/api/stories", _mock_catalog())


def get_story(uuid):
    """Return a single story summary by uuid, or ``None``."""
    stories = get_stories()
    return next((s for s in stories if s.get("uuid") == uuid), None)


def get_story_detail(uuid, lang="en"):
    """Return the full detail (classes/characters/traits/difficulties) of a story.

    In mock mode an unknown uuid yields ``None`` (so routes can 404); against a
    live backend the request is made with the catalog entry as fallback.
    """
    mock = get_story(uuid)
    if _base_url() == MOCK_SERVER:
        return mock
    return _fetch_with_fallback(
        f"/api/stories/{uuid}?lang={lang or 'en'}",
        mock or adapt_tutorial_story(_load_doc()),
    )


def get_traits_for_class(story_uuid, class_uuid, lang="en"):
    """Traits selectable with the given class (idClassPermitted/Prohibited filter)."""
    detail = get_story_detail(story_uuid, lang) or {}
    mock_class = next((c for c in detail.get("classes", []) if c.get("uuid") == class_uuid), None)
    class_id = mock_class.get("id") if mock_class else None

    def num(v):
        # Mirror JS Number(): null/'' -> 0. None means "no restriction".
        if v is None or v == "":
            return 0.0
        return float(v)

    def allowed(tr):
        permitted = tr.get("idClassPermitted")
        prohibited = tr.get("idClassProhibited")
        permitted_ok = permitted is None or (class_id is not None and num(permitted) == num(class_id))
        prohibited_ok = (prohibited is None or class_id is None or num(prohibited) != num(class_id))
        return permitted_ok and prohibited_ok

    mock_traits = [tr for tr in detail.get("traits", []) if allowed(tr)]
    return _fetch_with_fallback(
        f"/api/stories/{story_uuid}/classes/{class_uuid}/traits?lang={lang or 'en'}",
        mock_traits,
    )
