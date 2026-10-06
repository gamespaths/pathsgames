
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
# - AWS_TEST_SAM_ENVIRONMENT_NAME: environment name used by the SAM template (e.g. dev, prod)
# - AWS_TEST_SAM_STACK_NAME: CloudFormation stack name to create/update
# Optional:
# - AWS_TEST_S3_BUCKET_BASE: S3 bucket used to upload artifacts (if not using SAM CLI)
# - S3_PREFIX: prefix used when uploading via SAM (defaults provided)
# - AWS_TEST_REGION: AWS region (defaults to us-east-2)

if [ -z "${AWS_TEST_SAM_ENVIRONMENT_NAME:-}" ] || [ -z "${AWS_TEST_SAM_STACK_NAME:-}" ]; then
    echo "Error: AWS_TEST_SAM_ENVIRONMENT_NAME and AWS_TEST_SAM_STACK_NAME must be set in the environment or .env file."
    exit 1
fi

AWS_TEST_S3_BUCKET_BASE="${AWS_TEST_S3_BUCKET_BASE:-pathsgames-main}"
S3_PREFIX="${S3_PREFIX:-cloudformation-backend}"
AWS_TEST_REGION="${AWS_TEST_REGION:-us-east-2}"

## get url of the deployed API from CloudFormation outputs
#API_URL=$(aws cloudformation describe-stacks --stack-name "$AWS_TEST_SAM_STACK_NAME" --region "$AWS_TEST_REGION" --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text)
API_URL="https://${AWS_TEST_APIGW_CUSTOM_DOMAIN:-}"
if [ -z "${API_URL:-}" ] || [ "$API_URL" = "None" ]; then
    echo "Error: could not determine ApiUrl $API_URL. Check that stack '$AWS_TEST_SAM_STACK_NAME' exists and has an 'ApiUrl' output."
    exit 1
fi
echo "API URL: $API_URL"

# Admin API URL — /api/admin/**, /api/dev/** and the admin /api/echo/status live on the
# dedicated, IP-restricted admin HTTP API. Prefer the AWS_TEST_APIGW_ADMIN_API_URL env var, else
# read the stack's AdminApiUrl output. The caller's IP must be in AdminIpWhitelist.
ADMIN_API_URL="${AWS_TEST_APIGW_ADMIN_API_URL:-}"
if [ -z "$ADMIN_API_URL" ]; then
    ADMIN_API_URL=$(aws cloudformation describe-stacks --stack-name "$AWS_TEST_SAM_STACK_NAME" --region "$AWS_TEST_REGION" --query "Stacks[0].Outputs[?OutputKey=='AdminApiUrl'].OutputValue" --output text 2>/dev/null || echo "")
fi
ADMIN_API_URL="${ADMIN_API_URL%/}"
if [ -z "$ADMIN_API_URL" ] || [ "$ADMIN_API_URL" = "None" ]; then
    echo "Error: could not determine AdminApiUrl. Set AWS_TEST_APIGW_ADMIN_API_URL or ensure the stack exposes an 'AdminApiUrl' output." >&2
    exit 1
fi
echo "ADMIN API URL: $ADMIN_API_URL"

# v0.41.0 — JwtHelper.py signs admin tokens with the stack secret, deployed from the same .env.
if [ -n "${JWT_SECRET:-}" ]; then export JWT_SECRET; fi

# quick health check
if ! curl -s --fail "$API_URL/api/echo/status" > /dev/null; then
    echo "Server $API_URL did not respond to /api/echo/status. Aborting tests." >&2
    exit 1
fi

echo "Server $API_URL is up and running."

# v0.41.0 — a 403 on the admin echo means this IP is not in the stack allow-list (AdminIpEmptyMeans=nobody).
ADMIN_ECHO_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$ADMIN_API_URL/api/echo/status" || true)
if [ "$ADMIN_ECHO_CODE" = "403" ]; then
    echo "WARNING: the admin API answered 403 — this IP is not in the stack admin allow-list, every admin test will fail." >&2
    echo "  Redeploy with code/scripts/test/aws/aws_backend_deploy.sh (adds the current IP) or add it to ADMIN_IP_WHITELIST." >&2
elif [ "$ADMIN_ECHO_CODE" != "200" ]; then
    echo "WARNING: the admin echo answered HTTP $ADMIN_ECHO_CODE." >&2
fi

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
    --outputdir reports-aws/ tests/ || ROBOT_EXIT=$?

# Remove the rows created by this Robot run (guests + matches tagged "robottest"),
# preserving every other row. Runs whether the tests passed or failed.
echo "Cleaning up robot test data via POST /api/dev/cleanup (admin API) ..."
curl -s -X POST "$ADMIN_API_URL/api/dev/cleanup" || echo "  cleanup request failed"
echo

# The endpoint above has one 30s Lambda invocation and gives up once a run no longer fits in it.
echo "Sweeping what the cleanup could not reach (purge_robot_test_data.sh) ..."
"$PROJECT_ROOT/code/scripts/dev/aws/purge_robot_test_data.sh" \
    --env "$AWS_TEST_SAM_ENVIRONMENT_NAME" --orphans \
    || echo "  purge failed — by hand: code/scripts/dev/aws/purge_robot_test_data.sh --env $AWS_TEST_SAM_ENVIRONMENT_NAME --orphans"
echo

echo "Test Robot completed. Report available in $PROJECT_ROOT/code/tests/robot/reports-aws/"
exit $ROBOT_EXIT

