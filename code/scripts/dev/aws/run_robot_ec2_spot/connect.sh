#!/usr/bin/env bash
# connect.sh - v1.10.0 interactive shell on the Robot EC2 over SSH-over-SSM (no open port, any local IP).
# Usage: connect.sh [command ...]   (with a command it runs it instead of the shell)
set -uo pipefail
# shellcheck source=common.sh
. "$(cd "$(dirname "$0")" && pwd)/common.sh"

validate_config
require_local_tools
ID="$(require_instance)" || exit 1
STATE="$(instance_state "$ID")"
[ "$STATE" = "running" ] || die "$ID is $STATE: start it first with start.sh."
ssh_setup "$ID"
if [ $# -gt 0 ]; then
    rssh "$@"
else
    ssh -t -F "$SSH_CFG" "$SSH_HOST_ALIAS"
fi
