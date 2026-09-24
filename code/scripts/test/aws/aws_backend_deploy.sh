#!/usr/bin/env bash
# Deploy AWS backend (dev / test only) using SAM / CloudFormation.
# Region is always us-east-2 (Ohio); artifacts go to s3://pathsgames-test-iac/<env>/backend/.
set -euo pipefail

# Load .env from repository root if present
PROJECT_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
    # shellcheck disable=SC1090
    . "$ENV_FILE"
fi
# CLI: aws_backend_deploy.sh [dev|test] [--auto-confirm]
# An explicit environment also picks its stack (pathsgames-<env>): the stack name from .env
# belongs to the .env environment, and deploying another env into it would rename the table.
CONFIRM="--confirm-changeset" # default to ask for confirmation before deploying changeset
for _arg in "$@"; do
    case "$_arg" in
        --auto-confirm) CONFIRM="--no-confirm-changeset" ;;
        *)
            AWS_ENVIRONMENT_NAME_TEST="$_arg"
            AWS_STACK_NAME_TEST="pathsgames-$_arg"
            ;;
    esac
done


# Required inputs (from environment or .env)
# - AWS_ENVIRONMENT_NAME_TEST: environment name used by the SAM template (dev or test)
# - AWS_STACK_NAME_TEST: CloudFormation stack name to create/update
# Optional:
# - AWS_S3_BUCKET_BASE_TEST: S3 bucket for the SAM artifacts (default pathsgames-test-iac)
# - S3_PREFIX: folder inside the bucket (default <env>/backend, one folder per environment)
# - AWS_REGION_TEST: AWS region (default us-east-2; dev and test live in Ohio)

if [ -z "${AWS_ENVIRONMENT_NAME_TEST:-}" ] || [ -z "${AWS_STACK_NAME_TEST:-}" ]; then
    echo "Error: AWS_ENVIRONMENT_NAME_TEST and AWS_STACK_NAME_TEST must be set in the environment or .env file."
    exit 1
fi

# Only dev and test go through here: production has its own region/bucket (samconfig.toml [prod]).
case "$AWS_ENVIRONMENT_NAME_TEST" in
    dev|test) ;;
    *)
        echo "Error: AWS_ENVIRONMENT_NAME_TEST must be 'dev' or 'test' (got '$AWS_ENVIRONMENT_NAME_TEST'); production is deployed with 'sam deploy --config-env prod'."
        exit 1
        ;;
esac

# Every resource name ends with -<env> (table included): a stack/env mismatch would replace the table.
case "$AWS_STACK_NAME_TEST" in
    *-"$AWS_ENVIRONMENT_NAME_TEST") ;;
    *)
        echo "Error: stack '$AWS_STACK_NAME_TEST' does not match environment '$AWS_ENVIRONMENT_NAME_TEST' (expected suffix -$AWS_ENVIRONMENT_NAME_TEST)."
        exit 1
        ;;
esac

AWS_S3_BUCKET_BASE_TEST="${AWS_S3_BUCKET_BASE_TEST:-pathsgames-test-iac}"
S3_PREFIX="${S3_PREFIX:-${AWS_ENVIRONMENT_NAME_TEST}/backend}"
AWS_REGION_TEST="${AWS_REGION_TEST:-us-east-2}"
if [ "$AWS_REGION_TEST" != "us-east-2" ]; then
    echo "Error: dev and test stacks live in us-east-2 (Ohio), got AWS_REGION_TEST=$AWS_REGION_TEST."
    exit 1
fi

# Stack-level tags: CloudFormation propagates them to every taggable resource (nested stacks too).
# Must match the in-template tags; Environment tag = env name (dev / test; prod maps to production).
# Name = the stack itself: the root stack has no Tags property, every resource keeps its own Name.
# `version` tag = VERSION from the root .env (falls back to the Java parent pom, the bump script's source of truth).
_VERSION="${VERSION:-}"
if [ -z "$_VERSION" ]; then
    _VERSION="$(grep -m1 '<version>' "$PROJECT_ROOT/code/backend/java/pom.xml" 2>/dev/null | sed 's|.*<version>\(.*\)-SNAPSHOT</version>.*|\1|' || true)"
    if [ -z "$_VERSION" ]; then
        echo "Error: VERSION not set in .env and no version found in code/backend/java/pom.xml."
        exit 1
    fi
    echo "  WARNING: VERSION not set in .env — using pom.xml version $_VERSION for the version tag."
fi
_STACK_TAGS="Name=${AWS_STACK_NAME_TEST} CostCenter=Paths.games Environment=${AWS_ENVIRONMENT_NAME_TEST} ManagedBy=CloudFormation Owner=AlNao Project=Paths.games.aws.serverless version=${_VERSION}"


echo "Deploying stack '$AWS_STACK_NAME_TEST' to region '$AWS_REGION_TEST' (Environment: $AWS_ENVIRONMENT_NAME_TEST, version: $_VERSION, artifacts: s3://$AWS_S3_BUCKET_BASE_TEST/$S3_PREFIX/)"

echo "SAM CLI found — building and deploying with sam"
#pushd "$PROJECT_ROOT/code/backend/aws" >/dev/null
cd "$PROJECT_ROOT/code/backend/aws"

echo "Checking if S3 bucket $AWS_S3_BUCKET_BASE_TEST exists in $AWS_REGION_TEST..."
if ! aws s3 ls "s3://$AWS_S3_BUCKET_BASE_TEST" --region "$AWS_REGION_TEST" > /dev/null 2>&1; then
    echo "Error: S3 bucket $AWS_S3_BUCKET_BASE_TEST does not exist. Create it using the AWS console and try again."
    exit 1
fi

sam build

# Cloudflare secret: vuoto = validazione disattivata (bypass server-side).
_TURNSTILE_SAM_KEY="${TURNSTILE_SECRET_KEY:-}"

# Bypass token: only dev/test reach this point (see the case above), so prod is never bypassable.
# Robot manda un token fisso; il sito usa il widget vero e non serve qui.
_TURNSTILE_BYPASS="${TURNSTILE_BYPASS_TOKEN_ROBOT:-${TURNSTILE_BYPASS_TOKEN_TEST:-}}"
if [ -z "$_TURNSTILE_SAM_KEY" ]; then
    echo "  WARNING: TURNSTILE_SECRET_KEY is empty — Turnstile validation is OFF on this stack."
fi

# Admin IP whitelist: combine ADMIN_IP_WHITELIST from .env with the current
# machine's public IP (so the deployer always has access after deploy).
echo "Detecting current public IP for admin whitelist…"
_CURRENT_IP="$(curl -sf https://checkip.amazonaws.com || curl -sf https://api.ipify.org || echo '')"
if [ -n "$_CURRENT_IP" ]; then
    echo "  Current public IP: $_CURRENT_IP"
else
    echo "  WARNING: could not detect public IP — admin IP whitelist will only use ADMIN_IP_WHITELIST from .env"
fi
# Merge: env list (may be empty) + current IP, deduplicated, comma-separated
_BASE_WHITELIST="${ADMIN_IP_WHITELIST:-}"
if [ -n "$_BASE_WHITELIST" ] && [ -n "$_CURRENT_IP" ]; then
    _ADMIN_IP_WHITELIST="$_BASE_WHITELIST,$_CURRENT_IP"
elif [ -n "$_CURRENT_IP" ]; then
    _ADMIN_IP_WHITELIST="$_CURRENT_IP"
else
    _ADMIN_IP_WHITELIST="$_BASE_WHITELIST"
fi
# Remove duplicate IPs (preserving order)
if [ -n "$_ADMIN_IP_WHITELIST" ]; then
    _ADMIN_IP_WHITELIST="$(echo "$_ADMIN_IP_WHITELIST" | tr ',' '\n' | awk '!seen[$0]++' | tr '\n' ',' | sed 's/,$//')"
    echo "  Admin IP whitelist: $_ADMIN_IP_WHITELIST"
else
    echo "  WARNING: ADMIN_IP_WHITELIST is empty — admin endpoints will be accessible from ANY IP!"
fi

# deploy with SAM ($_STACK_TAGS is unquoted on purpose: one Key=Value argument per tag)
# shellcheck disable=SC2086
sam deploy \
    --stack-name "$AWS_STACK_NAME_TEST" \
    --s3-bucket "$AWS_S3_BUCKET_BASE_TEST" \
    --s3-prefix "$S3_PREFIX" \
    --region "$AWS_REGION_TEST" \
    --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
    --tags $_STACK_TAGS \
    --parameter-overrides Environment="$AWS_ENVIRONMENT_NAME_TEST" \
        Version="$_VERSION" \
        CustomDomainName="${AWS_CUSTOM_DOMAIN_TEST:-}" \
        CustomDomainCertificateArn="${AWS_DOMAIN_CERTIFICATE_ARN_TEST:-}" \
        CustomDomainHostedZoneId="${AWS_DOMAIN_HOSTED_ZONE_TEST:-}" \
        CorsAllowOrigins="${AWS_CORS_ORIGINS_TEST:-http://localhost:1234}" \
        TurnstileSecretKey="${_TURNSTILE_SAM_KEY}" \
        TurnstileBypassToken="${_TURNSTILE_BYPASS}" \
        AdminIpWhitelist="${_ADMIN_IP_WHITELIST}" \
        RateLimitGuestPerIp="${AWS_RATE_LIMIT_GUEST_PER_IP_TEST:-0}" \
        RateLimitMatchPerIp="${AWS_RATE_LIMIT_MATCH_PER_IP_TEST:-0}" \
        RateLimitWindowSeconds="${AWS_RATE_LIMIT_WINDOW_SECONDS_TEST:-3600}" \
        CsrfEnforced="${AWS_CSRF_ENFORCED_TEST:-true}" \
        RobotTestDataTtlHours="${AWS_ROBOT_TEST_DATA_TTL_HOURS_TEST:-1}" \
        WebsiteBucket="${AWS_S3_BUCKET_WEBSITE_TEST:-}" \
        WebsiteCloudFrontId="${AWS_CLOUDFRONT_DISTRIBUTION_ID_TEST:-}" \
        TableBillingMode="${AWS_TABLE_BILLING_MODE_TEST:-PAY_PER_REQUEST}" \
        TableReadCapacity="${AWS_TABLE_READ_CAPACITY_TEST:-10}" \
        TableWriteCapacity="${AWS_TABLE_WRITE_CAPACITY_TEST:-10}" \
        GsiReadCapacity="${AWS_GSI_READ_CAPACITY_TEST:-5}" \
        GsiWriteCapacity="${AWS_GSI_WRITE_CAPACITY_TEST:-5}" \
        LambdaSystemLogLevel="${AWS_LAMBDA_SYSTEM_LOG_LEVEL_TEST:-WARN}" \
    $CONFIRM \
    --no-fail-on-empty-changeset 2>&1


echo "sam deploy succeeded"

#popd >/dev/null

echo "CloudFormation stack '$AWS_STACK_NAME_TEST' deployed successfully."