#!/usr/bin/env bash
# execute all robot tests against a local server (http://localhost:8042).
# execute python server locally

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

echo "Uccido qualunque processo occupi la porta 8042"
fuser -k 8042/tcp

#echo "Rimuovo il file database.sqlite"
#rm "$PROJECT_ROOT/code/backend/python/database.sqlite"

# start local server
cd "$PROJECT_ROOT/code/backend/python" && \
python3 -m venv .venv && \
source .venv/bin/activate && \
pip install -r requirements.txt && \
python3 -m app.launcher & # python -m flask --app api --debug run --port 8042 &
SERVER_PID=$!		

# Funzione per terminare l'applicazione in caso di errore
cleanup() {
    echo "-------------- Cleanup"
	echo "Fermo il server"
    kill $SERVER_PID
}
trap cleanup EXIT

echo "Starting local Python server with PID $SERVER_PID..."

sleep 10 # wait for the server to start
curl -s http://localhost:8042/api/echo/status > /dev/null || {
	echo "Server not started correctly"	
	kill $SERVER_PID
	exit 1
}	

# run Robot tests. If ROBOT_VAR_ADMIN_TOKEN is set in .env, it will be exported by the sourced file.\
echo "Eseguo i robot!"

cd $PROJECT_ROOT && \
python3 -m venv .venv && \
source .venv/bin/activate


cd "$PROJECT_ROOT/code/tests/robot" && \
pip install -r requirements.txt && \
ROBOT_VAR_ADMIN_TOKEN="${ROBOT_VAR_ADMIN_TOKEN:-}" robot --variablefile variables/dev.yaml --outputdir reports-local-python/ tests/

# stop local server
kill $SERVER_PID || true

echo "Test Robot completed. Report available in $PROJECT_ROOT/code/tests/robot/reports-local-python/"