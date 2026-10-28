"""v1.1.0 — V1 step 1: code/scripts/lib/smoke_test.sh with a stub `aws` on PATH (PASS, FunctionError,
FAIL summary, CLI error), `bash -n` on the changed scripts, the IAM policy dry run."""
import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[4]
HELPER = ROOT / 'code' / 'scripts' / 'lib' / 'smoke_test.sh'
CHANGED = [HELPER, ROOT / 'code' / 'scripts' / 'prod' / 'aws_backend_deploy_stage.sh',
           ROOT / 'code' / 'scripts' / 'test' / 'aws' / 'aws_backend_deploy.sh',
           ROOT / 'code' / 'scripts' / 'prod' / 'aws_create_policy_github_actions.sh']

pytestmark = pytest.mark.skipif(shutil.which('bash') is None, reason='bash not available')

STUB = """#!/usr/bin/env bash
echo "$*" > "$STUB_ARGS"
for last; do :; done
printf '%s' "$STUB_PAYLOAD" > "$last"
printf '%s' "$STUB_META"
exit "${STUB_RC:-0}"
"""


def _invoke(tmp_path, payload, meta, rc=0, args='pathsgames-alpha-SmokeTestFunction us-east-1'):
    bin_dir = tmp_path / 'bin'
    bin_dir.mkdir(exist_ok=True)
    stub = bin_dir / 'aws'
    stub.write_text(STUB)
    stub.chmod(0o755)
    env = dict(os.environ, PATH=f"{bin_dir}{os.pathsep}{os.environ['PATH']}", STUB_ARGS=str(tmp_path / 'args'),
               STUB_PAYLOAD=json.dumps(payload), STUB_META=json.dumps(meta), STUB_RC=str(rc))
    proc = subprocess.run(['bash', '-c', f'. "{HELPER}"; smoke_test_invoke {args}'], env=env,
                          capture_output=True, text=True, timeout=60)
    return proc, (tmp_path / 'args').read_text() if (tmp_path / 'args').exists() else ''


def test_pass_returns_zero_and_prints_the_summary(tmp_path):
    proc, args = _invoke(tmp_path, {'result': 'PASS', 'env': 'alpha'}, {'StatusCode': 200})
    assert proc.returncode == 0, proc.stderr
    assert '"result": "PASS"' in proc.stdout and 'Smoke test PASSED.' in proc.stdout
    for part in ('lambda invoke', '--function-name pathsgames-alpha-SmokeTestFunction', '--region us-east-1',
                 '--invocation-type RequestResponse', '--cli-read-timeout 300',
                 '--cli-binary-format raw-in-base64-out', '--payload {"trigger":"deploy"}'):
        assert part in args


def test_function_error_returns_one_with_the_failed_check(tmp_path):
    summary = {'result': 'FAIL', 'failedCheck': 'join'}
    payload = {'errorMessage': json.dumps(summary), 'errorType': 'SmokeTestFailed'}
    proc, _ = _invoke(tmp_path, payload, {'StatusCode': 200, 'FunctionError': 'Unhandled'})
    assert proc.returncode == 1
    assert '"failedCheck": "join"' in proc.stdout and 'Smoke test FAILED: join' in proc.stderr


def test_function_error_with_a_plain_message(tmp_path):
    payload = {'errorMessage': 'Task timed out after 180.00 seconds'}
    proc, _ = _invoke(tmp_path, payload, {'FunctionError': 'Unhandled'})
    assert proc.returncode == 1 and 'Smoke test FAILED: Unhandled' in proc.stderr


def test_fail_summary_without_function_error_returns_one(tmp_path):
    proc, _ = _invoke(tmp_path, {'result': 'FAIL', 'failedCheck': 'echo'}, {'StatusCode': 200})
    assert proc.returncode == 1 and 'Smoke test FAILED: echo' in proc.stderr


def test_cli_error_returns_one(tmp_path):
    proc, _ = _invoke(tmp_path, {}, {}, rc=255)
    assert proc.returncode == 1 and "'aws lambda invoke' failed" in proc.stderr


def test_missing_arguments_return_two(tmp_path):
    proc, _ = _invoke(tmp_path, {}, {}, args='only-one')
    assert proc.returncode == 2


@pytest.mark.parametrize('script', CHANGED, ids=[p.name for p in CHANGED])
def test_changed_scripts_parse(script):
    assert subprocess.run(['bash', '-n', str(script)], capture_output=True).returncode == 0


def test_deploy_scripts_invoke_the_smoke_function():
    stage = CHANGED[1].read_text()
    assert 'PGSTAGE_OV_SmokeTestEnabled="$(stage_key LAMBDA_SMOKE_TEST_ENABLED)"' in stage
    assert 'PGSTAGE_OV_SmokeTestWebsiteUrl="$(stage_key LAMBDA_SMOKE_WEBSITE_URL)"' in stage
    assert 'smoke_test_invoke "pathsgames-${STAGE}-SmokeTestFunction" "$(samconfig_get region)"' in stage
    test = CHANGED[2].read_text()
    assert 'SmokeTestEnabled="${AWS_TEST_LAMBDA_SMOKE_TEST_ENABLED:-true}"' in test
    assert 'SmokeTestWebsiteUrl="${AWS_TEST_LAMBDA_SMOKE_WEBSITE_URL:-}"' in test
    assert 'smoke_test_invoke "pathsgames-test-SmokeTestFunction" "$AWS_TEST_REGION"' in test


@pytest.mark.parametrize('env, expected', [
    ({'AWS_TEST_LAMBDA_TURNSTILE_SECRET_KEY': '0xTEST', 'TURNSTILE_SECRET_KEY': '0xSHARED'}, '0xTEST'),
    ({'AWS_TEST_LAMBDA_TURNSTILE_SECRET_KEY': '', 'TURNSTILE_SECRET_KEY': '0xSHARED'}, ''),
    ({'TURNSTILE_SECRET_KEY': '0xSHARED'}, '0xSHARED'),
    ({}, ''),
], ids=['test-key', 'test-key-empty-turns-off', 'fallback-shared', 'none'])
def test_test_deploy_turnstile_secret(env, expected):
    # v1.9.0 — runs the script's own assignment line: AWS_TEST_LAMBDA_* wins even when empty.
    line = next(l for l in CHANGED[2].read_text().splitlines() if l.startswith('_TURNSTILE_SAM_KEY='))
    base = {k: v for k, v in os.environ.items()
            if k not in ('AWS_TEST_LAMBDA_TURNSTILE_SECRET_KEY', 'TURNSTILE_SECRET_KEY')}
    proc = subprocess.run(['bash', '-c', f'set -u; {line}; printf %s "$_TURNSTILE_SAM_KEY"'],
                          env={**base, **env}, capture_output=True, text=True, timeout=60)
    assert proc.returncode == 0, proc.stderr
    assert proc.stdout == expected


def test_policy_dry_run_allows_scheduler_and_pass_role(tmp_path):
    if shutil.which('python3') is None:
        pytest.skip('python3 not available')
    proc = subprocess.run(['bash', str(CHANGED[3]), '--dry-run'], capture_output=True, text=True, timeout=60,
                          env=dict(os.environ, HOME=str(tmp_path)))
    assert proc.returncode == 0, proc.stderr
    doc = json.loads(proc.stdout[proc.stdout.index('{'):proc.stdout.rindex('}') + 1])
    by_sid = {s['Sid']: s for s in doc['Statement']}
    assert 'PassRoleToLambda' not in by_sid
    assert by_sid['PassRoleToServices']['Condition']['StringEquals']['iam:PassedToService'] == [
        'lambda.amazonaws.com', 'scheduler.amazonaws.com']
    scheduler = by_sid['Scheduler']
    assert scheduler['Action'] == 'scheduler:*'
    assert [r.split(':')[-1] for r in scheduler['Resource']] == ['schedule-group/pathsgames-alpha-*',
                                                                  'schedule/pathsgames-alpha-*/*']
    assert len(json.dumps(doc, separators=(',', ':'))) <= 6144


def test_v1_10_test_deploy_mock_access_is_off_by_default_and_never_with_google():
    script = CHANGED[2].read_text()
    assert 'AllowMockAccess=true' not in script
    assert '_ALLOW_MOCK_ACCESS="${AWS_TEST_LAMBDA_ALLOW_MOCK_ACCESS:-false}"' in script
    assert 'AllowMockAccess="$_ALLOW_MOCK_ACCESS"' in script
    assert 'AWS_TEST_LAMBDA_ALLOW_MOCK_ACCESS=true needs AWS_TEST_LAMBDA_GOOGLE_ENABLED=false' in script


def _dry_run_docs(tmp_path, *args):
    proc = subprocess.run(['bash', str(CHANGED[3]), '--dry-run', *args], capture_output=True, text=True, timeout=60,
                          env=dict(os.environ, HOME=str(tmp_path)))
    assert proc.returncode == 0, proc.stderr
    decoder, text, docs, pos = json.JSONDecoder(), proc.stdout, [], 0
    while (start := text.find('{', pos)) >= 0:
        doc, pos = decoder.raw_decode(text, start)
        docs.append(doc)
    return docs


@pytest.mark.parametrize('mode', ['', 'prepare', 'enforce'])
def test_v1_10_policy_never_allows_trust_edits_and_the_boundary_has_no_iam(tmp_path, mode):
    if shutil.which('python3') is None:
        pytest.skip('python3 not available')
    docs = _dry_run_docs(tmp_path, *(['--boundary', mode] if mode else []))
    by_sid = {s['Sid']: s for s in docs[0]['Statement']}
    allowed = [a for s in docs[0]['Statement'] if s['Effect'] == 'Allow'
               for a in ([s['Action']] if isinstance(s['Action'], str) else s['Action'])]
    assert 'iam:UpdateAssumeRolePolicy' not in allowed
    assert by_sid['IamDeny']['Effect'] == 'Deny' and 'iam:UpdateAssumeRolePolicy' in by_sid['IamDeny']['Action']
    assert len(json.dumps(docs[0], separators=(',', ':'))) <= 6144
    if not mode:
        assert len(docs) == 1 and 'iam:CreateRole' in by_sid['IamRoles']['Action']
        return
    boundary = docs[1]['Statement'][0]
    assert not [a for a in boundary['Action'] if a.split(':')[0] in ('iam', 'sts', 'organizations')]
    condition = {'StringEquals': {'iam:PermissionsBoundary':
                                  'arn:aws:iam::ACCOUNT_ID:policy/paths-games-alpha-lambda-boundary'}}
    if mode == 'prepare':
        assert by_sid['IamPutBoundary']['Condition'] == condition and 'iam:CreateRole' in by_sid['IamRoles']['Action']
    else:
        assert 'iam:CreateRole' not in by_sid['IamRoles']['Action']
        assert by_sid['IamRoleWrites']['Condition'] == condition
        assert 'iam:CreateRole' in by_sid['IamRoleWrites']['Action']


def test_v1_10_policy_refuses_an_unknown_boundary_mode(tmp_path):
    proc = subprocess.run(['bash', str(CHANGED[3]), '--dry-run', '--boundary', 'maybe'], capture_output=True,
                          text=True, timeout=60, env=dict(os.environ, HOME=str(tmp_path)))
    assert proc.returncode == 2 and 'prepare or enforce' in proc.stderr


def test_v1_10_stage_deploy_passes_the_permissions_boundary():
    assert 'PGSTAGE_OV_PermissionsBoundaryArn="$(stage_key IAM_PERMISSIONS_BOUNDARY_ARN)"' in CHANGED[1].read_text()
