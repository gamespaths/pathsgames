# script per eseguire la versione java

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

# v0.41.0 — same secret as Robot and the stress tools; limits at 0 so local stress runs are never limited.
if [ -n "${JWT_SECRET:-}" ]; then export JWT_SECRET; fi
export RATE_LIMIT_GUEST_PER_IP=0 RATE_LIMIT_MATCH_PER_IP=0 RATE_LIMIT_MATCH_PER_GUEST=0

echo "Kill all process using 8042 port"
fuser -k 8042/tcp || true

cd "$PROJECT_ROOT/code/backend/java" && mvn clean install package  -DskipTests && mvn -pl ms-launcher spring-boot:run
#java -jar target/pathsgames-java-1.0-SNAPSHOT.jar


