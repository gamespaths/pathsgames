#!/usr/bin/env bash
# v1.8.0 — raw backup of the alpha DynamoDB table (PathsGamesBackend-alpha, us-east-1) to S3, through the shared stage script.
# Usage: backup_data.sh [--no-local]; bucket AWS_ALPHA_S3_BUCKET_BACKUP from .env, else pathsgames-production-iac (alpha/backup/).
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
case "${1:-}" in
	-h|--help) sed -n '2,3p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
esac
exec "$DIR/../prod/aws_dynamodb_backup_stage.sh" alpha "$@"
