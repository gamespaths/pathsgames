#!/usr/bin/env python3
"""create_bucket.py - v0.41.4 creates the website bucket on the local S3 (moto server), where the
admin story catalog export (POST /api/admin/stories/catalog) writes data/stories-{lang}.json."""
import argparse
import sys
import time

import boto3


def main():
    parser = argparse.ArgumentParser(description="Create the website bucket on the local S3.")
    parser.add_argument("--endpoint", default="http://localhost:9000")
    parser.add_argument("--bucket", default="pathsgames-website-local")
    args = parser.parse_args()
    s3 = boto3.client("s3", endpoint_url=args.endpoint, region_name="us-east-1",
                      aws_access_key_id="local", aws_secret_access_key="local")
    for _ in range(30):
        try:
            names = [b["Name"] for b in s3.list_buckets().get("Buckets", [])]
            break
        except Exception:  # noqa: BLE001 - the S3 server is still starting
            time.sleep(1)
    else:
        print(f"Local S3 not reachable at {args.endpoint}", file=sys.stderr)
        return 1
    if args.bucket not in names:
        s3.create_bucket(Bucket=args.bucket)
    print(f"Bucket {args.bucket} ready")
    return 0


if __name__ == "__main__":
    sys.exit(main())
