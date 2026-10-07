#!/usr/bin/env bash
# v0.41.0 — prints a long-lived admin JWT (HS256, JwtHelper.py claims) for ROBOT_VAR_ADMIN_TOKEN.
# Usage: mint_admin_token.sh [--days 365]; JWT_SECRET from the environment, else the root .env.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"
DEV_SECRET='PathsGamesDevSecret2026_MustBeAtLeast32Chars!'
DAYS=365

while [ $# -gt 0 ]; do
	case "$1" in
		--days) DAYS="${2:-}"; shift; shift || true ;;
		--days=*) DAYS="${1#--days=}"; shift ;;
		-h|--help) sed -n '2,3p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
		*) echo "Error: unknown argument '$1' (usage: mint_admin_token.sh [--days N])" >&2; exit 2 ;;
	esac
done
case "$DAYS" in
	''|*[!0-9]*|0) echo "Error: --days needs a positive whole number of days (got '$DAYS')." >&2; exit 2 ;;
esac

if [ -z "${JWT_SECRET:-}" ] && [ -f "$ENV_FILE" ]; then
	JWT_SECRET="$(set +u; . "$ENV_FILE" >/dev/null 2>&1; printf '%s' "${JWT_SECRET:-}")"
fi
if [ -z "${JWT_SECRET:-}" ]; then
	echo "Error: JWT_SECRET is not set (environment or $ENV_FILE)." >&2
	exit 1
fi
if [ "$JWT_SECRET" = "$DEV_SECRET" ]; then
	echo "WARNING: JWT_SECRET is the committed dev default — the token works only where that secret is still accepted." >&2
fi

# The secret travels in the environment, never on the command line.
JWT_SECRET="$JWT_SECRET" MINT_DAYS="$DAYS" python3 - <<'PY'
import base64, hashlib, hmac, json, os, time, uuid

def b64(raw):
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()

now = int(time.time())
claims = {"jti": str(uuid.uuid4()), "sub": str(uuid.uuid4()), "username": "test_admin", "role": "ADMIN",
          "type": "access", "iat": now, "exp": now + int(os.environ["MINT_DAYS"]) * 86400}
head = b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
body = b64(json.dumps(claims, separators=(",", ":")).encode())
sig = b64(hmac.new(os.environ["JWT_SECRET"].encode(), f"{head}.{body}".encode(), hashlib.sha256).digest())
print(f"{head}.{body}.{sig}")
PY
