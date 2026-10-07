#!/usr/bin/env bash
# export_golden_files.sh - v0.41.4 writes the golden match exports (decision 66) on every local backend:
# each runner in ROBOT_GOLDEN=1 mode saves fixtures/golden/export_<backend>.json and imports every golden.
#
# Uso: export_golden_files.sh [--only=java,python,aws-local]
#   java       LOCAL_JAVA (SQLite)  -> export_java.json   (not Java + PostgreSQL: same file name)
#   python     LOCAL_PYTHON         -> export_python.json
#   aws-local  AWS_LOCAL (sam local) -> export_aws.json   (the deployed AWS stack is never touched)
# Afterwards: review the files with git diff, commit them; every normal run then imports them all.

set -uo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
RUNNERS="$PROJECT_ROOT/code/scripts/dev/run_robots"
RESULTS_DIR="$PROJECT_ROOT/code/scripts/dev/run_robot_results"
GOLDEN_DIR="$PROJECT_ROOT/code/tests/robot/tests/41_alpha_prep/fixtures/golden"

ONLY="java,python,aws-local"
for arg in "$@"; do
    case "$arg" in
        --only=*) ONLY="${arg#--only=}" ;;
        -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
        *) echo "Unknown argument: $arg (use --only=java,python,aws-local)" >&2; exit 1 ;;
    esac
done

# key | display name | runner | golden file
declare -a RUNS=(
    "java|GOLDEN_LOCAL_JAVA|run_robot_with_local_java.sh|export_java.json"
    "python|GOLDEN_LOCAL_PYTHON|run_robot_with_local_python.sh|export_python.json"
    "aws-local|GOLDEN_AWS_LOCAL|run_robot_with_aws_local.sh|export_aws.json"
)
mkdir -p "$RESULTS_DIR"
declare -A RC SUMMARY
start=$(date +%s)
for run in "${RUNS[@]}"; do
    IFS='|' read -r key name runner file <<< "$run"
    [[ ",$ONLY," == *",$key,"* ]] || continue
    log="$RESULTS_DIR/${name}_$(date +%Y%m%d_%H%M%S).log"
    echo "======== $name ($runner) ========"
    (cd "$PROJECT_ROOT" && ROBOT_GOLDEN=1 bash "$RUNNERS/$runner") 2>&1 | while IFS= read -r line; do
        printf "  %s\n" "$line" | tee -a "$log"
    done
    RC["$name"]=${PIPESTATUS[0]}
    SUMMARY["$name"]="$(grep -E '^\s*[0-9]+ tests?, ' "$log" | tail -n 1 | sed 's/^ *//')"
done

echo -e "\n===== Golden exports (export_golden_files) =====\n"
printf "%-22s %-6s %-4s %-24s %s\n" "RUN" "STATUS" "RC" "FILE" "ROBOT"
failures=0
for run in "${RUNS[@]}"; do
    IFS='|' read -r key name runner file <<< "$run"
    [ -n "${RC[$name]+x}" ] || continue
    status=OK
    if [ "${RC[$name]}" -ne 0 ] || [ ! -f "$GOLDEN_DIR/$file" ]; then status=FAIL; failures=$((failures + 1)); fi
    printf "%-22s %-6s %-4s %-24s %s\n" "$name" "$status" "${RC[$name]}" "$file" "${SUMMARY[$name]:--}"
done
total=$(( $(date +%s) - start ))
printf "\nTotal time: %dm %ds\n" $((total / 60)) $((total % 60))

echo -e "\nGolden files in $GOLDEN_DIR:"
ls -l "$GOLDEN_DIR"/export_*.json 2> /dev/null || echo "  (none)"
echo -e "\nChanges to review and commit:"
git -C "$PROJECT_ROOT" status --short -- "$GOLDEN_DIR"
[ "$failures" -eq 0 ] || { echo -e "\n$failures golden run(s) failed. Logs in $RESULTS_DIR"; exit 2; }
