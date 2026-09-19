# Stress tests (k6)

Load test of the Paths Games backends — Java, Python and AWS share the same REST
contract, so one script set covers all three (`-b` public URL, `-a` admin URL;
`run_stress_aws.sh` resolves both from a CloudFormation stack, see below).
Every virtual user (VU) plays a complete flow:

```
POST /api/auth/guest  →  POST /api/matches  →  POST /api/matches/{m}/join  →  POST /api/matches/{m}/start
→ [ GET /api/match/{m}/info  →  up to EVENTS `available` events  →  POST .../movements/start ] × MOVES
  (+ one sleep per flow: halfway through, or as soon as a move answers 409 INSUFFICIENT_ENERGY)
```

Each movement re-reads `/info` and takes the first exit of the current location, so the
character ping-pongs around the tutorial's first room; when the location marks an event
`available` and the per-flow `EVENTS` budget is not spent, the flow runs it first
(`POST .../action/execute-event`). A `409 INSUFFICIENT_ENERGY` on a move triggers
`POST .../action/sleep` (once per flow) and a retry of that move; a second refusal after
the sleep ends the flow's walk quietly (remaining moves counted as skipped, flow still
counted completed). Before the load, `scenarios/setup_tutorial.js` checks that the tutorial
story (`story-001`) is published and imports `data/tutorial_story.json` through
`POST {ADMIN}/api/admin/stories/import` when it is missing.

## Layout

| Path | Role |
|---|---|
| `run_stress.sh` | Runner: tutorial setup, then one k6 run per VU level, stops when error rate > threshold |
| `run_stress_aws.sh` | Wrapper: resolves `-b`/`-a`/`-t`/`-k` from a CloudFormation stack + the repo `.env`, then execs `run_stress.sh` |
| `../../scripts/test/aws_ec2_with_java_docker/run_stress_ec2.sh`, `.../aws_ec2_with_python_docker/run_stress_ec2.sh` | **v0.38.1** — twin wrappers: resolve `-b`/`-a` from the EC2 instance's `.state` (written by that folder's `start.sh`), mint the admin JWT from the root `.env` `JWT_SECRET`, then exec `run_stress.sh` |
| `cleanup.sh` | Removes leftover `robottest*` guests/matches (interrupted runs): `/api/dev/cleanup`, else admin API sweep |
| `scenarios/setup_tutorial.js` | Check / import tutorial (1 VU, 1 iteration) |
| `scenarios/match_movement.js` | Main scenario (`per-vu-iterations` executor, thresholds, optional teardown cleanup) |
| `lib/config.js` | Every `-e` environment variable and its default |
| `lib/auth.js` | Guest token, admin JWT minted with the dev secret (HS256, `k6/crypto`) |
| `lib/story.js`, `lib/match.js` | REST helpers, `check()`s, per-step Trends (`step_*_ms`), counters |
| `data/tutorial_story.json` | Copy of the root `tutorial_story.json` with 3 dangling rows removed (event-effect 24/25, choice 11 and its condition) so it passes import validation |
| `reports/` | `summary_<N>vu_<timestamp>.json` per level (gitignored) |

## Requirements

- `docker` (image `grafana/k6`, pulled on first run) **or** a local `k6` binary in `PATH` / `K6_BIN`.
- `python3` (summary parsing in the runner, admin sweep in `cleanup.sh`) — stdlib only.
- A running backend. Dev Java: `mvn -pl ms-launcher spring-boot:run` (public 8042, admin 8044).
- Dev endpoints enabled for `-c` / `cleanup.sh` step 1 (`game.dev.test-endpoints-enabled: true`, dev default).
- For ≥ 10 VU use the **PostgreSQL** profile: SQLite is single-writer, at 10 VU ~10% of requests already fail with `SQLITE_BUSY`.
- `aws` CLI + credentials — only for `run_stress_aws.sh`'s stack-outputs lookup; skip it by passing `-b`/`-a` directly.

## Quick start

```bash
cd code/tests/stress
./run_stress.sh                         # Java dev, asks levels/moves/iterations/... (Enter = default)
./run_stress.sh -y                      # same, no questions: DEF_* defaults straight away
./run_stress.sh -l "1 10" -c            # two levels, cleanup robottest* data after each
./run_stress.sh -l "50" -m 20 -i 3      # 50 VU, 20 moves per flow, 3 flows per VU
./run_stress.sh -b http://localhost:8080 -a http://localhost:8044 -l "10 100"   # Java prod profile (PostgreSQL)
./run_stress.sh -h                      # all options
```

Any of `-l`/`-m`/`-i`/`-e`/`-d`/`-w` left unset (flag or env) is asked on the console with a
default, Enter keeps it; `-y`, or stdin not a tty (CI), takes the defaults silently.

AWS, through the wrapper (reads stack name/region/admin JWT/Turnstile token from the repo
`.env`, resolves the public/admin URLs from the stack outputs — see
[`run_stress_aws.sh`](#run_stress_awssh--running-against-a-deployed-stack) below):

```bash
./run_stress_aws.sh                     # AWS_STACK_NAME_TEST from .env, asks the series parameters
./run_stress_aws.sh -y                  # same, AWS defaults (levels "10 100 1000 2000", 3 iter, 500ms think)
./run_stress_aws.sh -b https://api-test.paths.games -l "50" -m 20 -i 3 -w 0   # custom domain, skip the lookup
```

Direct against a stack without the wrapper (real Turnstile → bypass token required, admin token required):

```bash
ADMIN_TOKEN=eyJ... ./run_stress.sh -b https://api-test.paths.games \
  -a https://xxxxxx.execute-api.us-east-2.amazonaws.com/test \
  -k "$(grep -oP 'CF_TURNSTILE_TOKEN: "\K[^"]+' ../robot/variables/aws.yaml)" \
  -l "50" -m 20 -i 3
```

Direct k6 (any variable of `lib/config.js` via `-e`):

```bash
docker run --rm -i --network host -v "$PWD:/scripts" -w /scripts grafana/k6 run \
  -e BASE_URL=http://localhost:8042 -e VUS=10 -e MOVES=5 scenarios/match_movement.js
```

## `run_stress.sh` options

| Flag | Env | Default | Meaning |
|---|---|---|---|
| `-b URL` | `BASE_URL` | `http://localhost:8042` | Public backend base URL |
| `-a URL` | `ADMIN_BASE_URL` | `http://localhost:8044` | Admin backend base URL (import, dev cleanup) |
| `-t TOKEN` | `ADMIN_TOKEN` | minted | Admin JWT; mandatory on AWS |
| `-k TOKEN` | `TURNSTILE_TOKEN` | — | Turnstile bypass token sent as `turnstileToken` |
| `-l "N N"` | `LEVELS` | asked, `DEF_LEVELS="1 10 100 1000"` | VU levels, one k6 run each, in series |
| `-m N` | `MOVES` | asked, `DEF_MOVES=5` | Movements per flow |
| `-i N` | `ITERATIONS` | asked, `DEF_ITERATIONS=1` | Flows per VU (each flow = new guest + new match) |
| `-e RATE` | `MAX_ERROR_RATE` | asked, `DEF_MAX_ERR=0.05` | Stop the series when `http_req_failed` > RATE |
| `-d DUR` | `MAX_DURATION` | asked, `DEF_MAX_DURATION=10m` | k6 `maxDuration` per level |
| `-w MS` | `THINK_MS` | asked, `DEF_THINK_MS=0` | Think time between steps of a flow |
| `-v N` | `EVENTS` | `1` | Events executed per flow (the first `available` one per step, `0` = none) |
| `-z 0\|1` | `SLEEP` | `1` | One sleep per flow, halfway through or when energy runs out (`0` = never sleep) |
| `-y` | — | off | No questions: take the `DEF_*` default for any of `-l -m -i -e -d -w` not already given |
| `-c` | `CLEANUP=1` | off | `POST {ADMIN}/api/dev/cleanup` in teardown of every level |
| `-s` | — | off | Skip the tutorial check/import step |
| — | `JWT_SECRET` | dev secret | Secret used to mint the admin JWT when `ADMIN_TOKEN` is empty |
| — | `MAX_P95_MS` | `2000` | `http_req_duration p(95)` threshold |
| — | `TUTORIAL_UUID` | `story-001` | Story uuid to check / play |
| — | `STORY_LANG` | `en` | `?lang=` query |
| — | `K6_BIN`, `K6_IMAGE` | `k6`, `grafana/k6:latest` | Local binary / docker image |

`-l`/`-m`/`-i`/`-e`/`-d`/`-w` are asked on the console (Enter keeps the default) whenever
left unset by both flag and env; `-y`, or a non-tty stdin (CI), takes the `DEF_*` default
straight away. Override a default for good by exporting its `DEF_*` variable —
`run_stress_aws.sh` does exactly that for its own series, see below.

Arguments after `--` are appended to `k6 run`.

## `run_stress_aws.sh` — running against a deployed stack

Wrapper around `run_stress.sh` for a deployed AWS stack: resolves the public/admin URLs and
forwards everything else. Reads the repo root `.env` for the stack name
(`AWS_STACK_NAME_TEST`), region (`AWS_REGION_TEST`, default `us-east-2`), admin JWT
(`ROBOT_VAR_ADMIN_TOKEN`) and Turnstile bypass token (`TURNSTILE_BYPASS_TOKEN_ROBOT`), then
resolves `ApiUrl` / `AdminApiUrl` via `aws cloudformation describe-stacks` (needs the AWS
CLI, credentials, and the caller's IP in the admin whitelist).

| Flag | Meaning |
|---|---|
| `-n STACK` | CloudFormation stack name (default `.env` `AWS_STACK_NAME_TEST`) |
| `-r REGION` | AWS region (default `.env` `AWS_REGION_TEST`, else `us-east-2`) |
| `-b URL` / `-a URL` | Public / admin base URL — skips the stack-outputs lookup |
| `-t TOKEN` | Admin JWT (default `.env` `ROBOT_VAR_ADMIN_TOKEN`) |
| `-k TOKEN` | Turnstile bypass token (default `.env` `TURNSTILE_BYPASS_TOKEN_ROBOT`) |
| `-h` | This help |

Everything else (`-l -m -i -e -d -w -v -z -y -c -s`, and anything after `--`) is forwarded
to `run_stress.sh`. Ships its own AWS-sized defaults for the series questions (exported as
`DEF_*`): levels `"10 100 1000 2000"`, moves `5`, iterations `3`, think `500ms`, max error
rate `0.05`, max duration `10m` — 1 iteration/VU only measures Lambda cold starts, 3 show
warm latency too; 500ms think is a player, `0` is a burst; the series stops itself past the
error threshold, so it is safe to point it at 2000 VU.

`ApiUrl` is the raw `execute-api` URL, not the custom domain — pass
`-b https://api-test.paths.games` to hit the domain instead. Exits `2` with a clear message
when the stack name, AWS CLI, stack outputs, or admin JWT are missing; a missing Turnstile
token is a warning only (match creation then fails once the stack enforces Turnstile).

## `run_stress_ec2.sh` — running against a test EC2 instance (v0.38.1)

Twin wrappers, one in `code/scripts/test/aws_ec2_with_java_docker/` and one in
`code/scripts/test/aws_ec2_with_python_docker/`, for the EC2 test instances started by that
folder's `start.sh` (see [Step20_GameWebSiteFirstRun.md](../../../documentation_v0/Step20_GameWebSiteFirstRun.md)).
Requires the folder's `.state` (missing → exit 2); public/admin URLs default to
`http://<PUBLIC_IP>:8042`/`:8044`, `-D` uses the DNS name instead; admin JWT is minted by
`run_stress.sh` from the root `.env` `JWT_SECRET` (`-t` overrides); both ports are curl-probed
before k6 starts. EC2 defaults: levels `10 100 500 1000`, moves 5, iterations 3, think 500ms,
max error rate 0.05, max duration 10m (override with `DEF_*` or `-l/-m/-i/-e/-d/-w`). Everything
else is forwarded to `run_stress.sh` exactly like `run_stress_aws.sh` above.

## `cleanup.sh` — leftover data

Use after an interrupted run (Ctrl+C, backend crash, DB lock) or when `-c` was not set.

```bash
./cleanup.sh -n                         # dry run: list leftover robottest* matches/guests
./cleanup.sh                            # step 1: POST /api/dev/cleanup; fallback step 2: admin sweep
./cleanup.sh -f                         # admin sweep only (prod, or to keep AWS seed stories)
ADMIN_TOKEN=eyJ... ./cleanup.sh -a https://xxxx.execute-api.us-east-2.amazonaws.com/test -f
```

| Flag | Meaning |
|---|---|
| `-a URL` | Admin base URL (default `http://localhost:8044`) |
| `-t TOKEN` | Admin JWT (default: minted from `JWT_SECRET`) |
| `-p PREFIX` | Name/username prefix to remove (default `robottest`) |
| `-n` | Dry run |
| `-f` | Skip `/api/dev/cleanup`, admin API sweep only |

Step 2 (sweep) pages `GET /api/admin/matches` and `GET /api/admin/guests`; a non-terminal
match is first set to `ENDED` with `PUT /api/admin/matches/{uuid}` (a running match returns
`409 MATCH_NOT_STOPPED` on delete), then `DELETE`d; guests go through `DELETE /api/admin/guests/{uuid}`.

## Reading the results

Runner summary (one row per level, `rc=99` = a k6 threshold was crossed); the runner also
prints a short legend above the table:

```
    VU | err rate |     p95 ms |    req/s |   done | failed | events | sleeps
     1 |        0 |    75.6791 |  22.0473 |      1 |      0 |      1 |      1 | rc=0
    10 |   0.0972 |   745.7159 |  30.1422 |      3 |      7 |      3 |      3 | rc=99
```

Reading the columns:

| Column | Meaning |
|---|---|
| `VU` | Virtual users playing at once (one flow each, `ITERATIONS` iteration(s) per VU) |
| `err rate` | Share of HTTP requests that failed (status ≥ 400 or network error), `0..1` |
| `p95 ms` | 95% of requests answered within this time; the slowest 5% took longer |
| `req/s` | Requests per second the backend sustained at that level |
| `done` / `failed` | Flows completed to the last move / flows aborted at any step |
| `events` / `sleeps` | Events executed / sleep actions run (each advances the match clock) |
| `rc` | k6 exit code: `0` ok, `99` a threshold was crossed, other = k6 error |

- Thresholds (Roadmap Step 93): `http_req_failed < 0.05`, `http_req_duration p(95) < 2000ms`, `checks > 0.95`.
- Per-step metrics: `step_auth_ms`, `step_match_create_ms`, `step_join_ms`, `step_start_ms`, `step_info_ms`, `step_move_ms`, `step_event_ms`, `step_sleep_ms`; counters `moves_done`, `events_done`, `sleeps_done`, `moves_skipped_energy`, `flows_completed`, `flows_failed`.
- Full JSON per level in `reports/summary_<N>vu_<ts>.json` (`metrics.<name>`).
- Each failed step logs the HTTP status and body (`create match failed: 400 {...}`), the flow then aborts.

Reference runs (v0.37.4):

| Backend | VU | Result |
|---|---|---|
| Java dev, SQLite | 1 | 0 errors, p95 76 ms |
| Java dev, SQLite | 10 | 9.7% errors — `SQLITE_BUSY database is locked` on start/move/registry inserts |

## Notes

- Guests are created with `X-Test-Marker: robottest` and matches named `robottest_stress_<vu>_<iter>`, so `POST {ADMIN}/api/dev/cleanup` removes them and nothing else. On prod the endpoint returns 403 → use `cleanup.sh -f`.
- On AWS `/api/dev/cleanup` also removes the DEMO seed stories (`lambda/seed/handler.py`); `cleanup.sh -f` does not.
- One guest can own a single active match per story, so every flow mints a fresh guest.
- Admin JWT: minted locally from `JWT_SECRET` with the same claims as `robot/resources/JwtHelper.py`; pass `-t` / `ADMIN_TOKEN` when the backend uses another secret (AWS).
- Turnstile: `POST /api/matches` is rejected with `TURNSTILE_VALIDATION_FAILED` when the backend has `TURNSTILE_SECRET_KEY` set. Pass the bypass token with `-k` / `TURNSTILE_TOKEN` — it must equal the backend's `TURNSTILE_BYPASS_TOKEN` (non-prod only; same value as `CF_TURNSTILE_TOKEN` in `robot/variables/aws.yaml`).
- `open()` of the 422 KB tutorial JSON runs in k6 init context (once per VU), which is why the import lives in a separate 1-VU script; `match_movement.js` only verifies and aborts with a hint if the story is missing.
- Cost warning on AWS: every move writes logs to DynamoDB and each request is a Lambda invocation; start from `-l "10 100" -m 20 -i 3` and read CloudWatch before scaling up. 1000+ VU from one machine also hits local TLS/socket limits before the backend does.
- v0.38.1: `AuthFunction`/`MatchFunction` Lambda timeouts raised 30s → 102s (`template/auth.yaml`, `template/match.yaml`) after a 2000-VU run queued start/move requests past the old 30s limit; API Gateway HTTP API still cuts the client off at 30s, so this reduces truncated executions rather than client-visible errors.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `lookup api-dev.paths.games: no such host` | Custom domain not deployed; use the `https://<id>.execute-api.<region>.amazonaws.com/<env>` public URL |
| `TURNSTILE_VALIDATION_FAILED` on create match | Backend has a real Turnstile secret: pass `-k <bypass token>` |
| `import 201` failed with `400 INVALID_STORY` | JSON has dangling references; `data/tutorial_story.json` is already sanitized, check you did not overwrite it |
| Import `500` then "already present" but flows fail with `no neighbors` | Half-imported story (no rollback on the backend): `DELETE {ADMIN}/api/admin/stories/story-001` and rerun |
| `cleanup skipped: HTTP 404 ... admin port only` | `/api/dev/cleanup` is served on the admin port: check `-a` |
| `SQLITE_BUSY database is locked` | Expected on SQLite above a few VU; switch to PostgreSQL |
| `docker: permission denied` on `reports/` | Runner mounts the folder with `--user $(id -u)`; make sure `reports/` is writable |
| 2000-VU burst: guest `201`s failing right at the start, `start` step p99 ≈ 26s | Lambda concurrency ramp hitting the (then) 30s timeout; v0.38.1 raised `AuthFunction`/`MatchFunction` to 102s — API Gateway's own 30s client cutoff is unchanged, so slow requests still time out client-side past that |





# &lt; Paths Games /&gt;
All source code and informations in this repository are the result of careful and patient development work by developer team, who has made every effort to verify their correctness to the greatest extent possible. If part of the code or any content has been taken from external sources, the original provenance is always cited, in respect of transparency and intellectual property.

Some content and portions of code in this repository were also produced with the support of artificial intelligence tools, whose contribution helped enrich and accelerate the creation of the material. Every piece of information and code fragment has nevertheless been carefully checked and validated with the goal of ensuring the highest quality and reliability of the provided content.

For all details, in-depth information, or requests for clarification, please visit [Paths.Games](https://paths.games/) website



## License
Made with ❤️ by <a href="https://github.com/gamespaths/pathsgames">paths.games dev team</a>
&bull; 
Public projects 
<a href="https://www.gnu.org/licenses/gpl-3.0"  valign="middle"> <img src="https://img.shields.io/badge/License-GPL%20v3-blue?style=plastic" alt="GPL v3" valign="middle" /></a>
*Free Software!*


The software is distributed under the terms of the GNU General Public License v3.0. Use, modification, and redistribution are permitted, provided that any copy or derivative work is released under the same license. The content is provided "as is", without any warranty, express or implied.


Narrative Content & Assets: The story, dialogues, characters, sounds, musics, paint, all artist contents and world-building (located on /data folder) are NOT open source. They are licensed under Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 (CC BY-NC-ND 4.0).


(ITA) Il software è distribuito secondo i termini della GNU General Public License v3.0. L'uso, la modifica e la ridistribuzione sono consentiti, a condizione che ogni copia o lavoro derivato sia rilasciato con la stessa licenza. Il contenuto è fornito "così com'è", senza alcuna garanzia, esplicita o implicita.



