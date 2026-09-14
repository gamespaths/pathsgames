"""v0.37.5 — in-memory story cache shared by every request a warm Lambda container serves.
A STORY item is ~326 KB (82 RRU per consistent read) and a request read it up to six times."""
import os
import time

from common import db_utils

# Seconds a cached story stays valid without checking anything. 0 disables the cache.
TTL = int(os.environ.get('STORY_CACHE_TTL_SECONDS', '300') or 0)

_STORIES = {}      # uuid -> (story, cached_at_ms)
_VERSIONS = None   # the SYSTEM#cache stamps, read once per invocation (see begin_request)


def _now_ms():
    return int(time.time() * 1000)


def begin_request():
    """Called at the top of every Lambda invocation: the stamps are re-read once per request,
    so an admin write is seen by the very next call (a Robot edits a story, then reads /info)."""
    global _VERSIONS
    _VERSIONS = None


def _versions():
    global _VERSIONS
    if _VERSIONS is None:
        _VERSIONS = db_utils.get_cache_versions()
    return _VERSIONS


def _fresh(story_uuid, cached_at):
    if _now_ms() - cached_at >= TTL * 1000:
        return False
    versions = _versions()
    stamp = max(int(versions['globalVersion'] or 0),
                int(versions['storyVersions'].get(str(story_uuid)) or 0))
    return cached_at >= stamp


def load(story_uuid):
    """The story item, from memory when still valid, else an eventually consistent read."""
    if not story_uuid:
        return None
    key = str(story_uuid)
    if TTL <= 0:
        return db_utils.get_item(f'STORY#{key}', consistent=False)
    cached = _STORIES.get(key)
    if cached and _fresh(key, cached[1]):
        return cached[0]
    story = db_utils.get_item(f'STORY#{key}', consistent=False)
    if story is None:
        _STORIES.pop(key, None)
    else:
        _STORIES[key] = (story, _now_ms())
    return story


def bump(story_uuid):
    """A story was written: drop it here and stamp SYSTEM#cache so other containers do too."""
    _STORIES.pop(str(story_uuid), None)
    if TTL <= 0:
        return None
    ts = db_utils.bump_story_version(story_uuid)
    _reset_versions()
    return ts


def flush():
    """POST /api/admin/cache/flush — every container refetches every story."""
    clear()
    return db_utils.bump_global_version()


def clear():
    """Forget everything held in this container only (tests, flush)."""
    _STORIES.clear()
    _reset_versions()


def _reset_versions():
    begin_request()
