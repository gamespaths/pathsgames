
# Start starter/start_java.sh and starter/start_react_admin.sh and starter/start_react_game.sh in parallel
#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
echo "Project root folder: $PROJECT_ROOT"
ENV_FILE="$PROJECT_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
    # shellcheck disable=SC1090 
    . "$ENV_FILE"
fi
echo "Env file loaded: ${ENV_FILE:-None}"   
"$PROJECT_ROOT/code/scripts/dev/starter/start_java.sh" &
"$PROJECT_ROOT/code/scripts/dev/starter/start_react_admin.sh" &
"$PROJECT_ROOT/code/scripts/dev/starter/start_react_game.sh" &  
wait
