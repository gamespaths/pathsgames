#!/usr/bin/env bash
set -euo pipefail

# Load .env from repository root if present
PROJECT_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
echo "Project root folder: $PROJECT_ROOT"
ENV_FILE="$PROJECT_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
	# shellcheck disable=SC1090
	. "$ENV_FILE"
	echo "Env file loaded: $ENV_FILE"
else
    echo "No .env file found at $ENV_FILE"
fi

SONAR_HOST_URL="${SONAR_HOST_URL:-https://sonarcloud.io}"
SONAR_ORGANIZATION="${SONAR_ORGANIZATION:-gamespaths}"
echo "Sonar Host: $SONAR_HOST_URL"
echo "Sonar Organization: $SONAR_ORGANIZATION"

run_java() {
    echo "========================================="
    echo "Running Sonar Scanner for Java Backend..."
    echo "========================================="
    if [ -z "${SONAR_LOGIN_TOKEN_JAVA:-}" ]; then
        echo "Error: SONAR_LOGIN_TOKEN_JAVA must be set in the environment or .env file."
        return 1
    fi
    cd "$PROJECT_ROOT/code/backend/java"
    mvn clean package
    mvn sonar:sonar -Dsonar.login="$SONAR_LOGIN_TOKEN_JAVA"
    echo "Java Sonar Scanner completed."
}

run_php() {
    echo "========================================"
    echo "Running Sonar Scanner for PHP Backend..."
    echo "========================================"
    if [ -z "${SONAR_LOGIN_TOKEN:-}" ]; then
        echo "Error: SONAR_LOGIN_TOKEN must be set in the environment or .env file."
        return 1
    fi
    cd "$PROJECT_ROOT/code/backend/php"
    mkdir -p build/logs
    # Run tests to generate coverage reports. We set set +e temporarily in case tests fail,
    # so we still run the sonar scanner to report those failures.
    set +e
    XDEBUG_MODE=coverage vendor/bin/phpunit --coverage-clover build/logs/clover.xml --log-junit build/logs/junit.xml
    set -e
    npx -y sonar-scanner -Dsonar.login="$SONAR_LOGIN_TOKEN" -Dsonar.host.url="$SONAR_HOST_URL" -Dsonar.organization="$SONAR_ORGANIZATION"
    echo "PHP Sonar Scanner completed."
}

run_python() {
    echo "==========================================="
    echo "Running Sonar Scanner for Python Backend..."
    echo "==========================================="
    if [ -z "${SONAR_LOGIN_TOKEN:-}" ]; then
        echo "Error: SONAR_LOGIN_TOKENmust be set in the environment or .env file."
        return 1
    fi
    cd "$PROJECT_ROOT/code/backend/python"
    
    set +e
    # Run tests using the local virtual environment if it exists
    if [ -f ".venv/bin/pytest" ]; then
        ./.venv/bin/pytest --cov=app --cov-report=xml:coverage.xml --cov-report=term-missing -v
    else
        pytest --cov=app --cov-report=xml:coverage.xml --cov-report=term-missing -v
    fi
    set -e

    npx -y sonar-scanner -Dsonar.login="$SONAR_LOGIN_TOKEN" -Dsonar.host.url="$SONAR_HOST_URL" -Dsonar.organization="$SONAR_ORGANIZATION"
    echo "Python Sonar Scanner completed."
}

run_react_admin() {
    echo "==========================================="
    echo "Running Sonar Scanner for React Admin..."
    echo "==========================================="
    if [ -z "${SONAR_LOGIN_TOKEN:-}" ]; then
        echo "Error: SONAR_LOGIN_TOKEN must be set in the environment or .env file."
        return 1
    fi
    cd "$PROJECT_ROOT/code/frontend/react-admin"
    
    set +e
    npm run test:coverage
    set -e
    
    npx -y sonar-scanner \
        -Dsonar.login="$SONAR_LOGIN_TOKEN" \
        -Dsonar.host.url="$SONAR_HOST_URL" \
        -Dsonar.organization="$SONAR_ORGANIZATION" \
        -Dsonar.projectKey=paths-game-admin-react \
        -Dsonar.projectName="Frontend React Admin" \
        -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info \
        -Dsonar.sources=src \
        -Dsonar.tests=src/tests \
        -Dsonar.exclusions="**/node_modules/**,**/dist/**,**/coverage/**,src/tests/**" \
        -Dsonar.test.inclusions="src/tests/**/*.test.jsx"
    echo "React Admin Sonar Scanner completed."
}

usage() {
    echo "Usage: $0 [all|java|php|python|react-admin]"
    echo "If no arguments are provided, all scanners will be run."
}

TARGET="${1:-all}"

case "$TARGET" in
    all)
        run_java
        run_php
        run_python
        # run_react_admin
        ;;
    java)
        run_java
        ;;
    php)
        run_php
        ;;
    python)
        run_python
        ;;
    react-admin)
        run_react_admin
        ;;
    *)
        usage
        exit 1
        ;;
esac

echo "==========================================="
echo "All requested Sonar Scanners have finished."
echo "==========================================="
