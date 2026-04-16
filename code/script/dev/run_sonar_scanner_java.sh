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

# If not present in .env, SONAR_LOGIN_TOKEN_JAVA must be set in the environment before running the script
if [ -z "${SONAR_LOGIN_TOKEN_JAVA:-}" ]; then
	echo "Error: SONAR_LOGIN_TOKEN_JAVA must be set in the environment or .env file."
	exit 1
fi

# Use SONAR_LOGIN_TOKEN_JAVA from .env if set
SONAR_LOGIN_TOKEN_JAVA="${SONAR_LOGIN_TOKEN_JAVA:-}"

cd "$PROJECT_ROOT/code/backend/java" && mvn clean package && mvn sonar:sonar -Dsonar.login="$SONAR_LOGIN_TOKEN_JAVA"

echo "Sonar Scanner for Java completed successfully."
