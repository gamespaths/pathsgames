# script per eseguire la versione python 



#!/usr/bin/env bash
set -euo pipefail
# Load .env from repository root if present
PROJECT_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
echo "Project root folder: $PROJECT_ROOT"
ENV_FILE="$PROJECT_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
    # shellcheck disable=SC1090 
    . "$ENV_FILE"
fi
echo "Env file loaded: ${ENV_FILE:-None}"   

echo "Kill all process using 8042 port"
fuser -k 8042/tcp || true

# Setup venv and install dependencies BEFORE starting the server
cd "$PROJECT_ROOT/code/backend/python"
python3 -m venv .venv
.venv/bin/pip install -q -r requirements.txt

echo "Execute script to seed stories in database"
.venv/bin/python scripts/seed_stories.py

# start local server
.venv/bin/python -m app.launcher &
SERVER_PID=$!

