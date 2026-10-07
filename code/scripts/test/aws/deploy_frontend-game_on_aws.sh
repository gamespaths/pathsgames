#!/usr/bin/env bash
set -euo pipefail

# Deploy react-game to S3 test bucket and invalidate CloudFront test distribution.

PROJECT_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
  . "$ENV_FILE"
  echo "Loaded test environment variables from $ENV_FILE"
fi

if [ -z "${AWS_TEST_S3_BUCKET_WEBSITE:-}" ]; then
  echo "Error: AWS_TEST_S3_BUCKET_WEBSITE must be set in the environment or .env file."
  exit 1
fi

REACT_GAME_DIR="$PROJECT_ROOT/code/frontend/react-game"
ENV_FILE="$REACT_GAME_DIR/.env.test"
if [ -f "$ENV_FILE" ]; then
  . "$ENV_FILE"
  echo "Loaded test environment variables from $ENV_FILE"
fi

echo "=== Build react-game ==="
cd "$REACT_GAME_DIR"
npm run build -- --mode test

echo "=== Sync to s3://$AWS_TEST_S3_BUCKET_WEBSITE ==="
cd "$PROJECT_ROOT"
# v0.37.6 — data/ holds the static catalog written by POST /api/admin/stories/catalog:
# never let --delete wipe it, it is not part of the build.
aws s3 sync "$REACT_GAME_DIR/dist/" "s3://$AWS_TEST_S3_BUCKET_WEBSITE" --delete --exclude "data/*"

if [ -n "${AWS_TEST_CLOUDFRONT_DISTRIBUTION_ID:-}" ]; then
  echo "=== Invalidate CloudFront $AWS_TEST_CLOUDFRONT_DISTRIBUTION_ID ==="
  aws cloudfront create-invalidation --distribution-id "$AWS_TEST_CLOUDFRONT_DISTRIBUTION_ID" --paths "/*"
else
  echo "AWS_TEST_CLOUDFRONT_DISTRIBUTION_ID not set — skipping invalidation."
fi

echo "=== Deploy test complete: https://test.paths.games ==="
