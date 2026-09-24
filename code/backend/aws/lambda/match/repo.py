"""v0.37.5 — per-request unit of work on a match partition: rows read once, written once.
Active only between ``begin()`` and ``flush()`` (the Lambda handler); write-through otherwise."""
import copy

from common import db_utils
from common import test_data_ttl

METADATA = 'METADATA'
CHARACTER_PREFIX = 'CHARACTER#'
TURN_PREFIX = 'TURN#'

_ACTIVE = False
_ITEMS = {}   # (PK, SK) -> the live dict this request reads and mutates
_LISTS = {}   # (PK, prefix) -> live roster / turn queue, in SK order
_DIRTY = {}   # (PK, SK) -> snapshot taken at save time, written by flush


def begin():
    """Top of ``lambda_handler``: forget the previous request, start buffering writes."""
    global _ACTIVE
    _ITEMS.clear()
    _LISTS.clear()
    _DIRTY.clear()
    _ACTIVE = True


def active():
    return _ACTIVE


def pending():
    """How many rows ``flush`` would write now."""
    return len(_DIRTY)


def _pk(match_uuid):
    return f'MATCH#{match_uuid}'


def match(match_uuid, consistent=True):
    """The METADATA item of a match, memoised for the request (None when missing)."""
    return _item(_pk(match_uuid), METADATA, consistent)


def character(match_uuid, char_uuid, consistent=True):
    """One CHARACTER# row (None when missing)."""
    return _item(_pk(match_uuid), f'{CHARACTER_PREFIX}{char_uuid}', consistent)


def characters(match_uuid, consistent=True):
    """The CHARACTER# rows of a match — the same dicts every call, so a change made
    by one step is what the next step reads (no ``_reread_characters`` dance)."""
    return _rows(_pk(match_uuid), CHARACTER_PREFIX, consistent)


def turns(match_uuid, consistent=True):
    """The TURN# queue of a match."""
    return _rows(_pk(match_uuid), TURN_PREFIX, consistent)


def _item(pk, sk, consistent):
    key = (pk, sk)
    if _ACTIVE and key in _ITEMS:
        return _ITEMS[key]
    item = db_utils.get_item(pk, sk, consistent=consistent)
    if _ACTIVE and item is not None:
        _ITEMS[key] = item
    return item


def _rows(pk, prefix, consistent):
    key = (pk, prefix)
    if _ACTIVE and key in _LISTS:
        return list(_LISTS[key])
    rows = db_utils.query_sk_prefix(pk, prefix, consistent=consistent) or []
    if _ACTIVE:
        # A row already read on its own stays the same object as the one in the list.
        rows = [_ITEMS.setdefault((pk, r.get('SK')), r) for r in rows]
        _LISTS[key] = rows
    return list(rows)


def _inherit_ttl(item):
    """v0.39.1 — a CHARACTER#/TURN#/LOG#/AUDIT# row expires with its match METADATA."""
    ttl = test_data_ttl.TTL_ATTRIBUTE
    if item.get(ttl) is not None or item.get('SK', METADATA) == METADATA \
            or not str(item.get('PK')).startswith('MATCH#') or not test_data_ttl.hours():
        return
    meta = _item(item['PK'], METADATA, True)
    if test_data_ttl.expires(meta):
        item[ttl] = meta[ttl]


def save(item):
    """Queue the item for ``flush`` (a later save of the same key replaces the snapshot),
    or write it at once outside a request."""
    _inherit_ttl(item)
    if not _ACTIVE:
        return db_utils.put_item(item)
    pk, sk = item.get('PK'), item.get('SK', METADATA)
    _DIRTY[(pk, sk)] = copy.deepcopy(item)
    _ITEMS[(pk, sk)] = item
    for prefix in (CHARACTER_PREFIX, TURN_PREFIX):
        rows = _LISTS.get((pk, prefix))
        if rows is None or not str(sk).startswith(prefix):
            continue
        idx = next((i for i, r in enumerate(rows) if r.get('SK') == sk), None)
        if idx is None:
            rows.append(item)
        elif rows[idx] is not item:
            rows[idx] = item
    return True


def delete_partition(pk):
    """Cascading delete of a match, effective at once; nothing queued for it survives."""
    for key in [k for k in _DIRTY if k[0] == pk]:
        _DIRTY.pop(key, None)
    for key in [k for k in _ITEMS if k[0] == pk]:
        _ITEMS.pop(key, None)
    for key in [k for k in _LISTS if k[0] == pk]:
        _LISTS.pop(key, None)
    return db_utils.delete_all_by_pk(pk)


def flush():
    """Write every queued row in one batch and leave the request. Safe to call twice."""
    global _ACTIVE
    items = list(_DIRTY.values())
    _DIRTY.clear()
    _ITEMS.clear()
    _LISTS.clear()
    _ACTIVE = False
    if not items:
        return True
    return db_utils.batch_put_items(items)
