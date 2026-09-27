# Step 41 — Alpha preparation

**Status: analysis closed (written at v0.40.0, updated at v0.41.0) — 44 decisions of the owner
on September 27, 2026 (§8.1), no open point; nothing developed yet.**
Roadmap line: *logging and snapshots, security, admin IP protection, guest cleanup and limits,
KPI report* ([Roadmap](./Roadmap.md) step 41; the test certificate moved to V1 step 41). Touches the three backends,
react-admin (two new views), react-game (new log rows, limit message), scripts, a CI workflow,
Terraform, docs. Developed in three patches (§8.1 decision 15).

## 1. Scope

| # | Sub-point | Tag | Summary |
|---|-----------|-----|---------|
| A | Logging gaps | backend | Pass, edge states, trait changes, match lifecycle and admin actions reach the timeline; AWS gets its missing RECOVERY rows; a log-size check |
| B | Match snapshots | backend, frontend | LIGHT snapshot at every time-end (before the clock moves); admin list, integrity check and restore (state and logs rolled back) |
| C | Residual security | backend, frontend, infra | API security headers, dependency scan as a CI job, secrets-review fixes, CORS alignment, website CSP `restricted` on test |
| D | Admin IP allow-list (AWS) | backend, infra | `AdminIpEmptyMeans` (`nobody` default / `everybody`) on every admin check; stage deploy script detecting the caller IP |
| E | Guest cleanup and limits | backend | Fix of today's expired-guest delete (Java/PostgreSQL, Python, AWS); daily job deleting match-less guests idle for N days (default 60); per-guest match limit; non-zero code defaults |
| F | KPI report | backend, frontend | Daily UTC counters per story, `GET /api/admin/reports/kpi`, react-admin Reports page with the active matches |
| G | Tests | tests | Unit tests > 96% of new code; Robot `41_alpha_prep/` plus additions to `41_security/` |

**Out of scope**: backups, PITR, CloudWatch alarms and budget (step 42 — A's WARN line is only
their input); privacy policy and retention text (42, it will quote E's age); the alpha stack,
bucket, site and its CSP (42 — D writes only the script); test ACM certificate (moved to V1
step 41 by the owner: certificates stay as they are, documented in
[Environments](../Environments.md) §2 and §5); DynamoDB table split (V1, Backlog); distributed lock for scheduled
jobs (V6, Backlog — one instance per backend is assumed); in-app IP allow-list on Java/Python
(network layer stays, [Security](../Security.md) §2); manual snapshots from the console; KPI per
player.

### What already exists (findings)

**A — logging.** All three backends answer the timeline types WEATHER, MOVEMENT, SLEEP,
CLOCK_ADVANCE, RECOVERY, EVENT, CHOICE, COUNTER_ZERO, AUTOMATIC_EVENT, RANDOM_EVENT,
REGISTRY_CHANGE, MISSION_CHANGE, EXP_USE, ITEM_ADD/USE/DROP; Step 40 closed the resource-gain
gaps. AWS keeps `logCount`/`logSeq` on the match METADATA item (`logbook.persist`), but nothing
reads `logCount` and no size is checked anywhere. Remaining gaps:

| Action / effect | Java | Python | AWS |
|-----------------|------|--------|-----|
| pass turn (`TurnCycleService.passTurn`, `_pass_turn`) | no row | no row | no row |
| edge states `COMA`, `SADNESS_OVERFLOW`, `COMA_RECOVERED`, `ALL_PLAYER_COMA` | written to `log_events`, dropped by the timeline | same | `AUDIT#` `EDGE_STATE` only |
| time-start recovery | RECOVERY | RECOVERY | **no row** |
| trait granted/removed by an effect (`EventExecutionService.applyTraits`) | no row | no row | no row |
| match created / started / ended | no row | no row | no row |
| admin status change, stop/pause/resume, `changeStatistics` (registry edits already log) | no row | no row | no row |

**B — snapshots.** `system_snapshot` exists since `V0.10.10` (Postgres + SQLite: `id_story`,
`id_match` ON DELETE CASCADE, `timestamp`, `type` FULL/LIGHT, `jsonb_data`, `file_path`,
`description`) but **no code reads or writes it**; AWS has no snapshot item. ONCE gating and
choice cycles are derived from log rows on Java/Python (`log_events`, `log_choices_executed`) and
from `executedEventIds`/`eventMarkers` on the AWS METADATA item, so a restore that keeps later
logs leaves events consumed that "never happened".
Time-end order: `sleep` (last sleeper) and `forceTimeEnd` both call `advanceTime`, which
increments the clock, wakes everybody, then runs recovery, automatic events, weather and random
event. On a choice with `flag_end_time`, Java (`EventExecutionService`, `forceTimeEnd` then
`writeResolutionMarkers`) and Python (`event_service._force_time_end` then
`_write_resolution_markers`) write the choice marker **after** the time-start, with the new
clock; AWS `_resolve_choice` sets its markers **before** `_force_time_end_news`. A time-end
snapshot would miss that marker on Java/Python (decision 19 moves it).

**C — security.** CSRF on `POST /api/matches`, per-IP limits, HttpOnly refresh cookie,
DOMPurify and Turnstile are done (v0.37.7, suite `41_security`, `test_step41_security.py`).
Found now:
- **no security header on any API response** (Java filters, Python middleware, AWS
  `common/response.py` `HEADERS = {"Content-Type": ...}`); the website CloudFront policy has
  them, but `csp_mode = "open"` in both `test.tfvars` and `production.tfvars`;
- CORS: Java `WebConfig` and Python do not expose `Retry-After` (AWS does); Python's default
  `CORS_ALLOWED_ORIGINS="*"` becomes `allow_origin_regex=".*"` **with credentials**;
- secrets: the dev JWT secret `PathsGamesDevSecret2026_…` is the code default on all three
  (Java `application.yml`, Python `config.py`, SAM `JwtSecret`); SAM `AllowMockAccess` defaults
  to `"true"` (the seed admin uuid behind `MOCK_ACCESS_<uuid>` is public in the repo); the
  Turnstile bypass is honoured when env `!= "prod"`, so also on `alpha`/`beta`; Python
  `dev_test_endpoints_enabled` defaults to true; no `.env` is tracked by git;
- no dependency scan anywhere (SonarQube only); `.github/workflows/` has `backend-ci.yml`
  (push on `main`), five `sonarqube-*.yml` (push on `develop`) and `website-deploy.yml`; no
  `.github/dependabot.yml`. The V6 roadmap line "vulnerability scanning in the build pipeline"
  is brought forward to this step (owner, decision 7);
- website CSP (`code/website/terraform-aws/cloudfront.tf`): the CloudFront response-headers
  policy sends `Content-Security-Policy` on every page of the site. `open` allows any origin for
  scripts, styles, fonts, images and API calls (`default-src *` plus `'unsafe-eval'`);
  `restricted` allows only `'self'`, the five SSM lists `/paths-games/csp/*` and the
  `csp_extra_domains` of the env (test adds the `api-test*` hosts and Cloudflare Turnstile). It
  is the browser's second line against XSS: an injected script cannot load code from, or send
  data to, a domain outside the list.

**D — allow-list.** `AdminIpWhitelist` → `ADMIN_IP_WHITELIST` on the authorizer and the auth,
story and match Lambdas; "empty = allow all" lives in **five** copies (`authorizer/handler.py`,
`common/http_utils.check_admin_ip`, private `_check_admin_ip` in `auth`, `story`, `match`).
`code/scripts/test/aws/aws_backend_deploy.sh` (dev/test only) already detects the caller IP
(`checkip.amazonaws.com`, fallback `ipify`) and merges it with `.env` `ADMIN_IP_WHITELIST`.
alpha/beta/prod have `samconfig.toml` sections and no script; their comment says "pass
AdminIpWhitelist at deploy time", but a CLI `--parameter-overrides` **replaces** the samconfig
list, silently dropping `AllowMockAccess=false` and the rate limits.

**E — guests.** Java `GuestSessionCleanupScheduler` (00:42 daily) deletes guests past
`guest_expires_at` (180 days) **without checking matches** (`UserRepository.deleteExpiredGuests`,
one JPQL bulk `DELETE`). Four tables reference `users(id)` without cascade
(`gaming_match.id_user_creator`, `gaming_character_instance.id_user`,
`gaming_user_sessions.id_user`, `chat_messages.id_user`; only the token table cascades), so on
PostgreSQL one such guest makes the whole delete fail. Python
`guest_persistence_adapter.delete_expired_guests` has the same query; nothing schedules it (no
scheduler dependency), and on SQLite without `PRAGMA foreign_keys` it would leave orphan rows.
AWS has only `DELETE /api/admin/guests/expired`, which would leave orphan matches. The v0.36.2 purge `GET/DELETE /api/admin/guests/stale` deletes
guests (by last access) **and** their matches. Per-IP limits on guest and match creation exist
(`RATE_LIMIT_GUEST_PER_IP`, `RATE_LIMIT_MATCH_PER_IP`, `RATE_LIMIT_WINDOW_SECONDS`, code default
0 = off; in memory on Java/Python, `RATELIMIT#` items with `ttl` on AWS); nothing per guest
besides the 409 `ACTIVE_MATCH_ALREADY_EXISTS`. react-game shows the raw code `RATE_LIMITED`.

**F — KPI.** Nothing exists; the Dashboard shows server status, guest stats and story count.
`/api/admin/matches` (paged, `status`/`storyUuid` filters) and `/api/admin/matches/{uuid}/info`
already carry what the "active matches" panel needs.

## 2. Endpoint APIs

New file `code/backend/java/adapter-rest/src/main/resources/openapi/v0.41.0-alpha-preparation-api.yaml`.
Every new endpoint is admin-only (port 8044 / `PathsGamesAdminApi`).

| Method | Path | Answer |
|--------|------|--------|
| GET | `/api/admin/matches/{uuidMatch}/snapshots` | `SnapshotSummary[]`, newest first |
| GET | `/api/admin/matches/{uuidMatch}/snapshots/{uuidSnapshot}/check` | `SnapshotCheck`; writes nothing |
| POST | `/api/admin/matches/{uuidMatch}/snapshots/{uuidSnapshot}/restore` | 200 `SnapshotRestoreResponse`; 409 `SNAPSHOT_INTEGRITY_FAILED` + `errors[]`; 404 `MATCH_NOT_FOUND` / `SNAPSHOT_NOT_FOUND` |
| GET | `/api/admin/reports/kpi?storyUuid&from&to&groupBy` | `KpiReport`; `groupBy` = `day` (default) / `month` / `total`; UTC dates `YYYY-MM-DD`, default last 30 days, max 366; no `storyUuid` = all stories summed; 400 `INVALID_INPUT` |

`/api/admin/reports/kpi` avoids `/api/admin/stories/{uuidStory}/{entityType}`, which would
swallow a `/kpi` suffix.

Changed:

| Endpoint | Change |
|----------|--------|
| `GET/DELETE /api/admin/guests/stale` | optional `withoutMatches=true`: only guests with no match, matches untouched — the same service method the job runs, so Robot and the console can trigger it; omitted = today's behaviour |
| `POST /api/matches` | 429 `RATE_LIMITED` also from the new per-guest bucket (same body, `Retry-After`) |
| `GET /api/matches/{uuid}/logs`, `GET /api/admin/matches/{uuid}/logs` | five new entry types (§3) |
| `GET /api/admin/matches/{uuid}/info` | new `logCount` |
| admin pause/resume/stop, `PUT /api/admin/matches/{uuid}`, `.../changeStatistics` | same answer; now write an `ADMIN_ACTION` row |
| every API response, all backends | security headers (§6.1) |

## 3. DTOs and Domain Models

- **Timeline types** (`MatchLogsPort.LogEntry`, Python mirror, AWS `logbook.append`), detail in
  `message`, no new field: `PASS` (character, clock); `EDGE_STATE` (character, clock, `COMA` /
  `SADNESS_OVERFLOW` / `COMA_RECOVERED` / `ALL_PLAYER_COMA`); `TRAIT_CHANGE` (character,
  `idEvent`, `ADD <uuid>` / `REMOVE <uuid>`); `MATCH_LIFECYCLE` (`CREATED` / `STARTED` /
  `ENDED`); `ADMIN_ACTION` (`PAUSE`, `RESUME`, `STOP`, `STATUS <x>`, `STATS <deltas>`,
  `SNAPSHOT_RESTORED clock=<n>`).
- `SnapshotSummary`: `uuid`, `clock`, `type` (`LIGHT`), `timestamp`, `description`, `sizeBytes`.
- `SnapshotCheck`: `valid`, `errors[]` of `{code, message}` — `SNAPSHOT_CHECKSUM_MISMATCH`,
  `SNAPSHOT_VERSION_UNKNOWN`, `STORY_ENTITY_MISSING` (location, item, trait, event, choice,
  weather, class, template or mission gone from the story), `USER_MISSING`, `MATCH_MISMATCH`.
- `SnapshotRestoreResponse`: `status: RESTORED`, `uuidSnapshot`, `clock`, `matchStatus`
  (`PAUSED`), `logsRemoved`.
- Snapshot payload (JSON, `v: 1`, SHA-256 `checksum` of the canonical payload): match fields
  (`status`, `currentClock`, `idCurrentWeather`, `idCharacterCurrentTurn`), characters (every
  stat/state column), backpack, inventory, traits, registry, location states, turn queue, active
  choices, `logMarks` (max log id per `log_*` table). AWS: METADATA without GSI keys, `CHARACTER#`
  and `TURN#` rows, `logSk` (last `LOG#`/`AUDIT#` sort key) and `logSeq`.
- `KpiReport`: `storyUuid`, `from`, `to`, `groupBy`, `rows[]` of `{period, matchesStarted,
  matchesCompleted, completionRate, avgDurationMinutes, avgDurationClocks, comaCount}`
  (`completionRate` null when nothing started); for the whole range `choices[]` `{uuid, count}`,
  `locations[]` `{uuid, count}`, `missions[]` `{uuid, activated, completed, failed}`. Names are
  resolved by react-admin from the story entities it already reads.
- Java core: `SnapshotPort`/`SnapshotService` (write, list, check, restore), `KpiPort`/`KpiService`
  (`record(storyUuid, metric, refUuid, delta)` best effort, `report(...)`), guest cleanup as a
  `GuestAdminService` method `(olderThanDays, withoutMatches)`.

## 4. Roles and Authentication

- New endpoints: `ADMIN` role on the admin port (Java/Python) or the admin API + authorizer (AWS).
  No new player endpoint; the cleanup job and KPI counters run server-side, without a token.
- AWS allow-list: new SAM parameter `AdminIpEmptyMeans` (`nobody` default, `everybody`) → env
  `ADMIN_IP_EMPTY_MEANS` on the authorizer and every Lambda with admin routes; one shared
  `common/http_utils.check_admin_ip` replaces the three private copies. Empty list + `nobody` =
  denied everywhere, dev and test included; the deploy scripts add the caller IP, so the deployer
  keeps access.
- Limits block creation only (`POST /api/auth/guest`, `POST /api/matches`): resume, refresh and
  gameplay are never limited.

## 5. Database Tables

**SQLite / PostgreSQL** — `V0.41.0__snapshots_and_kpi.sql` in both `adapter-*/…/db/migration/v0/`:

- `system_snapshot`: add `clock INTEGER`, `checksum VARCHAR(64)`; index `(id_match, clock)`.
- new `system_kpi_daily`: `id`, `uuid`, `story_uuid VARCHAR(36) NOT NULL`, `day VARCHAR(10) NOT
  NULL` (UTC), `metric VARCHAR(40) NOT NULL`, `ref_uuid VARCHAR(36) NOT NULL DEFAULT ''`,
  `value BIGINT NOT NULL DEFAULT 0`, `ts_insert`, `ts_update`; `UNIQUE (story_uuid, day, metric,
  ref_uuid)`; no FK (decision 12). Increment with `INSERT … ON CONFLICT … DO UPDATE SET value =
  value + :delta` (both engines). Metrics: `MATCH_STARTED`, `MATCH_COMPLETED`, `DURATION_MS`,
  `DURATION_CLOCKS`, `COMA`, `CHOICE`, `LOCATION_VISIT`, `MISSION_ACTIVE`, `MISSION_COMPLETED`,
  `MISSION_FAILED` (the last four with `ref_uuid`).
- index `users(state, ts_last_access)` for the cleanup query.
- `log_events`: no column; new message prefixes `ACTION_PASS`, `TRAIT_ADD`/`TRAIT_REMOVE`,
  `MATCH_*`, `ADMIN_*` (`id_character_match` is already nullable; edge-state messages are
  already written).
- Python: SQLAlchemy models and the `align_schema()` replay.

**DynamoDB** — no GSI or attribute-definition change:

| Entity | PK | SK | Notes |
|--------|----|----|-------|
| Snapshot | `MATCH#<uuid>` | `SNAPSHOT#{clock:06d}#{ts_ms:013d}` | `uuid`, `clock`, `checksum`, `logSk`, gzipped payload `_gz`; deleted with the partition; inherits the Robot `ttl` through `repo._inherit_ttl` |
| KPI day | `KPI#<storyUuid>` | `DAY#YYYY-MM-DD` | flat counters `matchesStarted`, `matchesCompleted`, `durationMsSum`, `durationClocksSum`, `coma`, `c#<choiceUuid>`, `l#<locationUuid>`, `m#<missionUuid>#<STATUS>`; one `UpdateItem ADD` per request with deltas |
| Guest | `USER#<uuid>` | `METADATA` | unchanged; the job reads the `GUEST_LIST` GSI2 partition and asks GSI1 `USER_MATCHES#<uuid>` (`Limit 1`) per candidate |

## 6. Components

### 6.1 Java (reference)

- **A** `TurnCycleService.passTurn` → `ACTION_PASS`; `applyTraits` → `TRAIT_*`;
  `MatchCommandService.createMatch`/`endMatch`, `TurnCycleService.startMatch` → `MATCH_*`;
  `MatchAdminController` actions and `CharacterCommandService.changeStatistics` → `ADMIN_*`.
  `MatchLogsService.assembleTimeline` maps them and the four edge-state messages (with
  `startsWith`: `ALL_PLAYER_COMA` and `COMA_RECOVERED` contain `COMA`, see `EdgeStateStorePort`).
  Admin info adds `logCount`; a WARN log line when a match crosses `game.logs.warn-rows`.
- **B** `SnapshotService.write` at the time-end (decision 3): first line of
  `TimeAdvancementService.advanceTime`, before `incrementMatchClock`, so both the last `sleep`
  and `forceTimeEnd` are covered; the payload is the end of clock N with every character asleep.
  Pruning beyond `game.snapshot.keep-per-match`. On a choice with `flag_end_time`,
  `writeResolutionMarkers` moves before `forceTimeEnd` so the marker is inside the snapshot
  (decision 19). Restore, in one transaction: check; update match and character rows in place
  (their ids are FK targets of the logs); replace the child rows; delete log rows above
  `logMarks`; write `ADMIN_ACTION SNAPSHOT_RESTORED`; then the time-start runs, without a new snapshot (decision 18); set
  `PAUSED`, also for ENDED/GAMEOVER matches (decision 4). New JPA entity/repository for
  `system_snapshot` (`core/entity`, `core/repository`), three routes on `MatchAdminController`.
- **C** New `SecurityHeadersFilter` in `SecurityFilterConfig` (before the JWT filter):
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`,
  `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`,
  `Strict-Transport-Security: max-age=31536000`, and `Cache-Control: no-store` on `/api/auth/**`
  and `/api/admin/**` only (public story reads stay cacheable). `WebConfig`:
  `exposedHeaders("Retry-After")`. Secrets fixes of decision 5 (startup refusal of the default JWT
  secret outside dev/test; Turnstile bypass only on dev/test). Env rule (decision 25): only
  `dev`, `development` and `test` are dev/test, anything else is production; Java reads
  `game.server.env` (set by the profile: `development`, `test`, `production`) instead of
  `game.env` / `APP_ENV`, which no script sets and so reads `dev` even under the prod profile.
- **E** Bug fix first (patch 0.41.0): `UserRepository.deleteExpiredGuests` (used by the
  scheduler and by `DELETE /api/admin/guests/expired`) gets a `NOT EXISTS` guard on the four
  non-cascading tables of §1 findings, so it never fails on PostgreSQL and never orphans rows on
  SQLite; unit test on SQLite and a Robot case on Java + PostgreSQL. Then
  `GuestSessionCleanupScheduler` runs the new cleanup: guests (state 6) whose `ts_last_access`
  is older than `game.admin.auth.guest.cleanup.age-days` (default 60, decision 9) with the same
  guard, tokens first, at most `…cleanup.max-per-run` guests per run (default 500, decision
  37); switch `…cleanup.enabled`. `MatchController`: second bucket
  `match-guest` keyed by the user uuid (`RATE_LIMIT_MATCH_PER_GUEST`, default 10, own window
  `RATE_LIMIT_MATCH_PER_GUEST_WINDOW_SECONDS` = 86400); per-IP defaults 20/hour (decision 11).
- **F** `KpiService.record` from `TurnCycleService.startMatch`, `MatchCommandService.endMatch`
  (completed + durations), `EdgeStateEvaluator` (COMA), the select-choice marker
  (`writeResolutionMarkers`), the first `flag_visited` 0→1 (`LocationEntryStoreAdapter`) and
  `MissionService` transitions; a KPI failure is logged and never fails the action. New
  `KpiAdminController` in `adapter-admin`.
- DTOs and the OpenAPI file of §2.

### 6.2 Python

Mirror of 6.1: `turn_cycle_service.py`, `event_service.py`, `match_command_service.py`,
`match_logs_service.py`, `time_advancement_service.py`, new `snapshot_service.py` and
`kpi_service.py`, admin controllers, a `SecurityHeadersMiddleware` in `_build_app` (both apps),
`expose_headers=["Retry-After"]`; FastAPI `/docs`, `/redoc` and `/openapi.json` only on
dev/test (`docs_url=None` etc. otherwise) and skipped by the headers middleware, so Swagger UI
keeps its CDN assets (decision 34). **Guest fix**: `delete_expired_guests` gets the same
four-table guard as Java; the new cleanup has the same per-run cap. **Snapshot**: written at the top of `time_advancement_service`'s
advance, `_write_resolution_markers` moved before `_force_time_end`, as in Java.
**Scheduler**: new dependency `apscheduler` (`requirements.txt`,
`pyproject.toml`), one `AsyncIOScheduler` started once in the launcher's `_serve()` (not per
app), daily at 00:42 UTC by default. `config.py`: the keys of §6.9; with decision 5,
`cors_allowed_origins` defaults to the Java dev list, `dev_test_endpoints_enabled` to false
outside dev/test, and the launcher refuses to start outside dev/test with the committed JWT
secret, with the env rule of decision 25 on `settings.env` (`ENV`).

### 6.3 AWS

- **A** `_pass_turn` → `PASS`; edge states → an `EDGE_STATE` `LOG#` row beside the existing
  audit; RECOVERY rows at time-start (parity); trait rows in the effect appliers;
  `MATCH_LIFECYCLE` in `_create_match`/`_start_match`/`_end_match`; `ADMIN_ACTION` in the admin
  routes. Admin info exposes `logCount`. `logbook.persist` logs a WARN JSON line when `logCount`
  crosses `LOG_WARN_ROWS` or the METADATA item passes `LOG_WARN_METADATA_KB`.
- **B** Snapshot item built at the start of `_advance_time`, before the clock moves (sleep
  path and `_force_time_end_news`; the choice markers are already set there), saved through
  `repo.save` in the same flush, pruned beyond `SNAPSHOT_KEEP_PER_MATCH`. Restore: check (story
  item, users), overwrite METADATA/`CHARACTER#`/`TURN#`, delete `LOG#`/`AUDIT#` rows above
  `logSk`, run the time-start (decision 18), set `PAUSED`. Three routes in `template/match.yaml` on the admin API.
- **C** `common/response.py` `HEADERS` and the handler-local copies get the Java headers.
  Secrets fixes of decision 5: `AllowMockAccess` default `"false"`; 500 `MISCONFIGURED` when `ENV`
  is not dev/test (decision 25) and the JWT secret is the default; Turnstile bypass only in
  `test_data_ttl.TEST_ENVS`.
- **D** `AdminIpEmptyMeans` in `template.yaml`, passed to the authorizer and to `auth.yaml`,
  `story.yaml`, `match.yaml` (`seed.yaml` routes rely on the authorizer only); the three private
  `_check_admin_ip` removed; `AdminIpWhitelist` description updated.
- **E** `cleanup_expired` skips guests with matches (bug fix, patch 0.41.0). New
  `GuestCleanupFunction` in `template/auth.yaml` with an EventBridge schedule (decision 10; parameter
  `GuestCleanupSchedule`, default `cron(42 0 * * ? *)`), plus `GuestCleanupAgeDays` (default
  60), `GuestCleanupEnabled` and `GuestCleanupMaxPerRun` (default 500: the `GUEST_LIST`
  partition is read page by page and the run stops at the cap, the rest goes the next day,
  decision 37); same code as `DELETE /stale?withoutMatches=true`.
  **Tags** (owner): the function carries the same `Tags` block as `AuthFunction` (`Name`
  `pathsgames-${Environment}-GuestCleanupFunction`, `CostCenter`, `Environment`, `ManagedBy`,
  `Owner`, `Project`, `version`), and so does its `AWS::Logs::LogGroup`; the schedule resource
  is tagged too (decision 22). `sam validate --lint` checks it.
  `security_utils.match_per_guest()` and a `RATELIMIT#match-guest#<userUuid>` bucket in
  `_create_match`.
- **F** `common/kpi.py`: per-request accumulator flushed by one `UpdateItem ADD` after
  `repo.flush()` (failure logged only); hooks in `_start_match`, `_end_match`, the coma
  `EDGE_STATE`, `_resolve_choice`, `logbook._visit` (a new id = first visit) and `missions.py`
  transitions. Report handler in `match/handler.py` (one Query `KPI#<story>` between two `DAY#`
  keys; all stories = one Query per `STORY_LIST` entry); route `GET /api/admin/reports/kpi`.

### 6.4 react-game

- `features/matches/MatchLogCard.jsx`: icon, colour and EN/IT label for `PASS`, `EDGE_STATE`,
  `TRAIT_CHANGE`; `MATCH_LIFECYCLE` and `ADMIN_ACTION` join `HIDDEN_TYPES` (decision 1).
- `features/start-match/StartMatchFlow.jsx` and the guest login: `RATE_LIMITED` shown as a
  translated sentence with the retry time (EN/IT), not the raw code.

### 6.5 react-admin

- `MatchLogsCard.jsx`: `TYPE_META` for the five new types.
- New `SnapshotsCard.jsx` tab in `MatchDetailTabs`: list, "Check" (shows `errors[]`), "Restore"
  behind `ConfirmModal`, match reloaded afterwards; three calls in `matchApi.js`.
- New `pages/ReportsPage.jsx` (route `/reports`, sidebar entry, `reportApi.js`): story selector
  (all / one), date range, group by day/month/total, KPI table, choice/location/mission tables
  (names from `listEntities`), and an "Active matches" panel: `listMatches` with `status`
  `RUNNING` and `PAUSED`, `/info` loaded when a row is opened (location, life, players) — no new
  backend call.
- `GuestsPage.jsx`: "without matches only" toggle on the stale purge.

### 6.6 Robot

New suite `code/tests/robot/tests/41_alpha_prep/` with its own story `story_alpha_prep.json`
(PRIVATE, category `robottest`, imported/deleted by the suite, `rngSeed=42`), as in `40_alpha_ux`:

- `logging_gaps.robot`: pass → `PASS`; coma → `EDGE_STATE`; trait effect → `TRAIT_CHANGE`;
  start/end → `MATCH_LIFECYCLE`; admin pause → `ADMIN_ACTION`; a sleep → RECOVERY rows on every
  backend; `logCount` on admin info.
- `snapshots.robot`: sleep → one snapshot of the clock that just ended; move and run an event → restore →
  location, stats, clock and registry as in the snapshot, later rows gone, `PAUSED`, the ONCE
  event runnable again; `check` valid; delete a referenced location via admin CRUD → `check`
  answers `STORY_ENTITY_MISSING` and restore 409; unknown snapshot 404.
- `guest_cleanup.robot`: a guest without match and one with a match → `GET stale?olderThanDays=0
  &withoutMatches=true` counts only the first → `DELETE` → the first cannot resume, the second
  still plays; `DELETE /api/admin/guests/expired` with an expired guest owning a match answers
  200 and keeps that guest (the PostgreSQL bug fix; run on Java + PostgreSQL too).
- `kpi.robot`: read today's report, play start → choice → move → mission → end, read again and
  assert the deltas; `month`/`total` consistent with `day`; bad `from` or `groupBy` → 400.
- `41_security/security.robot` (existing): headers on public and admin echo; the per-guest limit
  case, SKIP unless `RATE_LIMIT_MATCH_PER_GUEST` is passed (like the two existing limit cases).
- The allow-list cannot change at run time: unit tests cover it, and every admin suite proves
  the deployer IP still passes.
- Existing suites to re-run: `14_admin`, `20_admin_match`, `24_turn_cycle`,
  `28_movement/match_logs*`, `30_edge_states`, `40_alpha_ux` (green on every target on
  September 26, 2026, before this step), `41_security`. Row counts and row types may be changed,
  no test removed, every change listed in the report (decision 24).
- The dev agent runs the local targets (Java, Java + PostgreSQL, Python). The AWS target is
  always run by hand by the owner after the deploy (decision 35): the dev agent keeps
  `run_robot_with_aws_serverless.sh` working (new variables, `bash -n`) without running it.

### 6.7 Scripts and infra

**JWT secret change, one round (decision 32).** Today the `.env` `JWT_SECRET` equals the
committed default, the AWS test deploy passes no `JwtSecret`, Robot's `JwtHelper.py` signs admin
tokens with the default hard-coded (`_DEV_SECRET`, used by `Generate Admin Token` in `14_admin`,
`19_match`, `20_admin_match`, `22_story_validation`, `35_import_integrity`…), and
`ROBOT_VAR_ADMIN_TOKEN` (valid until 2027-09) is signed with it. Patch 0.41.0 therefore:
`JwtHelper.py` reads `JWT_SECRET` from the environment (default kept as fallback); all four
`run_robot_with_*.sh` export `JWT_SECRET`; `aws_backend_deploy.sh` passes
`JwtSecret=${JWT_SECRET}`; new `code/scripts/dev/mint_admin_token.sh` prints a long-lived admin
token signed with the `.env` secret. Then the owner, once, before the first Robot run of
0.41.0: new secret in `.env`, new `ROBOT_VAR_ADMIN_TOKEN`, redeploy of test (and EC2 when
used). Changing the secret earlier breaks today's runs, so it happens in that moment only.

**Owner-run commands (decision 29).** Agents never run `terraform`, `aws`, `sam` or `gh`; at
the end of each patch the dev agent lists, in order, the exact commands for the owner (test
deploy, `terraform apply` for the CSP, production CSP in 0.41.2) and the checks after each one
(browser console on `test.paths.games`, `aws_check_status.sh`). **Owner actions (decision 30)**:
switch on Dependabot security alerts (GitHub repo → Settings → Code security → Dependabot
alerts → Enable); after the first OSV run, read the Security tab. Version bumps (0.41.0 done,
0.41.1, 0.41.2) are the owner's (decision 31).

- `code/scripts/test/aws/aws_backend_deploy.sh`: passes `AdminIpEmptyMeans`
  (`AWS_ADMIN_IP_EMPTY_MEANS_TEST`, default `nobody`), `AllowMockAccess=true` and the new
  parameters; the empty-list warning reads "admin API closed to everybody".
- New `code/scripts/prod/aws_backend_deploy_stage.sh <alpha|beta|prod>` (decision 6): same IP
  detection (shared function), `--config-env <stage>`, every parameter passed explicitly;
  stage keys with suffix `_ALPHA`, `_BETA`, `_PROD` (decision 28, list in §6.9); refuses to
  run when the stage JWT secret is missing or equals the committed default.
- `code/scripts/dev/run_robots/*.sh`: always export every limit variable as `0` before
  starting the local server, overriding `.env` (owner: Robot runs at zero); the Java + PostgreSQL
  run keeps the prod profile (decision 26); the EC2 scripts (`aws_ec2_with_*_docker/start.sh`,
  `redeploy.sh`) pass `RATE_LIMIT_*=${AWS_RATE_LIMIT_*_TEST:-0}` and the local `starter/`
  scripts pass `0`, so stress tests are never limited (decision 40); every
  `run_robot_with_local_java*.sh` exports
  `JWT_SECRET` from `.env` (decision 33; Python reads `.env` by itself); the AWS test deploy
  keeps passing `0` from its `:-0` defaults. `run_robot_with_aws_serverless.sh` warns when the
  current IP is not in the stack allow-list.
- New `.github/workflows/dependency-scan.yml` (decisions 7 and 20): OSV-Scanner over `pom.xml`,
  the Python and Lambda requirement files and the npm lock files; triggers: push on `develop`
  touching a manifest, and a weekly `schedule` (GitHub runs it on the default branch `main`,
  decision 27); SARIF result in the GitHub Security tab; the job fails on a known
  vulnerability, accepted ones listed with a reason in `osv-scanner.toml`.
- New `code/scripts/dev/run_dependency_scan.sh` (decision 36), for the owner to run at will, in
  the style of `run_all_unit_tests.sh` (`--only java,python,aws,react-admin,react-game`, one
  aggregate exit code): OSV-Scanner with the same `osv-scanner.toml` as CI, the only tool
  needed. It first checks that `osv-scanner` is on the `PATH`; if not, it prints the install
  commands (release binary into `~/.local/bin`, or the `ghcr.io/google/osv-scanner` Docker
  image) and stops with exit code 2 (decision 38). Report in
  `code/scripts/dev/dependency_scan_results/` (git-ignored, like `run_robot_results/`); listed
  in `code/scripts/dev/README.md`. Findings are fixed by the owner with an agent later, not in
  this step (decision 39).
- `code/website/terraform-aws/environments/test.tfvars`: `csp_mode = "restricted"` in 0.41.0
  (react-game on `test.paths.games`); `production.tfvars` (static site `paths.games`) in 0.41.2,
  once test shows no CSP error in the browser console (decisions 8 and 21).

### 6.8 Docs (through /doc-update)

`Environments.md` §4 new keys (§2 and §5 already updated with the certificate decision); `Security.md` §3
(allow-list implemented), §4 (per-guest bucket, defaults), a headers section; `DataModel.md`
(`system_kpi_daily`, snapshot columns, `SNAPSHOT#` and `KPI#` items); `Architecture.md` (Python
scheduler, AWS cleanup Lambda); `.claude/docs/robot-suites.md` (`41_alpha_prep`).

### 6.9 Environment keys (owner sets them; agents never edit `.env` / `.env.test`)

| Key | Backends | Code default |
|-----|----------|--------------|
| `GUEST_CLEANUP_ENABLED` | all | `true` |
| `GUEST_CLEANUP_AGE_DAYS` | all | `60` (decision 9) |
| `GUEST_CLEANUP_MAX_PER_RUN` (`GuestCleanupMaxPerRun`) | all | `500` (decision 37) |
| `game.admin.auth.guest.cleanup.cron` / `GUEST_CLEANUP_HOUR`, `_MINUTE` / `GuestCleanupSchedule` | Java / Python / AWS | 00:42 UTC daily |
| `RATE_LIMIT_GUEST_PER_IP`, `RATE_LIMIT_MATCH_PER_IP` (existing) | all | `20` each, window `3600` (was `0`) |
| `RATE_LIMIT_MATCH_PER_GUEST`, `RATE_LIMIT_MATCH_PER_GUEST_WINDOW_SECONDS` | all | `10`, `86400` |
| `SNAPSHOT_KEEP_PER_MATCH` | all | `10` (0 = no snapshots) |
| `LOG_WARN_ROWS`, AWS `LOG_WARN_METADATA_KB` | all | `5000`, `300` |
| `ADMIN_IP_EMPTY_MEANS` (`AdminIpEmptyMeans`) | AWS | `nobody` |
| `AWS_*_TEST` mirrors and the stage keys read by the new script | scripts | — |

`.env.example` files get the keys with their defaults (dev agent). At the end of each patch
the dev agent gives the owner an explicit list "add to `.env`: KEY=value — why" (and the same
for `code/frontend/react-game/.env.test` if touched); expected for the root `.env`:
- `JWT_SECRET=<new random value>` (`openssl rand -base64 48`) and
  `ROBOT_VAR_ADMIN_TOKEN=<output of mint_admin_token.sh>` — after the 0.41.0 development,
  before its Robot runs (decision 32);
- `AWS_ADMIN_IP_EMPTY_MEANS_TEST=nobody` — optional, the script default is `nobody`;
- `AWS_GUEST_CLEANUP_AGE_DAYS_TEST`, `AWS_GUEST_CLEANUP_ENABLED_TEST`,
  `AWS_RATE_LIMIT_MATCH_PER_GUEST_TEST` — optional, script defaults `60`, `true`, `0`;
- the per-stage keys of the new stage script (decisions 23 and 28), needed only to deploy
  alpha/beta/prod, `<S>` = `ALPHA`, `BETA`, `PROD`: `AWS_JWT_SECRET_<S>` (own value per stage),
  `AWS_TURNSTILE_SECRET_KEY_<S>`, `AWS_CUSTOM_DOMAIN_<S>`, `AWS_DOMAIN_CERTIFICATE_ARN_<S>` (today
  the production wildcard in us-east-1), `AWS_DOMAIN_HOSTED_ZONE_<S>`, `AWS_CORS_ORIGINS_<S>`,
  `AWS_ADMIN_IP_WHITELIST_<S>`; the rest stays in `samconfig.toml`; the dev agent confirms the
  final list;
- nothing is needed for local Robot runs: the scripts force the limits to `0`.
Existing `RATE_LIMIT_*` values in `.env` are then ignored by the Robot scripts; any other
local server started by hand gets the new non-zero defaults unless `.env` sets them.

## 7. Tests

- **Java** (JaCoCo > 96% of new code): `SnapshotServiceTest` (write, prune, every check code,
  restore, log cut), `KpiServiceTest` (record, upsert, day/month/total, null completion rate,
  averages), cleanup (age, match guard on both jobs), per-guest bucket, `SecurityHeadersFilterTest`,
  secret refusal, Turnstile env guard, timeline mapping of the new types, controllers.
- **Python**: pytest mirrors in `test_step41_alpha_prep.py` (the v0.37.7 `test_step41_security.py`
  stays), scheduler registered once and off when disabled.
- **AWS**: `test_step41_alpha_prep.py` (snapshot item, restore, `LOG#` cut, one KPI `UpdateItem`
  per request, cleanup Lambda with the GSI1 check, per-guest bucket); `test_authorizer_handler.py`
  and `test_auth_handler_admin.py` (empty list × nobody/everybody, list × IP in/out); headers on
  `response.ok`/`err`.
- **react-game** / **react-admin** (vitest): new log types and hidden types, `RATE_LIMITED`
  message, `SnapshotsCard`, `ReportsPage` (grouping, empty data, lazy active-match info),
  `GuestsPage` toggle.
- **Robot**: §6.6 on local Java, Java + PostgreSQL, Python and AWS.

## 8. Doubts

### 8.1 Decisions (owner, September 27, 2026)

1. **New timeline rows**: `PASS`, `EDGE_STATE`, `TRAIT_CHANGE`, `MATCH_LIFECYCLE`, `ADMIN_ACTION`; the last two hidden in react-game, shown in react-admin.
2. **Log size**: check only (admin `logCount` plus a WARN line), no hard cap.
3. **Snapshot moment**: one LIGHT snapshot at every **time-end**, before the clock moves; last 10 kept per match (`SNAPSHOT_KEEP_PER_MATCH`, 0 = off).
4. **Restore**: deletes the log rows written after the snapshot and leaves the match `PAUSED`, ENDED/GAMEOVER matches included.
5. **Secrets fixes**: all of them (`AllowMockAccess` default `false`, committed JWT secret refused outside dev/test, Turnstile bypass only on dev/test, Python CORS not `*`, Python dev endpoints off outside dev/test).
6. **Stage deploy script**: written now, in this step.
7. **Dependency scan**: a CI job, not a one-off run.
8. **Website CSP**: `restricted` on test (explained in §1 findings C).
9. **Guest cleanup age**: from the last access, parametric, default **60 days**, daily at 00:42 UTC.
10. **AWS cleanup**: EventBridge-scheduled Lambda, tagged like every other resource.
11. **Per-guest limit**: matches per guest per day (default 10); non-zero code defaults; Robot always at 0.
12. **KPI storage**: counters at event time, no FK.
13. **KPI definitions**: as proposed (started = start, completed = story end without admin stop, duration in minutes and clocks, first visit per match, every mission transition).
14. **Test certificate**: not done in this step. Removed from the V0 roadmap, added to V1 step 41; certificates stay as they are, documented in [Environments](../Environments.md) §2 and §5.
15. **Patches**: 0.41.0 security, allow-list, guests (expired-guest bug fix, CI job, test CSP); 0.41.1 logging, snapshots; 0.41.2 KPI, production CSP.
16. **Restore now**: snapshot restore is needed in this step, not later.
17. **`.env` keys**: the dev agent lists exactly what to add (§6.9); Robot scripts force every limit to 0.
18. **After a restore**: the time-start runs at once (clock N+1, weather and random event rolled again, no new snapshot), then `PAUSED`; the existing admin resume (`POST /api/admin/matches/{uuid}/resume`, react-admin match page) puts it back to `RUNNING`.
19. **Choice marker**: on Java and Python `writeResolutionMarkers` moves before the forced time-end, as on AWS.
20. **CI triggers**: push on `develop` and a weekly schedule; no manual trigger.
21. **Production CSP**: the static site `paths.games` goes `restricted` in 0.41.2, after test is clean.
22. **Schedule tags**: verified with `sam validate --lint`; if the `Schedule` event cannot carry tags, `ScheduleV2` in a tagged `AWS::Scheduler::ScheduleGroup`.
23. **Stage keys**: `aws_backend_deploy_stage.sh` reads per-stage keys from `.env`, suffix per stage (decision 28), one JWT secret per stage; the dev agent lists them all.
24. **Existing Robot suites**: the dev agent may change row counts and row types in existing suites, never remove a test; every change listed in its report.

25. **Env rule**: on all three backends only `dev`, `development` and `test` count as dev/test, anything else (prod, production, alpha, beta, unknown) as production; Java reads `game.server.env` set by the profile.
26. **Local Robot on Java + PostgreSQL**: stays production-like (prod profile) and uses the `JWT_SECRET` of `.env` (decisions 32-33).
27. **Weekly scan**: runs on `main` (GitHub schedules only the default branch); `develop` is covered by the push trigger.
28. **Stage suffix**: `_ALPHA`, `_BETA`, `_PROD`.
29. **Commands**: the owner runs every `terraform`, `aws`, `sam` and `gh` command; the dev agent never does, and lists them after development (§6.7).
30. **Owner actions**: the dev agent lists them (Dependabot alerts, §6.7).
31. **Version bumps**: done by the owner (0.41.0 already), never by an agent.

32. **JWT secret of test**: changed in one round with 0.41.0 (§6.7): the dev agent prepares scripts, `JwtHelper.py` and the mint helper, then the owner sets the new secret and token and redeploys test, before the first Robot run; the final report reminds it.
33. **Robot scripts**: every `run_robot_with_local_java*.sh` exports `JWT_SECRET` from `.env`.
34. **Python docs**: `/docs`, `/redoc` and `/openapi.json` only on dev/test, without the CSP header.
35. **Robot on AWS**: always run by hand by the owner; the dev agent keeps `run_robot_with_aws_serverless.sh` working and never runs it.
36. **Dependency scan script**: `code/scripts/dev/run_dependency_scan.sh`, run by the owner whenever wanted (§6.7).
37. **Cleanup cap**: `GUEST_CLEANUP_MAX_PER_RUN`, default 500, on all three backends.

38. **Scan tools**: the script checks `osv-scanner`, prints the install commands and stops when it is missing; OSV is the only tool (same as CI).
39. **Vulnerability fixes**: done later by the owner with an agent, not in this step.
40. **Limits on EC2 and starter scripts**: `0`, so stress tests are never limited.

41. **JWT in one round**: plan of §6.7 confirmed; the dev agent's final report of 0.41.0 opens with the owner's JWT steps (new `JWT_SECRET`, `mint_admin_token.sh` → `ROBOT_VAR_ADMIN_TOKEN`, test redeploy), before any Robot run.

42. **Development order**: the dev agent develops 0.41.0 and runs the unit tests, stops before the Robot runs and asks the owner for the JWT steps (decision 41), then runs the three local Robot targets.
43. **Local tools and the secret**: the `starter/` scripts and `code/tests/stress/run_stress.sh` / `cleanup.sh` read `JWT_SECRET` from `.env`, so every local tool signs with the same secret.
44. **KPI after a restore**: counters are not rolled back; a restored match that ends again counts again; the Reports page help text says so.

### 8.2 Open points

None: the analysis is closed and the step is ready for development (three patches, decision 15).

# Version Control
- **Document Version**: 0.41.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.40.0 | First analysis of the alpha preparation step, owner answers | September 27, 2026 |
  | 0.41.0 | Owner decisions completed, last open points listed | September 27, 2026 |

- **Last Updated**: September 27, 2026 (v0.41.0)
- **Status**: Analysis closed, 44 decisions (§8.1); ready for development

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
