"""
Unit tests for common/db_utils.py.
We patch `common.db_utils._table` (the lazy-initialized DynamoDB Table object)
so no real AWS calls are made and boto3 is never contacted at import time.
"""
from decimal import Decimal

import pytest
from unittest.mock import MagicMock, patch
from botocore.exceptions import ClientError
import common.db_utils as db


@patch.object(db, '_table')
class TestToynamodbValue:
    def test_float_converted_to_decimal(self, _t):
        assert db._to_dynamodb_value({'score': 1.5}) == {'score': Decimal('1.5')}

    def test_nested_float_conversion(self, _t):
        result = db._to_dynamodb_value({'a': {'b': 2.7}})
        assert result['a']['b'] == Decimal('2.7')

    def test_list_float_conversion(self, _t):
        result = db._to_dynamodb_value([1.1, 'text', 3])
        assert result[0] == Decimal('1.1')
        assert result[1] == 'text'
        assert result[2] == 3

    def test_non_float_passthrough(self, _t):
        result = db._to_dynamodb_value({'x': 42, 'y': 'hello', 'z': True})
        assert result == {'x': 42, 'y': 'hello', 'z': True}

    def test_tuple_conversion(self, _t):
        result = db._to_dynamodb_value((1.5, 2))
        assert result == (Decimal('1.5'), 2)


@patch.object(db, '_table')
class TestGetItem:
    def test_hit(self, mock_table):
        mock_table.get_item.return_value = {'Item': {'PK': 'USER#1', 'uuid': '1'}}
        result = db.get_item('USER#1')
        assert result['uuid'] == '1'
        mock_table.get_item.assert_called_once_with(
            Key={'PK': 'USER#1', 'SK': 'METADATA'}, ConsistentRead=True)

    def test_miss(self, mock_table):
        mock_table.get_item.return_value = {}
        assert db.get_item('USER#missing') is None

    def test_custom_sk(self, mock_table):
        mock_table.get_item.return_value = {}
        db.get_item('X', sk='CUSTOM')
        mock_table.get_item.assert_called_once_with(
            Key={'PK': 'X', 'SK': 'CUSTOM'}, ConsistentRead=True)


@patch.object(db, '_table')
class TestPutItem:
    def test_adds_timestamps(self, mock_table):
        mock_table.put_item.return_value = {}
        result = db.put_item({'PK': 'X', 'SK': 'METADATA'})
        assert result is True
        item = mock_table.put_item.call_args[1]['Item']
        assert 'ts_insert' in item
        assert 'ts_update' in item

    def test_converts_float(self, mock_table):
        mock_table.put_item.return_value = {}
        db.put_item({'PK': 'X', 'SK': 'METADATA', 'score': 3.14})
        item = mock_table.put_item.call_args[1]['Item']
        assert item['score'] == Decimal('3.14')

    def test_preserves_existing_ts_insert(self, mock_table):
        mock_table.put_item.return_value = {}
        db.put_item({'PK': 'X', 'SK': 'METADATA', 'ts_insert': 999})
        item = mock_table.put_item.call_args[1]['Item']
        assert item['ts_insert'] == 999


@patch.object(db, '_table')
class TestDeleteItem:
    def test_success(self, mock_table):
        mock_table.delete_item.return_value = {}
        assert db.delete_item('USER#1') is True
        mock_table.delete_item.assert_called_once_with(Key={'PK': 'USER#1', 'SK': 'METADATA'})

    def test_custom_sk(self, mock_table):
        mock_table.delete_item.return_value = {}
        db.delete_item('X', 'MY_SK')
        mock_table.delete_item.assert_called_once_with(Key={'PK': 'X', 'SK': 'MY_SK'})


@patch.object(db, '_table')
class TestQueryByPk:
    def test_returns_items(self, mock_table):
        mock_table.query.return_value = {'Items': [{'PK': 'X', 'SK': 'A'}]}
        assert len(db.query_by_pk('X')) == 1

    def test_empty(self, mock_table):
        mock_table.query.return_value = {'Items': []}
        assert db.query_by_pk('MISSING') == []

    def test_reads_strongly_consistent(self, mock_table):
        """v0.36.3 — a match partition is read back inside the very request that wrote it,
        so an eventually consistent answer would hand back rows the caller has replaced."""
        mock_table.query.return_value = {'Items': []}
        db.query_by_pk('MATCH#m1')
        assert mock_table.query.call_args.kwargs['ConsistentRead'] is True


@patch.object(db, '_table')
class TestDeleteAllByPk:
    def test_deletes_all(self, mock_table):
        mock_table.query.return_value = {
            'Items': [{'PK': 'S#1', 'SK': 'METADATA'}, {'PK': 'S#1', 'SK': 'EXTRA'}]
        }
        mock_table.delete_item.return_value = {}
        count = db.delete_all_by_pk('S#1')
        assert count == 2
        assert mock_table.delete_item.call_count == 2
        assert mock_table.query.call_args.kwargs['ProjectionExpression'] == 'PK, SK'

    def test_query_error_deletes_nothing(self, mock_table):
        mock_table.query.side_effect = ClientError({'Error': {'Code': 'X'}}, 'Query')
        assert db.delete_all_by_pk('S#1') == 0
        mock_table.delete_item.assert_not_called()


@patch.object(db, '_table')
class TestUpdateTsLastAccess:
    def test_success(self, mock_table):
        mock_table.update_item.return_value = {}
        assert db.update_ts_last_access('USER#1', 12345) is True
        kwargs = mock_table.update_item.call_args[1]
        assert kwargs['ExpressionAttributeValues'][':t'] == 12345


class TestGetTable:
    @pytest.fixture(autouse=True)
    def _real_get_table(self, monkeypatch):
        """The conftest guard stands aside: these tests are about the lazy boto3 binding."""
        monkeypatch.setattr(db, '_OFFLINE_BYPASS', True, raising=False)

    def test_lazy_initialization_uses_env_values(self):
        fake_table = MagicMock()
        fake_resource = MagicMock()
        fake_resource.Table.return_value = fake_table

        with patch.object(db, '_table', None), patch.object(db, '_dynamodb', None), \
             patch.dict('os.environ', {'AWS_DEFAULT_REGION': 'eu-west-1', 'TABLE_NAME': 'MyTable'}, clear=False), \
             patch('common.db_utils.boto3.resource', return_value=fake_resource) as mock_boto:
            table = db._get_table()
            assert table is fake_table
            mock_boto.assert_called_once_with('dynamodb', region_name='eu-west-1')
            fake_resource.Table.assert_called_once_with('MyTable')

    def test_lazy_initialization_default_region(self):
        fake_table = MagicMock()
        fake_resource = MagicMock()
        fake_resource.Table.return_value = fake_table

        with patch.object(db, '_table', None), patch.object(db, '_dynamodb', None), \
             patch.dict('os.environ', {'TABLE_NAME': 'OnlyTableName'}, clear=False), \
             patch('common.db_utils.boto3.resource', return_value=fake_resource) as mock_boto:
            db._get_table()
            mock_boto.assert_called_once_with('dynamodb', region_name='us-east-2')


@patch.object(db, '_table')
class TestQueryGsi:
    def test_without_sk_prefix(self, mock_table):
        mock_table.query.return_value = {'Items': [{'PK': 'A'}]}
        result = db.query_gsi('GSI1', 'group#1')
        assert len(result) == 1
        kwargs = mock_table.query.call_args[1]
        assert kwargs['KeyConditionExpression'] == 'GSI1_PK = :pk'
        assert kwargs['ExpressionAttributeValues'] == {':pk': 'group#1'}

    def test_with_sk_prefix(self, mock_table):
        mock_table.query.return_value = {'Items': [{'PK': 'A'}]}
        db.query_gsi('GSI1', 'group#1', sk_prefix='story#')
        kwargs = mock_table.query.call_args[1]
        assert kwargs['KeyConditionExpression'] == 'GSI1_PK = :pk AND begins_with(GSI1_SK, :sk)'
        assert kwargs['ExpressionAttributeValues'] == {':pk': 'group#1', ':sk': 'story#'}


@patch.object(db, '_table')
class TestDbUtilsErrorBranches:
    def test_get_item_client_error_returns_none(self, mock_table):
        mock_table.get_item.side_effect = ClientError(
            {'Error': {'Code': 'ProvisionedThroughputExceededException', 'Message': 'boom'}},
            'GetItem'
        )
        assert db.get_item('X') is None

    def test_put_item_client_error_returns_false(self, mock_table):
        mock_table.put_item.side_effect = ClientError(
            {'Error': {'Code': 'ValidationException', 'Message': 'boom'}},
            'PutItem'
        )
        assert db.put_item({'PK': 'X', 'SK': 'METADATA'}) is False

    def test_put_item_unexpected_error_returns_false(self, mock_table):
        mock_table.put_item.side_effect = RuntimeError('unexpected')
        assert db.put_item({'PK': 'X', 'SK': 'METADATA'}) is False

    def test_delete_item_client_error_returns_false(self, mock_table):
        mock_table.delete_item.side_effect = ClientError(
            {'Error': {'Code': 'InternalServerError', 'Message': 'boom'}},
            'DeleteItem'
        )
        assert db.delete_item('X') is False

    def test_query_by_pk_client_error_returns_empty(self, mock_table):
        mock_table.query.side_effect = ClientError(
            {'Error': {'Code': 'InternalServerError', 'Message': 'boom'}},
            'Query'
        )
        assert db.query_by_pk('X') == []

    def test_query_gsi_client_error_returns_empty(self, mock_table):
        mock_table.query.side_effect = ClientError(
            {'Error': {'Code': 'InternalServerError', 'Message': 'boom'}},
            'Query'
        )
        assert db.query_gsi('GSI1', 'X') == []

    def test_update_ts_last_access_client_error_returns_false(self, mock_table):
        mock_table.update_item.side_effect = ClientError(
            {'Error': {'Code': 'InternalServerError', 'Message': 'boom'}},
            'UpdateItem'
        )
        assert db.update_ts_last_access('USER#1', 12345) is False


@patch.object(db, '_table')
class TestPagination:
    """scan/query helpers must follow LastEvaluatedKey so large tables are fully read."""

    def test_query_by_pk_follows_last_evaluated_key(self, mock_table):
        mock_table.query.side_effect = [
            {'Items': [{'SK': 'A'}], 'LastEvaluatedKey': {'SK': 'A'}},
            {'Items': [{'SK': 'B'}]},
        ]
        result = db.query_by_pk('MATCH#1')
        assert len(result) == 2
        assert mock_table.query.call_count == 2

    def test_query_gsi_follows_last_evaluated_key(self, mock_table):
        mock_table.query.side_effect = [
            {'Items': [{'SK': 'A'}], 'LastEvaluatedKey': {'SK': 'A'}},
            {'Items': [{'SK': 'B'}]},
        ]
        assert len(db.query_gsi('GSI1', 'USER_MATCHES#u1')) == 2
        assert mock_table.query.call_count == 2


@patch.object(db, '_table')
class TestQueryIndexPage:
    """v0.28.1 — single-page GSI query for cursor pagination (no LEK following)."""

    def test_single_page_returns_items_and_last_key(self, mock_table):
        mock_table.query.return_value = {
            'Items': [{'uuid': 'm2'}, {'uuid': 'm1'}],
            'LastEvaluatedKey': {'GSI2_SK': '00000000000000000100#m1'},
        }
        items, last = db.query_index_page('GSI2', 'GSI2_PK', 'MATCH', limit=2)
        assert [i['uuid'] for i in items] == ['m2', 'm1']
        assert last == {'GSI2_SK': '00000000000000000100#m1'}
        # Exactly one query — pagination is the caller's job, via the cursor.
        assert mock_table.query.call_count == 1
        kwargs = mock_table.query.call_args.kwargs
        assert kwargs['IndexName'] == 'GSI2'
        assert kwargs['Limit'] == 2
        assert kwargs['ScanIndexForward'] is False
        assert 'FilterExpression' not in kwargs
        assert 'ExclusiveStartKey' not in kwargs

    def test_sk_from_adds_range_and_filters_and_start_key(self, mock_table):
        mock_table.query.return_value = {'Items': []}
        items, last = db.query_index_page(
            'GSI2', 'GSI2_PK', 'MATCH', sk_name='GSI2_SK', sk_from='00000000000000000050',
            eq_filters={'status': 'RUNNING', 'storyUuid': None}, limit=10,
            start_key={'GSI2_SK': 'x'}, ascending=True,
        )
        assert items == [] and last is None
        kwargs = mock_table.query.call_args.kwargs
        assert kwargs['ScanIndexForward'] is True
        assert kwargs['ExclusiveStartKey'] == {'GSI2_SK': 'x'}
        # None-valued filters are dropped; only status survives.
        assert 'FilterExpression' in kwargs

    def test_no_active_filters_omits_filter_expression(self, mock_table):
        mock_table.query.return_value = {'Items': []}
        db.query_index_page('GSI2', 'GSI2_PK', 'MATCH', eq_filters={'status': None})
        assert 'FilterExpression' not in mock_table.query.call_args.kwargs

    def test_client_error_returns_empty(self, mock_table):
        mock_table.query.side_effect = ClientError(
            {'Error': {'Code': 'InternalServerError', 'Message': 'boom'}}, 'Query')
        assert db.query_index_page('GSI2', 'GSI2_PK', 'MATCH') == ([], None)


# ── v0.37.5 — eventual reads, SK-prefix queries, batch writes, cache stamps ───

@patch.object(db, '_table')
class TestEventualGetItem:
    def test_consistent_false_is_forwarded(self, mock_table):
        mock_table.get_item.return_value = {'Item': {'PK': 'STORY#1'}}
        assert db.get_item('STORY#1', consistent=False) == {'PK': 'STORY#1'}
        mock_table.get_item.assert_called_once_with(
            Key={'PK': 'STORY#1', 'SK': 'METADATA'}, ConsistentRead=False)


@patch.object(db, '_table')
class TestQuerySkPrefix:
    def test_all_pages_consistent_by_default(self, mock_table):
        mock_table.query.side_effect = [
            {'Items': [{'SK': 'CHARACTER#a'}], 'LastEvaluatedKey': {'x': 1}},
            {'Items': [{'SK': 'CHARACTER#b'}]},
        ]
        rows = db.query_sk_prefix('MATCH#m1', 'CHARACTER#')
        assert [r['SK'] for r in rows] == ['CHARACTER#a', 'CHARACTER#b']
        first = mock_table.query.call_args_list[0][1]
        assert first['ConsistentRead'] is True and 'FilterExpression' not in first
        assert mock_table.query.call_args_list[1][1]['ExclusiveStartKey'] == {'x': 1}

    def test_filter_and_eventual(self, mock_table):
        from boto3.dynamodb.conditions import Attr
        mock_table.query.return_value = {'Items': []}
        db.query_sk_prefix('MATCH#m1', 'LOG#', consistent=False,
                           filter_expr=Attr('type').eq('WEATHER'))
        kwargs = mock_table.query.call_args[1]
        assert kwargs['ConsistentRead'] is False and 'FilterExpression' in kwargs

    def test_client_error_returns_empty(self, mock_table):
        mock_table.query.side_effect = ClientError({'Error': {'Code': 'X'}}, 'Query')
        assert db.query_sk_prefix('MATCH#m1', 'LOG#') == []


@patch.object(db, '_table')
class TestQuerySkPrefixPage:
    def test_one_page_with_limit_order_and_start_key(self, mock_table):
        mock_table.query.return_value = {'Items': [{'SK': 'LOG#1'}],
                                         'LastEvaluatedKey': {'SK': 'LOG#1'}}
        items, last = db.query_sk_prefix_page('MATCH#m1', 'LOG#', 3, start_key={'SK': 'LOG#0'},
                                              ascending=False)
        assert items == [{'SK': 'LOG#1'}] and last == {'SK': 'LOG#1'}
        kwargs = mock_table.query.call_args[1]
        assert kwargs['Limit'] == 3 and kwargs['ScanIndexForward'] is False
        assert kwargs['ConsistentRead'] is False
        assert kwargs['ExclusiveStartKey'] == {'SK': 'LOG#0'}

    def test_no_start_key_and_error(self, mock_table):
        mock_table.query.return_value = {'Items': []}
        assert db.query_sk_prefix_page('MATCH#m1', 'LOG#', 3) == ([], None)
        assert 'ExclusiveStartKey' not in mock_table.query.call_args[1]
        mock_table.query.side_effect = ClientError({'Error': {'Code': 'X'}}, 'Query')
        assert db.query_sk_prefix_page('MATCH#m1', 'LOG#', 3) == ([], None)


@patch.object(db, '_table')
class TestBatchPutItems:
    def test_empty_is_a_no_op(self, mock_table):
        import helpers
        assert helpers.REAL_BATCH_PUT([]) is True
        mock_table.batch_writer.assert_not_called()

    def test_rows_are_stamped_and_written_through_the_batch_writer(self, mock_table):
        writer = MagicMock()
        mock_table.batch_writer.return_value.__enter__.return_value = writer
        import helpers
        rows = [{'PK': 'A', 'SK': 'LOG#1', 'score': 1.5}, {'PK': 'A', 'SK': 'LOG#2', 'ts_insert': 5}]
        assert helpers.REAL_BATCH_PUT(rows) is True
        assert writer.put_item.call_count == 2
        first = writer.put_item.call_args_list[0][1]['Item']
        assert first['score'] == Decimal('1.5') and first['ts_insert'] > 0 and first['ts_update'] > 0
        assert writer.put_item.call_args_list[1][1]['Item']['ts_insert'] == 5

    def test_errors_return_false(self, mock_table):
        import helpers
        mock_table.batch_writer.side_effect = ClientError({'Error': {'Code': 'X'}}, 'Batch')
        assert helpers.REAL_BATCH_PUT([{'PK': 'A', 'SK': 'B'}]) is False
        mock_table.batch_writer.side_effect = RuntimeError('boom')
        assert helpers.REAL_BATCH_PUT([{'PK': 'A', 'SK': 'B'}]) is False


@patch.object(db, '_table')
class TestQueryGsiKeyMap:
    def test_gsi2_uses_its_own_attributes(self, mock_table):
        mock_table.query.return_value = {'Items': []}
        db.query_gsi('GSI2', 'MATCH', sk_prefix='0')
        kwargs = mock_table.query.call_args[1]
        assert kwargs['IndexName'] == 'GSI2'
        assert kwargs['KeyConditionExpression'] == 'GSI2_PK = :pk AND begins_with(GSI2_SK, :sk)'

    def test_unknown_index_falls_back_to_gsi1_attributes(self, mock_table):
        mock_table.query.return_value = {'Items': []}
        db.query_gsi('Whatever', 'X')
        assert mock_table.query.call_args[1]['KeyConditionExpression'] == 'GSI1_PK = :pk'


class TestCacheVersions:
    def test_get_defaults_when_the_item_is_missing(self):
        with patch.object(db, 'get_item', return_value=None) as get:
            assert db.get_cache_versions() == {'storyVersions': {}, 'globalVersion': 0}
        get.assert_called_once_with('SYSTEM#cache')

    def test_get_reads_the_stored_stamps(self):
        with patch.object(db, 'get_item', return_value={'storyVersions': {'s1': Decimal(5)},
                                                        'globalVersion': Decimal(9)}):
            out = db.get_cache_versions()
        assert out == {'storyVersions': {'s1': Decimal(5)}, 'globalVersion': 9}

    def test_bump_story_creates_the_item_and_stamps_the_story(self):
        saved = {}
        with patch.object(db, 'get_item', return_value=None), \
             patch.object(db, 'put_item', side_effect=lambda item: saved.update(item)):
            ts = db.bump_story_version('s1')
        assert saved['PK'] == 'SYSTEM#cache' and saved['SK'] == 'METADATA'
        assert saved['storyVersions'] == {'s1': ts} and ts > 0

    def test_bump_global_resets_the_per_story_stamps(self):
        saved = {}
        with patch.object(db, 'get_item', return_value={'PK': 'SYSTEM#cache', 'SK': 'METADATA',
                                                        'storyVersions': {'s1': 1}}), \
             patch.object(db, 'put_item', side_effect=lambda item: saved.update(item)):
            ts = db.bump_global_version()
        assert saved['globalVersion'] == ts and saved['storyVersions'] == {}


# ── v0.37.5 — story items travel gzipped ─────────────────────────────────────

def _story(**extra):
    return {'PK': 'STORY#s1', 'SK': 'METADATA', 'uuid': 's1', 'status': 'ACTIVE',
            'summary': {'meta': {'id': 1}}, 'raw_texts': [{'id': 1, 'lang': 'en', 'text': 'x' * 500}],
            'locations': [{'id': 1, 'weight': Decimal('1.5'), 'n': Decimal('7')}], **extra}


class TestStoryPacking:
    def test_pack_moves_nested_values_into_one_binary_attribute(self):
        packed = db._pack(db._to_dynamodb_value(_story()))
        assert set(packed) == {'PK', 'SK', 'uuid', 'status', 'summary', db.PACKED_ATTR}
        assert isinstance(packed[db.PACKED_ATTR], bytes)
        assert len(packed[db.PACKED_ATTR]) < 200  # 500 x's gzip to almost nothing

    def test_unpack_restores_the_item_with_decimals(self):
        item = _story()
        restored = db._unpack(db._pack(db._to_dynamodb_value(item)))
        assert db.PACKED_ATTR not in restored
        assert restored['raw_texts'] == item['raw_texts']
        assert restored['locations'][0]['weight'] == Decimal('1.5')
        assert restored['locations'][0]['n'] == 7
        assert restored['summary'] == {'meta': {'id': 1}}

    def test_unpack_accepts_the_boto3_binary_wrapper(self):
        from boto3.dynamodb.types import Binary
        packed = db._pack(db._to_dynamodb_value(_story()))
        packed[db.PACKED_ATTR] = Binary(packed[db.PACKED_ATTR])
        assert db._unpack(packed)['locations'][0]['id'] == 1

    def test_non_story_items_are_left_alone(self):
        match = {'PK': 'MATCH#m1', 'SK': 'METADATA', 'locations': [{'idLocation': 1}]}
        assert db._pack(dict(match)) == match
        char = {'PK': 'STORY#s1', 'SK': 'OTHER', 'rows': [1]}
        assert db._pack(dict(char)) == char
        assert db._unpack({'PK': 'X'}) == {'PK': 'X'}
        assert db._unpack(None) is None

    def test_story_without_nested_values_is_not_packed(self):
        flat = {'PK': 'STORY#s1', 'SK': 'METADATA', 'uuid': 's1'}
        assert db._pack(dict(flat)) == flat

    def test_json_default_handles_decimals_and_bytes(self):
        assert db._json_default(Decimal('2')) == 2
        assert db._json_default(Decimal('2.5')) == 2.5
        assert db._json_default(b'ab') == 'YWI='
        with pytest.raises(TypeError):
            db._json_default(object())

    @patch.object(db, '_table')
    def test_put_and_get_round_trip(self, mock_table):
        stored = {}
        mock_table.put_item.side_effect = lambda Item: stored.update(Item)
        mock_table.get_item.side_effect = lambda **_k: {'Item': dict(stored)}
        item = _story()
        assert db.put_item(dict(item)) is True
        assert db.PACKED_ATTR in stored and 'raw_texts' not in stored
        got = db.get_item('STORY#s1', consistent=False)
        assert got['raw_texts'] == item['raw_texts']
        assert got['summary'] == item['summary']

    @patch.object(db, '_table')
    def test_queries_unpack_every_row(self, mock_table):
        packed = db._pack(db._to_dynamodb_value(_story()))
        mock_table.query.return_value = {'Items': [dict(packed)], 'LastEvaluatedKey': None}
        assert db.query_by_pk('STORY#s1')[0]['locations'][0]['id'] == 1
        rows, _ = db.query_sk_prefix_page('STORY#s1', 'META', 5)
        assert rows[0]['raw_texts']
        rows, _ = db.query_index_page('GSI2', 'GSI2_PK', 'STORY_LIST')
        assert rows[0]['raw_texts']

    @patch.object(db, '_table')
    def test_batch_put_packs_stories_too(self, mock_table):
        import helpers
        writes = []
        batch = MagicMock()
        batch.put_item.side_effect = lambda Item: writes.append(Item)
        mock_table.batch_writer.return_value.__enter__.return_value = batch
        assert helpers.REAL_BATCH_PUT([_story(), {'PK': 'MATCH#1', 'SK': 'LOG#1', 'type': 'X'}]) is True
        assert db.PACKED_ATTR in writes[0] and db.PACKED_ATTR not in writes[1]
        assert mock_table.batch_writer.call_args.kwargs['overwrite_by_pkeys'] == ['PK', 'SK']


@patch.object(db, '_table')
class TestUpdateTsLastAccessSummary:
    def test_in_summary_stamps_the_projected_copy_too(self, mock_table):
        mock_table.update_item.return_value = {}
        assert db.update_ts_last_access('USER#g1', 5, in_summary=True) is True
        expr = mock_table.update_item.call_args.kwargs['UpdateExpression']
        assert expr == 'SET ts_last_access = :t, summary.ts_last_access = :t'
