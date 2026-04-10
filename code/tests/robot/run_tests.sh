#!/usr/bin/env bash
# run_tests.sh — convenience runner for the Robot Framework test suite.
#
# Usage:
#   ./run_tests.sh                    # all tests
#   ./run_tests.sh smoke              # only smoke tests
#   ./run_tests.sh auth               # only auth tests
#   ./run_tests.sh stories            # only story tests (no admin token needed)
#   ./run_tests.sh admin              # only admin tests (ADMIN_TOKEN required in dev.yaml)
#
# Set ADMIN_TOKEN env var to override the value in variables/dev.yaml:
#   ADMIN_TOKEN="eyJ..." ./run_tests.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

TAG="${1:-}"
REPORTS_DIR="reports"
VARS="variables/dev.yaml"

mkdir -p "$REPORTS_DIR"

if [[ -n "$TAG" ]]; then
    echo "Running Robot Framework tests — tag: $TAG"
    robot \
        --variablefile "$VARS" \
        --include "$TAG" \
        --outputdir "$REPORTS_DIR" \
        tests/
else
    echo "Running Robot Framework tests — ALL suites"
    robot \
        --variablefile "$VARS" \
        --outputdir "$REPORTS_DIR" \
        tests/
fi
