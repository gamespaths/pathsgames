#!/usr/bin/env bash
# run_all.sh - v1.10.0 one full Robot run on the EC2: start if stopped, wait ready, bootstrap, sync, then
# run_robot_everywhere.sh --aws=all in background on the server, polled from here, results fetched at the end.
set -uo pipefail
# shellcheck source=common.sh
. "$(cd "$(dirname "$0")" && pwd)/common.sh"

usage() { echo "Usage: run_all.sh [--attach] [--size large|xlarge|2xlarge] [--yes]   (exit 0 green, 3 tests failed, 4 interrupted, 1 error)"; }
ATTACH=false
NEW_SIZE=""
ASSUME_YES=false
TS=""
RERUN=0
while [ $# -gt 0 ]; do
    case "$1" in
        --attach) ATTACH=true; shift ;;
        --size) NEW_SIZE="${2:-}"; shift 2 ;;
        --yes) ASSUME_YES=true; shift ;;
        --ts) TS="${2:-}"; shift 2 ;;
        --rerun) RERUN="${2:-0}"; shift 2 ;;
        -h|--help) usage; exit 0 ;;
        *) usage >&2; die "unknown argument '$1'." ;;
    esac
done
[ -n "$NEW_SIZE" ] && ROBOT_EC2_SIZE="$NEW_SIZE"
validate_config
require_local_tools
[ -n "$TS" ] || TS="$(date +%Y%m%d_%H%M%S)"
[[ "$TS" =~ ^[0-9]{8}_[0-9]{6}$ ]] || die "--ts must be YYYYmmdd_HHMMSS."

PHASE_T0=$SECONDS
# Records the duration of the phase that just ended in results/<ts>/phases.txt.
phase_done() {
    mkdir -p "$ROBOT_EC2_RESULTS_DIR/$TS"
    printf '%s\t%s\n' "$1" "$((SECONDS - PHASE_T0))" >> "$ROBOT_EC2_RESULTS_DIR/$TS/phases.txt"
    PHASE_T0=$SECONDS
}

ID="$(require_instance)" || exit 1
STATE="$(instance_state "$ID")"
if [ "$STATE" != "running" ]; then
    say "$ID is $STATE: starting it ..."
    "$PG_EC2_DIR/start.sh" ${NEW_SIZE:+--size "$NEW_SIZE"} --no-wait || exit 1
fi
wait_ready "$ID" || exit 1
ssh_setup "$ID"

# One run at a time: checked before bootstrap and sync, which would change the tree under a running run.
LOCK="$(remote_lock_status)" || die "cannot read the run lock on the server."
if [ "${LOCK%% *}" = "running" ]; then
    [ "$ATTACH" = "true" ] || die "a run is in progress on the server (${LOCK#running }): follow it with run_all.sh --attach."
    TS="${LOCK#running }"
    say "Attaching to the run $TS in progress."
elif [ "$ATTACH" = "true" ]; then
    LATEST="$(rssh "basename \"\$(readlink -f '$ROBOT_EC2_RUNS_DIR/latest' 2>/dev/null)\"" 2> /dev/null || true)"
    if [ -n "$LATEST" ] && rssh "test -f '$ROBOT_EC2_RUNS_DIR/$LATEST/exit_code'" 2> /dev/null; then
        say "No run in progress: the latest run $LATEST is finished, fetching it."
        exec "$PG_EC2_DIR/fetch_results.sh" --run "$LATEST"
    fi
    die "no run in progress (latest: ${LATEST:-none}, unfinished or missing): run_all.sh starts a new one."
fi
[ "$ATTACH" = "true" ] || phase_done start

if [ "$ATTACH" != "true" ]; then
    run_bootstrap || exit 1
    phase_done bootstrap
    say "Syncing the working tree to $ROBOT_EC2_REMOTE_DIR ..."
    sync_tree || exit 1
    phase_done sync

    PUBLIC_IP="$(instance_public_ip "$ID")"
    SKIP_ADMIN_IP="$(skip_admin_ip_for "$PUBLIC_IP")"
    if [ "$SKIP_ADMIN_IP" = "true" ]; then
        say "Server IP $PUBLIC_IP is in ADMIN_IP_WHITELIST: ROBOT_SKIP_ADMIN_IP=true (stack allow-list untouched)."
    else
        say "Server IP $PUBLIC_IP is not in ADMIN_IP_WHITELIST: the runners add it with aws_set_admin_ip.sh (restored after the run)."
    fi
    say "Launching run $TS on the server ..."
    rssh "mkdir -p '$ROBOT_EC2_RUNS_DIR' && setsid nohup bash '$REMOTE_TOOL_DIR/remote_run.sh' run '$TS' '$SKIP_ADMIN_IP' > /dev/null 2>&1 < /dev/null &"
    LAUNCH_RC=$?
    # v1.10.0 an SSM session can close with an error after the launch: the started_at marker decides
    [ "$LAUNCH_RC" -eq 0 ] || warn "ssh exited with $LAUNCH_RC while launching run $TS: checking whether it started anyway ..."
    started() { rssh "test -f '$ROBOT_EC2_RUNS_DIR/$TS/started_at'" 2> /dev/null; }
    wait_until 60 3 "run $TS to start on the server (see $ROBOT_EC2_RUNS_DIR/$TS/run.log via connect.sh)" started || exit 1
fi

LOCAL_RES="$ROBOT_EC2_RESULTS_DIR/$TS"
mkdir -p "$LOCAL_RES/lambda_env_backup"
REMOTE_RUN="$ROBOT_EC2_RUNS_DIR/$TS"

poll_snippet() {
    cat <<EOF
d='$REMOTE_RUN'
if [ -f "\$d/exit_code" ]; then echo "EXIT \$(cat "\$d/exit_code")"; else echo "EXIT -"; fi
echo "CURRENT \$(grep -o '======== Running [^ ]*' "\$d/run.log" 2>/dev/null | tail -n 1 | cut -d' ' -f3)"
echo "STARTED \$(grep -c '======== Running' "\$d/run.log" 2>/dev/null)"
echo "BACKUPS \$(ls "\$d"/lambda_env_backup/*.json 2>/dev/null | wc -l)"
echo "ALLOW \$(test -f "\$d/admin_allowlist.txt" && echo 1 || echo 0)"
printf 'LOCK '
$(lock_check_snippet)
EOF
}

# The instance stopped under a run with no exit code: precise reason, then restart+rerun or exit 4.
handle_stopped() {
    local state="$1" code msg reason
    code="$(instance_field "$ID" "" StateReason.Code)"
    msg="$(instance_field "$ID" "" StateReason.Message)"
    reason="$(state_reason_message "$code" "$msg")"
    say "The instance became $state while run $TS had no exit code: $reason"
    printf '%s %s\n' "$(date -Is)" "$reason" >> "$LOCAL_RES/interruption.txt"
    if [ "$RERUN" -lt 2 ] && { [ "$ASSUME_YES" = "true" ] || ask_yes_no "Restart the instance and rerun the suites now?" n; }; then
        [ "$state" = "stopping" ] && awsc "" ec2 wait instance-stopped --instance-ids "$ID"
        local args=(--ts "$TS" --rerun "$((RERUN + 1))")
        [ "$ASSUME_YES" = "true" ] && args+=(--yes)
        [ -n "$NEW_SIZE" ] && args+=(--size "$NEW_SIZE")
        exec "$PG_EC2_DIR/run_all.sh" "${args[@]}"
    fi
    say "Left as is. Later: run_all.sh restarts and reruns; terminate.sh restores the test stack if the run left it changed."
    exit 4
}

say "Polling run $TS every ${ROBOT_EC2_POLL_SECONDS}s (Ctrl-C stops the polling only: run_all.sh --attach resumes it) ..."
FAILS=0
SEEN_BACKUPS=0
GOT_ALLOW=0
RUN_RC=""
while :; do
    STATE="$(instance_state "$ID")"
    case "$STATE" in
        running) ;;
        ""|pending) warn "instance state '${STATE:-unreadable}': retrying at the next poll."; sleep "$ROBOT_EC2_POLL_SECONDS"; continue ;;
        *) handle_stopped "$STATE" ;;
    esac
    if ! OUT="$(rssh "bash -s" <<< "$(poll_snippet)" 2> /dev/null)"; then
        FAILS=$((FAILS + 1))
        [ "$FAILS" -ge 5 ] && warn "server unreachable for $FAILS polls in a row (instance $STATE)."
        sleep "$ROBOT_EC2_POLL_SECONDS"
        continue
    fi
    FAILS=0
    EXIT="$(sed -n 's/^EXIT //p' <<< "$OUT")"
    CURRENT="$(sed -n 's/^CURRENT //p' <<< "$OUT")"
    STARTED="$(sed -n 's/^STARTED //p' <<< "$OUT")"
    BACKUPS="$(sed -n 's/^BACKUPS //p' <<< "$OUT")"
    ALLOW="$(sed -n 's/^ALLOW //p' <<< "$OUT")"
    RLOCK="$(sed -n 's/^LOCK //p' <<< "$OUT")"
    if [ "${ALLOW:-0}" = "1" ] && [ "$GOT_ALLOW" = "0" ]; then
        rrsync -a "$(remote "$REMOTE_RUN/admin_allowlist.txt")" "$LOCAL_RES/" > /dev/null 2>&1 && GOT_ALLOW=1
    fi
    if [ "${BACKUPS:-0}" -gt "$SEEN_BACKUPS" ]; then
        if rrsync -a "$(remote "$REMOTE_RUN/lambda_env_backup/")" "$LOCAL_RES/lambda_env_backup/" > /dev/null 2>&1; then
            SEEN_BACKUPS="$BACKUPS"
            say "Lambda env backup downloaded to $LOCAL_RES/lambda_env_backup/ (terminate.sh can restore it)."
        fi
    fi
    if [ "${EXIT:--}" != "-" ]; then RUN_RC="$EXIT"; break; fi
    if [ "${RLOCK%% *}" != "running" ]; then
        say "ERROR: the run stopped on the server without an exit code (lock: $RLOCK). See $REMOTE_RUN/run.log (connect.sh)."
        say "  Last StateReason of $ID: $(state_reason_message "$(instance_field "$ID" "" StateReason.Code)" "$(instance_field "$ID" "" StateReason.Message)")"
        "$PG_EC2_DIR/fetch_results.sh" --run "$TS" || true
        exit 1
    fi
    printf '[%s] %s: run %s, environment %s (%s started), %dm elapsed\n' "$(date +%H:%M)" "$PG_SCRIPT" "$TS" \
        "${CURRENT:-starting}" "${STARTED:-0}" $(( (SECONDS - PHASE_T0) / 60 )) >&2
    sleep "$ROBOT_EC2_POLL_SECONDS"
done
phase_done tests

say "Run $TS finished with exit code $RUN_RC: fetching the results ..."
"$PG_EC2_DIR/fetch_results.sh" --run "$TS" || warn "fetch_results.sh failed: rerun it by hand (fetch_results.sh --run $TS)."
phase_done fetch
[ "$RUN_RC" = "0" ] && exit 0
exit 3
