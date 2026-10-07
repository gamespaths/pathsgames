
#!/usr/bin/env bash
# execute all robot tests against a local server (http://localhost:8042).
# execute java server locally

set -euo pipefail

# Load .env from repository root if present
PROJECT_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
	# shellcheck disable=SC1090
	. "$ENV_FILE"
fi

# v0.41.0 — server and JwtHelper.py sign with the .env secret; Robot always runs with the limits off.
if [ -n "${JWT_SECRET:-}" ]; then export JWT_SECRET; fi
# v0.41.4 - ROBOT_RATE_LIMITS=1 (run_robot_everywhere *_LIMITED): limits on, only the rate-limit tests.
# Per guest < per-IP matches, so that case meets its own bucket; 10 guests leave room for the setups.
if [ "${ROBOT_RATE_LIMITS:-0}" = "1" ]; then
	export RATE_LIMIT_GUEST_PER_IP=10 RATE_LIMIT_MATCH_PER_IP=5 RATE_LIMIT_MATCH_PER_GUEST=3
	ROBOT_SCOPE=(--include rate-limit --variable RATE_LIMIT_GUEST_PER_IP:10 --variable RATE_LIMIT_MATCH_PER_IP:5
		--variable RATE_LIMIT_MATCH_PER_GUEST:3 --outputdir reports-local-java-limited/)
elif [ "${ROBOT_GOLDEN:-0}" = "1" ]; then
	# v0.41.4 - ROBOT_GOLDEN=1 (export_golden_files.sh): writes this backend's golden export, imports every golden.
	export RATE_LIMIT_GUEST_PER_IP=0 RATE_LIMIT_MATCH_PER_IP=0 RATE_LIMIT_MATCH_PER_GUEST=0
	ROBOT_SCOPE=(--include golden --variable WRITE_GOLDEN:1 --outputdir reports-local-java-golden/)
else
	export RATE_LIMIT_GUEST_PER_IP=0 RATE_LIMIT_MATCH_PER_IP=0 RATE_LIMIT_MATCH_PER_GUEST=0
	ROBOT_SCOPE=(--outputdir reports-local-java/)
fi

cd $PROJECT_ROOT && \
python3 -m venv .venv && \
source .venv/bin/activate


# If not present in .env, ROBOT_VAR_ADMIN_TOKEN must be set in the environment before running the script
if [ -z "${ROBOT_VAR_ADMIN_TOKEN:-}" ]; then
	echo "Error: ROBOT_VAR_ADMIN_TOKEN must be set in the environment or .env file."
	exit 1
fi

echo "Kill all process using 8042 and 8044 ports"
fuser -k 8042/tcp || true
fuser -k 8044/tcp || true

SQLITE_DB_PATH="${HOME}/.paths.games/database.sqlite"
echo "Removing local SQLite database to force fresh Flyway migrations: ${SQLITE_DB_PATH}"
rm -f "${SQLITE_DB_PATH}"

# Build the JAR with the dev Maven profile (includes adapter-sqlte + SQLite JDBC driver)
echo "Building Java project with Maven dev profile..."
cd "$PROJECT_ROOT/code/backend/java" && \
	mvn -q clean install package -P dev -DskipTests
echo "Build completed."

# start local server
# v0.37.6 — static catalog export (POST /api/admin/stories/catalog) writes here; the
# Robot suite 14_admin/story_catalog.robot reads the files back through the same variable.
export CATALOG_EXPORT_DIR="${CATALOG_EXPORT_DIR:-/tmp/pathsgames-catalog-robot}"
rm -rf "$CATALOG_EXPORT_DIR"

java -jar "$PROJECT_ROOT/code/backend/java/ms-launcher/target/ms-launcher-"*-SNAPSHOT.jar &
SERVER_PID=$!

# Function to terminate the application in case of error
cleanup() {
    echo "-------------- Cleanup"
	echo "Stopping the server"
    kill $SERVER_PID 2>/dev/null || true
}
trap cleanup EXIT

sleep 30 # wait for the server to start
curl -s http://localhost:8042/api/echo/status > /dev/null || { echo "Public server (8042) not started correctly"; kill $SERVER_PID; exit 1; }
# The same JVM serves the admin API on 8044 (second Tomcat connector), including the
# /api/echo/status health check (same EchoService) — a 200 confirms it is up.
ADMIN_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8044/api/echo/status || echo 000)
[ "$ADMIN_CODE" = "200" ] || { echo "Admin connector (8044) not started correctly (got $ADMIN_CODE)"; kill $SERVER_PID; exit 1; }

# run Robot tests. If ROBOT_VAR_ADMIN_TOKEN is set in .env, it will be exported by the sourced file.
cd "$PROJECT_ROOT/code/tests/robot" && pip install -r requirements.txt
ROBOT_EXIT=0
ROBOT_VAR_ADMIN_TOKEN="${ROBOT_VAR_ADMIN_TOKEN:-}" robot --variablefile variables/dev.yaml "${ROBOT_SCOPE[@]}" tests/ || ROBOT_EXIT=$?

# Remove the rows created by this Robot run (guests + matches tagged "robottest"),
# preserving every other row. Runs whether the tests passed or failed.
echo "Cleaning up robot test data via POST /api/dev/cleanup ..."
curl -s -X POST http://localhost:8044/api/dev/cleanup || echo "  cleanup request failed"
echo

# stop local server
kill $SERVER_PID || true
echo "Kill all process using 8042 and 8044 ports"
fuser -k 8042/tcp || true
fuser -k 8044/tcp || true

echo "Test Robot completed. Report available in $PROJECT_ROOT/code/tests/robot/reports-local-java/"
exit $ROBOT_EXIT
