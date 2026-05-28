#!/usr/bin/env bash
# Starts the Java backend locally (dev profile, SQLite, port 8042)
# loading secrets from the root project .env file.
#
# Usage:
#   ./run-local.sh              # dev profile (default)
#   ./run-local.sh prod         # prod profile (PostgreSQL)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

ENV_FILE="$PROJECT_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
    # shellcheck disable=SC1090
    set -a
    . "$ENV_FILE"
    set +a
    echo "Loaded env from $ENV_FILE"
fi

PROFILE="${1:-dev}"

if [ "$PROFILE" = "prod" ]; then
    echo "Starting Java backend — prod profile (PostgreSQL, port 8080)"
    mvn -pl ms-launcher spring-boot:run \
        -P prod \
        -Dspring-boot.run.profiles=prod
else
    echo "Starting Java backend — dev profile (SQLite, port 8042)"
    mvn -pl ms-launcher spring-boot:run
fi
