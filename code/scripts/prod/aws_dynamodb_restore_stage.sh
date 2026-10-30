#!/usr/bin/env bash
# v1.8.0 — writes back a raw backup of aws_dynamodb_backup_stage.sh into the stage table, as is (no schema upgrade).
# Usage: aws_dynamodb_restore_stage.sh <alpha|beta|prod> --list | --backup <YYYYMMDDTHHMMSSZ|latest> | --from-dir <dir> [--include P#,..] [--exclude P#,..] [--dry-run] [--yes]
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
	# shellcheck disable=SC1090
	. "$ENV_FILE"
fi

usage() { sed -n '2,3p' "$0" | sed 's/^# \{0,1\}//'; }

STAGE=""
LIST=false
BACKUP=""
FROM_DIR=""
INCLUDE=""
EXCLUDE=""
DRY_RUN=false
ASSUME_YES=false
while [ $# -gt 0 ]; do
	case "$1" in
		alpha|beta|prod) STAGE="$1" ;;
		--list) LIST=true ;;
		--backup) BACKUP="${2:-}"; shift ;;
		--from-dir) FROM_DIR="${2:-}"; shift ;;
		--include) INCLUDE="${2:-}"; shift ;;
		--exclude) EXCLUDE="${2:-}"; shift ;;
		--dry-run) DRY_RUN=true ;;
		--yes) ASSUME_YES=true ;;
		-h|--help) usage; exit 0 ;;
		*) echo "Error: unknown argument '$1'." >&2; usage >&2; exit 2 ;;
	esac
	shift
done
if [ -z "$STAGE" ]; then
	echo "Error: the stage is required (alpha, beta or prod)." >&2
	usage >&2
	exit 2
fi
if [ "$LIST" = false ] && [ -z "$BACKUP" ] && [ -z "$FROM_DIR" ]; then
	echo "Error: pass --list, --backup <timestamp|latest> or --from-dir <dir>." >&2
	usage >&2
	exit 2
fi
SUFFIX="$(printf '%s' "$STAGE" | tr '[:lower:]' '[:upper:]')"

# shellcheck source=../lib/dynamo_backup.sh
. "$PROJECT_ROOT/code/scripts/lib/dynamo_backup.sh"
dynamo_backup_init

# Backup folders of the stage, oldest first (only the complete ones: manifest.json is uploaded last).
list_backups() {
	aws s3 ls "s3://$DB_BUCKET/$DB_PREFIX/" --region "$DB_REGION" 2>/dev/null \
		| awk '$1 == "PRE" {sub("/$", "", $2); print $2}' | sort
}

if [ "$LIST" = true ]; then
	echo "Backups in s3://$DB_BUCKET/$DB_PREFIX/:"
	for _name in $(list_backups); do
		if _manifest="$(aws s3 cp "s3://$DB_BUCKET/$DB_PREFIX/$_name/manifest.json" - --region "$DB_REGION" 2>/dev/null)"; then
			printf '  %s  %s items, table version %s\n' "$_name" \
				"$(printf '%s' "$_manifest" | jq -r '.items')" "$(printf '%s' "$_manifest" | jq -r '.tableVersion // "?"')"
		else
			printf '  %s  INCOMPLETE (no manifest.json)\n' "$_name"
		fi
	done
	exit 0
fi

dynamo_backup_table_info

umask 077
_WORK="$(mktemp -d)"
trap 'rm -rf "$_WORK"' EXIT

if [ -n "$FROM_DIR" ]; then
	_SOURCE="$FROM_DIR"
	cp "$FROM_DIR/manifest.json" "$FROM_DIR/items.jsonl.gz" "$_WORK/"
else
	if [ "$BACKUP" = "latest" ]; then
		BACKUP="$(list_backups | tail -n 1)"
		if [ -z "$BACKUP" ]; then
			echo "Error: no backup in s3://$DB_BUCKET/$DB_PREFIX/." >&2
			exit 1
		fi
	fi
	_SOURCE="s3://$DB_BUCKET/$DB_PREFIX/$BACKUP"
	for _file in manifest.json items.jsonl.gz; do
		if ! aws s3 cp "$_SOURCE/$_file" "$_WORK/$_file" --region "$DB_REGION" --only-show-errors; then
			echo "Error: cannot download $_SOURCE/$_file (see --list)." >&2
			exit 1
		fi
	done
fi

# Integrity and target checks: the right file, taken from this stage's table.
_SHA="$(sha256sum "$_WORK/items.jsonl.gz" | awk '{print $1}')"
if [ "$_SHA" != "$(jq -r '.itemsSha256' "$_WORK/manifest.json")" ]; then
	echo "Error: items.jsonl.gz does not match the sha256 of its manifest (corrupted or partial download)." >&2
	exit 1
fi
_BACKUP_TABLE="$(jq -r '.table' "$_WORK/manifest.json")"
if [ "$_BACKUP_TABLE" != "$DB_TABLE" ]; then
	echo "Error: the backup comes from $_BACKUP_TABLE, not from $DB_TABLE." >&2
	exit 1
fi
_BACKUP_VERSION="$(jq -r '.tableVersion // ""' "$_WORK/manifest.json")"

# Comma list of PK prefixes as a JSON array ("" = none).
prefixes_json() { jq -n -c --arg s "$1" '$s | split(",") | map(gsub("^ +| +$"; "")) | map(select(length > 0))'; }

gzip -dc "$_WORK/items.jsonl.gz" > "$_WORK/all.jsonl"
jq -c --argjson inc "$(prefixes_json "$INCLUDE")" --argjson exc "$(prefixes_json "$EXCLUDE")" '
	.PK.S as $pk
	| select(($inc | length) == 0 or any($inc[]; . as $p | $pk | startswith($p)))
	| select(all($exc[]; . as $p | $pk | startswith($p) | not))' "$_WORK/all.jsonl" > "$_WORK/prefixed.jsonl"
# DynamoDB deletes expired rows (ttl in epoch seconds) anyway: they are not written back.
jq -c --argjson now "$(date +%s)" 'select((.ttl.N // null) == null or (.ttl.N | tonumber) > $now)' \
	"$_WORK/prefixed.jsonl" > "$_WORK/selected.jsonl"

_TOTAL="$(wc -l < "$_WORK/all.jsonl" | tr -d ' ')"
_PREFIXED="$(wc -l < "$_WORK/prefixed.jsonl" | tr -d ' ')"
_SELECTED="$(wc -l < "$_WORK/selected.jsonl" | tr -d ' ')"

echo "Restore plan"
echo "  source:  $_SOURCE/ ($(jq -r '.createdAt' "$_WORK/manifest.json"), table version ${_BACKUP_VERSION:-?})"
echo "  target:  $DB_TABLE ($DB_REGION, table version ${DB_TABLE_VERSION:-?})"
echo "  include: ${INCLUDE:-all}    exclude: ${EXCLUDE:-none}"
echo "  items:   $_TOTAL in the backup, $((_TOTAL - _PREFIXED)) left out by prefix, $((_PREFIXED - _SELECTED)) expired (ttl), $_SELECTED to write"
echo "  per PK prefix:"
jq -r '.PK.S | split("#")[0] + "#"' "$_WORK/selected.jsonl" | sort | uniq -c | sed 's/^/    /'

# Same major.minor = same row layout; otherwise the rows may lack fields the code needs (see code/scripts/alpha/README.md).
if [ "${_BACKUP_VERSION%.*}" != "${DB_TABLE_VERSION%.*}" ]; then
	echo ""
	echo "  WARNING: backup version ${_BACKUP_VERSION:-?} != table version ${DB_TABLE_VERSION:-?}: the rows are written AS IS, with no upgrade;"
	echo "           rows of an older layout can break lists, sessions and matches. Prefer --include with content prefixes."
fi

if [ "$DRY_RUN" = true ]; then
	echo "Dry run: nothing written."
	exit 0
fi
if [ "$_SELECTED" -eq 0 ]; then
	echo "Nothing to write."
	exit 0
fi
if [ "$ASSUME_YES" = false ]; then
	echo ""
	echo "Rows with the same PK/SK already in $DB_TABLE are OVERWRITTEN."
	read -r -p "Type the table name ($DB_TABLE) to confirm: " _answer
	if [ "$_answer" != "$DB_TABLE" ]; then
		echo "Aborted: nothing written."
		exit 1
	fi
fi

# BatchWriteItem takes 25 puts per call; UnprocessedItems (throttling) are retried with backoff.
split -l 25 -d -a 6 "$_WORK/selected.jsonl" "$_WORK/chunk_"
_WRITTEN=0
for _chunk in "$_WORK"/chunk_*; do
	jq -s -c --arg t "$DB_TABLE" '{($t): map({PutRequest: {Item: .}})}' "$_chunk" > "$_WORK/request.json"
	_attempt=0
	while :; do
		_attempt=$((_attempt + 1))
		# Binary values (story _gz) are base64 in the scan output: read them back as base64 whatever ~/.aws/config says.
		if _out="$(aws dynamodb batch-write-item --request-items "file://$_WORK/request.json" \
			--cli-binary-format base64 --region "$DB_REGION" --output json 2>&1)"; then
			if [ "$(printf '%s' "$_out" | jq '.UnprocessedItems | length')" -eq 0 ]; then
				break
			fi
			printf '%s' "$_out" | jq -c '.UnprocessedItems' > "$_WORK/request.json"
		else
			echo "  batch-write-item failed (attempt $_attempt): $_out" >&2
		fi
		if [ "$_attempt" -ge 10 ]; then
			echo "Error: chunk $(basename "$_chunk") still not written after 10 attempts ($_WRITTEN of $_SELECTED items done)." >&2
			echo "       Puts are idempotent: run the same command again to finish." >&2
			exit 1
		fi
		sleep $(( _attempt < 6 ? 1 << _attempt : 32 ))
	done
	_WRITTEN=$((_WRITTEN + $(wc -l < "$_chunk")))
	printf '\r  written %s / %s' "$_WRITTEN" "$_SELECTED"
done
echo ""
echo "Restore done: $_WRITTEN items written into $DB_TABLE."
echo "Next: POST /api/admin/cache/flush, so warm Lambdas reload the restored stories."
