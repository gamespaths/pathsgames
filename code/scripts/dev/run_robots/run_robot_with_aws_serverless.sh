
#!/usr/bin/env bash
# execute all robot tests against an AWS-deployed server.
set -euo pipefail

# Deploy AWS backend using SAM / CloudFormation
# This script will try to use the SAM CLI (preferred). If `sam` is not available it
# falls back to `aws cloudformation package` + `aws cloudformation deploy`.
#!/usr/bin/env bash
set -euo pipefail

# Load .env from repository root if present
PROJECT_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
    # shellcheck disable=SC1090
    . "$ENV_FILE"
fi

# Required inputs (from environment or .env)
# - AWS_ENVIRONMENT_NAME_TEST: environment name used by the SAM template (e.g. dev, prod)
# - AWS_STACK_NAME_TEST: CloudFormation stack name to create/update
# Optional:
# - AWS_S3_BUCKET_BASE_TEST: S3 bucket used to upload artifacts (if not using SAM CLI)
# - S3_PREFIX: prefix used when uploading via SAM (defaults provided)
# - AWS_REGION_TEST: AWS region (defaults to us-east-2)

if [ -z "${AWS_ENVIRONMENT_NAME_TEST:-}" ] || [ -z "${AWS_STACK_NAME_TEST:-}" ]; then
    echo "Error: AWS_ENVIRONMENT_NAME_TEST and AWS_STACK_NAME_TEST must be set in the environment or .env file."
    exit 1
fi

AWS_S3_BUCKET_BASE_TEST="${AWS_S3_BUCKET_BASE_TEST:-pathsgames-main}"
S3_PREFIX="${S3_PREFIX:-cloudformation-backend}"
AWS_REGION_TEST="${AWS_REGION_TEST:-us-east-2}"

## get url of the deployed API from CloudFormation outputs
#API_URL=$(aws cloudformation describe-stacks --stack-name "$AWS_STACK_NAME_TEST" --region "$AWS_REGION_TEST" --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text)
API_URL="https://${AWS_CUSTOM_DOMAIN_TEST:-}"
if [ -z "${API_URL:-}" ] || [ "$API_URL" = "None" ]; then
    echo "Error: could not determine ApiUrl $API_URL. Check that stack '$AWS_STACK_NAME_TEST' exists and has an 'ApiUrl' output."
    exit 1
fi
echo "API URL: $API_URL"

# Admin API URL — /api/admin/**, /api/dev/** and the admin /api/echo/status live on the
# dedicated, IP-restricted admin HTTP API. Prefer the AWS_ADMIN_API_URL_TEST env var, else
# read the stack's AdminApiUrl output. The caller's IP must be in AdminIpWhitelist.
ADMIN_API_URL="${AWS_ADMIN_API_URL_TEST:-}"
if [ -z "$ADMIN_API_URL" ]; then
    ADMIN_API_URL=$(aws cloudformation describe-stacks --stack-name "$AWS_STACK_NAME_TEST" --region "$AWS_REGION_TEST" --query "Stacks[0].Outputs[?OutputKey=='AdminApiUrl'].OutputValue" --output text 2>/dev/null || echo "")
fi
ADMIN_API_URL="${ADMIN_API_URL%/}"
if [ -z "$ADMIN_API_URL" ] || [ "$ADMIN_API_URL" = "None" ]; then
    echo "Error: could not determine AdminApiUrl. Set AWS_ADMIN_API_URL_TEST or ensure the stack exposes an 'AdminApiUrl' output." >&2
    exit 1
fi
echo "ADMIN API URL: $ADMIN_API_URL"

# quick health check
if ! curl -s --fail "$API_URL/api/echo/status" > /dev/null; then
    echo "Server $API_URL did not respond to /api/echo/status. Aborting tests." >&2
    exit 1
fi

echo "Server $API_URL is up and running."

# Seed dev data (test users + seed stories) — idempotent, safe to re-run.
# Dev endpoints are on the IP-restricted admin API now.
echo "Seeding dev data (users + stories) via admin API..."
SEED_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$ADMIN_API_URL/api/dev/seed")
SEED_HTTP_CODE=$(echo "$SEED_RESPONSE" | tail -n1)
SEED_BODY=$(echo "$SEED_RESPONSE" | sed '$d')
if [ "$SEED_HTTP_CODE" != "200" ]; then
    echo "Warning: seed endpoint returned HTTP $SEED_HTTP_CODE — $SEED_BODY" >&2
else
    echo "Seed data loaded successfully."
fi

# run Robot tests; pass BASE_URL and ADMIN_TOKEN explicitly so they override variables/dev.yaml defaults
cd "$PROJECT_ROOT/code/tests/robot"

# ADMIN token can come from .env as ROBOT_VAR_ADMIN_TOKEN or be empty (tests may generate it)
ADMIN_TOKEN_VALUE="${ROBOT_VAR_ADMIN_TOKEN:-}"


# Prepare environment for robot tests
if [ ! -d "$PROJECT_ROOT/.venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv "$PROJECT_ROOT/.venv"
fi
source "$PROJECT_ROOT/.venv/bin/activate"

echo "Installing/updating dependencies..."
pip install -q --upgrade pip
if [ -f "$PROJECT_ROOT/code/tests/robot/requirements.txt" ]; then
    pip install -q -r "$PROJECT_ROOT/code/tests/robot/requirements.txt"
fi

echo "Running Robot tests!"
cd "$PROJECT_ROOT/code/tests/robot"
ROBOT_EXIT=0
robot --variablefile variables/aws.yaml \
    --variable BASE_URL:"$API_URL" \
    --variable ADMIN_BASE_URL:"$ADMIN_API_URL" \
    --variable ADMIN_TOKEN:"$ADMIN_TOKEN_VALUE" \
    --exclude bypass \
    --outputdir reports-aws/ tests/ || ROBOT_EXIT=$?

# Remove the rows created by this Robot run (guests + matches tagged "robottest"),
# preserving every other row. Runs whether the tests passed or failed.
echo "Cleaning up robot test data via POST /api/dev/cleanup (admin API) ..."
curl -s -X POST "$ADMIN_API_URL/api/dev/cleanup" || echo "  cleanup request failed"
echo

echo "Test Robot completed. Report available in $PROJECT_ROOT/code/tests/robot/reports-aws/"
exit $ROBOT_EXIT

