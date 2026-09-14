import base64
import boto3
import gzip
import json
import os
import time
from decimal import Decimal
from boto3.dynamodb.conditions import Attr, Key
from boto3.dynamodb.types import Binary
from botocore.exceptions import ClientError

TABLE_NAME = os.environ.get('TABLE_NAME', 'PathsGamesBackend')

# Lazy initialization: do NOT call boto3.resource at import time.
# This avoids NoRegionError during test collection when AWS env vars are absent.
_dynamodb = None
_table = None


def _get_table():
    global _dynamodb, _table
    if _table is None:
        _dynamodb = boto3.resource('dynamodb', region_name=os.environ.get('AWS_DEFAULT_REGION', 'us-east-2'))
        _table = _dynamodb.Table(os.environ.get('TABLE_NAME', TABLE_NAME))
    return _table


def _to_dynamodb_value(value):
    """Recursively convert Python values to DynamoDB-safe values.

    In particular, DynamoDB does not accept Python float values; boto3 expects
    Decimal for numeric values with fractional part.
    """
    if isinstance(value, dict):
        return {k: _to_dynamodb_value(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_to_dynamodb_value(v) for v in value]
    if isinstance(value, tuple):
        return tuple(_to_dynamodb_value(v) for v in value)
    if isinstance(value, float):
        return Decimal(str(value))
    return value


# v0.37.5 — a STORY item is ~330 KB of JSON (texts alone 2/3 of it) and gzips 4x: every
# list/map of the item except ``summary`` (projected on GSI2) travels as ONE Binary ``_gz``.
PACKED_ATTR = '_gz'
_UNPACKED_KEYS = frozenset({'summary'})


def _is_story(item):
    return (str(item.get('PK', '')).startswith('STORY#')
            and item.get('SK', 'METADATA') == 'METADATA')


def _json_default(value):
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    if isinstance(value, (bytes, Binary)):
        return base64.b64encode(bytes(value)).decode('ascii')
    raise TypeError(f'not JSON serialisable: {type(value).__name__}')


def _pack(item):
    """The item with its nested values gzipped into ``_gz`` (stories only; others untouched)."""
    if not _is_story(item):
        return item
    heavy = {k: v for k, v in item.items()
             if isinstance(v, (list, dict, tuple)) and k not in _UNPACKED_KEYS}
    if not heavy:
        return item
    packed = {k: v for k, v in item.items() if k not in heavy}
    raw = json.dumps(heavy, separators=(',', ':'), default=_json_default).encode('utf-8')
    packed[PACKED_ATTR] = gzip.compress(raw, 6)
    return packed


def _unpack(item):
    """The item as it was before ``_pack`` (numbers come back as Decimal, like DynamoDB)."""
    if not item or PACKED_ATTR not in item:
        return item
    blob = item.pop(PACKED_ATTR)
    if isinstance(blob, Binary):
        blob = blob.value
    heavy = json.loads(gzip.decompress(blob).decode('utf-8'), parse_float=Decimal)
    for key, value in heavy.items():
        item.setdefault(key, value)
    return item


def _unpack_all(items):
    for item in items:
        _unpack(item)
    return items

def get_item(pk, sk='METADATA', consistent=True):
    """Fetch a single item from DynamoDB, STRONGLY consistent by default.

    v0.36.3 — one Lambda invocation writes an item and reads it back (an event moves a
    character, then the time-start pass reads the roster): an eventually consistent read
    returns the row as it was and the caller writes that stale row back, undoing the move.
    v0.37.5 — ``consistent=False`` halves the read cost for rows the caller never writes
    back in the same request (stories, users, system config).
    """
    try:
        response = _get_table().get_item(Key={'PK': pk, 'SK': sk}, ConsistentRead=bool(consistent))
        return _unpack(response.get('Item'))
    except ClientError as e:
        print(f"Error fetching item {pk}/{sk}: {e}")
        return None

def put_item(item):
    """Upsert an item into DynamoDB."""
    try:
        now = int(time.time() * 1000)
        if 'ts_insert' not in item:
            item['ts_insert'] = now
        item['ts_update'] = now
        sanitized = _pack(_to_dynamodb_value(item))
        _get_table().put_item(Item=sanitized)
        return True
    except ClientError as e:
        print(f"Error putting item: {e}")
        return False
    except Exception as e:
        print(f"Unexpected error putting item: {e}")
        return False

def batch_put_items(items):
    """v0.37.5 — write many items in one batch (log rows, a request's dirty set), stamping
    ts_* like put_item; a key repeated in the list keeps its last occurrence."""
    if not items:
        return True
    try:
        now = int(time.time() * 1000)
        with _get_table().batch_writer(overwrite_by_pkeys=['PK', 'SK']) as batch:
            for item in items:
                if 'ts_insert' not in item:
                    item['ts_insert'] = now
                item['ts_update'] = now
                batch.put_item(Item=_pack(_to_dynamodb_value(item)))
        return True
    except ClientError as e:
        print(f"Error batch putting {len(items)} items: {e}")
        return False
    except Exception as e:
        print(f"Unexpected error batch putting items: {e}")
        return False

def delete_item(pk, sk='METADATA'):
    """Delete a single item from DynamoDB."""
    try:
        _get_table().delete_item(Key={'PK': pk, 'SK': sk})
        return True
    except ClientError as e:
        print(f"Error deleting item {pk}/{sk}: {e}")
        return False

def delete_all_by_pk(pk):
    """Delete ALL items sharing the same Partition Key (cascading delete)."""
    try:
        keys = _paginate(_get_table().query, KeyConditionExpression=Key('PK').eq(pk),
                         ProjectionExpression='PK, SK', ConsistentRead=True)
    except ClientError as e:
        print(f"Error querying keys of PK {pk}: {e}")
        return 0
    count = 0
    for item in keys:
        delete_item(item['PK'], item['SK'])
        count += 1
    return count

def _paginate(operation, **kwargs):
    """Run a DynamoDB query/scan to completion, following LastEvaluatedKey.

    A single query/scan returns at most 1 MB of data; for a scan that 1 MB is
    measured BEFORE the FilterExpression is applied, so a large table can hide
    matching items on later pages. Looping on ExclusiveStartKey returns them all.
    """
    items = []
    while True:
        response = operation(**kwargs)
        items.extend(response.get('Items', []))
        last_key = response.get('LastEvaluatedKey')
        if not last_key:
            break
        kwargs['ExclusiveStartKey'] = last_key
    return _unpack_all(items)

def query_by_pk(pk):
    """Query all items with the same Partition Key (paginated), STRONGLY consistent.
    Same reason as get_item: a match partition is read back after being written."""
    try:
        return _paginate(
            _get_table().query,
            KeyConditionExpression='PK = :pk',
            ExpressionAttributeValues={':pk': pk},
            ConsistentRead=True,
        )
    except ClientError as e:
        print(f"Error querying PK {pk}: {e}")
        return []

def query_sk_prefix(pk, sk_prefix, consistent=True, filter_expr=None):
    """v0.37.5 — every item of a partition whose SK starts with the prefix (paginated).

    Replaces the whole-partition ``query_by_pk`` where the caller only wants one item
    kind (CHARACTER#, TURN#, LOG#): the METADATA row and the log rows never travel."""
    kwargs = {
        'KeyConditionExpression': Key('PK').eq(pk) & Key('SK').begins_with(sk_prefix),
        'ConsistentRead': bool(consistent),
    }
    if filter_expr is not None:
        kwargs['FilterExpression'] = filter_expr
    try:
        return _paginate(_get_table().query, **kwargs)
    except ClientError as e:
        print(f"Error querying PK {pk} SK prefix {sk_prefix}: {e}")
        return []

def query_sk_prefix_page(pk, sk_prefix, limit, start_key=None, ascending=True, consistent=False):
    """v0.37.5 — ONE page of a partition's SK-prefix range, ``(items, last_evaluated_key)``.

    Same shape as :func:`query_index_page`; ``ascending`` drives ``ScanIndexForward``."""
    kwargs = {
        'KeyConditionExpression': Key('PK').eq(pk) & Key('SK').begins_with(sk_prefix),
        'Limit': int(limit),
        'ScanIndexForward': bool(ascending),
        'ConsistentRead': bool(consistent),
    }
    if start_key:
        kwargs['ExclusiveStartKey'] = start_key
    try:
        response = _get_table().query(**kwargs)
        return _unpack_all(response.get('Items', [])), response.get('LastEvaluatedKey')
    except ClientError as e:
        print(f"Error querying page PK {pk} SK prefix {sk_prefix}: {e}")
        return [], None

# Key attribute pair of every index (both are INCLUDE projections, see template.yaml).
_GSI_KEYS = {
    'GSI1': ('GSI1_PK', 'GSI1_SK'),
    'GSI2': ('GSI2_PK', 'GSI2_SK'),
}

def query_gsi(gsi_name, pk_val, sk_prefix=None):
    """Query a secondary index (paginated)."""
    try:
        pk_attr, sk_attr = _GSI_KEYS.get(gsi_name, _GSI_KEYS['GSI1'])
        condition  = f'{pk_attr} = :pk'
        attr_vals  = {':pk': pk_val}
        if sk_prefix:
            condition += f' AND begins_with({sk_attr}, :sk)'
            attr_vals[':sk'] = sk_prefix
        return _paginate(
            _get_table().query,
            IndexName=gsi_name,
            KeyConditionExpression=condition,
            ExpressionAttributeValues=attr_vals,
        )
    except ClientError as e:
        print(f"Error querying GSI {gsi_name}: {e}")
        return []

def query_index_page(index_name, pk_name, pk_val, sk_name=None, sk_from=None,
                     eq_filters=None, limit=50, start_key=None,
                     ascending=False):
    """Single-page Query of a GSI used for cursor pagination (v0.28.1).

    Unlike :func:`query_gsi`, this does NOT follow ``LastEvaluatedKey``: it runs
    exactly one Query (at most ``limit`` items) and returns the key of the last
    evaluated item so the caller can resume from a cursor.

    ``sk_from`` adds a ``begins-at`` range on the sort key (``SK >= sk_from``),
    used to scope the admin list to recent matches (sinceDays). ``eq_filters`` is
    a ``{attr: value}`` mapping turned into post-read equality ``FilterExpression``
    clauses (status / userCreatorUuid / storyUuid). ``ascending`` drives
    ``ScanIndexForward`` — the default ``False`` returns newest-first when the
    sort key is timestamp-prefixed.

    Returns ``(items, last_evaluated_key)`` where ``last_evaluated_key`` is
    ``None`` when there are no further pages.
    """
    try:
        key_cond = Key(pk_name).eq(pk_val)
        if sk_name and sk_from is not None:
            key_cond = key_cond & Key(sk_name).gte(sk_from)
        kwargs = {
            'IndexName': index_name,
            'KeyConditionExpression': key_cond,
            'Limit': limit,
            'ScanIndexForward': ascending,
        }
        filter_expr = None
        for attr_name, attr_value in (eq_filters or {}).items():
            if attr_value is None:
                continue
            clause = Attr(attr_name).eq(attr_value)
            filter_expr = clause if filter_expr is None else (filter_expr & clause)
        if filter_expr is not None:
            kwargs['FilterExpression'] = filter_expr
        if start_key:
            kwargs['ExclusiveStartKey'] = start_key
        response = _get_table().query(**kwargs)
        return _unpack_all(response.get('Items', [])), response.get('LastEvaluatedKey')
    except ClientError as e:
        print(f"Error querying index page {index_name}/{pk_val}: {e}")
        return [], None


def encode_cursor(last_key):
    """Encode a DynamoDB ``LastEvaluatedKey`` as an opaque base64 cursor token."""
    if not last_key:
        return None
    raw = json.dumps(last_key, sort_keys=True, default=str)
    return base64.urlsafe_b64encode(raw.encode('utf-8')).decode('ascii')


def decode_cursor(cursor):
    """Decode an opaque cursor token back into an ``ExclusiveStartKey`` dict.

    Returns ``None`` for a missing or malformed token (the query then starts from
    the first page instead of failing)."""
    if not cursor:
        return None
    try:
        raw = base64.urlsafe_b64decode(cursor.encode('ascii'))
        decoded = json.loads(raw)
        return decoded if isinstance(decoded, dict) else None
    except (ValueError, TypeError):
        return None


CACHE_VERSIONS_PK = 'SYSTEM#cache'

def get_cache_versions():
    """v0.37.5 — ``{storyVersions: {uuid: ts_ms}, globalVersion: ts_ms}``.

    A consistent read (1 RRU, the item is tiny): an admin write on one Lambda must be
    seen by the next request on another, not after replication catches up."""
    item = get_item(CACHE_VERSIONS_PK) or {}
    return {
        'storyVersions': dict(item.get('storyVersions') or {}),
        'globalVersion': int(item.get('globalVersion') or 0),
    }

def _put_cache_versions(mutate):
    item = get_item(CACHE_VERSIONS_PK) or {'PK': CACHE_VERSIONS_PK, 'SK': 'METADATA'}
    item.setdefault('storyVersions', {})
    now = int(time.time() * 1000)
    mutate(item, now)
    put_item(item)
    return now

def bump_story_version(story_uuid):
    """v0.37.5 — a story was written: every warm Lambda drops its cached copy."""
    def mutate(item, now):
        item['storyVersions'][str(story_uuid)] = now
    return _put_cache_versions(mutate)

def bump_global_version():
    """v0.37.5 — POST /api/admin/cache/flush: invalidate every cached story everywhere."""
    def mutate(item, now):
        item['globalVersion'] = now
        item['storyVersions'] = {}
    return _put_cache_versions(mutate)


def update_ts_last_access(pk, now_ms, sk='METADATA', in_summary=False):
    """Update the ts_last_access timestamp of an item.
    ``in_summary`` also stamps ``summary.ts_last_access`` — the copy GSI2 projects for guests."""
    expression = 'SET ts_last_access = :t'
    if in_summary:
        expression += ', summary.ts_last_access = :t'
    try:
        _get_table().update_item(
            Key={'PK': pk, 'SK': sk},
            UpdateExpression=expression,
            ExpressionAttributeValues={':t': now_ms}
        )
        return True
    except ClientError as e:
        print(f"Error updating ts_last_access for {pk}: {e}")
        return False
