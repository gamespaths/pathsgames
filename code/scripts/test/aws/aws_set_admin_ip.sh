#!/usr/bin/env bash
# v0.42.0 — REPLACES the admin allow-list of the dev/test stack with this machine's public IP, every other parameter kept.
# Usage: aws_set_admin_ip.sh [dev|test] [--ip A.B.C.D] [--stack NAME] [--region REGION] [--dry-run]; defaults from .env (test).
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
	# shellcheck disable=SC1090
	. "$ENV_FILE"
fi
# shellcheck source=../../lib/admin_ip.sh
. "$PROJECT_ROOT/code/scripts/lib/admin_ip.sh"

usage() { sed -n '2,3p' "$0" | sed 's/^# \{0,1\}//'; }

STACK="${AWS_TEST_SAM_STACK_NAME:-pathsgames-test}"
REGION="${AWS_TEST_REGION:-us-east-2}"
IP=""
DRY_RUN=false
while [ $# -gt 0 ]; do
	case "$1" in
		dev|test) STACK="pathsgames-$1"; shift ;;
		--ip) IP="${2:-}"; shift 2 ;;
		--stack) STACK="${2:-}"; shift 2 ;;
		--region) REGION="${2:-}"; shift 2 ;;
		--dry-run) DRY_RUN=true; shift ;;
		-h|--help) usage; exit 0 ;;
		*) echo "Error: unknown argument '$1'." >&2; usage >&2; exit 2 ;;
	esac
done

if [ -z "$IP" ]; then
	IP="$(admin_ip_detect)"
fi
echo "Note: the next aws_backend_deploy.sh rewrites the list (ADMIN_IP_WHITELIST from .env + the caller IP)."
admin_ip_set_on_stack "$STACK" "$REGION" "$IP" "$DRY_RUN"
