#!/usr/bin/env bash
# Execute all robot tests against a local server (http://localhost:8042).
# Start Node.js backend via docker-compose.

set -euo pipefail

# Load .env from repository root if present
PROJECT_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
	# shellcheck disable=SC1090
	. "$ENV_FILE"
fi

# If not present in .env, ROBOT_VAR_ADMIN_TOKEN must be set in the environment before running the script
if [ -z "${ROBOT_VAR_ADMIN_TOKEN:-}" ]; then
	echo "Error: ROBOT_VAR_ADMIN_TOKEN must be set in the environment or .env file."
	exit 1
fi

echo "Kill all processes using 8042 and 8044 ports"
fuser -k 8042/tcp || true
fuser -k 8044/tcp || true

cd "$PROJECT_ROOT" && \
python3 -m venv .venv && \
source .venv/bin/activate

# Function to terminate docker-compose in case of error
cleanup() {
    echo "-------------- Cleanup"
	echo "Stopping docker-compose"
    cd "$PROJECT_ROOT/code/backend/node" && docker-compose down || true
    echo "Kill all processes using 8042 and 8044 ports"
    fuser -k 8042/tcp || true
    fuser -k 8044/tcp || true
}
trap cleanup EXIT

# Start docker-compose (postgres + app + nginx) — always start from a clean volume.
# --build forces a fresh image so the container always runs the current schema/seed/dist
# (otherwise a stale image from a previous run is reused and the seed silently fails).
echo "Starting docker-compose in $PROJECT_ROOT/code/backend/node"
cd "$PROJECT_ROOT/code/backend/node" && docker-compose down --volumes --remove-orphans 2>/dev/null || true
cd "$PROJECT_ROOT/code/backend/node" && docker-compose build --no-cache app
cd "$PROJECT_ROOT/code/backend/node" && docker-compose up -d

# Wait for containers to be healthy
echo "Waiting for services to start..."
sleep 20

# Verify public server (8042) is running
echo "Checking public server..."
RETRIES=20
while [ $RETRIES -gt 0 ]; do
    PUBLIC_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8042/api/echo/status || echo 000)
    if [ "$PUBLIC_CODE" == "200" ]; then
        echo "✓ Public server (8042) is ready"
        break
    fi
    echo "  Public server not ready (HTTP $PUBLIC_CODE), retrying... ($RETRIES left)"
    RETRIES=$((RETRIES - 1))
    sleep 3
done

if [ "$RETRIES" -eq 0 ]; then
    echo "✗ Public server (8042) failed to start"
    cleanup
    # Stop docker-compose before exiting if we fail to start
    exit 1
fi

# Verify admin server (8044) is running
echo "Checking admin server..."
RETRIES=20
while [ $RETRIES -gt 0 ]; do
    ADMIN_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8044/api/echo/status || echo 000)
    if [ "$ADMIN_CODE" == "200" ]; then
        echo "✓ Admin server (8044) is ready"
        break
    fi
    echo "  Admin server not ready (HTTP $ADMIN_CODE), retrying... ($RETRIES left)"
    RETRIES=$((RETRIES - 1))
    sleep 3
done

if [ "$RETRIES" -eq 0 ]; then
    echo "✗ Admin server (8044) failed to start"
    exit 1
fi

# Run Robot tests
cd "$PROJECT_ROOT/code/tests/robot" && pip install -r requirements.txt
ROBOT_EXIT=0
ROBOT_VAR_ADMIN_TOKEN="${ROBOT_VAR_ADMIN_TOKEN:-}" robot --variablefile variables/dev.yaml --outputdir reports-local-node/ tests/ || ROBOT_EXIT=$?

# Remove the rows created by this Robot run (guests + matches tagged "robottest"),
# preserving every other row. Runs whether the tests passed or failed.
echo "Cleaning up robot test data via POST /api/dev/cleanup ..."
curl -s -X POST http://localhost:8044/api/dev/cleanup || echo "  cleanup request failed"
echo

# Stop and remove docker containers
echo "Stopping docker-compose..."
cd "$PROJECT_ROOT/code/backend/node" && docker-compose down

exit $ROBOT_EXIT
