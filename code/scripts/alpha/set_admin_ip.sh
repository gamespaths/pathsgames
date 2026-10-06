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
if ! [[ "$IP" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]]; then
	echo "Error: no valid public IPv4 (detected or --ip): '$IP'." >&2
	exit 1
fi

# The authorizer compares plain addresses, so the /32 host is written as the bare IP.
echo "Stack $STACK ($REGION): admin allow-list -> $IP/32 (replaces the previous list)."
if [ "$DRY_RUN" = "true" ]; then
	echo "Dry run: aws cloudformation update-stack --stack-name $STACK --use-previous-template" \
		"--capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND --parameters <every other key>,UsePreviousValue=true" \
		"ParameterKey=AdminIpWhitelist,ParameterValue=$IP"
	exit 0
fi

PARAMS=()
for key in $(aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
	--query 'Stacks[0].Parameters[].ParameterKey' --output text); do
	if [ "$key" != "AdminIpWhitelist" ]; then PARAMS+=("ParameterKey=$key,UsePreviousValue=true"); fi
done
PARAMS+=("ParameterKey=AdminIpWhitelist,ParameterValue=$IP")

_OUT="$(aws cloudformation update-stack --region "$REGION" --stack-name "$STACK" --use-previous-template \
	--capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND --parameters "${PARAMS[@]}" 2>&1)" || {
	if printf '%s' "$_OUT" | grep -q "No updates are to be performed"; then
		echo "Nothing to update: the allow-list already is $IP."
		exit 0
	fi
	echo "$_OUT" >&2
	exit 1
}
echo "Waiting for stack-update-complete..."
aws cloudformation wait stack-update-complete --region "$REGION" --stack-name "$STACK"
echo "Admin API open for $IP/32 only (the authorizer has no cache: effective now)."
