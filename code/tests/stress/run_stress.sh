#!/usr/bin/env bash
# Runs the k6 stress scenario against a Paths Games backend for a series of
# VU levels (one k6 run per level), stopping when the error rate exceeds a threshold.
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K6_IMAGE="${K6_IMAGE:-grafana/k6:latest}"
K6_BIN="${K6_BIN:-}"

BASE_URL="${BASE_URL:-http://localhost:8042}"
ADMIN_BASE_URL="${ADMIN_BASE_URL:-http://localhost:8044}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"
JWT_SECRET="${JWT_SECRET:-}"
LEVELS="1 10 100 1000"
MOVES="${MOVES:-5}"
ITERATIONS="${ITERATIONS:-1}"
MAX_ERR="${MAX_ERROR_RATE:-0.05}"
MAX_P95_MS="${MAX_P95_MS:-2000}"
MAX_DURATION="${MAX_DURATION:-10m}"
THINK_MS="${THINK_MS:-0}"
TUTORIAL_UUID="${TUTORIAL_UUID:-story-001}"
STORY_LANG="${STORY_LANG:-en}"
TURNSTILE_TOKEN="${TURNSTILE_TOKEN:-}"
CLEANUP=0
SKIP_SETUP=0

usage() {
  cat <<EOF
Usage: $(basename "$0") [options] [-- extra k6 args]
  -b URL     public backend base URL       (default $BASE_URL)
  -a URL     admin backend base URL        (default $ADMIN_BASE_URL)
  -t TOKEN   admin JWT (default: minted from JWT_SECRET / dev secret)
  -k TOKEN   Turnstile bypass token sent as turnstileToken (env TURNSTILE_TOKEN)
  -l "N N"   VU levels run in series       (default "$LEVELS")
  -m N       movements per flow            (default $MOVES)
  -i N       iterations per VU             (default $ITERATIONS)
  -e RATE    stop series when http_req_failed > RATE (default $MAX_ERR)
  -d DUR     k6 maxDuration per level      (default $MAX_DURATION)
  -c         call POST /api/dev/cleanup after each level
  -s         skip tutorial check/import step
  -h         this help
Env: K6_BIN (local k6 binary), K6_IMAGE (docker image), JWT_SECRET, THINK_MS, MAX_P95_MS, TUTORIAL_UUID, STORY_LANG
Examples:
  $(basename "$0") -l "1 10"
  $(basename "$0") -b http://localhost:8042 -a http://localhost:8044 -l "10 100" -c
  ADMIN_TOKEN=eyJ... $(basename "$0") -b https://api-test.paths.games -a https://xxx.execute-api.us-east-2.amazonaws.com/test -k 0xROBOT_TEST_BYPASS_xxx -l "1 10"
EOF
}

while getopts "b:a:t:k:l:m:i:e:d:csh" opt; do
  case "$opt" in
    b) BASE_URL="$OPTARG" ;;
    a) ADMIN_BASE_URL="$OPTARG" ;;
    t) ADMIN_TOKEN="$OPTARG" ;;
    k) TURNSTILE_TOKEN="$OPTARG" ;;
    l) LEVELS="$OPTARG" ;;
    m) MOVES="$OPTARG" ;;
    i) ITERATIONS="$OPTARG" ;;
    e) MAX_ERR="$OPTARG" ;;
    d) MAX_DURATION="$OPTARG" ;;
    c) CLEANUP=1 ;;
    s) SKIP_SETUP=1 ;;
    h) usage; exit 0 ;;
    *) usage; exit 2 ;;
  esac
done
shift $((OPTIND - 1))
EXTRA_ARGS=("$@")

REPORTS="$DIR/reports"
mkdir -p "$REPORTS"
TS="$(date +%Y%m%d_%H%M%S)"

# Environment forwarded to the k6 scripts (__ENV)
k6_env_args() {
  local vus="$1"
  local vars=(
    "BASE_URL=$BASE_URL" "ADMIN_BASE_URL=$ADMIN_BASE_URL" "ADMIN_TOKEN=$ADMIN_TOKEN"
    "JWT_SECRET=$JWT_SECRET" "VUS=$vus" "ITERATIONS=$ITERATIONS" "MOVES=$MOVES"
    "CLEANUP=$CLEANUP" "MAX_DURATION=$MAX_DURATION" "THINK_MS=$THINK_MS"
    "TUTORIAL_UUID=$TUTORIAL_UUID" "STORY_LANG=$STORY_LANG" "TURNSTILE_TOKEN=$TURNSTILE_TOKEN"
    "MAX_ERROR_RATE=$MAX_ERR" "MAX_P95_MS=$MAX_P95_MS"
  )
  for v in "${vars[@]}"; do printf -- '-e\n%s\n' "$v"; done
}

# Runs `k6 run` locally or through docker; paths are relative to $DIR
run_k6() {
  local vus="$1"; shift
  local env_args
  mapfile -t env_args < <(k6_env_args "$vus")
  if [[ -n "$K6_BIN" ]] || command -v k6 >/dev/null 2>&1; then
    (cd "$DIR" && "${K6_BIN:-k6}" run "${env_args[@]}" "$@")
  else
    docker run --rm -i --network host --user "$(id -u):$(id -g)" \
      -v "$DIR:/scripts" -w /scripts "$K6_IMAGE" run "${env_args[@]}" "$@"
  fi
}

# Extracts one metric field from a --summary-export JSON
metric() {
  python3 - "$1" "$2" "$3" "${4:-n/a}" <<'PY'
import json, sys
path, name, field, default = sys.argv[1:5]
try:
    m = json.load(open(path))["metrics"].get(name, {})
    v = m.get(field)
    print(default if v is None else (f"{v:.4f}" if isinstance(v, float) else v))
except Exception:
    print(default)
PY
}

echo "== Paths Games stress test =="
echo "   public: $BASE_URL | admin: $ADMIN_BASE_URL"
echo "   levels: $LEVELS | moves: $MOVES | iterations/VU: $ITERATIONS | max error rate: $MAX_ERR"

if [[ "$SKIP_SETUP" -eq 0 ]]; then
  echo "== Step 0: tutorial check/import"
  if ! run_k6 1 --quiet scenarios/setup_tutorial.js; then
    echo "!! tutorial setup failed, aborting" >&2
    exit 1
  fi
fi

SUMMARY_ROWS=()
STATUS=0
for N in $LEVELS; do
  OUT="$REPORTS/summary_${N}vu_${TS}.json"
  echo
  echo "== Level: $N VU  (report: reports/$(basename "$OUT"))"
  run_k6 "$N" --summary-export "reports/$(basename "$OUT")" "${EXTRA_ARGS[@]}" scenarios/match_movement.js
  RC=$?
  ERR="$(metric "$OUT" http_req_failed value)"
  P95="$(metric "$OUT" http_req_duration 'p(95)')"
  RPS="$(metric "$OUT" http_reqs rate)"
  DONE="$(metric "$OUT" flows_completed count 0)"
  FAILED="$(metric "$OUT" flows_failed count 0)"
  SUMMARY_ROWS+=("$(printf '%6s | %8s | %10s | %8s | %6s | %6s | rc=%s' "$N" "$ERR" "$P95" "$RPS" "$DONE" "$FAILED" "$RC")")

  if [[ "$RC" -ne 0 && "$RC" -ne 99 ]]; then
    echo "!! k6 exited with code $RC at level $N, stopping" >&2
    STATUS=1; break
  fi
  if [[ "$ERR" == "n/a" ]] || python3 -c "import sys; sys.exit(0 if float('$ERR') > float('$MAX_ERR') else 1)"; then
    echo "!! error rate $ERR > $MAX_ERR at level $N, stopping series" >&2
    STATUS=1; break
  fi
done

echo
echo "== Summary (thresholds: error rate < $MAX_ERR, p95 < ${MAX_P95_MS}ms)"
printf '%6s | %8s | %10s | %8s | %6s | %6s\n' "VU" "err rate" "p95 ms" "req/s" "done" "failed"
for row in "${SUMMARY_ROWS[@]}"; do echo "$row"; done
exit $STATUS
