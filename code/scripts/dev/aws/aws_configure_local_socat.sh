# Retrieves the AWS API Gateway URL from CloudFormation and use with socat/caddy

# not used etc/hosts aliasing does not work for API Gateway (SNI and Host header required), so we use AWS_API_URL environment variable instead. This script retrieves the API URL from CloudFormation and writes it to .env for use in tests and manual curl commands.
# not used HOSTALIASES alias→hostname is NOT supported by Linux; API Gateway also requires SNI (correct Host header),
# so IP-based aliasing does not work. The recommended approach is to use AWS_API_URL directly in scripts/tests.


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
API_URL=$(aws cloudformation describe-stacks --region "$AWS_REGION_TEST" --stack-name "$AWS_STACK_NAME_TEST" --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text)
if [ -z "$API_URL" ]; then
    echo "Error: ApiUrl output not found in CloudFormation stack."
    exit 1
fi
API_HOST=$(echo "$API_URL" | awk -F[/:] '{print $4}')
if [ -z "$API_HOST" ]; then
    echo "Error: Unable to extract host from API URL."
    exit 1
fi

echo "API URL: $API_URL"
echo "API Host (AWS): $API_HOST"

# # Write AWS_API_URL to .env for use in scripts and manual curl/testing
# if grep -q "^AWS_API_URL=" "$ENV_FILE" 2>/dev/null; then
#     sed -i.bak "s|^AWS_API_URL=.*|AWS_API_URL=$API_URL|" "$ENV_FILE"
#     echo "Updated AWS_API_URL in $ENV_FILE"
# else
#     echo "AWS_API_URL=$API_URL" >> "$ENV_FILE"
#     echo "Added AWS_API_URL to $ENV_FILE"
# fi

# echo ""
# echo "Configuration completed."
# echo "  AWS_API_URL=$API_URL"
# echo ""
# echo "Use it in your shell:   source $ENV_FILE"
# echo "Or manually:            export AWS_API_URL=$API_URL"
# echo "Test with:              curl \$AWS_API_URL/api/echo/status"


echo "Started caddy to forward http://localhost:8142 → https://$API_HOST"
echo "You can now access the API at http://localhost:8142/dev/api/echo/status"

# caddy CLI reverse-proxy doesn't support header manipulation; use a temp Caddyfile
CADDYFILE=$(mktemp /tmp/Caddyfile.XXXXXX)
cat > "$CADDYFILE" <<EOF
:8142 {
    reverse_proxy https://$API_HOST {
        header_up Host {upstream_hostport}
        header_up X-Forwarded-Proto https
    }
}
EOF

echo "Using Caddyfile: $CADDYFILE"
caddy run --config "$CADDYFILE" --adapter caddyfile


