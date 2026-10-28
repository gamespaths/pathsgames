#!/usr/bin/env bash
# status.sh - v1.10.0 every resource tagged Project=Paths.games.aws.robotTest in the region, grouped by name: instance
# state + last StateReason, IPs, run in progress, rough cost while stopped, orphan IAM roles. Usage: status.sh [--no-ssh]
set -uo pipefail
# shellcheck source=common.sh
. "$(cd "$(dirname "$0")" && pwd)/common.sh"

USE_SSH=true
case "${1:-}" in
    --no-ssh) USE_SSH=false ;;
    "") ;;
    -h|--help) sed -n '2,3p' "$0"; exit 0 ;;
    *) die "unknown argument '$1' (use --no-ssh)." ;;
esac
command -v aws > /dev/null || die "the aws CLI is not installed."
PF="Name=tag:Project,Values=$TAG_PROJECT"
ROWS=""
# One row: base name (suffix removed), kind, details.
row() {
    local base="$1"
    case "$base" in *-sg|*-vol|*-eni|*-eip|*-key|*-spot|*-role|*-profile) base="${base%-*}" ;; esac
    ROWS+="$base"$'\t'"$2"$'\t'"$3"$'\n'
}
VOL_GB=""
EIP_NAMES=""
INSTANCE_NAMES=" "

while IFS=$'\t' read -r name id state type pub priv code msg life; do
    [ -n "${id:-}" ] || continue
    reason=""
    [ "$code" != "None" ] && reason=" | last StateReason: $(state_reason_message "$code" "$msg")"
    run=""
    if [ "$state" = "running" ] && [ "$USE_SSH" = "true" ] && command -v session-manager-plugin > /dev/null; then
        ssh_setup "$id"
        lock="$(timeout 60 ssh -F "$SSH_CFG" "$SSH_HOST_ALIAS" "bash -s" <<< "$(lock_check_snippet)" 2> /dev/null || echo "unreachable")"
        case "$lock" in running*) run=" | RUN IN PROGRESS: ${lock#running }" ;; idle|stale*) run=" | no run in progress" ;; *) run=" | run status: $lock" ;; esac
    fi
    [ "$life" = "spot" ] || life="on-demand"
    row "$name" instance "$id $state $type $life public=${pub/None/-} private=${priv/None/-}$reason$run"
    INSTANCE_NAMES+="$name "
done <<< "$(aws ec2 describe-instances --region "$ROBOT_EC2_REGION" --filters "$PF" \
    Name=instance-state-name,Values=pending,running,stopping,stopped,shutting-down \
    --query 'Reservations[].Instances[].[Tags[?Key==`Name`]|[0].Value,InstanceId,State.Name,InstanceType,PublicIpAddress,PrivateIpAddress,StateReason.Code,StateReason.Message,InstanceLifecycle]' \
    --output text 2> /dev/null)"

while IFS=$'\t' read -r name id state size; do
    [ -n "${id:-}" ] || continue
    row "$name" volume "$id $state ${size}GB"
    VOL_GB+="${name%-vol} $size"$'\n'
done <<< "$(aws ec2 describe-volumes --region "$ROBOT_EC2_REGION" --filters "$PF" \
    --query 'Volumes[].[Tags[?Key==`Name`]|[0].Value,VolumeId,State,Size]' --output text 2> /dev/null)"

while IFS=$'\t' read -r name id ip assoc; do
    [ -n "${id:-}" ] || continue
    row "$name" elastic-ip "$id $ip ${assoc/None/not associated}"
    EIP_NAMES+="${name%-eip}"$'\n'
done <<< "$(aws ec2 describe-addresses --region "$ROBOT_EC2_REGION" --filters "$PF" \
    --query 'Addresses[].[Tags[?Key==`Name`]|[0].Value,AllocationId,PublicIp,InstanceId]' --output text 2> /dev/null)"

for spec in \
    "security-group|describe-security-groups|SecurityGroups[].[Tags[?Key==\`Name\`]|[0].Value,GroupId,GroupName]" \
    "key-pair|describe-key-pairs|KeyPairs[].[Tags[?Key==\`Name\`]|[0].Value,KeyPairId,KeyName]" \
    "network-interface|describe-network-interfaces|NetworkInterfaces[].[Tags[?Key==\`Name\`]|[0].Value,NetworkInterfaceId,Status]" \
    "spot-request|describe-spot-instance-requests|SpotInstanceRequests[].[Tags[?Key==\`Name\`]|[0].Value,SpotInstanceRequestId,State,Status.Code,InstanceId]"; do
    IFS='|' read -r kind cmd query <<< "$spec"
    while IFS=$'\t' read -r name rest; do
        [ -n "${name:-}" ] || continue
        row "$name" "$kind" "${rest//$'\t'/ }"
    done <<< "$(aws ec2 "$cmd" --region "$ROBOT_EC2_REGION" --filters "$PF" --query "$query" --output text 2> /dev/null)"
done

ORPHANS=""
for role in $(aws iam list-roles --path-prefix "$ROBOT_EC2_IAM_PATH" --query 'Roles[].RoleName' --output text 2> /dev/null | _none); do
    row "$role" iam-role "global"
    case "$INSTANCE_NAMES" in *" ${role%-role} "*) ;; *) ORPHANS+="$role " ;; esac
done
for prof in $(aws iam list-instance-profiles --path-prefix "$ROBOT_EC2_IAM_PATH" --query 'InstanceProfiles[].InstanceProfileName' --output text 2> /dev/null | _none); do
    row "$prof" iam-instance-profile "global"
done

if [ -z "$ROWS" ]; then
    say "Nothing tagged Project=$TAG_PROJECT in $ROBOT_EC2_REGION (and no IAM role under $ROBOT_EC2_IAM_PATH)."
    exit 0
fi
echo "Resources tagged Project=$TAG_PROJECT in $ROBOT_EC2_REGION (configured name: $ROBOT_EC2_NAME):"
for base in $(printf '%s' "$ROWS" | cut -f1 | sort -u); do
    echo
    echo "== $base =="
    printf '%s' "$ROWS" | awk -F'\t' -v b="$base" '$1 == b { printf "  %-21s %s\n", $2, $3 }'
    gb="$(printf '%s' "$VOL_GB" | awk -v b="$base" '$1 == b { s += $2 } END { print s + 0 }')"
    eips="$(printf '%s' "$EIP_NAMES" | grep -cxF "$base")"
    awk -v gb="$gb" -v e="$eips" -v pg="$ROBOT_EC2_PRICE_GB_MONTH" -v pe="$ROBOT_EC2_PRICE_EIP_MONTH" \
        'BEGIN { printf "  cost while stopped    ~$%.2f/month (EBS %d GB x $%s + %d EIP x $%s)\n", gb * pg + e * pe, gb, pg, e, pe }'
done
for role in $ORPHANS; do
    echo
    warn "IAM role $role has no instance in $ROBOT_EC2_REGION (other region, or a leftover): terminate.sh --name ${role%-role}"
done
