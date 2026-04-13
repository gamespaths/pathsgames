
# Remove AWS backend using SAM / CloudFormation
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

echo "Removing stack '$STACK_NAME' from region '$AWS_REGION' (Environment: $ENVIRONMENT_NAME)"

echo "Deleting CloudFormation stack '$STACK_NAME'..."
aws cloudformation delete-stack --stack-name "$STACK_NAME" --region "$AWS_REGION"
echo "Waiting for stack '$STACK_NAME' to be deleted..."
aws cloudformation wait stack-delete-complete --stack-name "$STACK_NAME" --region "$AWS_REGION"

echo "CloudFormation stack '$STACK_NAME' removed successfully."