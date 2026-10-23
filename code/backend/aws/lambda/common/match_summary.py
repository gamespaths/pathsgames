"""v1.7.0 the stable ``summary`` map of a match METADATA item (rebuilt at every repo flush; GSI1 and GSI2
project it) and the reader that turns a GSI row or a full item back into one flat match dict."""
import time

SUMMARY_FIELDS = ('uuid', 'storyUuid', 'difficultyUuid', 'name', 'status', 'expCost', 'rngSeed',
                  'userCreatorUuid', 'tsInsert', 'singlePlayer', 'characterTemplateUuid', 'classUuid', 'traitUuids')


def is_match_metadata(item):
    return isinstance(item, dict) and str(item.get('PK') or '').startswith('MATCH#') \
        and item.get('SK', 'METADATA') == 'METADATA'


def build(item):
    """The summary of a match item: its listing fields, never the live clock (top-level, GSI1 only)."""
    summary = {k: item.get(k) for k in SUMMARY_FIELDS if item.get(k) is not None}
    summary['traitUuids'] = list(item.get('traitUuids') or [])
    return summary


def with_summary(item):
    """The match item with its summary rebuilt (other items untouched)."""
    if is_match_metadata(item):
        item['summary'] = build(item)
    return item


def flatten(row):
    """A GSI row (summary + projected top-level) or a full item as one flat dict; top-level wins."""
    if not isinstance(row, dict):
        return row
    return {**(row.get('summary') or {}), **{k: v for k, v in row.items() if k != 'summary'}}


# ── v1.7.0 step 9 — the player's list: active first, then last played, paged in memory ──

ACTIVE_STATUSES = ('CREATED', 'RUNNING', 'PAUSED')
LIST_DEFAULT_LIMIT = 50
LIST_MAX_LIMIT = 200


def _ms(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def iso_ms(value):
    """Epoch milliseconds as ISO-8601 UTC ("...Z", like Java Instant); None when missing or unreadable."""
    if value is None or isinstance(value, bool):
        return None
    try:
        ms = int(value)
    except (TypeError, ValueError):
        return None
    seconds, millis = divmod(ms, 1000)
    text = time.strftime('%Y-%m-%dT%H:%M:%S', time.gmtime(seconds))
    return f'{text}.{millis:03d}Z' if millis else f'{text}Z'


def _list_key(m):
    played = _ms(m.get('ts_update')) or _ms(m.get('tsInsert'))
    return (0 if m.get('status') in ACTIVE_STATUSES else 1, -played, -_ms(m.get('tsInsert')), str(m.get('uuid') or ''))


def sort_for_list(rows):
    """Flat match dicts sorted: active (CREATED, RUNNING, PAUSED) first, then the latest ts_update."""
    return sorted((flatten(r) for r in rows or []), key=_list_key)


def list_limit(raw):
    if raw is None or str(raw).strip() == '':
        return LIST_DEFAULT_LIMIT
    try:
        return max(1, min(int(raw), LIST_MAX_LIMIT))
    except (TypeError, ValueError):
        return LIST_DEFAULT_LIMIT


def list_offset(cursor):
    """The position carried by the cursor; 0 (first page) when missing or unreadable."""
    try:
        return max(0, int(str(cursor).strip()))
    except (TypeError, ValueError):
        return 0


def page(rows, limit=None, cursor=None):
    """(items, nextCursor, limit) of the sorted list; nextCursor is None on the last page."""
    ordered = sort_for_list(rows)
    size = list_limit(limit)
    start = min(list_offset(cursor), len(ordered))
    end = min(start + size, len(ordered))
    return ordered[start:end], (str(end) if end < len(ordered) else None), size
