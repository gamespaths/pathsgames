#!/usr/bin/env bash
# v0.41.0 — deploys the AWS backend of a public stage: samconfig.toml overrides + .env stage keys, all passed explicitly.
# Usage: aws_backend_deploy_stage.sh <alpha|beta|prod> [--auto-confirm]; stage keys = AWS_<ALPHA|BETA|PROD>_<SERVICE>_<KEY> in .env.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
	# shellcheck disable=SC1090
	. "$ENV_FILE"
fi
AWS_DIR="$PROJECT_ROOT/code/backend/aws"
SAMCONFIG="$AWS_DIR/samconfig.toml"

usage() { sed -n '2,3p' "$0" | sed 's/^# \{0,1\}//'; }

STAGE=""
CONFIRM="--confirm-changeset"
for _arg in "$@"; do
	case "$_arg" in
		alpha|beta|prod) STAGE="$_arg" ;;
		--auto-confirm) CONFIRM="--no-confirm-changeset" ;;
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
# v0.42.0 — in CI (GitHub Actions sets CI=true): no prompt, and AdminIpWhitelist keeps its previous stack value.
IN_CI=false
if [ "${CI:-}" = "true" ]; then
	IN_CI=true
	CONFIRM="--no-confirm-changeset"
fi

# Value of the stage key AWS_<SUFFIX>_<name>, empty when unset.
stage_key() {
	local var="AWS_${SUFFIX}_${1}"
	printf '%s' "${!var:-}"
}

# One JWT secret per stage (decision 23): never missing, never a committed default.
_JWT="$(stage_key LAMBDA_JWT_SECRET)"
case "$_JWT" in
	""|"PathsGamesDevSecret2026_MustBeAtLeast32Chars!"|"0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF")
		echo "Error: AWS_${SUFFIX}_LAMBDA_JWT_SECRET is missing or a committed default; set its own value in .env (openssl rand -base64 48)." >&2
		exit 1
		;;
esac
if [ "$_JWT" = "${JWT_SECRET:-}" ]; then
	echo "  WARNING: AWS_${SUFFIX}_LAMBDA_JWT_SECRET equals the test JWT_SECRET — give every stage its own secret." >&2
fi

if [ ! -f "$SAMCONFIG" ]; then
	echo "Error: $SAMCONFIG not found (it is versioned in the repository: restore it with its [$STAGE.deploy.parameters] section)." >&2
	exit 1
fi
if ! python3 -c 'import tomllib' 2>/dev/null; then
	echo "Error: python3 >= 3.11 is required (tomllib)." >&2
	exit 1
fi

# Reads one key of [<stage>.deploy.parameters] from samconfig.toml.
samconfig_get() {
	python3 - "$SAMCONFIG" "$STAGE" "$1" <<'PY'
import sys, tomllib
with open(sys.argv[1], "rb") as fh:
    section = tomllib.load(fh).get(sys.argv[2], {}).get("deploy", {}).get("parameters", {})
print(section.get(sys.argv[3], ""))
PY
}

_STACK_NAME="$(samconfig_get stack_name)"
if [ -z "$_STACK_NAME" ]; then
	echo "Error: no [$STAGE.deploy.parameters] stack_name in $SAMCONFIG." >&2
	exit 1
fi

# Version tag: VERSION from .env, else the Java parent pom (the bump script's source of truth).
_VERSION="${VERSION:-}"
if [ -z "$_VERSION" ]; then
	_VERSION="$(grep -m1 '<version>' "$PROJECT_ROOT/code/backend/java/pom.xml" 2>/dev/null | sed 's|.*<version>\(.*\)-SNAPSHOT</version>.*|\1|' || true)"
fi
if [ -z "$_VERSION" ]; then
	echo "Error: VERSION not set in .env and no version found in code/backend/java/pom.xml." >&2
	exit 1
fi

# Explicit stack tags, as the template expects them (prod is tagged production).
_ENV_TAG="$STAGE"
if [ "$STAGE" = "prod" ]; then _ENV_TAG="production"; fi
_STACK_TAGS="Name=${_STACK_NAME} CostCenter=Paths.games Environment=${_ENV_TAG} ManagedBy=CloudFormation Owner=AlNao Project=Paths.games.aws.${_ENV_TAG}.serverless version=${_VERSION}"

# shellcheck source=../lib/admin_ip.sh
. "$PROJECT_ROOT/code/scripts/lib/admin_ip.sh"
_ADMIN_IP_WHITELIST=""
_KEEP_PREVIOUS=""
if [ "$IN_CI" = "true" ]; then
	_KEEP_PREVIOUS="AdminIpWhitelist"
	echo "  CI mode: AdminIpWhitelist not passed, the stack keeps its previous value (set it with code/scripts/alpha/set_admin_ip.sh)." >&2
else
	_ADMIN_IP_WHITELIST="$(admin_ip_whitelist "$(stage_key APIGW_ADMIN_IP_WHITELIST)" nobody)"
fi
# v0.42.0 — the monthly budget is created for alpha only.
_CREATE_BUDGET="false"
if [ "$STAGE" = "alpha" ]; then _CREATE_BUDGET="true"; fi

if [ -z "$(stage_key LAMBDA_TURNSTILE_SECRET_KEY)" ]; then
	echo "  WARNING: AWS_${SUFFIX}_LAMBDA_TURNSTILE_SECRET_KEY is empty — Turnstile validation stays as samconfig/template say (default OFF)." >&2
fi
if [ -z "$(stage_key APIGW_CORS_ORIGINS)" ]; then
	echo "  WARNING: AWS_${SUFFIX}_APIGW_CORS_ORIGINS is empty — CORS origins stay as samconfig/template say (template default lists localhost)." >&2
fi

# samconfig parameter_overrides first, then the non-empty stage keys, then the forced values; one Key=Value per line.
_PARAMS_TXT="$(
	PGSTAGE_OV_JwtSecret="$_JWT" \
	PGSTAGE_OV_TurnstileSecretKey="$(stage_key LAMBDA_TURNSTILE_SECRET_KEY)" \
	PGSTAGE_OV_CustomDomainName="$(stage_key APIGW_CUSTOM_DOMAIN)" \
	PGSTAGE_OV_CustomDomainCertificateArn="$(stage_key ACM_DOMAIN_CERTIFICATE_ARN)" \
	PGSTAGE_OV_CustomDomainHostedZoneId="$(stage_key ROUTE53_DOMAIN_HOSTED_ZONE)" \
	PGSTAGE_OV_CorsAllowOrigins="$(stage_key APIGW_CORS_ORIGINS)" \
	PGSTAGE_OV_WebsiteBucket="$(stage_key S3_BUCKET_WEBSITE)" \
	PGSTAGE_OV_WebsiteCloudFrontId="$(stage_key CLOUDFRONT_DISTRIBUTION_ID)" \
	PGSTAGE_OV_ApiThrottleRate="$(stage_key APIGW_THROTTLE_RATE)" \
	PGSTAGE_OV_ApiThrottleBurst="$(stage_key APIGW_THROTTLE_BURST)" \
	PGSTAGE_OV_AdminApiThrottleRate="$(stage_key APIGW_ADMIN_THROTTLE_RATE)" \
	PGSTAGE_OV_AdminApiThrottleBurst="$(stage_key APIGW_ADMIN_THROTTLE_BURST)" \
	PGSTAGE_OV_AlarmEmail="$(stage_key SNS_ALARM_EMAIL)" \
	PGSTAGE_OV_BudgetLimit="$(stage_key BUDGETS_LIMIT)" \
	PGSTAGE_OV_BudgetEmail="$(stage_key SNS_ALARM_EMAIL)" \
	PGSTAGE_FORCE_Environment="$STAGE" \
	PGSTAGE_FORCE_Version="$_VERSION" \
	PGSTAGE_FORCE_AllowMockAccess="false" \
	PGSTAGE_FORCE_TurnstileBypassToken="none" \
	PGSTAGE_FORCE_AdminIpWhitelist="$_ADMIN_IP_WHITELIST" \
	PGSTAGE_FORCE_AdminIpEmptyMeans="nobody" \
	PGSTAGE_FORCE_CreateBudget="$_CREATE_BUDGET" \
	PGSTAGE_KEEP_PREVIOUS="$_KEEP_PREVIOUS" \
	python3 - "$SAMCONFIG" "$STAGE" <<'PY'
import os, shlex, sys, tomllib
with open(sys.argv[1], "rb") as fh:
    section = tomllib.load(fh).get(sys.argv[2], {}).get("deploy", {}).get("parameters", {})
params = {}
for token in shlex.split(section.get("parameter_overrides", "")):
    key, sep, value = token.partition("=")
    if sep:
        params[key] = value
if params.get("Environment", sys.argv[2]) != sys.argv[2]:
    sys.exit(f"Error: samconfig [{sys.argv[2]}] has Environment={params['Environment']}.")
for name, value in os.environ.items():
    if name.startswith("PGSTAGE_OV_") and value:
        params[name[11:]] = value
for name, value in os.environ.items():
    if name.startswith("PGSTAGE_FORCE_"):
        params[name[14:]] = value
for key in filter(None, os.environ.get("PGSTAGE_KEEP_PREVIOUS", "").split(",")):
    params.pop(key, None)
for key, value in params.items():
    if "\n" in value:
        sys.exit(f"Error: parameter {key} holds a newline.")
    print(f"{key}={value}")
PY
)"
mapfile -t _PARAMS <<< "$_PARAMS_TXT"

echo "Deploying stage '$STAGE' (stack $_STACK_NAME, version $_VERSION) with --config-env $STAGE; parameters:"
for _p in "${_PARAMS[@]}"; do
	case "${_p%%=*}" in
		JwtSecret|TurnstileSecretKey|TurnstileBypassToken|SeedBcryptHash|AlarmEmail|BudgetEmail) echo "  ${_p%%=*}=****" ;;
		*) echo "  $_p" ;;
	esac
done

cd "$AWS_DIR"
sam build
# $_STACK_TAGS is unquoted on purpose: one Key=Value argument per tag.
# shellcheck disable=SC2086
sam deploy \
	--config-env "$STAGE" \
	--tags $_STACK_TAGS \
	--parameter-overrides "${_PARAMS[@]}" \
	$CONFIRM \
	--no-fail-on-empty-changeset 2>&1

echo "Stage '$STAGE' deployed (stack $_STACK_NAME)."
