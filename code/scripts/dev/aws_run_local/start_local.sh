#!/usr/bin/env bash
# start_local.sh - v0.41.4 runs the AWS serverless backend on this machine: DynamoDB Local, a moto S3
# (website bucket), two `sam local start-api` (public, admin), seeded; stop_local.sh removes everything.
#
# Env overrides: AWS_LOCAL_PUBLIC_PORT (3042), AWS_LOCAL_ADMIN_PORT (3044), AWS_LOCAL_DYNAMODB_PORT (8000),
#                AWS_LOCAL_S3_PORT (9000), AWS_LOCAL_ARCH (x86_64), AWS_LOCAL_JWT_SECRET (template dev
#                default), AWS_LOCAL_NO_SEED=1, RATE_LIMIT_GUEST_PER_IP / RATE_LIMIT_MATCH_PER_IP /
#                RATE_LIMIT_MATCH_PER_GUEST (0 = off).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$HERE/../../../.." && pwd)"
AWS_DIR="$PROJECT_ROOT/code/backend/aws"
BUILD_DIR="$HERE/.aws-sam/build"
LOG_DIR="$HERE/logs"
NETWORK="pathsgames-aws-local"
DDB_CONTAINER="pathsgames-aws-local-dynamodb"
DDB_PORT="${AWS_LOCAL_DYNAMODB_PORT:-8000}"
S3_CONTAINER="pathsgames-aws-local-s3"
S3_PORT="${AWS_LOCAL_S3_PORT:-9000}"
BUCKET="pathsgames-website-local"
PUBLIC_PORT="${AWS_LOCAL_PUBLIC_PORT:-3042}"
ADMIN_PORT="${AWS_LOCAL_ADMIN_PORT:-3044}"
ARCH="${AWS_LOCAL_ARCH:-x86_64}"
JWT_SECRET_LOCAL="${AWS_LOCAL_JWT_SECRET:-PathsGamesDevSecret2026_MustBeAtLeast32Chars!}"
HEALTH_TIMEOUT="${AWS_LOCAL_HEALTH_TIMEOUT:-300}"

for tool in docker sam curl; do
    command -v "$tool" > /dev/null || { echo "Error: $tool is not installed." >&2; exit 1; }
done
for port in "$PUBLIC_PORT" "$ADMIN_PORT" "$DDB_PORT" "$S3_PORT"; do
    if ss -ltn "sport = :$port" | grep -q LISTEN; then
        echo "Error: port $port is already in use (run stop_local.sh, or set AWS_LOCAL_*_PORT)." >&2
        exit 1
    fi
done

if [ ! -d "$PROJECT_ROOT/.venv" ]; then
    python3 -m venv "$PROJECT_ROOT/.venv"
fi
# shellcheck disable=SC1091
source "$PROJECT_ROOT/.venv/bin/activate"
python -c "import boto3, yaml" 2> /dev/null || pip install -q boto3 pyyaml
mkdir -p "$LOG_DIR"

echo "[1/6] sam build ($ARCH) ..."
rm -rf "$BUILD_DIR"
(cd "$AWS_DIR" && sam build --template template.yaml --build-dir "$BUILD_DIR" > "$LOG_DIR/sam-build.log" 2>&1) \
    || { echo "Error: sam build failed, see $LOG_DIR/sam-build.log" >&2; exit 1; }
python "$HERE/build_local_template.py" "$BUILD_DIR" --arch "$ARCH"

echo "[2/6] DynamoDB Local on :$DDB_PORT ..."
docker network inspect "$NETWORK" > /dev/null 2>&1 || docker network create "$NETWORK" > /dev/null
docker rm -f -v "$DDB_CONTAINER" > /dev/null 2>&1 || true
docker run -d --name "$DDB_CONTAINER" --network "$NETWORK" -p "$DDB_PORT:8000" \
    amazon/dynamodb-local -jar DynamoDBLocal.jar -sharedDb -inMemory > /dev/null
python "$HERE/create_table.py" --endpoint "http://localhost:$DDB_PORT" --table "PathsGamesBackend-dev"

echo "[3/6] S3 (moto) on :$S3_PORT, bucket $BUCKET ..."
docker rm -f -v "$S3_CONTAINER" > /dev/null 2>&1 || true
docker run -d --name "$S3_CONTAINER" --network "$NETWORK" -p "$S3_PORT:5000" motoserver/moto > /dev/null
python "$HERE/create_bucket.py" --endpoint "http://localhost:$S3_PORT" --bucket "$BUCKET"

echo "[4/6] sam local start-api: public :$PUBLIC_PORT, admin :$ADMIN_PORT ..."
PARAMS=(Environment=dev "JwtSecret=$JWT_SECRET_LOCAL" AllowMockAccess=true
        "AdminIpWhitelist=127.0.0.1,::1" AdminIpEmptyMeans=nobody
        "RateLimitGuestPerIp=${RATE_LIMIT_GUEST_PER_IP:-0}" "RateLimitMatchPerIp=${RATE_LIMIT_MATCH_PER_IP:-0}"
        "RateLimitMatchPerGuest=${RATE_LIMIT_MATCH_PER_GUEST:-0}"
        CsrfEnforced=true RobotTestDataTtlHours=1 "WebsiteBucket=$BUCKET"
        "LocalAwsEndpoint=http://$DDB_CONTAINER:8000" "LocalS3Endpoint=http://$S3_CONTAINER:5000")
start_api() {
    local name="$1" port="$2"
    # Fake credentials: the functions get them instead of this machine's real AWS profile.
    nohup env -u AWS_PROFILE -u AWS_SESSION_TOKEN AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local \
        AWS_DEFAULT_REGION=us-east-1 sam local start-api -t "$BUILD_DIR/local-$name.yaml" -p "$port" \
        --docker-network "$NETWORK" --warm-containers LAZY \
        --parameter-overrides "${PARAMS[@]}" > "$LOG_DIR/sam-$name.log" 2>&1 &
    echo $! > "$LOG_DIR/sam-$name.pid"
}
start_api public "$PUBLIC_PORT"
start_api admin "$ADMIN_PORT"

echo "[5/6] waiting for /api/echo/status (first call pulls the Lambda image) ..."
wait_up() {
    local url="$1" deadline=$((SECONDS + HEALTH_TIMEOUT))
    until [ "$(curl -s -o /dev/null -m 60 -w '%{http_code}' "$url" || true)" = "200" ]; do
        if [ $SECONDS -ge $deadline ]; then
            echo "Error: $url not up after ${HEALTH_TIMEOUT}s, see $LOG_DIR/sam-*.log" >&2
            return 1
        fi
        sleep 2
    done
}
wait_up "http://127.0.0.1:$PUBLIC_PORT/api/echo/status"
wait_up "http://127.0.0.1:$ADMIN_PORT/api/echo/status"

if [ "${AWS_LOCAL_NO_SEED:-0}" != "1" ]; then
    echo "[6/6] seeding dev data ..."
    code=$(curl -s -o "$LOG_DIR/seed.json" -w '%{http_code}' -X POST "http://127.0.0.1:$ADMIN_PORT/api/dev/seed")
    [ "$code" = "200" ] || { echo "Error: seed answered HTTP $code, see $LOG_DIR/seed.json" >&2; exit 1; }
else
    echo "[6/6] seed skipped (AWS_LOCAL_NO_SEED=1)"
fi

echo "AWS backend running locally:"
echo "  public API  http://127.0.0.1:$PUBLIC_PORT"
echo "  admin API   http://127.0.0.1:$ADMIN_PORT"
echo "  DynamoDB    http://127.0.0.1:$DDB_PORT (table PathsGamesBackend-dev)"
echo "  S3 (moto)   http://127.0.0.1:$S3_PORT (bucket $BUCKET)"
