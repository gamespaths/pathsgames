
#!/usr/bin/env bash
# execute all robot tests against a local server (http://localhost:8042).
# execute php server locally

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

echo "Kill all process using 8042 port"
fuser -k 8042/tcp || true   

cd $PROJECT_ROOT && \
python3 -m venv .venv && \
source .venv/bin/activate

echo "Resetting database..."
mysql -u pathsgames -ppathsgames -h 127.0.0.1 -e "DROP DATABASE IF EXISTS pathsgames;"
sleep 1
mysql -u pathsgames -ppathsgames -h 127.0.0.1 -e "CREATE DATABASE pathsgames;"
sleep 1
# execute database.sql on database
mysql -u pathsgames -ppathsgames -h 127.0.0.1 -D pathsgames < "$PROJECT_ROOT/code/backend/php/database.sql"
sleep 1
mysql -u pathsgames -ppathsgames -h 127.0.0.1 -D pathsgames < "$PROJECT_ROOT/code/backend/php/database_seed_dev_data.sql"
sleep 1


echo "Kill all process using 8042 port"
fuser -k 8042/tcp || true

# Install PHP dependencies if vendor/ is missing
if [ ! -f "$PROJECT_ROOT/code/backend/php/vendor/autoload.php" ]; then
    echo "Running composer install..."
    cd "$PROJECT_ROOT/code/backend/php" && composer install --no-interaction --prefer-dist
fi

# start local server
php -S localhost:8042 -t "$PROJECT_ROOT/code/backend/php/public" &
SERVER_PID=$!

# Function to terminate the application in case of error
cleanup() {
    echo "-------------- Cleanup"
	echo "Stopping the server"
    kill $SERVER_PID || true
}
trap cleanup EXIT

sleep 3 # wait for the server to start
curl -s http://localhost:8042/api/echo/status > /dev/null || {
    echo "Server not started correctly"
    kill $SERVER_PID
    exit 1
}

# run Robot tests. If ROBOT_VAR_ADMIN_TOKEN is set in .env, it will be exported by the sourced file.
cd "$PROJECT_ROOT/code/tests/robot" && pip install -r requirements.txt
ROBOT_EXIT=0
ROBOT_VAR_ADMIN_TOKEN="${ROBOT_VAR_ADMIN_TOKEN:-}" robot --variablefile variables/dev.yaml --outputdir reports-local-php/ tests/ || ROBOT_EXIT=$?

# Remove the rows created by this Robot run (guests + matches tagged "robottest"),
# preserving every other row. Runs whether the tests passed or failed.
echo "Cleaning up robot test data via POST /api/dev/cleanup ..."
curl -s -X POST http://localhost:8042/api/dev/cleanup || echo "  cleanup request failed"
echo

# stop local server
echo "Stopping the server"
kill $SERVER_PID
echo "Kill all process using 8042 port"
fuser -k 8042/tcp || true

echo "Test Robot completed. Report available in $PROJECT_ROOT/code/tests/robot/reports-local-php/"
exit $ROBOT_EXIT
