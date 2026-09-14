"""v0.37.5 — match logs as their own DynamoDB rows (``MATCH#<uuid>`` / ``LOG#<ts>#<seq>``).
Until v0.37.4 seven lists grew on the match METADATA item, rewritten whole at every action."""
import datetime
import time

from boto3.dynamodb.conditions import Attr

from common import db_utils
from common.data_utils import safe_int as _nz

LOG_PREFIX = 'LOG#'
AUDIT_PREFIX = 'AUDIT#'
PENDING_LOGS = '_pendingLogs'
PENDING_AUDIT = '_pendingAudit'
RESOURCES = ('energy', 'food', 'magic', 'coin')
# The lists the METADATA item carried before v0.37.5; stripped on the first persist.
LEGACY_LISTS = ('weatherLog', 'movementLog', 'sleepLog', 'eventLog', 'itemUsageLog',
                'choiceLog', 'storyProgress')
# Row bookkeeping that never reaches the API.
_PRIVATE_KEYS = ('PK', 'SK', 'ts_insert', 'ts_update', 'timestampMs', 'weatherUuid', 'kind')


def ts_ms():
    return int(time.time() * 1000)


def ms_to_iso(ts):
    """Millisecond timestamp to ISO-8601 UTC string; None stays None."""
    if ts is None:
        return None
    try:
        moment = datetime.datetime.fromtimestamp(int(ts) / 1000, datetime.timezone.utc)
        return moment.strftime('%Y-%m-%dT%H:%M:%S.') + f'{int(ts) % 1000:03d}Z'
    except Exception:
        return str(ts)


# ── writers ───────────────────────────────────────────────────────────────────

def append(match, entry_type, clock, timestamp_ms=None, executed=False, selected=False,
           **fields):
    """Queue one timeline entry on the match dict, already in the shape GET logs answers.

    ``executed`` marks an EVENT_EXECUTED row (ONCE gating, choice-cycle pairing);
    ``selected`` a CHOICE_SELECTED marker. Both feed the derived state on METADATA."""
    ts = timestamp_ms if timestamp_ms is not None else ts_ms()
    entry = {
        'type': entry_type,
        'clock': clock,
        'timestamp': ms_to_iso(ts),
        'timestampMs': int(ts),
    }
    for name in RESOURCES:
        entry[f'{name}Cost'] = _nz(fields.pop(f'{name}Cost', 0))
        entry[f'{name}Gain'] = _nz(fields.pop(f'{name}Gain', 0))
    entry.update(fields)
    match.setdefault(PENDING_LOGS, []).append(entry)

    id_event = entry.get('idEvent')
    if executed and id_event is not None:
        _mark(match, id_event, 'executed')
        ids = match.setdefault('executedEventIds', [])
        if _nz(id_event) not in [_nz(i) for i in ids]:
            ids.append(_nz(id_event))
    if selected and id_event is not None:
        _mark(match, id_event, 'selected')
    if entry_type == 'MOVEMENT':
        for loc in (entry.get('idLocationFrom'), entry.get('idLocationTo')):
            _visit(match, loc)
    return entry


def audit(match, kind, clock, timestamp_ms=None, selected=False, **fields):
    """Queue a row the timeline never shows (edge states, choice history, progress)."""
    ts = timestamp_ms if timestamp_ms is not None else ts_ms()
    row = {'kind': kind, 'clock': clock, 'timestamp': ms_to_iso(ts), 'timestampMs': int(ts)}
    row.update(fields)
    match.setdefault(PENDING_AUDIT, []).append(row)
    if selected and row.get('idEvent') is not None:
        _mark(match, row['idEvent'], 'selected')
    return row


def _mark(match, id_event, which):
    markers = match.setdefault('eventMarkers', {})
    slot = markers.setdefault(str(_nz(id_event)), {'executed': 0, 'selected': 0})
    slot[which] = _nz(slot.get(which)) + 1


def _visit(match, id_location):
    if id_location is None:
        return
    ids = match.setdefault('visitedLocationIds', [])
    if _nz(id_location) not in [_nz(i) for i in ids]:
        ids.append(_nz(id_location))


def persist(match):
    """Write the match: pending rows first (batch), then the METADATA item that counts them.

    Every former ``db_utils.put_item(match)`` goes through here, so a request that saves
    twice flushes twice and never reuses a sort key (``logSeq`` lives on the same dict)."""
    logs = match.pop(PENDING_LOGS, None) or []
    audits = match.pop(PENDING_AUDIT, None) or []
    for key in LEGACY_LISTS:
        match.pop(key, None)
    pk = match.get('PK') or f"MATCH#{match.get('uuid')}"
    seq = _nz(match.get('logSeq'))
    rows = []
    for entry in logs:
        seq += 1
        rows.append({'PK': pk, 'SK': _sort_key(LOG_PREFIX, entry, seq), **entry})
    for row in audits:
        seq += 1
        rows.append({'PK': pk, 'SK': _sort_key(AUDIT_PREFIX, row, seq), **row})
    match['logSeq'] = seq
    match['logCount'] = _nz(match.get('logCount')) + len(logs)
    if rows:
        db_utils.batch_put_items(rows)
    return db_utils.put_item(match)


def _sort_key(prefix, row, seq):
    return f"{prefix}{_nz(row.get('timestampMs')):013d}#{seq:06d}"


# ── derived state readers ─────────────────────────────────────────────────────

def consumed_event_ids(match):
    """The ONCE events already spent in this match (EVENT_EXECUTED rows only)."""
    return {_nz(i) for i in (match.get('executedEventIds') or [])}


def marker_count(match, event_id, which):
    """How many EVENT_EXECUTED (``executed``) / CHOICE_SELECTED (``selected``) markers."""
    slot = (match.get('eventMarkers') or {}).get(str(_nz(event_id))) or {}
    return _nz(slot.get(which))


def visited_location_ids(match):
    """Every location the party ever moved through, in first-seen order."""
    ids = []
    for loc in (match.get('visitedLocationIds') or []):
        if _nz(loc) not in ids:
            ids.append(_nz(loc))
    # A match written before v0.37.5 has no visited list: its latched flags are the memory.
    for ls in (match.get('locations') or []):
        if _nz(ls.get('flagVisited')) == 1 and _nz(ls.get('idLocation')) not in ids:
            ids.append(_nz(ls.get('idLocation')))
    return ids


# ── readers ───────────────────────────────────────────────────────────────────

def timeline_entry(row):
    """A stored row as the API shows it (bookkeeping stripped, resource fields present)."""
    entry = {k: v for k, v in row.items() if k not in _PRIVATE_KEYS}
    for name in RESOURCES:
        entry[f'{name}Cost'] = _nz(entry.get(f'{name}Cost'))
        entry[f'{name}Gain'] = _nz(entry.get(f'{name}Gain'))
    return entry


def page(match_uuid, limit, cursor=None, ascending=True):
    """One page of LOG# rows in SK order: ``(entries, next_cursor)``.

    One row more than asked is fetched so the cursor is null at the exact end — DynamoDB
    hands back a LastEvaluatedKey whenever Limit is hit, even with nothing after it."""
    pk = f'MATCH#{match_uuid}'
    start_key = db_utils.decode_cursor(cursor)
    if start_key and not (start_key.get('PK') == pk
                          and str(start_key.get('SK') or '').startswith(LOG_PREFIX)):
        start_key = None
    rows, _last = db_utils.query_sk_prefix_page(pk, LOG_PREFIX, int(limit) + 1,
                                                start_key=start_key, ascending=ascending)
    rows = list(rows or [])
    next_cursor = None
    if len(rows) > int(limit):
        rows = rows[:int(limit)]
        last = rows[-1]
        next_cursor = db_utils.encode_cursor({'PK': last['PK'], 'SK': last['SK']})
    return [timeline_entry(r) for r in rows], next_cursor


def entries_of_type(match_uuid, entry_type):
    """Every LOG# row of one type, oldest first (admin weather history)."""
    rows = db_utils.query_sk_prefix(f'MATCH#{match_uuid}', LOG_PREFIX, consistent=False,
                                    filter_expr=Attr('type').eq(entry_type))
    return list(rows or [])
