#!/usr/bin/env bash
# build_docker_python_test_and_push.sh — Build Paths Games PYTHON backend image
#   for BOTH linux/amd64 (Intel/AMD) and linux/arm64 (AWS Graviton ARM).
#
# Creates a multi-arch Docker image that works on:
#   - t3.medium (x86_64, Intel-based EC2)
#   - t4g.medium (ARM64, Graviton-based EC2)
#   - Your local Mac/Linux (regardless of architecture)
#
# Docker Hub will store a manifest index pointing to both variants.
# When you `docker pull` on t3 or t4g, Docker automatically downloads
# the version for that architecture.
#
# The image is built from code/backend/python/Dockerfile which serves
# BOTH the public (8042) and admin (8044) FastAPI apps via `python -m app.launcher`.
#
# Config is read from the project ROOT .env (same file used by start.sh / stop.sh / redeploy.sh).
#
# After pushing, run:
#   • aws_ec2_with_python_docker/start.sh     (launch new EC2)
#   • aws_ec2_with_python_docker/redeploy.sh  (update existing EC2)
#
# Usage:
#   ./build_docker_python_test_and_push.sh            # build + push (amd64 + arm64)
#   ./build_docker_python_test_and_push.sh --dry-run  # print commands only

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
# Multi-arch: both amd64 and arm64
BUILD_PLATFORMS="linux/amd64,linux/arm64"
BUILDX_BUILDER="${BUILDX_BUILDER:-pathsgames-builder}"
BUILDKITD_CONFIG="$SCRIPT_DIR/buildkitd.toml"
BACKEND_IMAGE="${DOCKERHUB_USERNAME}/${DOCKERHUB_IMAGE}:${IMAGE_TAG}"

# Build context = the Python backend module (Dockerfile + app/ + scripts/ live here).
# From code/scripts/test/ go up to code/ then into backend/python.
PYTHON_DIR="$(cd "$SCRIPT_DIR/../../backend/python" && pwd)"

if [ ! -f "$PYTHON_DIR/Dockerfile" ]; then
    echo "[build-py] ERROR: Dockerfile not found at $PYTHON_DIR/Dockerfile"
    exit 1
fi

echo "[build-py] Image     : $BACKEND_IMAGE"
echo "[build-py] Platforms : $BUILD_PLATFORMS"
echo "[build-py] Context   : $PYTHON_DIR"
echo ""

# ── Dry-run ───────────────────────────────────────────────────────────────────
if [ "${1:-}" = "--dry-run" ]; then
    echo "=== DRY RUN — commands that would run ==="
    echo ""
    echo "1. Login to Docker Hub:"
    echo "   echo \$DOCKERHUB_TOKEN | docker login -u $DOCKERHUB_USERNAME --password-stdin"
    echo ""
    echo "2. Ensure buildx builder exists:"
    echo "   docker buildx use $BUILDX_BUILDER  ||  docker buildx create --use --name $BUILDX_BUILDER --buildkitd-config $BUILDKITD_CONFIG"
    echo ""
    echo "3. Build multi-arch image (amd64 + arm64) and push to Docker Hub:"
    echo "   docker buildx build \\"
    echo "     --platform $BUILD_PLATFORMS \\"
    echo "     -t $BACKEND_IMAGE \\"
    echo "     -f $PYTHON_DIR/Dockerfile \\"
    echo "     $PYTHON_DIR \\"
    echo "     --push"
    echo ""
    echo "4. Cleanup (remove buildx builder and cache):"
    echo "   docker buildx rm --force $BUILDX_BUILDER"
    echo ""
    echo "=== END DRY RUN ==="
    exit 0
fi

# ── Check for required environment ──────────────────────────────────────────────
if ! command -v docker &> /dev/null; then
    echo "[build-py] ERROR: docker not found. Install Docker Desktop or Docker Engine."
    exit 1
fi

if ! docker buildx version &> /dev/null; then
    echo "[build-py] ERROR: 'docker buildx' not found. Enable 'containerd' in Docker Desktop or install buildx plugin."
    exit 1
fi

# ── Docker Hub login (local machine only) ──────────────────────────────────────
DOCKERHUB_TOKEN="${DOCKERHUB_TOKEN_TEST:?DOCKERHUB_TOKEN_TEST must be set in the root .env (a Docker Hub access token)}"
echo "[build-py] Logging in to Docker Hub as $DOCKERHUB_USERNAME…"
echo "$DOCKERHUB_TOKEN" | docker login -u "$DOCKERHUB_USERNAME" --password-stdin >/dev/null 2>&1
echo "[build-py] Login successful ✓"
echo ""

# ── Ensure a buildx builder exists (needed for --platform multi-arch) ──────────
# Throw-away builder (GC-bounded via buildkitd.toml): removed on EXIT with its cache volume.
echo "[build-py] Setting up buildx builder…"
docker buildx use "$BUILDX_BUILDER" 2>/dev/null \
    || docker buildx create --use --name "$BUILDX_BUILDER" --buildkitd-config "$BUILDKITD_CONFIG" >/dev/null 2>&1
echo "[build-py] Using builder: $BUILDX_BUILDER"

cleanup_builder() {
    echo ""
    echo "[build-py] Cleaning up buildx builder and cache…"
    docker buildx rm --force "$BUILDX_BUILDER" >/dev/null 2>&1 || true
    echo "[build-py] Cleanup complete."
}
trap cleanup_builder EXIT

# ── Build for linux/amd64 + linux/arm64 and push in one step ──────────────────
echo ""
echo "[build-py] Building multi-arch image for: $BUILD_PLATFORMS"
echo "[build-py] This will take ~3-5 min (builds amd64 and arm64 in parallel)…"
echo ""

docker buildx build \
    --platform "$BUILD_PLATFORMS" \
    -t "$BACKEND_IMAGE" \
    -f "$PYTHON_DIR/Dockerfile" \
    "$PYTHON_DIR" \
    --push

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  ✓ Python multi-arch image built and pushed                ║"
echo "╠════════════════════════════════════════════════════════════╣"
printf "║  Image     : %-47s║\n" "$BACKEND_IMAGE"
printf "║  Platforms : %-47s║\n" "linux/amd64 + linux/arm64"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║  What this means:                                          ║"
echo "║   • docker pull on t3.medium (x86)  → downloads amd64 ✓   ║"
echo "║   • docker pull on t4g.medium (ARM) → downloads arm64 ✓   ║"
echo "║   • docker pull on your Mac/Linux   → auto-detects ✓      ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║  Next steps:                                               ║"
echo "║   • Launch new EC2       → ./start.sh                      ║"
echo "║   • Update running EC2   → ./redeploy.sh                   ║"
echo "║   • Verify manifest      →                                 ║"
printf "║     docker manifest inspect %s\n" "$BACKEND_IMAGE"
echo "╚════════════════════════════════════════════════════════════╝"