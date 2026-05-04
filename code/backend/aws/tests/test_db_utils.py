"""
Unit tests for common/db_utils.py.
We patch `common.db_utils.table` (the module-level DynamoDB Table object)
so no real AWS calls are made.
"""
from decimal import Decimal
from unittest.mock import MagicMock, patch
import common.db_utils as db


@patch.object(db, 'table')
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


@patch.object(db, 'table')
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


@patch.object(db, 'table')
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


@patch.object(db, 'table')
class TestDeleteItem:
    def test_success(self, mock_table):
        mock_table.delete_item.return_value = {}
        assert db.delete_item('USER#1') is True
        mock_table.delete_item.assert_called_once_with(Key={'PK': 'USER#1', 'SK': 'METADATA'})

    def test_custom_sk(self, mock_table):
        mock_table.delete_item.return_value = {}
        db.delete_item('X', 'MY_SK')
        mock_table.delete_item.assert_called_once_with(Key={'PK': 'X', 'SK': 'MY_SK'})


@patch.object(db, 'table')
class TestQueryByPk:
    def test_returns_items(self, mock_table):
        mock_table.query.return_value = {'Items': [{'PK': 'X', 'SK': 'A'}]}
        assert len(db.query_by_pk('X')) == 1

    def test_empty(self, mock_table):
        mock_table.query.return_value = {'Items': []}
        assert db.query_by_pk('MISSING') == []


@patch.object(db, 'table')
class TestDeleteAllByPk:
    def test_deletes_all(self, mock_table):
        mock_table.query.return_value = {
            'Items': [{'PK': 'S#1', 'SK': 'METADATA'}, {'PK': 'S#1', 'SK': 'EXTRA'}]
        }
        mock_table.delete_item.return_value = {}
        count = db.delete_all_by_pk('S#1')
        assert count == 2
        assert mock_table.delete_item.call_count == 2


@patch.object(db, 'table')
class TestScanFilter:
    def test_returns_matching_items(self, mock_table):
        mock_table.scan.return_value = {'Items': [{'PK': 'USER#1', 'is_guest': True}]}
        result = db.scan_filter('is_guest', True)
        assert len(result) == 1


@patch.object(db, 'table')
class TestUpdateTsLastAccess:
    def test_success(self, mock_table):
        mock_table.update_item.return_value = {}
        assert db.update_ts_last_access('USER#1', 12345) is True
        kwargs = mock_table.update_item.call_args[1]
        assert kwargs['ExpressionAttributeValues'][':t'] == 12345
