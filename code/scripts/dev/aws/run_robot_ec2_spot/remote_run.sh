#!/usr/bin/env bash
# remote_run.sh - v1.10.0 runs ON the Robot EC2 (user ubuntu): one run_robot_everywhere.sh --aws=all in <runs>/<ts>/
# under a lock, admin allow-list saved/restored, Lambda env backup copied. Modes: run <ts> <skip> | restore [ts] | stop
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=common.sh
. "$HERE/common.sh"

RUNS="$ROBOT_EC2_RUNS_DIR"
LOCK="$RUNS/.lock"
BACKUP_SRC="$PROJECT_ROOT/code/scripts/dev/run_robot_results/aws_special_env_backup"
GOLDEN_DIR="$PROJECT_ROOT/code/tests/robot/tests_v0/41_alpha_prep/fixtures/golden"

lock_state() { bash -c "$(lock_check_snippet)"; }

acquire_lock() {
    local st
    mkdir -p "$RUNS"
    if ! mkdir "$LOCK" 2> /dev/null; then
        st="$(lock_state)"
        case "$st" in running*) say "ERROR: a run is already in progress (${st#running }): use run_all.sh --attach."; return 1 ;; esac
        rm -rf "$LOCK"
        mkdir "$LOCK" || return 1
    fi
    echo "$1 $$ $(cat /proc/sys/kernel/random/boot_id)" > "$LOCK/info"
}
release_lock() { rm -rf "$LOCK"; }

# Something saved by run dir $1 was never put back.
needs_restore() {
    [ -d "$1" ] && [ ! -f "$1/restored" ] || return 1
    [ -f "$1/admin_allowlist.txt" ] || compgen -G "$1/lambda_env_backup/*.json" > /dev/null
}

# Copies every Lambda env backup of run_robot_with_aws_serverless_special.sh into run dir $1 (originals only).
copy_backups() {
    local f
    mkdir -p "$1/lambda_env_backup"
    for f in "$BACKUP_SRC"/*.json; do
        [ -f "$f" ] || continue
        case "$f" in *.patched.json) continue ;; esac
        [ -f "$1/lambda_env_backup/$(basename "$f")" ] || cp "$f" "$1/lambda_env_backup/"
    done
}

# Lambda env of run dir $1 put back; $2=pending only those the special script did not restore itself.
restore_lambdas() {
    local f fn rc=0
    for f in "$1"/lambda_env_backup/*.json; do
        [ -f "$f" ] || continue
        fn="$(basename "$f" .json)"
        if [ "${2:-all}" = "pending" ] && [ ! -f "$BACKUP_SRC/$fn.json" ]; then continue; fi
        if lambda_env_restore "$f"; then rm -f "$BACKUP_SRC/$fn.json" "$BACKUP_SRC/$fn.patched.json"; else rc=1; fi
    done
    return $rc
}

# Allow-list and Lambda env of run dir $1 put back, then the "restored" marker.
restore_run() {
    local rc=0
    if [ -f "$1/admin_allowlist.txt" ]; then stack_set_allowlist "$(cat "$1/admin_allowlist.txt")" || rc=1; fi
    restore_lambdas "$1" "${2:-all}" || rc=1
    [ $rc -eq 0 ] && date -Is > "$1/restored"
    return $rc
}

archive_results() {
    local d
    mkdir -p "$1/reports" "$1/logs" "$1/golden"
    for d in "$PROJECT_ROOT"/code/tests/robot/reports-*/; do [ -d "$d" ] && cp -a "${d%/}" "$1/reports/"; done
    cp -a "$PROJECT_ROOT"/code/scripts/dev/run_robot_results/*.log "$1/logs/" 2> /dev/null || true
    cp -a "$GOLDEN_DIR"/export_*.json "$1/golden/" 2> /dev/null || true
}

on_signal() {
    trap - TERM INT HUP
    echo "aborted by a signal at $(date -Is)" | tee "$RUN/aborted"
    [ -n "${WATCH_PID:-}" ] && kill "$WATCH_PID" 2> /dev/null
    copy_backups "$RUN"
    release_lock
    kill -TERM 0 2> /dev/null
    exit 143
}

mode_run() {
    local ts="$1" skip="${2:-false}" prev saved
    [[ "$ts" =~ ^[0-9]{8}_[0-9]{6}$ ]] || die "run id '$ts' must be YYYYmmdd_HHMMSS."
    acquire_lock "$ts" || exit 1
    RUN="$RUNS/$ts"
    prev="$(readlink -f "$RUNS/latest" 2> /dev/null || true)"
    if [ -d "$RUN" ]; then
        mv "$RUN" "${RUN}_interrupted_$(date +%H%M%S)"
        prev="$(ls -d "${RUN}"_interrupted_* | tail -n 1)"
    fi
    mkdir -p "$RUN/lambda_env_backup"
    ln -sfn "$ts" "$RUNS/latest"
    trap on_signal TERM INT HUP
    exec >> "$RUN/run.log" 2>&1
    echo "run $ts started $(date -Is) on $(hostname), ROBOT_SKIP_ADMIN_IP=$skip"
    date -Is > "$RUN/started_at"

    # An interrupted run left its original allow-list (kept for this run) and maybe the rate limits on.
    if [ -n "$prev" ] && [ "$prev" != "$RUN" ] && [ ! -f "$prev/exit_code" ] && needs_restore "$prev"; then
        echo "previous run $(basename "$prev") is unfinished: its saved allow-list is kept, its Lambda env restored now."
        [ -f "$prev/admin_allowlist.txt" ] && cp "$prev/admin_allowlist.txt" "$RUN/"
        restore_lambdas "$prev" all && date -Is > "$prev/restored"
    fi
    if [ ! -f "$RUN/admin_allowlist.txt" ]; then
        if saved="$(stack_get_allowlist)" && [ "$saved" != "None" ]; then
            printf '%s' "$saved" > "$RUN/admin_allowlist.txt"
            echo "admin allow-list saved: '$saved'"
        else
            warn "could not read the admin allow-list of $ROBOT_EC2_STACK: it will not be restored."
        fi
    fi

    (while sleep 5; do copy_backups "$RUN"; done) &
    WATCH_PID=$!
    rm -rf "$PROJECT_ROOT"/code/tests/robot/reports-*/
    bash "$HERE/bootstrap.sh" --venv-only --user "$(id -un)" --remote-dir "$PROJECT_ROOT" || warn "robot venv not ready."
    export ROBOT_SKIP_ADMIN_IP="$skip"
    # start_local.sh defaults to x86_64 Lambda images: native arm64 here.
    if [ "$(uname -m)" = "aarch64" ]; then export AWS_LOCAL_ARCH="${AWS_LOCAL_ARCH:-arm64}"; fi
    cd "$PROJECT_ROOT" || exit 1
    bash code/scripts/dev/run_robot_everywhere.sh --aws=all
    local rc=$?

    kill "$WATCH_PID" 2> /dev/null
    copy_backups "$RUN"
    restore_run "$RUN" pending || warn "restore incomplete: terminate.sh retries it."
    archive_results "$RUN"
    echo "$rc" > "$RUN/exit_code"
    date -Is > "$RUN/finished_at"
    echo "run $ts finished $(date -Is), exit code $rc"
    release_lock
}

mode_stop() {
    local st pid i
    st="$(lock_state)"
    [ "${st%% *}" = "running" ] || { echo "no run in progress ($st)."; return 0; }
    read -r _ pid _ < "$LOCK/info"
    echo "stopping run ${st#running } (pid $pid) ..."
    kill -TERM -- "-$pid" 2> /dev/null || kill -TERM "$pid" 2> /dev/null
    for i in $(seq 1 60); do [ -d "$LOCK" ] || break; sleep 1; done
    [ "${i:-0}" -lt 60 ] || warn "the run did not stop within 60s."
}

mode_restore() {
    local d
    if [ -n "${1:-}" ]; then d="$RUNS/$1"; else d="$(readlink -f "$RUNS/latest" 2> /dev/null || true)"; fi
    [ -n "$d" ] && [ -d "$d" ] || { echo "no run to restore."; return 0; }
    [ "$(lock_state | cut -d' ' -f1)" = "running" ] && die "a run is in progress: remote_run.sh stop first."
    if needs_restore "$d"; then
        echo "restoring what run $(basename "$d") saved ..."
        restore_run "$d" all
    else
        echo "run $(basename "$d"): nothing to restore."
    fi
}

case "${1:-}" in
    run) shift; mode_run "$@" ;;
    stop) mode_stop ;;
    restore) shift; mode_restore "$@" ;;
    *) echo "Usage: remote_run.sh run <YYYYmmdd_HHMMSS> <true|false> | restore [ts] | stop" >&2; exit 2 ;;
esac
