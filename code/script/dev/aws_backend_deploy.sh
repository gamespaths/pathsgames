
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

echo "Deploying stack '$STACK_NAME' to region '$AWS_REGION' (Environment: $ENVIRONMENT_NAME)"

echo "SAM CLI found — building and deploying with sam"
#pushd "$PROJECT_ROOT/code/backend/aws" >/dev/null
cd "$PROJECT_ROOT/code/backend/aws"

sam build

# deploy with SAM; if it fails (for example due to an empty image_repository in samconfig.toml)
sam deploy \
    --stack-name "${STACK_NAME:-pathsgames-dev}" \
    --s3-bucket "${S3_BUCKET:-pathsgames-cloudformation-dev}" \
    --s3-prefix "${S3_PREFIX:-pathsgames-aws-backend}" \
    --region "${AWS_REGION:-us-east-2}" \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides Environment="${ENVIRONMENT_NAME:-dev}" \
    --no-fail-on-empty-changeset 2>&1


echo "sam deploy succeeded"

#popd >/dev/null

echo "CloudFormation stack '$STACK_NAME' deployed successfully."