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
