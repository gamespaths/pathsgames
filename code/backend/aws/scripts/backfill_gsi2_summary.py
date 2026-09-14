#!/usr/bin/env python3
"""One-time migration (v0.37.5): put every story and guest on the GSI2Summary index.

    python scripts/backfill_gsi2_summary.py --env dev --region us-east-2 --dry-run
    python scripts/backfill_gsi2_summary.py --table PathsGamesBackend-prod --region us-east-2

Story listing and guest resume moved from GSI1 (ProjectionType ALL, every read carried
whole 300 KB stories) to GSI2Summary (INCLUDE). Stories and guests written BEFORE the
deploy carry no GSI2 keys, so they are missing from the new index: run this once per
environment AFTER deploying the template that adds GSI2Summary and BEFORE the one that
removes GSI1. Idempotent: rows already carrying GSI2_PK are skipped.
"""
import argparse
import os
import sys

# Make the sibling lambda/ package importable so we reuse the exact key format.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lambda'))


def main(argv=None):
    parser = argparse.ArgumentParser(description="Backfill GSI2Summary keys on stories and guests (v0.37.5).")
    parser.add_argument('--env', help="Environment suffix; builds table name PathsGamesBackend-<env>.")
    parser.add_argument('--table', help="Explicit DynamoDB table name (overrides --env).")
    parser.add_argument('--region', help="AWS region (else AWS_DEFAULT_REGION / profile default).")
    parser.add_argument('--dry-run', action='store_true', help="Scan and report, but write nothing.")
    args = parser.parse_args(argv)

    table_name = args.table or (f"PathsGamesBackend-{args.env}" if args.env else None)
    if not table_name:
        parser.error("provide --table or --env")
    os.environ['TABLE_NAME'] = table_name
    if args.region:
        os.environ['AWS_DEFAULT_REGION'] = args.region

    from botocore.exceptions import ClientError
    from common import db_utils  # imported after env is set so the table binds correctly

    print(f"Backfilling GSI2Summary keys on table '{table_name}'"
          + (" (dry-run)" if args.dry_run else "") + " …")
    try:
        stats = db_utils.backfill_gsi2_summary(dry_run=args.dry_run)
    except ClientError as exc:
        if exc.response.get('Error', {}).get('Code') == 'ResourceNotFoundException':
            return _report_table_not_found(table_name, args.region)
        raise
    verb = 'would update' if args.dry_run else 'updated'
    print(f"  stories {verb:13}: {stats['stories']}")
    print(f"  guests  {verb:13}: {stats['guests']}")
    print(f"  already indexed (skipped)  : {stats['skipped']}")
    return 0


def _report_table_not_found(table_name, region):
    """ResourceNotFound usually means a wrong table name (or wrong account/region).
    List the DynamoDB tables actually visible so the caller can pass --table."""
    import boto3
    print(f"\n[!] Table '{table_name}' was not found in this account/region.")
    region = region or os.environ.get('AWS_DEFAULT_REGION', 'us-east-2')
    try:
        client = boto3.client('dynamodb', region_name=region)
        names = client.list_tables().get('TableNames', [])
        ident = boto3.client('sts', region_name=region).get_caller_identity()
        print(f"    account={ident.get('Account')}  region={region}")
        if names:
            print("    DynamoDB tables here:")
            for n in names:
                print(f"      - {n}")
            print("\n    Re-run with the right one, e.g.:")
            print(f"      python scripts/backfill_gsi2_summary.py --table {names[0]} --region {region}")
        else:
            print("    (no DynamoDB tables in this account/region — check your AWS profile/region)")
    except Exception as exc:  # noqa: BLE001 — diagnostics only
        print(f"    Could not list tables ({exc}). Check AWS credentials/region.")
    return 2


if __name__ == '__main__':
    raise SystemExit(main())
