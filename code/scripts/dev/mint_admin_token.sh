#!/usr/bin/env bash
# v1.2.0 — wrapper of the admin bootstrap tool: prints only the admin token (ROBOT_VAR_ADMIN_TOKEN, react-admin).
# Usage: mint_admin_token.sh [--backend java|python|aws] [--target local|ec2|<aws stage>] [--nickname NAME] [--days N]
set -euo pipefail

SCRIPTS="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="java"
TARGET=""
NICKNAME="owner_admin"
while [ $# -gt 0 ]; do
	case "$1" in
		--backend) BACKEND="${2:-}"; shift 2 ;;
		--target) TARGET="${2:-}"; shift 2 ;;
		--nickname) NICKNAME="${2:-}"; shift 2 ;;
		--days) export ADMIN_TOKEN_DAYS="${2:-}"; shift 2 ;;
		-h|--help) sed -n '2,3p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
		*) echo "Error: unknown argument '$1'" >&2; exit 2 ;;
	esac
done
case "$BACKEND" in
	java) "$SCRIPTS/dev/create_admin_java.sh" "${TARGET:-local}" "$NICKNAME" ;;
	python) "$SCRIPTS/dev/create_admin_python.sh" "${TARGET:-local}" "$NICKNAME" ;;
	aws) "$SCRIPTS/prod/aws_create_admin.sh" "${TARGET:-test}" "$NICKNAME" ;;
	*) echo "Error: --backend must be java, python or aws" >&2; exit 2 ;;
esac | sed -n 's/^ADMIN_TOKEN=//p'
