#!/usr/bin/env bash
# start.sh - v1.10.0 starts the stopped Robot EC2 (capacity retries), optionally changing its size while stopped
# and adding the Elastic IP, then waits until it is ready. Usage: start.sh [--size S] [--fixed-ip] [--no-wait]
set -uo pipefail
# shellcheck source=common.sh
. "$(cd "$(dirname "$0")" && pwd)/common.sh"

NEW_SIZE=""
NO_WAIT=false
while [ $# -gt 0 ]; do
    case "$1" in
        --size) NEW_SIZE="${2:-}"; shift 2 ;;
        --fixed-ip) ROBOT_EC2_FIXED_IP=true; shift ;;
        --no-wait) NO_WAIT=true; shift ;;
        -h|--help) sed -n '2,3p' "$0"; exit 0 ;;
        *) die "unknown argument '$1' (use --size large|xlarge|2xlarge, --fixed-ip, --no-wait)." ;;
    esac
done
[ -n "$NEW_SIZE" ] && ROBOT_EC2_SIZE="$NEW_SIZE"
validate_config
require_local_tools
ID="$(require_instance)" || exit 1
STATE="$(instance_state "$ID")"

if [ "$STATE" = "stopping" ]; then
    say "$ID is stopping: waiting for stopped ..."
    awsc "" ec2 wait instance-stopped --instance-ids "$ID" || die "wait instance-stopped failed."
    STATE=stopped
fi
case "$STATE" in
    stopped)
        CURRENT_TYPE="$(instance_field "$ID" "" InstanceType)"
        if [ -n "$NEW_SIZE" ] && [ "$CURRENT_TYPE" != "$INSTANCE_TYPE" ]; then
            say "Changing $ID from $CURRENT_TYPE to $INSTANCE_TYPE (stopped) ..."
            awsc "" ec2 modify-instance-attribute --instance-id "$ID" --instance-type "Value=$INSTANCE_TYPE" \
                || die "modify-instance-attribute failed (a spot instance may refuse a type change: terminate.sh + create.sh --size $ROBOT_EC2_SIZE)."
        fi
        instance_start_with_retry "$ID" || exit 1
        ;;
    pending|running)
        [ -n "$NEW_SIZE" ] && [ "$(instance_field "$ID" "" InstanceType)" != "$INSTANCE_TYPE" ] \
            && warn "$ID is $STATE: --size ignored (stop.sh first to change the type)."
        say "$ID is already $STATE."
        ;;
    *) die "$ID is $STATE: cannot start it." ;;
esac

if [ "$ROBOT_EC2_FIXED_IP" = "true" ]; then
    wait_until "$ROBOT_EC2_WAIT_TIMEOUT" 5 "instance $ID state running" _is_running "$ID" || exit 1
    eip_ensure "$ID" || die "Elastic IP setup failed."
fi
[ "$NO_WAIT" = "true" ] && exit 0
wait_ready "$ID" || exit 1
say "Running: $ID, public IP $(instance_public_ip "$ID")."
