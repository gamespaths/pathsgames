"""v0.37.5 — per-request unit of work on a match partition: rows read once, written once.
Active only between ``begin()`` and ``flush()`` (the Lambda handler); write-through otherwise."""
import copy

from common import db_utils
from common import match_summary
from common import test_data_ttl

METADATA = 'METADATA'
CHARACTER_PREFIX = 'CHARACTER#'
TURN_PREFIX = 'TURN#'

_ACTIVE = False
_ITEMS = {}   # (PK, SK) -> the live dict this request reads and mutates
_LISTS = {}   # (PK, prefix) -> live roster / turn queue, in SK order
_DIRTY = {}   # (PK, SK) -> snapshot taken at save time, written by flush
_LOADED_TS = {}  # v1.7.0 PK -> ts_update of the METADATA as read at its first load
_CLAIMED = {}  # v1.7.0 step 8 PK -> the version this request claimed


class StaleMatch(Exception):
    """v1.7.0 step 8 — the claim lost: another write changed the match since it was read (409)."""

    def __init__(self, match_uuid, current_version):
        super().__init__(f'stale match {match_uuid}')
        self.match_uuid, self.current_version = match_uuid, current_version


class WriteFailed(Exception):
    """v1.7.0 step 8 — a write chunk after the claim kept failing: logged, answered 5xx."""

    def __init__(self, match_uuid, cause):
        super().__init__(f'write failed for match {match_uuid}: {cause}')
        self.match_uuid, self.cause = match_uuid, cause


def begin():
    """Top of ``lambda_handler``: forget the previous request, start buffering writes."""
    global _ACTIVE
    _ITEMS.clear()
    _LISTS.clear()
    _DIRTY.clear()
    _LOADED_TS.clear()
    _CLAIMED.clear()
    _ACTIVE = True
    # v1.7.0 — one ts_update for every write of the request
    db_utils.set_request_stamp(db_utils.stamp_ms())


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
        if sk == METADATA:
            _LOADED_TS.setdefault(pk, item.get('ts_update'))
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
        return db_utils.put_item(match_summary.with_summary(item))
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


def discard(pk, sk):
    """v0.41.1 — forget one row of the request: a snapshot restore deletes it at once."""
    _DIRTY.pop((pk, sk), None)
    _ITEMS.pop((pk, sk), None)
    for (p, _prefix), rows in _LISTS.items():
        if p == pk:
            rows[:] = [r for r in rows if r.get('SK') != sk]


def delete_partition(pk):
    """Cascading delete of a match, effective at once; nothing queued for it survives."""
    for key in [k for k in _DIRTY if k[0] == pk]:
        _DIRTY.pop(key, None)
    for key in [k for k in _ITEMS if k[0] == pk]:
        _ITEMS.pop(key, None)
    for key in [k for k in _LISTS if k[0] == pk]:
        _LISTS.pop(key, None)
    return db_utils.delete_all_by_pk(pk)


def _int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def touch(match_uuid, cap_ms=None):
    """v1.7.0 the stamp of a successful admin write: ts_update only, never checked (no play time)."""
    if not match_uuid:
        return False
    pk = _pk(match_uuid)
    if _ACTIVE and (pk, METADATA) in _DIRTY:
        return True  # the flush stamps it
    meta = _ITEMS.get((pk, METADATA)) or db_utils.get_item(pk, METADATA, consistent=True)
    previous = _int((meta or {}).get('ts_update'))
    stamp = db_utils.stamp_ms()
    return db_utils.update_attributes(pk, METADATA, {
        'ts_update': stamp if previous is None or stamp > previous else previous + 1})


def loaded_version(match_uuid):
    """v1.7.0 step 8 — the version (ts_update) of the match as read at request start, None if never read."""
    value = _int(_LOADED_TS.get(_pk(match_uuid)))
    return None if value is None else str(value)


def claim(match_uuid, cap_ms, expected=None):
    """v1.7.0 step 8 — the first write of a gameplay request: a conditional UpdateItem moves ts_update from the
    value read at request start (or If-Match ``expected``) to the next one and adds the capped play time."""
    pk = _pk(match_uuid)
    if pk in _CLAIMED:
        return str(_CLAIMED[pk])
    meta = match(match_uuid)
    if meta is None:
        return None
    old = _int(_LOADED_TS.get(pk, meta.get('ts_update')))
    if expected is not None and expected != (None if old is None else str(old)):
        raise StaleMatch(match_uuid, None if old is None else str(old))
    stamp = db_utils.stamp_ms()
    new = stamp if old is None or stamp > old else old + 1
    delta = 0 if old is None else max(0, min(new - old, int(cap_ms)))
    if not db_utils.claim_version(pk, old, new, delta):
        current = db_utils.get_item(pk, METADATA, consistent=True)
        raise StaleMatch(match_uuid, None if current is None else str(_int(current.get('ts_update'))))
    db_utils.set_request_stamp(new)
    meta['playMs'] = (_int(meta.get('playMs')) or 0) + delta
    _CLAIMED[pk] = new
    save(meta)
    return str(new)


def abandon():
    """v1.7.0 step 8 — leave the request without writing anything (a stale answer)."""
    global _ACTIVE
    _DIRTY.clear()
    _ITEMS.clear()
    _LISTS.clear()
    _LOADED_TS.clear()
    _CLAIMED.clear()
    _ACTIVE = False
    db_utils.set_request_stamp(None)


def flush():
    """Write every queued row and leave the request. Safe to call twice.
    v1.7.0 — every match METADATA gets its ``summary`` rebuilt, all rows the request stamp; after a claim
    (step 8) the rows go in TransactWriteItems chunks, METADATA first and conditional on the claimed version."""
    global _ACTIVE
    items = [match_summary.with_summary(i) for i in _DIRTY.values()]
    claimed = dict(_CLAIMED)
    _DIRTY.clear()
    _ITEMS.clear()
    _LISTS.clear()
    _LOADED_TS.clear()
    _CLAIMED.clear()
    _ACTIVE = False
    try:
        if not items:
            return True
        if not claimed:
            return db_utils.batch_put_items(items)
        items.sort(key=lambda i: (i.get('PK') not in claimed or i.get('SK', METADATA) != METADATA))
        conditions = {(pk, METADATA): version for pk, version in claimed.items()}
        try:
            return db_utils.transact_put_items(items, conditions)
        except db_utils.TransactWriteFailed as exc:
            raise WriteFailed(','.join(pk[len('MATCH#'):] for pk in claimed), exc) from exc
    finally:
        db_utils.set_request_stamp(None)
