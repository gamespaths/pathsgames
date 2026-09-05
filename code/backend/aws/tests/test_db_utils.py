"""
Unit tests for common/db_utils.py.
We patch `common.db_utils._table` (the lazy-initialized DynamoDB Table object)
so no real AWS calls are made and boto3 is never contacted at import time.
"""
from decimal import Decimal
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
        mock_table.get_item.assert_called_once_with(Key={'PK': 'USER#1', 'SK': 'METADATA'})

    def test_miss(self, mock_table):
        mock_table.get_item.return_value = {}
        assert db.get_item('USER#missing') is None

    def test_custom_sk(self, mock_table):
        mock_table.get_item.return_value = {}
        db.get_item('X', sk='CUSTOM')
        mock_table.get_item.assert_called_once_with(Key={'PK': 'X', 'SK': 'CUSTOM'})


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


@patch.object(db, '_table')
class TestScanFilter:
    def test_returns_matching_items(self, mock_table):
        mock_table.scan.return_value = {'Items': [{'PK': 'USER#1', 'is_guest': True}]}
        result = db.scan_filter('is_guest', True)
        assert len(result) == 1


@patch.object(db, '_table')
class TestUpdateTsLastAccess:
    def test_success(self, mock_table):
        mock_table.update_item.return_value = {}
        assert db.update_ts_last_access('USER#1', 12345) is True
        kwargs = mock_table.update_item.call_args[1]
        assert kwargs['ExpressionAttributeValues'][':t'] == 12345


class TestGetTable:
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

    def test_scan_filter_client_error_returns_empty(self, mock_table):
        mock_table.scan.side_effect = ClientError(
            {'Error': {'Code': 'InternalServerError', 'Message': 'boom'}},
            'Scan'
        )
        assert db.scan_filter('is_guest', True) == []

    def test_update_ts_last_access_client_error_returns_false(self, mock_table):
        mock_table.update_item.side_effect = ClientError(
            {'Error': {'Code': 'InternalServerError', 'Message': 'boom'}},
            'UpdateItem'
        )
        assert db.update_ts_last_access('USER#1', 12345) is False


@patch.object(db, '_table')
class TestPagination:
    """scan/query helpers must follow LastEvaluatedKey so large tables are fully read."""

    def test_scan_pk_prefix_follows_last_evaluated_key(self, mock_table):
        mock_table.scan.side_effect = [
            {'Items': [{'PK': 'MATCH#1'}], 'LastEvaluatedKey': {'PK': 'MATCH#1'}},
            {'Items': [{'PK': 'MATCH#2'}]},
        ]
        result = db.scan_pk_prefix('MATCH#')
        assert [i['PK'] for i in result] == ['MATCH#1', 'MATCH#2']
        assert mock_table.scan.call_count == 2
        assert mock_table.scan.call_args_list[1].kwargs['ExclusiveStartKey'] == {'PK': 'MATCH#1'}

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


@patch.object(db, '_table')
class TestBackfillGsi2Matches:
    """v0.28.1 migration — add GSI2 keys to matches that predate the index."""

    def test_backfills_only_rows_missing_keys(self, mock_table):
        mock_table.scan.return_value = {'Items': [
            {'PK': 'MATCH#m1', 'SK': 'METADATA', 'uuid': 'm1', 'tsInsert': 100},
            {'PK': 'MATCH#m2', 'SK': 'METADATA', 'uuid': 'm2', 'tsInsert': 200,
             'GSI2_PK': 'MATCH', 'GSI2_SK': '00000000000000000200#m2'},
        ]}
        stats = db.backfill_gsi2_matches()
        assert stats == {'scanned': 2, 'updated': 1, 'skipped': 1}
        # only m1 is written, with the same SK format as _create_match
        mock_table.update_item.assert_called_once()
        kwargs = mock_table.update_item.call_args.kwargs
        assert kwargs['Key'] == {'PK': 'MATCH#m1', 'SK': 'METADATA'}
        assert kwargs['ExpressionAttributeValues'][':p'] == 'MATCH'
        assert kwargs['ExpressionAttributeValues'][':s'] == '00000000000000000100#m1'

    def test_dry_run_writes_nothing(self, mock_table):
        mock_table.scan.return_value = {'Items': [
            {'PK': 'MATCH#m1', 'SK': 'METADATA', 'uuid': 'm1', 'tsInsert': 100},
        ]}
        stats = db.backfill_gsi2_matches(dry_run=True)
        assert stats == {'scanned': 1, 'updated': 1, 'skipped': 0}
        mock_table.update_item.assert_not_called()

    def test_follows_last_evaluated_key(self, mock_table):
        mock_table.scan.side_effect = [
            {'Items': [{'PK': 'MATCH#m1', 'SK': 'METADATA', 'uuid': 'm1', 'tsInsert': 1}],
             'LastEvaluatedKey': {'PK': 'MATCH#m1'}},
            {'Items': [{'PK': 'MATCH#m2', 'SK': 'METADATA', 'uuid': 'm2', 'tsInsert': 2}]},
        ]
        stats = db.backfill_gsi2_matches()
        assert stats['updated'] == 2
        assert mock_table.scan.call_count == 2

    def test_derives_uuid_from_pk_and_defaults_missing_ts(self, mock_table):
        # No 'uuid'/'tsInsert' attributes → derive uuid from PK, ts → 0.
        mock_table.scan.return_value = {'Items': [{'PK': 'MATCH#abc', 'SK': 'METADATA'}]}
        db.backfill_gsi2_matches()
        kwargs = mock_table.update_item.call_args.kwargs
        assert kwargs['ExpressionAttributeValues'][':s'] == '00000000000000000000#abc'


class TestCursorCodec:
    """Opaque base64 cursor round-trips a DynamoDB LastEvaluatedKey."""

    def test_round_trip(self):
        key = {'PK': 'MATCH#m1', 'SK': 'METADATA', 'GSI2_SK': '00000000000000000100#m1'}
        token = db.encode_cursor(key)
        assert isinstance(token, str)
        assert db.decode_cursor(token) == key

    def test_encode_none_or_empty_is_none(self):
        assert db.encode_cursor(None) is None
        assert db.encode_cursor({}) is None

    def test_decode_none_or_blank_is_none(self):
        assert db.decode_cursor(None) is None
        assert db.decode_cursor('') is None

    def test_decode_malformed_token_is_none(self):
        assert db.decode_cursor('!!!not-base64!!!') is None
        assert db.decode_cursor('bm90LWpzb24=') is None  # base64 of "not-json"


@patch.object(db, '_table')
class TestScanFilterPage:
    def test_returns_the_page_and_its_key(self, mock_table):
        mock_table.scan.return_value = {'Items': [{'PK': 'USER#1'}], 'LastEvaluatedKey': {'PK': 'USER#1'}}
        items, key = db.scan_filter_page('type', 'USER')
        assert items == [{'PK': 'USER#1'}]
        assert key == {'PK': 'USER#1'}
        assert 'Limit' not in mock_table.scan.call_args.kwargs
        assert 'ExclusiveStartKey' not in mock_table.scan.call_args.kwargs

    def test_an_empty_page_is_not_the_end(self, mock_table):
        mock_table.scan.return_value = {'Items': [], 'LastEvaluatedKey': {'PK': 'USER#9'}}
        assert db.scan_filter_page('type', 'USER') == ([], {'PK': 'USER#9'})

    def test_the_last_page_has_no_key(self, mock_table):
        mock_table.scan.return_value = {'Items': [{'PK': 'USER#1'}]}
        assert db.scan_filter_page('type', 'USER') == ([{'PK': 'USER#1'}], None)

    def test_limit_start_key_and_extra_filter_are_forwarded(self, mock_table):
        from boto3.dynamodb.conditions import Attr
        mock_table.scan.return_value = {'Items': []}
        db.scan_filter_page('type', 'USER', limit='25', start_key={'PK': 'USER#1'},
                            extra_filter=Attr('role').eq('GUEST'))
        kwargs = mock_table.scan.call_args.kwargs
        assert kwargs['Limit'] == 25
        assert kwargs['ExclusiveStartKey'] == {'PK': 'USER#1'}

    def test_a_client_error_yields_an_empty_last_page(self, mock_table):
        mock_table.scan.side_effect = ClientError({'Error': {'Code': 'X'}}, 'Scan')
        assert db.scan_filter_page('type', 'USER') == ([], None)


@patch.object(db, '_table')
class TestScanPkPrefix:
    def test_returns_every_matching_item(self, mock_table):
        mock_table.scan.return_value = {'Items': [{'PK': 'MATCH#1'}]}
        assert db.scan_pk_prefix('MATCH#') == [{'PK': 'MATCH#1'}]

    def test_a_client_error_yields_nothing(self, mock_table):
        mock_table.scan.side_effect = ClientError({'Error': {'Code': 'X'}}, 'Scan')
        assert db.scan_pk_prefix('MATCH#') == []
