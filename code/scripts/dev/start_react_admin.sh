# script per eseguire la versione react admin

#!/usr/bin/env bash
set -euo pipefail
# Load .env from repository root if present
PROJECT_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
echo "Project root folder: $PROJECT_ROOT"
ENV_FILE="$PROJECT_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
    # shellcheck disable=SC1090 
    . "$ENV_FILE"
fi
echo "Env file loaded: ${ENV_FILE:-None}"   

echo "Kill all process using 5173 port"
fuser -k 5173/tcp || true

cd "$PROJECT_ROOT/code/frontend/react-admin" && npm run dev


