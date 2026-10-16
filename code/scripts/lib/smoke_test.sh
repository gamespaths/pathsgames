#!/usr/bin/env bash
# v1.1.0 — runs the smoke-test Lambda of a stage after a deploy ({"trigger":"deploy"}), sourced by the AWS deploy scripts.
# smoke_test_invoke <function> <region>: prints the run summary; returns 1 on FunctionError or a result other than PASS.

smoke_test_invoke() {
	local fn="${1:-}" region="${2:-}" out meta rc=0
	if [ -z "$fn" ] || [ -z "$region" ]; then
		echo "Error: smoke_test_invoke <function> <region>." >&2
		return 2
	fi
	out="$(mktemp)"
	echo "Smoke test: invoking $fn in $region (trigger deploy, up to 5 minutes)..."
	if ! meta="$(aws lambda invoke --function-name "$fn" --region "$region" \
		--invocation-type RequestResponse --cli-read-timeout 300 \
		--cli-binary-format raw-in-base64-out --payload '{"trigger":"deploy"}' \
		--output json "$out")"; then
		echo "Smoke test: 'aws lambda invoke' failed for $fn." >&2
		rm -f "$out"
		return 1
	fi
	python3 - "$out" "$meta" <<'PY' || rc=1
import json, sys
raw = open(sys.argv[1], encoding="utf-8").read()
try:
    meta = json.loads(sys.argv[2] or "{}")
except ValueError:
    meta = {}
try:
    payload = json.loads(raw) if raw.strip() else {}
except ValueError:
    payload = {"raw": raw}
summary = payload
if meta.get("FunctionError"):
    try:
        summary = json.loads(payload.get("errorMessage", ""))
    except (AttributeError, TypeError, ValueError):
        summary = payload
print(json.dumps(summary, indent=2, sort_keys=True))
result = summary.get("result") if isinstance(summary, dict) else None
if meta.get("FunctionError") or result != "PASS":
    check = summary.get("failedCheck") if isinstance(summary, dict) else None
    print(f"Smoke test FAILED: {check or meta.get('FunctionError') or 'no PASS result'}", file=sys.stderr)
    sys.exit(1)
print("Smoke test PASSED.")
PY
	rm -f "$out"
	return "$rc"
}
