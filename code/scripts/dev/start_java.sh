# script per eseguire la versione java

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

echo "Kill all process using 8042 port"
fuser -k 8042/tcp || true

cd "$PROJECT_ROOT/code/backend/java" && mvn clean install package  -DskipTests && mvn -pl ms-launcher spring-boot:run #java -jar target/pathsgames-java-1.0-SNAPSHOT.jar


