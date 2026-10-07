"""v0.37.5 — common/story_cache.py: per-container story cache with cross-container stamps."""
from unittest.mock import patch

import pytest

from common import story_cache


@pytest.fixture
def cache(monkeypatch):
    """The cache switched on (the conftest turns it off for every other test)."""
    monkeypatch.setattr(story_cache, 'TTL', 300)
    story_cache.clear()
    yield story_cache
    story_cache.clear()


def _versions(**over):
    data = {'storyVersions': {}, 'globalVersion': 0}
    data.update(over)
    return data


def test_ttl_zero_bypasses_the_cache_and_the_version_read():
    with patch('common.story_cache.db_utils.get_item', return_value={'uuid': 's1'}) as get, \
         patch('common.story_cache.db_utils.get_cache_versions') as versions:
        assert story_cache.load('s1') == {'uuid': 's1'}
        assert story_cache.load('s1') == {'uuid': 's1'}
    assert get.call_count == 2
    get.assert_called_with('STORY#s1', consistent=False)
    versions.assert_not_called()
    assert story_cache.load(None) is None


def test_a_second_load_is_served_from_memory(cache):
    with patch('common.story_cache.db_utils.get_item', return_value={'uuid': 's1'}) as get, \
         patch('common.story_cache.db_utils.get_cache_versions', return_value=_versions()):
        first = cache.load('s1')
        second = cache.load('s1')
    assert first is second and get.call_count == 1


def test_a_missing_story_is_not_cached(cache):
    with patch('common.story_cache.db_utils.get_item', return_value=None) as get, \
         patch('common.story_cache.db_utils.get_cache_versions', return_value=_versions()):
        assert cache.load('s1') is None
        assert cache.load('s1') is None
    assert get.call_count == 2


def test_the_ttl_expires_a_cached_story(cache, monkeypatch):
    now = [1_000_000]
    monkeypatch.setattr(cache, '_now_ms', lambda: now[0])
    with patch('common.story_cache.db_utils.get_item', return_value={'uuid': 's1'}) as get, \
         patch('common.story_cache.db_utils.get_cache_versions', return_value=_versions()):
        cache.load('s1')
        now[0] += 299_000
        cache.load('s1')
        assert get.call_count == 1
        now[0] += 2_000
        cache.load('s1')
        assert get.call_count == 2


def test_a_newer_stamp_on_the_system_item_invalidates_the_copy(cache, monkeypatch):
    now = [1_000_000]
    monkeypatch.setattr(cache, '_now_ms', lambda: now[0])
    stamps = [_versions()]
    with patch('common.story_cache.db_utils.get_item', return_value={'uuid': 's1'}) as get, \
         patch('common.story_cache.db_utils.get_cache_versions',
               side_effect=lambda: stamps[-1]) as versions:
        cache.load('s1')
        # Inside one invocation the stamp is read once, however many loads happen.
        cache.load('s1')
        cache.load('s1')
        assert versions.call_count == 1
        # Another container bumped the story after we cached it: the next invocation sees it.
        stamps.append(_versions(storyVersions={'s1': now[0] + 1}))
        now[0] += 1_000
        cache.begin_request()
        cache.load('s1')
        assert get.call_count == 2 and versions.call_count == 2
        # A global flush does the same for every story.
        stamps.append(_versions(globalVersion=now[0] + 5))
        now[0] += 1_000
        cache.begin_request()
        cache.load('s1')
        assert get.call_count == 3


def test_bump_drops_the_local_copy_and_stamps_the_system_item(cache):
    with patch('common.story_cache.db_utils.get_item', return_value={'uuid': 's1'}), \
         patch('common.story_cache.db_utils.get_cache_versions', return_value=_versions()):
        cache.load('s1')
    with patch('common.story_cache.db_utils.bump_story_version', return_value=42) as bump:
        assert cache.bump('s1') == 42
    bump.assert_called_once_with('s1')
    assert 's1' not in cache._STORIES


def test_bump_with_the_cache_off_touches_nothing():
    with patch('common.story_cache.db_utils.bump_story_version') as bump:
        assert story_cache.bump('s1') is None
    bump.assert_not_called()


def test_flush_clears_memory_and_bumps_the_global_version(cache):
    cache._STORIES['s1'] = ({'uuid': 's1'}, 1)
    with patch('common.story_cache.db_utils.bump_global_version', return_value=7) as bump:
        assert cache.flush() == 7
    bump.assert_called_once()
    assert cache._STORIES == {} and cache._VERSIONS is None
