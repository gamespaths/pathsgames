#!/usr/bin/env bash
# create.sh - v1.10.0 creates the Robot EC2 (t4g, spot persistent/stop or on-demand) with key pair, IAM role/profile,
# SG without ingress and optional Elastic IP, then waits until it is ready and bootstrapped. Usage: see README.md.
set -uo pipefail
# shellcheck source=common.sh
. "$(cd "$(dirname "$0")" && pwd)/common.sh"

usage() { echo "Usage: create.sh [--size large|xlarge|2xlarge] [--market spot|ondemand] [--fixed-ip] [--no-wait] [--dry-run] | --update-policy"; }
NO_WAIT=false
UPDATE_POLICY=false
while [ $# -gt 0 ]; do
    case "$1" in
        --size) ROBOT_EC2_SIZE="${2:-}"; shift 2 ;;
        --market) ROBOT_EC2_MARKET="${2:-}"; shift 2 ;;
        --fixed-ip) ROBOT_EC2_FIXED_IP=true; shift ;;
        --no-wait) NO_WAIT=true; shift ;;
        --dry-run) DRY_RUN=true; shift ;;
        --update-policy) UPDATE_POLICY=true; shift ;;
        -h|--help) usage; exit 0 ;;
        *) usage >&2; die "unknown argument '$1'." ;;
    esac
done
validate_config
# A dry run answers every lookup as "missing", so the whole plan is printed.
DRY_INSTANCE_ID=""

# ── 1. Preflight: credentials and local tools, before anything else ──
require_local_tools
ACCOUNT_ID="$(awsc "<account-id>" sts get-caller-identity --query Account --output text)" \
    || die "aws sts get-caller-identity failed: no valid AWS credentials."
say "Account $ACCOUNT_ID, region $ROBOT_EC2_REGION, name $ROBOT_EC2_NAME, $INSTANCE_TYPE ($ROBOT_EC2_MARKET), disk ${ROBOT_EC2_DISK_GB}GB."

# Inline policy of the server role (test stack only); v1.10.0 iam:GetRole: CloudFormation reads the Lambda role Arn.
build_policy() {
    FN_ARN="arn:aws:lambda:$ROBOT_EC2_STACK_REGION:$ACCOUNT_ID:function:pathsgames-$ROBOT_EC2_SAM_ENV-*"
    CFN_ARN="arn:aws:cloudformation:$ROBOT_EC2_STACK_REGION:$ACCOUNT_ID:stack"
    ARTIFACTS="${AWS_TEST_S3_BUCKET_BASE:-pathsgames-test-iac}/${S3_PREFIX:-$ROBOT_EC2_SAM_ENV/backend}"
    TABLE_ARN="arn:aws:dynamodb:$ROBOT_EC2_STACK_REGION:$ACCOUNT_ID:table/PathsGamesBackend-$ROBOT_EC2_SAM_ENV"
    TRUST='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
    POLICY="$(cat <<EOF
{"Version":"2012-10-17","Statement":[
 {"Sid":"TestStackRead","Effect":"Allow","Action":["cloudformation:DescribeStacks","cloudformation:DescribeStackEvents","cloudformation:DescribeStackResource","cloudformation:DescribeStackResources","cloudformation:GetTemplate"],"Resource":["$CFN_ARN/$ROBOT_EC2_STACK/*","$CFN_ARN/$ROBOT_EC2_STACK-*/*"]},
 {"Sid":"TestStackAllowListUpdate","Effect":"Allow","Action":"cloudformation:UpdateStack","Resource":["$CFN_ARN/$ROBOT_EC2_STACK/*","$CFN_ARN/$ROBOT_EC2_STACK-*/*"]},
 {"Sid":"SamTransform","Effect":"Allow","Action":"cloudformation:CreateChangeSet","Resource":"arn:aws:cloudformation:$ROBOT_EC2_STACK_REGION:aws:transform/Serverless-2016-10-31"},
 {"Sid":"NestedTemplates","Effect":"Allow","Action":"s3:GetObject","Resource":"arn:aws:s3:::$ARTIFACTS/*"},
 {"Sid":"TestLambdaConfig","Effect":"Allow","Action":["lambda:GetFunction","lambda:GetFunctionConfiguration","lambda:UpdateFunctionConfiguration","lambda:ListTags","lambda:TagResource","lambda:UntagResource","lambda:GetFunctionCodeSigningConfig","lambda:GetRuntimeManagementConfig","lambda:GetFunctionRecursionConfig"],"Resource":"$FN_ARN"},
 {"Sid":"ReadTestLambdaRoles","Effect":"Allow","Action":"iam:GetRole","Resource":"arn:aws:iam::$ACCOUNT_ID:role/$ROBOT_EC2_STACK-*"},
 {"Sid":"PassTestLambdaRoles","Effect":"Allow","Action":"iam:PassRole","Resource":"arn:aws:iam::$ACCOUNT_ID:role/$ROBOT_EC2_STACK-*","Condition":{"StringEquals":{"iam:PassedToService":"lambda.amazonaws.com"}}},
 {"Sid":"PurgeRobotTestData","Effect":"Allow","Action":["dynamodb:DescribeTable","dynamodb:Scan","dynamodb:Query","dynamodb:BatchWriteItem","dynamodb:DeleteItem"],"Resource":["$TABLE_ARN","$TABLE_ARN/index/*"]}
]}
EOF
    )"
    POLICY="${POLICY//$'\n'/}"
}

# ── 2. Refuse a duplicate ──
EXISTING="$(find_instance)" || exit 1
# --update-policy: only the inline policy of the existing role is rewritten (an instance keeps running)
if [ "$UPDATE_POLICY" = "true" ]; then
    build_policy
    awsc "" iam put-role-policy --role-name "$RES_ROLE" --policy-name "$RES_POLICY" --policy-document "$POLICY" \
        || die "put-role-policy failed."
    say "Inline policy $RES_POLICY of $RES_ROLE updated."
    exit 0
fi
if [ -n "$EXISTING" ]; then
    die "instance '$RES_INSTANCE' already exists ($EXISTING, $(instance_state "$EXISTING")): use start.sh / run_all.sh, or terminate.sh first."
fi

# ── 3. Lookups that can fail, all before creating anything ──
AMI_ID="$(awsc "<ami-id>" ssm get-parameters --names "$ROBOT_EC2_SSM_AMI_PARAM" --query 'Parameters[0].Value' --output text | _none)"
[ -n "$AMI_ID" ] || die "Ubuntu 24.04 arm64 AMI not found in SSM ($ROBOT_EC2_SSM_AMI_PARAM) in $ROBOT_EC2_REGION."
ROOT_DEVICE="$(awsc "/dev/sda1" ec2 describe-images --image-ids "$AMI_ID" --query 'Images[0].RootDeviceName' --output text | _none)"
ROOT_DEVICE="${ROOT_DEVICE:-/dev/sda1}"
VPC_ID="$(awsc "<vpc-id>" ec2 describe-vpcs --filters Name=is-default,Values=true --query 'Vpcs[0].VpcId' --output text | _none)"
[ -n "$VPC_ID" ] || die "no default VPC in $ROBOT_EC2_REGION: create one (aws ec2 create-default-vpc) or pick another region."
# text output separates the zones with tabs: spaces for the match below
ZONES="$(awsc "<az>" ec2 describe-instance-type-offerings --location-type availability-zone \
    --filters "Name=instance-type,Values=$INSTANCE_TYPE" --query 'InstanceTypeOfferings[].Location' --output text \
    | _none | tr -s '[:space:]' ' ')"
SUBNETS=""
while read -r subnet az; do
    [ -n "${subnet:-}" ] || continue
    case " $ZONES " in *" $az "*) SUBNETS+="$subnet " ;; esac
done <<< "$(awsc "<subnet-id> <az>" ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" Name=map-public-ip-on-launch,Values=true \
    --query 'Subnets[].[SubnetId,AvailabilityZone]' --output text | _none)"
[ -n "$SUBNETS" ] || die "no public subnet with auto-assign public IP in the default VPC $VPC_ID offering $INSTANCE_TYPE: enable 'auto-assign public IPv4' on one."

# ── 4. Local SSH key (generated once, reused forever) and EC2 key pair ──
if [ ! -f "$ROBOT_EC2_SSH_KEY" ]; then
    if [ "$DRY_RUN" = "true" ]; then
        echo "ssh-keygen -t ed25519 -N '' -C pathsgames-robot-test -f $ROBOT_EC2_SSH_KEY" >&3
    else
        mkdir -p "$(dirname "$ROBOT_EC2_SSH_KEY")" && chmod 700 "$(dirname "$ROBOT_EC2_SSH_KEY")"
        ssh-keygen -q -t ed25519 -N '' -C pathsgames-robot-test -f "$ROBOT_EC2_SSH_KEY" || die "ssh-keygen failed."
        say "SSH key generated: $ROBOT_EC2_SSH_KEY"
    fi
fi
if [ -z "$(awsc "" ec2 describe-key-pairs --filters "Name=key-name,Values=$RES_KEY" --query 'KeyPairs[0].KeyPairId' --output text | _none)" ]; then
    awsc "" ec2 import-key-pair --key-name "$RES_KEY" --public-key-material "fileb://$ROBOT_EC2_SSH_KEY.pub" \
        --tag-specifications "$(tag_spec key-pair "$RES_KEY")" --output text > /dev/null || die "import-key-pair failed."
    say "Key pair $RES_KEY imported."
else
    say "Key pair $RES_KEY already exists: reused."
fi

# ── 5. IAM role (SSM + test stack only) and instance profile ──
build_policy
mapfile -t ROLE_TAGS < <(tag_iam_words "$RES_ROLE")
mapfile -t PROFILE_TAGS < <(tag_iam_words "$RES_PROFILE")
if [ -z "$(awsc "" iam get-role --role-name "$RES_ROLE" --query Role.Arn --output text 2> /dev/null | _none)" ]; then
    awsc "" iam create-role --role-name "$RES_ROLE" --path "$ROBOT_EC2_IAM_PATH" --assume-role-policy-document "$TRUST" \
        --description "Paths Games Robot EC2 $ROBOT_EC2_NAME: SSM + test stack only" --tags "${ROLE_TAGS[@]}" --output text > /dev/null \
        || die "create-role failed."
    say "IAM role $RES_ROLE created."
fi
awsc "" iam attach-role-policy --role-name "$RES_ROLE" --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore || die "attach-role-policy failed."
awsc "" iam put-role-policy --role-name "$RES_ROLE" --policy-name "$RES_POLICY" --policy-document "$POLICY" || die "put-role-policy failed."
if [ -z "$(awsc "" iam get-instance-profile --instance-profile-name "$RES_PROFILE" --query InstanceProfile.Arn --output text 2> /dev/null | _none)" ]; then
    awsc "" iam create-instance-profile --instance-profile-name "$RES_PROFILE" --path "$ROBOT_EC2_IAM_PATH" \
        --tags "${PROFILE_TAGS[@]}" --output text > /dev/null || die "create-instance-profile failed."
    say "Instance profile $RES_PROFILE created."
fi
if [ -z "$(awsc "" iam get-instance-profile --instance-profile-name "$RES_PROFILE" --query 'InstanceProfile.Roles[0].RoleName' --output text 2> /dev/null | _none)" ]; then
    awsc "" iam add-role-to-instance-profile --instance-profile-name "$RES_PROFILE" --role-name "$RES_ROLE" || die "add-role-to-instance-profile failed."
fi

# ── 6. Security group without ingress (SSM only) ──
SG_ID="$(awsc "" ec2 describe-security-groups --filters "Name=group-name,Values=$RES_SG" "Name=vpc-id,Values=$VPC_ID" \
    --query 'SecurityGroups[0].GroupId' --output text | _none)"
if [ -z "$SG_ID" ]; then
    SG_ID="$(awsc "<sg-id>" ec2 create-security-group --group-name "$RES_SG" --vpc-id "$VPC_ID" \
        --description "Paths Games Robot EC2 $ROBOT_EC2_NAME - no ingress, access via SSM" \
        --tag-specifications "$(tag_spec security-group "$RES_SG")" --query GroupId --output text)" || die "create-security-group failed."
    say "Security group $RES_SG created: $SG_ID (no ingress rules)."
fi

# ── 7. user-data: timezone, nightly shutdown timer (waits for a run until the latest time), marker ──
to_min() { echo $(( 10#${1%%:*} * 60 + 10#${1##*:} )); }
WINDOW_MIN=$(( ( $(to_min "$ROBOT_EC2_SHUTDOWN_LATEST") - $(to_min "$ROBOT_EC2_SHUTDOWN_TIME") + 1440 ) % 1440 ))
USER_DATA_FILE="$(mktemp "${TMPDIR:-/tmp}/pg-robot-userdata.XXXXXX")"
trap 'rm -f "$USER_DATA_FILE"' EXIT
cat > "$USER_DATA_FILE" <<EOF
#!/bin/bash
# user-data of $ROBOT_EC2_NAME (create.sh): timezone, nightly shutdown timer, done marker.
set -u
timedatectl set-timezone '$ROBOT_EC2_TIMEZONE' || ln -sf '/usr/share/zoneinfo/$ROBOT_EC2_TIMEZONE' /etc/localtime
mkdir -p '$ROBOT_EC2_MARKER_DIR'
cat > /usr/local/sbin/pathsgames-nightly-shutdown <<'SCRIPT'
#!/bin/bash
# Powers off (= stop) at $ROBOT_EC2_SHUTDOWN_TIME; while a Robot run holds the lock it retries every 15 min until $ROBOT_EC2_SHUTDOWN_LATEST.
LOCK='$ROBOT_EC2_RUNS_DIR/.lock/info'
active() { [ -f "\$LOCK" ] || return 1; read -r _ts pid boot < "\$LOCK"; [ "\$boot" = "\$(cat /proc/sys/kernel/random/boot_id)" ] && kill -0 "\$pid" 2>/dev/null; }
deadline=\$(( \$(date +%s) + $WINDOW_MIN * 60 ))
while :; do
  now=\$(date +%s)
  if ! active || [ "\$now" -ge "\$deadline" ]; then
    logger -t pathsgames-nightly-shutdown "nightly shutdown (run lock active: \$(active && echo yes || echo no))"
    /sbin/shutdown -h now
    exit 0
  fi
  logger -t pathsgames-nightly-shutdown "a Robot run is in progress: retry in 15 minutes"
  left=\$(( deadline - now )); sleep \$(( left < 900 ? left : 900 ))
done
SCRIPT
chmod 755 /usr/local/sbin/pathsgames-nightly-shutdown
cat > /etc/systemd/system/pathsgames-nightly-shutdown.service <<'UNIT'
[Unit]
Description=Paths Games Robot EC2 nightly shutdown (waits for a run in progress)
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/pathsgames-nightly-shutdown
TimeoutStartSec=infinity
UNIT
cat > /etc/systemd/system/pathsgames-nightly-shutdown.timer <<'UNIT'
[Unit]
Description=Paths Games Robot EC2 nightly shutdown at $ROBOT_EC2_SHUTDOWN_TIME
[Timer]
OnCalendar=*-*-* $ROBOT_EC2_SHUTDOWN_TIME:00
Persistent=false
[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now pathsgames-nightly-shutdown.timer
date -Is > '$ROBOT_EC2_MARKER_DIR/userdata.done'
EOF
if [ "$DRY_RUN" = "true" ]; then
    echo "=== user-data ===" >&3
    cat "$USER_DATA_FILE" >&3
    echo "=== end user-data ===" >&3
fi

# ── 8. run-instances, tags at creation; retries on IAM propagation, next subnet on capacity errors ──
build_run_args() {
    RUN_ARGS=(ec2 run-instances --image-id "$AMI_ID" --instance-type "$INSTANCE_TYPE" --key-name "$RES_KEY"
        --iam-instance-profile "Name=$RES_PROFILE"
        --network-interfaces "DeviceIndex=0,SubnetId=$1,Groups=$SG_ID,AssociatePublicIpAddress=true,DeleteOnTermination=true"
        --block-device-mappings "DeviceName=$ROOT_DEVICE,Ebs={VolumeSize=$ROBOT_EC2_DISK_GB,VolumeType=gp3,DeleteOnTermination=true}"
        --credit-specification CpuCredits=unlimited
        --instance-initiated-shutdown-behavior stop
        --metadata-options HttpTokens=required,HttpEndpoint=enabled
        --user-data "file://$USER_DATA_FILE")
    if [ "$ROBOT_EC2_MARKET" = "spot" ]; then
        RUN_ARGS+=(--instance-market-options 'MarketType=spot,SpotOptions={SpotInstanceType=persistent,InstanceInterruptionBehavior=stop}')
    fi
    RUN_ARGS+=(--tag-specifications "$(tag_spec instance "$RES_INSTANCE")" "$(tag_spec volume "$RES_VOL")"
        "$(tag_spec network-interface "$RES_ENI")")
    if [ "$ROBOT_EC2_MARKET" = "spot" ]; then
        RUN_ARGS+=("$(tag_spec spot-instances-request "$RES_SPOT")")
    fi
    RUN_ARGS+=(--query 'Instances[0].InstanceId' --output text)
}
INSTANCE_ID=""
for SUBNET in $SUBNETS; do
    build_run_args "$SUBNET"
    for attempt in 1 2 3 4 5 6 7; do
        if OUT="$(awsc "<instance-id>" "${RUN_ARGS[@]}" 2>&1)"; then
            INSTANCE_ID="$OUT"
            break 2
        fi
        if printf '%s' "$OUT" | grep -qiE "instance profile|iamInstanceProfile"; then
            say "Instance profile not propagated yet (attempt $attempt/7), retrying in 5s ..."
            sleep 5
            continue
        fi
        if printf '%s' "$OUT" | grep -qE "InsufficientInstanceCapacity|capacity-not-available|Unsupported"; then
            warn "no $INSTANCE_TYPE capacity in subnet $SUBNET: trying the next one."
            continue 2
        fi
        die "run-instances failed: $OUT"
    done
    die "run-instances kept failing on the instance profile: $OUT"
done
[ -n "$INSTANCE_ID" ] || die "no subnet had $INSTANCE_TYPE capacity: retry later or use --size xlarge / --market ondemand."
say "Instance launched: $INSTANCE_ID"

# ── 9. Elastic IP (optional), wait, bootstrap ──
if [ "$ROBOT_EC2_FIXED_IP" = "true" ]; then
    if [ "$DRY_RUN" != "true" ]; then
        wait_until "$ROBOT_EC2_WAIT_TIMEOUT" 5 "instance $INSTANCE_ID state running" _is_running "$INSTANCE_ID" || exit 1
    fi
    eip_ensure "$INSTANCE_ID" || die "Elastic IP setup failed (the instance is up: rerun start.sh --fixed-ip)."
fi
[ "$DRY_RUN" = "true" ] && { say "Dry run: nothing created."; exit 0; }
if [ "$NO_WAIT" = "true" ]; then
    say "Not waiting (--no-wait). run_all.sh waits and bootstraps before the first run."
    exit 0
fi
wait_ready "$INSTANCE_ID" || exit 1
run_bootstrap || exit 1
say "Ready: $INSTANCE_ID ($INSTANCE_TYPE, $ROBOT_EC2_MARKET, public IP $(instance_public_ip "$INSTANCE_ID")). Next: run_all.sh"
