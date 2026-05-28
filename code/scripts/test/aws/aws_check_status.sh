# check aws cloudformation stack status and API Gateway endpoint connectivity

set -euo pipefail
# Load .env from repository root if present
PROJECT_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
    # shellcheck disable=SC1090
    . "$ENV_FILE"
fi

if [ -z "${AWS_REGION_TEST:-}" ]; then
    echo "Error: AWS_REGION_TEST must be set in the environment or .env file."
    exit 1
fi

if [ -z "${AWS_STACK_NAME_TEST:-}" ]; then
    echo "Error: AWS_STACK_NAME_TEST must be set in the environment or .env file."
    exit 1
fi

STACK_STATUS=$(aws cloudformation describe-stacks --region "$AWS_REGION_TEST" --stack-name "$AWS_STACK_NAME_TEST" --query "Stacks[0].StackStatus" --output text)
if [ "$STACK_STATUS" != "CREATE_COMPLETE" ] && [ "$STACK_STATUS" !="UPDATE_COMPLETE" ]; then
    echo "Error: CloudFormation stack $AWS_STACK_NAME_TEST is not in a complete state. Current status: $STACK_STATUS"
    exit 1
fi
echo "CloudFormation stack $AWS_STACK_NAME_TEST status: $STACK_STATUS"

API_URL=$(aws cloudformation describe-stacks --region "$AWS_REGION_TEST" --stack-name "$AWS_STACK_NAME_TEST" --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text)
if [ -z "$API_URL" ]; then
    echo "Error: ApiUrl output not found in CloudFormation stack."
    exit 1
fi
echo "API URL: $API_URL"

# Test connectivity to API Gateway endpoint
curl -s "$API_URL/api/echo/status" > /dev/null || {
    echo "Error: Unable to connect to API Gateway endpoint at $API_URL"
    exit 1
}
echo "Successfully connected to API Gateway endpoint at $API_URL"   