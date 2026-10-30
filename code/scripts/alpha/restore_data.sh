#!/usr/bin/env bash
# v1.8.0 — writes an alpha backup back into PathsGamesBackend-alpha, as is, through the shared stage script.
# Usage: restore_data.sh --list | --backup <YYYYMMDDTHHMMSSZ|latest> [--include P#,..] [--exclude P#,..] [--dry-run] [--yes]
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
case "${1:-}" in
	-h|--help) sed -n '2,3p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
esac
exec "$DIR/../prod/aws_dynamodb_restore_stage.sh" alpha "$@"
