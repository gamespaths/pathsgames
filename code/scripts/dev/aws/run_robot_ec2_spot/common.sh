#!/usr/bin/env bash
# common.sh - v1.10.0 sourced by every run_robot_ec2_spot script (locally and on the server): .env, defaults,
# derived names, tags, aws/ssh/rsync helpers, waits and lookups. Never executed on its own.

PG_EC2_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# PG_ROBOT_EC2_* overrides exist for the unit tests only (other repo root, .env, results folder, python).
PROJECT_ROOT="${PG_ROBOT_EC2_PROJECT_ROOT:-$(cd "$PG_EC2_DIR/../../../../.." && pwd)}"
ENV_FILE="${PG_ROBOT_EC2_ENV_FILE:-$PROJECT_ROOT/.env}"
if [ -f "$ENV_FILE" ]; then
    # shellcheck disable=SC1090
    . "$ENV_FILE"
fi
TAGS_FILE="$(cd "$PG_EC2_DIR/../../.." && pwd)/test/aws_tags.txt"

ROBOT_EC2_NAME="${AWS_TEST_EC2_ROBOT_NAME:-PathsGamesRobotTest}"
ROBOT_EC2_SIZE="${AWS_TEST_EC2_ROBOT_SIZE:-large}"
ROBOT_EC2_MARKET="${AWS_TEST_EC2_ROBOT_MARKET:-spot}"
ROBOT_EC2_FIXED_IP="${AWS_TEST_EC2_ROBOT_FIXED_IP:-false}"
ROBOT_EC2_REGION="${AWS_TEST_EC2_ROBOT_REGION:-${AWS_TEST_REGION:-us-east-2}}"
ROBOT_EC2_DISK_GB="${AWS_TEST_EC2_ROBOT_DISK_GB:-40}"
ROBOT_EC2_SSH_KEY="${AWS_TEST_EC2_ROBOT_SSH_KEY:-$HOME/.ssh/pathsgames-robot-test}"
ROBOT_EC2_SSH_KEY="${ROBOT_EC2_SSH_KEY/#\~/$HOME}"
ROBOT_EC2_REMOTE_DIR="${AWS_TEST_EC2_ROBOT_REMOTE_DIR:-/home/ubuntu/pathsgames}"
ROBOT_EC2_RUNS_DIR="${AWS_TEST_EC2_ROBOT_RUNS_DIR:-/home/ubuntu/runs}"
ROBOT_EC2_TIMEZONE="${AWS_TEST_EC2_ROBOT_TIMEZONE:-Europe/Rome}"
ROBOT_EC2_SHUTDOWN_TIME="${AWS_TEST_EC2_ROBOT_SHUTDOWN_TIME:-02:00}"
ROBOT_EC2_SHUTDOWN_LATEST="${AWS_TEST_EC2_ROBOT_SHUTDOWN_LATEST:-04:00}"
ROBOT_EC2_POLL_SECONDS="${AWS_TEST_EC2_ROBOT_POLL_SECONDS:-60}"
ROBOT_EC2_WAIT_TIMEOUT="${AWS_TEST_EC2_ROBOT_WAIT_TIMEOUT:-900}"
ROBOT_EC2_STACK="${AWS_TEST_SAM_STACK_NAME:-pathsgames-test}"
ROBOT_EC2_STACK_REGION="${AWS_TEST_REGION:-us-east-2}"
ROBOT_EC2_SAM_ENV="${AWS_TEST_SAM_ENVIRONMENT_NAME:-test}"
ROBOT_EC2_RESULTS_DIR="${PG_ROBOT_EC2_RESULTS_DIR:-$PG_EC2_DIR/results}"
ROBOT_EC2_SSH_USER="ubuntu"
ROBOT_EC2_IAM_PATH="/pathsgames-robot-test/"
ROBOT_EC2_SSM_AMI_PARAM="/aws/service/canonical/ubuntu/server/24.04/stable/current/arm64/hvm/ebs-gp3/ami-id"
ROBOT_EC2_MARKER_DIR="${PG_ROBOT_EC2_MARKER_DIR:-/var/lib/pathsgames-robot}"
# Rough us-east-2 prices for status.sh: gp3 per GB-month, one public IPv4 / Elastic IP per month.
ROBOT_EC2_PRICE_GB_MONTH="0.08"
ROBOT_EC2_PRICE_EIP_MONTH="3.65"

# Tag placeholders of aws_tags.txt for this tool (Project=Paths.games.aws.robotTest).
TAG_ENV="Test"
TAG_PROJECT_SUFFIX="aws.robotTest"
TAG_LANGUAGE="Robot"
TAG_PROJECT="Paths.games.$TAG_PROJECT_SUFFIX"

DRY_RUN="${DRY_RUN:-false}"
PG_SCRIPT="$(basename "${0:-common.sh}")"
# fd 3 = the real stdout, so dry-run lines show even inside $(...).
exec 3>&1

say() { printf '[%s] %s\n' "$PG_SCRIPT" "$*" >&2; }
warn() { printf '[%s] WARNING: %s\n' "$PG_SCRIPT" "$*" >&2; }
die() { printf '[%s] ERROR: %s\n' "$PG_SCRIPT" "$*" >&2; exit 1; }

# Yes/no question; $2=default answer; no terminal = the default.
ask_yes_no() {
    local question="$1" default="${2:-n}" answer
    if [ ! -t 0 ]; then [ "$default" = "y" ]; return; fi
    read -r -p "$question [$( [ "$default" = y ] && echo Y/n || echo y/N )] " answer
    answer="${answer:-$default}"
    [[ "$answer" =~ ^[Yy] ]]
}

derive_names() {
    RES_INSTANCE="$ROBOT_EC2_NAME"
    RES_SG="$ROBOT_EC2_NAME-sg"
    RES_VOL="$ROBOT_EC2_NAME-vol"
    RES_ENI="$ROBOT_EC2_NAME-eni"
    RES_SPOT="$ROBOT_EC2_NAME-spot"
    RES_EIP="$ROBOT_EC2_NAME-eip"
    RES_KEY="$ROBOT_EC2_NAME-key"
    RES_ROLE="$ROBOT_EC2_NAME-role"
    RES_PROFILE="$ROBOT_EC2_NAME-profile"
    RES_POLICY="$ROBOT_EC2_NAME-test-stack"
    INSTANCE_TYPE="t4g.$ROBOT_EC2_SIZE"
}
derive_names

validate_name() { [[ "${1:-}" =~ ^[A-Za-z0-9-]{1,40}$ ]]; }

# Every setting checked once; the first bad one stops the script.
validate_config() {
    validate_name "$ROBOT_EC2_NAME" || die "AWS_TEST_EC2_ROBOT_NAME '$ROBOT_EC2_NAME' must be 1-40 chars of [A-Za-z0-9-]."
    case "$ROBOT_EC2_SIZE" in large|xlarge|2xlarge) ;; *) die "AWS_TEST_EC2_ROBOT_SIZE '$ROBOT_EC2_SIZE' must be large, xlarge or 2xlarge (t4g)." ;; esac
    case "$ROBOT_EC2_MARKET" in spot|ondemand) ;; *) die "AWS_TEST_EC2_ROBOT_MARKET '$ROBOT_EC2_MARKET' must be spot or ondemand." ;; esac
    case "$ROBOT_EC2_FIXED_IP" in true|false) ;; *) die "AWS_TEST_EC2_ROBOT_FIXED_IP '$ROBOT_EC2_FIXED_IP' must be true or false." ;; esac
    [[ "$ROBOT_EC2_DISK_GB" =~ ^[0-9]+$ ]] && [ "$ROBOT_EC2_DISK_GB" -ge 20 ] || die "AWS_TEST_EC2_ROBOT_DISK_GB '$ROBOT_EC2_DISK_GB' must be a number >= 20."
    [[ "$ROBOT_EC2_SHUTDOWN_TIME" =~ ^([01][0-9]|2[0-3]):[0-5][0-9]$ ]] || die "AWS_TEST_EC2_ROBOT_SHUTDOWN_TIME '$ROBOT_EC2_SHUTDOWN_TIME' must be HH:MM."
    [[ "$ROBOT_EC2_SHUTDOWN_LATEST" =~ ^([01][0-9]|2[0-3]):[0-5][0-9]$ ]] || die "AWS_TEST_EC2_ROBOT_SHUTDOWN_LATEST '$ROBOT_EC2_SHUTDOWN_LATEST' must be HH:MM."
    case "$ROBOT_EC2_STACK $ROBOT_EC2_SAM_ENV" in
        *alpha*|*beta*|*prod*) die "stack '$ROBOT_EC2_STACK' / env '$ROBOT_EC2_SAM_ENV' is not a test stack: this tool only touches the test stack." ;;
    esac
    derive_names
}

# "Key<TAB>Value" lines of aws_tags.txt, placeholders expanded like aws_ec2_with_python_docker/start.sh ($1 = Name).
tag_pairs() {
    local NAME="$1" ENV_TAG="$TAG_ENV" LANGUAGE="$TAG_LANGUAGE" PROJECT_SUFFIX="$TAG_PROJECT_SUFFIX" line k v
    [ -f "$TAGS_FILE" ] || die "tags file not found: $TAGS_FILE"
    while IFS= read -r line || [ -n "$line" ]; do
        case "$line" in ''|'#'*) continue ;; esac
        k="${line%%=*}"; v="${line#*=}"
        v="${v//'${NAME}'/"$NAME"}"; v="${v//'${ENV_TAG}'/"$ENV_TAG"}"; v="${v//'${LANGUAGE}'/"$LANGUAGE"}"; v="${v//'${PROJECT_SUFFIX}'/"$PROJECT_SUFFIX"}"
        printf '%s\t%s\n' "$k" "$v"
    done < "$TAGS_FILE"
}
# --tag-specifications entry: ResourceType=<type>,Tags=[{Key=..,Value=..},...]
tag_spec() { printf 'ResourceType=%s,Tags=[%s]' "$1" "$(tag_pairs "$2" | awk -F'\t' '{printf "%s{Key=%s,Value=%s}", (NR>1?",":""), $1, $2}')"; }
# IAM --tags arguments, one "Key=..,Value=.." word each (callers split on newlines).
tag_iam_words() { tag_pairs "$1" | awk -F'\t' '{printf "Key=%s,Value=%s\n", $1, $2}'; }

# One argument printed as the shell would need it.
_q() { if [[ "$1" =~ ^[A-Za-z0-9_./:=,@%+-]+$ ]]; then printf '%s' "$1"; else printf "'%s'" "${1//\'/\'\\\'\'}"; fi; }
_qargs() { local a out=""; for a in "$@"; do out+="$(_q "$a") "; done; printf '%s' "${out% }"; }

# aws call honouring DRY_RUN: $1 = what a dry run answers instead, region from AWSC_REGION or the EC2 region.
awsc() {
    local placeholder="$1"; shift
    local region="${AWSC_REGION:-$ROBOT_EC2_REGION}"
    if [ "$DRY_RUN" = "true" ]; then
        printf 'aws %s --region %s\n' "$(_qargs "$@")" "$region" >&3
        printf '%s' "$placeholder"
        return 0
    fi
    aws "$@" --region "$region"
}

# Text output of a lookup with AWS's "None" turned into empty.
_none() { local v; v="$(cat)"; [ "$v" = "None" ] && v=""; printf '%s' "$v"; }

# Ids of the non-terminated instances named $1 (default the configured name).
find_instances() {
    awsc "${DRY_INSTANCE_ID-<instance-id>}" ec2 describe-instances \
        --filters "Name=tag:Name,Values=${1:-$RES_INSTANCE}" "Name=instance-state-name,Values=pending,running,stopping,stopped" \
        --query 'Reservations[].Instances[].InstanceId' --output text | _none
}

# The one instance named $1, empty when none; two or more stop the script with their ids.
find_instance() {
    local ids count
    ids="$(find_instances "${1:-}")" || return 1
    count="$(printf '%s' "$ids" | wc -w)"
    if [ "$count" -gt 1 ]; then
        say "ERROR: $count non-terminated instances are named '${1:-$RES_INSTANCE}': $ids"
        say "  Terminate the extra ones by hand (aws ec2 terminate-instances --instance-ids <id>) and retry."
        return 2
    fi
    printf '%s' "$ids"
}

instance_field() {
    awsc "${2:-}" ec2 describe-instances --instance-ids "$1" --query "Reservations[0].Instances[0].$3" --output text | _none
}
instance_state() { instance_field "$1" "${DRY_STATE:-stopped}" 'State.Name'; }
instance_public_ip() { instance_field "$1" "<public-ip>" 'PublicIpAddress'; }

# Human message of an EC2 StateReason code ($1) and message ($2).
state_reason_message() {
    case "$1" in
        Server.SpotInstanceShutdown) echo "spot interruption: AWS reclaimed the spot capacity and stopped the instance ($2)" ;;
        Server.SpotInstanceTermination) echo "spot interruption: AWS terminated the spot instance ($2)" ;;
        Client.InstanceInitiatedShutdown) echo "shutdown from inside the OS: the nightly-shutdown timer or a 'shutdown' on the server ($2)" ;;
        Client.UserInitiatedShutdown) echo "stopped manually: console, CLI or stop.sh ($2)" ;;
        Server.InsufficientInstanceCapacity) echo "AWS had no capacity for the instance type ($2)" ;;
        Server.ScheduledStop) echo "AWS scheduled event: stopped for maintenance ($2)" ;;
        Server.InternalError) echo "AWS internal error ($2)" ;;
        "") echo "no StateReason reported by EC2" ;;
        *) echo "unknown reason $1 ($2)" ;;
    esac
}

# True when IP $1 is in comma list $2 (blanks and /32 ignored).
admin_ip_in_list() {
    local ip="$1" list="$2"
    [ -n "$ip" ] || return 1
    printf '%s' "$list" | tr ',' '\n' | tr -d '[:blank:]' | sed 's#/32$##' | grep -qxF "$ip"
}

# ROBOT_SKIP_ADMIN_IP value for a server whose public IP is $1: true only when .env already allows it.
skip_admin_ip_for() { if admin_ip_in_list "$1" "${ADMIN_IP_WHITELIST:-}"; then echo true; else echo false; fi; }

# rsync excludes of the code sync: what is never copied, and never deleted on the server (results, builds).
SYNC_EXCLUDES=(
    "/.git/" "/.alnao/" "/code/website/" "/wiki/documentation_v0/website_concepts_v0/"
    "node_modules/" "target/" ".venv/" ".aws-sam/" "__pycache__/"
    "/code/tests/robot/reports-*/" "/code/scripts/dev/run_robot_results/" "/code/scripts/dev/aws_run_local/logs/"
    "/code/scripts/dev/aws/run_robot_ec2_spot/results/" "/.env" "/.env.*"
)
sync_rsync_args() {
    local e args=(-az --delete "--include=/.env.example")
    for e in "${SYNC_EXCLUDES[@]}"; do args+=("--exclude=$e"); done
    printf '%s\n' "${args[@]}"
}

# Code tree, then the FULL .env (owner decision) readable by ubuntu only.
sync_tree() {
    local args
    mapfile -t args < <(sync_rsync_args)
    [ -f "$ENV_FILE" ] || { say "ERROR: $ENV_FILE is missing: the runs need it on the server."; return 1; }
    rssh "mkdir -p '$ROBOT_EC2_REMOTE_DIR'" || return 1
    rrsync "${args[@]}" "$PROJECT_ROOT/" "$(remote "$ROBOT_EC2_REMOTE_DIR/")" || { say "ERROR: rsync of the code failed."; return 1; }
    rrsync -a --chmod=F600 "$ENV_FILE" "$(remote "$ROBOT_EC2_REMOTE_DIR/.env")" || { say "ERROR: copy of .env failed."; return 1; }
}

REMOTE_TOOL_DIR="$ROBOT_EC2_REMOTE_DIR/code/scripts/dev/aws/run_robot_ec2_spot"
GOLDEN_REL="code/tests/robot/tests_v0/41_alpha_prep/fixtures/golden"

# ssh over SSM: a config file rebuilt on every call (a cache, not a state).
SSH_HOST_ALIAS="pg-robot-ec2"
ssh_setup() {
    local id="$1"
    SSH_CFG="${TMPDIR:-/tmp}/pg-robot-ec2-$(id -u)-$ROBOT_EC2_NAME.ssh_config"
    cat > "$SSH_CFG" <<EOF
Host $SSH_HOST_ALIAS
  HostName $id
  User $ROBOT_EC2_SSH_USER
  IdentityFile $ROBOT_EC2_SSH_KEY
  IdentitiesOnly yes
  StrictHostKeyChecking no
  UserKnownHostsFile /dev/null
  LogLevel ERROR
  ConnectTimeout 30
  ServerAliveInterval 30
  ServerAliveCountMax 6
  ProxyCommand aws ssm start-session --region $ROBOT_EC2_REGION --target %h --document-name AWS-StartSSHSession --parameters portNumber=%p
EOF
    chmod 600 "$SSH_CFG"
}
rssh() { ssh -F "$SSH_CFG" "$SSH_HOST_ALIAS" "$@"; }
rrsync() { rsync -e "ssh -F '$SSH_CFG'" "$@"; }
remote() { printf '%s:%s' "$SSH_HOST_ALIAS" "$1"; }

# Shell snippet printing "running <ts>", "stale <ts>" or "idle" for the server run lock.
lock_check_snippet() {
    cat <<EOF
L='$ROBOT_EC2_RUNS_DIR/.lock/info'
if [ -f "\$L" ]; then
  read -r ts pid boot < "\$L"
  if [ "\$boot" = "\$(cat /proc/sys/kernel/random/boot_id)" ] && kill -0 "\$pid" 2>/dev/null; then echo "running \$ts"; else echo "stale \$ts"; fi
else echo idle; fi
EOF
}
remote_lock_status() { rssh "bash -s" <<< "$(lock_check_snippet)"; }

# Polls "$@" every $2 s up to $1 s; $3 names the step in the timeout message.
wait_until() {
    local timeout="$1" interval="$2" step="$3" start=$SECONDS
    shift 3
    until "$@"; do
        if [ $((SECONDS - start)) -ge "$timeout" ]; then
            say "ERROR: timed out after ${timeout}s waiting for: $step"
            return 1
        fi
        sleep "$interval"
    done
}

_is_running() { [ "$(instance_state "$1")" = "running" ]; }
_status_ok() {
    [ "$(awsc "ok ok" ec2 describe-instance-status --instance-ids "$1" \
        --query 'InstanceStatuses[0].[InstanceStatus.Status,SystemStatus.Status]' --output text | tr -s '\t ' ' ')" = "ok ok" ]
}
_ssm_online() {
    [ "$(awsc Online ssm describe-instance-information --filters "Key=InstanceIds,Values=$1" \
        --query 'InstanceInformationList[0].PingStatus' --output text)" = "Online" ]
}
_ssh_ok() { rssh true > /dev/null 2>&1; }
_userdata_done() { rssh "test -f $ROBOT_EC2_MARKER_DIR/userdata.done" > /dev/null 2>&1; }

# "Really started": running + status checks ok -> SSM Online -> SSH -> user-data marker.
wait_ready() {
    local id="$1" t="$ROBOT_EC2_WAIT_TIMEOUT"
    [ "$DRY_RUN" = "true" ] && { echo "wait: running, status ok, SSM Online, SSH over SSM, user-data marker" >&3; return 0; }
    say "Waiting for $id: running ..."
    wait_until "$t" 5 "instance $id state running" _is_running "$id" || return 1
    say "Waiting for $id: EC2 status checks ok ..."
    wait_until "$t" 15 "EC2 status checks ok on $id" _status_ok "$id" || return 1
    say "Waiting for $id: SSM agent Online ..."
    wait_until "$t" 10 "SSM PingStatus Online on $id (agent, instance profile, outbound HTTPS)" _ssm_online "$id" || return 1
    ssh_setup "$id"
    say "Waiting for $id: SSH over SSM ..."
    wait_until "$t" 10 "SSH over SSM to $id (key $ROBOT_EC2_SSH_KEY, session-manager-plugin)" _ssh_ok || return 1
    say "Waiting for $id: user-data done ..."
    wait_until "$t" 10 "user-data marker $ROBOT_EC2_MARKER_DIR/userdata.done on $id (see /var/log/cloud-init-output.log)" _userdata_done || return 1
    say "Instance $id is ready."
}

# bootstrap.sh copied first (a piped script could be eaten by a command reading stdin), run as root: seconds when up to date.
run_bootstrap() {
    say "Bootstrap (tools on the server) ..."
    rssh "cat > /tmp/pathsgames-robot-bootstrap.sh" < "$PG_EC2_DIR/bootstrap.sh" \
        && rssh "sudo bash /tmp/pathsgames-robot-bootstrap.sh --user $ROBOT_EC2_SSH_USER --remote-dir '$ROBOT_EC2_REMOTE_DIR' < /dev/null" \
        || { say "ERROR: bootstrap failed on the server (log: /var/log/pathsgames-robot-bootstrap.log)"; return 1; }
}

# Starts a stopped instance, retrying on capacity errors, then suggests a bigger size.
instance_start_with_retry() {
    local id="$1" attempt out
    for attempt in 1 2 3; do
        if out="$(awsc "" ec2 start-instances --instance-ids "$id" --output text 2>&1)"; then
            say "Start requested for $id."
            return 0
        fi
        if printf '%s' "$out" | grep -q "InsufficientInstanceCapacity"; then
            warn "no capacity for $INSTANCE_TYPE (attempt $attempt/3), retrying in 60s ..."
            sleep 60
            continue
        fi
        say "ERROR: start-instances failed: $out"
        return 1
    done
    say "ERROR: still no capacity for $INSTANCE_TYPE. Try another size: start.sh --size xlarge (or 2xlarge)."
    return 1
}

# The Elastic IP named <NAME>-eip associated with $1, allocated (tagged) when missing.
eip_ensure() {
    local id="$1" alloc assoc
    alloc="$(awsc "" ec2 describe-addresses --filters "Name=tag:Name,Values=$RES_EIP" \
        --query 'Addresses[0].AllocationId' --output text | _none)"
    if [ -z "$alloc" ]; then
        say "Allocating Elastic IP $RES_EIP ..."
        alloc="$(awsc "<allocation-id>" ec2 allocate-address --domain vpc \
            --tag-specifications "$(tag_spec elastic-ip "$RES_EIP")" --query 'AllocationId' --output text)" || return 1
    fi
    assoc="$(awsc "" ec2 describe-addresses --allocation-ids "$alloc" --query 'Addresses[0].InstanceId' --output text | _none)"
    if [ "$assoc" != "$id" ]; then
        awsc "" ec2 associate-address --allocation-id "$alloc" --instance-id "$id" --allow-reassociation --output text > /dev/null || return 1
        say "Elastic IP $RES_EIP associated with $id."
    fi
}

# AdminIpWhitelist of the test stack, or "None" when the parameter is missing.
stack_get_allowlist() {
    AWSC_REGION="$ROBOT_EC2_STACK_REGION" awsc "<saved-allow-list>" cloudformation describe-stacks --stack-name "$ROBOT_EC2_STACK" \
        --query "Stacks[0].Parameters[?ParameterKey=='AdminIpWhitelist'].ParameterValue | [0]" --output text
}

# Puts value $1 (may be empty) in the stack AdminIpWhitelist, previous template and every other value kept.
stack_set_allowlist() {
    local value="$1" current keys key json out
    current="$(stack_get_allowlist)" || return 1
    if [ "$current" = "$value" ]; then
        say "Admin allow-list of $ROBOT_EC2_STACK already '$value'."
        return 0
    fi
    keys="$(AWSC_REGION="$ROBOT_EC2_STACK_REGION" awsc "<parameter-keys>" cloudformation describe-stacks --stack-name "$ROBOT_EC2_STACK" \
        --query 'Stacks[0].Parameters[].ParameterKey' --output text)" || return 1
    json="["
    for key in $keys; do
        [ "$key" = "AdminIpWhitelist" ] || json+="{\"ParameterKey\":\"$key\",\"UsePreviousValue\":true},"
    done
    json+="{\"ParameterKey\":\"AdminIpWhitelist\",\"ParameterValue\":\"$value\"}]"
    say "Restoring the admin allow-list of $ROBOT_EC2_STACK to '$value' ..."
    if ! out="$(AWSC_REGION="$ROBOT_EC2_STACK_REGION" awsc "" cloudformation update-stack --stack-name "$ROBOT_EC2_STACK" \
        --use-previous-template --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND --parameters "$json" 2>&1)"; then
        printf '%s' "$out" | grep -q "No updates are to be performed" && return 0
        say "ERROR: update-stack failed: $out"
        return 1
    fi
    AWSC_REGION="$ROBOT_EC2_STACK_REGION" awsc "" cloudformation wait stack-update-complete --stack-name "$ROBOT_EC2_STACK"
}

# Writes back one saved Lambda env ({"Variables": {...}}, file named <function>.json).
lambda_env_restore() {
    local file="$1" fn
    fn="$(basename "$file" .json)"
    say "Restoring the Lambda env of $fn ..."
    AWSC_REGION="$ROBOT_EC2_STACK_REGION" awsc "" lambda update-function-configuration --function-name "$fn" \
        --environment "file://$file" --output text > /dev/null \
        && AWSC_REGION="$ROBOT_EC2_STACK_REGION" awsc "" lambda wait function-updated --function-name "$fn"
}

# Local tools every remote step needs.
require_local_tools() {
    local t
    for t in aws ssh rsync session-manager-plugin; do
        command -v "$t" > /dev/null || die "'$t' is not installed (session-manager-plugin: https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html)."
    done
}

# Instance of the configured name that must exist; prints its id or stops.
require_instance() {
    local id rc
    id="$(find_instance)"; rc=$?
    [ "$rc" -eq 0 ] || exit 1
    [ -n "$id" ] || die "no instance named '$RES_INSTANCE' in $ROBOT_EC2_REGION: run create.sh first."
    printf '%s' "$id"
}
