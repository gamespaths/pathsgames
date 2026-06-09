#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# run_all_tests.sh — run every UNIT-test suite in the repo and report a single
# aggregate: how many tests ran in total and how many failed.
#
# This runs UNIT tests only (NOT the Robot E2E suites).
#
# Suites covered:
#   Backend unit:
#     - java         mvn test            (surefire reports, all modules)
#     - python       pytest              (code/backend/python, .venv)
#     - php          phpunit             (code/backend/php -> build/logs/junit.xml)
#     - aws          pytest              (code/backend/aws, .venv)
#     - node         jest                (code/backend/node)
#   Frontend unit (vitest):
#     - react-admin  code/frontend/react-admin
#     - react-game   code/frontend/react-game
#
# Usage:
#   code/scripts/dev/run_all_tests.sh
#   code/scripts/dev/run_all_tests.sh --only java,python
#
# Exit code: 0 only if every suite ran and zero tests failed.
# ---------------------------------------------------------------------------

# No `set -e`: keep going past a failing suite so the aggregate covers them all.
set -uo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
JAVA_DIR="$PROJECT_ROOT/code/backend/java"
PY_DIR="$PROJECT_ROOT/code/backend/python"
PHP_DIR="$PROJECT_ROOT/code/backend/php"
AWS_DIR="$PROJECT_ROOT/code/backend/aws"
NODE_DIR="$PROJECT_ROOT/code/backend/node"
RESULTS_DIR="$PROJECT_ROOT/code/scripts/dev/run_robot_results"
TS="$(date +%Y%m%d_%H%M%S)"
mkdir -p "$RESULTS_DIR"

# Clear previous unit-test logs (UNIT*) from the destination folder before the run.
rm -f "$RESULTS_DIR"/UNIT* 2>/dev/null || true

ONLY=""
for arg in "$@"; do
	case "$arg" in
		--only=*) ONLY="${arg#--only=}" ;;
		--only)   shift; ONLY="${1:-}" ;;
		-h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
	esac
done

want() { # run suite $1?
	[ -z "$ONLY" ] && return 0
	case ",$ONLY," in *",$1,"*) return 0 ;; *) return 1 ;; esac
}

NAMES=()
declare -A R_TOTAL R_FAIL R_STATUS
GRAND_TOTAL=0; GRAND_FAIL=0

record() { # name total fail status
	NAMES+=("$1"); R_TOTAL[$1]=$2; R_FAIL[$1]=$3; R_STATUS[$1]=$4
	GRAND_TOTAL=$((GRAND_TOTAL + $2)); GRAND_FAIL=$((GRAND_FAIL + $3))
}

# parse_junit "<glob>" -> "total fail" ; sums every <testsuite> across files.
parse_junit() {
	python3 - "$@" <<'PY'
import sys, glob, xml.etree.ElementTree as ET
tot = fail = 0
files = []
for pat in sys.argv[1:]:
    files += glob.glob(pat)
for fn in files:
    try:
        root = ET.parse(fn).getroot()
        suites = [root] if root.tag == 'testsuite' else root.iter('testsuite')
        for ts in suites:
            tot += int(ts.get('tests') or 0)
            fail += int(ts.get('failures') or 0) + int(ts.get('errors') or 0)
    except Exception:
        pass
print(tot, fail)
PY
}

# parse_jest_json <file> -> "total fail"
parse_jest_json() {
	python3 - "$1" <<'PY'
import sys, json
try:
    d = json.load(open(sys.argv[1]))
    print(d.get("numTotalTests", 0), d.get("numFailedTests", 0))
except Exception:
    print("0 0")
PY
}

finish() { # name rc total fail
	local name="$1" rc="$2" total="$3" fail="$4" status="OK"
	if [ "$rc" -ne 0 ] && [ "$total" -eq 0 ]; then status="ERROR(rc=$rc)"
	elif [ "$fail" -gt 0 ]; then status="FAIL"; fi
	printf '   %-12s tests=%s fail=%s  [%s]\n' "$name" "$total" "$fail" "$status"
	record "$name" "$total" "$fail" "$status"
}

banner() { echo "================================================================"; echo ">> $1"; echo "================================================================"; }

# ---- suites --------------------------------------------------------------
run_java() {
	want java || return 0
	local log="$RESULTS_DIR/UNIT_java_${TS}.log"
	banner "java unit (mvn test)   log: $log"
	( cd "$JAVA_DIR" && mvn -q clean test ) >"$log" 2>&1
	local rc=$?
	read -r t f < <(parse_junit "$JAVA_DIR"/*/target/surefire-reports/TEST-*.xml)
	finish java "$rc" "$t" "$f"
}

run_python() {
	want python || return 0
	local log="$RESULTS_DIR/UNIT_python_${TS}.log"
	local xml="$PY_DIR/.unit-junit.xml"
	banner "python unit (pytest)   log: $log"
	(
		cd "$PY_DIR" && source .venv/bin/activate \
			&& pytest tests --junitxml="$xml"
	) >"$log" 2>&1
	local rc=$?
	read -r t f < <(parse_junit "$xml")
	finish python "$rc" "$t" "$f"
}

run_php() {
	want php || return 0
	local log="$RESULTS_DIR/UNIT_php_${TS}.log"
	local xml="$PHP_DIR/build/logs/junit.xml"
	banner "php unit (phpunit)     log: $log"
	( cd "$PHP_DIR" && vendor/bin/phpunit tests ) >"$log" 2>&1
	local rc=$?
	read -r t f < <(parse_junit "$xml")
	finish php "$rc" "$t" "$f"
}

run_aws() {
	want aws || return 0
	local log="$RESULTS_DIR/UNIT_aws_${TS}.log"
	local xml="$AWS_DIR/.unit-junit.xml"
	banner "aws unit (pytest)      log: $log"
	(
		cd "$AWS_DIR" && source .venv/bin/activate 2>/dev/null \
			&& pytest tests --junitxml="$xml"
	) >"$log" 2>&1
	local rc=$?
	read -r t f < <(parse_junit "$xml")
	finish aws "$rc" "$t" "$f"
}

run_node() {
	want node || return 0
	local log="$RESULTS_DIR/UNIT_node_${TS}.log"
	local json="$NODE_DIR/.jest-out.json"
	banner "node unit (jest)       log: $log"
	( cd "$NODE_DIR" && npx jest --json --outputFile="$json" ) >"$log" 2>&1
	local rc=$?
	read -r t f < <(parse_jest_json "$json")
	finish node "$rc" "$t" "$f"
}

run_frontend() { # name dir
	local name="$1" dir="$PROJECT_ROOT/$2"
	want "$name" || return 0
	[ -d "$dir" ] || { echo ">> skip $name (missing $2)"; return 0; }
	local log="$RESULTS_DIR/UNIT_${name}_${TS}.log"
	local xml="$dir/test-results.junit.xml"
	banner "$name unit (vitest)   log: $log"
	(
		cd "$dir" && { [ -d node_modules ] || npm install; } \
			&& npm run test -- --reporter=junit --outputFile="$xml"
	) >"$log" 2>&1
	local rc=$?
	read -r t f < <(parse_junit "$xml")
	finish "$name" "$rc" "$t" "$f"
}

# ---- run -----------------------------------------------------------------
echo "PathsGames — run_all_tests (UNIT)  ($TS)"
[ -n "$ONLY" ] && echo "Filter --only: $ONLY"

run_java
run_python
run_php
run_aws
#run_node
run_frontend react-admin code/frontend/react-admin
run_frontend react-game  code/frontend/react-game

# ---- summary -------------------------------------------------------------
echo ""
echo "================================================================"
echo " SUMMARY (unit tests)"
echo "================================================================"
printf ' %-14s %8s %8s   %s\n' "SUITE" "TESTS" "FAIL" "STATUS"
printf ' %-14s %8s %8s   %s\n' "--------------" "-----" "----" "------"
for n in "${NAMES[@]}"; do
	printf ' %-14s %8s %8s   %s\n' "$n" "${R_TOTAL[$n]}" "${R_FAIL[$n]}" "${R_STATUS[$n]}"
done
printf ' %-14s %8s %8s\n' "--------------" "-----" "----"
printf ' %-14s %8s %8s\n' "TOTAL" "$GRAND_TOTAL" "$GRAND_FAIL"
echo ""
echo " $GRAND_TOTAL tests , $GRAND_FAIL failed."

[ "$GRAND_FAIL" -eq 0 ] && exit 0 || exit 1
