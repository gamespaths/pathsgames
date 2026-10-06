#!/usr/bin/env bash
# Remove the AWS backend stack (dev / test only) via CloudFormation.
set -euo pipefail

# Load .env from repository root if present
PROJECT_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
    # shellcheck disable=SC1090
    . "$ENV_FILE"
fi

# CLI: aws_backend_remove.sh [dev|test]
# An explicit environment also picks its stack (pathsgames-<env>), same rule as the deploy script.
for _arg in "$@"; do
    AWS_TEST_SAM_ENVIRONMENT_NAME="$_arg"
    AWS_TEST_SAM_STACK_NAME="pathsgames-$_arg"
done

# Required inputs (from environment or .env)
# - AWS_TEST_SAM_ENVIRONMENT_NAME: environment name used by the SAM template (dev or test)
# - AWS_TEST_SAM_STACK_NAME: CloudFormation stack name to delete
# Optional:
# - AWS_TEST_REGION: AWS region (default us-east-2; dev and test live in Ohio)

if [ -z "${AWS_TEST_SAM_ENVIRONMENT_NAME:-}" ] || [ -z "${AWS_TEST_SAM_STACK_NAME:-}" ]; then
    echo "Error: AWS_TEST_SAM_ENVIRONMENT_NAME and AWS_TEST_SAM_STACK_NAME must be set in the environment or .env file."
    exit 1
fi

# Only dev and test go through here: production is never deleted by script.
case "$AWS_TEST_SAM_ENVIRONMENT_NAME" in
    dev|test) ;;
    *)
        echo "Error: AWS_TEST_SAM_ENVIRONMENT_NAME must be 'dev' or 'test' (got '$AWS_TEST_SAM_ENVIRONMENT_NAME')."
        exit 1
        ;;
esac

# Stack name must end with -<env>: refuses to delete another environment's stack by mistake.
case "$AWS_TEST_SAM_STACK_NAME" in
    *-"$AWS_TEST_SAM_ENVIRONMENT_NAME") ;;
    *)
        echo "Error: stack '$AWS_TEST_SAM_STACK_NAME' does not match environment '$AWS_TEST_SAM_ENVIRONMENT_NAME' (expected suffix -$AWS_TEST_SAM_ENVIRONMENT_NAME)."
        exit 1
        ;;
esac

AWS_TEST_REGION="${AWS_TEST_REGION:-us-east-2}"
if [ "$AWS_TEST_REGION" != "us-east-2" ]; then
    echo "Error: dev and test stacks live in us-east-2 (Ohio), got AWS_TEST_REGION=$AWS_TEST_REGION."
    exit 1
fi

echo "Removing stack '$AWS_TEST_SAM_STACK_NAME' from region '$AWS_TEST_REGION' (Environment: $AWS_TEST_SAM_ENVIRONMENT_NAME)"

echo "Deleting CloudFormation stack '$AWS_TEST_SAM_STACK_NAME'..."
aws cloudformation delete-stack --stack-name "$AWS_TEST_SAM_STACK_NAME" --region "$AWS_TEST_REGION"
echo "Waiting for stack '$AWS_TEST_SAM_STACK_NAME' to be deleted..."
aws cloudformation wait stack-delete-complete --stack-name "$AWS_TEST_SAM_STACK_NAME" --region "$AWS_TEST_REGION"

echo "CloudFormation stack '$AWS_TEST_SAM_STACK_NAME' removed successfully."