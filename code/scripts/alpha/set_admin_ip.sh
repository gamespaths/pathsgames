#!/usr/bin/env bash
# v0.42.0 — REPLACES the alpha admin allow-list with this machine's public IP (one /32 host): previous template, every other parameter kept.
# Usage: set_admin_ip.sh [--ip A.B.C.D] [--stack pathsgames-alpha] [--region us-east-1] [--dry-run]
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
# shellcheck source=../lib/admin_ip.sh
. "$PROJECT_ROOT/code/scripts/lib/admin_ip.sh"

usage() { sed -n '2,3p' "$0" | sed 's/^# \{0,1\}//'; }

STACK="pathsgames-alpha"
REGION="us-east-1"
IP=""
DRY_RUN=false
while [ $# -gt 0 ]; do
	case "$1" in
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
admin_ip_set_on_stack "$STACK" "$REGION" "$IP" "$DRY_RUN"
