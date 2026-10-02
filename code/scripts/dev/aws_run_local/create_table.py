#!/usr/bin/env python3
"""create_table.py - v0.41.4 creates the single table on DynamoDB Local from the PathsGamesTable
resource of code/backend/aws/template.yaml (keys, GSIs, TTL), so the local table follows the deploy."""
import argparse
import sys
import time
from pathlib import Path

import boto3
import yaml

TEMPLATE = Path(__file__).resolve().parents[3] / "backend" / "aws" / "template.yaml"


class _CfnLoader(yaml.SafeLoader):
    """A YAML loader that reads CloudFormation short tags (!Ref, !Sub, ...) as plain values."""


def _any_tag(loader, _suffix, node):
    if isinstance(node, yaml.ScalarNode):
        return loader.construct_scalar(node)
    if isinstance(node, yaml.SequenceNode):
        return loader.construct_sequence(node)
    return loader.construct_mapping(node)


_CfnLoader.add_multi_constructor("!", _any_tag)


def table_definition(template_path, table_name):
    """The create_table kwargs of PathsGamesTable, on-demand, without tags and provisioned throughput."""
    template = yaml.load(Path(template_path).read_text(encoding="utf-8"), Loader=_CfnLoader)
    props = template["Resources"]["PathsGamesTable"]["Properties"]
    gsis = []
    for gsi in props.get("GlobalSecondaryIndexes") or []:
        gsis.append({"IndexName": gsi["IndexName"], "KeySchema": gsi["KeySchema"], "Projection": gsi["Projection"]})
    return {
        "TableName": table_name,
        "AttributeDefinitions": props["AttributeDefinitions"],
        "KeySchema": props["KeySchema"],
        "BillingMode": "PAY_PER_REQUEST",
        "GlobalSecondaryIndexes": gsis,
    }, props.get("TimeToLiveSpecification")


def main():
    parser = argparse.ArgumentParser(description="Create the Paths Games table on DynamoDB Local.")
    parser.add_argument("--endpoint", default="http://localhost:8000")
    parser.add_argument("--table", default="PathsGamesBackend-dev")
    parser.add_argument("--template", default=str(TEMPLATE))
    args = parser.parse_args()

    client = boto3.client("dynamodb", endpoint_url=args.endpoint, region_name="us-east-1",
                          aws_access_key_id="local", aws_secret_access_key="local")
    for _ in range(30):
        try:
            existing = client.list_tables()["TableNames"]
            break
        except Exception:  # noqa: BLE001 - DynamoDB Local still starting
            time.sleep(1)
    else:
        print(f"DynamoDB Local not reachable at {args.endpoint}", file=sys.stderr)
        return 1
    if args.table in existing:
        print(f"Table {args.table} already exists")
        return 0
    definition, ttl = table_definition(args.template, args.table)
    client.create_table(**definition)
    client.get_waiter("table_exists").wait(TableName=args.table)
    if ttl:
        client.update_time_to_live(TableName=args.table, TimeToLiveSpecification={
            "AttributeName": ttl["AttributeName"], "Enabled": bool(ttl.get("Enabled", True))})
    print(f"Table {args.table} created ({len(definition['GlobalSecondaryIndexes'])} GSI)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
