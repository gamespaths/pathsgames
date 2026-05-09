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

# uccidi processo che usa la porta 5172 e 5174
echo "Kill all process using 5172 port"
fuser -k 5172/tcp || true
echo "Kill all process using 5174 port"
fuser -k 5174/tcp || true   
