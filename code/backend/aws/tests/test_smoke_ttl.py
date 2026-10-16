"""v1.1.0 — V1 step 1: the smoke TTL sweep, ttl on every row of MATCH#/USER# (pagination included),
conditional updates only, errors logged and never raised."""
import json

from botocore.exceptions import ClientError

from common import db_utils
from smoke import ttl


class FakeTable:
    def __init__(self, rows, page_size=2, fail_sk=(), query_error=None):
        self.rows = rows
        self.page_size = page_size
        self.fail_sk = set(fail_sk)
        self.query_error = query_error
        self.queries = []
        self.updates = []

    def query(self, **kwargs):
        self.queries.append(kwargs)
        if self.query_error:
            raise self.query_error
        pk = kwargs['KeyConditionExpression'].get_expression()['values'][1]
        rows = [r for r in self.rows if r['PK'] == pk]
        start = 0
        if 'ExclusiveStartKey' in kwargs:
            start = next(i for i, r in enumerate(rows) if r['SK'] == kwargs['ExclusiveStartKey']['SK']) + 1
        page = rows[start:start + self.page_size]
        out = {'Items': [{'PK': r['PK'], 'SK': r['SK']} for r in page]}
        if start + self.page_size < len(rows):
            out['LastEvaluatedKey'] = {'PK': page[-1]['PK'], 'SK': page[-1]['SK']}
        return out

    def update_item(self, **kwargs):
        if kwargs['Key']['SK'] in self.fail_sk:
            raise ClientError({'Error': {'Code': 'ConditionalCheckFailedException', 'Message': 'gone'}}, 'UpdateItem')
        self.updates.append(kwargs)


ROWS = ([{'PK': 'MATCH#m1', 'SK': sk} for sk in ('METADATA', 'CHARACTER#1', 'TURN#1', 'LOG#1', 'AUDIT#1')]
        + [{'PK': 'USER#u1', 'SK': 'METADATA'}, {'PK': 'USER#other', 'SK': 'METADATA'}])


def _use(monkeypatch, table):
    monkeypatch.setattr(db_utils, '_get_table', lambda: table)
    return table


def test_every_row_of_both_partitions_gets_the_ttl_across_pages(monkeypatch, capsys):
    table = _use(monkeypatch, FakeTable(ROWS))
    result = ttl.apply('u1', 'm1', 7, now=1_000)
    assert result == {'MATCH#m1': 5, 'USER#u1': 1}
    assert sorted((u['Key']['PK'], u['Key']['SK']) for u in table.updates) == sorted(
        (r['PK'], r['SK']) for r in ROWS if r['PK'] in ('MATCH#m1', 'USER#u1'))
    update = table.updates[0]
    assert update['UpdateExpression'] == 'SET #ttl = :ttl'
    assert update['ConditionExpression'] == 'attribute_exists(PK)'
    assert update['ExpressionAttributeNames'] == {'#ttl': 'ttl'}
    assert update['ExpressionAttributeValues'] == {':ttl': 1_000 + 7 * 86400}
    match_queries = [q for q in table.queries if 'ExclusiveStartKey' in q]
    assert len(match_queries) == 2
    assert all(q['ProjectionExpression'] == 'PK, SK' and q['ConsistentRead'] is True for q in table.queries)
    line = json.loads(capsys.readouterr().out.strip().splitlines()[-1])
    assert line['event'] == 'SMOKE_TTL' and line['ttl'] == 1_000 + 7 * 86400


def test_partition_skipped_when_its_uuid_is_unknown(monkeypatch):
    table = _use(monkeypatch, FakeTable(ROWS))
    assert ttl.apply('u1', None, 7, now=0) == {'USER#u1': 1}
    assert ttl.apply(None, None, 7, now=0) == {}
    assert len(table.queries) == 1


def test_conditional_update_error_is_logged_and_the_sweep_goes_on(monkeypatch, capsys):
    table = _use(monkeypatch, FakeTable(ROWS, fail_sk={'TURN#1'}))
    assert ttl.apply('u1', 'm1', 7, now=0) == {'MATCH#m1': 4, 'USER#u1': 1}
    out = capsys.readouterr().out
    assert 'SMOKE_TTL_ROW_FAILED' in out and 'ConditionalCheckFailedException' in out
    assert len(table.updates) == 5


def test_query_error_is_logged_never_raised(monkeypatch, capsys):
    _use(monkeypatch, FakeTable(ROWS, query_error=RuntimeError('throttled')))
    assert ttl.apply('u1', 'm1', 7, now=0) == {'MATCH#m1': None, 'USER#u1': None}
    assert capsys.readouterr().out.count('SMOKE_TTL_FAILED') == 2


def test_default_now_is_the_clock(monkeypatch):
    table = _use(monkeypatch, FakeTable(ROWS))
    monkeypatch.setattr(ttl.time, 'time', lambda: 50.7)
    ttl.apply('u1', None, 1)
    assert table.updates[0]['ExpressionAttributeValues'] == {':ttl': 50 + 86400}
