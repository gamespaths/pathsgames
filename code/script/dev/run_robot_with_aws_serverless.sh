
#!/usr/bin/env bash
# execute all robot tests against an AWS-deployed server.
set -euo pipefail

# Deploy AWS backend using SAM / CloudFormation
# This script will try to use the SAM CLI (preferred). If `sam` is not available it
# falls back to `aws cloudformation package` + `aws cloudformation deploy`.
#!/usr/bin/env bash
set -euo pipefail

# Load .env from repository root if present
PROJECT_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
    # shellcheck disable=SC1090
    . "$ENV_FILE"
fi

# Required inputs (from environment or .env)
# - ENVIRONMENT_NAME: environment name used by the SAM template (e.g. dev, prod)
# - STACK_NAME: CloudFormation stack name to create/update
# Optional:
# - S3_BUCKET: S3 bucket used to upload artifacts (if not using SAM CLI)
# - S3_PREFIX: prefix used when uploading via SAM (defaults provided)
# - AWS_REGION: AWS region (defaults to us-east-2)

if [ -z "${ENVIRONMENT_NAME:-}" ] || [ -z "${STACK_NAME:-}" ]; then
    echo "Error: ENVIRONMENT_NAME and STACK_NAME must be set in the environment or .env file."
    exit 1
fi

S3_BUCKET="${S3_BUCKET:-pathsgames-cloudformation-dev}"
S3_PREFIX="${S3_PREFIX:-pathsgames-aws-backend}"
AWS_REGION="${AWS_REGION:-us-east-2}"

## get url of the deployed API from CloudFormation outputs
API_URL=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$AWS_REGION" --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text)

if [ -z "${API_URL:-}" ] || [ "$API_URL" = "None" ]; then
    echo "Error: could not determine ApiUrl from stack outputs. Check that stack '$STACK_NAME' exists and has an 'ApiUrl' output."
    exit 1
fi

# quick health check
if ! curl -s --fail "$API_URL/api/echo/status" > /dev/null; then
    echo "Server $API_URL did not respond to /api/echo/status. Aborting tests." >&2
    exit 1
fi

echo "Server $API_URL is up and running."

# Seed dev data (test users + seed stories) — idempotent, safe to re-run
echo "Seeding dev data (users + stories)..."
SEED_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/dev/seed")
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
cd "$PROJECT_ROOT/code/tests/robot" && \
robot --variablefile variables/dev.yaml \
    --variable BASE_URL:"$API_URL" \
    --variable ADMIN_TOKEN:"$ADMIN_TOKEN_VALUE" \
    --outputdir reports-aws/ tests/

echo "Test Robot completed. Report available in $PROJECT_ROOT/code/tests/robot/reports-aws/"

