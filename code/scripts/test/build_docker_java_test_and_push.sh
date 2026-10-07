#!/usr/bin/env bash
# build_docker_java_test_and_push.sh — Build and push the Paths Games Java backend
# as a multi-architecture Docker image for linux/amd64 and linux/arm64.
#
# Compatible with:
#   - EC2 t3.medium      -> x86_64 / amd64
#   - EC2 t4g.medium     -> ARM64 / Graviton
#
# The image is built from:
#   code/backend/java/Dockerfile
#
# Docker Hub receives one manifest containing both architecture variants.
# Docker automatically selects the correct image during docker pull.
#
# Usage:
#   ./build_docker_java_test_and_push.sh
#   ./build_docker_java_test_and_push.sh --dry-run

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── Load project root .env ────────────────────────────────────────────────────
ENV_FILE="$(cd "$SCRIPT_DIR/../../.." && pwd)/.env"

if [ -f "$ENV_FILE" ]; then
    set -a
    . "$ENV_FILE"
    set +a
    echo "[build-java] Loaded $ENV_FILE"
else
    echo "[build-java] WARNING: $ENV_FILE not found — using environment/defaults."
fi

# ── Configuration ─────────────────────────────────────────────────────────────
DOCKERHUB_USERNAME="${DOCKERHUB_USERNAME_TEST:?DOCKERHUB_USERNAME_TEST must be set}"
DOCKERHUB_IMAGE="${DOCKERHUB_IMAGE_TEST:-pathsgames-backend}"

# Java keeps the existing :test tag.
IMAGE_TAG="${DOCKERHUB_IMAGE_TAG_TEST:-test}"

# Can be overridden, for example:
# BUILD_PLATFORMS=linux/arm64 ./build_docker_java_test_and_push.sh
BUILD_PLATFORMS="${BUILD_PLATFORMS:-linux/amd64,linux/arm64}"

BUILDX_BUILDER="${BUILDX_BUILDER:-pathsgames-java-builder}"
BUILDKITD_CONFIG="$SCRIPT_DIR/buildkitd.toml"

BACKEND_IMAGE="${DOCKERHUB_USERNAME}/${DOCKERHUB_IMAGE}:${IMAGE_TAG}"

# Build context = code/backend/java
JAVA_DIR="$(cd "$SCRIPT_DIR/../../backend/java" && pwd)"
DOCKERFILE="$JAVA_DIR/Dockerfile"

if [ ! -f "$DOCKERFILE" ]; then
    echo "[build-java] ERROR: Dockerfile not found at $DOCKERFILE"
    exit 1
fi

echo "[build-java] Image     : $BACKEND_IMAGE"
echo "[build-java] Platforms : $BUILD_PLATFORMS"
echo "[build-java] Context   : $JAVA_DIR"
echo ""

# ── Dry run ───────────────────────────────────────────────────────────────────
if [ "${1:-}" = "--dry-run" ]; then
    echo "=== DRY RUN — commands that would run ==="
    echo ""
    echo "1. Docker Hub login:"
    echo "   echo \$DOCKERHUB_TOKEN | docker login -u $DOCKERHUB_USERNAME --password-stdin"
    echo ""
    echo "2. Buildx builder:"
    echo "   docker buildx use $BUILDX_BUILDER"
    echo "   docker buildx create --use --name $BUILDX_BUILDER"
    echo ""
    echo "3. Multi-architecture build and push:"
    echo "   docker buildx build \\"
    echo "     --platform $BUILD_PLATFORMS \\"
    echo "     --tag $BACKEND_IMAGE \\"
    echo "     --file $DOCKERFILE \\"
    echo "     $JAVA_DIR \\"
    echo "     --push"
    echo ""
    echo "4. Manifest verification:"
    echo "   docker buildx imagetools inspect $BACKEND_IMAGE"
    echo ""
    echo "=== END DRY RUN ==="
    exit 0
fi

# ── Validate Docker and Buildx ────────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
    echo "[build-java] ERROR: docker command not found."
    exit 1
fi

if ! docker buildx version >/dev/null 2>&1; then
    echo "[build-java] ERROR: docker buildx is not available."
    exit 1
fi

# ── Docker Hub login ──────────────────────────────────────────────────────────
DOCKERHUB_TOKEN="${DOCKERHUB_TOKEN_TEST:?DOCKERHUB_TOKEN_TEST must be set}"

echo "[build-java] Logging in to Docker Hub as $DOCKERHUB_USERNAME..."
echo "$DOCKERHUB_TOKEN" | docker login \
    --username "$DOCKERHUB_USERNAME" \
    --password-stdin

echo "[build-java] Docker Hub login successful."
echo ""

# ── Ensure Buildx builder exists ──────────────────────────────────────────────
BUILDER_CREATED=false

if docker buildx inspect "$BUILDX_BUILDER" >/dev/null 2>&1; then
    echo "[build-java] Using existing builder: $BUILDX_BUILDER"
    docker buildx use "$BUILDX_BUILDER"
else
    echo "[build-java] Creating builder: $BUILDX_BUILDER"

    if [ -f "$BUILDKITD_CONFIG" ]; then
        docker buildx create \
            --name "$BUILDX_BUILDER" \
            --driver docker-container \
            --buildkitd-config "$BUILDKITD_CONFIG" \
            --use
    else
        docker buildx create \
            --name "$BUILDX_BUILDER" \
            --driver docker-container \
            --use
    fi

    BUILDER_CREATED=true
fi

# Remove only the builder created by this execution.
cleanup_builder() {
    if [ "$BUILDER_CREATED" = true ]; then
        echo ""
        echo "[build-java] Removing temporary builder: $BUILDX_BUILDER"
        docker buildx rm --force "$BUILDX_BUILDER" >/dev/null 2>&1 || true
    fi
}

trap cleanup_builder EXIT

# ── Build and push multi-architecture image ───────────────────────────────────
echo ""
echo "[build-java] Building Java image..."
echo "[build-java] Platforms: $BUILD_PLATFORMS"
echo ""

docker buildx build \
    --platform "$BUILD_PLATFORMS" \
    --tag "$BACKEND_IMAGE" \
    --file "$DOCKERFILE" \
    "$JAVA_DIR" \
    --push

# ── Verify manifest ──────────────────────────────────────────────────────────
echo ""
echo "[build-java] Verifying published manifest..."
docker buildx imagetools inspect "$BACKEND_IMAGE"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Java multi-arch image built and pushed                    ║"
echo "╠════════════════════════════════════════════════════════════╣"
printf "║  Image     : %-47s║\n" "$BACKEND_IMAGE"
printf "║  Platforms : %-47s║\n" "$BUILD_PLATFORMS"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║  t3.medium  -> linux/amd64                                ║"
echo "║  t4g.medium -> linux/arm64                                ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║  Next steps:                                               ║"
echo "║  New EC2      -> aws_ec2_with_java_docker/start.sh         ║"
echo "║  Running EC2  -> aws_ec2_with_java_docker/redeploy.sh      ║"
echo "╚════════════════════════════════════════════════════════════╝"