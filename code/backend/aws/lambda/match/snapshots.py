"""v0.41.1 Step 41 B — the LIGHT snapshot of every time-end as a SNAPSHOT# row of the match partition
(gzipped payload, SHA-256), and its admin list, check and restore. Same codes as java/python."""
import copy
import gzip
import hashlib
import json
import os
import uuid as uuid_lib
from decimal import Decimal

from boto3.dynamodb.types import Binary

from common import db_utils
from match import logbook
from match import repo

SNAPSHOT_PREFIX = 'SNAPSHOT#'
PAYLOAD_VERSION = 1
TYPE_LIGHT = 'LIGHT'
PACKED = '_gz'

CHECKSUM_MISMATCH = 'SNAPSHOT_CHECKSUM_MISMATCH'
VERSION_UNKNOWN = 'SNAPSHOT_VERSION_UNKNOWN'
STORY_ENTITY_MISSING = 'STORY_ENTITY_MISSING'
USER_MISSING = 'USER_MISSING'
MATCH_MISMATCH = 'MATCH_MISMATCH'

# METADATA attributes a snapshot never carries: keys, indexes, ttl, stamps and the log counters.
_META_SKIP = ('PK', 'SK', 'GSI1_PK', 'GSI1_SK', 'GSI2_PK', 'GSI2_SK', 'ttl', 'ts_insert',
              'ts_update', 'logSeq', 'logCount', logbook.PENDING_LOGS, logbook.PENDING_AUDIT)
# METADATA attributes a restore keeps as they are (the name is not game state).
_META_KEEP = ('PK', 'SK', 'GSI1_PK', 'GSI1_SK', 'GSI2_PK', 'GSI2_SK', 'ttl', 'ts_insert',
              'logSeq', 'name')
_ROW_SKIP = ('PK', 'ttl', 'ts_insert', 'ts_update')


def keep_per_match():
    """SNAPSHOT_KEEP_PER_MATCH (default 10, 0 = no snapshots)."""
    try:
        return max(0, int(os.environ.get('SNAPSHOT_KEEP_PER_MATCH', '10') or 0))
    except ValueError:
        return 10


def _plain(value):
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    if isinstance(value, (set, frozenset)):
        return sorted(value, key=str)
    if isinstance(value, (bytes, bytearray, Binary)):
        return bytes(value.value if isinstance(value, Binary) else value).hex()
    raise TypeError(f'not JSON serialisable: {type(value).__name__}')


def canonical(payload):
    """Keys sorted, no whitespace, numbers as JSON numbers: the text the checksum is taken on."""
    return json.dumps(payload, sort_keys=True, separators=(',', ':'), default=_plain,
                      ensure_ascii=False)


def sha256(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def _nz(value):
    try:
        return int(value) if value is not None else 0
    except (TypeError, ValueError):
        return 0


def _pk(match_uuid):
    return f'MATCH#{match_uuid}'


def _seq_of(sk):
    """The #seq suffix of a LOG#/AUDIT# sort key; one counter orders both prefixes."""
    try:
        return int(str(sk).rsplit('#', 1)[1])
    except (IndexError, ValueError):
        return 0


# ── time-end ──────────────────────────────────────────────────────────────────

def write_at_time_end(match, match_uuid, description=None, force=False):
    """Start of ``_advance_time``: best effort, a WARN line when it cannot be written.
    v0.41.4 — ``force`` writes even with snapshots off (the "Imported at clock N" point)."""
    keep = keep_per_match()
    if keep <= 0 and not force:
        return None
    try:
        # The rows this request queued belong to clock N: they get their sort keys first.
        logbook.persist(match)
        payload = build_payload(match, match_uuid)
        text = canonical(payload)
        ts = logbook.ts_ms()
        clock = _nz(match.get('currentClock'))
        item = {
            'PK': _pk(match_uuid), 'SK': f'{SNAPSHOT_PREFIX}{clock:06d}#{ts:013d}',
            'uuid': str(uuid_lib.uuid4()), 'type': TYPE_LIGHT, 'clock': clock,
            'checksum': sha256(text), 'logSeq': payload['logSeq'], 'logCount': payload['logCount'],
            'timestampMs': ts, 'timestamp': logbook.ms_to_iso(ts),
            'description': description or f'Time-end of clock {clock}', 'sizeBytes': len(text.encode('utf-8')),
            PACKED: gzip.compress(('{"payload":' + text + '}').encode('utf-8'), 6),
        }
        repo.save(item)
        if keep > 0:
            _prune(match_uuid, keep)
        return item
    except Exception as exc:  # noqa: BLE001 — a snapshot never breaks the time-end
        print(json.dumps({'level': 'WARN', 'event': 'SNAPSHOT', 'matchUuid': match_uuid,
                          'error': str(exc)}))
        return None


def build_payload(match, match_uuid):
    meta = {k: v for k, v in copy.deepcopy(match).items() if k not in _META_SKIP}
    rows = lambda items: [{k: v for k, v in copy.deepcopy(r).items() if k not in _ROW_SKIP}
                          for r in items]
    return {
        'v': PAYLOAD_VERSION, 'matchUuid': match_uuid, 'storyUuid': match.get('storyUuid'),
        'clock': _nz(match.get('currentClock')), 'metadata': meta,
        'characters': rows(repo.characters(match_uuid)), 'turns': rows(repo.turns(match_uuid)),
        'logSeq': _nz(match.get('logSeq')), 'logCount': _nz(match.get('logCount')),
    }


def _prune(match_uuid, keep):
    """The new row is still queued: the stored ones beyond keep - 1 go."""
    keys = sorted((k['SK'] for k in db_utils.query_sk_prefix_keys(_pk(match_uuid), SNAPSHOT_PREFIX)),
                  reverse=True)
    for sk in keys[max(0, keep - 1):]:
        db_utils.delete_item(_pk(match_uuid), sk)


# ── admin ─────────────────────────────────────────────────────────────────────

def items(match_uuid):
    """The SNAPSHOT# rows of a match, newest first."""
    rows = db_utils.query_sk_prefix(_pk(match_uuid), SNAPSHOT_PREFIX, consistent=False) or []
    return sorted(rows, key=lambda r: str(r.get('SK')), reverse=True)


def summary(item):
    return {'uuid': item.get('uuid'), 'clock': _nz(item.get('clock')),
            'type': item.get('type') or TYPE_LIGHT, 'timestamp': item.get('timestamp'),
            'description': item.get('description'), 'sizeBytes': _nz(item.get('sizeBytes'))}


def find(match_uuid, uuid_snapshot):
    return next((i for i in items(match_uuid) if i.get('uuid') == uuid_snapshot), None)


def payload_of(item):
    """The payload dict: already unpacked by db_utils, or read from the raw ``_gz``; None if unreadable."""
    if isinstance(item.get('payload'), dict):
        return item['payload']
    blob = item.get(PACKED)
    if blob is None:
        return None
    try:
        raw = blob.value if isinstance(blob, Binary) else blob
        value = json.loads(gzip.decompress(bytes(raw)).decode('utf-8'), parse_float=Decimal)
    except (OSError, ValueError, TypeError, EOFError):
        return None
    return value.get('payload') if isinstance(value, dict) and isinstance(value.get('payload'), dict) \
        else None


def _story_refs(payload):
    """(label, story list, key, value) of every story entity the payload points at."""
    meta = payload.get('metadata') if isinstance(payload.get('metadata'), dict) else {}
    chars = [c for c in (payload.get('characters') or []) if isinstance(c, dict)]
    refs = [('weather', 'weatherRules', 'id', meta.get('currentWeatherId')),
            ('location', 'locations', 'id', meta.get('currentLocationId'))]
    refs += [('location', 'locations', 'id', ls.get('idLocation'))
             for ls in (meta.get('locations') or []) if isinstance(ls, dict)]
    for row in (meta.get('registry') or []):
        if isinstance(row, dict):
            refs += [('event', 'events', 'id', row.get('idEvent')),
                     ('choice', 'choices', 'id', row.get('idChoice')),
                     ('mission', 'missions', 'id', row.get('idMission'))]
    for c in chars:
        refs += [('location', 'locations', 'id', c.get('idLocation')),
                 ('class', 'classes', 'uuid', c.get('classUuid')),
                 ('template', 'characterTemplates', 'uuid', c.get('characterTemplateUuid'))]
        refs += [('trait', 'traits', 'uuid', t) for t in (c.get('traitUuids') or [])]
        refs += [('item', 'items', 'id', i.get('idItem')) for i in (c.get('items') or [])
                 if isinstance(i, dict)]
    return refs


def _present(value, key):
    if value is None or value == '':
        return False
    return key != 'id' or _nz(value) > 0


def verify(match, match_uuid, item, story, user_exists):
    """The check codes of one snapshot; ``story`` may be None, ``user_exists(uuid)`` answers a bool."""
    payload = payload_of(item)
    if payload is None:
        return [{'code': CHECKSUM_MISMATCH, 'message': 'The payload is not readable JSON'}]
    errors = []
    if sha256(canonical(payload)) != item.get('checksum'):
        errors.append({'code': CHECKSUM_MISMATCH, 'message': 'The payload does not match its checksum'})
    if payload.get('v') != PAYLOAD_VERSION or isinstance(payload.get('v'), bool):
        errors.append({'code': VERSION_UNKNOWN, 'message': f"Unknown payload version: {payload.get('v')}"})
        return errors
    if payload.get('matchUuid') != match_uuid or payload.get('storyUuid') != match.get('storyUuid'):
        errors.append({'code': MATCH_MISMATCH, 'message': 'The snapshot belongs to another match or story'})
    seen = set()
    for label, list_key, key, value in _story_refs(payload):
        if not _present(value, key) or (label, str(value)) in seen:
            continue
        seen.add((label, str(value)))
        pool = {(_nz(e.get(key)) if key == 'id' else e.get(key))
                for e in ((story or {}).get(list_key) or []) if isinstance(e, dict)}
        wanted = _nz(value) if key == 'id' else value
        if wanted not in pool:
            errors.append({'code': STORY_ENTITY_MISSING,
                           'message': f'{label} {value} is no longer in the story'})
    meta = payload.get('metadata') if isinstance(payload.get('metadata'), dict) else {}
    users = [meta.get('userCreatorUuid')] + [c.get('userUuid') for c in (payload.get('characters') or [])
                                             if isinstance(c, dict)]
    for user in sorted({u for u in users if u}):
        if not user_exists(user):
            errors.append({'code': USER_MISSING, 'message': f'user {user} no longer exists'})
    return errors


def restore_state(match, match_uuid, item, payload):
    """Log cut above the seq, rows and METADATA (in place) put back, newer snapshots dropped; answers the LOG# rows removed."""
    pk = _pk(match_uuid)
    seq = _nz(payload.get('logSeq'))
    removed = 0
    # Cached first, so the rows deleted and saved below are what the time-start reads next.
    repo.characters(match_uuid)
    repo.turns(match_uuid)
    for prefix in (logbook.LOG_PREFIX, logbook.AUDIT_PREFIX):
        for key in db_utils.query_sk_prefix_keys(pk, prefix):
            if _seq_of(key['SK']) > seq:
                db_utils.delete_item(pk, key['SK'])
                repo.discard(pk, key['SK'])
                removed += 1 if prefix == logbook.LOG_PREFIX else 0
    for prefix, wanted in ((repo.CHARACTER_PREFIX, payload.get('characters')),
                           (repo.TURN_PREFIX, payload.get('turns'))):
        rows = [r for r in (wanted or []) if isinstance(r, dict) and str(r.get('SK', '')).startswith(prefix)]
        keep = {r['SK'] for r in rows}
        for key in db_utils.query_sk_prefix_keys(pk, prefix):
            if key['SK'] not in keep:
                db_utils.delete_item(pk, key['SK'])
                repo.discard(pk, key['SK'])
        for row in rows:
            repo.save({**copy.deepcopy(row), 'PK': pk})
    meta = payload.get('metadata') if isinstance(payload.get('metadata'), dict) else {}
    kept = {k: match[k] for k in _META_KEEP if k in match}
    match.clear()
    match.update(copy.deepcopy(meta))
    match.update(kept)
    # logCount back to the snapshot; logSeq never lowered, so no sort key is ever reused.
    match['logCount'] = _nz(payload.get('logCount'))
    match['logSeq'] = max(_nz(kept.get('logSeq')), seq)
    for key in db_utils.query_sk_prefix_keys(pk, SNAPSHOT_PREFIX):
        if str(key['SK']) > str(item.get('SK')):
            db_utils.delete_item(pk, key['SK'])
    return removed
