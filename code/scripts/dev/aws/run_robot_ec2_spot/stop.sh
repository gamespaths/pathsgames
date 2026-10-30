#!/usr/bin/env bash
# stop.sh - v1.10.0 stops the Robot EC2 (EBS kept, a persistent spot request stays alive); refuses while a run
# is in progress unless --force. Usage: stop.sh [--force]
set -uo pipefail
# shellcheck source=common.sh
. "$(cd "$(dirname "$0")" && pwd)/common.sh"

FORCE=false
case "${1:-}" in
    --force) FORCE=true ;;
    "") ;;
    -h|--help) sed -n '2,3p' "$0"; exit 0 ;;
    *) die "unknown argument '$1' (use --force)." ;;
esac
validate_config
require_local_tools
ID="$(require_instance)" || exit 1
STATE="$(instance_state "$ID")"
case "$STATE" in
    stopped) say "$ID is already stopped."; exit 0 ;;
    stopping) ;;
    running)
        ssh_setup "$ID"
        LOCK="$(remote_lock_status 2> /dev/null || echo unknown)"
        if [ "${LOCK%% *}" = "running" ] && [ "$FORCE" != "true" ]; then
            die "a Robot run is in progress (${LOCK#* }): wait for it, follow it with run_all.sh --attach, or stop.sh --force."
        fi
        awsc "" ec2 stop-instances --instance-ids "$ID" --output text > /dev/null || die "stop-instances failed."
        ;;
    *) die "$ID is $STATE: cannot stop it." ;;
esac
say "Waiting for $ID to stop ..."
awsc "" ec2 wait instance-stopped --instance-ids "$ID" || die "wait instance-stopped failed."
say "Stopped: $ID (EBS kept; run status.sh for the cost while stopped)."
