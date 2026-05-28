#!/usr/bin/env bash
set -euo pipefail

# Deploy react-game to S3 test bucket and invalidate CloudFront test distribution.

PROJECT_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
  . "$ENV_FILE"
  echo "Loaded test environment variables from $ENV_FILE"
fi

if [ -z "${AWS_S3_BUCKET_WEBSITE_TEST:-}" ]; then
  echo "Error: AWS_S3_BUCKET_WEBSITE_TEST must be set in the environment or .env file."
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

echo "=== Sync to s3://$AWS_S3_BUCKET_WEBSITE_TEST ==="
cd "$PROJECT_ROOT"
aws s3 sync "$REACT_GAME_DIR/dist/" "s3://$AWS_S3_BUCKET_WEBSITE_TEST" --delete

if [ -n "${AWS_CLOUDFRONT_DISTRIBUTION_ID_TEST:-}" ]; then
  echo "=== Invalidate CloudFront $AWS_CLOUDFRONT_DISTRIBUTION_ID_TEST ==="
  aws cloudfront create-invalidation --distribution-id "$AWS_CLOUDFRONT_DISTRIBUTION_ID_TEST" --paths "/*"
else
  echo "AWS_CLOUDFRONT_DISTRIBUTION_ID_TEST not set — skipping invalidation."
fi

echo "=== Deploy test complete: https://test.paths.games ==="
