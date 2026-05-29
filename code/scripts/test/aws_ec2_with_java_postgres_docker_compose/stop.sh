#!/usr/bin/env bash
# stop.sh - Destroy all resources created by start.sh:
#            EC2 instance, security group, and Route53 DNS record.
#
# Reads state from .state file written by start.sh.
# Tolerant: if any resource is already gone, logs a warning and continues.
#
# Usage:
#   ./stop.sh              # destroy all (with confirmation prompt)
#   ./stop.sh --force      # skip confirmation

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
STATE_FILE="$SCRIPT_DIR/.state"

# Load .state
if [ ! -f "$STATE_FILE" ]; then
    echo "[stop.sh] ERROR: .state file not found at $STATE_FILE"
    echo "          Run start.sh first, or destroy resources manually."
    exit 1
fi

set -a; . "$STATE_FILE"; set +a
echo "[stop.sh] Loaded state:"
echo "  Instance ID       : ${INSTANCE_ID:-<not set>}"
echo "  Instance Name     : ${INSTANCE_NAME:-<not set>}"
echo "  Security Group ID : ${SG_ID:-<not set>}"
echo "  Security Group    : ${SG_NAME:-<not set>}"
echo "  DNS record        : ${ROUTE53_RECORD_NAME:-<not set>}"
echo "  Hosted Zone ID    : ${ROUTE53_HOSTED_ZONE_ID:-<not set>}"
echo "  Public IP         : ${PUBLIC_IP:-<not set>}"
echo "  Region            : ${AWS_REGION:-<not set>}"
echo "  Launched at       : ${LAUNCHED_AT:-<not set>}"
echo ""

if [ -z "${INSTANCE_ID:-}" ] || [ -z "${AWS_REGION:-}" ]; then
    echo "[stop.sh] ERROR: .state file is missing INSTANCE_ID or AWS_REGION."
    exit 1
fi

# Confirmation
if [ "${1:-}" != "--force" ]; then
    read -r -p "[stop.sh] Destroy instance $INSTANCE_ID, SG ${SG_ID:-?}, DNS ${ROUTE53_RECORD_NAME:-?} in $AWS_REGION? [y/N] " CONFIRM
    if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
        echo "[stop.sh] Aborted."
        exit 0
    fi
fi

# Delete Route53 DNS record
if [ -n "${ROUTE53_RECORD_NAME:-}" ] && [ -n "${ROUTE53_HOSTED_ZONE_ID:-}" ] && [ -n "${PUBLIC_IP:-}" ]; then
    echo "[stop.sh] Deleting Route53 record $ROUTE53_RECORD_NAME (A -> $PUBLIC_IP)..."
    CHANGE_BATCH="$(printf '{"Changes":[{"Action":"DELETE","ResourceRecordSet":{"Name":"%s","Type":"A","TTL":60,"ResourceRecords":[{"Value":"%s"}]}}]}' \
        "$ROUTE53_RECORD_NAME" "$PUBLIC_IP")"
    aws route53 change-resource-record-sets \
        --hosted-zone-id "$ROUTE53_HOSTED_ZONE_ID" \
        --change-batch "$CHANGE_BATCH" \
        --no-cli-pager 2>/dev/null \
        && echo "[stop.sh] DNS record deleted OK" \
        || echo "[stop.sh] WARNING: DNS record not found or already deleted -- continuing"
else
    echo "[stop.sh] WARNING: DNS info missing in .state -- skipping DNS deletion"
fi

# Terminate EC2 instance
echo "[stop.sh] Terminating instance $INSTANCE_ID..."
INSTANCE_STATE="$(aws ec2 describe-instances \
    --region "$AWS_REGION" \
    --instance-ids "$INSTANCE_ID" \
    --query 'Reservations[0].Instances[0].State.Name' \
    --output text 2>/dev/null || echo 'not-found')"

if [ "$INSTANCE_STATE" = "not-found" ] || [ "$INSTANCE_STATE" = "terminated" ]; then
    echo "[stop.sh] Instance $INSTANCE_ID not found or already terminated -- skipping"
else
    aws ec2 terminate-instances \
        --region "$AWS_REGION" \
        --instance-ids "$INSTANCE_ID" \
        --no-cli-pager 2>/dev/null \
        && echo "[stop.sh] Termination requested OK" \
        || echo "[stop.sh] WARNING: could not terminate instance -- continuing"

    echo "[stop.sh] Waiting for instance to reach 'terminated' state (may take ~1 min)..."
    aws ec2 wait instance-terminated \
        --region "$AWS_REGION" \
        --instance-ids "$INSTANCE_ID" 2>/dev/null \
        && echo "[stop.sh] Instance terminated OK" \
        || echo "[stop.sh] WARNING: wait timed out or instance already gone -- continuing"
fi

# Delete security group
if [ -n "${SG_ID:-}" ]; then
    echo "[stop.sh] Deleting security group $SG_ID (${SG_NAME:-?})..."
    MAX_RETRIES=10
    RETRY=0
    SG_DELETED=false
    while [ $RETRY -lt $MAX_RETRIES ]; do
        ERR="$(aws ec2 delete-security-group \
            --region "$AWS_REGION" \
            --group-id "$SG_ID" \
            --no-cli-pager 2>&1 || true)"
        if [ -z "$ERR" ]; then
            echo "[stop.sh] Security group deleted OK"
            SG_DELETED=true
            break
        elif echo "$ERR" | grep -q "InvalidGroup.NotFound"; then
            echo "[stop.sh] Security group $SG_ID not found -- already deleted OK"
            SG_DELETED=true
            break
        elif echo "$ERR" | grep -q "DependencyViolation"; then
            RETRY=$((RETRY + 1))
            echo "[stop.sh]   SG still attached, retry $RETRY/$MAX_RETRIES in 6s..."
            sleep 6
        else
            echo "[stop.sh] WARNING: unexpected error deleting SG: $ERR -- continuing"
            break
        fi
    done
    if [ "$SG_DELETED" = false ]; then
        echo "[stop.sh] WARNING: could not delete SG $SG_ID after $MAX_RETRIES retries."
        echo "          Delete manually: aws ec2 delete-security-group --group-id $SG_ID --region $AWS_REGION"
    fi
else
    echo "[stop.sh] No SG_ID in state -- skipping SG deletion"
fi

# Remove state file
rm -f "$STATE_FILE"
echo "[stop.sh] .state file removed OK"

echo ""
echo "==================================================="
echo "  Paths Games EC2 instance DESTROYED"
echo "==================================================="
printf "  Instance  : %s (terminated)\n" "$INSTANCE_ID"
printf "  Sec. Group: %s (deleted)\n" "${SG_ID:-n/a}"
printf "  DNS record: %s (deleted)\n" "${ROUTE53_RECORD_NAME:-n/a}"
echo "==================================================="
