#!/usr/bin/env bash
# v0.41.0 — admin IP allow-list helpers (caller public IP + merge), sourced by the AWS deploy scripts.
# Messages go to stderr, stdout carries only the list so callers can capture it.

# Current public IPv4 of this machine, or empty when neither service answers.
admin_ip_detect() {
    local ip
    ip="$(curl -sf --max-time 10 https://checkip.amazonaws.com || curl -sf --max-time 10 https://api.ipify.org || true)"
    ip="$(printf '%s' "$ip" | tr -d '[:space:]')"
    if [[ "$ip" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]]; then
        printf '%s' "$ip"
    fi
}

# v1.8.0 — the public IPv4 Cloudflare sees (behind a VPN it may differ from the one AWS sees), or empty.
admin_ip_detect_cloudflare() {
    local ip
    ip="$(curl -sf --max-time 5 https://www.cloudflare.com/cdn-cgi/trace 2>/dev/null | sed -n 's/^ip=//p' | tr -d '[:space:]')"
    if [[ "$ip" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]]; then
        printf '%s' "$ip"
    fi
}

# Comma list $1 plus IP $2, blanks dropped and duplicates removed (order kept).
admin_ip_merge() {
    local base="${1:-}" ip="${2:-}"
    printf '%s,%s' "$base" "$ip" | tr ',' '\n' | tr -d '[:blank:]' | awk 'NF && !seen[$0]++' | paste -sd, -
}

# Prints the allow-list to deploy: $1 (list from .env) merged with the caller IP; $2 = AdminIpEmptyMeans.
admin_ip_whitelist() {
    local base="${1:-}" empty_means="${2:-nobody}" ip list
    echo "Detecting current public IP for the admin allow-list..." >&2
    ip="$(admin_ip_detect)"
    if [ -n "$ip" ]; then
        echo "  Current public IP: $ip" >&2
    else
        echo "  WARNING: could not detect the public IP — the allow-list only has the .env entries." >&2
    fi
    list="$(admin_ip_merge "$base" "$ip")"
    if [ -n "$list" ]; then
        echo "  Admin IP allow-list: $list" >&2
    elif [ "$empty_means" = "everybody" ]; then
        echo "  WARNING: admin IP allow-list is empty and AdminIpEmptyMeans=everybody — admin API open to ANY IP!" >&2
    else
        echo "  WARNING: admin IP allow-list is empty — admin API closed to everybody (AdminIpEmptyMeans=$empty_means)." >&2
    fi
    printf '%s' "$list"
}

# v0.42.0 — REPLACES the admin allow-list of stack $1 (region $2) with IP $3: previous template, every other
# parameter kept, waits for the update. $4 = true prints the command only. The authorizer compares bare IPs.
# v1.8.0 — $3 may be a comma list of IPv4 (no spaces); every entry is checked.
admin_ip_set_on_stack() {
    local stack="$1" region="$2" ip="$3" dry_run="${4:-false}" key out entry
    local params=()
    if [ -z "$ip" ]; then
        echo "Error: no valid public IPv4 (detected or --ip): ''." >&2
        return 1
    fi
    for entry in ${ip//,/ }; do
        if ! [[ "$entry" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]]; then
            echo "Error: no valid public IPv4 (detected or --ip): '$entry'." >&2
            return 1
        fi
    done
    echo "Stack $stack ($region): admin allow-list -> $ip (replaces the previous list)."
    if [ "$dry_run" = "true" ]; then
        echo "Dry run: aws cloudformation update-stack --stack-name $stack --use-previous-template" \
            "--capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND --parameters <every other key>,UsePreviousValue=true" \
            "ParameterKey=AdminIpWhitelist,ParameterValue=${ip//,/\\,}"
        return 0
    fi
    for key in $(aws cloudformation describe-stacks --region "$region" --stack-name "$stack" \
        --query 'Stacks[0].Parameters[].ParameterKey' --output text); do
        if [ "$key" != "AdminIpWhitelist" ]; then params+=("ParameterKey=$key,UsePreviousValue=true"); fi
    done
    # the CLI shorthand splits on commas: the ones inside the list are escaped
    params+=("ParameterKey=AdminIpWhitelist,ParameterValue=${ip//,/\\,}")
    out="$(aws cloudformation update-stack --region "$region" --stack-name "$stack" --use-previous-template \
        --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND --parameters "${params[@]}" 2>&1)" || {
        if printf '%s' "$out" | grep -q "No updates are to be performed"; then
            echo "Nothing to update: the allow-list already is $ip."
            return 0
        fi
        echo "$out" >&2
        return 1
    }
    echo "Waiting for stack-update-complete..."
    aws cloudformation wait stack-update-complete --region "$region" --stack-name "$stack"
        echo "Admin API open for $ip only (the authorizer has no cache: effective now)."
}
