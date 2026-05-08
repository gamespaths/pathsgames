#!/usr/bin/env bash
# execute all robot tests against a local Java server using PostgreSQL (prod profile).
# Requires a running PostgreSQL instance, or answer Y at the prompt to spin one up via Docker.
#
# Required env vars (or set in .env):
#   ROBOT_VAR_ADMIN_TOKEN   — admin JWT token for robot tests
#
# Optional env vars (defaults match application-prod.yml):
#   DB_HOST         (default: localhost)
#   DB_PORT         (default: 5432)
#   DB_NAME         (default: pathsgames)
#   DB_USERNAME     (default: pathsgames)
#   DB_PASSWORD     (default: pathsgames)

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
	# shellcheck disable=SC1090
	. "$ENV_FILE"
fi

# Validate required token
if [ -z "${ROBOT_VAR_ADMIN_TOKEN:-}" ]; then
	echo "Error: ROBOT_VAR_ADMIN_TOKEN must be set in the environment or .env file."
	exit 1
fi

# PostgreSQL connection defaults (match application-prod.yml)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-pathsgames}"
DB_USERNAME="${DB_USERNAME:-pathsgames}"
DB_PASSWORD="${DB_PASSWORD:-pathsgames}"

DOCKER_PG_CONTAINER="paths-postgres-test"

# Ask whether to start a Docker PostgreSQL container
#read -r -p "Do you want to start a PostgreSQL Docker container? [Y/n] " START_POSTGRES_INPUT
START_POSTGRES_INPUT="y"
#START_POSTGRES_INPUT="${START_POSTGRES_INPUT:-Y}"

if [[ "$START_POSTGRES_INPUT" =~ ^[Yy]$ ]]; then
	echo "Starting PostgreSQL via Docker..."
	docker rm -f "$DOCKER_PG_CONTAINER" 2>/dev/null || true
	docker run -d \
		--name "$DOCKER_PG_CONTAINER" \
		-e POSTGRES_DB="$DB_NAME" \
		-e POSTGRES_USER="$DB_USERNAME" \
		-e POSTGRES_PASSWORD="$DB_PASSWORD" \
		-p "${DB_PORT}:5432" \
		postgres:16-alpine
	echo "Waiting for PostgreSQL to be ready..."
	sleep 5
	until docker exec "$DOCKER_PG_CONTAINER" pg_isready -U "$DB_USERNAME" -d "$DB_NAME" > /dev/null 2>&1; do
		echo "  PostgreSQL not yet ready, retrying..."
		sleep 2
	done
	echo "PostgreSQL is ready."
	DOCKER_STARTED=true
else
	echo "Skipping Docker PostgreSQL startup. Make sure PostgreSQL is already running at ${DB_HOST}:${DB_PORT}."
	DOCKER_STARTED=false
fi

echo "Killing any process occupying port 8042"
fuser -k 8042/tcp || true

# Build the JAR with the prod Maven profile (includes adapter-postgres + PostgreSQL JDBC driver)
# Using 'install' (not 'package') so all modules are installed to local .m2 repo
# before ms-launcher resolves its inter-module dependencies.
echo "Building Java project with Maven prod profile..."
cd "$PROJECT_ROOT/code/backend/java" && \
	mvn -q clean install package -P prod -DskipTests
echo "Build completed."

# Activate venv for robot tests
cd "$PROJECT_ROOT" && \
python3 -m venv .venv && \
source .venv/bin/activate

# Start Java server with prod profile (PostgreSQL)
echo "Starting Java server with prod profile (PostgreSQL)..."
DB_HOST="$DB_HOST" \
DB_PORT="$DB_PORT" \
DB_NAME="$DB_NAME" \
DB_USERNAME="$DB_USERNAME" \
DB_PASSWORD="$DB_PASSWORD" \
java \
	-Dspring.profiles.active=prod \
	-jar "$PROJECT_ROOT/code/backend/java/ms-launcher/target/ms-launcher-"*-SNAPSHOT.jar &
SERVER_PID=$!

cleanup() {
	echo "-------------- Cleanup"
	echo "Stopping Java server"
	kill "$SERVER_PID" 2>/dev/null || true
	if [ "${DOCKER_STARTED:-false}" = "true" ]; then
		echo "Stopping PostgreSQL Docker container"
		docker rm -f "$DOCKER_PG_CONTAINER" 2>/dev/null || true
	fi
}
trap cleanup EXIT

echo "Java server started with PID $SERVER_PID (PostgreSQL: ${DB_USERNAME}@${DB_HOST}:${DB_PORT}/${DB_NAME})"

sleep 30 # wait for server + Flyway migrations
curl -s http://localhost:8042/api/echo/status > /dev/null || {
	echo "Server did not start correctly"
	exit 1
}

echo "Running Robot tests!"
cd "$PROJECT_ROOT/code/tests/robot" && \
pip install -r requirements.txt && \
ROBOT_VAR_ADMIN_TOKEN="${ROBOT_VAR_ADMIN_TOKEN:-}" \
	robot --variablefile variables/dev.yaml --outputdir reports-local-java-postgres/ tests/

kill "$SERVER_PID" 2>/dev/null || true

if [ "${DOCKER_STARTED:-false}" = "true" ]; then
    echo "Stopping PostgreSQL Docker container"
    docker rm -f "$DOCKER_PG_CONTAINER" 2>/dev/null || true
fi

echo "Robot tests completed. Report available in $PROJECT_ROOT/code/tests/robot/reports-local-java-postgres/"
