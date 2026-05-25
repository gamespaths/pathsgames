#!/usr/bin/env bash
# execute all robot tests against a local server (http://localhost:8042).
# execute python server locally

set -euo pipefail

# Load .env from repository root if present
PROJECT_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
	# shellcheck disable=SC1090
	. "$ENV_FILE"
fi

# Override Turnstile key to empty so local Python server uses dev bypass (empty secret_key)
export TURNSTILE_SECRET_KEY=""

# If not present in .env, ROBOT_VAR_ADMIN_TOKEN must be set in the environment before running the script
if [ -z "${ROBOT_VAR_ADMIN_TOKEN:-}" ]; then
	echo "Error: ROBOT_VAR_ADMIN_TOKEN must be set in the environment or .env file."
	exit 1
fi

echo "Kill all process using 8042 port"
fuser -k 8042/tcp || true   

echo "Remove database.sqlite"
rm "$PROJECT_ROOT/code/backend/python/database.sqlite" || true

# Setup venv and install dependencies BEFORE starting the server
cd "$PROJECT_ROOT/code/backend/python"
python3 -m venv .venv
.venv/bin/pip install -q -r requirements.txt

echo "Execute script to seed stories in database"
.venv/bin/python scripts/seed_stories.py

# start local server
.venv/bin/python -m app.launcher &
SERVER_PID=$!

# Function to terminate the application in case of error
cleanup() {
    echo "-------------- Cleanup"
	echo "Stopping the server"
    kill $SERVER_PID || true
}
trap cleanup EXIT

echo "Starting local Python server with PID $SERVER_PID..."

sleep 10 # wait for the server to start
curl -s http://localhost:8042/api/echo/status > /dev/null || {
	echo "Server not started correctly"	
	kill $SERVER_PID
	exit 1
}	

# run Robot tests. If ROBOT_VAR_ADMIN_TOKEN is set in .env, it will be exported by the sourced file.
echo "Running Robot tests!"

cd "$PROJECT_ROOT" && python3 -m venv .venv

cd "$PROJECT_ROOT/code/tests/robot" && "$PROJECT_ROOT/.venv/bin/pip" install -q -r requirements.txt
ROBOT_EXIT=0
ROBOT_VAR_ADMIN_TOKEN="${ROBOT_VAR_ADMIN_TOKEN:-}" "$PROJECT_ROOT/.venv/bin/robot" --variablefile variables/dev.yaml --outputdir reports-local-python/ tests/ || ROBOT_EXIT=$?

# Remove the rows created by this Robot run (guests + matches tagged "robottest"),
# preserving every other row. Runs whether the tests passed or failed.
echo "Cleaning up robot test data via POST /api/dev/cleanup ..."
curl -s -X POST http://localhost:8042/api/dev/cleanup || echo "  cleanup request failed"
echo

# stop local server
kill $SERVER_PID || true
echo "Kill all process using 8042 port"
fuser -k 8042/tcp || true


echo "Test Robot completed. Report available in $PROJECT_ROOT/code/tests/robot/reports-local-python/"
exit $ROBOT_EXIT

