#!/usr/bin/env bash
# v0.41.0 — OSV-Scanner over the code/ dependency manifests with the CI osv-scanner.toml; one aggregate exit code.
# Reports in code/scripts/dev/dependency_scan_results/ (git-ignored); --help for the options.

# No `set -e`: keep going past a failing component so the summary covers them all.
set -uo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
RESULTS_DIR="$PROJECT_ROOT/code/scripts/dev/dependency_scan_results"
CONFIG="$PROJECT_ROOT/osv-scanner.toml"
OSV_SCANNER="${OSV_SCANNER:-osv-scanner}"
OSV_VERSION="v2.6.0"
TS="$(date +%Y%m%d_%H%M%S)"
COMPONENTS="java python aws react-admin react-game"

usage() {
	cat <<EOF
Usage: code/scripts/dev/run_dependency_scan.sh [--only java,python,aws,react-admin,react-game]
  java         every pom.xml under code/backend/java (target/ excluded)
  python       code/backend/python/requirements.txt
  aws          code/backend/aws/requirements*.txt
  react-admin  code/frontend/react-admin/package-lock.json
  react-game   code/frontend/react-game/package-lock.json
Env: OSV_SCANNER (binary, default osv-scanner).
Exit code: 0 no known vulnerability, 1 vulnerabilities or a scan error, 2 osv-scanner missing, 3 bad arguments.
EOF
}

ONLY=""
while [ $# -gt 0 ]; do
	case "$1" in
		--only=*) ONLY="${1#--only=}" ;;
		--only)   shift; ONLY="${1:-}" ;;
		-h|--help) usage; exit 0 ;;
		*) echo "Unknown argument: $1" >&2; usage >&2; exit 3 ;;
	esac
	shift
done
for c in ${ONLY//,/ }; do
	case " $COMPONENTS " in *" $c "*) ;; *) echo "Unknown component in --only: $c" >&2; exit 3 ;; esac
done

want() { # scan component $1?
	[ -z "$ONLY" ] && return 0
	case ",$ONLY," in *",$1,"*) return 0 ;; *) return 1 ;; esac
}

print_install_help() {
	local os arch
	os="$(uname -s | tr '[:upper:]' '[:lower:]')"
	arch="$(uname -m)"
	case "$arch" in x86_64) arch=amd64 ;; aarch64|arm64) arch=arm64 ;; esac
	cat <<EOF
osv-scanner is not on the PATH (or OSV_SCANNER points nowhere). Install it with one of:

  # 1. release binary into ~/.local/bin (same major version as the CI job)
  mkdir -p ~/.local/bin && curl -fsSL -o ~/.local/bin/osv-scanner \\
    https://github.com/google/osv-scanner/releases/download/${OSV_VERSION}/osv-scanner_${os}_${arch} \\
    && chmod +x ~/.local/bin/osv-scanner && osv-scanner --version

  # 2. Docker image, nothing installed (run from the repository root)
  docker run --rm -v "\$PWD:/src" -w /src ghcr.io/google/osv-scanner:latest \\
    scan source --config=osv-scanner.toml -L code/frontend/react-game/package-lock.json

Then run again: code/scripts/dev/run_dependency_scan.sh
EOF
}

if ! command -v "$OSV_SCANNER" >/dev/null 2>&1; then
	print_install_help >&2
	exit 2
fi

mkdir -p "$RESULTS_DIR"
# Clear the reports of the previous run (SCAN_*) before this one.
rm -f "$RESULTS_DIR"/SCAN_* 2>/dev/null || true

NAMES=()
declare -A R_STATUS R_REPORT
FAILED=0

banner() { echo "================================================================"; echo ">> $1"; echo "================================================================"; }

scan() { # name file...
	local name="$1"; shift
	want "$name" || return 0
	local report="$RESULTS_DIR/SCAN_${name}_${TS}.txt" args=() f rc status
	for f in "$@"; do
		[ -f "$f" ] && args+=("--lockfile=$f")
	done
	NAMES+=("$name"); R_REPORT[$name]="$report"
	if [ ${#args[@]} -eq 0 ]; then
		R_STATUS[$name]="SKIP(no manifest)"
		return 0
	fi
	banner "$name (${#args[@]} manifest(s))   report: $report"
	( cd "$PROJECT_ROOT" && "$OSV_SCANNER" scan source --config="$CONFIG" --format=table "${args[@]}" ) 2>&1 | tee "$report"
	rc=${PIPESTATUS[0]}
	case "$rc" in
		0) status="OK" ;;
		1) status="VULNERABLE"; FAILED=1 ;;
		*) status="ERROR(rc=$rc)"; FAILED=1 ;;
	esac
	R_STATUS[$name]="$status"
}

echo "PathsGames — run_dependency_scan ($TS), $("$OSV_SCANNER" --version 2>/dev/null | head -1)"
[ -n "$ONLY" ] && echo "Filter --only: $ONLY"

mapfile -t JAVA_POMS < <(find "$PROJECT_ROOT/code/backend/java" -name pom.xml -not -path '*/target/*' | sort)
scan java "${JAVA_POMS[@]}"
scan python "$PROJECT_ROOT/code/backend/python/requirements.txt"
scan aws "$PROJECT_ROOT"/code/backend/aws/requirements*.txt
scan react-admin "$PROJECT_ROOT/code/frontend/react-admin/package-lock.json"
scan react-game "$PROJECT_ROOT/code/frontend/react-game/package-lock.json"

SUMMARY="$RESULTS_DIR/SCAN_summary_${TS}.txt"
{
	echo ""
	echo "================================================================"
	echo " SUMMARY (dependency scan, config $CONFIG)"
	echo "================================================================"
	printf ' %-14s %-18s %s\n' "COMPONENT" "STATUS" "REPORT"
	printf ' %-14s %-18s %s\n' "--------------" "------" "------"
	for n in "${NAMES[@]}"; do
		printf ' %-14s %-18s %s\n' "$n" "${R_STATUS[$n]}" "${R_REPORT[$n]}"
	done
} | tee "$SUMMARY"

exit "$FAILED"
