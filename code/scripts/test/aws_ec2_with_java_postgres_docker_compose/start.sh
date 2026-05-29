#!/usr/bin/env bash
# start.sh — Launch an EC2 instance running Paths Games Java backend
#             (Docker Compose: Java Spring Boot + PostgreSQL + Nginx)
#
# What it does:
#   1. Detect current public IP
#   2. Resolve paths.games domain IPs (for port 8042 access)
#   3. Create EC2 security group with rules:
#        - TCP 22   from current IP (SSH)
#        - TCP 8042 from paths.games domain IPs
#        - TCP 8042 from current IP (direct access)
#   4. Find latest Ubuntu 24.04 LTS AMI in region
#   5. Build user-data script that:
#        - Installs Docker, Docker Compose, Git
#        - Clones the repository
#        - Creates .env for java_docker_compose
#        - Runs java_docker_compose/start.sh -d
#   6. Launch EC2 instance
#   7. Save state to .state file (for stop.sh)
#   8. Print instance public IP when ready
#
# Usage:
#   ./start.sh            # launch EC2
#   ./start.sh --dry-run  # print user-data without launching

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
STATE_FILE="$SCRIPT_DIR/.state"

# ── Load .env ─────────────────────────────────────────────────────────────────
if [ -f "$SCRIPT_DIR/.env" ]; then
    set -a; . "$SCRIPT_DIR/.env"; set +a
    echo "[start.sh] Loaded .env"
else
    echo "[start.sh] WARNING: .env not found — using defaults. Copy .env.example to .env and fill in values."
fi

# ── Config with defaults ──────────────────────────────────────────────────────
AWS_REGION="${AWS_REGION:-us-east-2}"
EC2_KEY_NAME="${EC2_KEY_NAME:-paths-games-ohio}"
EC2_INSTANCE_TYPE="${EC2_INSTANCE_TYPE:-t3.small}"
GIT_REPO_URL="${GIT_REPO_URL:?GIT_REPO_URL must be set in .env}"
GIT_BRANCH="${GIT_BRANCH:-main}"
DB_NAME="${DB_NAME:-pathsgames}"
DB_USERNAME="${DB_USERNAME:-pathsgames}"
DB_PASSWORD="${DB_PASSWORD:?DB_PASSWORD must be set in .env}"
JWT_SECRET="${JWT_SECRET:?JWT_SECRET must be set in .env}"
NGINX_PORT="${NGINX_PORT:-8042}"
ALLOWED_DOMAINS="${ALLOWED_DOMAINS:-paths.games,www.paths.games,test.paths.games}"
ROUTE53_HOSTED_ZONE_ID="${ROUTE53_HOSTED_ZONE_ID:?ROUTE53_HOSTED_ZONE_ID must be set in .env}"
ROUTE53_RECORD_NAME="${ROUTE53_RECORD_NAME:-api-test-server2.paths.games}"

# Fixed names — idempotent (not timestamp-based)
INSTANCE_NAME=${INSTANCE_NAME:-"api-test-server2"}
SG_NAME="${INSTANCE_NAME}-sg"

# Common tags applied to all resources
COMMON_TAGS="Key=env,Value=test Key=createdBy,Value=SH Key=project,Value=PathsGames"

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

# Build admin IP whitelist for java_docker_compose (base list + my IP)
BASE_WHITELIST="${ADMIN_IP_WHITELIST:-}"
if [ -n "$BASE_WHITELIST" ]; then
    MERGED_WHITELIST="$BASE_WHITELIST,$MY_IP"
else
    MERGED_WHITELIST="$MY_IP"
fi
# Deduplicate
MERGED_WHITELIST="$(echo "$MERGED_WHITELIST" | tr ',' '\n' | awk 'NF && !seen[$0]++' | tr '\n' ',' | sed 's/,$//')"

# ── Resolve domain IPs for security group ────────────────────────────────────
echo "[start.sh] Resolving domain IPs for port $NGINX_PORT access…"
DOMAIN_CIDRS=""
IFS=',' read -ra DOMAINS <<< "$ALLOWED_DOMAINS"
for DOMAIN in "${DOMAINS[@]}"; do
    DOMAIN="$(echo "$DOMAIN" | xargs)"
    IPS="$(dig +short "$DOMAIN" A 2>/dev/null || host "$DOMAIN" 2>/dev/null | awk '/has address/{print $4}' || true)"
    for IP in $IPS; do
        if [[ "$IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            DOMAIN_CIDRS="$DOMAIN_CIDRS $IP/32"
            echo "  $DOMAIN → $IP"
        fi
    done
done
if [ -z "$DOMAIN_CIDRS" ]; then
    echo "[start.sh] WARNING: could not resolve any domain IPs — port $NGINX_PORT will only be open to MY_IP"
fi

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
        --description "Paths Games api-test-server2 — managed by start.sh" \
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

_add_ingress --region "$AWS_REGION" --group-id "$SG_ID" \
    --protocol tcp --port 22 --cidr "$MY_IP/32"
echo "[start.sh]   TCP 22 → $MY_IP/32 (SSH)"

_add_ingress --region "$AWS_REGION" --group-id "$SG_ID" \
    --protocol tcp --port "$NGINX_PORT" --cidr "$MY_IP/32"
echo "[start.sh]   TCP $NGINX_PORT → $MY_IP/32 (my IP)"

for CIDR in $DOMAIN_CIDRS; do
    _add_ingress --region "$AWS_REGION" --group-id "$SG_ID" \
        --protocol tcp --port "$NGINX_PORT" --cidr "$CIDR"
    echo "[start.sh]   TCP $NGINX_PORT → $CIDR (domain)"
done

# ── Build user-data script ────────────────────────────────────────────────────
USER_DATA="$(cat <<USERDATA
#!/bin/bash
set -euo pipefail
exec > /var/log/pathsgames-init.log 2>&1

# ── System packages ────────────────────────────────────────────────────────
apt-get update -y
apt-get install -y git curl ca-certificates gnupg dnsutils

# ── Docker (official repo) ─────────────────────────────────────────────────
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=\$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu \$(. /etc/os-release && echo \"\$VERSION_CODENAME\") stable" \
    > /etc/apt/sources.list.d/docker.list
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
systemctl enable docker
systemctl start docker

# docker compose v2 convenience alias
ln -sf /usr/libexec/docker/cli-plugins/docker-compose /usr/local/bin/docker-compose || true

# ── Clone repository ───────────────────────────────────────────────────────
git clone --depth 1 --branch "${GIT_BRANCH}" "${GIT_REPO_URL}" /opt/pathsgames
cd /opt/pathsgames/code/scripts/test/java_docker_compose

# ── Write .env for java_docker_compose ────────────────────────────────────
cat > .env <<'ENVEOF'
DB_NAME=${DB_NAME}
DB_USERNAME=${DB_USERNAME}
DB_PASSWORD=${DB_PASSWORD}
JWT_SECRET=${JWT_SECRET}
NGINX_PORT=${NGINX_PORT}
ADMIN_IP_WHITELIST=${MERGED_WHITELIST}
ENVEOF

# ── Start the stack ────────────────────────────────────────────────────────
chmod +x start.sh
./start.sh -d

echo "PathsGames stack started successfully"
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

# ── Get or launch EC2 instance ────────────────────────────────────────────────
echo "[start.sh] Looking up existing instance '$INSTANCE_NAME'…"
INSTANCE_ID="$(aws ec2 describe-instances \
    --region "$AWS_REGION" \
    --filters \
        "Name=tag:Name,Values=$INSTANCE_NAME" \
        "Name=instance-state-name,Values=pending,running,stopping,stopped" \
    --query 'Reservations[0].Instances[0].InstanceId' \
    --output text 2>/dev/null || echo 'None')"

if [ "$INSTANCE_ID" = "None" ] || [ -z "$INSTANCE_ID" ]; then
    echo "[start.sh] Launching new EC2 instance '$INSTANCE_NAME' ($EC2_INSTANCE_TYPE)…"
    INSTANCE_ID="$(aws ec2 run-instances \
        --region "$AWS_REGION" \
        --image-id "$AMI_ID" \
        --instance-type "$EC2_INSTANCE_TYPE" \
        --key-name "$EC2_KEY_NAME" \
        --security-group-ids "$SG_ID" \
        --user-data "$USER_DATA" \
        --tag-specifications \
            "ResourceType=instance,Tags=[{Key=Name,Value=$INSTANCE_NAME},{Key=env,Value=test},{Key=createdBy,Value=SH},{Key=project,Value=PathsGames}]" \
            "ResourceType=volume,Tags=[{Key=Name,Value=${INSTANCE_NAME}-vol},{Key=env,Value=test},{Key=createdBy,Value=SH},{Key=project,Value=PathsGames}]" \
        --query 'Instances[0].InstanceId' \
        --output text)"
    echo "[start.sh] Instance launched: $INSTANCE_ID"
else
    echo "[start.sh] Instance already exists: $INSTANCE_ID — reusing"
fi

# ── Save state ────────────────────────────────────────────────────────────────
cat > "$STATE_FILE" <<STATEOF
INSTANCE_ID=$INSTANCE_ID
SG_ID=$SG_ID
AWS_REGION=$AWS_REGION
INSTANCE_NAME=$INSTANCE_NAME
SG_NAME=$SG_NAME
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

PUBLIC_IP="$(aws ec2 describe-instances \
    --region "$AWS_REGION" \
    --instance-ids "$INSTANCE_ID" \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text)"
echo "[start.sh] Public IP: $PUBLIC_IP"

# ── Create/update Route53 DNS record ─────────────────────────────────────────
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
echo "PUBLIC_IP=$PUBLIC_IP" >> "$STATE_FILE"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Paths Games EC2 instance is RUNNING                    ║"
echo "╠══════════════════════════════════════════════════════════╣"
printf "║  Instance ID : %-43s║\n" "$INSTANCE_ID"
printf "║  Name        : %-43s║\n" "$INSTANCE_NAME"
printf "║  Public IP   : %-43s║\n" "$PUBLIC_IP"
printf "║  DNS record  : %-43s║\n" "$ROUTE53_RECORD_NAME"
printf "║  Region      : %-43s║\n" "$AWS_REGION"
printf "║  Port        : %-43s║\n" "$NGINX_PORT"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  API (after ~3 min init):                               ║"
printf "║  http://%-49s║\n" "$PUBLIC_IP:$NGINX_PORT/api/echo/status"
printf "║  http://%-49s║\n" "$ROUTE53_RECORD_NAME:$NGINX_PORT/api/echo/status"
echo "╠══════════════════════════════════════════════════════════╣"
printf "║  SSH: ssh -i ~/.ssh/$EC2_KEY_NAME.pem ubuntu@%-10s║\n" "$PUBLIC_IP"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  Tags: env=test  createdBy=SH  project=PathsGames       ║"
echo "║  Init log: /var/log/pathsgames-init.log (on instance)   ║"
echo "║  Stop:     ./stop.sh                                    ║"
echo "╚══════════════════════════════════════════════════════════╝"
