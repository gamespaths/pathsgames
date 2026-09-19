#!/usr/bin/env bash
# Runs run_stress.sh against an AWS stack: public/admin URLs read from the CloudFormation
# outputs (ApiUrl / AdminApiUrl), stack name, admin JWT and Turnstile bypass from the repo .env.
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$DIR/../../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  . "$ENV_FILE"
fi

# AWS defaults offered by run_stress.sh's questions (or taken with -y). Rationale, from a
# real run: 1 iteration/VU measures Lambda cold starts, not the backend — 3 iterations show
# the warm latency too; 500ms think time is a player, 0 is a burst; the series climbs to
# 2000 VU to find the ceiling and stops by itself past the error-rate threshold.
# Override per run with -l/-m/-i/-e/-d/-w, or for good by exporting the DEF_* variable.
export DEF_LEVELS="${DEF_LEVELS:-10 100 1000 2000}"
export DEF_MOVES="${DEF_MOVES:-5}"
export DEF_ITERATIONS="${DEF_ITERATIONS:-3}"
export DEF_THINK_MS="${DEF_THINK_MS:-500}"
export DEF_MAX_ERR="${DEF_MAX_ERR:-0.05}"
export DEF_MAX_DURATION="${DEF_MAX_DURATION:-10m}"

STACK="${AWS_STACK_NAME_TEST:-}"
REGION="${AWS_REGION_TEST:-us-east-2}"
BASE_URL=""
ADMIN_BASE_URL=""
ADMIN_TOKEN="${ADMIN_TOKEN:-${ROBOT_VAR_ADMIN_TOKEN:-}}"
TURNSTILE_TOKEN="${TURNSTILE_TOKEN:-${TURNSTILE_BYPASS_TOKEN_ROBOT:-}}"

usage() {
  cat <<USAGE
Usage: $(basename "$0") [options] [run_stress.sh options] [-- extra k6 args]
  -n STACK   CloudFormation stack name      (default .env AWS_STACK_NAME_TEST: ${STACK:-<unset>})
  -r REGION  AWS region of the stack        (default .env AWS_REGION_TEST: $REGION)
  -b URL     public base URL   — skips the ApiUrl lookup
  -a URL     admin base URL    — skips the AdminApiUrl lookup
  -t TOKEN   admin JWT                      (default .env ROBOT_VAR_ADMIN_TOKEN)
  -k TOKEN   Turnstile bypass token         (default .env TURNSTILE_BYPASS_TOKEN_ROBOT)
  -h         this help
Every other option (-l -m -i -e -d -w -v -z -y -c -s, and anything after --) goes to run_stress.sh,
which asks on the console for the series parameters it did not get. AWS defaults:
  levels "$DEF_LEVELS" | moves $DEF_MOVES | iterations/VU $DEF_ITERATIONS | think ${DEF_THINK_MS}ms
  max error rate $DEF_MAX_ERR | max duration $DEF_MAX_DURATION   (export DEF_* to change them)
Examples:
  $(basename "$0")                       # test stack, asks the series parameters
  $(basename "$0") -y                    # test stack, AWS defaults, no questions
  $(basename "$0") -l "10 100" -m 20 -w 0 -cNo   # keep the guests/matches for a look
  $(basename "$0") -n paths-games-prod -r eu-west-1 -t eyJ... -y
USAGE
}

PASS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    -n) STACK="${2:-}"; shift 2 ;;
    -r) REGION="${2:-}"; shift 2 ;;
    -b) BASE_URL="${2:-}"; shift 2 ;;
    -a) ADMIN_BASE_URL="${2:-}"; shift 2 ;;
    -t) ADMIN_TOKEN="${2:-}"; shift 2 ;;
    -k) TURNSTILE_TOKEN="${2:-}"; shift 2 ;;
    -h) usage; exit 0 ;;
    --) PASS+=("$@"); break ;;
    *)  PASS+=("$1"); shift ;;
  esac
done

# One CloudFormation output of the stack, empty when missing
stack_output() {
  local v
  v="$(aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
        --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text 2>/dev/null)" || v=""
  [[ "$v" == "None" ]] && v=""
  printf '%s' "${v%/}"
}

if [[ -z "$BASE_URL" || -z "$ADMIN_BASE_URL" ]]; then
  if [[ -z "$STACK" ]]; then
    echo "!! no stack name: set AWS_STACK_NAME_TEST in $ENV_FILE or pass -n STACK (or both -b and -a)" >&2
    exit 2
  fi
  if ! command -v aws >/dev/null 2>&1; then
    echo "!! aws CLI not found: install it, or pass -b and -a" >&2
    exit 2
  fi
  echo "== Reading outputs of stack '$STACK' ($REGION)"
  [[ -z "$BASE_URL" ]] && BASE_URL="$(stack_output ApiUrl)"
  [[ -z "$ADMIN_BASE_URL" ]] && ADMIN_BASE_URL="$(stack_output AdminApiUrl)"
  echo "   ApiUrl: ${BASE_URL:-<missing>} | AdminApiUrl: ${ADMIN_BASE_URL:-<missing>}"
fi
if [[ -z "$BASE_URL" || -z "$ADMIN_BASE_URL" ]]; then
  echo "!! could not resolve ApiUrl/AdminApiUrl from stack '$STACK' ($REGION); check the name, the region and your AWS credentials, or pass -b/-a" >&2
  exit 2
fi
if [[ -z "$ADMIN_TOKEN" ]]; then
  echo "!! no admin JWT: pass -t TOKEN or set ROBOT_VAR_ADMIN_TOKEN in $ENV_FILE (AWS never accepts the dev-minted one)" >&2
  exit 2
fi
if [[ -z "$TURNSTILE_TOKEN" ]]; then
  echo "   warning: no Turnstile bypass token (-k / TURNSTILE_BYPASS_TOKEN_ROBOT): match creation fails when the stack enforces Turnstile" >&2
fi

"$DIR/run_stress.sh" -b "$BASE_URL" -a "$ADMIN_BASE_URL" -t "$ADMIN_TOKEN" -k "$TURNSTILE_TOKEN" ${PASS[@]+"${PASS[@]}"}
STRESS_EXIT=$?

# Sweep what POST /api/dev/cleanup could not reach (CHARACTER# orphans, runs past the Lambda
# timeout) straight from DynamoDB; skipped when the caller kept the data with -c no / CLEANUP=0.
keep_data() {
  [[ "${CLEANUP:-1}" =~ ^(0|no|n|off|false)$ ]] && return 0
  local i
  for ((i = 0; i < ${#PASS[@]}; i++)); do
    case "${PASS[$i]}" in
      --) return 1 ;;
      -c) [[ "${PASS[$((i + 1))]:-}" =~ ^([Nn][Oo]?|0|[Oo][Ff][Ff]|[Ff][Aa][Ll][Ss][Ee])$ ]] && return 0 ;;
      -c*) [[ "${PASS[$i]#-c}" =~ ^([Nn][Oo]?|0|[Oo][Ff][Ff]|[Ff][Aa][Ll][Ss][Ee])$ ]] && return 0 ;;
    esac
  done
  return 1
}
PURGE_ENV="${PURGE_ENV:-${AWS_ENVIRONMENT_NAME_TEST:-}}"
if keep_data; then
  echo "== Data kept (-c no): skipping purge_robot_test_data.sh"
elif [[ -z "$PURGE_ENV" ]]; then
  echo "   warning: AWS_ENVIRONMENT_NAME_TEST unset, skipping purge_robot_test_data.sh (run it by hand with --table)" >&2
else
  echo "== Sweeping leftovers from DynamoDB (purge_robot_test_data.sh --env $PURGE_ENV --orphans)"
  "$PROJECT_ROOT/code/scripts/dev/aws/purge_robot_test_data.sh" --env "$PURGE_ENV" --region "$REGION" --orphans \
    || echo "   purge failed — by hand: code/scripts/dev/aws/purge_robot_test_data.sh --env $PURGE_ENV --region $REGION --orphans" >&2
fi

exit $STRESS_EXIT
