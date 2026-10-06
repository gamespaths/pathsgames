#!/usr/bin/env bash
# v0.42.0 — deploys the alpha AWS backend (stack pathsgames-alpha, us-east-1) through the shared stage script.
# Usage: deploy_backend.sh [--auto-confirm]; keys AWS_ALPHA_<SERVICE>_<KEY> from .env (or the environment, in CI).
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
case "${1:-}" in
	-h|--help) sed -n '2,3p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
esac
exec "$DIR/../prod/aws_backend_deploy_stage.sh" alpha "$@"
