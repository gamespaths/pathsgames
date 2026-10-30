# v1.8.0 — shared by aws_dynamodb_backup_stage.sh and aws_dynamodb_restore_stage.sh: tools, stage table, bucket.
# Sourced after PROJECT_ROOT, STAGE and SUFFIX are set and .env is loaded; sets the DB_* variables.

# AWS CLI retries throttled calls on its own: the public tables are PROVISIONED (10 RCU/WCU on alpha).
export AWS_RETRY_MODE="${AWS_RETRY_MODE:-adaptive}"
export AWS_MAX_ATTEMPTS="${AWS_MAX_ATTEMPTS:-10}"

# Reads one key of [<stage>.deploy.parameters] from samconfig.toml (plain sed: no python needed).
dynamo_backup_samconfig_get() {
	sed -n "/^\[$STAGE\.deploy\.parameters\]/,/^\[/{s/^$1 *= *\"\(.*\)\"/\1/p}" \
		"$PROJECT_ROOT/code/backend/aws/samconfig.toml" | head -n 1
}

dynamo_backup_init() {
	local tool
	for tool in aws jq gzip sha256sum; do
		if ! command -v "$tool" >/dev/null 2>&1; then
			echo "Error: '$tool' is required." >&2
			exit 1
		fi
	done
	case "$(aws --version 2>&1)" in
		aws-cli/2.*) ;;
		*) echo "Error: AWS CLI v2 is required (binary attributes travel as base64)." >&2; exit 1 ;;
	esac

	DB_REGION="$(dynamo_backup_samconfig_get region)"
	if [ -z "$DB_REGION" ]; then
		echo "Error: no [$STAGE.deploy.parameters] region in code/backend/aws/samconfig.toml." >&2
		exit 1
	fi
	# Same name as PathsGamesTable in template.yaml.
	DB_TABLE="PathsGamesBackend-$STAGE"
	local bucket_var="AWS_${SUFFIX}_S3_BUCKET_BACKUP"
	DB_BUCKET="${!bucket_var:-$(dynamo_backup_samconfig_get s3_bucket)}"
	if [ -z "$DB_BUCKET" ]; then
		echo "Error: no backup bucket: set $bucket_var in .env or s3_bucket in samconfig.toml [$STAGE]." >&2
		exit 1
	fi
	DB_PREFIX="$STAGE/backup"
}

# Checks the table is ACTIVE and sets DB_TABLE_ARN and DB_TABLE_VERSION (its `version` tag, empty when missing).
dynamo_backup_table_info() {
	local status
	if ! status="$(aws dynamodb describe-table --table-name "$DB_TABLE" --region "$DB_REGION" \
		--query 'Table.[TableStatus,TableArn]' --output text 2>&1)"; then
		echo "Error: table $DB_TABLE not found in $DB_REGION: $status" >&2
		exit 1
	fi
	DB_TABLE_ARN="$(printf '%s' "$status" | awk '{print $2}')"
	if [ "$(printf '%s' "$status" | awk '{print $1}')" != "ACTIVE" ]; then
		echo "Error: table $DB_TABLE is not ACTIVE ($status)." >&2
		exit 1
	fi
	DB_TABLE_VERSION="$(aws dynamodb list-tags-of-resource --resource-arn "$DB_TABLE_ARN" --region "$DB_REGION" \
		--query "Tags[?Key=='version'].Value | [0]" --output text 2>/dev/null || true)"
	[ "$DB_TABLE_VERSION" = "None" ] && DB_TABLE_VERSION=""
	return 0
}
