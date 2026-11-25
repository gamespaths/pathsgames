#!/usr/bin/env bash
# script per eseguire la versione react game

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

echo "Kill all process using 5174 port"
fuser -k 5174/tcp || true

MODE_ARGS=()

for arg in "$@"; do
    case "$arg" in
        --mode-test)
            MODE_ARGS=(--mode test)
            ;;
        *)
            echo "Parametro sconosciuto: $arg" >&2
            exit 1
            ;;
    esac
done

cd "$PROJECT_ROOT/code/frontend/react-game"
if [ "${#MODE_ARGS[@]}" -gt 0 ]; then
    npm run dev -- "${MODE_ARGS[@]}"
else
    npm run dev
fi


