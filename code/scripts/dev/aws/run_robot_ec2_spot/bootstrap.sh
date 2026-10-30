#!/usr/bin/env bash
# bootstrap.sh - v1.10.0 runs ON the Robot EC2 (Ubuntu 24.04 arm64, as root, piped by run_all.sh/create.sh):
# every tool run_robot_everywhere.sh needs. Idempotent: seconds when BOOTSTRAP_VERSION matches the marker.
set -euo pipefail

# Bump to make the next run_all.sh upgrade the server.
BOOTSTRAP_VERSION="1"
MARKER_DIR="/var/lib/pathsgames-robot"
MARKER="$MARKER_DIR/bootstrap.version"
LOG="/var/log/pathsgames-robot-bootstrap.log"
TARGET_USER="ubuntu"
REMOTE_DIR="/home/ubuntu/pathsgames"
VENV_ONLY=false
FORCE=false
while [ $# -gt 0 ]; do
    case "$1" in
        --user) TARGET_USER="$2"; shift 2 ;;
        --remote-dir) REMOTE_DIR="$2"; shift 2 ;;
        --venv-only) VENV_ONLY=true; shift ;;
        --force) FORCE=true; shift ;;
        --version) echo "$BOOTSTRAP_VERSION"; exit 0 ;;
        *) echo "bootstrap.sh: unknown argument '$1'" >&2; exit 2 ;;
    esac
done

step() { echo "[bootstrap] $*"; }

# Robot venv of the repo (Ubuntu python3 = 3.12, accepted by the backend's poetry "python = ^3.12").
robot_venv() {
    local req="$REMOTE_DIR/code/tests/robot/requirements.txt"
    [ -f "$req" ] || { step "robot venv: $req not synced yet, skipped"; return 0; }
    local cmd="cd '$REMOTE_DIR' && { [ -x .venv/bin/python ] || python3 -m venv .venv; } && .venv/bin/pip install -q --upgrade pip && .venv/bin/pip install -q -r '$req' boto3 pyyaml"
    if [ "$(id -un)" = "$TARGET_USER" ]; then bash -c "$cmd"; else sudo -u "$TARGET_USER" -H bash -c "$cmd"; fi
    step "robot venv ready: $REMOTE_DIR/.venv"
}

if [ "$VENV_ONLY" = "true" ]; then
    robot_venv
    exit 0
fi
[ "$(id -u)" -eq 0 ] || { echo "bootstrap.sh must run as root (sudo)." >&2; exit 1; }
[ "$(uname -m)" = "aarch64" ] || { echo "bootstrap.sh expects arm64 (aarch64), found $(uname -m)." >&2; exit 1; }

tools_ok() {
    local t
    for t in java mvn docker aws sam uv python3.13 rsync fuser unzip; do command -v "$t" > /dev/null || return 1; done
}
if [ "$FORCE" != "true" ] && [ "$(cat "$MARKER" 2> /dev/null || true)" = "$BOOTSTRAP_VERSION" ] && tools_ok; then
    step "version $BOOTSTRAP_VERSION already installed."
    robot_venv
    exit 0
fi
step "installing version $BOOTSTRAP_VERSION (was: $(cat "$MARKER" 2> /dev/null || echo none)), log $LOG ..."
mkdir -p "$MARKER_DIR"
export DEBIAN_FRONTEND=noninteractive
APT=(apt-get -y -q -o DPkg::Lock::Timeout=900)
TMP="$(mktemp -d)"
trap 'rc=$?; rm -rf "$TMP"; if [ "$rc" -ne 0 ]; then echo "[bootstrap] FAILED, last lines of $LOG:"; tail -n 30 "$LOG"; fi' EXIT

step "apt packages (Java 21, Maven, Python 3.12, build tools) ..."
cloud-init status --wait > /dev/null 2>&1 || true
"${APT[@]}" update >> "$LOG" 2>&1
"${APT[@]}" install ca-certificates curl gnupg unzip rsync psmisc iproute2 openssl jq git build-essential \
    openjdk-21-jdk-headless maven python3 python3-venv python3-pip python3-dev >> "$LOG" 2>&1

step "Docker (official repository) ..."
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
# shellcheck disable=SC1091
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
"${APT[@]}" update >> "$LOG" 2>&1
"${APT[@]}" install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >> "$LOG" 2>&1
systemctl enable --now docker >> "$LOG" 2>&1
usermod -aG docker "$TARGET_USER"

step "AWS CLI v2 (arm64) ..."
curl -fsSL -o "$TMP/awscli.zip" https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip
unzip -q -o "$TMP/awscli.zip" -d "$TMP"
"$TMP/aws/install" --update --bin-dir /usr/local/bin --install-dir /usr/local/aws-cli >> "$LOG" 2>&1

step "SAM CLI (arm64) ..."
curl -fsSL -o "$TMP/sam.zip" https://github.com/aws/aws-sam-cli/releases/latest/download/aws-sam-cli-linux-arm64.zip
unzip -q -o "$TMP/sam.zip" -d "$TMP/sam"
"$TMP/sam/install" --update >> "$LOG" 2>&1

# sam build (no container) needs the Lambda runtime python3.13 on PATH: uv installs it, linked as python3.13 only.
step "Python 3.13 for sam build (uv) ..."
curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin UV_NO_MODIFY_PATH=1 sh >> "$LOG" 2>&1
export UV_PYTHON_INSTALL_DIR=/opt/uv/python
uv python install 3.13 >> "$LOG" 2>&1
PY313="$(uv python find 3.13)"
ln -sf "$PY313" /usr/local/bin/python3.13
# uv marks its Pythons externally managed; this one only serves sam build's pip.
find /opt/uv/python -name EXTERNALLY-MANAGED -path '*python3.13*' -delete
python3.13 -m pip --version >> "$LOG" 2>&1 || python3.13 -m ensurepip --upgrade >> "$LOG" 2>&1
chmod -R a+rX /opt/uv

step "versions: $(java -version 2>&1 | head -n 1) | $(mvn -v 2>/dev/null | head -n 1) | $(docker --version) | $(aws --version 2>&1) | $(sam --version) | $(python3 --version) | $(python3.13 --version)"
robot_venv
echo "$BOOTSTRAP_VERSION" > "$MARKER"
step "done (version $BOOTSTRAP_VERSION)."
