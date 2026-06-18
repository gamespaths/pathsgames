#!/usr/bin/env bash
# start.sh — Launch an EC2 instance running Paths Games PYTHON backend with plain Docker
#             (NO docker compose, NO nginx): two `docker run` containers
#               1. postgres:16-alpine        (PostgreSQL)
#               2. <DOCKERHUB_USERNAME>/<DOCKERHUB_IMAGE>:<IMAGE_TAG>
#                  (FastAPI/uvicorn, serves BOTH public 8042 + admin 8044 via
#                   `python -m app.launcher`; PULLED from Docker Hub — built locally
#                   by ../build_docker_python_test_and_push.sh, NOT built on the instance)
#
# This is the PYTHON twin of aws_ec2_with_java_docker/start.sh (server3).
# Differences vs the Java version:
#   * reads *_TEST_EC2_PY overrides (instance name, DNS, image tag, CloudFront)
#   * default instance api-test-server3 / DNS api-test-server3.paths.games
#   * backend.env uses the Python env keys (ENV, HOST, PORT, DB_USER, …) — NOT Spring's
#   * optionally seeds the Tutorial + Demo stories after boot (scripts/seed_stories.py)
#
# What it does:
#   0. If an instance named INSTANCE_NAME already exists → print it and EXIT
#      (image updates on a running instance are handled by ./redeploy.sh).
#   1. Detect current public IP
#   2. Create EC2 security group with rules:
#        - TCP 22   from current IP        (SSH)
#        - TCP 8042 from 0.0.0.0/0         (public API — open to ALL)
#        - TCP 8044 from current IP only   (admin API — locked to owner)
#   3. Find latest Ubuntu 24.04 LTS AMI in region
#   4. Build user-data script that:
#        - Installs Docker
#        - Creates a docker bridge network
#        - Runs postgres via `docker run`
#        - Writes /opt/pathsgames/backend.env (DB creds, JWT, ports — Python keys)
#        - Pulls the backend image from Docker Hub (`docker pull`)
#        - Runs the backend via `docker run --env-file` (publishes 8042 + 8044)
#        - Optionally seeds stories (docker exec … python scripts/seed_stories.py)
#   5. Launch EC2 instance
#   6. Save state to .state file (for stop.sh / redeploy.sh)
#   7. Optionally upsert a Route53 A record (or CloudFront alias)
#   8. Print instance public IP when ready
#
# Usage:
#   ./start.sh            # launch EC2 (no-op if it already exists)
#   ./start.sh --dry-run  # print user-data without launching

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
STATE_FILE="$SCRIPT_DIR/.state"

# ── Load the project ROOT .env ────────────────────────────────────────────────
# All config lives in the root .env: shared *_TEST vars + EC2-specific *_TEST_EC2
# + python-server overrides *_TEST_EC2_PY.
ROOT_ENV="$(cd "$SCRIPT_DIR/../../../.." && pwd)/.env"
if [ -f "$ROOT_ENV" ]; then
    set -a; . "$ROOT_ENV"; set +a
    echo "[start.sh] Loaded $ROOT_ENV"
else
    echo "[start.sh] WARNING: root .env not found at $ROOT_ENV — using defaults."
fi

# ── Config — bound from the ROOT .env ────────────────────────────────────────
AWS_REGION="${AWS_REGION_TEST:-us-east-2}"
EC2_KEY_NAME="${EC2_KEY_NAME_TEST_EC2:-paths-games-ohio}"
EC2_INSTANCE_TYPE="${EC2_INSTANCE_TYPE_TEST_EC2:-t3.small}"
# Docker Hub image pulled on the instance (public repo → no login needed on EC2).
# Build & push it with code/scripts/test/build_docker_python_test_and_push.sh
DOCKERHUB_USERNAME="${DOCKERHUB_USERNAME_TEST:?DOCKERHUB_USERNAME_TEST must be set in the root .env}"
DOCKERHUB_IMAGE="${DOCKERHUB_IMAGE_TEST:-pathsgames-backend}"
IMAGE_TAG="${DOCKERHUB_IMAGE_TAG_PYTHON_TEST:-test-python}"
BACKEND_IMAGE="${DOCKERHUB_USERNAME}/${DOCKERHUB_IMAGE}:${IMAGE_TAG}"
DB_NAME="${DB_NAME_TEST_EC2:-pathsgames}"
DB_USERNAME="${DB_USERNAME_TEST_EC2:-pathsgames}"
DB_PASSWORD="${DB_PASSWORD_TEST_EC2:?DB_PASSWORD_TEST_EC2 must be set in the root .env}"
JWT_SECRET="${JWT_SECRET:?JWT_SECRET must be set in the root .env}"
# Deployment environment reported by /api/echo/status. For the Python backend ANY
# value other than "development" selects PostgreSQL (see app/adapters/persistence/database.py).
SERVER_ENVIRONMENT="${AWS_ENVIRONMENT_NAME_TEST:-test}"
# Seed the Tutorial + Demo stories after boot (true|false)
SEED_ON_START="${SEED_ON_START_PY:-true}"
# Host ports published by the backend container
PUBLIC_PORT="${PUBLIC_PORT_TEST_EC2:-8042}"   # public API — open to all
ADMIN_PORT="${ADMIN_PORT_TEST_EC2:-8044}"     # admin API  — owner IP only
# Public API source CIDRs (default: everyone)
PUBLIC_CIDRS="${PUBLIC_CIDRS_TEST_EC2:-0.0.0.0/0}"
# Extra source CIDRs allowed on the admin port (comma OR space separated, optional).
# The current public IP is ALWAYS added automatically.
ADMIN_EXTRA_CIDRS="${ADMIN_EXTRA_CIDRS_TEST_EC2:-}"
# Route53 (optional — leave AWS_DOMAIN_HOSTED_ZONE_TEST empty to skip DNS)
ROUTE53_HOSTED_ZONE_ID="${AWS_DOMAIN_HOSTED_ZONE_TEST:-}"
ROUTE53_RECORD_NAME="${ROUTE53_RECORD_NAME_TEST_EC2_PY:-api-test-server3.paths.games}"
EC2_KEY_PATH=${EC2_KEY_PATH_TEST_EC2:-~/.ssh/${EC2_KEY_NAME}.pem}

# CloudFront — optional HTTPS front for the PUBLIC API (8042) ONLY.
# Admin (8044) stays SG-locked to your IP; reach it over SSH tunnel.
ENABLE_CLOUDFRONT="${ENABLE_CLOUDFRONT_TEST_EC2_PY:-false}"
ACM_CERT_ARN="${CLOUDFRONT_DOMAIN_CERTIFICATE_ARN_TEST_EC2_PY:-}"     # MUST be a us-east-1 cert covering ROUTE53_RECORD_NAME
CLOUDFRONT_PRICE_CLASS="${CLOUDFRONT_PRICE_CLASS_TEST_EC2_PY:-PriceClass_100}"
# AWS-managed policies: CachingDisabled + AllViewer (stable global IDs)
CF_CACHE_POLICY_ID="4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
CF_ORIGIN_REQ_POLICY_ID="216adef6-5c7f-47e4-b989-5492eafa07d3"
CF_ALIAS_ZONE_ID="Z2FDTNDATAQYW2"   # fixed Route53 zone ID shared by all CloudFront aliases

if [ "$ENABLE_CLOUDFRONT" = "true" ]; then
    [ -n "$ACM_CERT_ARN" ]           || { echo "[start.sh] ERROR: ENABLE_CLOUDFRONT=true requires ACM_CERT_ARN (a cert in us-east-1)"; exit 1; }
    [ -n "$ROUTE53_HOSTED_ZONE_ID" ] || { echo "[start.sh] ERROR: ENABLE_CLOUDFRONT=true requires ROUTE53_HOSTED_ZONE_ID (alias DNS)"; exit 1; }
    [ -n "$ROUTE53_RECORD_NAME" ]    || { echo "[start.sh] ERROR: ENABLE_CLOUDFRONT=true requires ROUTE53_RECORD_NAME (the public HTTPS host / CloudFront alias)"; exit 1; }
fi

# Fixed names — idempotent (not timestamp-based)
INSTANCE_NAME=${INSTANCE_NAME_TEST_EC2_PY:-"api-test-server3"}
SG_NAME="${INSTANCE_NAME}-sg"

# Tags applied to every taggable resource we create (SG, instance, volume).
ENV_TAG="${ENV_TAG:-test}"
PROJECT_TAG="PathsGames"
COMMON_TAGS="Key=env,Value=$ENV_TAG Key=createdBy,Value=SH Key=project,Value=$PROJECT_TAG"
COMMON_TAGSPEC="{Key=env,Value=$ENV_TAG},{Key=createdBy,Value=SH},{Key=project,Value=$PROJECT_TAG}"

# ── Short-circuit: if the instance already exists, do NOTHING ─────────────────
INSTANCE_ID="None"
if [ "${1:-}" != "--dry-run" ]; then
    echo "[start.sh] Looking up existing instance '$INSTANCE_NAME'…"
    INSTANCE_ID="$(aws ec2 describe-instances \
        --region "$AWS_REGION" \
        --filters \
            "Name=tag:Name,Values=$INSTANCE_NAME" \
            "Name=instance-state-name,Values=pending,running,stopping,stopped" \
        --query 'Reservations[0].Instances[0].InstanceId' \
        --output text 2>/dev/null || echo 'None')"

    if [ "$INSTANCE_ID" != "None" ] && [ -n "$INSTANCE_ID" ]; then
        EXIST_IP="$(aws ec2 describe-instances \
            --region "$AWS_REGION" --instance-ids "$INSTANCE_ID" \
            --query 'Reservations[0].Instances[0].PublicIpAddress' \
            --output text 2>/dev/null || echo '')"
        echo ""
        echo "╔══════════════════════════════════════════════════════════╗"
        echo "║  Instance already exists — start.sh does NOTHING         ║"
        echo "╠══════════════════════════════════════════════════════════╣"
        printf "║  Instance ID : %-43s║\n" "$INSTANCE_ID"
        printf "║  Name        : %-43s║\n" "$INSTANCE_NAME"
        printf "║  Public IP   : %-43s║\n" "${EXIST_IP:-<none>}"
        echo   "╠══════════════════════════════════════════════════════════╣"
        echo   "║  Deploy a new image : ./redeploy.sh                      ║"
        echo   "║  Tear it down       : ./stop.sh                          ║"
        echo   "╚══════════════════════════════════════════════════════════╝"
        exit 0
    fi
    echo "[start.sh] No existing instance — creating a fresh one."
fi

# ── Detect current public IP ──────────────────────────────────────────────────
echo "[start.sh] Detecting current public IP…"
MY_IP="$(curl -sf --max-time 5 https://checkip.amazonaws.com \
    || curl -sf --max-time 5 https://api.ipify.org \
    || echo '')"
if [ -z "$MY_IP" ]; then
    echo "[start.sh] ERROR: could not detect current public IP. Check internet connectivity."
    exit 1
fi
echo "[start.sh] My IP: $MY_IP"

# Build admin source CIDR list = my IP + any ADMIN_EXTRA_CIDRS (dedup)
ADMIN_CIDRS="$(echo "$MY_IP/32 ${ADMIN_EXTRA_CIDRS//,/ }" \
    | tr ' ' '\n' | awk 'NF && !seen[$0]++' | tr '\n' ' ')"

# ── Find latest Ubuntu 24.04 LTS AMI ─────────────────────────────────────────
echo "[start.sh] Finding latest Ubuntu 24.04 LTS AMI in $AWS_REGION…"
AMI_ID="$(aws ec2 describe-images \
    --region "$AWS_REGION" \
    --owners 099720109477 \
    --filters \
        "Name=name,Values=ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*" \
        "Name=state,Values=available" \
    --query 'sort_by(Images, &CreationDate)[-1].ImageId' \
    --output text)"
echo "[start.sh] AMI: $AMI_ID"

# ── Get or create security group ─────────────────────────────────────────────
echo "[start.sh] Looking up security group '$SG_NAME'…"
VPC_ID="$(aws ec2 describe-vpcs \
    --region "$AWS_REGION" \
    --filters "Name=is-default,Values=true" \
    --query 'Vpcs[0].VpcId' \
    --output text)"
echo "[start.sh] VPC: $VPC_ID"

SG_ID="$(aws ec2 describe-security-groups \
    --region "$AWS_REGION" \
    --filters "Name=group-name,Values=$SG_NAME" "Name=vpc-id,Values=$VPC_ID" \
    --query 'SecurityGroups[0].GroupId' \
    --output text 2>/dev/null || echo 'None')"

if [ "$SG_ID" = "None" ] || [ -z "$SG_ID" ]; then
    echo "[start.sh] Creating security group '$SG_NAME'…"
    SG_ID="$(aws ec2 create-security-group \
        --region "$AWS_REGION" \
        --group-name "$SG_NAME" \
        --description "Paths Games $INSTANCE_NAME (plain docker, python) - managed by start.sh" \
        --vpc-id "$VPC_ID" \
        --query 'GroupId' \
        --output text)"
    echo "[start.sh] Security group created: $SG_ID"
else
    echo "[start.sh] Security group already exists: $SG_ID — reusing"
fi

# Tag SG (idempotent)
aws ec2 create-tags \
    --region "$AWS_REGION" \
    --resources "$SG_ID" \
    --tags "Key=Name,Value=$SG_NAME" $COMMON_TAGS 2>/dev/null \
    || echo "[start.sh] WARNING: could not tag SG (continuing)"

# Helper: add ingress rule, ignore DuplicatePermission
_add_ingress() {
    aws ec2 authorize-security-group-ingress "$@" --no-cli-pager 2>&1 \
        | grep -v "InvalidPermission.Duplicate" || true
}

# SSH — owner only
_add_ingress --region "$AWS_REGION" --group-id "$SG_ID" \
    --protocol tcp --port 22 --cidr "$MY_IP/32"
echo "[start.sh]   TCP 22 → $MY_IP/32 (SSH)"

# Public API — open to all
for CIDR in $PUBLIC_CIDRS; do
    _add_ingress --region "$AWS_REGION" --group-id "$SG_ID" \
        --protocol tcp --port "$PUBLIC_PORT" --cidr "$CIDR"
    echo "[start.sh]   TCP $PUBLIC_PORT → $CIDR (public API)"
done

# Admin API — owner IP (+ optional extras) only
for CIDR in $ADMIN_CIDRS; do
    _add_ingress --region "$AWS_REGION" --group-id "$SG_ID" \
        --protocol tcp --port "$ADMIN_PORT" --cidr "$CIDR"
    echo "[start.sh]   TCP $ADMIN_PORT → $CIDR (admin API — restricted)"
done

# ── Build user-data script ────────────────────────────────────────────────────
# NOTE: unquoted heredoc — ${VAR} below are expanded LOCALLY (config injection).
#       \$ and \$(...) are escaped so they run ON THE INSTANCE at boot.
USER_DATA="$(cat <<USERDATA
#!/bin/bash
set -euo pipefail
exec > /var/log/pathsgames-init.log 2>&1

# ── System packages ────────────────────────────────────────────────────────
sudo apt-get update -y
sudo apt-get install -y curl ca-certificates gnupg

# ── Docker (official repo) — NO docker compose plugin needed ───────────────
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=\$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  \$(. /etc/os-release && echo "\$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin
sudo usermod -aG docker ubuntu
sudo systemctl enable docker
sudo systemctl start docker

# ── App dir (holds the backend env-file; no git checkout needed) ────────────
sudo mkdir -p /opt/pathsgames
sudo chmod 777 /opt/pathsgames/

# ── Private bridge network so backend can reach postgres by name ───────────
sudo docker network create pathsgames-net || true

# ── 1. PostgreSQL container ────────────────────────────────────────────────
sudo docker run -d \
  --name pathsgames-postgres \
  --restart unless-stopped \
  --network pathsgames-net \
  -e POSTGRES_DB=${DB_NAME} \
  -e POSTGRES_USER=${DB_USERNAME} \
  -e POSTGRES_PASSWORD=${DB_PASSWORD} \
  -v pathsgames_pgdata:/var/lib/postgresql/data \
  postgres:16-alpine

# Wait for PostgreSQL to accept connections
echo "Waiting for PostgreSQL…"
for i in \$(seq 1 30); do
  if sudo docker exec pathsgames-postgres pg_isready -U ${DB_USERNAME} -d ${DB_NAME} >/dev/null 2>&1; then
    echo "PostgreSQL ready"
    break
  fi
  sleep 2
done

# ── 2. Backend env-file (consumed by docker run --env-file; reused by redeploy.sh)
#       Python keys (NOT Spring): ENV != "development" selects PostgreSQL.
cat > /opt/pathsgames/backend.env <<'ENVEOF'
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
chmod 600 /opt/pathsgames/backend.env

# ── 3. Pull the test image from Docker Hub (public repo → no login) ────────
sudo docker pull ${BACKEND_IMAGE}

# ── 4. Backend container — publish public 8042 + admin 8044 directly ──────
sudo docker run -d \
  --name pathsgames-backend \
  --restart unless-stopped \
  --network pathsgames-net \
  -p ${PUBLIC_PORT}:8042 \
  -p ${ADMIN_PORT}:8044 \
  --env-file /opt/pathsgames/backend.env \
  ${BACKEND_IMAGE}

# ── 5. Seed Tutorial + Demo stories (optional) ─────────────────────────────
if [ "${SEED_ON_START}" = "true" ]; then
  echo "Waiting for backend health before seeding…"
  for i in \$(seq 1 40); do
    if curl -sf --max-time 3 http://127.0.0.1:${PUBLIC_PORT}/api/echo/status >/dev/null 2>&1; then
      echo "Backend healthy — seeding stories"
      sudo docker exec pathsgames-backend python scripts/seed_stories.py || echo "WARNING: seed failed (continuing)"
      break
    fi
    sleep 3
  done
fi

echo "PathsGames python stack started successfully (plain docker, image from Docker Hub)"
USERDATA
)"

# ── Dry-run mode ──────────────────────────────────────────────────────────────
if [ "${1:-}" = "--dry-run" ]; then
    echo ""
    echo "=== DRY RUN — user-data that would be passed to EC2 ==="
    echo "$USER_DATA"
    echo "=== END DRY RUN ==="
    echo "[start.sh] SG $SG_ID kept — delete manually if not needed"
    exit 0
fi

# ── Launch the EC2 instance ───────────────────────────────────────────────────
echo "[start.sh] Launching new EC2 instance '$INSTANCE_NAME' ($EC2_INSTANCE_TYPE)…"
INSTANCE_ID="$(aws ec2 run-instances \
    --region "$AWS_REGION" \
    --image-id "$AMI_ID" \
    --instance-type "$EC2_INSTANCE_TYPE" \
    --key-name "$EC2_KEY_NAME" \
    --security-group-ids "$SG_ID" \
    --user-data "$USER_DATA" \
    --tag-specifications \
        "ResourceType=instance,Tags=[{Key=Name,Value=$INSTANCE_NAME},$COMMON_TAGSPEC]" \
        "ResourceType=volume,Tags=[{Key=Name,Value=${INSTANCE_NAME}-vol},$COMMON_TAGSPEC]" \
    --query 'Instances[0].InstanceId' \
    --output text)"
echo "[start.sh] Instance launched: $INSTANCE_ID"

# Ensure instance carries the common tags (idempotent)
aws ec2 create-tags \
    --region "$AWS_REGION" \
    --resources "$INSTANCE_ID" \
    --tags "Key=Name,Value=$INSTANCE_NAME" $COMMON_TAGS 2>/dev/null \
    || echo "[start.sh] WARNING: could not tag instance (continuing)"

# ── Save state ────────────────────────────────────────────────────────────────
cat > "$STATE_FILE" <<STATEOF
INSTANCE_ID=$INSTANCE_ID
SG_ID=$SG_ID
AWS_REGION=$AWS_REGION
INSTANCE_NAME=$INSTANCE_NAME
SG_NAME=$SG_NAME
BACKEND_IMAGE=$BACKEND_IMAGE
ROUTE53_HOSTED_ZONE_ID=$ROUTE53_HOSTED_ZONE_ID
ROUTE53_RECORD_NAME=$ROUTE53_RECORD_NAME
LAUNCHED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
STATEOF
echo "[start.sh] State saved to $STATE_FILE"

# ── Wait for running state ────────────────────────────────────────────────────
echo "[start.sh] Waiting for instance to be running…"
aws ec2 wait instance-running \
    --region "$AWS_REGION" \
    --instance-ids "$INSTANCE_ID"

read -r PUBLIC_IP PUBLIC_DNS < <(aws ec2 describe-instances \
    --region "$AWS_REGION" \
    --instance-ids "$INSTANCE_ID" \
    --query 'Reservations[0].Instances[0].[PublicIpAddress,PublicDnsName]' \
    --output text)
echo "[start.sh] Public IP : $PUBLIC_IP"
echo "[start.sh] Public DNS: $PUBLIC_DNS"

# ── Route53 A record → EC2 public IP (only when CloudFront is OFF) ───────────
if [ -n "$ROUTE53_HOSTED_ZONE_ID" ] && [ "$ENABLE_CLOUDFRONT" != "true" ]; then
    echo "[start.sh] Upserting Route53 A record $ROUTE53_RECORD_NAME → $PUBLIC_IP …"
    CHANGE_BATCH="$(printf '{"Changes":[{"Action":"UPSERT","ResourceRecordSet":{"Name":"%s","Type":"A","TTL":60,"ResourceRecords":[{"Value":"%s"}]}}]}' "$ROUTE53_RECORD_NAME" "$PUBLIC_IP")"
    CHANGE_ID="$(aws route53 change-resource-record-sets \
        --hosted-zone-id "$ROUTE53_HOSTED_ZONE_ID" \
        --change-batch "$CHANGE_BATCH" \
        --query 'ChangeInfo.Id' \
        --output text 2>/dev/null || echo '')"
    if [ -n "$CHANGE_ID" ]; then
        echo "[start.sh] Route53 change submitted: $CHANGE_ID ✓"
        echo "DNS_CHANGE_ID=$CHANGE_ID" >> "$STATE_FILE"
    else
        echo "[start.sh] WARNING: Route53 update failed — DNS record not created (continuing)"
    fi
elif [ -z "$ROUTE53_HOSTED_ZONE_ID" ]; then
    echo "[start.sh] ROUTE53_HOSTED_ZONE_ID empty — skipping direct DNS record"
else
    echo "[start.sh] CloudFront enabled — ROUTE53_RECORD_NAME will alias the distribution (below)"
fi
echo "PUBLIC_IP=$PUBLIC_IP" >> "$STATE_FILE"

# ── CloudFront — HTTPS front for the public API (optional) ───────────────────
CF_DOMAIN=""
if [ "$ENABLE_CLOUDFRONT" = "true" ]; then
  if [ -z "$PUBLIC_DNS" ] || [ "$PUBLIC_DNS" = "None" ]; then
    echo "[start.sh] WARNING: instance has no public DNS name — cannot set CloudFront origin, skipping CloudFront"
  else
    echo "[start.sh] CloudFront enabled — https://$ROUTE53_RECORD_NAME → http://$PUBLIC_DNS:$PUBLIC_PORT (EC2)"

    DIST_ID="$(aws cloudfront list-distributions \
        --query "DistributionList.Items[?contains(Aliases.Items, '$ROUTE53_RECORD_NAME')].Id | [0]" \
        --output text 2>/dev/null || echo 'None')"

    if [ "$DIST_ID" = "None" ] || [ -z "$DIST_ID" ]; then
        echo "[start.sh] Creating CloudFront distribution…"
        CF_CONFIG_FILE="$(mktemp)"
        cat > "$CF_CONFIG_FILE" <<CFEOF
{
  "DistributionConfig": {
    "CallerReference": "pathsgames-${INSTANCE_NAME}-$(date +%s)",
    "Aliases": { "Quantity": 1, "Items": ["$ROUTE53_RECORD_NAME"] },
    "DefaultRootObject": "",
    "Origins": {
      "Quantity": 1,
      "Items": [{
        "Id": "ec2-origin",
        "DomainName": "$PUBLIC_DNS",
        "OriginPath": "",
        "CustomHeaders": { "Quantity": 0 },
        "CustomOriginConfig": {
          "HTTPPort": $PUBLIC_PORT,
          "HTTPSPort": 443,
          "OriginProtocolPolicy": "http-only",
          "OriginSslProtocols": { "Quantity": 1, "Items": ["TLSv1.2"] },
          "OriginReadTimeout": 30,
          "OriginKeepaliveTimeout": 5
        }
      }]
    },
    "OriginGroups": { "Quantity": 0 },
    "DefaultCacheBehavior": {
      "TargetOriginId": "ec2-origin",
      "ViewerProtocolPolicy": "redirect-to-https",
      "TrustedSigners": { "Enabled": false, "Quantity": 0 },
      "TrustedKeyGroups": { "Enabled": false, "Quantity": 0 },
      "AllowedMethods": {
        "Quantity": 7,
        "Items": ["GET","HEAD","OPTIONS","PUT","POST","PATCH","DELETE"],
        "CachedMethods": { "Quantity": 2, "Items": ["GET","HEAD"] }
      },
      "SmoothStreaming": false,
      "Compress": true,
      "LambdaFunctionAssociations": { "Quantity": 0 },
      "FunctionAssociations": { "Quantity": 0 },
      "FieldLevelEncryptionId": "",
      "CachePolicyId": "$CF_CACHE_POLICY_ID",
      "OriginRequestPolicyId": "$CF_ORIGIN_REQ_POLICY_ID"
    },
    "CacheBehaviors": { "Quantity": 0 },
    "CustomErrorResponses": { "Quantity": 0 },
    "Comment": "PathsGames $INSTANCE_NAME public API (HTTPS front)",
    "Logging": { "Enabled": false, "IncludeCookies": false, "Bucket": "", "Prefix": "" },
    "PriceClass": "$CLOUDFRONT_PRICE_CLASS",
    "Enabled": true,
    "ViewerCertificate": {
      "CloudFrontDefaultCertificate": false,
      "ACMCertificateArn": "$ACM_CERT_ARN",
      "SSLSupportMethod": "sni-only",
      "MinimumProtocolVersion": "TLSv1.2_2021"
    },
    "Restrictions": { "GeoRestriction": { "RestrictionType": "none", "Quantity": 0 } },
    "WebACLId": "",
    "HttpVersion": "http2and3",
    "IsIPV6Enabled": true
  },
  "Tags": {
    "Items": [
      { "Key": "Name",      "Value": "${INSTANCE_NAME}-cf" },
      { "Key": "env",       "Value": "$ENV_TAG" },
      { "Key": "createdBy", "Value": "SH" },
      { "Key": "project",   "Value": "$PROJECT_TAG" }
    ]
  }
}
CFEOF
        CF_CREATE="$(aws cloudfront create-distribution-with-tags \
            --distribution-config-with-tags "file://$CF_CONFIG_FILE" \
            --query '[Distribution.Id,Distribution.DomainName]' \
            --output text 2>&1)" \
            || { echo "[start.sh] ERROR: CloudFront create failed:"; echo "$CF_CREATE"; rm -f "$CF_CONFIG_FILE"; exit 1; }
        rm -f "$CF_CONFIG_FILE"
        DIST_ID="$(echo "$CF_CREATE" | awk '{print $1}')"
        CF_DOMAIN="$(echo "$CF_CREATE" | awk '{print $2}')"
        echo "[start.sh] CloudFront created: $DIST_ID ($CF_DOMAIN)"
    else
        CF_DOMAIN="$(aws cloudfront get-distribution --id "$DIST_ID" \
            --query 'Distribution.DomainName' --output text)"
        echo "[start.sh] CloudFront already exists: $DIST_ID ($CF_DOMAIN) — reusing"
        CUR_CFG="$(mktemp)"
        CUR_ETAG="$(aws cloudfront get-distribution-config --id "$DIST_ID" \
            --query 'ETag' --output text 2>/dev/null || echo '')"
        aws cloudfront get-distribution-config --id "$DIST_ID" \
            --query 'DistributionConfig' --output json > "$CUR_CFG" 2>/dev/null || true
        CUR_ORIGIN="$(python3 -c "import json;print(json.load(open('$CUR_CFG'))['Origins']['Items'][0]['DomainName'])" 2>/dev/null || echo '')"
        if [ -n "$CUR_ETAG" ] && [ -n "$CUR_ORIGIN" ] && [ "$CUR_ORIGIN" != "$PUBLIC_DNS" ]; then
            echo "[start.sh] Origin changed ($CUR_ORIGIN → $PUBLIC_DNS) — updating distribution…"
            python3 -c "import json;d=json.load(open('$CUR_CFG'));d['Origins']['Items'][0]['DomainName']='$PUBLIC_DNS';json.dump(d,open('$CUR_CFG','w'))"
            aws cloudfront update-distribution --id "$DIST_ID" \
                --distribution-config "file://$CUR_CFG" --if-match "$CUR_ETAG" --no-cli-pager >/dev/null 2>&1 \
                && echo "[start.sh] Origin updated ✓" \
                || echo "[start.sh] WARNING: origin update failed (continuing)"
        fi
        rm -f "$CUR_CFG"
    fi

    echo "[start.sh] Upserting Route53 alias $ROUTE53_RECORD_NAME → $CF_DOMAIN …"
    CF_DNS_BATCH="$(printf '{"Changes":[{"Action":"UPSERT","ResourceRecordSet":{"Name":"%s","Type":"A","AliasTarget":{"HostedZoneId":"%s","DNSName":"%s","EvaluateTargetHealth":false}}}]}' \
        "$ROUTE53_RECORD_NAME" "$CF_ALIAS_ZONE_ID" "$CF_DOMAIN")"
    aws route53 change-resource-record-sets \
        --hosted-zone-id "$ROUTE53_HOSTED_ZONE_ID" \
        --change-batch "$CF_DNS_BATCH" --no-cli-pager >/dev/null 2>&1 \
        && echo "[start.sh] CloudFront alias DNS upserted ✓" \
        || echo "[start.sh] WARNING: CloudFront alias DNS upsert failed (continuing)"

    {
        echo "CLOUDFRONT_DIST_ID=$DIST_ID"
        echo "CLOUDFRONT_DOMAIN=$CF_DOMAIN"
    } >> "$STATE_FILE"
    echo "[start.sh] NOTE: CloudFront needs ~5-15 min to deploy globally before HTTPS works."
  fi
fi

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Paths Games PYTHON EC2 instance is RUNNING (plain docker)║"
echo "╠══════════════════════════════════════════════════════════╣"
printf "║  Instance ID : %-43s║\n" "$INSTANCE_ID"
printf "║  Name        : %-43s║\n" "$INSTANCE_NAME"
printf "║  Public IP   : %-43s║\n" "$PUBLIC_IP"
printf "║  DNS record  : %-43s║\n" "${ROUTE53_HOSTED_ZONE_ID:+$ROUTE53_RECORD_NAME}"
printf "║  Region      : %-43s║\n" "$AWS_REGION"
printf "║  Public port : %-43s║\n" "$PUBLIC_PORT (open to all)"
printf "║  Admin port  : %-43s║\n" "$ADMIN_PORT (owner IP only)"
printf "║  Image       : %-43s║\n" "$BACKEND_IMAGE"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  API (after ~1-2 min init + image pull):                 ║"
printf "║  http://%-49s║\n" "$PUBLIC_IP:$PUBLIC_PORT/api/echo/status"
printf "║  http://%-49s║\n" "$PUBLIC_IP:$ADMIN_PORT/api/admin/matches (you only)"
if [ "$ENABLE_CLOUDFRONT" = "true" ] && [ -n "$ROUTE53_HOSTED_ZONE_ID" ]; then
    echo   "╠══════════════════════════════════════════════════════════╣"
    echo   "║  HTTPS via CloudFront (after ~5-15 min deploy):          ║"
    printf "║  https://%-48s║\n" "$ROUTE53_RECORD_NAME/api/echo/status"
    printf "║  admin: SSH-tunnel to %-36s║\n" "127.0.0.1:$ADMIN_PORT (no HTTPS front)"
fi
echo   "╠══════════════════════════════════════════════════════════╣"
printf "║  SSH: ssh -i %s ubuntu@%s\n" "$EC2_KEY_PATH" "$PUBLIC_IP"
printf "║  Admin tunnel: ssh -i %s -L %s:localhost:%s ubuntu@%s\n" "$EC2_KEY_PATH" "$ADMIN_PORT" "$ADMIN_PORT" "$PUBLIC_IP"
echo   "╠══════════════════════════════════════════════════════════╣"
printf "║  Tags: env=%s  createdBy=SH  project=PathsGames\n" "$ENV_TAG"
echo   "║  Init log: /var/log/pathsgames-init.log (on instance)    ║"
echo   "║  Redeploy: ./redeploy.sh   (pull latest test-python img) ║"
echo   "║  Stop:     ./stop.sh                                     ║"
echo   "╚══════════════════════════════════════════════════════════╝"

# adminer
# sudo docker run -d --name pathsgames-adminer --restart unless-stopped --network pathsgames-net -p 8046:8080 adminer
# Access Adminer at http://PUBLIC_IP:8046 with Server: pathsgames-postgres
