
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

S3_BUCKET="${S3_BUCKET:-pathsgames-dev}"
S3_PREFIX="${S3_PREFIX:-cloudformation-backend}"
AWS_REGION="${AWS_REGION:-us-east-2}"

echo "Deploying stack '$STACK_NAME' to region '$AWS_REGION' (Environment: $ENVIRONMENT_NAME)"

echo "SAM CLI found — building and deploying with sam"
#pushd "$PROJECT_ROOT/code/backend/aws" >/dev/null
cd "$PROJECT_ROOT/code/backend/aws"

echo "Checking if S3 bucket $S3_BUCKET exists in $AWS_REGION..."
if ! aws s3 ls "s3://$S3_BUCKET" --region "$AWS_REGION" > /dev/null 2>&1; then
    echo "Error: S3 bucket $S3_BUCKET does not exist. Create it using the AWS console and try again."
    exit 1
fi

sam build

# deploy with SAM; if it fails (for example due to an empty image_repository in samconfig.toml)
sam deploy \
    --stack-name "${STACK_NAME:-pathsgames-dev}" \
    --s3-bucket "${S3_BUCKET:-pathsgames-dev}" \
    --s3-prefix "${S3_PREFIX:-cloudformation-backend}" \
    --region "${AWS_REGION:-us-east-2}" \
    --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
    --parameter-overrides Environment="${ENVIRONMENT_NAME:-dev}" \
    --no-fail-on-empty-changeset 2>&1


echo "sam deploy succeeded"

#popd >/dev/null

echo "CloudFormation stack '$STACK_NAME' deployed successfully."