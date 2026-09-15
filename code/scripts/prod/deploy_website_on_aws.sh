# NO COMMIT 
# This file is used to deploy the website to S3 and invalidate the CloudFront cache.

# Load .env from repository root if present
PROJECT_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
	# shellcheck disable=SC1090
	. "$ENV_FILE"
fi

# If not present in .env, these variables must be set in the environment before running the script
if [ -z "${AWS_S3_BUCKET_WEBSITE:-}" ] || [ -z "${AWS_CLOUDFRONT_DISTRIBUTION_ID:-}" ]; then
    echo "Error: AWS_S3_BUCKET_WEBSITE and AWS_CLOUDFRONT_DISTRIBUTION_ID must be set in the environment or .env file."
    exit 1
fi

# v0.37.6 — keep data/ (static story catalog written by the admin API) across deploys.
aws s3 sync code/website/html/ s3://$AWS_S3_BUCKET_WEBSITE --delete --exclude "data/*"
aws cloudfront create-invalidation --distribution-id $AWS_CLOUDFRONT_DISTRIBUTION_ID --paths "/*"

