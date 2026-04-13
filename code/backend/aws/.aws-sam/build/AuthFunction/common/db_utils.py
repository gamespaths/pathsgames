import boto3
import os
import time
from boto3.dynamodb.conditions import Attr
from botocore.exceptions import ClientError

TABLE_NAME = os.environ.get('TABLE_NAME', 'PathsGamesBackend')
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(TABLE_NAME)

def get_item(pk, sk='METADATA'):
    """Fetch a single item from DynamoDB."""
    try:
        response = table.get_item(Key={'PK': pk, 'SK': sk})
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
        table.put_item(Item=item)
        return True
    except ClientError as e:
        print(f"Error putting item: {e}")
        return False

def delete_item(pk, sk='METADATA'):
    """Delete a single item from DynamoDB."""
    try:
        table.delete_item(Key={'PK': pk, 'SK': sk})
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

def query_by_pk(pk):
    """Query all items with the same Partition Key."""
    try:
        response = table.query(
            KeyConditionExpression='PK = :pk',
            ExpressionAttributeValues={':pk': pk}
        )
        return response.get('Items', [])
    except ClientError as e:
        print(f"Error querying PK {pk}: {e}")
        return []

def query_gsi(gsi_name, pk_val, sk_prefix=None):
    """Query a secondary index."""
    try:
        condition  = 'GSI1_PK = :pk'
        attr_vals  = {':pk': pk_val}
        if sk_prefix:
            condition += ' AND begins_with(GSI1_SK, :sk)'
            attr_vals[':sk'] = sk_prefix
        response = table.query(
            IndexName=gsi_name,
            KeyConditionExpression=condition,
            ExpressionAttributeValues=attr_vals
        )
        return response.get('Items', [])
    except ClientError as e:
        print(f"Error querying GSI {gsi_name}: {e}")
        return []

def scan_filter(attr_name, attr_value):
    """Scan the table filtering on a single attribute value."""
    try:
        response = table.scan(FilterExpression=Attr(attr_name).eq(attr_value))
        return response.get('Items', [])
    except ClientError as e:
        print(f"Error scanning filter {attr_name}={attr_value}: {e}")
        return []

def update_ts_last_access(pk, now_ms, sk='METADATA'):
    """Update the ts_last_access timestamp of an item."""
    try:
        table.update_item(
            Key={'PK': pk, 'SK': sk},
            UpdateExpression='SET ts_last_access = :t',
            ExpressionAttributeValues={':t': now_ms}
        )
        return True
    except ClientError as e:
        print(f"Error updating ts_last_access for {pk}: {e}")
        return False
