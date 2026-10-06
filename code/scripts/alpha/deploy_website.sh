#!/usr/bin/env bash
# v0.42.0 — builds react-game in alpha mode and publishes it at the root of the production site (bucket pathsgames-com).
# Usage: deploy_website.sh [--check-only]; needs AWS_ALPHA_S3_BUCKET_WEBSITE and AWS_ALPHA_CLOUDFRONT_DISTRIBUTION_ID.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
REACT_GAME_DIR="$PROJECT_ROOT/code/frontend/react-game"
EXAMPLE_FILE="$REACT_GAME_DIR/.env.example"
ALPHA_FILE="$REACT_GAME_DIR/.env.alpha"
PLACEHOLDER="CHANGE_ME"

usage() { sed -n '2,3p' "$0" | sed 's/^# \{0,1\}//'; }

CHECK_ONLY=false
for _arg in "$@"; do
	case "$_arg" in
		--check-only) CHECK_ONLY=true ;;
		-h|--help) usage; exit 0 ;;
		*) echo "Error: unknown argument '$_arg'." >&2; usage >&2; exit 2 ;;
	esac
done

# Guard: Vite loads .env first, so a VITE_* key missing from .env.alpha would ship its dev value.
check_alpha_env() {
	local key value missing=() placeholders=()
	if [ ! -f "$ALPHA_FILE" ]; then
		echo "Error: $ALPHA_FILE not found (not versioned: create it with every VITE_* key of .env.example)." >&2
		return 1
	fi
	while IFS= read -r key; do
		if ! grep -q "^${key}=" "$ALPHA_FILE"; then
			missing+=("$key")
			continue
		fi
		value="$(grep -m1 "^${key}=" "$ALPHA_FILE" | cut -d= -f2- | tr -d "\"'")"
		if [ "$value" = "$PLACEHOLDER" ]; then placeholders+=("$key"); fi
	done < <(sed -n 's/^\(VITE_[A-Za-z0-9_]*\)=.*/\1/p' "$EXAMPLE_FILE" | sort -u)
	if [ "${#missing[@]}" -gt 0 ] || [ "${#placeholders[@]}" -gt 0 ]; then
		[ "${#missing[@]}" -gt 0 ] && echo "Error: VITE keys missing from .env.alpha: ${missing[*]}" >&2
		[ "${#placeholders[@]}" -gt 0 ] && echo "Error: VITE keys still set to $PLACEHOLDER in .env.alpha: ${placeholders[*]}" >&2
		echo "Refusing to build: every VITE_* key of .env.example must have its alpha value." >&2
		return 1
	fi
	echo ".env.alpha complete: every VITE_* key of .env.example is set."
}

check_alpha_env
if [ "$CHECK_ONLY" = "true" ]; then
	exit 0
fi

ENV_FILE="$PROJECT_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
	# shellcheck disable=SC1090
	. "$ENV_FILE"
fi
BUCKET="${AWS_ALPHA_S3_BUCKET_WEBSITE:-}"
DISTRIBUTION="${AWS_ALPHA_CLOUDFRONT_DISTRIBUTION_ID:-}"
if [ -z "$BUCKET" ] || [ -z "$DISTRIBUTION" ]; then
	echo "Error: AWS_ALPHA_S3_BUCKET_WEBSITE and AWS_ALPHA_CLOUDFRONT_DISTRIBUTION_ID must be set (.env or environment)." >&2
	exit 1
fi

echo "=== Build react-game (mode alpha) ==="
cd "$REACT_GAME_DIR"
npm run build -- --mode alpha

# data/* is the story catalog written by the Story Lambda: no deploy ever touches it.
echo "=== Pass 1: hashed assets/ to s3://$BUCKET (immutable, one year) ==="
aws s3 sync "$REACT_GAME_DIR/dist/assets/" "s3://$BUCKET/assets/" --delete \
	--cache-control "public, max-age=31536000, immutable"

echo "=== Pass 2: index.html and the root files to s3://$BUCKET (no-cache) ==="
aws s3 sync "$REACT_GAME_DIR/dist/" "s3://$BUCKET" --delete \
	--exclude "assets/*" --exclude "data/*" \
	--cache-control "no-cache"

echo "=== Invalidate /index.html and / on $DISTRIBUTION ==="
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION" --paths "/index.html" "/"

echo "=== Alpha website deployed: https://paths.games ==="
