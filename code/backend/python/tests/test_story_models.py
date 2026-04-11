import pytest
from app.core.models.story.story_summary import StorySummary
from app.core.models.story.story_detail import StoryDetail
from app.core.models.story.difficulty_info import DifficultyInfo
from app.core.models.story.story_import_result import StoryImportResult

def test_story_summary_defaults():
    s = StorySummary(uuid="u1")
    assert s.priority == 0
    assert s.title is None

def test_difficulty_info_defaults():
    d = DifficultyInfo(uuid="u1")
    assert d.expCost == 5
    assert d.maxWeight == 10

def test_story_detail_defaults():
    d = StoryDetail(uuid="u1")
    assert d.locationCount == 0
    assert isinstance(d.difficulties, list)
    assert len(d.difficulties) == 0

def test_story_import_result_defaults():
    r = StoryImportResult(storyUuid="u1", status="IMPORTED")
    assert r.textsImported == 0
    assert r.locationsImported == 0
