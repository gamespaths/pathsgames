#!/usr/bin/env bash
# fetch_results.sh - v1.10.0 brings one server run (default latest) home: reports-*/ into code/tests/robot/, logs into
# code/scripts/dev/run_robot_results/, a dated copy (golden JSON too) in results/<ts>/. Usage: fetch_results.sh [--run TS]
set -uo pipefail
# shellcheck source=common.sh
. "$(cd "$(dirname "$0")" && pwd)/common.sh"

RUN_TS=""
while [ $# -gt 0 ]; do
    case "$1" in
        --run) RUN_TS="${2:-}"; shift 2 ;;
        -h|--help) sed -n '2,3p' "$0"; exit 0 ;;
        *) die "unknown argument '$1' (use --run YYYYmmdd_HHMMSS)." ;;
    esac
done
validate_config
require_local_tools
ID="$(require_instance)" || exit 1
STATE="$(instance_state "$ID")"
[ "$STATE" = "running" ] || die "$ID is $STATE: start it with start.sh (the results stay on its disk)."
ssh_setup "$ID"

if [ -z "$RUN_TS" ]; then
    RUN_TS="$(rssh "basename \"\$(readlink -f '$ROBOT_EC2_RUNS_DIR/latest' 2>/dev/null)\"")" || die "cannot read the latest run."
fi
[[ "$RUN_TS" =~ ^[0-9]{8}_[0-9]{6}$ ]] || die "no run found on the server (latest: '$RUN_TS')."
REMOTE_RUN="$ROBOT_EC2_RUNS_DIR/$RUN_TS"
rssh "test -d '$REMOTE_RUN'" || die "run $RUN_TS not found on the server ($REMOTE_RUN)."
LOCAL_RES="$ROBOT_EC2_RESULTS_DIR/$RUN_TS"
mkdir -p "$LOCAL_RES"

say "Downloading run $RUN_TS into $LOCAL_RES ..."
rrsync -a "$(remote "$REMOTE_RUN/")" "$LOCAL_RES/" || die "rsync of $REMOTE_RUN failed."
# An unfinished run was never archived: take what the live tree has now.
if [ ! -d "$LOCAL_RES/reports" ]; then
    warn "run $RUN_TS is not archived (unfinished): copying the live reports, logs and golden files."
    mkdir -p "$LOCAL_RES/reports" "$LOCAL_RES/logs" "$LOCAL_RES/golden"
    rrsync -a --include='reports-*/***' --exclude='*' "$(remote "$ROBOT_EC2_REMOTE_DIR/code/tests/robot/")" "$LOCAL_RES/reports/" || true
    rrsync -a --include='*.log' --exclude='*' "$(remote "$ROBOT_EC2_REMOTE_DIR/code/scripts/dev/run_robot_results/")" "$LOCAL_RES/logs/" || true
    rrsync -a --include='export_*.json' --exclude='*' "$(remote "$ROBOT_EC2_REMOTE_DIR/$GOLDEN_REL/")" "$LOCAL_RES/golden/" || true
fi

# Golden JSON stays in results/<ts>/golden/: fixtures/golden is tracked by git and never written here.
ROBOT_DIR="$PROJECT_ROOT/code/tests/robot"
LOGS_DIR="$PROJECT_ROOT/code/scripts/dev/run_robot_results"
guard_dest() { case "$1" in *"/fixtures/golden"*) die "refusing to write into $1 (tracked golden files)." ;; esac; }
for d in "$LOCAL_RES"/reports/reports-*/; do
    [ -d "$d" ] || continue
    dest="$ROBOT_DIR/$(basename "$d")"
    guard_dest "$dest"
    rm -rf "$dest" && cp -a "${d%/}" "$dest"
done
if compgen -G "$LOCAL_RES/logs/*.log" > /dev/null; then
    guard_dest "$LOGS_DIR"
    mkdir -p "$LOGS_DIR" && rm -f "$LOGS_DIR"/*.log && cp -a "$LOCAL_RES"/logs/*.log "$LOGS_DIR/"
fi
say "Reports in $ROBOT_DIR/reports-*/, logs in $LOGS_DIR/, dated copy in $LOCAL_RES/ (golden: $LOCAL_RES/golden/)."

# Summary table of run_robot_everywhere.sh, then how many tests failed in every output.xml and in total.
sed -n '/===== Robot summary/,$p' "$LOCAL_RES/run.log" 2> /dev/null > "$LOCAL_RES/summary.txt"
if [ -s "$LOCAL_RES/summary.txt" ]; then
    cat "$LOCAL_RES/summary.txt"
else
    echo "(no run_robot_everywhere summary in $LOCAL_RES/run.log: run unfinished?)" | tee "$LOCAL_RES/summary.txt"
fi
PY="${PG_ROBOT_EC2_PYTHON:-$PROJECT_ROOT/.venv/bin/python}"
mapfile -t XMLS < <(find "$LOCAL_RES/reports" -mindepth 2 -maxdepth 2 -name output.xml 2> /dev/null | sort)
if [ "${#XMLS[@]}" -eq 0 ]; then
    echo "(no output.xml)" > "$LOCAL_RES/failed_tests.txt"
elif ! "$PY" -c "import robot.api" 2> /dev/null; then
    echo "(failed tests not counted: no robot in $PY, create the local .venv)" > "$LOCAL_RES/failed_tests.txt"
else
    "$PY" - "${XMLS[@]}" > "$LOCAL_RES/failed_tests.txt" <<'PY'
import os
import sys
from robot.api import ExecutionResult, ResultVisitor


class Failed(ResultVisitor):
    def __init__(self):
        self.count = 0

    def visit_test(self, test):
        if test.status == "FAIL":
            self.count += 1


# v1.10.0 only the counts: one line per environment and the total, no list of tests
total = 0
for path in sys.argv[1:]:
    env = os.path.basename(os.path.dirname(path))
    try:
        result = ExecutionResult(path)
    except Exception as exc:  # a truncated output.xml of an interrupted run
        print(f"{env}: cannot parse {path}: {exc}")
        continue
    visitor = Failed()
    result.visit(visitor)
    total += visitor.count
    print(f"{env}: {visitor.count} failed")
print(f"TOTAL: {total} failed")
PY
fi
echo
echo "===== Failed tests per environment (output.xml) ====="
cat "$LOCAL_RES/failed_tests.txt"
