#!/usr/bin/env bash
# tf.sh <test|production> <terraform command> [args] — one state, data dir and tfvars per environment.
# Examples: ./tf.sh test init | ./tf.sh production plan | ./tf.sh test import aws_cloudfront_distribution.website E8WIS9RLXJVR9
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$DIR/../../.." && pwd)"

ENV="${1:-}"
case "$ENV" in
    test|production) ;;
    *)
        echo "usage: $(basename "$0") <test|production> <init|plan|apply|import|state|output|...> [args]"
        exit 1
        ;;
esac
shift

BACKEND="$DIR/backend-$ENV.hcl"
TFVARS="$DIR/environments/$ENV.tfvars"
[ -f "$BACKEND" ] || { echo "Error: $BACKEND not found."; exit 1; }
[ -f "$TFVARS" ] || { echo "Error: $TFVARS not found."; exit 1; }

# `version` tag = VERSION in the root .env (same source as the SAM backend stacks).
PROJECT_VERSION="$(sed -n 's/^VERSION=//p' "$PROJECT_ROOT/.env" 2>/dev/null | head -1 | tr -d '"'"'"'')"
[ -n "$PROJECT_VERSION" ] || { echo "Error: VERSION not set in $PROJECT_ROOT/.env"; exit 1; }

export TF_DATA_DIR="$DIR/.terraform-$ENV"   # providers + backend cache, one per environment
export TF_VAR_project_version="$PROJECT_VERSION"

CMD="${1:-}"
[ -n "$CMD" ] || { echo "Error: missing terraform command."; exit 1; }
shift

cd "$DIR"
echo "[tf.sh] env=$ENV version=$PROJECT_VERSION data_dir=$TF_DATA_DIR"
case "$CMD" in
    init)
        exec terraform init -backend-config="$BACKEND" "$@"
        ;;
    plan|apply|destroy|import|refresh|console)
        exec terraform "$CMD" -var-file="$TFVARS" "$@"
        ;;
    *)
        exec terraform "$CMD" "$@"
        ;;
esac
