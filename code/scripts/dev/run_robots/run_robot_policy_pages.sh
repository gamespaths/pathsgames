#!/usr/bin/env bash
# v1.2.0 — Robot check of the static policy pages (privacy/terms/cookies.html) on a deployed website.
# Usage: run_robot_policy_pages.sh [website_url]   (default ROBOT_WEBSITE_URL, else https://paths.games)
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
WEBSITE_URL="${1:-${ROBOT_WEBSITE_URL:-https://paths.games}}"
WEBSITE_URL="${WEBSITE_URL%/}"
echo "Website checked: $WEBSITE_URL"

cd "$PROJECT_ROOT" && python3 -m venv .venv
# shellcheck disable=SC1091
source "$PROJECT_ROOT/.venv/bin/activate"
cd "$PROJECT_ROOT/code/tests/robot" && pip install -q -r requirements.txt

ROBOT_EXIT=0
robot --variable "WEBSITE_URL:$WEBSITE_URL" --outputdir reports-website/ \
    tests_v1/02_google_sso/policy_pages.robot || ROBOT_EXIT=$?

echo "Test Robot completed. Report available in $PROJECT_ROOT/code/tests/robot/reports-website/"
exit $ROBOT_EXIT
