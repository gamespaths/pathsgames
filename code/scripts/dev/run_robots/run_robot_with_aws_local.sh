#!/usr/bin/env bash
# run_robot_with_aws_local.sh - v0.41.4 the Robot suites against the AWS backend run locally
# (aws_run_local/start_local.sh), reports in code/tests/robot/reports-aws-local/; everything is removed at the end.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$HERE/../../../.." && pwd)"
LOCAL_DIR="$PROJECT_ROOT/code/scripts/dev/aws_run_local"
PUBLIC_PORT="${AWS_LOCAL_PUBLIC_PORT:-3042}"
ADMIN_PORT="${AWS_LOCAL_ADMIN_PORT:-3044}"

# v0.41.4 - ROBOT_RATE_LIMITS=1 (run_robot_everywhere AWS_LOCAL_LIMITED): limits on, only the rate-limit tests.
# Per guest < per-IP matches, so that case meets its own bucket; 10 guests leave room for the setups.
if [ "${ROBOT_RATE_LIMITS:-0}" = "1" ]; then
    export RATE_LIMIT_GUEST_PER_IP=10 RATE_LIMIT_MATCH_PER_IP=5 RATE_LIMIT_MATCH_PER_GUEST=3
    ROBOT_SCOPE=(--include rate-limit --variable RATE_LIMIT_GUEST_PER_IP:10 --variable RATE_LIMIT_MATCH_PER_IP:5
        --variable RATE_LIMIT_MATCH_PER_GUEST:3 --outputdir reports-aws-local-limited/)
elif [ "${ROBOT_GOLDEN:-0}" = "1" ]; then
    # v0.41.4 - ROBOT_GOLDEN=1 (export_golden_files.sh): writes this backend's golden export, imports every golden.
    export RATE_LIMIT_GUEST_PER_IP=0 RATE_LIMIT_MATCH_PER_IP=0 RATE_LIMIT_MATCH_PER_GUEST=0
    ROBOT_SCOPE=(--include golden --variable WRITE_GOLDEN:1 --outputdir reports-aws-local-golden/)
else
    export RATE_LIMIT_GUEST_PER_IP=0 RATE_LIMIT_MATCH_PER_IP=0 RATE_LIMIT_MATCH_PER_GUEST=0
    ROBOT_SCOPE=(--outputdir reports-aws-local/)
fi

# AWS_LOCAL_KEEP=1 leaves the backend running after the tests, for debugging.
cleanup() {
    if [ "${AWS_LOCAL_KEEP:-0}" = "1" ]; then
        echo "AWS_LOCAL_KEEP=1: backend left running, stop it with $LOCAL_DIR/stop_local.sh"
    else
        "$LOCAL_DIR/stop_local.sh"
    fi
}
trap cleanup EXIT

"$LOCAL_DIR/stop_local.sh" > /dev/null 2>&1 || true
"$LOCAL_DIR/start_local.sh" || { echo "Error: the local AWS backend did not start." >&2; exit 1; }

# shellcheck disable=SC1091
source "$PROJECT_ROOT/.venv/bin/activate"
if [ -f "$PROJECT_ROOT/code/tests/robot/requirements.txt" ]; then
    pip install -q -r "$PROJECT_ROOT/code/tests/robot/requirements.txt"
fi
# JwtHelper.py signs admin tokens with the secret the local functions run with.
export JWT_SECRET="${AWS_LOCAL_JWT_SECRET:-PathsGamesDevSecret2026_MustBeAtLeast32Chars!}"

# CF_TURNSTILE_TOKEN empty: the local functions run without a Turnstile key (dev bypass, like dev.yaml).
# skip_local_differences.py skips the tests sam local cannot reproduce (API Gateway header trimming).
echo "Running Robot tests against the local AWS backend!"
cd "$PROJECT_ROOT/code/tests/robot" || exit 1
ROBOT_EXIT=0
robot --variablefile variables/aws.yaml \
    --variable BASE_URL:"http://127.0.0.1:$PUBLIC_PORT" \
    --variable ADMIN_BASE_URL:"http://127.0.0.1:$ADMIN_PORT" \
    --variable ADMIN_TOKEN:"${ROBOT_VAR_ADMIN_TOKEN:-}" \
    --variable CF_TURNSTILE_TOKEN: \
    --prerunmodifier "$LOCAL_DIR/skip_local_differences.py" \
    "${ROBOT_SCOPE[@]}" tests/ || ROBOT_EXIT=$?

echo "Test Robot completed. Report available in $PROJECT_ROOT/code/tests/robot/${ROBOT_SCOPE[-1]}"
exit $ROBOT_EXIT
