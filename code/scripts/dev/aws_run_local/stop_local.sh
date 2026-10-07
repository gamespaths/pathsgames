#!/usr/bin/env bash
# stop_local.sh - v0.41.4 stops the local AWS backend of start_local.sh: both sam local processes, every
# container on the pathsgames-aws-local network (Lambda and DynamoDB Local) with its volumes, the network.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$HERE/logs"
NETWORK="pathsgames-aws-local"

for name in public admin; do
    pidfile="$LOG_DIR/sam-$name.pid"
    [ -f "$pidfile" ] || continue
    pid="$(cat "$pidfile")"
    if kill -0 "$pid" 2> /dev/null; then
        # SIGINT lets sam stop its warm Lambda containers itself.
        kill -INT "$pid" 2> /dev/null
        for _ in $(seq 1 20); do kill -0 "$pid" 2> /dev/null || break; sleep 1; done
        kill -9 "$pid" 2> /dev/null || true
    fi
    rm -f "$pidfile"
done

containers="$(docker ps -aq --filter "network=$NETWORK")"
if [ -n "$containers" ]; then
    # shellcheck disable=SC2086
    docker rm -f -v $containers > /dev/null
fi
docker network rm "$NETWORK" > /dev/null 2>&1 || true
echo "Local AWS backend stopped: sam processes, containers, volumes and network removed."
