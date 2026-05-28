
# Remove AWS backend using SAM / CloudFormation
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

echo "Removing stack '$AWS_STACK_NAME_TEST' from region '$AWS_REGION_TEST' (Environment: $AWS_ENVIRONMENT_NAME_TEST)"

echo "Deleting CloudFormation stack '$AWS_STACK_NAME_TEST'..."
aws cloudformation delete-stack --stack-name "$AWS_STACK_NAME_TEST" --region "$AWS_REGION_TEST"
echo "Waiting for stack '$AWS_STACK_NAME_TEST' to be deleted..."
aws cloudformation wait stack-delete-complete --stack-name "$AWS_STACK_NAME_TEST" --region "$AWS_REGION_TEST"

echo "CloudFormation stack '$AWS_STACK_NAME_TEST' removed successfully."