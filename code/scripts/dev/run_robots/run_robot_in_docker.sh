#!/usr/bin/env bash
# run_robot_in_docker.sh - runs one AWS Robot script inside a container (default: run_robot_with_aws_serverless.sh).
# Usage: run_robot_in_docker.sh [run_robot_with_aws_serverless_special.sh]
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
SCRIPT="${1:-run_robot_with_aws_serverless.sh}"
IMAGE="${ROBOT_DOCKER_IMAGE:-pathsgames-robot-aws}"

if [ ! -f "$PROJECT_ROOT/code/scripts/dev/run_robots/$SCRIPT" ]; then
    echo "Error: code/scripts/dev/run_robots/$SCRIPT not found." >&2
    exit 1
fi
command -v docker > /dev/null || { echo "Error: docker is not installed." >&2; exit 1; }

echo "Building image $IMAGE ..."
docker build -q -t "$IMAGE" \
    -f "$PROJECT_ROOT/code/scripts/dev/run_robots/docker/Dockerfile" \
    "$PROJECT_ROOT/code/tests/robot"

# Credentials: ~/.aws read-only (if present) plus any AWS_* credential variable set in this shell.
AWS_ARGS=()
if [ -d "$HOME/.aws" ]; then
    AWS_ARGS+=(-v "$HOME/.aws":/home/runner/.aws:ro)
fi
for var in AWS_PROFILE AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN AWS_DEFAULT_REGION; do
    if [ -n "${!var:-}" ]; then AWS_ARGS+=(-e "$var"); fi
done

# -t only when attached to a terminal, so Ctrl+C reaches the script (the special one restores the Lambda env).
TTY_ARGS=(-i)
if [ -t 0 ] && [ -t 1 ]; then TTY_ARGS=(-it); fi

# -v /work/.venv: fresh anonymous volume filled from the image, the host .venv is never touched.
echo "Running $SCRIPT in $IMAGE ..."
exec docker run --rm "${TTY_ARGS[@]}" \
    --user "$(id -u):$(id -g)" \
    -v "$PROJECT_ROOT":/work \
    -v /work/.venv \
    "${AWS_ARGS[@]}" \
    "$IMAGE" bash "code/scripts/dev/run_robots/$SCRIPT"
