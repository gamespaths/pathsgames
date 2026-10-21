#!/usr/bin/env bash
# v1.2.0 — admin bootstrap on AWS: invokes the manual AdminBootstrapFunction of a stage and prints user and token.
# Usage: aws_create_admin.sh <dev|test|alpha|beta|prod> <nickname>; the token goes to stdout only, never to a file.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SAMCONFIG="$PROJECT_ROOT/code/backend/aws/samconfig.toml"
STAGE="${1:-}"
NICKNAME="${2:-}"
case "$STAGE" in
	dev|test|alpha|beta|prod) ;;
	*) echo "Usage: $0 <dev|test|alpha|beta|prod> <nickname>" >&2; exit 2 ;;
esac
if [ -z "$NICKNAME" ]; then
	echo "Usage: $0 <dev|test|alpha|beta|prod> <nickname>" >&2
	exit 2
fi
REGION="$(python3 - "$SAMCONFIG" "$STAGE" <<'PY'
import sys, tomllib
with open(sys.argv[1], "rb") as fh:
    print(tomllib.load(fh).get(sys.argv[2], {}).get("deploy", {}).get("parameters", {}).get("region", ""))
PY
)"
REGION="${REGION:-us-east-1}"
PAYLOAD="$(python3 -c 'import json,sys; print(json.dumps({"nickname": sys.argv[1]}))' "$NICKNAME")"
# The response travels through a private temp file (mode 600) removed on exit: aws lambda invoke needs a file.
OUT="$(mktemp)"
chmod 600 "$OUT"
trap 'rm -f "$OUT"' EXIT
aws lambda invoke --region "$REGION" --function-name "pathsgames-${STAGE}-AdminBootstrapFunction" \
	--cli-binary-format raw-in-base64-out --payload "$PAYLOAD" "$OUT" >/dev/null
python3 - "$OUT" <<'PY'
import json, sys
body = json.load(open(sys.argv[1]))
if "error" in body:
    sys.exit(f"Error: {body['error']} {body.get('message', '')}")
for key, name in (("userUuid", "ADMIN_USER_UUID"), ("username", "ADMIN_USERNAME"), ("nickname", "ADMIN_NICKNAME"),
                  ("created", "ADMIN_CREATED"), ("expiresAt", "ADMIN_TOKEN_EXPIRES_AT_MS"), ("accessToken", "ADMIN_TOKEN")):
    print(f"{name}={body.get(key)}")
PY
