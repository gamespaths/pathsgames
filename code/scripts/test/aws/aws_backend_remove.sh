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
    AWS_ENVIRONMENT_NAME_TEST="$_arg"
    AWS_STACK_NAME_TEST="pathsgames-$_arg"
done

# Required inputs (from environment or .env)
# - AWS_ENVIRONMENT_NAME_TEST: environment name used by the SAM template (dev or test)
# - AWS_STACK_NAME_TEST: CloudFormation stack name to delete
# Optional:
# - AWS_REGION_TEST: AWS region (default us-east-2; dev and test live in Ohio)

if [ -z "${AWS_ENVIRONMENT_NAME_TEST:-}" ] || [ -z "${AWS_STACK_NAME_TEST:-}" ]; then
    echo "Error: AWS_ENVIRONMENT_NAME_TEST and AWS_STACK_NAME_TEST must be set in the environment or .env file."
    exit 1
fi

# Only dev and test go through here: production is never deleted by script.
case "$AWS_ENVIRONMENT_NAME_TEST" in
    dev|test) ;;
    *)
        echo "Error: AWS_ENVIRONMENT_NAME_TEST must be 'dev' or 'test' (got '$AWS_ENVIRONMENT_NAME_TEST')."
        exit 1
        ;;
esac

# Stack name must end with -<env>: refuses to delete another environment's stack by mistake.
case "$AWS_STACK_NAME_TEST" in
    *-"$AWS_ENVIRONMENT_NAME_TEST") ;;
    *)
        echo "Error: stack '$AWS_STACK_NAME_TEST' does not match environment '$AWS_ENVIRONMENT_NAME_TEST' (expected suffix -$AWS_ENVIRONMENT_NAME_TEST)."
        exit 1
        ;;
esac

AWS_REGION_TEST="${AWS_REGION_TEST:-us-east-2}"
if [ "$AWS_REGION_TEST" != "us-east-2" ]; then
    echo "Error: dev and test stacks live in us-east-2 (Ohio), got AWS_REGION_TEST=$AWS_REGION_TEST."
    exit 1
fi

echo "Removing stack '$AWS_STACK_NAME_TEST' from region '$AWS_REGION_TEST' (Environment: $AWS_ENVIRONMENT_NAME_TEST)"

echo "Deleting CloudFormation stack '$AWS_STACK_NAME_TEST'..."
aws cloudformation delete-stack --stack-name "$AWS_STACK_NAME_TEST" --region "$AWS_REGION_TEST"
echo "Waiting for stack '$AWS_STACK_NAME_TEST' to be deleted..."
aws cloudformation wait stack-delete-complete --stack-name "$AWS_STACK_NAME_TEST" --region "$AWS_REGION_TEST"

echo "CloudFormation stack '$AWS_STACK_NAME_TEST' removed successfully."