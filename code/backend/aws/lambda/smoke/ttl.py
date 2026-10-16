"""v1.1.0 — gives every row of the smoke guest and match a DynamoDB ttl, so they expire after N days.
Never raises: a TTL problem is logged and must not hide the test result."""
import json
import time

from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from common import db_utils


def _log(level, event, **fields):
    print(json.dumps({'level': level, 'event': event, **fields}))


def _keys(table, pk):
    kwargs = {'KeyConditionExpression': Key('PK').eq(pk), 'ProjectionExpression': 'PK, SK',
              'ConsistentRead': True}
    while True:
        page = table.query(**kwargs)
        for item in page.get('Items') or []:
            yield {'PK': item['PK'], 'SK': item['SK']}
        last = page.get('LastEvaluatedKey')
        if not last:
            return
        kwargs['ExclusiveStartKey'] = last


def _sweep(table, pk, expires_at):
    updated = 0
    for key in _keys(table, pk):
        try:
            table.update_item(Key=key, UpdateExpression='SET #ttl = :ttl',
                              ConditionExpression='attribute_exists(PK)',
                              ExpressionAttributeNames={'#ttl': 'ttl'},
                              ExpressionAttributeValues={':ttl': expires_at})
            updated += 1
        except ClientError as exc:
            _log('WARN', 'SMOKE_TTL_ROW_FAILED', pk=pk, sk=key['SK'],
                 error=exc.response.get('Error', {}).get('Code', str(exc)))
    return updated


def apply(user_uuid, match_uuid, days, now=None):
    """Returns ``{partition: rows updated}``; a partition whose uuid is unknown is skipped."""
    expires_at = int(now if now is not None else time.time()) + int(days) * 86400
    result = {}
    for prefix, value in (('MATCH#', match_uuid), ('USER#', user_uuid)):
        if not value:
            continue
        pk = f'{prefix}{value}'
        try:
            result[pk] = _sweep(db_utils._get_table(), pk, expires_at)
        except Exception as exc:  # noqa: BLE001 - logged, never raised (finally block)
            _log('WARN', 'SMOKE_TTL_FAILED', pk=pk, error=f'{type(exc).__name__}: {exc}')
            result[pk] = None
    _log('INFO', 'SMOKE_TTL', ttl=expires_at, rows=result)
    return result
