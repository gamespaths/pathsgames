#!/usr/bin/env bash
# v1.8.0 — full raw backup of a stage DynamoDB table (every item, DynamoDB JSON Lines gzip) to S3, plus a local copy.
# Usage: aws_dynamodb_backup_stage.sh <alpha|beta|prod> [--no-local]; bucket AWS_<STAGE>_S3_BUCKET_BACKUP, else samconfig s3_bucket.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
	# shellcheck disable=SC1090
	. "$ENV_FILE"
fi

usage() { sed -n '2,3p' "$0" | sed 's/^# \{0,1\}//'; }

STAGE=""
KEEP_LOCAL=true
for _arg in "$@"; do
	case "$_arg" in
		alpha|beta|prod) STAGE="$_arg" ;;
		--no-local) KEEP_LOCAL=false ;;
		-h|--help) usage; exit 0 ;;
		*) echo "Error: unknown argument '$_arg'." >&2; usage >&2; exit 2 ;;
	esac
done
if [ -z "$STAGE" ]; then
	echo "Error: the stage is required (alpha, beta or prod)." >&2
	usage >&2
	exit 2
fi
SUFFIX="$(printf '%s' "$STAGE" | tr '[:lower:]' '[:upper:]')"

# shellcheck source=../lib/dynamo_backup.sh
. "$PROJECT_ROOT/code/scripts/lib/dynamo_backup.sh"
dynamo_backup_init
dynamo_backup_table_info

_TS="$(date -u +%Y%m%dT%H%M%SZ)"
_DEST="s3://$DB_BUCKET/$DB_PREFIX/$_TS"
# The items hold personal data (emails, nicknames): the local copy is readable by its owner only.
umask 077
_LOCAL_DIR="${PATHS_GAMES_BACKUP_DIR:-$HOME/.paths.games/backups}/$STAGE/$_TS"
mkdir -p "$_LOCAL_DIR"

echo "Backing up table $DB_TABLE ($DB_REGION, version tag '${DB_TABLE_VERSION:-none}') to $_DEST/"
echo "Scanning (strongly consistent, 100 items per page)..."
aws dynamodb scan --table-name "$DB_TABLE" --region "$DB_REGION" \
	--consistent-read --page-size 100 --output json > "$_LOCAL_DIR/scan.json"

_COUNT="$(jq '.Count' "$_LOCAL_DIR/scan.json")"
jq -c '.Items[]' "$_LOCAL_DIR/scan.json" | gzip -9 > "$_LOCAL_DIR/items.jsonl.gz"
rm -f "$_LOCAL_DIR/scan.json"
_LINES="$(gzip -dc "$_LOCAL_DIR/items.jsonl.gz" | wc -l | tr -d ' ')"
if [ "$_LINES" != "$_COUNT" ]; then
	echo "Error: the scan answered Count=$_COUNT but $_LINES items were written; backup left in $_LOCAL_DIR, not uploaded." >&2
	exit 1
fi

# Key schema, GSIs and capacities of the source table, for reference at restore time.
aws dynamodb describe-table --table-name "$DB_TABLE" --region "$DB_REGION" --output json > "$_LOCAL_DIR/table.json"

_SHA="$(sha256sum "$_LOCAL_DIR/items.jsonl.gz" | awk '{print $1}')"
jq -n --arg stage "$STAGE" --arg table "$DB_TABLE" --arg region "$DB_REGION" --arg version "$DB_TABLE_VERSION" \
	--arg createdAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg sha "$_SHA" --argjson items "$_COUNT" \
	'{format: "pathsgames-dynamodb-backup/1", stage: $stage, table: $table, region: $region,
	  tableVersion: $version, createdAt: $createdAt, items: $items, itemsSha256: $sha,
	  files: ["items.jsonl.gz", "table.json"]}' > "$_LOCAL_DIR/manifest.json"

# The manifest goes last: a backup without manifest.json is an interrupted upload.
for _file in items.jsonl.gz table.json manifest.json; do
	aws s3 cp "$_LOCAL_DIR/$_file" "$_DEST/$_file" --region "$DB_REGION" --sse AES256 --only-show-errors
done

echo "Backup done: $_COUNT items, sha256 $_SHA"
echo "  S3:    $_DEST/"
if [ "$KEEP_LOCAL" = true ]; then
	echo "  local: $_LOCAL_DIR"
else
	rm -rf "$_LOCAL_DIR"
fi
echo "Restore with: aws_dynamodb_restore_stage.sh $STAGE --backup $_TS"
