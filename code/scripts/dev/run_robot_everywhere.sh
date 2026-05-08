#!/usr/bin/env bash
# run_robot_everywhere.sh
# Esegue in sequenza gli script di test Robot per tutti gli ambienti
# Raccoglie log e risultati e stampa un report riassuntivo al termine.

set -uo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
WORKDIR="$PROJECT_ROOT"
RESULTS_DIR="$WORKDIR/code/script/dev/run_robot_results"
mkdir -p "$RESULTS_DIR"
rm -f "$RESULTS_DIR"/*.log

# Map: display name | script path | expected robot report dir (relative to code/tests/robot)
declare -a ENVS
ENVS+=("AWS|$WORKDIR/code/script/dev/run_robots/run_robot_with_aws_serverless.sh|reports-aws")
ENVS+=("LOCAL_JAVA_POSTGRES|$WORKDIR/code/script/dev/run_robots/run_robot_with_local_java_postgres.sh|reports-local-java-postgres")
ENVS+=("LOCAL_JAVA|$WORKDIR/code/script/dev/run_robots/run_robot_with_local_java.sh|reports-local-java")
ENVS+=("LOCAL_PHP|$WORKDIR/code/script/dev/run_robots/run_robot_with_local_php.sh|reports-local-php")
ENVS+=("LOCAL_PYTHON|$WORKDIR/code/script/dev/run_robots/run_robot_with_local_python.sh|reports-local-python")

# Results arrays
declare -A STATUS
declare -A EXITCODE
declare -A DURATION
declare -A LOGFILE
declare -A REPORTPATH

run_one() {
    local name="$1"
    local script="$2"
    local reportdir_rel="$3"
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
    # run the script and capture stdout/stderr into logfile
    bash "$script" >> "$logfile" 2>&1
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
for e in "${ENVS[@]}"; do
    IFS='|' read -r name script reportdir <<< "$e"
    run_one "$name" "$script" "$reportdir"
done

# Summary report
echo -e "\n===== Robot summary (run_robot_everywhere) =====\n"
printf "%-25s %-8s %-8s %-10s %s\n" "ENVIRONMENT" "STATUS" "RC" "DURATION(s)" "REPORT/LOG"
printf "%-25s %-8s %-8s %-10s %s\n" "-----------" "------" "--" "----------" "----------"
failures=0
for e in "${ENVS[@]}"; do
    IFS='|' read -r name script reportdir <<< "$e"
    rc=${EXITCODE["$name"]:-255}
    st=${STATUS["$name"]:-MISSING}
    dur=${DURATION["$name"]:-0}
    rpt=${REPORTPATH["$name"]}
    log=${LOGFILE["$name"]}
    if [ "$st" != "OK" ]; then
        failures=$((failures+1))
    fi
    display_rpt="$rpt"
    if [ -n "$log" ]; then display_rpt="$display_rpt (log: $log)"; fi
    #printf "%-25s %-8s %-8s %-10s %s\n" "$name" "$st" "$rc" "$dur" "$display_rpt"
    printf "%-25s %-8s %-8s %-10s \n" "$name" "$st" "$rc" "$dur"
done

if [ "$failures" -gt 0 ]; then
    echo -e "\nOne or more runs failed ($failures). See logs in $RESULTS_DIR"
    exit 2
else
    echo -e "\nAll runs finished successfully. Reports/logs in $RESULTS_DIR and code/tests/robot/*"
    exit 0
fi
