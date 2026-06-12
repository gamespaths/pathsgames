from app import data
from app.data import (get_stories, get_story, get_story_detail,
                     get_traits_for_class)


def test_get_stories_mock_catalog():
    stories = get_stories()
    assert len(stories) >= 2
    for s in stories:
        assert s["uuid"] and s["title"] and s["category"]
        assert s["card"] and s["card"]["urlImage"]
    # categories vary -> netflix-style rows
    assert len({s["category"] for s in stories}) >= 2


def test_get_story_found_and_missing():
    first = get_stories()[0]["uuid"]
    assert get_story(first) is not None
    assert get_story("does-not-exist") is None


def test_get_story_detail_has_loadout():
    uuid = get_stories()[0]["uuid"]
    detail = get_story_detail(uuid)
    assert detail["classes"] and detail["characterTemplates"]
    assert detail["traits"] and detail["difficulties"]


def test_get_traits_for_class_filters():
    uuid = get_stories()[0]["uuid"]
    detail = get_story_detail(uuid)
    cls = detail["classes"][0]
    traits = get_traits_for_class(uuid, cls["uuid"])
    cls_id = cls["id"]
    for tr in traits:
        prohibited = tr.get("idClassProhibited")
        assert prohibited is None or int(prohibited) != int(cls_id)


def test_fetch_with_fallback_returns_mock_on_backend_error(monkeypatch):
    monkeypatch.setattr(data, "_base_url", lambda: "http://127.0.0.1:9")

    def boom(*a, **k):
        raise OSError("connection refused")

    import requests
    monkeypatch.setattr(requests, "get", boom)

    sentinel = {"ok": True}
    assert data._fetch_with_fallback("/api/stories", sentinel) is sentinel
