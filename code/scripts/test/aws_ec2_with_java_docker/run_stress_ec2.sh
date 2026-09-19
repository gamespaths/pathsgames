#!/usr/bin/env bash
# Runs code/tests/stress/run_stress.sh against the Java EC2 instance launched by ./start.sh:
# public/admin URLs from .state (PUBLIC_IP + ports), admin JWT minted from the root .env
# JWT_SECRET (the backend container runs with the same secret). No .state → nothing runs.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_FILE="$SCRIPT_DIR/.state"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
STRESS_SH="$PROJECT_ROOT/code/tests/stress/run_stress.sh"
ENV_FILE="$PROJECT_ROOT/.env"

# ── .state is mandatory: it is the proof that start.sh launched the instance ──
if [[ ! -f "$STATE_FILE" ]]; then
  echo "!! $STATE_FILE not found: no EC2 instance launched from this folder — run ./start.sh first" >&2
  exit 2
fi
if [[ ! -x "$STRESS_SH" ]]; then
  echo "!! $STRESS_SH not found or not executable" >&2
  exit 2
fi
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  . "$ENV_FILE"
fi
# .state (written by start.sh) wins over the .env for the live instance values
# shellcheck disable=SC1090
. "$STATE_FILE"

INSTANCE_NAME="${INSTANCE_NAME:-${INSTANCE_NAME_TEST_EC2:-api-test-server2}}"
PUBLIC_IP="${PUBLIC_IP:-}"
SG_ID="${SG_ID:-<sg-id>}"
ROUTE53_RECORD_NAME="${ROUTE53_RECORD_NAME:-}"
CLOUDFRONT_DOMAIN="${CLOUDFRONT_DOMAIN:-}"
PUBLIC_PORT="${PUBLIC_PORT_TEST_EC2:-8042}"
ADMIN_PORT="${ADMIN_PORT_TEST_EC2:-8044}"

# EC2 defaults offered by run_stress.sh's questions (or taken with -y): one instance with
# postgres beside it, so the series climbs to 1000 VU and stops by itself past the error rate.
# Override per run with -l/-m/-i/-e/-d/-w, or for good by exporting the DEF_* variable.
export DEF_LEVELS="${DEF_LEVELS:-10 100 500 1000}"
export DEF_MOVES="${DEF_MOVES:-5}"
export DEF_ITERATIONS="${DEF_ITERATIONS:-3}"
export DEF_THINK_MS="${DEF_THINK_MS:-500}"
export DEF_MAX_ERR="${DEF_MAX_ERR:-0.05}"
export DEF_MAX_DURATION="${DEF_MAX_DURATION:-10m}"

BASE_URL=""
ADMIN_BASE_URL=""
USE_DNS=0
ADMIN_TOKEN="${ADMIN_TOKEN:-}"
TURNSTILE_TOKEN="${TURNSTILE_TOKEN:-${TURNSTILE_BYPASS_TOKEN_ROBOT:-}}"

usage() {
  cat <<USAGE
Usage: $(basename "$0") [options] [run_stress.sh options] [-- extra k6 args]
  -b URL     public base URL   (default http://<PUBLIC_IP>:$PUBLIC_PORT from .state)
  -a URL     admin base URL    (default http://<PUBLIC_IP>:$ADMIN_PORT from .state — port open to your IP only)
  -D         public URL through the DNS name in .state (https://<record> with CloudFront, else http://<record>:$PUBLIC_PORT)
  -t TOKEN   admin JWT         (default: minted by run_stress.sh from the root .env JWT_SECRET)
  -k TOKEN   Turnstile bypass token (default .env TURNSTILE_BYPASS_TOKEN_ROBOT; EC2 does not enforce Turnstile)
  -h         this help
Every other option (-l -m -i -e -d -w -v -z -y -c -s, and anything after --) goes to run_stress.sh,
which asks on the console for the series parameters it did not get. EC2 defaults:
  levels "$DEF_LEVELS" | moves $DEF_MOVES | iterations/VU $DEF_ITERATIONS | think ${DEF_THINK_MS}ms
  max error rate $DEF_MAX_ERR | max duration $DEF_MAX_DURATION   (export DEF_* to change them)
Reports land in code/tests/stress/reports/.
Examples:
  $(basename "$0")                       # instance from .state, asks the series parameters
  $(basename "$0") -y                    # EC2 defaults, no questions
  $(basename "$0") -D -l "10 100" -cNo   # through CloudFront/DNS, keep the guests/matches for a look
USAGE
}

PASS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    -b) BASE_URL="${2:-}"; shift 2 ;;
    -a) ADMIN_BASE_URL="${2:-}"; shift 2 ;;
    -D) USE_DNS=1; shift ;;
    -t) ADMIN_TOKEN="${2:-}"; shift 2 ;;
    -k) TURNSTILE_TOKEN="${2:-}"; shift 2 ;;
    -h) usage; exit 0 ;;
    --) PASS+=("$@"); break ;;
    *)  PASS+=("$1"); shift ;;
  esac
done

need_ip() {
  [[ -n "$PUBLIC_IP" ]] && return 0
  echo "!! PUBLIC_IP missing in $STATE_FILE (start.sh did not reach the running state?) — run ./start.sh again, or pass -b and -a" >&2
  exit 2
}
if [[ -z "$BASE_URL" ]]; then
  if [[ "$USE_DNS" -eq 1 ]]; then
    if [[ -z "$ROUTE53_RECORD_NAME" ]]; then
      echo "!! -D: no ROUTE53_RECORD_NAME in $STATE_FILE — the instance has no DNS record, drop -D" >&2
      exit 2
    fi
    if [[ -n "$CLOUDFRONT_DOMAIN" ]]; then BASE_URL="https://$ROUTE53_RECORD_NAME"; else BASE_URL="http://$ROUTE53_RECORD_NAME:$PUBLIC_PORT"; fi
  else
    need_ip; BASE_URL="http://$PUBLIC_IP:$PUBLIC_PORT"
  fi
fi
if [[ -z "$ADMIN_BASE_URL" ]]; then
  need_ip; ADMIN_BASE_URL="http://$PUBLIC_IP:$ADMIN_PORT"
fi
if [[ -z "$ADMIN_TOKEN" && -z "${JWT_SECRET:-}" ]]; then
  echo "!! no admin JWT: set JWT_SECRET in $ENV_FILE (run_stress.sh mints the token with it) or pass -t TOKEN" >&2
  exit 2
fi
export JWT_SECRET="${JWT_SECRET:-}"

# Both ports must answer before k6 starts: any HTTP status is fine, 000 = no connection
probe() { local c; c="$(curl -s -o /dev/null --max-time 8 -w '%{http_code}' "$1" 2>/dev/null)"; printf '%s' "${c:-000}"; }
echo "== Instance '$INSTANCE_NAME' from .state"
echo "   public: $BASE_URL | admin: $ADMIN_BASE_URL | admin JWT: ${ADMIN_TOKEN:+given}${ADMIN_TOKEN:-minted from JWT_SECRET}"
if command -v curl >/dev/null 2>&1; then
  if [[ "$(probe "$BASE_URL/api/echo/status")" == "000" ]]; then
    echo "!! $BASE_URL does not answer: instance stopped, or the IP in .state is stale (a stop/start changes it — check the AWS console and pass -b/-a)" >&2
    exit 2
  fi
  if [[ "$(probe "$ADMIN_BASE_URL/api/admin/")" == "000" ]]; then
    echo "!! $ADMIN_BASE_URL does not answer: port $ADMIN_PORT is open only to the IP start.sh saw. If yours changed:" >&2
    echo "   aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port $ADMIN_PORT --cidr <your-ip>/32" >&2
    exit 2
  fi
fi

ARGS=(-b "$BASE_URL" -a "$ADMIN_BASE_URL")
[[ -n "$ADMIN_TOKEN" ]] && ARGS+=(-t "$ADMIN_TOKEN")
[[ -n "$TURNSTILE_TOKEN" ]] && ARGS+=(-k "$TURNSTILE_TOKEN")
exec "$STRESS_SH" "${ARGS[@]}" ${PASS[@]+"${PASS[@]}"}
