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
            AWS_TEST_SAM_ENVIRONMENT_NAME="$_arg"
            AWS_TEST_SAM_STACK_NAME="pathsgames-$_arg"
            ;;
    esac
done


# Required inputs (from environment or .env)
# - AWS_TEST_SAM_ENVIRONMENT_NAME: environment name used by the SAM template (dev or test)
# - AWS_TEST_SAM_STACK_NAME: CloudFormation stack name to create/update
# Optional:
# - AWS_TEST_S3_BUCKET_BASE: S3 bucket for the SAM artifacts (default pathsgames-test-iac)
# - S3_PREFIX: folder inside the bucket (default <env>/backend, one folder per environment)
# - AWS_TEST_REGION: AWS region (default us-east-2; dev and test live in Ohio)

if [ -z "${AWS_TEST_SAM_ENVIRONMENT_NAME:-}" ] || [ -z "${AWS_TEST_SAM_STACK_NAME:-}" ]; then
    echo "Error: AWS_TEST_SAM_ENVIRONMENT_NAME and AWS_TEST_SAM_STACK_NAME must be set in the environment or .env file."
    exit 1
fi

# Only dev and test go through here: production has its own region/bucket (samconfig.toml [prod]).
case "$AWS_TEST_SAM_ENVIRONMENT_NAME" in
    dev|test) ;;
    *)
        echo "Error: AWS_TEST_SAM_ENVIRONMENT_NAME must be 'dev' or 'test' (got '$AWS_TEST_SAM_ENVIRONMENT_NAME'); production is deployed with 'sam deploy --config-env prod'."
        exit 1
        ;;
esac

# Every resource name ends with -<env> (table included): a stack/env mismatch would replace the table.
case "$AWS_TEST_SAM_STACK_NAME" in
    *-"$AWS_TEST_SAM_ENVIRONMENT_NAME") ;;
    *)
        echo "Error: stack '$AWS_TEST_SAM_STACK_NAME' does not match environment '$AWS_TEST_SAM_ENVIRONMENT_NAME' (expected suffix -$AWS_TEST_SAM_ENVIRONMENT_NAME)."
        exit 1
        ;;
esac

AWS_TEST_S3_BUCKET_BASE="${AWS_TEST_S3_BUCKET_BASE:-pathsgames-test-iac}"
S3_PREFIX="${S3_PREFIX:-${AWS_TEST_SAM_ENVIRONMENT_NAME}/backend}"
AWS_TEST_REGION="${AWS_TEST_REGION:-us-east-2}"
if [ "$AWS_TEST_REGION" != "us-east-2" ]; then
    echo "Error: dev and test stacks live in us-east-2 (Ohio), got AWS_TEST_REGION=$AWS_TEST_REGION."
    exit 1
fi

# v0.41.0 — the stack signs and verifies with the .env secret, the same one Robot and mint_admin_token.sh use.
if [ -z "${JWT_SECRET:-}" ]; then
    echo "Error: JWT_SECRET is empty — set it in the root .env (openssl rand -base64 48) before deploying."
    exit 1
fi
if [ "$JWT_SECRET" = "PathsGamesDevSecret2026_MustBeAtLeast32Chars!" ]; then
    echo "  WARNING: JWT_SECRET is the committed dev default — rotate it (decision 32) before the 0.41.0 Robot runs."
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
_STACK_TAGS="Name=${AWS_TEST_SAM_STACK_NAME} CostCenter=Paths.games Environment=${AWS_TEST_SAM_ENVIRONMENT_NAME} ManagedBy=CloudFormation Owner=AlNao Project=Paths.games.aws.${AWS_TEST_SAM_ENVIRONMENT_NAME}.serverless version=${_VERSION}"


echo "Deploying stack '$AWS_TEST_SAM_STACK_NAME' to region '$AWS_TEST_REGION' (Environment: $AWS_TEST_SAM_ENVIRONMENT_NAME, version: $_VERSION, artifacts: s3://$AWS_TEST_S3_BUCKET_BASE/$S3_PREFIX/)"

echo "SAM CLI found — building and deploying with sam"
#pushd "$PROJECT_ROOT/code/backend/aws" >/dev/null
cd "$PROJECT_ROOT/code/backend/aws"

echo "Checking if S3 bucket $AWS_TEST_S3_BUCKET_BASE exists in $AWS_TEST_REGION..."
if ! aws s3 ls "s3://$AWS_TEST_S3_BUCKET_BASE" --region "$AWS_TEST_REGION" > /dev/null 2>&1; then
    echo "Error: S3 bucket $AWS_TEST_S3_BUCKET_BASE does not exist. Create it using the AWS console and try again."
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

# Admin IP allow-list: ADMIN_IP_WHITELIST from .env plus this machine's public IP (code/scripts/lib/admin_ip.sh).
# shellcheck source=../../lib/admin_ip.sh
. "$PROJECT_ROOT/code/scripts/lib/admin_ip.sh"
_ADMIN_IP_EMPTY_MEANS="${AWS_TEST_APIGW_ADMIN_IP_EMPTY_MEANS:-nobody}"
_ADMIN_IP_WHITELIST="$(admin_ip_whitelist "${ADMIN_IP_WHITELIST:-}" "$_ADMIN_IP_EMPTY_MEANS")"

# deploy with SAM ($_STACK_TAGS is unquoted on purpose: one Key=Value argument per tag)
# shellcheck disable=SC2086
sam deploy \
    --stack-name "$AWS_TEST_SAM_STACK_NAME" \
    --s3-bucket "$AWS_TEST_S3_BUCKET_BASE" \
    --s3-prefix "$S3_PREFIX" \
    --region "$AWS_TEST_REGION" \
    --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
    --tags $_STACK_TAGS \
    --parameter-overrides Environment="$AWS_TEST_SAM_ENVIRONMENT_NAME" \
        Version="$_VERSION" \
        CustomDomainName="${AWS_TEST_APIGW_CUSTOM_DOMAIN:-}" \
        CustomDomainCertificateArn="${AWS_TEST_ACM_DOMAIN_CERTIFICATE_ARN:-}" \
        CustomDomainHostedZoneId="${AWS_TEST_ROUTE53_DOMAIN_HOSTED_ZONE:-}" \
        CorsAllowOrigins="${AWS_TEST_APIGW_CORS_ORIGINS:-http://localhost:1234}" \
        TurnstileSecretKey="${_TURNSTILE_SAM_KEY}" \
        TurnstileBypassToken="${_TURNSTILE_BYPASS}" \
        JwtSecret="${JWT_SECRET}" \
        AllowMockAccess=true \
        AdminIpWhitelist="${_ADMIN_IP_WHITELIST}" \
        AdminIpEmptyMeans="${_ADMIN_IP_EMPTY_MEANS}" \
        RateLimitGuestPerIp="${AWS_TEST_LAMBDA_RATE_LIMIT_GUEST_PER_IP:-0}" \
        RateLimitMatchPerIp="${AWS_TEST_LAMBDA_RATE_LIMIT_MATCH_PER_IP:-0}" \
        RateLimitWindowSeconds="${AWS_TEST_LAMBDA_RATE_LIMIT_WINDOW_SECONDS:-3600}" \
        RateLimitMatchPerGuest="${AWS_TEST_LAMBDA_RATE_LIMIT_MATCH_PER_GUEST:-0}" \
        RateLimitMatchPerGuestWindowSeconds="${AWS_TEST_LAMBDA_RATE_LIMIT_MATCH_PER_GUEST_WINDOW_SECONDS:-86400}" \
        GuestCleanupEnabled="${AWS_TEST_LAMBDA_GUEST_CLEANUP_ENABLED:-true}" \
        GuestCleanupAgeDays="${AWS_TEST_LAMBDA_GUEST_CLEANUP_AGE_DAYS:-60}" \
        GuestCleanupMaxPerRun="${AWS_TEST_LAMBDA_GUEST_CLEANUP_MAX_PER_RUN:-500}" \
        CsrfEnforced="${AWS_TEST_LAMBDA_CSRF_ENFORCED:-true}" \
        RobotTestDataTtlHours="${AWS_TEST_DYNAMODB_ROBOT_TEST_DATA_TTL_HOURS:-1}" \
        WebsiteBucket="${AWS_TEST_S3_BUCKET_WEBSITE:-}" \
        WebsiteCloudFrontId="${AWS_TEST_CLOUDFRONT_DISTRIBUTION_ID:-}" \
        TableBillingMode="${AWS_TEST_DYNAMODB_TABLE_BILLING_MODE:-PAY_PER_REQUEST}" \
        TableReadCapacity="${AWS_TEST_DYNAMODB_TABLE_READ_CAPACITY:-10}" \
        TableWriteCapacity="${AWS_TEST_DYNAMODB_TABLE_WRITE_CAPACITY:-10}" \
        GsiReadCapacity="${AWS_TEST_DYNAMODB_GSI_READ_CAPACITY:-5}" \
        GsiWriteCapacity="${AWS_TEST_DYNAMODB_GSI_WRITE_CAPACITY:-5}" \
        LambdaSystemLogLevel="${AWS_TEST_LAMBDA_SYSTEM_LOG_LEVEL:-WARN}" \
    $CONFIRM \
    --no-fail-on-empty-changeset 2>&1


echo "sam deploy succeeded"

#popd >/dev/null

echo "CloudFormation stack '$AWS_TEST_SAM_STACK_NAME' deployed successfully."