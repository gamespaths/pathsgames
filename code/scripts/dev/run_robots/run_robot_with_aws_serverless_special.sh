#!/usr/bin/env bash
# run_robot_with_aws_serverless_special.sh - v0.41.4 the rate-limit Robot tests on the deployed AWS test stack:
# the limits are switched on in the Auth/Match Lambda env for the run, the saved env is always put back.
#
# Reads the root .env like run_robot_with_aws_serverless.sh (AWS_TEST_SAM_ENVIRONMENT_NAME, AWS_TEST_REGION,
# AWS_TEST_APIGW_CUSTOM_DOMAIN, AWS_TEST_APIGW_ADMIN_API_URL, AWS_TEST_SAM_STACK_NAME). Reports in reports-aws-limited/.
# While it runs (about 1-2 minutes) the limits apply to everybody using the test stack.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$HERE/../../../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
    # shellcheck disable=SC1090
    . "$ENV_FILE"
fi

# Limits of the run: per guest < per-IP matches, so that case meets its own bucket; 10 guests leave
# room for the setups. A short fixed window, entered at its start, so no earlier count is left in it.
GUEST_PER_IP=10
MATCH_PER_IP=5
MATCH_PER_GUEST=3
WINDOW_SECONDS=180

ENV_NAME="${AWS_TEST_SAM_ENVIRONMENT_NAME:-}"
REGION="${AWS_TEST_REGION:-us-east-2}"
if [ -z "$ENV_NAME" ] || [ -z "${AWS_TEST_SAM_STACK_NAME:-}" ]; then
    echo "Error: AWS_TEST_SAM_ENVIRONMENT_NAME and AWS_TEST_SAM_STACK_NAME must be set in the environment or .env file." >&2
    exit 1
fi
command -v aws > /dev/null || { echo "Error: the aws CLI is not installed." >&2; exit 1; }
FUNCTIONS=("pathsgames-$ENV_NAME-AuthFunction" "pathsgames-$ENV_NAME-MatchFunction")
BACKUP_DIR="$PROJECT_ROOT/code/scripts/dev/run_robot_results/aws_special_env_backup"
mkdir -p "$BACKUP_DIR"

API_URL="https://${AWS_TEST_APIGW_CUSTOM_DOMAIN:-}"
ADMIN_API_URL="${AWS_TEST_APIGW_ADMIN_API_URL:-}"
if [ -z "$ADMIN_API_URL" ]; then
    ADMIN_API_URL=$(aws cloudformation describe-stacks --stack-name "$AWS_TEST_SAM_STACK_NAME" --region "$REGION" \
        --query "Stacks[0].Outputs[?OutputKey=='AdminApiUrl'].OutputValue" --output text 2> /dev/null || echo "")
fi
ADMIN_API_URL="${ADMIN_API_URL%/}"
if [ "$API_URL" = "https://" ] || [ -z "$ADMIN_API_URL" ] || [ "$ADMIN_API_URL" = "None" ]; then
    echo "Error: API URL ($API_URL) or admin API URL ($ADMIN_API_URL) unknown, see AWS_TEST_APIGW_CUSTOM_DOMAIN / AWS_TEST_APIGW_ADMIN_API_URL." >&2
    exit 1
fi

# Nothing is changed unless both APIs answer: the tests need the admin API to stop and delete their matches.
if ! curl -s --fail "$API_URL/api/echo/status" > /dev/null; then
    echo "Error: $API_URL did not answer /api/echo/status." >&2
    exit 1
fi
ADMIN_ECHO_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$ADMIN_API_URL/api/echo/status" || true)
if [ "$ADMIN_ECHO_CODE" != "200" ]; then
    echo "Error: the admin API answered HTTP $ADMIN_ECHO_CODE (403 = this IP is not in the admin allow-list)." >&2
    exit 1
fi

# One function's Lambda env: save it (once) and write it back with the given overrides.
set_env() {
    local fn="$1" source_file="$2" overrides="$3"
    python3 - "$source_file" "$overrides" "$BACKUP_DIR/$fn.patched.json" <<'PY'
import json, sys
variables = json.load(open(sys.argv[1]))["Variables"]
variables.update(json.loads(sys.argv[2]))
json.dump({"Variables": variables}, open(sys.argv[3], "w"))
PY
    aws lambda update-function-configuration --function-name "$fn" --region "$REGION" \
        --environment "file://$BACKUP_DIR/$fn.patched.json" > /dev/null \
        && aws lambda wait function-updated --function-name "$fn" --region "$REGION"
}

restore() {
    local fn failed=0
    for fn in "${FUNCTIONS[@]}"; do
        [ -f "$BACKUP_DIR/$fn.json" ] || continue
        echo "Restoring the Lambda env of $fn ..."
        if set_env "$fn" "$BACKUP_DIR/$fn.json" '{}'; then
            rm -f "$BACKUP_DIR/$fn.json" "$BACKUP_DIR/$fn.patched.json"
        else
            failed=1
            echo "ERROR: $fn NOT restored, the rate limits are still ON on the test stack. By hand:" >&2
            echo "  aws lambda update-function-configuration --function-name $fn --region $REGION --environment file://$BACKUP_DIR/$fn.json" >&2
            echo "  (or redeploy with code/scripts/test/aws/aws_backend_deploy.sh)" >&2
        fi
    done
    return $failed
}

# A backup left by an interrupted run is the real original: put it back before anything else.
if ls "$BACKUP_DIR"/*.json > /dev/null 2>&1; then
    echo "A previous run left a saved Lambda env: restoring it first."
    restore || exit 1
fi

ROBOT_EXIT=0
finish() {
    restore || ROBOT_EXIT=1
    echo "Rate-limit run completed. Report available in $PROJECT_ROOT/code/tests/robot/reports-aws-limited/"
    exit $ROBOT_EXIT
}
trap finish EXIT

OVERRIDES=$(printf '{"RATE_LIMIT_GUEST_PER_IP":"%s","RATE_LIMIT_MATCH_PER_IP":"%s","RATE_LIMIT_MATCH_PER_GUEST":"%s","RATE_LIMIT_WINDOW_SECONDS":"%s"}' \
    "$GUEST_PER_IP" "$MATCH_PER_IP" "$MATCH_PER_GUEST" "$WINDOW_SECONDS")
for fn in "${FUNCTIONS[@]}"; do
    echo "Switching the rate limits on in $fn ..."
    aws lambda get-function-configuration --function-name "$fn" --region "$REGION" \
        --query '{Variables: Environment.Variables}' --output json > "$BACKUP_DIR/$fn.json" \
        || { rm -f "$BACKUP_DIR/$fn.json"; ROBOT_EXIT=1; exit 1; }
    set_env "$fn" "$BACKUP_DIR/$fn.json" "$OVERRIDES" || { ROBOT_EXIT=1; exit 1; }
done

# Start at a fresh window: no count of an earlier run in it, and the 3 tests end before it rolls over.
WAIT=$(( WINDOW_SECONDS - $(date +%s) % WINDOW_SECONDS + 2 ))
echo "Waiting ${WAIT}s for a fresh ${WINDOW_SECONDS}s rate-limit window ..."
sleep "$WAIT"

if [ ! -d "$PROJECT_ROOT/.venv" ]; then
    python3 -m venv "$PROJECT_ROOT/.venv"
fi
# shellcheck disable=SC1091
source "$PROJECT_ROOT/.venv/bin/activate"
pip install -q -r "$PROJECT_ROOT/code/tests/robot/requirements.txt"
if [ -n "${JWT_SECRET:-}" ]; then export JWT_SECRET; fi

echo "Running the rate-limit Robot tests on $API_URL ..."
cd "$PROJECT_ROOT/code/tests/robot" || exit 1
robot --variablefile variables/aws.yaml \
    --variable BASE_URL:"$API_URL" \
    --variable ADMIN_BASE_URL:"$ADMIN_API_URL" \
    --variable ADMIN_TOKEN:"${ROBOT_VAR_ADMIN_TOKEN:-}" \
    --include rate-limit \
    --variable "RATE_LIMIT_GUEST_PER_IP:$GUEST_PER_IP" \
    --variable "RATE_LIMIT_MATCH_PER_IP:$MATCH_PER_IP" \
    --variable "RATE_LIMIT_MATCH_PER_GUEST:$MATCH_PER_GUEST" \
    --outputdir reports-aws-limited/ tests/ || ROBOT_EXIT=$?
