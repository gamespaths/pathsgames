# Robot suites on an EC2 spot instance

Develop locally, sync the working tree to an EC2 instance, run
`code/scripts/dev/run_robot_everywhere.sh --aws=all` there (golden runs included) and bring the
results back.

Why: behind Cloudflare WARP the local egress IP keeps changing, which breaks the admin-API IP
allow-list of the AWS test stack. On the EC2 instance the IP stays the same for a whole run, and
a fixed Elastic IP is available as an option.

Access goes only through **SSH over SSM**. The security group has no ingress rule, so the
scripts work from any local IP.

## Prerequisites (local)

- `aws` CLI v2 with credentials that can manage EC2, IAM roles/instance profiles and SSM sessions
  in the region, and can read/update the test stack (needed only by `terminate.sh`'s local restore).
- `session-manager-plugin`, `ssh`, `rsync`.
- The root `.env` (it is copied to the server **in full**).
- The local `.venv` with Robot Framework (`fetch_results.sh` reads the `output.xml` files with
  `robot.api` to count the failed tests).

## Quick start

```bash
cd code/scripts/dev/aws/run_robot_ec2_spot
./create_and_run_and_terminate.sh            # one full cycle: create -> run -> fetch -> terminate -> report
# or step by step
./create.sh [--size xlarge] [--fixed-ip]     # instance ready and bootstrapped
./run_all.sh                                 # start if stopped, bootstrap, sync, run, fetch
./stop.sh                                    # keep the disk, pay only EBS (+ EIP)
./terminate.sh                               # delete everything
```

## Scripts

| Script | What it does |
|---|---|
| `common.sh` | Sourced by every script: `.env`, defaults, derived names, validation, tags, SSH/rsync over SSM, waits, lookups |
| `create.sh` | Preflight (`sts get-caller-identity`, `session-manager-plugin`, `rsync`, `ssh`), refuses an existing instance, then key pair, IAM role/profile, SG, instance (+ EIP), waits until ready, bootstrap. `--size`, `--market`, `--fixed-ip`, `--no-wait`, `--dry-run` |
| `start.sh` | Starts a stopped instance (3 tries on `InsufficientInstanceCapacity`, then suggests `--size <bigger>`); `--size` changes the type while stopped, `--fixed-ip` adds the EIP |
| `stop.sh` | Stops the instance; refuses while a run is in progress unless `--force` |
| `run_all.sh` | Start if stopped -> wait ready -> lock check -> bootstrap -> sync -> run in background -> poll -> fetch. `--attach` follows a run in progress, `--size`, `--yes` (restart and rerun without asking after an interruption). Exit 0 green, 3 tests failed, 4 interrupted, 1 error |
| `fetch_results.sh` | Default the `latest` run, or `--run <ts>` |
| `terminate.sh` | Deletes everything (see below). `--name <other>` for an old name, `--yes`, `--dry-run` |
| `status.sh` | Everything tagged `Project=Paths.games.aws.robotTest`, grouped by name. `--no-ssh` skips the run check |
| `connect.sh` | Interactive shell on the server (or `connect.sh <command>`) |
| `bootstrap.sh` | Runs **on the server** as root: tool chain, versioned and idempotent |
| `remote_run.sh` | Runs **on the server** as `ubuntu`: one run under a lock (`run`), `restore`, `stop` |
| `create_and_run_and_terminate.sh` | Manual convenience: create (or reuse) -> `run_all.sh` -> terminate -> `results/<ts>/report.txt` |

There is one mode only and no local state file. Every lookup is by name. The only temporary file
is the SSH config, which is rebuilt on every call in `$TMPDIR`.

## Names and tags

`AWS_TEST_EC2_ROBOT_NAME` (default `PathsGamesRobotTest`, `[A-Za-z0-9-]`, max 40 chars) is the
base of every name:

| Resource | Name | Lookup |
|---|---|---|
| Instance | `<NAME>` | `tag:Name`, not terminated / shutting-down; two matches = error with the ids |
| Security group | `<NAME>-sg` | group name |
| Root volume / ENI | `<NAME>-vol` / `<NAME>-eni` | tag (verification only) |
| Spot request | `<NAME>-spot` | tag `Name` |
| Elastic IP | `<NAME>-eip` | tag `Name` |
| Key pair | `<NAME>-key` | key name |
| IAM role / instance profile | `<NAME>-role` / `<NAME>-profile` | name (path `/pathsgames-robot-test/`) |

Tags come from `code/scripts/test/aws_tags.txt`, with `Environment=Test`,
`Project=Paths.games.aws.robotTest` and `Language=Robot`. Resources are tagged at creation:
`run-instances --tag-specifications` covers the instance, volume, network-interface and
spot-instances-request; SG, EIP and key pair use `--tag-specifications`; IAM uses `--tags`.

If you change the name in `.env`, `status.sh` still lists the old resources and
`terminate.sh --name <old>` removes them.

## Instance

- Ubuntu 24.04 LTS arm64. The AMI comes from the public SSM parameter
  `/aws/service/canonical/ubuntu/server/24.04/stable/current/arm64/hvm/ebs-gp3/ami-id`
  (SSM agent preinstalled).
- `t4g.<SIZE>` with CPU credits `unlimited`. IMDSv2 is required.
- Spot requests are `persistent` with interruption behaviour `stop`. Both spot and on-demand
  instances use `InstanceInitiatedShutdownBehavior=stop`.
- The root disk is gp3, `AWS_TEST_EC2_ROBOT_DISK_GB` GB, with `DeleteOnTermination` on. Encryption
  is not set explicitly, so the account default applies.
- The instance runs in the default VPC, in a subnet with auto-assign public IPv4 and in an AZ that
  offers the type. If no such subnet exists, `create.sh` fails before creating anything. A
  capacity error moves on to the next subnet.
- The public IP is dynamic by default. `--fixed-ip` (or `AWS_TEST_EC2_ROBOT_FIXED_IP=true`)
  allocates a tagged Elastic IP. It is kept across stop/start and released by `terminate.sh`.
- SSH key: `~/.ssh/pathsgames-robot-test` (ed25519) is generated once and reused forever. Its
  public key is imported as `<NAME>-key`. `terminate.sh` deletes only the EC2 key pair, never the
  local key.

## IAM role of the server (test stack only)

`AmazonSSMManagedInstanceCore` plus the inline policy `<NAME>-test-stack`. The policy has no
deploy permissions and touches nothing of alpha, beta or production (`create.sh` refuses a stack
or env whose name contains alpha/beta/prod):

| Sid | Why |
|---|---|
| `TestStackRead` | `DescribeStacks` (+ events/resources/template) on `AWS_TEST_SAM_STACK_NAME` and its nested stacks `<stack>-*`: allow-list read, `AdminApiUrl` output, `wait stack-update-complete` |
| `TestStackAllowListUpdate` | `UpdateStack` on the same stacks: the `--use-previous-template` parameter update of `aws_set_admin_ip.sh` / `lib/admin_ip.sh` and the restore. CloudFormation updates the nested stacks with the caller's permissions |
| `SamTransform` | `CreateChangeSet` on `arn:aws:cloudformation:<region>:aws:transform/Serverless-2016-10-31` only: the SAM transform runs again on every update |
| `NestedTemplates` | `s3:GetObject` on `s3://<AWS_TEST_S3_BUCKET_BASE>/<S3_PREFIX or env/backend>/*`: the nested templates CloudFormation reads again |
| `TestLambdaConfig` | Read and `UpdateFunctionConfiguration` on `pathsgames-<env>-*`. The parameter change rewrites `ADMIN_IP_WHITELIST` in the functions' env, and `run_robot_with_aws_serverless_special.sh` switches the rate limits on and off. No `UpdateFunctionCode` |
| `PassTestLambdaRoles` | `iam:PassRole` on `role/<stack>-*`, only to `lambda.amazonaws.com`. CloudFormation sends the unchanged role with the configuration update |
| `PurgeRobotTestData` | `Scan/Query/BatchWriteItem/DeleteItem/DescribeTable` on `PathsGamesBackend-<env>` (+ indexes): `purge_robot_test_data.sh`, called by `run_robot_with_aws_serverless.sh` |

## Server side

- **user-data** (first boot only) sets the timezone (`AWS_TEST_EC2_ROBOT_TIMEZONE`), installs the
  nightly shutdown and writes `/var/lib/pathsgames-robot/userdata.done`.
- **Nightly shutdown**: a systemd timer fires at `AWS_TEST_EC2_ROBOT_SHUTDOWN_TIME`. While the
  run lock is held, it retries every 15 minutes until `AWS_TEST_EC2_ROBOT_SHUTDOWN_LATEST`, then
  shuts down anyway. `shutdown -h now` stops the instance (it does not terminate it). An instance
  started by hand after the timer has fired stays up.
- **`bootstrap.sh`** is re-run by `run_all.sh` before every run. It takes seconds when
  `BOOTSTRAP_VERSION` matches the marker; bump the version to force an upgrade. It installs
  openjdk-21, maven, Docker from the official repository (user `ubuntu` in group `docker`), AWS
  CLI v2 arm64, SAM CLI arm64, rsync, psmisc (`fuser`), Python 3.12 (Ubuntu) and the Robot
  `.venv` (`code/tests/robot/requirements.txt` + boto3/pyyaml). It also installs Python 3.13 via
  `uv`, linked as `python3.13` only, because `sam build` needs the Lambda runtime on `PATH`.
- **Runs**: each run lives in `~/runs/<YYYYmmdd_HHMMSS>/`, with `~/runs/latest` pointing at the
  last one. A run directory holds:
  - `run.log`, `started_at`, `exit_code`, `finished_at`;
  - `admin_allowlist.txt` (the stack list saved before the run) and `lambda_env_backup/`;
  - `reports/`, `logs/` and `golden/`, archived at the end;
  - `restored` / `aborted` markers.

  The lock is `~/runs/.lock/info` (`<ts> <pid> <boot id>`). A lock from a dead process or from an
  earlier boot counts as stale.

## Sync

`run_all.sh` runs rsync over SSH to `AWS_TEST_EC2_ROBOT_REMOTE_DIR` with `--delete`.

Excluded paths are never copied and never deleted on the server:

- `/.git/`, `/.alnao/`, `/code/website/`, `/wiki/documentation_v0/website_concepts_v0/`;
- `node_modules/`, `target/`, `.venv/`, `.aws-sam/`, `__pycache__/`;
- `/code/tests/robot/reports-*/`, `/code/scripts/dev/run_robot_results/`,
  `/code/scripts/dev/aws_run_local/logs/`, this folder's `results/`;
- `/.env` and `/.env.*` (`.env.example` is kept).

After the code, the full `.env` is copied with mode 600. Other root env files (alpha,
production) never leave the machine.

## Admin allow-list

`run_all.sh` checks whether the server's public IP is already in `ADMIN_IP_WHITELIST` (`.env`):

- **Yes**: the run gets `ROBOT_SKIP_ADMIN_IP=true` and the stack list is not touched by the
  runners. With `--fixed-ip`, add the EIP to `ADMIN_IP_WHITELIST` and redeploy once to take this
  path.
- **No**: the normal path runs. `run_robot_with_aws_serverless*.sh` call `aws_set_admin_ip.sh`
  on the server, so the server IP is added.

Either way the stack allow-list is saved before the run and restored after it.

## Interruptions and restore

`run_all.sh` polls every `AWS_TEST_EC2_ROBOT_POLL_SECONDS`. As soon as the Lambda env backup
written by `run_robot_with_aws_serverless_special.sh` appears, the server copies it into the run
directory, and `run_all.sh` downloads it into `results/<ts>/lambda_env_backup/`, together with
`admin_allowlist.txt`.

If the instance stops while the run has no exit code, `run_all.sh` prints the `StateReason`:

| `StateReason` | Meaning |
|---|---|
| `Server.SpotInstanceShutdown` | Spot interruption |
| `Client.InstanceInitiatedShutdown` | Nightly or OS shutdown |
| `Client.UserInitiatedShutdown` | Stopped by hand |

It then offers to restart and rerun (at most twice; automatic with `--yes`). A rerun inherits the
original allow-list of the interrupted run and puts its Lambda env back at once. `terminate.sh`
restores whatever an unfinished run left on the test stack: it uses the server when reachable,
otherwise the local copy in `results/`.

## Results

`fetch_results.sh` copies files to three places:

- `reports-*/` into `code/tests/robot/`, as a local run would;
- the logs into `code/scripts/dev/run_robot_results/`;
- a dated copy into `results/<ts>/`: run log, summary, failed-test counts, phases and the **golden
  JSON** written by the GOLDEN runs, in `results/<ts>/golden/`.

The golden files are **never** written over
`code/tests/robot/tests_v0/41_alpha_prep/fixtures/golden/`, which is tracked by git. To adopt
them, compare and copy by hand.

At the end it prints the `run_robot_everywhere` summary table and how many tests failed in each
`output.xml`, plus the total (no list of the failed tests: open the reports for that).

## terminate.sh order

1. Cancel every spot request tagged `<NAME>-spot`, orphans included, plus the instance's own.
2. Restore the test stack if the last run was left unfinished.
3. Terminate the instance and wait until it is terminated.
4. Release the EIP.
5. Delete the key pair.
6. Remove the role from the profile, delete the profile, delete or detach the role policies,
   delete the role.
7. Delete the SG, retrying on `DependencyViolation`.
8. Verify that nothing tagged `Project` + `Name` is left (instances, volumes, ENIs, SGs, EIPs,
   key pairs, spot requests, IAM) and report the result.

## Settings (`.env`, all optional)

`AWS_TEST_EC2_ROBOT_NAME`, `_SIZE`, `_MARKET`, `_FIXED_IP`, `_REGION`, `_DISK_GB`, `_SSH_KEY`,
`_REMOTE_DIR`, `_RUNS_DIR`, `_TIMEZONE`, `_SHUTDOWN_TIME`, `_SHUTDOWN_LATEST`, `_POLL_SECONDS`,
`_WAIT_TIMEOUT`. See `.env.example` for the defaults. The test stack comes from
`AWS_TEST_SAM_STACK_NAME` (default `pathsgames-test`), `AWS_TEST_SAM_ENVIRONMENT_NAME` and
`AWS_TEST_REGION`.

## Linux arm64 notes

- `aws_run_local/start_local.sh` defaults to x86_64 Lambda images. `remote_run.sh` exports
  `AWS_LOCAL_ARCH=arm64` on aarch64, so `sam build` packs native wheels and `sam local` runs native
  images. No existing script was changed.
- No script relies on `host.docker.internal`: `sam local` reaches DynamoDB Local and moto by
  container name on the `pathsgames-aws-local` network.
- The local runners need `fuser` (psmisc), `ss`, `openssl` and `python3 -m venv`. Bootstrap
  installs them.

## Rough cost

While running, you pay for the t4g spot price plus EBS. While stopped, you pay only for EBS
(about $0.08 per GB-month, so ~$3.20/month for 40 GB) plus the EIP if there is one (~$3.65/month).
`status.sh` prints the estimate for each name.

## Tests

`code/backend/aws/tests/test_v1_10_ec2_robot_scripts.py` runs every script with stubbed `aws`,
`ssh`, `rsync` and `session-manager-plugin` and a tmp HOME. The scripts honour test-only
overrides: `PG_ROBOT_EC2_ENV_FILE`, `PG_ROBOT_EC2_PROJECT_ROOT`, `PG_ROBOT_EC2_RESULTS_DIR`,
`PG_ROBOT_EC2_PYTHON`, `PG_ROBOT_EC2_MARKER_DIR`.

```bash
source .venv/bin/activate && cd code/backend/aws && pytest tests/test_v1_10_ec2_robot_scripts.py
```
