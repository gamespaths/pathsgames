#!/usr/bin/env bash
# run_robot_everywhere.sh
# Esegue in sequenza gli script di test Robot per tutti gli ambienti
# Raccoglie log e risultati e stampa un report riassuntivo al termine.
#
# Uso: run_robot_everywhere.sh [--aws=local|remote|all|skip] [--no-golden]
#   --aws=local   backend AWS in locale: DynamoDB Local + sam local (code/scripts/dev/aws_run_local) (default)
#   --aws=remote  backend AWS deployato (+ AWS_LIMITED: rate limit accesi per qualche minuto sullo stack test)
#   --aws=all     entrambi: AWS locale e AWS deployato
#   --aws=skip    nessun run AWS
#   --no-golden   salta i giri GOLDEN_* (come export_golden_files.sh: riscrivono fixtures/golden/export_*.json)
# In alternativa al flag: variabile d'ambiente ROBOT_AWS_MODE.

set -uo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
WORKDIR="$PROJECT_ROOT"
RESULTS_DIR="$WORKDIR/code/scripts/dev/run_robot_results"

AWS_MODE="${ROBOT_AWS_MODE:-local}"
GOLDEN=1
for arg in "$@"; do
    case "$arg" in
        --aws=*) AWS_MODE="${arg#--aws=}" ;;
        --no-golden) GOLDEN=0 ;;
        -h|--help) sed -n '2,13p' "$0"; exit 0 ;;
        *) echo "Unknown argument: $arg (use --aws=local|remote|all|skip, --no-golden)" >&2; exit 1 ;;
    esac
done

# Map: display name | script path | expected robot report dir (relative to code/tests/robot) | extra env
declare -a ENVS
# v0.41.4 - the golden exports first (export_golden_files.sh): each writes its file and imports every
# golden, so the runs after it import the files just written.
if [ "$GOLDEN" = "1" ]; then
    ENVS+=("GOLDEN_LOCAL_JAVA|$WORKDIR/code/scripts/dev/run_robots/run_robot_with_local_java.sh|reports-local-java-golden|ROBOT_GOLDEN=1")
    ENVS+=("GOLDEN_LOCAL_PYTHON|$WORKDIR/code/scripts/dev/run_robots/run_robot_with_local_python.sh|reports-local-python-golden|ROBOT_GOLDEN=1")
    case "$AWS_MODE" in
        local|all) ENVS+=("GOLDEN_AWS_LOCAL|$WORKDIR/code/scripts/dev/run_robots/run_robot_with_aws_local.sh|reports-aws-local-golden|ROBOT_GOLDEN=1") ;;
    esac
fi
AWS_REMOTE_ENV="AWS|$WORKDIR/code/scripts/dev/run_robots/run_robot_with_aws_serverless.sh|reports-aws"
AWS_LOCAL_ENV="LOCAL_AWS|$WORKDIR/code/scripts/dev/run_robots/run_robot_with_aws_local.sh|reports-aws-local"
case "$AWS_MODE" in
    local)  ENVS+=("$AWS_LOCAL_ENV") ;;
    remote) ENVS+=("$AWS_REMOTE_ENV") ;;
    all)    ENVS+=("$AWS_LOCAL_ENV" "$AWS_REMOTE_ENV") ;;
    skip)   ;;
    *) echo "Invalid --aws value: $AWS_MODE (use local, remote, all or skip)" >&2; exit 1 ;;
esac

mkdir -p "$RESULTS_DIR"
rm -f "$RESULTS_DIR"/*.log
ENVS+=("LOCAL_JAVA_POSTGRES|$WORKDIR/code/scripts/dev/run_robots/run_robot_with_local_java_postgres.sh|reports-local-java-postgres")
ENVS+=("LOCAL_JAVA|$WORKDIR/code/scripts/dev/run_robots/run_robot_with_local_java.sh|reports-local-java")
ENVS+=("LOCAL_PYTHON|$WORKDIR/code/scripts/dev/run_robots/run_robot_with_local_python.sh|reports-local-python")
# v0.41.4 - second pass with the rate limits on: only the rate-limit tests, separate reports.
case "$AWS_MODE" in
    local|all) ENVS+=("LOCAL_AWS_LIMITED|$WORKDIR/code/scripts/dev/run_robots/run_robot_with_aws_local.sh|reports-aws-local-limited|ROBOT_RATE_LIMITS=1") ;;
esac
ENVS+=("LOCAL_JAVA_POSTGRES_LIMIT|$WORKDIR/code/scripts/dev/run_robots/run_robot_with_local_java_postgres.sh|reports-local-java-postgres-limited|ROBOT_RATE_LIMITS=1")
ENVS+=("LOCAL_JAVA_LIMITED|$WORKDIR/code/scripts/dev/run_robots/run_robot_with_local_java.sh|reports-local-java-limited|ROBOT_RATE_LIMITS=1")
ENVS+=("LOCAL_PYTHON_LIMITED|$WORKDIR/code/scripts/dev/run_robots/run_robot_with_local_python.sh|reports-local-python-limited|ROBOT_RATE_LIMITS=1")
# On the deployed test stack the limits are switched on in the Lambda env for the run, then put back.
case "$AWS_MODE" in
    remote|all) ENVS+=("LOCAL_AWS_LIMITED|$WORKDIR/code/scripts/dev/run_robots/run_robot_with_aws_local.sh|reports-aws-local-limited|ROBOT_RATE_LIMITS=1") ;;
esac

# Results arrays
declare -A STATUS
declare -A EXITCODE
declare -A DURATION
declare -A LOGFILE
declare -A REPORTPATH

_run_indented() {
    local script="$1" logfile="$2" extra_env="$3"
    # shellcheck disable=SC2086
    env $extra_env bash "$script" 2>&1 | while IFS= read -r line; do
        printf "  %s\n" "$line" | tee -a "$logfile"
    done
    return ${PIPESTATUS[0]}
}

run_one() {
    local name="$1"
    local script="$2"
    local reportdir_rel="$3"
    local extra_env="${4:-}"
    local label="${name}"
    local timestamp="$(date +%Y%m%d_%H%M%S)"
    local logfile="$RESULTS_DIR/${name}_${timestamp}.log"
    LOGFILE["$name"]="$logfile"
    echo "\n======== Running $label ========" | tee -a "$logfile"
    if [ ! -f "$script" ]; then
        echo "Script not found: $script" | tee -a "$logfile"
        STATUS["$name"]="MISSING"
        EXITCODE["$name"]=127
        DURATION["$name"]=0
        REPORTPATH["$name"]=""
        return
    fi

    pushd "$WORKDIR" > /dev/null || return
    start=$(date +%s)
    _run_indented "$script" "$logfile" "$extra_env"
    rc=$?
    end=$(date +%s)
    popd > /dev/null || return

    dur=$((end - start))
    EXITCODE["$name"]=$rc
    DURATION["$name"]=$dur
    if [ $rc -eq 0 ]; then
        STATUS["$name"]="OK"
    else
        STATUS["$name"]="FAIL"
    fi

    # locate report dir if exists
    local reportpath="$WORKDIR/code/tests/robot/$reportdir_rel"
    if [ -d "$reportpath" ]; then
        # prefer output.xml or report.html if present
        if [ -f "$reportpath/output.xml" ]; then
            REPORTPATH["$name"]="$reportpath/output.xml"
        elif [ -f "$reportpath/report.html" ]; then
            REPORTPATH["$name"]="$reportpath/report.html"
        else
            # any file
            REPORTPATH["$name"]="$reportpath"
        fi
    else
        REPORTPATH["$name"]=""
    fi
}

# Run all envs sequentially
total_start=$(date +%s)
for e in "${ENVS[@]}"; do
    IFS='|' read -r name script reportdir extra_env <<< "$e"
    run_one "$name" "$script" "$reportdir" "$extra_env"
done

# Robot counts of one run, from the last "N tests, N passed, N failed[, N skipped]" line of its log.
_counts() {
    local line="" n kind tests=- passed=- failed=- skipped=-
    [ -n "$1" ] && [ -f "$1" ] && line="$(grep -E '^\s*[0-9]+ tests?, ' "$1" | tail -n 1)"
    if [ -n "$line" ]; then
        tests=0; passed=0; failed=0; skipped=0
        while read -r n kind; do
            case "$kind" in
                test|tests) tests=$n ;; passed) passed=$n ;; failed) failed=$n ;; skipped) skipped=$n ;;
            esac
        done < <(echo "$line" | tr ',' '\n')
    fi
    echo "$tests $passed $failed $skipped"
}

# Summary report
echo -e "\n===== Robot summary (run_robot_everywhere) =====\n"
printf "%-25s %-8s %-4s %-11s %-6s %-6s %-6s %-6s\n" "ENVIRONMENT" "STATUS" "RC" "DURATION(s)" "TESTS" "PASS" "FAIL" "SKIP"
printf "%-25s %-8s %-4s %-11s %-6s %-6s %-6s %-6s\n" "-----------" "------" "--" "-----------" "-----" "----" "----" "----"
failures=0
for e in "${ENVS[@]}"; do
    IFS='|' read -r name script reportdir <<< "$e"
    rc=${EXITCODE["$name"]:-255}
    st=${STATUS["$name"]:-MISSING}
    dur=${DURATION["$name"]:-0}
    rpt=${REPORTPATH["$name"]}
    log=${LOGFILE["$name"]:-}
    if [ "$st" != "OK" ]; then
        failures=$((failures+1))
    fi
    display_rpt="$rpt"
    if [ -n "$log" ]; then display_rpt="$display_rpt (log: $log)"; fi
    #printf "%-25s %-8s %-8s %-10s %s\n" "$name" "$st" "$rc" "$dur" "$display_rpt"
    read -r n_tests n_pass n_fail n_skip <<< "$(_counts "$log")"
    printf "%-25s %-8s %-4s %-11s %-6s %-6s %-6s %-6s\n" "$name" "$st" "$rc" "$dur" "$n_tests" "$n_pass" "$n_fail" "$n_skip"
done

total_end=$(date +%s)
total_s=$((total_end - total_start))
printf "\nTotal time: %dm %ds\n" $((total_s / 60)) $((total_s % 60))

if [ "$failures" -gt 0 ]; then
    echo -e "\nOne or more runs failed ($failures). See logs in $RESULTS_DIR"
    exit 2
else
    echo -e "\nAll runs finished successfully. Reports/logs in $RESULTS_DIR and code/tests/robot/*"
    exit 0
fi
