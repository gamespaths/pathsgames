
#!/usr/bin/env bash
# execute all robot tests against a local server (http://localhost:8042).
# execute java server locally

set -euo pipefail

# Load .env from repository root if present
PROJECT_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
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

# start local server
java -jar "$PROJECT_ROOT/code/backend/java/ms-launcher/target/ms-launcher-"*-SNAPSHOT.jar &
SERVER_PID=$!

sleep 30 # wait for the server to start
curl -s http://localhost:8042/api/echo/status > /dev/null || { echo "Server not started correctly"; kill $SERVER_PID; exit 1; }

# run Robot tests. If ROBOT_VAR_ADMIN_TOKEN is set in .env, it will be exported by the sourced file.
cd "$PROJECT_ROOT/code/tests/robot" && \
ROBOT_VAR_ADMIN_TOKEN="${ROBOT_VAR_ADMIN_TOKEN:-}" robot --variablefile variables/dev.yaml --outputdir reports-local-java/ tests/

# stop local server
kill $SERVER_PID || true

echo "Test Robot completed. Report available in $PROJECT_ROOT/code/tests/robot/reports-local-java/"
