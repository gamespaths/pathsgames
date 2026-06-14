#!/usr/bin/env bash
# build_docker_python_test_and_push.sh — Build the Paths Games PYTHON backend image
#   LOCALLY from the current working tree and PUSH it to Docker Hub tagged as the
#   TEST image for the python server (server3).
#
# The image is built for linux/amd64 (the EC2 t3 instances are amd64) so it runs
# regardless of your host architecture (e.g. Apple Silicon). It reuses the existing
# Dockerfile (code/backend/python/Dockerfile) which serves BOTH the public (8042)
# and admin (8044) FastAPI apps via `python -m app.launcher`.
#
# Config is read from the project ROOT .env (same file used by start.sh / stop.sh /
# redeploy.sh in aws_ec2_with_python_docker/).
#
# After pushing, run aws_ec2_with_python_docker/redeploy.sh to roll the new image
# onto a running EC2 instance, or start.sh to launch a fresh one.
#
# Usage:
#   ./build_docker_python_test_and_push.sh            # build + push :test-python
#   ./build_docker_python_test_and_push.sh --dry-run  # print the docker commands only

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── Load the project ROOT .env ──────────────────────────────────────────────
ENV_FILE="$(cd "$SCRIPT_DIR/../../.." && pwd)/.env"
if [ -f "$ENV_FILE" ]; then
    set -a; . "$ENV_FILE"; set +a
    echo "[build-py] Loaded $ENV_FILE"
else
    echo "[build-py] WARNING: $ENV_FILE not found — relying on environment / defaults."
fi

# ── Config (root .env *_TEST / *_PYTHON_TEST vars) ──────────────────────────────
DOCKERHUB_USERNAME="${DOCKERHUB_USERNAME_TEST:?DOCKERHUB_USERNAME_TEST must be set in the root .env}"
DOCKERHUB_IMAGE="${DOCKERHUB_IMAGE_TEST:-pathsgames-backend}"
IMAGE_TAG="${DOCKERHUB_IMAGE_TAG_PYTHON_TEST:-test-python}"
BUILD_PLATFORM="${BUILD_PLATFORM:-linux/amd64}"
BUILDX_BUILDER="${BUILDX_BUILDER:-pathsgames-builder}"
BACKEND_IMAGE="${DOCKERHUB_USERNAME}/${DOCKERHUB_IMAGE}:${IMAGE_TAG}"

# Build context = the Python backend module (Dockerfile + app/ + scripts/ live here).
# From code/scripts/test/ go up to code/ then into backend/python.
PYTHON_DIR="$(cd "$SCRIPT_DIR/../../backend/python" && pwd)"

if [ ! -f "$PYTHON_DIR/Dockerfile" ]; then
    echo "[build-py] ERROR: Dockerfile not found at $PYTHON_DIR/Dockerfile"
    exit 1
fi

echo "[build-py] Image    : $BACKEND_IMAGE"
echo "[build-py] Platform : $BUILD_PLATFORM"
echo "[build-py] Context  : $PYTHON_DIR"

# ── Dry-run ─────────────────────────────────────────────────────────────────────
if [ "${1:-}" = "--dry-run" ]; then
    echo ""
    echo "=== DRY RUN — commands that would run ==="
    echo "echo \$DOCKERHUB_TOKEN | docker login -u $DOCKERHUB_USERNAME --password-stdin"
    echo "docker buildx use $BUILDX_BUILDER  ||  docker buildx create --use --name $BUILDX_BUILDER"
    echo "docker buildx build --platform $BUILD_PLATFORM -t $BACKEND_IMAGE -f $PYTHON_DIR/Dockerfile $PYTHON_DIR --push"
    echo "=== END DRY RUN ==="
    exit 0
fi

# ── Docker Hub login (local machine only) ──────────────────────────────────────
DOCKERHUB_TOKEN="${DOCKERHUB_TOKEN_TEST:?DOCKERHUB_TOKEN_TEST must be set in the root .env (a Docker Hub access token)}"
echo "[build-py] Logging in to Docker Hub as $DOCKERHUB_USERNAME…"
echo "$DOCKERHUB_TOKEN" | docker login -u "$DOCKERHUB_USERNAME" --password-stdin

# ── Ensure a buildx builder exists (needed for --platform cross-build) ─────────
docker buildx use "$BUILDX_BUILDER" 2>/dev/null \
    || docker buildx create --use --name "$BUILDX_BUILDER"

# ── Build for amd64 and push in one step ────────────────────────────────────────
echo "[build-py] Building + pushing $BACKEND_IMAGE …"
docker buildx build \
    --platform "$BUILD_PLATFORM" \
    -t "$BACKEND_IMAGE" \
    -f "$PYTHON_DIR/Dockerfile" \
    "$PYTHON_DIR" \
    --push

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Python test image built and pushed to Docker Hub        ║"
echo "╠══════════════════════════════════════════════════════════╣"
printf "║  Image    : %-46s║\n" "$BACKEND_IMAGE"
printf "║  Platform : %-46s║\n" "$BUILD_PLATFORM"
echo   "╠══════════════════════════════════════════════════════════╣"
echo   "║  Next:                                                   ║"
echo   "║   • new instance      → aws_ec2_with_python_docker/start.sh ║"
echo   "║   • update running EC2 → aws_ec2_with_python_docker/redeploy.sh ║"
echo   "╚══════════════════════════════════════════════════════════╝"
