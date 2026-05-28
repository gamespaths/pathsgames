
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
# Allow CLI override: aws_backend_deploy.sh <environment>
if [ -n "${1:-}" ] && [[ "$1" != "--auto-confirm" ]]; then
    AWS_ENVIRONMENT_NAME_TEST="$1"
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

#CONFIRM FLAG: if --confirm is passed as argument, the script will proceed without asking for confirmation
CONFIRM="--confirm-changeset" # default to ask for confirmation before deploying changeset
if [[ "${1:-}" == "--auto-confirm" ]]; then
    CONFIRM="--no-confirm-changeset" # if --auto-confirm is passed, do not ask for confirmation before deploying changeset
fi


echo "Deploying stack '$AWS_STACK_NAME_TEST' to region '$AWS_REGION_TEST' (Environment: $AWS_ENVIRONMENT_NAME_TEST)"

echo "SAM CLI found — building and deploying with sam"
#pushd "$PROJECT_ROOT/code/backend/aws" >/dev/null
cd "$PROJECT_ROOT/code/backend/aws"

echo "Checking if S3 bucket $AWS_S3_BUCKET_BASE_TEST exists in $AWS_REGION_TEST..."
if ! aws s3 ls "s3://$AWS_S3_BUCKET_BASE_TEST" --region "$AWS_REGION_TEST" > /dev/null 2>&1; then
    echo "Error: S3 bucket $AWS_S3_BUCKET_BASE_TEST does not exist. Create it using the AWS console and try again."
    exit 1
fi

sam build

# Dev uses an empty key to activate the server-side bypass (handler returns
# true when TURNSTILE_SECRET_KEY is empty); all other envs use the real key.
if [ "${AWS_ENVIRONMENT_NAME_TEST}" = "dev" ]; then
    _TURNSTILE_SAM_KEY=""
else
    _TURNSTILE_SAM_KEY="${TURNSTILE_SECRET_KEY:-}"
fi

# Robot-test bypass token: only injected in non-prod environments so production
# can never be bypassed regardless of which token a client sends.
if [ "${AWS_ENVIRONMENT_NAME_TEST}" = "prod" ]; then
    _TURNSTILE_BYPASS=""
else
    _TURNSTILE_BYPASS="${TURNSTILE_BYPASS_TOKEN_TEST:-}"
fi

# deploy with SAM; if it fails (for example due to an empty image_repository in samconfig.toml)
sam deploy \
    --stack-name "${AWS_STACK_NAME_TEST:-pathsgames-dev}" \
    --s3-bucket "${AWS_S3_BUCKET_BASE_TEST:-pathsgames-main}" \
    --s3-prefix "${S3_PREFIX:-cloudformation-backend}" \
    --region "${AWS_REGION_TEST:-us-east-2}" \
    --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
    --parameter-overrides Environment="${AWS_ENVIRONMENT_NAME_TEST:-dev}" \
        CustomDomainName="${AWS_CUSTOM_DOMAIN_TEST:-}" \
        CustomDomainCertificateArn="${AWS_DOMAIN_CERTIFICATE_ARN_TEST:-}" \
        CustomDomainHostedZoneId="${AWS_DOMAIN_HOSTED_ZONE_TEST:-}" \
        CorsAllowOrigins="${AWS_CORS_ORIGINS_TEST:-http://localhost:1234}" \
        TurnstileSecretKey="${_TURNSTILE_SAM_KEY}" \
        TurnstileBypassToken="${_TURNSTILE_BYPASS}" \
    $CONFIRM \
    --no-fail-on-empty-changeset 2>&1


echo "sam deploy succeeded"

#popd >/dev/null

echo "CloudFormation stack '$AWS_STACK_NAME_TEST' deployed successfully."