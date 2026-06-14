#!/usr/bin/env bash
# redeploy.sh — Roll the latest TEST-PYTHON image onto the already-running EC2 instance.
#
# PYTHON twin of aws_ec2_with_java_docker/redeploy.sh (server3).
# Connects over SSH, (re)writes /opt/pathsgames/backend.env (Python keys), then:
#   docker pull <BACKEND_IMAGE>  →  docker rm -f pathsgames-backend  →  docker run ...
# PostgreSQL (pathsgames-postgres) is left untouched, so data survives.
#
# Secrets go over SSH stdin, never on the command line.
#
# Reads config from the root .env and connection info from .state.
# Build & push a fresh image first with ../build_docker_python_test_and_push.sh.
#
# Usage:
#   ./redeploy.sh           # redeploy (with confirmation prompt)
#   ./redeploy.sh --force   # skip confirmation

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
STATE_FILE="$SCRIPT_DIR/.state"

# ── Load the project ROOT .env (config), then .state (live instance info) ─────
ROOT_ENV="$(cd "$SCRIPT_DIR/../../../.." && pwd)/.env"
if [ -f "$ROOT_ENV" ]; then
    set -a; . "$ROOT_ENV"; set +a
    echo "[redeploy.sh] Loaded $ROOT_ENV"
else
    echo "[redeploy.sh] WARNING: root .env not found at $ROOT_ENV — relying on environment / defaults."
fi

# .state (written by start.sh) overrides for the resolved instance values.
if [ -f "$STATE_FILE" ]; then
    set -a; . "$STATE_FILE"; set +a
fi

# ── Config: prefer .state values, else the root .env vars ────────────────────
AWS_REGION="${AWS_REGION:-${AWS_REGION_TEST:-us-east-2}}"
INSTANCE_NAME="${INSTANCE_NAME:-${INSTANCE_NAME_TEST_EC2_PY:-api-test-server3}}"
EC2_KEY_NAME="${EC2_KEY_NAME_TEST_EC2:-paths-games-ohio}"
EC2_KEY_PATH="${EC2_KEY_PATH_TEST_EC2:-~/.ssh/${EC2_KEY_NAME}.pem}"
DB_NAME="${DB_NAME_TEST_EC2:-pathsgames}"
DB_USERNAME="${DB_USERNAME_TEST_EC2:-pathsgames}"
DB_PASSWORD="${DB_PASSWORD_TEST_EC2:?DB_PASSWORD_TEST_EC2 must be set in the root .env}"
JWT_SECRET="${JWT_SECRET:?JWT_SECRET must be set in the root .env}"
PUBLIC_PORT="${PUBLIC_PORT_TEST_EC2:-8042}"
ADMIN_PORT="${ADMIN_PORT_TEST_EC2:-8044}"
# Deployment environment shown by /api/echo/status. Any value != "development"
# selects PostgreSQL for the Python backend.
SERVER_ENVIRONMENT="${AWS_ENVIRONMENT_NAME_TEST:-test}"

# Backend image: prefer the value saved in .state, else derive from root .env vars.
DOCKERHUB_USERNAME="${DOCKERHUB_USERNAME_TEST:-}"
DOCKERHUB_IMAGE="${DOCKERHUB_IMAGE_TEST:-pathsgames-backend}"
IMAGE_TAG="${DOCKERHUB_IMAGE_TAG_PYTHON_TEST:-test-python}"
if [ -z "${BACKEND_IMAGE:-}" ]; then
    [ -n "$DOCKERHUB_USERNAME" ] \
        || { echo "[redeploy.sh] ERROR: BACKEND_IMAGE not in .state and DOCKERHUB_USERNAME_TEST not set in root .env"; exit 1; }
    BACKEND_IMAGE="${DOCKERHUB_USERNAME}/${DOCKERHUB_IMAGE}:${IMAGE_TAG}"
fi

# ── Resolve the current public IP (robust to IP changes) ────────────────────
STATE_IP="${PUBLIC_IP:-}"
echo "[redeploy.sh] Resolving public IP of instance '$INSTANCE_NAME'…"
LIVE_IP="$(aws ec2 describe-instances \
    --region "$AWS_REGION" \
    --filters \
        "Name=tag:Name,Values=$INSTANCE_NAME" \
        "Name=instance-state-name,Values=running" \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text 2>/dev/null || echo 'None')"

if [ "$LIVE_IP" != "None" ] && [ -n "$LIVE_IP" ]; then
    PUBLIC_IP="$LIVE_IP"          # prefer the live IP
else
    PUBLIC_IP="$STATE_IP"         # fall back to the IP saved in .state
fi

if [ "$PUBLIC_IP" = "None" ] || [ -z "$PUBLIC_IP" ]; then
    echo "[redeploy.sh] ERROR: could not determine a running instance IP for '$INSTANCE_NAME'."
    echo "              Is the instance running? Try ./start.sh first."
    exit 1
fi

# Expand a leading ~ in the key path (ssh needs a real path)
EC2_KEY_PATH_EXPANDED="${EC2_KEY_PATH/#\~/$HOME}"

echo "[redeploy.sh] Target   : ubuntu@$PUBLIC_IP"
echo "[redeploy.sh] Image    : $BACKEND_IMAGE"
echo "[redeploy.sh] SSH key  : $EC2_KEY_PATH_EXPANDED"

# ── Confirmation ────────────────────────────────────────────────────────────
if [ "${1:-}" != "--force" ]; then
    read -r -p "[redeploy.sh] Pull $BACKEND_IMAGE and restart the backend on $PUBLIC_IP? [y/N] " CONFIRM
    if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
        echo "[redeploy.sh] Aborted."
        exit 0
    fi
fi

SSH_OPTS=(-i "$EC2_KEY_PATH_EXPANDED" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15)

# ── 1. Ship the env-file (Python keys; secrets via stdin, not on the cmdline) ─
echo "[redeploy.sh] Updating /opt/pathsgames/backend.env on the instance…"
ssh "${SSH_OPTS[@]}" "ubuntu@$PUBLIC_IP" \
    "sudo mkdir -p /opt/pathsgames && sudo tee /opt/pathsgames/backend.env >/dev/null && sudo chmod 600 /opt/pathsgames/backend.env" <<ENVEOF
ENV=${SERVER_ENVIRONMENT}
HOST=0.0.0.0
PORT=8042
ADMIN_PORT=8044
DB_HOST=pathsgames-postgres
DB_PORT=5432
DB_NAME=${DB_NAME}
DB_USER=${DB_USERNAME}
DB_PASSWORD=${DB_PASSWORD}
JWT_SECRET=${JWT_SECRET}
CORS_ALLOWED_ORIGINS=*
DEV_TEST_ENDPOINTS_ENABLED=true
ENVEOF

# ── 2. Pull the latest test image and restart ONLY the backend container ────
echo "[redeploy.sh] Pulling image and restarting the backend container…"
ssh "${SSH_OPTS[@]}" "ubuntu@$PUBLIC_IP" "
    set -e
    sudo docker network create pathsgames-net 2>/dev/null || true
    sudo docker pull '$BACKEND_IMAGE'
    sudo docker rm -f pathsgames-backend 2>/dev/null || true
    sudo docker run -d \
      --name pathsgames-backend \
      --restart unless-stopped \
      --network pathsgames-net \
      -p ${PUBLIC_PORT}:8042 \
      -p ${ADMIN_PORT}:8044 \
      --env-file /opt/pathsgames/backend.env \
      '$BACKEND_IMAGE'
    sudo docker image prune -f >/dev/null 2>&1 || true
"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Python backend redeployed with the latest test image    ║"
echo "╠══════════════════════════════════════════════════════════╣"
printf "║  Instance : %-46s║\n" "$INSTANCE_NAME ($PUBLIC_IP)"
printf "║  Image    : %-46s║\n" "$BACKEND_IMAGE"
echo   "╠══════════════════════════════════════════════════════════╣"
echo   "║  Health (give it ~20-40s to boot):                       ║"
printf "║  http://%-49s║\n" "$PUBLIC_IP:$PUBLIC_PORT/api/echo/status"
echo   "╠══════════════════════════════════════════════════════════╣"
echo   "║  Re-seed (optional): ssh in, then                        ║"
echo   "║   sudo docker exec pathsgames-backend python scripts/seed_stories.py ║"
echo   "╚══════════════════════════════════════════════════════════╝"
