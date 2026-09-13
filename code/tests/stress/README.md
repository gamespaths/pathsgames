# Stress tests (k6)

Load test of the Paths Games backends — Java, Python and AWS share the same REST
contract, so one script set covers all three (`-b` public URL, `-a` admin URL).
Every virtual user (VU) plays a complete flow:

```
POST /api/auth/guest  →  POST /api/matches  →  POST /api/matches/{m}/join  →  POST /api/matches/{m}/start
→ [ GET /api/match/{m}/info  →  POST /api/gameplay/{m}/movements/start ] × MOVES
```

Each movement re-reads `/info` and takes the first exit of the current location, so the
character ping-pongs around the tutorial's first room. Before the load,
`scenarios/setup_tutorial.js` checks that the tutorial story (`story-001`) is published
and imports `data/tutorial_story.json` through `POST {ADMIN}/api/admin/stories/import`
when it is missing.

## Layout

| Path | Role |
|---|---|
| `run_stress.sh` | Runner: tutorial setup, then one k6 run per VU level, stops when error rate > threshold |
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

## Quick start

```bash
cd code/tests/stress
./run_stress.sh                         # Java dev, levels 1 10 100 1000
./run_stress.sh -l "1 10" -c            # two levels, cleanup robottest* data after each
./run_stress.sh -l "50" -m 20 -i 3      # 50 VU, 20 moves per flow, 3 flows per VU
./run_stress.sh -b http://localhost:8080 -a http://localhost:8044 -l "10 100"   # Java prod profile (PostgreSQL)
./run_stress.sh -h                      # all options
```

AWS (real Turnstile → bypass token required, admin token required):

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
| `-l "N N"` | — | `1 10 100 1000` | VU levels, one k6 run each, in series |
| `-m N` | `MOVES` | `5` | Movements per flow |
| `-i N` | `ITERATIONS` | `1` | Flows per VU (each flow = new guest + new match) |
| `-e RATE` | `MAX_ERROR_RATE` | `0.05` | Stop the series when `http_req_failed` > RATE |
| `-d DUR` | `MAX_DURATION` | `10m` | k6 `maxDuration` per level |
| `-c` | `CLEANUP=1` | off | `POST {ADMIN}/api/dev/cleanup` in teardown of every level |
| `-s` | — | off | Skip the tutorial check/import step |
| — | `JWT_SECRET` | dev secret | Secret used to mint the admin JWT when `ADMIN_TOKEN` is empty |
| — | `THINK_MS` | `0` | Pause between steps of a flow |
| — | `MAX_P95_MS` | `2000` | `http_req_duration p(95)` threshold |
| — | `TUTORIAL_UUID` | `story-001` | Story uuid to check / play |
| — | `STORY_LANG` | `en` | `?lang=` query |
| — | `K6_BIN`, `K6_IMAGE` | `k6`, `grafana/k6:latest` | Local binary / docker image |

Arguments after `--` are appended to `k6 run`.

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

Runner summary (one row per level, `rc=99` = a k6 threshold was crossed):

```
    VU | err rate |     p95 ms |    req/s |   done | failed
     1 |        0 |    75.6791 |  22.0473 |      1 |      0 | rc=0
    10 |   0.0972 |   745.7159 |  30.1422 |      3 |      7 | rc=99
```

- Thresholds (Roadmap Step 93): `http_req_failed < 0.05`, `http_req_duration p(95) < 2000ms`, `checks > 0.95`.
- Per-step metrics: `step_auth_ms`, `step_match_create_ms`, `step_join_ms`, `step_start_ms`, `step_info_ms`, `step_move_ms`; counters `moves_done`, `flows_completed`, `flows_failed`.
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
