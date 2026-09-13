#!/usr/bin/env bash
# Removes leftover stress-test data (robottest* guests and matches), e.g. after an
# interrupted run: tries POST /api/dev/cleanup first, then sweeps the admin API.
set -uo pipefail

ADMIN_BASE_URL="${ADMIN_BASE_URL:-http://localhost:8044}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"
JWT_SECRET="${JWT_SECRET:-PathsGamesDevSecret2026_MustBeAtLeast32Chars!}"
PREFIX="${TEST_MARKER:-robottest}"
DRY_RUN=0
FORCE_SWEEP=0
PAGE=200

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]
  -a URL     admin backend base URL   (default $ADMIN_BASE_URL)
  -t TOKEN   admin JWT (default: minted from JWT_SECRET / dev secret)
  -p PREFIX  guest username / match name prefix to remove (default $PREFIX)
  -n         dry run: list what would be deleted
  -f         skip /api/dev/cleanup, sweep via admin API only
  -h         this help
Steps:
  1. POST {ADMIN}/api/dev/cleanup           -> deletes every '$PREFIX*' guest and match (dev only)
  2. fallback / -f: GET /api/admin/matches  -> PUT status=ENDED + DELETE each '$PREFIX*' match
                    GET /api/admin/guests   -> DELETE each '$PREFIX*' guest
Examples:
  $(basename "$0")                                    # Java dev on 8044
  $(basename "$0") -n                                 # dry run
  ADMIN_TOKEN=eyJ... $(basename "$0") -a https://xxx.execute-api.us-east-2.amazonaws.com/test -f
EOF
}

while getopts "a:t:p:nfh" opt; do
  case "$opt" in
    a) ADMIN_BASE_URL="$OPTARG" ;;
    t) ADMIN_TOKEN="$OPTARG" ;;
    p) PREFIX="$OPTARG" ;;
    n) DRY_RUN=1 ;;
    f) FORCE_SWEEP=1 ;;
    h) usage; exit 0 ;;
    *) usage; exit 2 ;;
  esac
done
ADMIN_BASE_URL="${ADMIN_BASE_URL%/}"

# HS256 admin JWT with the same claims as robot/resources/JwtHelper.py (no PyJWT needed)
mint_token() {
  python3 - "$JWT_SECRET" <<'PY'
import base64, hashlib, hmac, json, sys, time, uuid
def b64(b): return base64.urlsafe_b64encode(b).rstrip(b'=').decode()
now = int(time.time())
head = b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(',', ':')).encode())
body = b64(json.dumps({"jti": str(uuid.uuid4()), "sub": str(uuid.uuid4()), "username": "stress_admin",
                       "role": "ADMIN", "type": "access", "iat": now, "exp": now + 1800},
                      separators=(',', ':')).encode())
sig = b64(hmac.new(sys.argv[1].encode(), f"{head}.{body}".encode(), hashlib.sha256).digest())
print(f"{head}.{body}.{sig}")
PY
}
[[ -z "$ADMIN_TOKEN" ]] && ADMIN_TOKEN="$(mint_token)"

echo "== Stress data cleanup on $ADMIN_BASE_URL (prefix '$PREFIX'${DRY_RUN:+, dry run})"

# Step 1: dev cleanup endpoint (Java: game.dev.test-endpoints-enabled; AWS: ENV=dev)
if [[ "$FORCE_SWEEP" -eq 0 && "$DRY_RUN" -eq 0 ]]; then
  RESP="$(curl -s -m 300 -w '\n%{http_code}' -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
        "$ADMIN_BASE_URL/api/dev/cleanup")"
  CODE="${RESP##*$'\n'}"; BODY="${RESP%$'\n'*}"
  if [[ "$CODE" == "200" ]]; then
    echo "   /api/dev/cleanup: $BODY"
    exit 0
  fi
  echo "   /api/dev/cleanup unavailable (HTTP $CODE), sweeping via admin API"
fi

# Step 2: admin API sweep (paginated, prefix match on name / username)
python3 - "$ADMIN_BASE_URL" "$ADMIN_TOKEN" "$PREFIX" "$DRY_RUN" "$PAGE" <<'PY'
import json, sys, urllib.parse, urllib.request

base, token, prefix, dry, page = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4] == "1", int(sys.argv[5])
TERMINAL = {"ENDED", "GAMEOVER"}

def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(base + path, data=data, method=method,
                                 headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:200]
    except Exception as e:
        return 0, str(e)

def pages(path):
    cursor = None
    while True:
        qs = {"limit": page}
        if cursor: qs["cursor"] = cursor
        code, body = call("GET", f"{path}?{urllib.parse.urlencode(qs)}")
        if code != 200:
            print(f"!! GET {path} -> {code} {body}"); sys.exit(1)
        for item in body.get("items", []): yield item
        cursor = body.get("nextCursor")
        if not cursor: break

# Matches: non-terminal ones must be ENDED before DELETE (409 MATCH_NOT_STOPPED)
matches = [m for m in pages("/api/admin/matches") if str(m.get("name", "")).startswith(prefix)]
print(f"   matches to delete: {len(matches)}")
deleted = 0
for m in matches:
    uuid, status = m.get("uuid"), m.get("status")
    if dry:
        print(f"   [dry] match {uuid} {status} {m.get('name')}"); continue
    if status not in TERMINAL:
        code, body = call("PUT", f"/api/admin/matches/{uuid}", {"status": "ENDED"})
        if code != 200: print(f"   !! PUT match {uuid} -> {code} {body}"); continue
    code, body = call("DELETE", f"/api/admin/matches/{uuid}")
    if code == 200: deleted += 1
    else: print(f"   !! DELETE match {uuid} -> {code} {body}")
if not dry: print(f"   matches deleted: {deleted}")

# Guests
guests = [g for g in pages("/api/admin/guests") if str(g.get("username", "")).startswith(prefix)]
print(f"   guests to delete: {len(guests)}")
deleted = 0
for g in guests:
    uuid = g.get("userUuid") or g.get("uuid")
    if dry:
        print(f"   [dry] guest {uuid} {g.get('username')}"); continue
    code, body = call("DELETE", f"/api/admin/guests/{uuid}")
    if code == 200: deleted += 1
    else: print(f"   !! DELETE guest {uuid} -> {code} {body}")
if not dry: print(f"   guests deleted: {deleted}")
PY
