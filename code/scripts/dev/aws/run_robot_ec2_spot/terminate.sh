#!/usr/bin/env bash
# terminate.sh - v1.10.0 deletes EVERYTHING of one Robot EC2 name (spot requests first, SG last), restoring the test
# stack if the last run was left unfinished, then checks nothing tagged is left. Usage: terminate.sh [--name N] [--yes] [--dry-run]
set -uo pipefail
# shellcheck source=common.sh
. "$(cd "$(dirname "$0")" && pwd)/common.sh"

ASSUME_YES=false
while [ $# -gt 0 ]; do
    case "$1" in
        --name) ROBOT_EC2_NAME="${2:-}"; shift 2 ;;
        --yes) ASSUME_YES=true; shift ;;
        --dry-run) DRY_RUN=true; shift ;;
        -h|--help) sed -n '2,3p' "$0"; exit 0 ;;
        *) die "unknown argument '$1' (use --name NAME, --yes, --dry-run)." ;;
    esac
done
validate_config
[ "$DRY_RUN" = "true" ] || require_local_tools
if [ "$DRY_RUN" != "true" ] && [ "$ASSUME_YES" != "true" ]; then
    ask_yes_no "Delete EVERYTHING named '$ROBOT_EC2_NAME' in $ROBOT_EC2_REGION (instance, disk, EIP, key pair, IAM, SG)?" n || die "aborted."
fi
say "Terminating '$ROBOT_EC2_NAME' in $ROBOT_EC2_REGION ..."
ERRORS=0
fail() { say "ERROR: $*"; ERRORS=$((ERRORS + 1)); }
IDS="$(find_instances)"

# ── 1. Spot requests: all tagged with the name (orphans too) plus the instance's own ──
SPOTS="$(awsc "<spot-request-id>" ec2 describe-spot-instance-requests \
    --filters "Name=tag:Name,Values=$RES_SPOT" Name=state,Values=open,active,disabled \
    --query 'SpotInstanceRequests[].SpotInstanceRequestId' --output text | _none)"
for id in $IDS; do
    [ "$DRY_RUN" = "true" ] && break
    SPOTS+=" $(instance_field "$id" "" SpotInstanceRequestId)"
done
SPOTS="$(printf '%s\n' $SPOTS | sort -u | paste -sd' ' -)"
if [ -n "$SPOTS" ]; then
    # shellcheck disable=SC2086
    awsc "" ec2 cancel-spot-instance-requests --spot-instance-request-ids $SPOTS --output text > /dev/null \
        && say "Spot requests cancelled: $SPOTS" || fail "cancel-spot-instance-requests failed for $SPOTS."
fi

# ── 2. Test stack: what an unfinished run saved goes back (server first, local copy if unreachable) ──
local_restore() {
    local d f rc=0
    d="$(find "$ROBOT_EC2_RESULTS_DIR" -mindepth 1 -maxdepth 1 -type d -name '[0-9]*_[0-9]*' 2> /dev/null | sort | tail -n 1)"
    [ -n "$d" ] || { say "No local run copy: nothing to restore."; return 0; }
    if [ -f "$d/exit_code" ] || [ -f "$d/restored" ]; then
        say "Local copy $(basename "$d"): run finished or already restored."
        return 0
    fi
    say "Restoring from the local copy $(basename "$d") ..."
    if [ -f "$d/admin_allowlist.txt" ]; then stack_set_allowlist "$(cat "$d/admin_allowlist.txt")" || rc=1; fi
    for f in "$d"/lambda_env_backup/*.json; do
        [ -f "$f" ] || continue
        lambda_env_restore "$f" || rc=1
    done
    [ $rc -eq 0 ] && date -Is > "$d/restored"
    return $rc
}
if [ "$DRY_RUN" = "true" ]; then
    echo "restore: remote_run.sh stop + restore on the server (or the local copy in results/ when unreachable)" >&3
else
    RESTORED=false
    for id in $IDS; do
        [ "$(instance_state "$id")" = "running" ] || continue
        ssh_setup "$id"
        if rssh "test -f '$REMOTE_TOOL_DIR/remote_run.sh'" 2> /dev/null; then
            rssh "bash '$REMOTE_TOOL_DIR/remote_run.sh' stop; bash '$REMOTE_TOOL_DIR/remote_run.sh' restore" && RESTORED=true
        fi
    done
    [ "$RESTORED" = "true" ] || local_restore || fail "test stack NOT fully restored: check AdminIpWhitelist and the Auth/Match Lambda env (or redeploy aws_backend_deploy.sh test)."
fi

# ── 3. Instance(s), waited until terminated ──
[ "$DRY_RUN" = "true" ] && IDS="<instance-id>"
if [ -n "$IDS" ]; then
    # shellcheck disable=SC2086
    if awsc "" ec2 terminate-instances --instance-ids $IDS --output text > /dev/null; then
        say "Waiting for $IDS to be terminated ..."
        # shellcheck disable=SC2086
        awsc "" ec2 wait instance-terminated --instance-ids $IDS || fail "wait instance-terminated failed."
    else
        fail "terminate-instances failed for $IDS."
    fi
fi

# ── 4. Elastic IP ──
while read -r alloc assoc; do
    [ -n "${alloc:-}" ] || continue
    if [ -n "${assoc:-}" ] && [ "$assoc" != "None" ]; then awsc "" ec2 disassociate-address --association-id "$assoc"; fi
    awsc "" ec2 release-address --allocation-id "$alloc" && say "Elastic IP released: $alloc" || fail "release-address $alloc failed."
done <<< "$(awsc "<allocation-id> None" ec2 describe-addresses --filters "Name=tag:Name,Values=$RES_EIP" \
    --query 'Addresses[].[AllocationId,AssociationId]' --output text | _none)"

# ── 5. Key pair (the local key in ~/.ssh is kept) ──
if [ -n "$(awsc "<key-pair-id>" ec2 describe-key-pairs --filters "Name=key-name,Values=$RES_KEY" --query 'KeyPairs[0].KeyPairId' --output text | _none)" ]; then
    awsc "" ec2 delete-key-pair --key-name "$RES_KEY" && say "Key pair $RES_KEY deleted." || fail "delete-key-pair failed."
fi

# ── 6. IAM: role out of the profile, profile, policies, role ──
if [ -n "$(awsc "<profile-arn>" iam get-instance-profile --instance-profile-name "$RES_PROFILE" --query InstanceProfile.Arn --output text 2> /dev/null | _none)" ]; then
    for r in $(awsc "$RES_ROLE" iam get-instance-profile --instance-profile-name "$RES_PROFILE" --query 'InstanceProfile.Roles[].RoleName' --output text | _none); do
        awsc "" iam remove-role-from-instance-profile --instance-profile-name "$RES_PROFILE" --role-name "$r" || fail "remove-role-from-instance-profile failed."
    done
    awsc "" iam delete-instance-profile --instance-profile-name "$RES_PROFILE" && say "Instance profile $RES_PROFILE deleted." || fail "delete-instance-profile failed."
fi
if [ -n "$(awsc "<role-arn>" iam get-role --role-name "$RES_ROLE" --query Role.Arn --output text 2> /dev/null | _none)" ]; then
    for p in $(awsc "$RES_POLICY" iam list-role-policies --role-name "$RES_ROLE" --query 'PolicyNames[]' --output text | _none); do
        awsc "" iam delete-role-policy --role-name "$RES_ROLE" --policy-name "$p" || fail "delete-role-policy $p failed."
    done
    for p in $(awsc "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore" iam list-attached-role-policies --role-name "$RES_ROLE" \
        --query 'AttachedPolicies[].PolicyArn' --output text | _none); do
        awsc "" iam detach-role-policy --role-name "$RES_ROLE" --policy-arn "$p" || fail "detach-role-policy $p failed."
    done
    awsc "" iam delete-role --role-name "$RES_ROLE" && say "IAM role $RES_ROLE deleted." || fail "delete-role failed."
fi

# ── 7. Security group, last (its ENI must be gone) ──
for sg in $(awsc "<sg-id>" ec2 describe-security-groups --filters "Name=group-name,Values=$RES_SG" --query 'SecurityGroups[].GroupId' --output text | _none); do
    for attempt in $(seq 1 12); do
        if OUT="$(awsc "" ec2 delete-security-group --group-id "$sg" 2>&1)"; then say "Security group $RES_SG deleted."; break; fi
        if printf '%s' "$OUT" | grep -q DependencyViolation && [ "$attempt" -lt 12 ]; then sleep 10; continue; fi
        fail "delete-security-group $sg failed: $OUT"
        break
    done
done

# ── 8. Verify: nothing tagged Project + Name of this name is left (volumes and ENIs too) ──
NAMES="$RES_INSTANCE,$RES_SG,$RES_VOL,$RES_ENI,$RES_SPOT,$RES_EIP,$RES_KEY"
TAGF=("Name=tag:Project,Values=$TAG_PROJECT" "Name=tag:Name,Values=$NAMES")
LEFT=""
add_left() { [ -n "$2" ] && LEFT+="  $1: $2"$'\n'; }
add_left instances "$(awsc "" ec2 describe-instances --filters "${TAGF[@]}" Name=instance-state-name,Values=pending,running,stopping,stopped,shutting-down \
    --query 'Reservations[].Instances[].InstanceId' --output text | _none)"
add_left volumes "$(awsc "" ec2 describe-volumes --filters "${TAGF[@]}" Name=status,Values=creating,available,in-use,error --query 'Volumes[].VolumeId' --output text | _none)"
add_left network-interfaces "$(awsc "" ec2 describe-network-interfaces --filters "${TAGF[@]}" --query 'NetworkInterfaces[].NetworkInterfaceId' --output text | _none)"
add_left security-groups "$(awsc "" ec2 describe-security-groups --filters "${TAGF[@]}" --query 'SecurityGroups[].GroupId' --output text | _none)"
add_left elastic-ips "$(awsc "" ec2 describe-addresses --filters "${TAGF[@]}" --query 'Addresses[].AllocationId' --output text | _none)"
add_left key-pairs "$(awsc "" ec2 describe-key-pairs --filters "${TAGF[@]}" --query 'KeyPairs[].KeyName' --output text | _none)"
add_left spot-requests "$(awsc "" ec2 describe-spot-instance-requests --filters "${TAGF[@]}" Name=state,Values=open,active,disabled \
    --query 'SpotInstanceRequests[].SpotInstanceRequestId' --output text | _none)"
add_left iam-role "$(awsc "" iam get-role --role-name "$RES_ROLE" --query Role.Arn --output text 2> /dev/null | _none)"
add_left iam-instance-profile "$(awsc "" iam get-instance-profile --instance-profile-name "$RES_PROFILE" --query InstanceProfile.Arn --output text 2> /dev/null | _none)"
if [ -n "$LEFT" ]; then
    say "VERIFY: resources still left for '$ROBOT_EC2_NAME' in $ROBOT_EC2_REGION:"
    printf '%s' "$LEFT" >&2
    exit 1
fi
say "VERIFY: nothing tagged Project=$TAG_PROJECT / Name=$ROBOT_EC2_NAME* is left in $ROBOT_EC2_REGION (IAM checked too)."
[ "$ERRORS" -eq 0 ] || exit 1
[ "$DRY_RUN" = "true" ] && say "Dry run: nothing deleted."
exit 0
