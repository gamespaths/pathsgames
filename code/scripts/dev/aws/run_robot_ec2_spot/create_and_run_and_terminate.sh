#!/usr/bin/env bash
# create_and_run_and_terminate.sh - v1.10.0 one full cycle by hand: create (or reuse) -> run_all -> fetch -> terminate,
# then results/<ts>/report.txt. Usage: create_and_run_and_terminate.sh [--size large|xlarge|2xlarge] [--fixed-ip] [--yes]
set -uo pipefail
# shellcheck source=common.sh
. "$(cd "$(dirname "$0")" && pwd)/common.sh"

SIZE_ARGS=()
IP_ARGS=()
YES_ARGS=()
while [ $# -gt 0 ]; do
    case "$1" in
        --size) SIZE_ARGS=(--size "${2:-}"); ROBOT_EC2_SIZE="${2:-}"; shift 2 ;;
        --fixed-ip) IP_ARGS=(--fixed-ip); ROBOT_EC2_FIXED_IP=true; shift ;;
        --yes) YES_ARGS=(--yes); shift ;;
        -h|--help) sed -n '2,3p' "$0"; exit 0 ;;
        *) die "unknown argument '$1' (use --size, --fixed-ip, --yes)." ;;
    esac
done
validate_config
require_local_tools

TS="$(date +%Y%m%d_%H%M%S)"
RES="$ROBOT_EC2_RESULTS_DIR/$TS"
mkdir -p "$RES"
REUSED=no
RUN_RC=""
TERM_RC=""
phase_add() { printf '%s\t%s\n' "$1" "$2" >> "$RES/phases.txt"; }

do_terminate() {
    local t=$SECONDS
    "$PG_EC2_DIR/terminate.sh" --yes 2>&1 | tee "$RES/terminate.log"
    TERM_RC=${PIPESTATUS[0]}
    phase_add terminate $((SECONDS - t))
}

write_report() {
    local total
    total="$(awk -F'\t' '{ s += $2 } END { print s + 0 }' "$RES/phases.txt" 2> /dev/null)"
    {
        echo "Paths Games Robot run on EC2 - report $TS"
        echo "Instance: $ROBOT_EC2_NAME ($INSTANCE_TYPE, $ROBOT_EC2_MARKET) in $ROBOT_EC2_REGION, reused: $REUSED"
        echo "Run exit code: ${RUN_RC:-none} (run_all.sh: 0 green, 3 tests failed, 4 interrupted, 1 error), terminate: ${TERM_RC:-not run}"
        echo
        echo "== Summary (run_robot_everywhere) =="
        cat "$RES/summary.txt" 2> /dev/null || echo "(no summary fetched)"
        echo
        echo "== Failed tests (count) =="
        cat "$RES/failed_tests.txt" 2> /dev/null || echo "(no output.xml fetched)"
        echo
        echo "== Phase durations =="
        awk -F'\t' '{ printf "  %-10s %4dm %02ds\n", $1, $2 / 60, $2 % 60 }' "$RES/phases.txt" 2> /dev/null
        printf '  %-10s %4dm %02ds\n' total $((total / 60)) $((total % 60))
        echo
        echo "== Interruption =="
        cat "$RES/interruption.txt" 2> /dev/null || echo "none"
        echo
        echo "== Leftovers =="
        grep -h "VERIFY" "$RES/terminate.log" 2> /dev/null || echo "terminate.sh did not run"
    } > "$RES/report.txt"
    echo
    cat "$RES/report.txt"
    say "Report saved: $RES/report.txt"
}

# On any error: fetch what exists, terminate, report.
fail_cycle() {
    trap - INT
    say "ERROR during $1: fetching what exists, then terminating everything ..."
    "$PG_EC2_DIR/fetch_results.sh" --run "$TS" > /dev/null 2>&1 || warn "nothing fetched for run $TS."
    do_terminate
    write_report
    exit 1
}

on_int() {
    trap '' INT
    echo
    if ask_yes_no "Interrupted: fetch what exists and TERMINATE everything now?" n; then
        "$PG_EC2_DIR/fetch_results.sh" --run "$TS" > /dev/null 2>&1 || warn "nothing fetched for run $TS."
        do_terminate
        write_report
    else
        say "Nothing terminated: the instance stays (follow with run_all.sh --attach, clean up with terminate.sh)."
    fi
    exit 130
}
trap on_int INT

# ── create, or reuse the instance of AWS_TEST_EC2_ROBOT_NAME ──
T=$SECONDS
ID="$(find_instance)" || exit 1
if [ -n "$ID" ]; then
    REUSED=yes
    STATE="$(instance_state "$ID")"
    say "REUSING the existing instance $ID ($STATE): it WILL BE TERMINATED at the end of this cycle."
    case "$STATE" in
        running|pending)
            if [ "$STATE" = "running" ]; then
                ssh_setup "$ID"
                LOCK="$(remote_lock_status 2> /dev/null || echo unknown)"
                [ "${LOCK%% *}" = "running" ] && die "a run is in progress on $ID (${LOCK#running }): follow it with run_all.sh --attach (nothing terminated)."
            fi
            [ "${#SIZE_ARGS[@]}" -gt 0 ] && warn "$ID is $STATE: --size ignored, used as is."
            if [ "${#IP_ARGS[@]}" -gt 0 ]; then eip_ensure "$ID" || fail_cycle "Elastic IP setup"; fi
            ;;
        stopped|stopping)
            "$PG_EC2_DIR/start.sh" "${SIZE_ARGS[@]}" "${IP_ARGS[@]}" --no-wait || fail_cycle "start"
            ;;
        *) die "$ID is $STATE: cannot reuse it." ;;
    esac
    phase_add start $((SECONDS - T))
else
    "$PG_EC2_DIR/create.sh" "${SIZE_ARGS[@]}" "${IP_ARGS[@]}" || fail_cycle "create"
    phase_add create $((SECONDS - T))
fi

# ── run (bootstrap, sync, tests, fetch inside run_all.sh) ──
"$PG_EC2_DIR/run_all.sh" --ts "$TS" "${SIZE_ARGS[@]}" "${YES_ARGS[@]}"
RUN_RC=$?
case "$RUN_RC" in
    0|3|4) ;;
    *) fail_cycle "run_all.sh (exit $RUN_RC)" ;;
esac

# ── terminate and report ──
trap - INT
do_terminate
write_report
[ "$RUN_RC" = "0" ] && [ "$TERM_RC" = "0" ] && exit 0
exit 1
