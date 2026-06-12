import json
import os

from app.adapter import adapt_tutorial_story, adapt_tutorial_story_list

_DOC = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "data", "tutorial_story.json")


def _doc():
    with open(_DOC, encoding="utf-8") as fh:
        return json.load(fh)


def test_adapt_basic_shape():
    story = adapt_tutorial_story(_doc())
    assert story["uuid"]
    assert story["title"] and story["title"] != "Untitled"
    assert isinstance(story["classes"], list)
    assert isinstance(story["characterTemplates"], list)
    assert isinstance(story["traits"], list)
    assert isinstance(story["difficulties"], list)
    assert story["card"] is not None


def test_adapt_resolves_text_and_card():
    story = adapt_tutorial_story(_doc())
    # Card title/description resolved from the texts table.
    assert "uuid" in story["card"]
    for cls in story["classes"]:
        assert cls["uuid"].startswith("class-")
        assert "stats" in cls


def test_adapt_list_wraps_single():
    lst = adapt_tutorial_story_list(_doc())
    assert isinstance(lst, list) and len(lst) == 1


def test_traits_have_cost_and_class_filters():
    story = adapt_tutorial_story(_doc())
    for tr in story["traits"]:
        assert "cost" in tr and "positive" in tr["cost"]
        assert "idClassPermitted" in tr
        assert "idClassProhibited" in tr
