"""v1.10.0 — code/scripts/dev/aws/run_robot_ec2_spot: `bash -n` of every script, then runs with stubbed
`aws`/`ssh`/`rsync`/`session-manager-plugin` on PATH (they record their arguments) and a tmp HOME. No real AWS call."""
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[4]
TOOL = ROOT / 'code' / 'scripts' / 'dev' / 'aws' / 'run_robot_ec2_spot'
COMMON = TOOL / 'common.sh'
SCRIPTS = sorted(TOOL.glob('*.sh'))
MUTATING = ('cancel-', 'terminate-', 'release-', 'delete-', 'remove-', 'detach-', 'disassociate-')
TAGS = '{Key=Environment,Value=Test},{Key=Project,Value=Paths.games.aws.robotTest},{Key=Owner,Value=Paths.games.opsTeam},' \
       '{Key=CostCenter,Value=Paths.games},{Key=ManagedBy,Value=Sh},{Key=Language,Value=Robot}'

pytestmark = pytest.mark.skipif(shutil.which('bash') is None or shutil.which('rsync') is None,
                                reason='bash and rsync needed')

AWS_STUB = r"""#!/usr/bin/env bash
printf '%s\n' "$*" >> "$STUB_DIR/aws.log"
if [ -f "$STUB_DIR/aws_rules" ]; then
  while IFS=$'\x1f' read -r pat out rc; do
    [ -n "$pat" ] || continue
    case "$*" in *"$pat"*)
      case "$out" in @seq:*) f="${out#@seq:}"; out="$(head -n 1 "$f")"; [ "$(wc -l < "$f")" -gt 1 ] && sed -i 1d "$f" ;; esac
      printf '%b' "$out"; exit "${rc:-0}" ;;
    esac
  done < "$STUB_DIR/aws_rules"
fi
exit 0
"""
SSH_STUB = r"""#!/usr/bin/env bash
printf '%s\n' "$*" >> "$STUB_DIR/ssh.log"
while [ $# -gt 0 ]; do
  case "$1" in -F|-o) shift 2 ;; -t) shift ;; pg-robot-ec2) shift; break ;; *) shift ;; esac
done
[ $# -gt 0 ] || exit 0
# Never run root, bootstrap or a real Robot run on this machine: recorded only.
case "$*" in *"remote_run.sh' run '"*) if [ -n "${STUB_RUNS:-}" ]; then
  ts="$(printf '%s' "$*" | sed -n "s/.*remote_run.sh' run '\([0-9_]*\)'.*/\1/p")"
  mkdir -p "$STUB_RUNS/$ts" && date > "$STUB_RUNS/$ts/started_at" && echo 0 > "$STUB_RUNS/$ts/exit_code"; fi
  [ -z "${STUB_SSH_LAUNCH_RC:-}" ] || exit "$STUB_SSH_LAUNCH_RC" ;; esac
case "$*" in *sudo*|*pathsgames-robot-bootstrap*|*remote_run.sh*) cat > /dev/null; exit 0 ;; esac
exec bash -c "$*"
"""
RSYNC_STUB = r"""#!/usr/bin/env bash
{ printf '%s\n' "$@"; echo '----'; } >> "$STUB_DIR/rsync.log"
[ "${STUB_RSYNC_REAL:-0}" = "1" ] || exit 0
args=()
while [ $# -gt 0 ]; do
  case "$1" in -e) shift 2 ;; pg-robot-ec2:*) args+=("${1#pg-robot-ec2:}"); shift ;; *) args+=("$1"); shift ;; esac
done
exec "$REAL_RSYNC" "${args[@]}"
"""
NOOP_STUB = '#!/usr/bin/env bash\nexit 0\n'


@pytest.fixture
def sandbox(tmp_path):
    """Stub tools, tmp HOME/TMPDIR/results, an .env of the test's choice; returns a runner."""
    bin_dir = tmp_path / 'bin'
    bin_dir.mkdir()
    for name, body in (('aws', AWS_STUB), ('ssh', SSH_STUB), ('rsync', RSYNC_STUB),
                       ('session-manager-plugin', NOOP_STUB)):
        (bin_dir / name).write_text(body)
        (bin_dir / name).chmod(0o755)
    (tmp_path / 'home').mkdir()
    (tmp_path / 'tmp').mkdir()

    class Box:
        path = tmp_path
        env_file = tmp_path / 'env'

        def __init__(self):
            self.env_file.write_text('AWS_TEST_REGION=us-east-2\n')
            self.rules = []

        def env(self, **extra):
            base = {k: v for k, v in os.environ.items()
                    if not k.startswith(('AWS_TEST_', 'ADMIN_IP', 'PG_ROBOT_EC2_')) and k != 'TMPDIR'}
            # v1.10.0 a real session-manager-plugin of the host never stands in for the stub a test removes
            system = [d for d in os.environ['PATH'].split(os.pathsep)
                      if d and not os.path.exists(os.path.join(d, 'session-manager-plugin'))]
            base.update(PATH=os.pathsep.join([str(bin_dir)] + system), HOME=str(tmp_path / 'home'),
                        TMPDIR=str(tmp_path / 'tmp'), STUB_DIR=str(tmp_path), REAL_RSYNC=shutil.which('rsync'),
                        PG_ROBOT_EC2_ENV_FILE=str(self.env_file), PG_ROBOT_EC2_RESULTS_DIR=str(tmp_path / 'results'))
            base.update(extra)
            return base

        def set_env(self, text):
            self.env_file.write_text('AWS_TEST_REGION=us-east-2\n' + text)

        def rule(self, pattern, output='', rc=0):
            self.rules.append(f'{pattern}\x1f{output}\x1f{rc}')
            (tmp_path / 'aws_rules').write_text('\n'.join(self.rules) + '\n')

        def run(self, script, *args, **extra):
            return subprocess.run(['bash', str(TOOL / script), *args], env=self.env(**extra),
                                  capture_output=True, text=True, timeout=120, stdin=subprocess.DEVNULL)

        def source(self, code, *args, **extra):
            return subprocess.run(['bash', '-c', f'. "{COMMON}"; {code}', '_', *args], env=self.env(**extra),
                                  capture_output=True, text=True, timeout=60, stdin=subprocess.DEVNULL)

        def log(self, name):
            p = tmp_path / f'{name}.log'
            return p.read_text() if p.exists() else ''

    return Box()


def _aws_lines(stdout):
    return [line for line in stdout.splitlines() if line.startswith('aws ')]


def _mutating(lines):
    return [line for line in lines if line.split()[2].startswith(MUTATING)]


@pytest.mark.parametrize('script', SCRIPTS, ids=[p.name for p in SCRIPTS])
def test_every_script_parses(script):
    assert subprocess.run(['bash', '-n', str(script)], capture_output=True).returncode == 0


def test_expected_files_exist():
    names = {p.name for p in TOOL.iterdir()}
    for name in ('common.sh', 'create.sh', 'start.sh', 'stop.sh', 'run_all.sh', 'fetch_results.sh', 'terminate.sh',
                 'status.sh', 'connect.sh', 'bootstrap.sh', 'create_and_run_and_terminate.sh', 'README.md',
                 '.gitignore'):
        assert name in names
    assert (TOOL / '.gitignore').read_text().strip() == 'results/'


@pytest.mark.skipif(shutil.which('shellcheck') is None, reason='shellcheck not installed')
def test_shellcheck_has_no_errors():
    proc = subprocess.run(['shellcheck', '-S', 'error', '-x', *map(str, SCRIPTS)], capture_output=True, text=True,
                          cwd=TOOL)
    assert proc.returncode == 0, proc.stdout


@pytest.mark.parametrize('name, ok', [
    ('PathsGamesRobotTest', True), ('a-1', True), ('A' * 40, True),
    ('', False), ('bad_name', False), ('with space', False), ('A' * 41, False), ('x.y', False)])
def test_name_validation(sandbox, name, ok):
    proc = sandbox.source('validate_name "$1"', name)
    assert (proc.returncode == 0) is ok


def test_invalid_name_in_env_stops_create(sandbox):
    sandbox.set_env('AWS_TEST_EC2_ROBOT_NAME=bad_name\n')
    proc = sandbox.run('create.sh', '--dry-run')
    assert proc.returncode == 1 and 'AWS_TEST_EC2_ROBOT_NAME' in proc.stderr
    assert sandbox.log('aws') == ''


@pytest.mark.parametrize('var, value', [('AWS_TEST_EC2_ROBOT_SIZE', 'medium'), ('AWS_TEST_EC2_ROBOT_MARKET', 'cheap'),
                                        ('AWS_TEST_EC2_ROBOT_FIXED_IP', 'yes'), ('AWS_TEST_EC2_ROBOT_DISK_GB', '8'),
                                        ('AWS_TEST_EC2_ROBOT_SHUTDOWN_TIME', '25:00'),
                                        ('AWS_TEST_SAM_STACK_NAME', 'pathsgames-alpha')])
def test_bad_settings_are_refused(sandbox, var, value):
    sandbox.set_env(f'{var}={value}\n')
    proc = sandbox.run('create.sh', '--dry-run')
    assert proc.returncode == 1 and 'ERROR' in proc.stderr


def test_derived_names(sandbox):
    sandbox.set_env('AWS_TEST_EC2_ROBOT_NAME=Foo-1\n')
    proc = sandbox.source('echo "$RES_INSTANCE $RES_SG $RES_VOL $RES_ENI $RES_SPOT $RES_EIP $RES_KEY $RES_ROLE '
                          '$RES_PROFILE $INSTANCE_TYPE"')
    assert proc.stdout.split() == ['Foo-1', 'Foo-1-sg', 'Foo-1-vol', 'Foo-1-eni', 'Foo-1-spot', 'Foo-1-eip',
                                   'Foo-1-key', 'Foo-1-role', 'Foo-1-profile', 't4g.large']


def test_default_name_and_region(sandbox):
    proc = sandbox.source('echo "$ROBOT_EC2_NAME $ROBOT_EC2_REGION $ROBOT_EC2_REMOTE_DIR $ROBOT_EC2_SSH_KEY"')
    name, region, remote, key = proc.stdout.split()
    assert (name, region, remote) == ('PathsGamesRobotTest', 'us-east-2', '/home/ubuntu/pathsgames')
    assert key == str(sandbox.path / 'home' / '.ssh' / 'pathsgames-robot-test')
    sandbox.set_env('AWS_TEST_EC2_ROBOT_REGION=eu-south-1\n')
    assert sandbox.source('echo "$ROBOT_EC2_REGION"').stdout.strip() == 'eu-south-1'


def test_tag_spec_reads_aws_tags_txt(sandbox):
    proc = sandbox.source('tag_spec volume Foo-vol; echo; tag_iam_words Foo-role')
    spec, *iam = proc.stdout.splitlines()
    assert spec == f'ResourceType=volume,Tags=[{{Key=Name,Value=Foo-vol}},{TAGS}]'
    assert iam[0] == 'Key=Name,Value=Foo-role' and 'Key=Project,Value=Paths.games.aws.robotTest' in iam


def _create_dry(sandbox, *args, **extra):
    proc = sandbox.run('create.sh', '--dry-run', *args, **extra)
    assert proc.returncode == 0, proc.stderr
    assert sandbox.log('aws') == ''
    return proc.stdout, _aws_lines(proc.stdout)


def test_create_dry_run_spot_arguments_and_tags(sandbox):
    out, lines = _create_dry(sandbox)
    run = next(line for line in lines if ' run-instances ' in line)
    for part in ('--instance-type t4g.large', 'CpuCredits=unlimited', '--instance-initiated-shutdown-behavior stop',
                 "'MarketType=spot,SpotOptions={SpotInstanceType=persistent,InstanceInterruptionBehavior=stop}'",
                 'VolumeSize=40,VolumeType=gp3,DeleteOnTermination=true', 'AssociatePublicIpAddress=true',
                 '--iam-instance-profile Name=PathsGamesRobotTest-profile', '--key-name PathsGamesRobotTest-key',
                 'HttpTokens=required'):
        assert part in run
    assert 'Encrypted' not in run
    for rtype, name in (('instance', 'PathsGamesRobotTest'), ('volume', 'PathsGamesRobotTest-vol'),
                        ('network-interface', 'PathsGamesRobotTest-eni'),
                        ('spot-instances-request', 'PathsGamesRobotTest-spot')):
        assert f"'ResourceType={rtype},Tags=[{{Key=Name,Value={name}}},{TAGS}]'" in run
    sg = next(line for line in lines if 'create-security-group' in line)
    assert f'ResourceType=security-group,Tags=[{{Key=Name,Value=PathsGamesRobotTest-sg}},{TAGS}]' in sg
    key = next(line for line in lines if 'import-key-pair' in line)
    assert 'ResourceType=key-pair,Tags=[{Key=Name,Value=PathsGamesRobotTest-key}' in key
    role = next(line for line in lines if 'iam create-role' in line)
    profile = next(line for line in lines if 'iam create-instance-profile' in line)
    for line, name in ((role, 'PathsGamesRobotTest-role'), (profile, 'PathsGamesRobotTest-profile')):
        assert f'--tags Key=Name,Value={name} Key=Environment,Value=Test Key=Project,Value=Paths.games.aws.robotTest' in line
    assert not [line for line in lines if 'authorize-security-group-ingress' in line]
    assert not [line for line in lines if 'allocate-address' in line]
    assert 'ssh-keygen -t ed25519' in out
    assert '/aws/service/canonical/ubuntu/server/24.04/stable/current/arm64/hvm/ebs-gp3/ami-id' in out
    assert lines[0].startswith('aws sts get-caller-identity')


def test_create_dry_run_ondemand_bigger(sandbox):
    sandbox.set_env('AWS_TEST_EC2_ROBOT_DISK_GB=60\n')
    _, lines = _create_dry(sandbox, '--market', 'ondemand', '--size', '2xlarge')
    run = next(line for line in lines if ' run-instances ' in line)
    assert '--instance-type t4g.2xlarge' in run and 'VolumeSize=60' in run
    assert 'instance-market-options' not in run and 'spot-instances-request' not in run
    assert '--instance-initiated-shutdown-behavior stop' in run


@pytest.mark.parametrize('how', ['flag', 'env'])
def test_create_fixed_ip_allocates_a_tagged_eip(sandbox, how):
    if how == 'env':
        sandbox.set_env('AWS_TEST_EC2_ROBOT_FIXED_IP=true\n')
    _, lines = _create_dry(sandbox, *(['--fixed-ip'] if how == 'flag' else []))
    alloc = next(line for line in lines if 'allocate-address' in line)
    assert f'ResourceType=elastic-ip,Tags=[{{Key=Name,Value=PathsGamesRobotTest-eip}},{TAGS}]' in alloc
    names = [line.split()[2] for line in lines]
    assert names.index('run-instances') < names.index('allocate-address') < names.index('associate-address')


def test_create_user_data(sandbox):
    out, _ = _create_dry(sandbox)
    assert "timedatectl set-timezone 'Europe/Rome'" in out
    assert 'OnCalendar=*-*-* 02:00:00' in out and '+ 120 * 60' in out
    assert "LOCK='/home/ubuntu/runs/.lock/info'" in out and '/sbin/shutdown -h now' in out
    assert "/var/lib/pathsgames-robot/userdata.done" in out and 'sleep $(( left < 900 ? left : 900 ))' in out
    sandbox.set_env('AWS_TEST_EC2_ROBOT_TIMEZONE=UTC\nAWS_TEST_EC2_ROBOT_SHUTDOWN_TIME=23:30\n'
                    'AWS_TEST_EC2_ROBOT_SHUTDOWN_LATEST=01:00\n')
    out, _ = _create_dry(sandbox)
    assert "set-timezone 'UTC'" in out and 'OnCalendar=*-*-* 23:30:00' in out and '+ 90 * 60' in out


def test_create_iam_policy_is_test_stack_only(sandbox):
    out, lines = _create_dry(sandbox)
    put = next(line for line in lines if 'put-role-policy' in line)
    doc = json.loads(put[put.index("'{") + 1:put.rindex("}'") + 1])
    actions = [a for s in doc['Statement'] for a in ([s['Action']] if isinstance(s['Action'], str) else s['Action'])]
    assert not [a for a in actions if a.endswith('*')]
    for forbidden in ('cloudformation:CreateStack', 'cloudformation:DeleteStack', 'cloudformation:ExecuteChangeSet',
                      'lambda:UpdateFunctionCode', 'lambda:CreateFunction', 's3:PutObject', 'iam:CreateRole'):
        assert forbidden not in actions
    by_sid = {s['Sid']: s for s in doc['Statement']}
    assert by_sid['SamTransform']['Resource'].endswith(':aws:transform/Serverless-2016-10-31')
    assert by_sid['TestLambdaConfig']['Resource'].endswith(':function:pathsgames-test-*')
    assert by_sid['PassTestLambdaRoles']['Condition']['StringEquals']['iam:PassedToService'] == 'lambda.amazonaws.com'
    text = json.dumps(doc)
    assert 'alpha' not in text and 'prod' not in text and 'pathsgames-test' in text
    assert 'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore' in out


def _stub_instance(sandbox, ids='i-0abc', state='running'):
    sandbox.rule('sts get-caller-identity', '123456789012')
    sandbox.rule('State.Name', state)
    sandbox.rule('PublicIpAddress', '3.3.3.3')
    sandbox.rule('Reservations[].Instances[].InstanceId', ids)


def test_create_refuses_an_existing_instance(sandbox):
    _stub_instance(sandbox)
    proc = sandbox.run('create.sh')
    assert proc.returncode == 1 and 'already exists (i-0abc, running)' in proc.stderr
    log = sandbox.log('aws')
    assert 'describe-instances' in log
    assert not [w for w in ('run-instances', 'create-', 'import-key-pair', 'put-role-policy') if w in log]
    assert not (sandbox.path / 'home' / '.ssh' / 'pathsgames-robot-test').exists()


def test_two_instances_with_the_name_stop_with_their_ids(sandbox):
    _stub_instance(sandbox, ids=r'i-0abc\ti-0def')
    proc = sandbox.run('create.sh')
    assert proc.returncode == 1 and 'i-0abc' in proc.stderr and 'i-0def' in proc.stderr
    assert '2 non-terminated instances' in proc.stderr and 'run-instances' not in sandbox.log('aws')


def test_create_checks_credentials_and_tools_first(sandbox):
    sandbox.rule('sts get-caller-identity', '', 255)
    proc = sandbox.run('create.sh')
    assert proc.returncode == 1 and 'sts get-caller-identity failed' in proc.stderr
    assert sandbox.log('aws').strip().splitlines() == ['sts get-caller-identity --query Account --output text --region us-east-2']
    (sandbox.path / 'bin' / 'session-manager-plugin').unlink()
    proc = sandbox.run('create.sh')
    assert proc.returncode == 1 and "'session-manager-plugin' is not installed" in proc.stderr


def test_v1_10_update_policy_rewrites_only_the_inline_policy_with_get_role(sandbox):
    proc = sandbox.run('create.sh', '--update-policy', '--dry-run')
    assert proc.returncode == 0, proc.stderr
    calls = _aws_lines(proc.stdout)
    verbs = [line.split()[2] for line in calls if line.startswith('aws ')]
    assert 'put-role-policy' in verbs and 'run-instances' not in verbs and 'create-role' not in verbs
    policy = next(line for line in calls if 'put-role-policy' in line)
    assert 'iam:GetRole' in policy and 'ReadTestLambdaRoles' in policy


def test_terminate_dry_run_order(sandbox):
    proc = sandbox.run('terminate.sh', '--dry-run', '--name', 'Other-1')
    assert proc.returncode == 0, proc.stderr
    assert sandbox.log('aws') == '' and sandbox.log('ssh') == ''
    lines = proc.stdout.splitlines()
    mutating = _mutating(_aws_lines(proc.stdout))
    verbs = [line.split()[2] for line in mutating]
    assert verbs[0] == 'cancel-spot-instance-requests' and verbs[-1] == 'delete-security-group'
    order = ['cancel-spot-instance-requests', 'terminate-instances', 'release-address', 'delete-key-pair',
             'remove-role-from-instance-profile', 'delete-instance-profile', 'delete-role-policy',
             'detach-role-policy', 'delete-role', 'delete-security-group']
    assert [verbs.index(v) for v in order] == sorted(verbs.index(v) for v in order)
    restore = next(i for i, line in enumerate(lines) if line.startswith('restore:'))
    term = next(i for i, line in enumerate(lines) if 'terminate-instances' in line)
    spot = next(i for i, line in enumerate(lines) if 'cancel-spot-instance-requests' in line)
    assert spot < restore < term
    assert 'Name=tag:Name,Values=Other-1-spot' in proc.stdout and '--key-name Other-1-key' in proc.stdout
    assert 'Name=tag:Project,Values=Paths.games.aws.robotTest' in proc.stdout
    assert 'Other-1-vol,Other-1-eni' in proc.stdout and 'VERIFY: nothing tagged' in proc.stderr
    assert 'wait instance-terminated' in proc.stdout


@pytest.mark.parametrize('whitelist, ip, expected', [
    ('1.2.3.4,5.6.7.8', '5.6.7.8', 'true'), (' 1.2.3.4 , 5.6.7.8 ', '5.6.7.8', 'true'),
    ('5.6.7.8/32', '5.6.7.8', 'true'), ('1.2.3.4', '9.9.9.9', 'false'), ('5.6.7.80', '5.6.7.8', 'false'),
    ('', '5.6.7.8', 'false'), ('1.2.3.4', '', 'false')])
def test_admin_ip_whitelist_decides_robot_skip_admin_ip(sandbox, whitelist, ip, expected):
    sandbox.set_env(f'ADMIN_IP_WHITELIST="{whitelist}"\n')
    assert sandbox.source(f'skip_admin_ip_for "{ip}"').stdout.strip() == expected


def test_run_all_wires_the_skip_decision():
    run_all = (TOOL / 'run_all.sh').read_text()
    remote = (TOOL / 'remote_run.sh').read_text()
    assert 'SKIP_ADMIN_IP="$(skip_admin_ip_for "$PUBLIC_IP")"' in run_all
    assert "remote_run.sh' run '$TS' '$SKIP_ADMIN_IP'" in run_all and 'setsid nohup' in run_all
    assert 'export ROBOT_SKIP_ADMIN_IP="$skip"' in remote
    assert 'bash code/scripts/dev/run_robot_everywhere.sh --aws=all' in remote


def test_sync_rsync_excludes(sandbox):
    remote = sandbox.path / 'remote_repo'
    sandbox.set_env(f'AWS_TEST_EC2_ROBOT_REMOTE_DIR={remote}\n')
    proc = sandbox.source('ssh_setup i-1; sync_tree')
    assert proc.returncode == 0, proc.stderr
    assert remote.is_dir()
    code_call, env_call = [c.strip().splitlines() for c in sandbox.log('rsync').split('----') if c.strip()]
    assert '--delete' in code_call and '--delete-excluded' not in code_call
    assert code_call.index('--include=/.env.example') < code_call.index('--exclude=/.env')
    for pattern in ('/code/website/', '/wiki/documentation_v0/website_concepts_v0/', 'node_modules/', 'target/',
                    '.venv/', '.aws-sam/', '/.git/', '/code/tests/robot/reports-*/',
                    '/code/scripts/dev/run_robot_results/', '/code/scripts/dev/aws/run_robot_ec2_spot/results/',
                    '/.env.*'):
        assert f'--exclude={pattern}' in code_call
    assert code_call[-2] == f'{ROOT}/' and code_call[-1] == f'pg-robot-ec2:{remote}/'
    assert '--chmod=F600' in env_call and env_call[-2] == str(sandbox.env_file)
    assert env_call[-1] == f'pg-robot-ec2:{remote}/.env'
    assert 'ProxyCommand aws ssm start-session' in (sandbox.path / 'tmp').joinpath(
        next(p.name for p in (sandbox.path / 'tmp').iterdir() if p.name.endswith('.ssh_config'))).read_text()


def test_ssh_config_goes_through_ssm(sandbox):
    proc = sandbox.source('ssh_setup i-0abc; cat "$SSH_CFG"')
    cfg = proc.stdout
    for part in ('HostName i-0abc', 'User ubuntu', 'IdentitiesOnly yes', 'AWS-StartSSHSession',
                 '--parameters portNumber=%p', '--target %h', '--region us-east-2'):
        assert part in cfg
    assert f"IdentityFile {sandbox.path / 'home' / '.ssh' / 'pathsgames-robot-test'}" in cfg


@pytest.mark.parametrize('code, expected', [
    ('Server.SpotInstanceShutdown', 'spot interruption'), ('Client.InstanceInitiatedShutdown', 'nightly-shutdown timer'),
    ('Client.UserInitiatedShutdown', 'stopped manually'), ('Server.InsufficientInstanceCapacity', 'no capacity'),
    ('Server.Weird', 'unknown reason Server.Weird'), ('', 'no StateReason')])
def test_state_reason_message(sandbox, code, expected):
    proc = sandbox.source(f'state_reason_message "{code}" "msg"')
    assert expected in proc.stdout


def test_run_all_reads_the_state_reason():
    text = (TOOL / 'run_all.sh').read_text()
    assert 'StateReason.Code' in text and 'state_reason_message "$code" "$msg"' in text
    assert 'interruption.txt' in text and 'exit 4' in text and 'InsufficientInstanceCapacity' in COMMON.read_text()


def test_lock_check_snippet(sandbox):
    runs = sandbox.path / 'runs'
    sandbox.set_env(f'AWS_TEST_EC2_ROBOT_RUNS_DIR={runs}\n')
    check = 'bash -c "$(lock_check_snippet)"'
    assert sandbox.source(check).stdout.strip() == 'idle'
    (runs / '.lock').mkdir(parents=True)
    boot = Path('/proc/sys/kernel/random/boot_id').read_text().strip()
    (runs / '.lock' / 'info').write_text(f'20261028_101500 {os.getpid()} {boot}\n')
    assert sandbox.source(check).stdout.strip() == 'running 20261028_101500'
    (runs / '.lock' / 'info').write_text(f'20261028_101500 {os.getpid()} other-boot\n')
    assert sandbox.source(check).stdout.strip() == 'stale 20261028_101500'


OUTPUT_XML = """<?xml version="1.0" encoding="UTF-8"?>
<robot generator="Robot 7.1" generated="2026-10-28T10:00:00.000000" rpa="false" schemaversion="5">
<suite id="s1" name="Demo" source="/x/demo.robot">
<test id="s1-t1" name="Passes" line="1"><status status="PASS" start="2026-10-28T10:00:00.000000" elapsed="0.1"/></test>
<test id="s1-t2" name="Breaks Here" line="2"><status status="FAIL" start="2026-10-28T10:00:00.000000" elapsed="0.1">boom happened</status></test>
<status status="FAIL" start="2026-10-28T10:00:00.000000" elapsed="0.2"/>
</suite>
<statistics><total></total><tag></tag><suite></suite></statistics>
<errors></errors>
</robot>
"""


def _fetch_setup(sandbox, archived=True):
    project = sandbox.path / 'project'
    golden = project / 'code/tests/robot/tests_v0/41_alpha_prep/fixtures/golden'
    golden.mkdir(parents=True)
    (golden / 'export_java.json').write_text('ORIGINAL')
    logs = project / 'code/scripts/dev/run_robot_results'
    logs.mkdir(parents=True)
    (logs / 'OLD_1.log').write_text('old')
    runs, live = sandbox.path / 'remote_runs', sandbox.path / 'remote_repo'
    run = runs / '20261028_101500'
    run.mkdir(parents=True)
    (runs / 'latest').symlink_to('20261028_101500')
    (run / 'run.log').write_text('noise\n===== Robot summary (run_robot_everywhere) =====\nLOCAL_JAVA OK 0\n')
    if archived:
        (run / 'exit_code').write_text('0\n')
        (run / 'reports/reports-local-java').mkdir(parents=True)
        (run / 'reports/reports-local-java/output.xml').write_text(OUTPUT_XML)
        (run / 'logs').mkdir()
        (run / 'logs/LOCAL_JAVA_20261028.log').write_text('log')
        (run / 'golden').mkdir()
        (run / 'golden/export_java.json').write_text('NEW')
    else:
        (live / 'code/tests/robot/reports-aws').mkdir(parents=True)
        (live / 'code/tests/robot/reports-aws/output.xml').write_text(OUTPUT_XML)
        (live / 'code/scripts/dev/run_robot_results').mkdir(parents=True)
        (live / 'code/scripts/dev/run_robot_results/AWS_1.log').write_text('log')
        (live / 'code/tests/robot/tests_v0/41_alpha_prep/fixtures/golden').mkdir(parents=True)
        (live / 'code/tests/robot/tests_v0/41_alpha_prep/fixtures/golden/export_aws.json').write_text('LIVE')
    sandbox.set_env(f'AWS_TEST_EC2_ROBOT_RUNS_DIR={runs}\nAWS_TEST_EC2_ROBOT_REMOTE_DIR={live}\n')
    _stub_instance(sandbox)
    return project, golden


def test_fetch_results_never_writes_into_fixtures_golden(sandbox):
    project, golden = _fetch_setup(sandbox)
    proc = sandbox.run('fetch_results.sh', PG_ROBOT_EC2_PROJECT_ROOT=str(project), STUB_RSYNC_REAL='1',
                       PG_ROBOT_EC2_PYTHON=sys.executable)
    assert proc.returncode == 0, proc.stderr
    assert (golden / 'export_java.json').read_text() == 'ORIGINAL'
    local = sandbox.path / 'results' / '20261028_101500'
    assert (local / 'golden/export_java.json').read_text() == 'NEW'
    assert (project / 'code/tests/robot/reports-local-java/output.xml').exists()
    logs = project / 'code/scripts/dev/run_robot_results'
    assert (logs / 'LOCAL_JAVA_20261028.log').exists() and not (logs / 'OLD_1.log').exists()
    assert '===== Robot summary' in proc.stdout and 'LOCAL_JAVA OK 0' in proc.stdout
    try:
        import robot.api  # noqa: F401
    except ImportError:
        return
    # v1.10.0 counts only: per environment and the total, never the list of the failed tests
    assert 'reports-local-java: 1 failed' in proc.stdout and 'TOTAL: 1 failed' in proc.stdout
    assert 'Breaks Here' not in proc.stdout
    assert (local / 'failed_tests.txt').read_text().startswith('reports-local-java: 1 failed')


def test_fetch_results_of_an_unfinished_run_uses_the_live_tree(sandbox):
    project, golden = _fetch_setup(sandbox, archived=False)
    proc = sandbox.run('fetch_results.sh', '--run', '20261028_101500', PG_ROBOT_EC2_PROJECT_ROOT=str(project),
                       STUB_RSYNC_REAL='1', PG_ROBOT_EC2_PYTHON=sys.executable)
    assert proc.returncode == 0, proc.stderr
    assert 'not archived' in proc.stderr
    local = sandbox.path / 'results' / '20261028_101500'
    assert (local / 'golden/export_aws.json').read_text() == 'LIVE'
    assert not (golden / 'export_aws.json').exists() and (golden / 'export_java.json').read_text() == 'ORIGINAL'
    assert (project / 'code/tests/robot/reports-aws/output.xml').exists()


def test_fetch_refuses_a_stopped_instance(sandbox):
    _stub_instance(sandbox, state='stopped')
    proc = sandbox.run('fetch_results.sh')
    assert proc.returncode == 1 and 'is stopped' in proc.stderr and sandbox.log('rsync') == ''


def test_fetch_source_guards_the_golden_folder():
    text = (TOOL / 'fetch_results.sh').read_text()
    assert '*"/fixtures/golden"*) die' in text and '$LOCAL_RES/golden' in text


def test_stack_allowlist_restore_keeps_every_other_parameter(sandbox):
    sandbox.rule("ParameterKey=='AdminIpWhitelist'", '9.9.9.9')
    sandbox.rule('Parameters[].ParameterKey', r'Environment\tAdminIpWhitelist\tJwtSecret')
    proc = sandbox.source('stack_set_allowlist "1.2.3.4,5.6.7.8"')
    assert proc.returncode == 0, proc.stderr
    update = next(line for line in sandbox.log('aws').splitlines() if 'update-stack' in line)
    assert '--stack-name pathsgames-test' in update and '--use-previous-template' in update
    params = json.loads(update[update.index('--parameters ') + 13:update.index(' --region')])
    assert params == [{'ParameterKey': 'Environment', 'UsePreviousValue': True},
                      {'ParameterKey': 'JwtSecret', 'UsePreviousValue': True},
                      {'ParameterKey': 'AdminIpWhitelist', 'ParameterValue': '1.2.3.4,5.6.7.8'}]
    assert 'wait stack-update-complete' in sandbox.log('aws')


def test_stack_allowlist_unchanged_means_no_update(sandbox):
    sandbox.rule("ParameterKey=='AdminIpWhitelist'", '1.2.3.4')
    proc = sandbox.source('stack_set_allowlist "1.2.3.4"')
    assert proc.returncode == 0 and 'update-stack' not in sandbox.log('aws')


def test_remote_run_restore_puts_back_allowlist_and_lambda_env(sandbox):
    project, runs = sandbox.path / 'project', sandbox.path / 'runs'
    run = runs / '20261028_101500'
    (run / 'lambda_env_backup').mkdir(parents=True)
    (runs / 'latest').symlink_to('20261028_101500')
    (run / 'admin_allowlist.txt').write_text('')
    (run / 'lambda_env_backup' / 'pathsgames-test-AuthFunction.json').write_text('{"Variables": {"A": "1"}}')
    backup = project / 'code/scripts/dev/run_robot_results/aws_special_env_backup'
    backup.mkdir(parents=True)
    (backup / 'pathsgames-test-AuthFunction.json').write_text('{"Variables": {"A": "1"}}')
    sandbox.set_env(f'AWS_TEST_EC2_ROBOT_RUNS_DIR={runs}\n')
    sandbox.rule("ParameterKey=='AdminIpWhitelist'", '3.3.3.3')
    sandbox.rule('Parameters[].ParameterKey', 'AdminIpWhitelist')
    proc = sandbox.run('remote_run.sh', 'restore', PG_ROBOT_EC2_PROJECT_ROOT=str(project))
    assert proc.returncode == 0, proc.stdout + proc.stderr
    log = sandbox.log('aws')
    assert '{"ParameterKey":"AdminIpWhitelist","ParameterValue":""}' in log
    assert 'lambda update-function-configuration --function-name pathsgames-test-AuthFunction' in log
    assert f'file://{run}/lambda_env_backup/pathsgames-test-AuthFunction.json' in log
    assert (run / 'restored').exists() and not (backup / 'pathsgames-test-AuthFunction.json').exists()
    proc = sandbox.run('remote_run.sh', 'restore', PG_ROBOT_EC2_PROJECT_ROOT=str(project))
    assert 'nothing to restore' in proc.stdout


def test_bootstrap_is_versioned_and_installs_the_toolchain():
    text = (TOOL / 'bootstrap.sh').read_text()
    assert 'BOOTSTRAP_VERSION="' in text and 'MARKER="$MARKER_DIR/bootstrap.version"' in text
    assert 'MARKER_DIR="/var/lib/pathsgames-robot"' in text
    for part in ('openjdk-21-jdk-headless', 'maven', 'download.docker.com/linux/ubuntu', 'usermod -aG docker',
                 'awscli-exe-linux-aarch64.zip', 'aws-sam-cli-linux-arm64.zip', 'uv python install 3.13',
                 'python3-venv', 'rsync', 'psmisc', 'code/tests/robot/requirements.txt'):
        assert part in text
    proc = subprocess.run(['bash', str(TOOL / 'bootstrap.sh'), '--version'], capture_output=True, text=True)
    assert proc.returncode == 0 and proc.stdout.strip().isdigit()


def test_env_example_lists_every_new_variable_with_the_defaults():
    example = (ROOT / '.env.example').read_text()
    common = COMMON.read_text()
    for var, default in (('NAME', 'PathsGamesRobotTest'), ('SIZE', 'large'), ('MARKET', 'spot'),
                         ('FIXED_IP', 'false'), ('REGION', ''), ('DISK_GB', '40'),
                         ('SSH_KEY', '~/.ssh/pathsgames-robot-test'), ('REMOTE_DIR', '/home/ubuntu/pathsgames'),
                         ('RUNS_DIR', '/home/ubuntu/runs'), ('TIMEZONE', 'Europe/Rome'), ('SHUTDOWN_TIME', '02:00'),
                         ('SHUTDOWN_LATEST', '04:00'), ('POLL_SECONDS', '60'), ('WAIT_TIMEOUT', '900')):
        assert f'\nAWS_TEST_EC2_ROBOT_{var}={default}\n' in example
        assert f'AWS_TEST_EC2_ROBOT_{var}:-' in common


TS = '20261028_120000'


def _run_all_setup(sandbox, states, whitelist=''):
    runs, remote = sandbox.path / 'runs', sandbox.path / 'remote_repo'
    marker = sandbox.path / 'marker'
    marker.mkdir()
    (sandbox.path / 'project').mkdir()
    (marker / 'userdata.done').write_text('done')
    (runs / TS).mkdir(parents=True)
    (runs / TS / 'started_at').write_text('now')
    (sandbox.path / 'state_seq').write_text('\n'.join(states) + '\n')
    sandbox.set_env(f'AWS_TEST_EC2_ROBOT_RUNS_DIR={runs}\nAWS_TEST_EC2_ROBOT_REMOTE_DIR={remote}\n'
                    f'AWS_TEST_EC2_ROBOT_POLL_SECONDS=0\nADMIN_IP_WHITELIST={whitelist}\n')
    sandbox.rule('StateReason.Code', 'Server.SpotInstanceShutdown')
    sandbox.rule('StateReason.Message', 'Server.SpotInstanceShutdown: Spot instance shutdown')
    sandbox.rule('State.Name', f"@seq:{sandbox.path / 'state_seq'}")
    sandbox.rule('PublicIpAddress', '3.3.3.3')
    sandbox.rule('InstanceStatuses', r'ok\tok')
    sandbox.rule('PingStatus', 'Online')
    sandbox.rule('Reservations[].Instances[].InstanceId', 'i-0abc')
    return runs, marker


def test_run_all_finished_run_is_fetched(sandbox):
    runs, marker = _run_all_setup(sandbox, ['running'], whitelist='3.3.3.3')
    (runs / TS / 'exit_code').write_text('0\n')
    proc = sandbox.run('run_all.sh', '--ts', TS, PG_ROBOT_EC2_MARKER_DIR=str(marker), PG_ROBOT_EC2_PROJECT_ROOT=str(sandbox.path / 'project'))
    assert proc.returncode == 0, proc.stderr
    ssh = sandbox.log('ssh')
    assert 'sudo bash /tmp/pathsgames-robot-bootstrap.sh --user ubuntu' in ssh
    assert f"remote_run.sh' run '{TS}' 'true'" in ssh and 'setsid nohup' in ssh
    assert 'ROBOT_SKIP_ADMIN_IP=true' in proc.stderr
    assert ssh.index('pathsgames-robot-bootstrap') < ssh.index('remote_run.sh')
    assert '--exclude=/code/website/' in sandbox.log('rsync')
    phases = (sandbox.path / 'results' / TS / 'phases.txt').read_text()
    assert [line.split('\t')[0] for line in phases.splitlines()] == ['start', 'bootstrap', 'sync', 'tests', 'fetch']


def test_v1_10_run_all_goes_on_when_ssh_errors_but_the_run_started(sandbox):
    runs, marker = _run_all_setup(sandbox, ['running'], whitelist='3.3.3.3')
    (runs / TS / 'exit_code').write_text('0\n')
    proc = sandbox.run('run_all.sh', '--ts', TS, PG_ROBOT_EC2_MARKER_DIR=str(marker),
                       PG_ROBOT_EC2_PROJECT_ROOT=str(sandbox.path / 'project'), STUB_SSH_LAUNCH_RC='255')
    assert proc.returncode == 0, proc.stderr
    assert 'ssh exited with 255 while launching' in proc.stderr and 'could not launch' not in proc.stderr


def test_run_all_not_whitelisted_ip_keeps_the_normal_path(sandbox):
    runs, marker = _run_all_setup(sandbox, ['running'], whitelist='1.2.3.4')
    (runs / TS / 'exit_code').write_text('2\n')
    proc = sandbox.run('run_all.sh', '--ts', TS, PG_ROBOT_EC2_MARKER_DIR=str(marker), PG_ROBOT_EC2_PROJECT_ROOT=str(sandbox.path / 'project'))
    assert proc.returncode == 3, proc.stderr
    assert f"remote_run.sh' run '{TS}' 'false'" in sandbox.log('ssh') and 'aws_set_admin_ip.sh' in proc.stderr


def test_run_all_reports_a_spot_interruption(sandbox):
    _, marker = _run_all_setup(sandbox, ['running', 'running', 'stopped'])
    proc = sandbox.run('run_all.sh', '--ts', TS, PG_ROBOT_EC2_MARKER_DIR=str(marker), PG_ROBOT_EC2_PROJECT_ROOT=str(sandbox.path / 'project'))
    assert proc.returncode == 4, proc.stderr
    assert 'became stopped while run' in proc.stderr and 'spot interruption' in proc.stderr
    assert 'spot interruption' in (sandbox.path / 'results' / TS / 'interruption.txt').read_text()


def test_run_all_refuses_a_second_run_and_suggests_attach(sandbox):
    runs, marker = _run_all_setup(sandbox, ['running'])
    (runs / '.lock').mkdir()
    boot = Path('/proc/sys/kernel/random/boot_id').read_text().strip()
    (runs / '.lock' / 'info').write_text(f'20261028_090000 {os.getpid()} {boot}\n')
    proc = sandbox.run('run_all.sh', PG_ROBOT_EC2_MARKER_DIR=str(marker), PG_ROBOT_EC2_PROJECT_ROOT=str(sandbox.path / 'project'))
    assert proc.returncode == 1 and 'run_all.sh --attach' in proc.stderr and '20261028_090000' in proc.stderr
    assert 'remote_run.sh' not in sandbox.log('ssh') and sandbox.log('rsync') == ''


def test_run_all_wait_names_the_blocking_step(sandbox):
    _, marker = _run_all_setup(sandbox, ['running'])
    sandbox.rule('PingStatus', 'ConnectionLost')
    sandbox.rules.insert(0, sandbox.rules.pop())
    (sandbox.path / 'aws_rules').write_text('\n'.join(sandbox.rules) + '\n')
    proc = sandbox.run('run_all.sh', PG_ROBOT_EC2_MARKER_DIR=str(marker), PG_ROBOT_EC2_PROJECT_ROOT=str(sandbox.path / 'project'), AWS_TEST_EC2_ROBOT_WAIT_TIMEOUT='0')
    assert proc.returncode == 1 and 'timed out after 0s waiting for: SSM PingStatus Online' in proc.stderr


def test_status_groups_by_name_with_reason_cost_and_orphan_roles(sandbox):
    sandbox.rule('describe-instances', r'PathsGamesRobotTest\ti-1\tstopped\tt4g.large\tNone\t172.31.0.5\t'
                                       r'Client.UserInitiatedShutdown\tUser initiated\tspot')
    sandbox.rule('describe-volumes', r'PathsGamesRobotTest-vol\tvol-1\tin-use\t40')
    sandbox.rule('describe-addresses', r'PathsGamesRobotTest-eip\teipalloc-1\t1.1.1.1\ti-1')
    sandbox.rule('list-roles', r'PathsGamesRobotTest-role\tOldName-role')
    proc = sandbox.run('status.sh', '--no-ssh')
    assert proc.returncode == 0, proc.stderr
    out = proc.stdout
    assert '== PathsGamesRobotTest ==' in out and '== OldName ==' in out
    assert 'i-1 stopped t4g.large spot public=- private=172.31.0.5' in out and 'stopped manually' in out
    assert '~$6.85/month (EBS 40 GB' in out
    assert 'IAM role OldName-role has no instance in us-east-2' in proc.stderr
    assert 'PathsGamesRobotTest-role' not in proc.stderr
    log = sandbox.log('aws')
    assert 'Name=tag:Project,Values=Paths.games.aws.robotTest' in log and '--path-prefix /pathsgames-robot-test/' in log


def test_cycle_refuses_a_reused_instance_with_a_run_in_progress(sandbox):
    runs, marker = _run_all_setup(sandbox, ['running'])
    (runs / '.lock').mkdir()
    boot = Path('/proc/sys/kernel/random/boot_id').read_text().strip()
    (runs / '.lock' / 'info').write_text(f'20261028_090000 {os.getpid()} {boot}\n')
    proc = sandbox.run('create_and_run_and_terminate.sh', PG_ROBOT_EC2_MARKER_DIR=str(marker),
                       PG_ROBOT_EC2_PROJECT_ROOT=str(sandbox.path / 'project'))
    assert proc.returncode == 1 and 'REUSING the existing instance i-0abc' in proc.stderr
    assert 'run_all.sh --attach' in proc.stderr and 'terminate-instances' not in sandbox.log('aws')


def test_full_cycle_creates_runs_terminates_and_reports(sandbox):
    runs, remote, marker = sandbox.path / 'runs', sandbox.path / 'remote_repo', sandbox.path / 'marker'
    marker.mkdir()
    (marker / 'userdata.done').write_text('done')
    (sandbox.path / 'project').mkdir()
    (sandbox.path / 'ids_seq').write_text('\n\ni-new\n')
    sandbox.set_env(f'AWS_TEST_EC2_ROBOT_RUNS_DIR={runs}\nAWS_TEST_EC2_ROBOT_REMOTE_DIR={remote}\n'
                    'AWS_TEST_EC2_ROBOT_POLL_SECONDS=0\n')
    for pattern, output in (('Name=tag:Project', ''), ('sts get-caller-identity', '123456789012'),
                            ('ssm get-parameters', 'ami-1'), ('RootDeviceName', '/dev/sda1'),
                            ('describe-vpcs', 'vpc-1'),
                            # v1.10.0 the real text output: several zones separated by tabs
                            ('describe-instance-type-offerings', r'us-east-2a\tus-east-2b\tus-east-2c'),
                            ('describe-subnets', r'subnet-1\tus-east-2b'), ('create-security-group', 'sg-1'),
                            ('run-instances', 'i-new'), ('SpotInstanceRequestId', 'sir-1'),
                            ('State.Name', 'running'), ('PublicIpAddress', '3.3.3.3'),
                            ('InstanceStatuses', r'ok\tok'), ('PingStatus', 'Online'),
                            ('Reservations[].Instances[].InstanceId', f"@seq:{sandbox.path / 'ids_seq'}")):
        sandbox.rule(pattern, output)
    proc = sandbox.run('create_and_run_and_terminate.sh', '--yes', PG_ROBOT_EC2_MARKER_DIR=str(marker),
                       PG_ROBOT_EC2_PROJECT_ROOT=str(sandbox.path / 'project'), STUB_RUNS=str(runs))
    assert proc.returncode == 0, proc.stdout + proc.stderr
    verbs = [line.split()[1] for line in sandbox.log('aws').splitlines()]
    assert verbs.index('run-instances') < verbs.index('cancel-spot-instance-requests') < verbs.index('terminate-instances')
    assert (sandbox.path / 'home' / '.ssh' / 'pathsgames-robot-test').exists()
    report_dir = next((sandbox.path / 'results').iterdir())
    report = (report_dir / 'report.txt').read_text()
    for part in ('reused: no', 'Run exit code: 0', '== Phase durations ==', 'create', 'bootstrap', 'sync', 'tests',
                 'terminate', '== Interruption ==\nnone', 'VERIFY: nothing tagged'):
        assert part in report
