import base64
import boto3
import json
import os
import time
from decimal import Decimal
from boto3.dynamodb.conditions import Attr, Key
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

def get_item(pk, sk='METADATA'):
    """Fetch a single item from DynamoDB."""
    try:
        response = _get_table().get_item(Key={'PK': pk, 'SK': sk})
        return response.get('Item')
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
        sanitized = _to_dynamodb_value(item)
        _get_table().put_item(Item=sanitized)
        return True
    except ClientError as e:
        print(f"Error putting item: {e}")
        return False
    except Exception as e:
        print(f"Unexpected error putting item: {e}")
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
    items = query_by_pk(pk)
    count = 0
    for item in items:
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
    return items

def query_by_pk(pk):
    """Query all items with the same Partition Key (paginated)."""
    try:
        return _paginate(
            _get_table().query,
            KeyConditionExpression='PK = :pk',
            ExpressionAttributeValues={':pk': pk},
        )
    except ClientError as e:
        print(f"Error querying PK {pk}: {e}")
        return []

def query_gsi(gsi_name, pk_val, sk_prefix=None):
    """Query a secondary index (paginated)."""
    try:
        condition  = 'GSI1_PK = :pk'
        attr_vals  = {':pk': pk_val}
        if sk_prefix:
            condition += ' AND begins_with(GSI1_SK, :sk)'
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
        return response.get('Items', []), response.get('LastEvaluatedKey')
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


def scan_filter(attr_name, attr_value):
    """Scan the table filtering on a single attribute value (paginated)."""
    try:
        return _paginate(_get_table().scan, FilterExpression=Attr(attr_name).eq(attr_value))
    except ClientError as e:
        print(f"Error scanning filter {attr_name}={attr_value}: {e}")
        return []

def scan_pk_prefix(prefix):
    """Scan the table returning every item whose PK starts with the prefix (paginated)."""
    try:
        return _paginate(_get_table().scan, FilterExpression=Attr('PK').begins_with(prefix))
    except ClientError as e:
        print(f"Error scanning PK prefix {prefix}: {e}")
        return []

def backfill_gsi2_matches(dry_run=False):
    """One-time migration (v0.28.1): add the GSI2 "by type" keys to every match
    METADATA item that predates the index.

    The admin list (GET /api/admin/matches) is a Query on GSI2; matches created
    before v0.28.1 have no ``GSI2_PK``/``GSI2_SK`` attributes, so they are absent
    from the index and never appear in the list even though they exist in the
    table. This scans the match METADATA items and sets, for each one missing the
    keys, ``GSI2_PK='MATCH'`` and ``GSI2_SK='{tsInsert:020d}#{uuid}'`` — the exact
    format ``_create_match`` writes, so backfilled and new rows sort together.

    Idempotent: items that already carry ``GSI2_PK`` are left untouched, so it is
    safe to run repeatedly. Returns ``{'scanned', 'updated', 'skipped'}``.
    """
    table = _get_table()
    stats = {'scanned': 0, 'updated': 0, 'skipped': 0}
    # Only the match METADATA row carries the summary (sub-items like CHARACTER#
    # share the PK but must NOT be indexed) — filter on SK == 'METADATA'.
    kwargs = {'FilterExpression': Attr('PK').begins_with('MATCH#') & Attr('SK').eq('METADATA')}
    while True:
        response = table.scan(**kwargs)
        for item in response.get('Items', []):
            stats['scanned'] += 1
            if 'GSI2_PK' in item:
                stats['skipped'] += 1
                continue
            uuid = item.get('uuid') or item['PK'].split('#', 1)[-1]
            try:
                ts_ms = int(item.get('tsInsert') or 0)
            except (TypeError, ValueError):
                ts_ms = 0
            if not dry_run:
                table.update_item(
                    Key={'PK': item['PK'], 'SK': item['SK']},
                    UpdateExpression='SET GSI2_PK = :p, GSI2_SK = :s',
                    ExpressionAttributeValues={':p': 'MATCH', ':s': f'{ts_ms:020d}#{uuid}'},
                )
            stats['updated'] += 1
        last_key = response.get('LastEvaluatedKey')
        if not last_key:
            break
        kwargs['ExclusiveStartKey'] = last_key
    return stats


def update_ts_last_access(pk, now_ms, sk='METADATA'):
    """Update the ts_last_access timestamp of an item."""
    try:
        _get_table().update_item(
            Key={'PK': pk, 'SK': sk},
            UpdateExpression='SET ts_last_access = :t',
            ExpressionAttributeValues={':t': now_ms}
        )
        return True
    except ClientError as e:
        print(f"Error updating ts_last_access for {pk}: {e}")
        return False
