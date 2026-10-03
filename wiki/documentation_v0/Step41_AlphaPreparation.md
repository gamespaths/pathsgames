# Step 41 — Alpha preparation

**Status: patches 0.41.0-0.41.2 DEVELOPED; patch 0.41.4 (H, match export/import, neutral format, §9) DEVELOPED on October 1, 2026 (H1-H4, unit tests green; Robot suite written, waiting for the owner's runs and the golden exports of decision 66). Shipped (v0.41.0, v0.41.1, v0.41.2, September 29,
2026): security (C), AWS admin allow-list (D), guest cleanup/limits (E), logging gaps (A),
match snapshots (B), KPI report (F) and the production website CSP switch. Unit tests and
Robot green on all four targets (AWS, Java, Java+PostgreSQL, Python — 814 Robot tests).**
Roadmap line: *logging and snapshots, security, admin IP protection, guest cleanup and limits,
KPI report* ([Roadmap](./Roadmap.md) step 41; the test certificate moved to V1 step 41). Touches the three backends,
react-admin (guest-list toggle, Reports page), react-game (rate-limit message, CSP-safe consent script),
scripts, a CI workflow, Terraform, docs.

## Development notes 0.41.0

Unit tests green (Java 1259, Python 1836, AWS 1202, react-admin 872, react-game 1487); Robot
green on AWS, Java, Java+PostgreSQL, Python on September 28, 2026 (791 tests, 0 failed, skips
are the rate-limit cases that need an explicit variable). Deltas against §6 below, found during
development:

- **Migration naming.** `V0.41.0__guest_cleanup_index.sql` (postgres + sqlite) only adds the
  `users(state, ts_last_access)` index — `system_snapshot`/`system_kpi_daily` were not touched
  in this patch. Flyway version `V0.41.0` is now taken, so §5's `V0.41.0__snapshots_and_kpi.sql`
  must NOT be used: 0.41.1 uses `V0.41.1__snapshots.sql`, 0.41.2 uses `V0.41.2__kpi.sql`.
- **Python guest guard.** `delete_expired_guests` (and the new idle cleanup) guard only the two
  tables Python actually persists (`gaming_match.id_user_creator`,
  `gaming_character_instance.id_user` — Python has no `gaming_user_sessions`/`chat_messages`
  tables); tokens are deleted first, then the guests, in chunks. The new index is on
  `users(state, last_access)` — Python's column is `last_access`, not `ts_last_access`.
  Java's `GuestBatchDelete` chunks both the four-table guard and the delete at 500 ids.
- **AWS schedule.** `GuestCleanupFunction` (`template/auth.yaml`) uses `ScheduleV2` inside a
  tagged `AWS::Scheduler::ScheduleGroup` rather than a plain `Schedule` event, because a plain
  `Schedule` event cannot carry its own tags (decision 22's fallback).
- **Dev-only header.** `X-Test-Guest-Age-Days: N` (1–3650) on `POST /api/auth/guest` "ages" a
  fresh guest for Robot's cleanup tests; honoured only alongside a valid `X-Test-Marker` and
  only where that marker is already honoured (Java/Python `test-endpoints-enabled`, AWS `ENV`
  in `TEST_ENVS`); out-of-range values are ignored.
- **Java daily job scope.** `GuestSessionCleanupScheduler` (00:42 UTC) now runs *only* the new
  idle-guest cleanup; the pre-existing expired-guest bug fix runs through
  `UserRepository.findExpiredGuestIdsWithoutReferences` + `GuestBatchDelete`, called by both the
  scheduler's old path and `DELETE /api/admin/guests/expired`, not as a second scheduled job.
- **AWS JWT reach.** `JwtSecret` is now passed to the Story and Seed nested stacks too
  (`template/story.yaml`, `template/seed.yaml`), not only Auth/Match/authorizer — otherwise the
  admin story/seed routes would 401 after the JWT rotation.
- **Rate-limit window storage.** `RateLimitService` (all three backends) now stores the window
  start per counter instead of a single shared window, so the periodic sweep no longer resets
  every bucket's clock to the same moment.
- **CSP fixes shipped with 0.41.0** (owner approval, September 27): the inline consent script
  moved to `public/consent-defaults.js` (react-game), and `test.tfvars`'
  `csp_extra_domains` gained `img = ["unsplash.com"]` and `frame = ["challenges.cloudflare.com"]`
  so `csp_mode = "restricted"` on test does not break the Unsplash location art or the Turnstile
  iframe; `cloudfront.tf` only emits a `frame-src` directive when that list is non-empty.
- Two Java security-service unit-test files were added under `core/src/test/java/games/paths/core/port/auth/` alongside the guest-cleanup fixture changes; not otherwise part of the design surface above.

The next two patches (owner decisions 15, 16, 21): **0.41.1** — logging gaps (A) and match
snapshots (B), its own `system_snapshot`/migration; **0.41.2** — KPI report (F) and the
production website CSP switch to `restricted` (§6.7).

## Development notes 0.41.1

Unit tests green (Java 1312, Python 1908, AWS 1232, react-admin 887, react-game 1491); Robot
green on all four targets (AWS, Java, Java+PostgreSQL, Python), 808 tests, 0 failed. Deltas
against §2/§3/§6 below, found during development:

- **AWS log cut by seq, not `logSk`.** §6.3 describes the restore cut as "delete `LOG#`/`AUDIT#`
  rows above `logSk`"; the shipped code compares the stored `logSeq` integer instead — `logSk`
  is a composite sort key (`ts_ms#seq`) and a later request can get an earlier timestamp under
  clock skew, so the numeric sequence is the only monotonic field. `logSeq` is never lowered by
  a restore, so a second restore to an earlier snapshot still cuts correctly.
- **Restore deletes later snapshots too**, on all three backends (not only the log rows above
  the mark): restoring to clock N removes every `SNAPSHOT#` row/`system_snapshot` record with a
  higher clock, so the pruning window (`SNAPSHOT_KEEP_PER_MATCH`) stays meaningful after a
  restore instead of counting branches that no longer exist.
- **Python snapshot payload has no active-choices section.** Python never persisted
  `gaming_active_choices` as a distinct table (choices live inside the character/registry rows
  it does keep), so its payload omits the `activeChoices` block Java/AWS write; restore rebuilds
  the same match state without it, confirmed by the parity Robot cases.
- **`logCount` semantics differ per backend.** Java/Python count all `log_*` table rows for the
  match (every audit table, not only the ones the timeline renders); AWS counts the timeline
  total already exposed by `logbook` (`LOG#` rows), because `AUDIT#` items are not
  individually addressable. Admins comparing the number across backends should expect Java/Python
  to read higher for the same match.
- **AWS may write two `AUDIT#` rows per time-end request.** One `_advance_time` call can now
  produce both an `EDGE_STATE` audit entry (coma/overflow) and the pre-existing time-end audit
  entry in the same request when a character crosses into coma exactly at time-end; both share
  the request's timestamp prefix but get distinct sequence numbers.
- **Java snapshot store uses `JdbcTemplate`**, not a JPA entity/repository as §3/§6.1 said: the
  `jsonb_data` column and the restore's bulk child-row replace read more naturally as hand-written
  SQL than as a mapped entity graph; `SnapshotService` still sits behind `SnapshotPort` like every
  other port.

## Development notes 0.41.2

Unit tests green (Java 1329, Python 1947, AWS 1249, react-admin 899, react-game 1491); Robot
green on AWS, Java, Java+PostgreSQL, Python on September 29, 2026 (814 tests, 0 failed).
Production CSP (`paths.games/?stay`) checked by the owner in the browser after `terraform
apply`. Deltas against §2/§3/§5/§6 below, found during development:

- **First visit reads the `flag_visited` transition, not a logbook helper.** §6.3 said
  `LOCATION_VISIT` hooks `logbook._visit`; the shipped code counts a `LOCATION_VISIT` KPI on the
  same 0→1 `flag_visited` edge that `LocationEntryStoreAdapter`/`_event_location` already gate on
  Java/Python/AWS — the start location, seeded `flag_visited=1`, is never counted, on all three
  backends alike.
- **`gaming_match.timestamp_start`** (AWS `timestampStartMs`) is a new column/attribute stamped
  when a match moves to `RUNNING`, used only for `avgDurationMinutes`/`avgDurationClocks`; a
  match created before this patch has no value, so its duration falls back to the row's creation
  timestamp — durations for those older matches are therefore approximate.
- **AWS "all stories" scope differs from Java/Python.** With no `storyUuid`, AWS sums one Query
  per entry of the `STORY_LIST` GSI2 partition, so a deleted story's counters drop out of the
  total; Java/Python sum every `system_kpi_daily` row regardless of whether `list_stories` still
  has that uuid, so counters of a deleted story keep counting there. The Reports page help text
  does not call this out; flagged, not fixed.
- **Mission counting**: `MissionService`/`missions.py` write `MISSION_ACTIVE`/`_COMPLETED`/
  `_FAILED` once per transition only; `AVAILABLE` is never counted (matches §1 finding F); a
  mission with no steps skips `ACTIVE` and goes straight to `MISSION_COMPLETED`.
- **Production CSP extras beyond §8.1 decision 21's plan**: `production.tfvars` needed
  `connect = ["cdn.jsdelivr.net"]` (Bootstrap's source-map fetch, harmless but logged by the
  browser as a CSP violation without it) and `img = ["unsplash.com"]` (the landing page hero),
  the same two additions `test.tfvars` already carried for react-game's location art; the static
  site itself (`code/website/html/`) has no inline scripts, so no other change was needed there.
- KPI counters are best effort (a write failure is logged, never fails the action) and are not
  rolled back by a snapshot restore (§8.1 decision 44): a restored match that reaches the end a
  second time counts a second `MATCH_COMPLETED`/duration/etc.; an admin stop never counts. The
  Reports page help text says so.

## Development notes 0.41.4

Unit tests green (Java 3068, Python 1990, AWS 1271, react-admin 914; before: 3008, 1947, 1249, 899);
line coverage of the new code: Java 98.4%, Python 99.6%, AWS 99%, react-admin 100% of the new page and
card. Robot suite `41_alpha_prep/match_export_import.robot` written, not run (decision 65). Deltas against
§9 below, found during development:

- **Canonical escapes.** `\b \t \n \f \r` use the short forms (what JCS and `json.dumps` write), other
  control characters `\u00xx`; a float (only possible inside `story.data`) is written as Python's repr on
  all three backends. Schema integers are strict (`1.0` is not an integer). Eight shared vectors.
- **Fingerprint and story id.** The projection also drops the root `id` (the server's `list_stories` id),
  so one story imported on two servers can be `SAME`; the importer strips that root id before the story
  import, the target assigns its own.
- **Template ids in the story export.** Java's admin CRUD map of a character template had no `id` and AWS
  numbered templates by position, so the react-admin export lost template ids: Java now adds `id`
  (= `id_tipo`), AWS `list_entities` uses `id_tipo`, the Python exporter and react-admin
  (`utils/storyJson.exportEntity`, shared with `StoriesPage`) copy `idTipo` into `id`.
- **Neutral model as maps.** Java builds the document as maps (no records) with `NeutralColumnCodec`;
  the schema check is a small validator of the keywords the schema uses, on all three backends, reading a
  bundled copy of `match-export-v1.schema.json` (a unit test per backend asserts it equals the OpenAPI
  one); Robot validates with `jsonschema` (added to `requirements.txt`).
- **One transaction for real.** Java/Python insert the new users and run the `replace` delete inside the
  same transaction/session as the match rows (`MatchExportStorePort.insertImported` / `insert_imported`),
  so a failing insert leaves nothing; the full delete clears every `id_match` table (no
  `MatchCommandPort.forceDeleteMatch`). Proven on SQLite with a real transaction proxy.
- **AWS limits.** No username index: users are `NEW`, `EXISTING` or `MAPPED_BY_EMAIL`, never `RENAMED`.
  No character index: `CHARACTER_EXISTS` is Java/Python only. `storyMode=REPLACE` keeps the story's
  matches (`matchesDeleted` 0, warning kept), accepted by the owner (decision 57). `OTHER` entries are
  stored as `AUDIT#` rows `kind=OTHER` and exported back. The story import body stays in
  `story/handler.py` as `import_story_data`; `story/importer.py` is the facade both functions call.
  New env `APP_VERSION` (`!Ref Version`) next to `MATCH_EXPORT_MAX_BYTES`.
- **Email.** Carried on all three backends (decision 56): Java `email_address`, Python gains
  `users.email_address` with `idx_users_email` (model plus `align_schema`), AWS the `USER#` attribute
  `email`; new users are written with it. Python has no seed users, nothing to align.
- **User resolution (decision 54 revised).** uuid on the target → `EXISTING`; else same e-mail,
  case-insensitive → `MAPPED_BY_EMAIL` (warning `USER_MAPPED_BY_EMAIL`, target user unchanged, creator,
  characters and the decision-60 pause use the target uuid); else Java/Python rename, AWS `NEW`. The
  dry-run users carry `targetUuid`. AWS has no e-mail index: `db_utils.find_user_by_email` is a
  paginated Scan, run only when the uuid is unknown and the file has an e-mail.
- **Names and helpers.** `source.server` is the server env (`game.server.env`, `settings.env`, `ENV`), no
  new key. `SnapshotService.writeNow` / `write_now` and AWS `write_at_time_end(force=True)` write the
  "Imported at clock N" snapshot even with `SNAPSHOT_KEEP_PER_MATCH=0` (prune only when > 0).
  `MatchImportResponse` also carries `warnings[]`. Java/Python admin import refuses a raw body above
  2 × cap + 4 KB before parsing (413); the precise cap is the canonical size of `export`.
- **Reconciliation and warnings.** Extra markers are written with the prefix `IMPORTED_UNCOUNTED`;
  `ACTIVE_CHOICES_IGNORED` is never emitted (nothing exported). AWS writes `engine` as it is and emits
  neither `MARKERS_RECONCILED` nor `VISITED_LOCATIONS_DIFFER`.
- **"Latest" snapshot** is the newest `SNAPSHOT` row, an "Imported at clock N" one included.
- **Robot.** The fixture story has no items, so case 6 does not exercise the inventory. The fixture's
  creator is mapped to a fresh robot guest (so the suite can play the imported match); the copied
  tokenless guest is a second user. The target's family for the `CROSS_FAMILY` expectation is read off a
  probe export in Suite Setup. react-admin: "Import match" sits after Reports in the menu, an Import
  button on the Matches page, Export in the Snapshots card header (confirm, 409 errors listed).

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
| H | Match export and import between servers (patch 0.41.4, analysed, not developed) | backend, frontend | Admin exports the latest time-end snapshot, logs, users and story as one neutral JSON file (source rolled back and restarted) and imports it on any backend: dry-run, story modes, user copy, restart; see §9 |

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

**SQLite / PostgreSQL** — in both `adapter-*/…/db/migration/v0/` (0.41.0 took `V0.41.0` for the
guest index: snapshot columns go in `V0.41.1__snapshots.sql`, `system_kpi_daily` in `V0.41.2__kpi.sql`):

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

Patches 0.41.0-0.41.2 (A-F): none, analysis closed and developed (decision 15). Patch 0.41.4 (H): owner decisions 45-53 (§8.3) applied; §9 re-analysed for option B on October 1, 2026; owner decisions 54-66 taken (§8.4), ready for development.

### 8.3 Decisions — sub-point H (owner, October 1, 2026)

45. **Export moment:** always the latest time-end snapshot. The source match is paused, the snapshot is exported, then the source is restored to that snapshot and restarts; the destination restarts from the same point.
46. **Backend families:** option B — a neutral "match export v1" format; every export can be imported on any backend (Java, Python, AWS). §9 H.2-H.8 must be re-analysed (they describe option A).
47. **Story:** bundled in the export file (story export is needed now, not only in V1 step 17).
48. **Import rollback point:** the "Imported at clock N" LIGHT snapshot is written together with the restart of the match on the destination.
49. **Users:** the export copies the match users, guests included; a user already present on the destination is left as it is. Google SSO users log in again; their reconciliation is planned in V1 step 3.
50. **Uuid conflict:** 409 `MATCH_EXISTS` by default; `replace=true` deletes and re-imports.
51. **Java SQLite ↔ PostgreSQL:** as proposed (one family, proven by a test; if casts fail, same engine only).
52. **Size cap:** large exports out of scope; analysis added to V1 step 41.
53. **Patch number:** 0.41.4 (0.41.3 already used for the Sonar and ARM64 fixes); version bumped on October 1, 2026, by the agent with owner permission.

### 8.4 Decisions — sub-point H option B (owner, October 1, 2026)

54. **Same username, different uuid:** revised — a user with the same e-mail (case-insensitive) is `MAPPED_BY_EMAIL` onto it (`USER_MAPPED_BY_EMAIL`), else `<username>_<first 6 chars of uuid>`, `USERNAME_RENAMED`.
55. **Copied guests without token:** as proposed — accepted, the import page says so.
56. **Email:** revised — `emailAddress` carried and written on all three backends (Python column added, AWS `email`), never `googleIdSso`, password or tokens.
57. **Story present but different:** as proposed — 409 `STORY_DIFFERS`, `storyMode=KEEP|REPLACE`, dry-run counts the matches REPLACE deletes.
58. **Source not RUNNING:** as proposed — `PAUSED` restored and stays `PAUSED`; `ENDED`/`GAMEOVER` untouched; `CREATED` or no snapshot → 409 `NO_SNAPSHOT`.
59. **Destination status:** as proposed — `RUNNING`, optional `startPaused=true`.
60. **Second active match on the target:** the import is allowed; the user's previous `CREATED`/`RUNNING` matches on that story are set to `PAUSED` (warning `USER_HAS_ACTIVE_MATCH` in the dry-run lists them).
61. **Size cap:** as proposed — `MATCH_EXPORT_MAX_BYTES` default `5000000`, 413.
62. **Story export:** story export stays admin-only — the react-admin page (existing client export, kept working with the bundled-story format) plus the internal exporter used by the match export; no export in react-game nor in the public API.
63. **Cross-family time-start:** as proposed — accepted, warning `CROSS_FAMILY`.
64. **Marker reconciliation:** as proposed — accepted, warning `MARKERS_RECONCILED`.
65. **Delivery:** H1-H4 all in 0.41.4; the dev agent stops after H4 for the owner's Robot runs.
66. **Golden exports:** as proposed — the owner produces and commits them after H4; the matrix test skips until then.

## 9. Sub-point H — Match export and import between servers (patch 0.41.4, option B)

Re-analysed against the code on October 1, 2026, after the owner decisions 45-53 (§8.3), which
are binding: neutral "match export v1" format (46), latest time-end snapshot with the source
restored and restarted (45), story bundled (47), "Imported at clock N" snapshot with the restart
(48), users copied (49), 409 `MATCH_EXISTS` / `replace` (50), SQLite ↔ PostgreSQL proven by a test
(51), large exports out of scope (52), patch 0.41.4 (53). Not developed yet; decisions in §8.4.
(The letter H avoids the clash with the Tests row G of §1.)

### H.1 Scope

**Goal.** An admin exports a match from server S as one JSON file and imports it on server T,
whatever the two backends are (Java on SQLite or PostgreSQL, Python, AWS). The file carries the
latest time-end snapshot of the match in a backend-neutral form, its logs up to that snapshot,
the derived engine state, the users and the story. S is rolled back to that snapshot and restarts;
T restarts from the same point. Use cases: move alpha matches between stages and families
(test → alpha, AWS → local Java), reproduce a player's bug locally.

**In scope:** neutral model v1 and its JSON Schema; canonical JSON + SHA-256 shared by the three
backends; a server-side story exporter (internal) and a story fingerprint; the export endpoint
(pause → latest snapshot → file → restore → restart); the import endpoint (dry-run, story
handling, user copy, uuid conflict, state + logs + engine state, "Imported at clock N" snapshot,
time-start, restart); `ADMIN_ACTION` rows; react-admin export button and import page; OpenAPI;
unit tests; a Robot suite with a cross-family strategy (§H.8).

**Out of scope:** exports above the size cap and any S3 hand-off (V1 step 41,
`documentation_v1/Roadmap.md` l.261); a public story-export endpoint (V1 step 17, doubt 62);
copying passwords, refresh tokens, guest tokens or the Google id (decision 49); Google identity
linking of copied users (V1 step 3, `documentation_v1/Roadmap.md` l.41); copying the snapshot
history or the KPI counters; a manual "snapshot now"; full system backup (V3 step 21).

**Sub-patches** — all inside version 0.41.4 (no bump between them); each ends with the unit tests
of the three backends green; the dev agent stops after H4 for the owner's Robot runs (doubt 65):

| # | Content | Components |
|---|---|---|
| H1 | Neutral model v1, JSON Schema, canonical JSON + checksum with shared test vectors, story exporter + fingerprint, native ↔ neutral codecs (read side) | Java, Python, AWS |
| H2 | Export endpoint: pause, latest snapshot, file, restore, restart; `ADMIN_EXPORTED` row | Java, Python, AWS, OpenAPI |
| H3 | Import endpoint: dry-run, story modes, users, `replace`, state + logs + engine rebuild, imported snapshot, time-start, restart | Java, Python, AWS, OpenAPI |
| H4 | react-admin (export button, import page), Robot suite + fixtures + helper, list of docs for `/doc-update` | react-admin, Robot |

**Findings (code is the truth):**

- **Java snapshot** (`SnapshotService.java` l.103-115, `SnapshotStoreAdapter.java` l.42-44,
  l.109-115, l.135-142): raw `SELECT *` rows of `gaming_match`, `gaming_character_instance` and
  8 `CHILD_TABLES`, server-local numeric ids (`id`, `id_match`, `id_story`, `id_user`,
  `id_user_creator`), `logMarks` = `MAX(id)` per `LogTable` (`LogTable.java` l.7-13). Dialect
  shapes differ: `is_sleeping`/`is_coma` are `BOOLEAN` on PostgreSQL (`V0.10.6` l.59-60) and
  `INTEGER` on SQLite; `flag_already_actived` fixed by `V0.19.2`; timestamps are `VARCHAR(50)`
  on PostgreSQL since `V0.19.1`/`V0.26.1`; `log_item_usage.effects_json` is `JSONB` on PostgreSQL.
- **Python** mirrors Java but has **no `gaming_active_choices`** (`snapshot_store_adapter.py`
  l.22-26) and **different log column names**: `log_events` costs are `energy_cost`…`coin_cost`
  (`models.py` l.230-233; Java `energy`…`coin`), `log_movements` has `energy_cost`…`coin_cost` +
  `timestamp_start` (`models.py` l.299-314; Java has `energy`…`coin` and only `ts_insert`). A raw
  Java row is therefore not a Python row: option A was not portable even Java ↔ Python.
- **`gaming_active_choices` is never written by Java**: no entity or repository, only the snapshot
  copies it (`SnapshotStoreAdapter.java` l.42, `SnapshotService.java` l.64-65). Open choice
  cycles live in the log markers (below), so the neutral model has no active-choices section.
- **Character ids are match-local ordinals** on every backend: Java `countCharactersByMatchId + 1`
  (`CharacterCommandService.java` l.133, PK `(id, id_match)`), AWS `"id": len(existing) + 1`
  (`handler.py` l.1190). The ordinal is the tie-break of the turn priority (`_turn_priority`,
  `handler.py` l.1574-1577; same formula on Java) and is what registry rows store in
  `id_character` / `idCharacter`, so it is portable and kept.
- **Child-row ids are per match** (`max + 1` per match: `EventExecutionStoreAdapter.java` l.426,
  l.469, l.671; `RegistryStoreAdapter.java` l.89-181); **log ids are global** (`UNIQUE(id)`,
  `LogIdAdapter.java` l.36-41, Python `log_ids.next_log_id`). Every `uuid` column is `UNIQUE`
  across matches on Java/Python, so child-row and log uuids cannot be reused when a copy lands on
  the same server.
- **Derived state, Java/Python:** ONCE gating = `log_events` rows whose message starts with
  `EVENT_EXECUTED` (`EventExecutionStoreAdapter.java` l.338-347; Python `event_store_adapter.py`
  l.221-227); a choice cycle is open while `EVENT_EXECUTED` rows of the event outnumber
  `CHOICE_SELECTED` rows (`countLogMarkers` l.583-593, `EventExecutionStorePort.java` l.40-52;
  Python l.455); visited locations = character locations ∪ `log_movements` from/to
  (`MovementStoreAdapter.java` l.192-209), used by the fog of war (`MovementService.java`
  l.216-219) and by the event news (`EventExecutionService.java` l.1438).
- **Derived state, AWS:** `executedEventIds`, `eventMarkers {id: {executed, selected}}` and
  `visitedLocationIds` on `METADATA`, updated by `logbook.append`/`audit` (`logbook.py` l.46-101)
  and read by `consumed_event_ids` / `marker_count` / `visited_location_ids` (l.167-188).
  `LOG#` rows are timeline-shaped history; `AUDIT#` rows (`EDGE_STATE`, `CHOICE_SELECTED`,
  `CHOICE_HISTORY`, `STORY_PROGRESS`, `handler.py` l.2789, l.3835-3846) are never read back
  (only the restore deletes them, `snapshots.py` l.239-244). Every `EVENT` timeline row is written
  with `executed=True` and every choice adds one `CHOICE` row and one `CHOICE_SELECTED` audit row,
  so for matches newer than v0.37.5 the timeline counts equal the markers.
- **AWS shapes** (`handler.py` l.885-914 create, l.1186-1218 join, l.1631-1653 start;
  `inventory.py` l.4-5; `registry.py` l.276-345; `_location_state` l.4350-4358): registry,
  sparse location states and party location on `METADATA`; items, `traitUuids`, `food`/`magic`/
  `coin`, `exp`, `characteristics` (list) on `CHARACTER#<uuid>`; queue on `TURN#<uuid>`; class,
  template, traits and loadout by **story uuid**, difficulty by `difficultyUuid`; location-state
  uuid = `uuid5(match, location)`. GSI keys: `GSI1_PK=USER_MATCHES#<creator>`, `GSI1_SK`,
  `GSI2_PK=MATCH`, `GSI2_SK` (l.908-914); robot ttl from the match name (l.917-919).
- **Timeline mapping, Java** (`MatchLogsService.java` l.198-298 and `step41Entry` l.302-330): the
  type of a `log_events` row comes from its message prefix (`ACTION_SLEEP`, `EVENT_EXECUTED`,
  `CHOICE_SELECTED`, `counter`, `automatic event`, `random event`, `REGISTRY_CHANGE`,
  `MISSION_CHANGE`, `EXP_USE`, `recovery`, `ACTION_PASS`, edge-state word, `TRAIT_ADD/REMOVE`,
  `MATCH_`, `ADMIN_`); the other five log tables map one table to one type. `log_choices_executed`
  is not on the timeline. Python mirrors it (`match_logs_service.py` l.354).
- **RNG:** weather and random event are deterministic per `(rngSeed, clock)` (`handler.py`
  l.2083-2086, `random_events.py` l.72-75; Java/Python the same rule) but each family uses its own
  generator (`java.util.Random`, Python `random.Random`), so a time-start can differ across
  families (doubt 63).
- **Story export today** is client-side only: react-admin `StoriesPage.jsx` l.76-135 reads
  `GET /api/admin/stories/{uuid}` plus the 22 `GET /api/admin/stories/{uuid}/{entityType}` lists,
  drops `tsInsert`/`tsUpdate`/`idStory`, fixes the text ids and applies `stripNulls`
  (`utils/storyJson.js`). No backend has a story-export endpoint; `POST /api/admin/stories/catalog`
  only writes the public catalog. The admin CRUD lists exist on all three backends
  (`StoryCrudPort.listEntities` l.26, Python `story_crud_service.list_entities` l.45, AWS
  `story/handler.list_entities` l.1257 + `_normalize_entity_output` l.1166).
- **Story re-import differs by backend:** Java deletes every match of the story
  (`StoryImportService.java` l.58-60 → `StoryPersistenceAdapter.java` l.124), Python too
  (`story_persistence_adapter.py` l.154-163); AWS deletes only the `STORY#` partition
  (`story/handler.py` l.568-571), its matches survive. Entity uuids in the JSON are kept on import
  (`StoryImportService.java` l.218…) but AWS assigns random ones when absent (`_assign_uuids`),
  so the neutral model never relies on story-entity uuids.
- **Admin paths to reuse:** pause/resume = `MatchCommandPort.updateMatch(uuid, status, null,
  adminAction)` (`MatchAdminController.java` l.298-308, l.422-440; Python
  `match_command_service.update_match` l.218; AWS `_update_match` l.1478-1493); restore =
  `SnapshotService.restore` l.136-156 (Python `snapshot_service.restore` l.158, AWS
  `_admin_restore_snapshot` l.1530-1550) which already runs the time-start
  (`TimeAdvancementService.startTimeAfterRestore` l.109-111; Python l.62; AWS
  `_advance_time(snapshot=False)` l.2366) and leaves `PAUSED`; the admin delete refuses non-terminal
  matches (`MatchCommandService.java` l.251-262, AWS `_delete_match` l.1553-1564), so `replace`
  needs the internal delete (`deleteMatchByUuid`, `repo.delete_partition` `repo.py` l.124-132).
- **Users:** Java/Python `users` (`V0.10.1`): `uuid` and `username` UNIQUE, guests are `state = 6`
  with `guest_cookie_token`; AWS `USER#<uuid>`/`METADATA` with `is_guest`, `guest_token`,
  `GSI1_PK=GUEST_TOKEN#…`, `GSI2_PK=GUEST_LIST` (`auth/handler.py` l.293-326) and no SSO or
  registration flow at all.

### H.2 Neutral model "match export v1"

#### H.2.1 Principles and id strategy

- **One document**, family-independent, built from the snapshot payload (never from live state
  rows) plus the logs up to the snapshot mark. Field names are camelCase; booleans are JSON
  booleans; timestamps are ISO-8601 UTC strings `YYYY-MM-DDTHH:MM:SS.sssZ` (an unparseable source
  value is kept as text); integers only, no floats.
- **Ids:**
  - match and characters: their **uuid**, kept on import; characters also carry their
    **ordinal** (match-local `id`), kept as the character id on every backend;
  - users: **uuid**;
  - story entities: **story-local ids** (`id`, template `id`/`idTipo`, `StoryFormat.md` §4), never
    uuids and never server ids; AWS converts uuid ↔ id through the story on export and import;
  - child rows and log rows: **no id, no uuid** in the file; the importer gives them new ids
    (`max + 1` per match, `LogIdPort`, AWS sequence) and new uuids, so a copy never clashes;
  - references between sections use `characterUuid`.
- **Ordering:** `characters` by ordinal; `registry`, `traits`, `items`, `storyProgress`,
  `choiceHistory` in source order; `logs` by `seq` (1…n, assigned after sorting the source rows by
  timestamp, then table order, then source id/sort key).
- **Absent = null.** The canonical form drops null-valued keys; every optional field below may be
  absent.
- **Derived state is explicit** (`engine` section) and is the authority for ONCE gating, choice
  cycles and visited locations; the timeline is history.

#### H.2.2 Sections

| Section | Content |
|---|---|
| `format`, `formatVersion` | `"paths-games-match-export"`, `1` |
| `source` | backend, dialect, app version, server name, export time, snapshot uuid and clock |
| `story` | uuid, title, fingerprint, `data` = the story import JSON (`StoryFormat.md` §1) |
| `users` | the creator and every character's user |
| `match` | match-level state at the snapshot |
| `characters` | one per character, with resources, traits, items |
| `state` | `registry`, `locations`, `turns`, `storyProgress`, `choiceHistory` |
| `engine` | `eventMarkers[]`, `visitedLocationIds[]` |
| `logs` | timeline entries up to the snapshot mark |
| `checksum` | SHA-256 of the canonical document without `checksum` |

#### H.2.3 Mapping tables

**Match** (Java and Python share the column names of `gaming_match`):

| Neutral | Java / Python `gaming_match` | AWS `METADATA` |
|---|---|---|
| `match.uuid` | `uuid` | `uuid`, `PK=MATCH#<uuid>` |
| `match.name` | `name` | `name` |
| `story.uuid` | `id_story` → `list_stories.uuid` | `storyUuid` |
| `match.difficultyId` | `id_difficulty` | `difficultyUuid` ↔ `story.difficulties[].id` |
| `match.expCost` | `exp_cost` | `expCost` |
| `match.rngSeed` | `rng_seed` | `rngSeed` |
| `match.singlePlayer` (bool) | `single_player` 0/1 | `singlePlayer` 0/1 |
| `match.loadout.characterTemplateId` | `character_template_uuid` ↔ template id | `characterTemplateUuid` ↔ id |
| `match.loadout.classId` | `class_uuid` ↔ class id | `classUuid` ↔ id |
| `match.loadout.traitIds[]` | `trait_uuids` (`MatchTraitCodec`) ↔ ids | `traitUuids` ↔ ids |
| `match.creatorUserUuid` | `id_user_creator` → `users.uuid` | `userCreatorUuid` (+ `GSI1_PK`) |
| `match.clock` | `current_clock` | `currentClock` |
| `match.status` (informational) | `status` | `status` |
| `match.currentWeatherId` | `id_current_weather` | `currentWeatherId` |
| `match.activeCharacterUuid` | `id_character_current_turn` (ordinal) → uuid | `activeCharacterUuid` |
| `match.counterConsecutivePass` | `counter_consecutive_pass` | — (0) |
| `match.secureLocationParam` | `secure_location_param` | — (0) |
| `match.partyLocationId` | — (on import: ignored; export: location of ordinal 1) | `currentLocationId` (+ `currentLocationUuid` from the story) |
| `match.timestampStart` | `timestamp_start` | `timestampStartMs` |
| `match.timestampEnd`, `timestampGameover`, `timestampLockExpiration` | same-name columns | — (absent) |
| `match.createdAt` | `ts_insert` | `tsInsert` (+ `GSI1_SK`, `GSI2_SK`) |

**Characters** (`gaming_character_instance`, `gaming_backpack_resources`,
`gaming_character_traits`, `gaming_inventory_items` ↔ `CHARACTER#<uuid>`):

| Neutral `characters[]` | Java / Python | AWS `CHARACTER#` |
|---|---|---|
| `uuid` | `uuid` | `uuid`, `SK=CHARACTER#<uuid>` |
| `ordinal` | `id` | `id` |
| `userUuid` | `id_user` → `users.uuid` | `userUuid` |
| `characterTemplateId` | `id_character_template` (template `id_tipo`) | `idCharacterTemplate` + `characterTemplateUuid` |
| `classId` | `id_class` | `classUuid` ↔ id (`classId` is a cache) |
| `dexterity`, `intelligence`, `constitution`, `energy`, `life`, `sad`, `lifeMax`, `energyMax`, `sadMax`, `weightMax`, `exp` | same names in snake_case | same names |
| `locationId` | `id_location` | `idLocation` (+ `locationUuid` from the story) |
| `isSleeping`, `isComa` (bool) | `is_sleeping`, `is_coma` (BOOLEAN on PostgreSQL, 0/1 on SQLite) | `isSleeping`, `isComa` 0/1 |
| `clockInComa` | `clock_in_coma` | `clockInComa` |
| `timestampLastPass`, `counterConsecutivePass` | same-name columns | — (absent) |
| `characteristics[]` | `characteristics` (CSV text) | `characteristics` (list) |
| `resources.food/magic/coin` | `gaming_backpack_resources` row (id = ordinal) | `food`, `magic`, `coin` |
| `traits[] {traitId, eventId}` | `gaming_character_traits` (`id_traits`, `id_event`) | `traitUuids` ↔ ids; `eventId` absent |
| `items[] {itemId, amount, state}` | `gaming_inventory_items` (`id_item`, `amount`, `state`) | `items[] {uuid, idItem, amount, state}` |

**State** (`state.*`):

| Neutral | Java / Python | AWS |
|---|---|---|
| `registry[] {key, stringValue, intValue, multiValue, characterUuid, eventId, choiceId, clock, missionId, missionStepId}` | `gaming_state_registry` (`key`, `string_value`, `int_value`, `multi_value`, `id_character` = ordinal, `id_event`, `id_choice`, `clock`, `id_mission`, `id_mission_steps`) | `METADATA.registry[]` (`idCharacter` = ordinal, same other names) |
| `locations[] {locationId, flagAlreadyActivated, flagVisited, clockCounter}` | `gaming_state_locations` (dense: one row per story location) | `METADATA.locations[]` (sparse; `flagAlreadyActived`) |
| `turns[] {characterUuid, clock, status, priority, passCounter, timestampStart, timestampEnd}` | `gaming_turn_queue` | `TURN#<characterUuid>` |
| `storyProgress[] {clock, eventId, choiceId}` | `gaming_story_progress` | `AUDIT#` rows `kind=STORY_PROGRESS` |
| `choiceHistory[] {clock, eventId, choiceId, message, timestamp}` | `log_choices_executed` (`id_choise`) | `AUDIT#` rows `kind=CHOICE_HISTORY` (`idChoise`) |

Java export writes only the non-default location rows (any flag set or counter ≠ 0, plus the
start location), the same sparse rule as AWS; Java/Python import writes a row for every story
location, the neutral one when present, else the zero row.

**Engine** (`engine.*`):

| Neutral | Java / Python (export: computed; import: rebuilt) | AWS `METADATA` |
|---|---|---|
| `eventMarkers[] {eventId, executed, selected}` | counts of `log_events` rows ≤ mark starting with `EVENT_EXECUTED` / `CHOICE_SELECTED` per `id_event` | `eventMarkers` (+ `executedEventIds` = ids with `executed > 0`) |
| `visitedLocationIds[]` | snapshot character locations ∪ `log_movements` ≤ mark (from, to) | `visitedLocationIds` (∪ `flagVisited` rows, `logbook.visited_location_ids`) |

**Logs** (`logs[]`: `seq`, `type`, `clock`, `timestamp`, `characterUuid`, `eventId`, `choiceId`,
`locationFromId`, `locationToId`, `weatherId`, `itemId`, `itemAction`, `counter`, `effects`
(JSON text), `cost {energy, food, magic, coin}`, `gain {…}`, `message`):

| `type` | Java | Python (differences only) | AWS |
|---|---|---|---|
| `WEATHER` | `log_weather` (`clock`, `id_weather`, `timestamp_start`) | — | `LOG#` same type |
| `CLOCK_ADVANCE` | `log_clock_history` (`clock`, `timestamp_start`) | — | `LOG#` |
| `MOVEMENT` | `log_movements` (`id_location_from/to`, `energy`…`coin`; time = `ts_insert`) | `energy_cost`…`coin_cost`, `timestamp_start` | `LOG#` (`idLocationFrom/To`, `*Cost`) |
| `ITEM_ADD` / `ITEM_USE` / `ITEM_DROP` | `log_item_usage` (`action` ADD/USE/DROP/REMOVE, `id_item`, `counter`, `id_event`, `energy`…`coin`, `effects_json`, `timestamp`) | — | `LOG#` (`idItem`, item action, deltas) |
| `SLEEP` | `log_events` `ACTION_SLEEP` | — | `LOG#` |
| `EVENT` | `log_events` `EVENT_EXECUTED …` + costs/gains | `*_cost` columns | `LOG#` `EVENT` |
| `CHOICE` | `log_events` `CHOICE_SELECTED <eventId>` (`id_event` = owning event) | — | `LOG#` `CHOICE` + `AUDIT#` `CHOICE_SELECTED` |
| `COUNTER_ZERO`, `AUTOMATIC_EVENT` | `log_events` `counter …` / `automatic event …`, `id_location` = `locationToId` | — | `LOG#` |
| `RANDOM_EVENT`, `REGISTRY_CHANGE`, `MISSION_CHANGE`, `EXP_USE`, `RECOVERY` | `log_events` with the matching prefix | — | `LOG#` |
| `PASS`, `EDGE_STATE`, `TRAIT_CHANGE`, `MATCH_LIFECYCLE`, `ADMIN_ACTION` | `log_events` `ACTION_PASS`, `<STATE> …`, `TRAIT_ADD/REMOVE …`, `MATCH_…`, `ADMIN_…` | — | `LOG#` (+ `AUDIT#` `EDGE_STATE`) |
| `OTHER` | any `log_events` row no prefix matches (raw `message`) | — | `AUDIT#` `kind=OTHER` |

**Message rule:** `message` is what the source timeline shows (`GET …/logs`). A Java/Python
importer stores `log_message` = the storage prefix of the type + `message`, unless `message`
already starts with that prefix (Java does not strip `EVENT_EXECUTED`, AWS messages carry no
prefix). Enrichment fields (`card`, `idCard`, `characterName`, location and weather uuids) are
never exported: every backend computes them at read time.

**Users** (`users[]`): `uuid`, `username`, `nickname`, `language`, `state`, `guest` (bool),
`role` (exported as is, imported always as `PLAYER`), `emailAddress` (doubt 56). Never:
`password_hash`, refresh tokens, `guest_cookie_token` / `guest_token`, `google_id_sso`.
Java/Python `users` columns of the same names; AWS `USER#<uuid>` (`is_guest`, `ts_registration`).

#### H.2.4 Rebuilding the derived state

- **Export, Java/Python:** markers are counted on the `log_events` rows ≤ the snapshot mark with
  the same rule as `countLogMarkers`; visited = snapshot character locations ∪ `log_movements`
  ≤ mark, as `findVisitedLocationIds`.
- **Export, AWS:** `eventMarkers` and `visitedLocationIds` are read from `payload.metadata` of the
  snapshot (`snapshots.build_payload` l.115-124 keeps them; `_META_SKIP` l.29-30 does not drop them).
- **Import, AWS:** `executedEventIds`, `eventMarkers`, `visitedLocationIds` are written from
  `engine` as they are; the `LOG#` rows are history only.
- **Import, Java/Python:** the `EVENT` and `CHOICE` entries become the marker rows; then, per
  event, the count written is compared with `engine.eventMarkers`: missing markers are added as
  `log_events` rows `EVENT_EXECUTED <id> imported` / `CHOICE_SELECTED <id> imported` at the
  snapshot clock (they appear on the timeline), extra entries are written as `OTHER` rows so they
  do not count; warning `MARKERS_RECONCILED` (doubt 64). Visited: the set the imported rows produce
  is compared with `engine.visitedLocationIds`; a difference is the warning
  `VISITED_LOCATIONS_DIFFER` (only AWS matches created before v0.37.5 can have one).
- `log_choices_executed` (Java/Python) / `CHOICE_HISTORY` (AWS) and story progress are written from
  their own sections and never touch the markers.

#### H.2.5 What the format does not carry (documented loss)

Java `gaming_active_choices` rows (never written; a non-empty table gives the warning
`ACTIVE_CHOICES_IGNORED`); `log_clock_history.weather`/`id_event_start`/`id_event_end`,
`log_weather.timestamp_end`, `log_lock_history`; AWS `AUDIT#` `EDGE_STATE` rows (the timeline row
carries the same); the source event of an AWS trait; child-row and log ids and uuids; the snapshot
history; KPI counters; the fields one family has and the other does not (`partyLocationId`,
`counterConsecutivePass`, `secureLocationParam`, `timestamp*` of the match), which take their
default on the other family.

#### H.2.6 Canonical JSON, checksum, fingerprint

- **Canonical text:** UTF-8, object keys sorted by code point, no insignificant whitespace,
  null-valued keys omitted, integers as plain JSON integers, strings with the minimal JSON escapes
  (`\"`, `\\`, control characters as `\u00xx` lower case). It is the RFC 8785 (JCS) output for this
  value domain. Implemented once per backend (Java Jackson with a null-omitting sorted writer,
  Python `json.dumps(sort_keys=True, separators=(',', ':'), ensure_ascii=False)` after dropping
  nulls, AWS the same module as Python plus `Decimal` → `int`) and checked by the **same test
  vectors** (unicode, escapes, nested nulls, big integers) copied into the three test suites.
  The existing snapshot `canonical` (`SnapshotService.java` l.271-277, `snapshots.py` l.55-58)
  stays as it is: stored snapshot checksums must keep matching.
- **Checksum:** SHA-256 hex of the canonical document without the `checksum` key.
- **Story fingerprint:** SHA-256 of the canonical **story projection**: the story import JSON with
  every `uuid`, `tsInsert`, `tsUpdate` and `idStory` key removed at any depth, null keys removed,
  every array sorted by `id` (texts by `idText`, then `lang`). The target computes it on its own
  story through its own story exporter. If two exporters ever differ in shape the fingerprints
  differ and the story counts as `DIFFERENT` — the safe side.

### H.3 Endpoint APIs

Spec in the existing `v0.41.0-alpha-preparation-api.yaml` (two paths, schemas of H.4) plus the
JSON Schema file `match-export-v1.schema.json` next to it. Admin only (port 8044 /
`PathsGamesAdminApi`); AWS: two routes in `template/match.yaml` next to l.508-531.

| Method | Path | Answer |
|---|---|---|
| POST | `/api/admin/matches/{uuidMatch}/export` | 200 `MatchExport` (`Content-Disposition: attachment; filename=match-<uuid8>-clock-<N>.json`); 404 `MATCH_NOT_FOUND`; 409 `NO_SNAPSHOT` (CREATED, or no time-end yet, or snapshots off); 409 `SNAPSHOT_INTEGRITY_FAILED` + `errors[]`; 413 `EXPORT_TOO_LARGE` (doubt 61). POST because it pauses, restores and restarts the source |
| POST | `/api/admin/matches/import` | Body `MatchImportRequest`. `dryRun=true`: 200 `MatchImportCheck`, writes nothing. Import: 201 `MatchImportResponse`; 409 `MATCH_EXISTS` (uuid present, `replace=false`), `STORY_DIFFERS` (fingerprint differs, `storyMode=AUTO`), `CHARACTER_EXISTS`; 422 `IMPORT_INVALID` + `errors[]`; 413 `IMPORT_TOO_LARGE` |

No clash: `/import` has one segment after `matches`, every existing `POST` has two or more
(`/{uuidMatch}/pause`, …); there is no `POST /api/admin/matches/{uuidMatch}`.

### H.4 Payload and DTOs

#### H.4.1 `MatchExport` — JSON Schema (draft 2020-12)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://paths.games/schemas/match-export-v1.json",
  "title": "MatchExport v1",
  "type": "object",
  "required": ["format", "formatVersion", "source", "story", "users", "match", "characters", "state", "engine", "logs", "checksum"],
  "additionalProperties": false,
  "properties": {
    "format": { "const": "paths-games-match-export" },
    "formatVersion": { "const": 1 },
    "source": {
      "type": "object", "additionalProperties": false,
      "required": ["backend", "appVersion", "server", "exportedAt", "snapshotUuid", "snapshotClock"],
      "properties": {
        "backend": { "enum": ["java", "python", "aws"] },
        "dialect": { "enum": ["sqlite", "postgresql", "dynamodb"] },
        "appVersion": { "type": "string" },
        "server": { "type": "string" },
        "exportedAt": { "$ref": "#/$defs/ts" },
        "snapshotUuid": { "$ref": "#/$defs/uuid" },
        "snapshotClock": { "$ref": "#/$defs/int0" }
      }
    },
    "story": {
      "type": "object", "additionalProperties": false,
      "required": ["uuid", "fingerprint", "data"],
      "properties": {
        "uuid": { "$ref": "#/$defs/uuid" },
        "title": { "type": "string" },
        "fingerprint": { "$ref": "#/$defs/sha" },
        "data": { "type": "object", "description": "story import JSON, StoryFormat.md §1, no null keys" }
      }
    },
    "users": { "type": "array", "minItems": 1, "items": { "$ref": "#/$defs/user" } },
    "match": {
      "type": "object", "additionalProperties": false,
      "required": ["uuid", "difficultyId", "clock", "creatorUserUuid", "rngSeed"],
      "properties": {
        "uuid": { "$ref": "#/$defs/uuid" },
        "name": { "type": "string" },
        "difficultyId": { "$ref": "#/$defs/id" },
        "expCost": { "$ref": "#/$defs/int0" },
        "rngSeed": { "type": "integer" },
        "singlePlayer": { "type": "boolean" },
        "loadout": {
          "type": "object", "additionalProperties": false,
          "properties": {
            "characterTemplateId": { "$ref": "#/$defs/id" },
            "classId": { "$ref": "#/$defs/id" },
            "traitIds": { "type": "array", "items": { "$ref": "#/$defs/id" } }
          }
        },
        "creatorUserUuid": { "$ref": "#/$defs/uuid" },
        "clock": { "$ref": "#/$defs/int0" },
        "status": { "enum": ["CREATED", "RUNNING", "PAUSED", "ENDED", "GAMEOVER"] },
        "currentWeatherId": { "$ref": "#/$defs/id" },
        "activeCharacterUuid": { "$ref": "#/$defs/uuid" },
        "counterConsecutivePass": { "$ref": "#/$defs/int0" },
        "secureLocationParam": { "type": "integer" },
        "partyLocationId": { "$ref": "#/$defs/id" },
        "timestampStart": { "$ref": "#/$defs/ts" },
        "timestampEnd": { "$ref": "#/$defs/ts" },
        "timestampGameover": { "$ref": "#/$defs/ts" },
        "timestampLockExpiration": { "$ref": "#/$defs/ts" },
        "createdAt": { "$ref": "#/$defs/ts" }
      }
    },
    "characters": { "type": "array", "minItems": 1, "items": { "$ref": "#/$defs/character" } },
    "state": {
      "type": "object", "additionalProperties": false,
      "required": ["registry", "locations", "turns"],
      "properties": {
        "registry": { "type": "array", "items": { "$ref": "#/$defs/registryRow" } },
        "locations": { "type": "array", "items": { "$ref": "#/$defs/locationState" } },
        "turns": { "type": "array", "items": { "$ref": "#/$defs/turn" } },
        "storyProgress": { "type": "array", "items": { "$ref": "#/$defs/progress" } },
        "choiceHistory": { "type": "array", "items": { "$ref": "#/$defs/choiceRow" } }
      }
    },
    "engine": {
      "type": "object", "additionalProperties": false,
      "required": ["eventMarkers", "visitedLocationIds"],
      "properties": {
        "eventMarkers": { "type": "array", "items": {
          "type": "object", "additionalProperties": false, "required": ["eventId", "executed", "selected"],
          "properties": { "eventId": { "$ref": "#/$defs/id" }, "executed": { "$ref": "#/$defs/int0" }, "selected": { "$ref": "#/$defs/int0" } } } },
        "visitedLocationIds": { "type": "array", "uniqueItems": true, "items": { "$ref": "#/$defs/id" } }
      }
    },
    "logs": { "type": "array", "items": { "$ref": "#/$defs/logEntry" } },
    "checksum": { "$ref": "#/$defs/sha" }
  },
  "$defs": {
    "uuid": { "type": "string", "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" },
    "ts": { "type": "string" },
    "sha": { "type": "string", "pattern": "^[0-9a-f]{64}$" },
    "id": { "type": "integer", "minimum": 1 },
    "int0": { "type": "integer", "minimum": 0 },
    "resources": { "type": "object", "additionalProperties": false,
      "properties": { "energy": { "type": "integer" }, "food": { "type": "integer" }, "magic": { "type": "integer" }, "coin": { "type": "integer" } } },
    "user": { "type": "object", "additionalProperties": false, "required": ["uuid", "username", "guest"],
      "properties": { "uuid": { "$ref": "#/$defs/uuid" }, "username": { "type": "string" }, "nickname": { "type": "string" },
        "language": { "type": "string" }, "state": { "type": "integer" }, "guest": { "type": "boolean" },
        "role": { "type": "string" }, "emailAddress": { "type": "string" } } },
    "character": { "type": "object", "additionalProperties": false,
      "required": ["uuid", "ordinal", "userUuid", "characterTemplateId", "life", "energy", "sad"],
      "properties": {
        "uuid": { "$ref": "#/$defs/uuid" }, "ordinal": { "$ref": "#/$defs/id" }, "userUuid": { "$ref": "#/$defs/uuid" },
        "characterTemplateId": { "$ref": "#/$defs/id" }, "classId": { "$ref": "#/$defs/id" },
        "dexterity": { "type": "integer" }, "intelligence": { "type": "integer" }, "constitution": { "type": "integer" },
        "energy": { "type": "integer" }, "life": { "type": "integer" }, "sad": { "type": "integer" },
        "lifeMax": { "type": "integer" }, "energyMax": { "type": "integer" }, "sadMax": { "type": "integer" },
        "weightMax": { "type": "integer" }, "exp": { "type": "integer" },
        "locationId": { "$ref": "#/$defs/id" }, "isSleeping": { "type": "boolean" }, "isComa": { "type": "boolean" },
        "clockInComa": { "type": "integer" }, "timestampLastPass": { "$ref": "#/$defs/ts" },
        "counterConsecutivePass": { "$ref": "#/$defs/int0" },
        "characteristics": { "type": "array", "items": { "type": "string" } },
        "resources": { "$ref": "#/$defs/resources" },
        "traits": { "type": "array", "items": { "type": "object", "additionalProperties": false, "required": ["traitId"],
          "properties": { "traitId": { "$ref": "#/$defs/id" }, "eventId": { "$ref": "#/$defs/id" } } } },
        "items": { "type": "array", "items": { "type": "object", "additionalProperties": false, "required": ["itemId"],
          "properties": { "itemId": { "$ref": "#/$defs/id" }, "amount": { "type": "integer" }, "state": { "type": "string" } } } }
      } },
    "registryRow": { "type": "object", "additionalProperties": false, "required": ["key"],
      "properties": { "key": { "type": "string" }, "stringValue": { "type": "string" }, "intValue": { "type": "integer" },
        "multiValue": { "type": "boolean" }, "characterUuid": { "$ref": "#/$defs/uuid" }, "eventId": { "$ref": "#/$defs/id" },
        "choiceId": { "$ref": "#/$defs/id" }, "clock": { "type": "integer" }, "missionId": { "$ref": "#/$defs/id" },
        "missionStepId": { "$ref": "#/$defs/id" } } },
    "locationState": { "type": "object", "additionalProperties": false, "required": ["locationId"],
      "properties": { "locationId": { "$ref": "#/$defs/id" }, "flagAlreadyActivated": { "type": "boolean" },
        "flagVisited": { "type": "boolean" }, "clockCounter": { "type": "integer" } } },
    "turn": { "type": "object", "additionalProperties": false, "required": ["characterUuid", "clock", "status", "priority"],
      "properties": { "characterUuid": { "$ref": "#/$defs/uuid" }, "clock": { "$ref": "#/$defs/int0" },
        "status": { "enum": ["WAITING", "ACTIVE", "COMPLETED"] }, "priority": { "type": "integer" },
        "passCounter": { "$ref": "#/$defs/int0" }, "timestampStart": { "$ref": "#/$defs/ts" }, "timestampEnd": { "$ref": "#/$defs/ts" } } },
    "progress": { "type": "object", "additionalProperties": false,
      "properties": { "clock": { "type": "integer" }, "eventId": { "$ref": "#/$defs/id" }, "choiceId": { "$ref": "#/$defs/id" } } },
    "choiceRow": { "type": "object", "additionalProperties": false,
      "properties": { "clock": { "type": "integer" }, "eventId": { "$ref": "#/$defs/id" }, "choiceId": { "$ref": "#/$defs/id" },
        "message": { "type": "string" }, "timestamp": { "$ref": "#/$defs/ts" } } },
    "logEntry": { "type": "object", "additionalProperties": false, "required": ["seq", "type"],
      "properties": {
        "seq": { "$ref": "#/$defs/id" },
        "type": { "enum": ["WEATHER", "MOVEMENT", "SLEEP", "CLOCK_ADVANCE", "RECOVERY", "EVENT", "CHOICE", "COUNTER_ZERO",
          "AUTOMATIC_EVENT", "RANDOM_EVENT", "REGISTRY_CHANGE", "MISSION_CHANGE", "ITEM_ADD", "ITEM_USE", "ITEM_DROP",
          "EXP_USE", "PASS", "EDGE_STATE", "TRAIT_CHANGE", "MATCH_LIFECYCLE", "ADMIN_ACTION", "OTHER"] },
        "clock": { "type": "integer" }, "timestamp": { "$ref": "#/$defs/ts" },
        "characterUuid": { "$ref": "#/$defs/uuid" }, "eventId": { "$ref": "#/$defs/id" }, "choiceId": { "$ref": "#/$defs/id" },
        "locationFromId": { "$ref": "#/$defs/id" }, "locationToId": { "$ref": "#/$defs/id" }, "weatherId": { "$ref": "#/$defs/id" },
        "itemId": { "$ref": "#/$defs/id" }, "itemAction": { "enum": ["ADD", "USE", "DROP", "REMOVE"] },
        "counter": { "type": "integer" }, "effects": { "type": "string" },
        "cost": { "$ref": "#/$defs/resources" }, "gain": { "$ref": "#/$defs/resources" },
        "message": { "type": "string" }
      } }
  }
}
```

Beyond the schema, the importer checks the **references**: every `characterUuid` names a
character; every `userUuid`/`creatorUserUuid` names a user; ordinals are unique; one turn per
character at most; `activeCharacterUuid` names a character. A failure is `REFERENCE_INVALID`.

#### H.4.2 Request and response DTOs

- **`MatchImportRequest`:** `{ export: MatchExport, dryRun: false, replace: false,
  storyMode: "AUTO" | "KEEP" | "REPLACE" (default AUTO), startPaused: false }` (`startPaused`:
  doubt 59).
- **`MatchImportCheck`:** `{ valid, errors[{code, message}], warnings[{code, message}],
  source: {backend, dialect, appVersion, server, snapshotClock}, matchExists,
  story: {uuid, status: ABSENT | SAME | DIFFERENT, action: IMPORT | USE_EXISTING | KEEP | REPLACE,
  matchesDeleted}, users: [{uuid, username, targetUsername, status: NEW | EXISTING | RENAMED}] }`.
  - Errors: `CHECKSUM_MISMATCH`, `FORMAT_UNKNOWN` (format or version), `SCHEMA_INVALID`,
    `REFERENCE_INVALID`, `STORY_INVALID` (bundled story refused by the story validator, its
    `R_*` codes in the message), `STORY_DIFFERS`, `STORY_ENTITY_MISSING`, `MATCH_EXISTS`,
    `CHARACTER_EXISTS`.
  - Warnings: `APP_VERSION_DIFFERS`, `CROSS_FAMILY` (other backend: time-start may differ, doubt
    63), `USERNAME_RENAMED`, `ROLE_DOWNGRADED`, `USER_HAS_ACTIVE_MATCH` (doubt 60),
    `STORY_MATCHES_DELETED`, `MARKERS_RECONCILED`, `VISITED_LOCATIONS_DIFFER`,
    `ACTIVE_CHOICES_IGNORED`.
- **`MatchImportResponse`:** `{ status: "IMPORTED", uuidMatch, snapshotClock: N, clock: N + 1,
  matchStatus: "RUNNING" | "PAUSED", uuidSnapshot (the imported one), storyAction, usersCreated,
  logsImported }`.
- **Timeline:** two new `ADMIN_ACTION` details through `MatchLogWriterPort.admin(...)`
  (`MatchLogWriterPort.java` l.20-54; Python/AWS mirrors): `EXPORTED clock=<N>` on the source,
  `IMPORTED <server> clock=<N>` on the destination. React-game already hides `ADMIN_ACTION`.

### H.5 Import semantics (per backend)

**Common sequence** (one request):

1. **Read:** size cap (doubt 61), JSON parse, `format`/`formatVersion`, schema, checksum,
   references.
2. **Story:** look up `story.uuid` on T.
   - absent → the bundled `story.data` goes through the existing story validator (hard-fail rules,
     `StoryFormat.md` §6) → action `IMPORT`;
   - present, same fingerprint → `USE_EXISTING` (never re-imported: a re-import deletes the
     story's matches on Java/Python);
   - present, different → `storyMode=AUTO`: error `STORY_DIFFERS` (409); `KEEP`: use T's story;
     `REPLACE`: re-import the bundled story, warning `STORY_MATCHES_DELETED <n>` with the count of
     T's matches on that story (Java/Python; 0 on AWS) (doubt 57).
3. **Story references:** every story-local id of `match`, `characters`, `state` and `engine`
   must exist in the story that will be used (bundled for `IMPORT`/`REPLACE`, T's for
   `USE_EXISTING`/`KEEP`) → `STORY_ENTITY_MISSING` (same labels as the snapshot check). Log ids
   are history and are not checked.
4. **Users:** per user uuid: present on T → `EXISTING`, left as it is (decision 49); absent →
   `NEW`; a `NEW` username already used by another uuid → doubt 54 (proposed `RENAMED`). A new
   user is always created as `PLAYER` (an `ADMIN` source user gives `ROLE_DOWNGRADED`): an import
   never grants admin rights. Guests keep `state = 6` without token.
5. **Match:** `match.uuid` present and `replace=false` → 409 `MATCH_EXISTS`; `replace=true` →
   it will be deleted through the internal delete (no terminal-status guard). A character uuid used
   by another match → 409 `CHARACTER_EXISTS`.
6. `dryRun=true` stops here: 200 `MatchImportCheck`.
7. **Write:** story (`IMPORT`/`REPLACE`, through the existing import service — its own
   transaction, kept even if a later step fails) → `replace` delete → users → match state, logs
   and engine (atomic, below) → `ADMIN_ACTION IMPORTED <server> clock=N` → LIGHT snapshot
   `Imported at clock N` (the imported state; its log marks include the `IMPORTED` row, so a
   later restore keeps it) → time-start (decision 18 path: clock N + 1, recovery, weather, random
   event, no snapshot) → status `RUNNING` (decisions 45, 48; `PAUSED` with `startPaused`).
8. **No KPI** on import (no `MATCH_STARTED`, no `LOCATION_VISIT`); `timestampStart` kept.

**Java** (`MatchImportService` + `MatchExportStoreAdapter`, one `@Transactional` write):

- `gaming_match`: new id; `id_story` = T's story id; `id_difficulty` = `difficultyId`;
  `character_template_uuid`/`class_uuid`/`trait_uuids` = T's story uuids of the loadout ids
  (`MatchTraitCodec.join`); `id_user_creator` = T's `users.id`; `id_character_current_turn` =
  ordinal of `activeCharacterUuid`; `status` = `PAUSED` until step 7 ends.
- `gaming_character_instance`: `id` = ordinal, `uuid` kept, `id_user` mapped, booleans bound as
  Java `Boolean` (PostgreSQL `BOOLEAN`, SQLite stores 1/0 — decision 51), `characteristics` CSV.
- one `gaming_backpack_resources` per character (`id` = ordinal, as `CharacterCommandService.java`
  l.138-145); `gaming_character_traits`, `gaming_inventory_items`, `gaming_state_registry`,
  `gaming_story_progress`: ids 1…n per match, new uuids; `gaming_state_locations`: one row per story
  location; `gaming_turn_queue`: one row per turn.
- logs: one row per entry in `seq` order into the table of H.2.3, id from `LogIdPort.nextId`,
  new uuid, `id_character_match` = ordinal; `log_choices_executed` from `choiceHistory`; then the
  marker reconciliation of H.2.4.
- snapshot: `SnapshotService.writeNow(idMatch, "Imported at clock N")` (refactor of the private
  `write`, l.103-115), then `TimeAdvancementService.startTimeAfterRestore` (l.109-111), then
  `SnapshotStorePort.setStatus`. A failing time-start leaves the match `PAUSED` with its imported
  snapshot and answers 500 `IMPORT_TIME_START_FAILED`.

**Python:** the same, with SQLAlchemy in one session and one commit, the Python log columns
(`energy_cost`…, `timestamp_start`), log ids from `log_ids.next_log_id`, no active-choices table
(nothing to write; nothing was exported), story through `story_import_service.import_story`
(l.54), time-start through `time_advancement_service.start_time_after_restore` (l.62).

**AWS** (`match/match_export.py`, one Lambda request, writes through `repo` and `flush`):

- `METADATA`: the H.2.3 attributes; `GSI1_PK=USER_MATCHES#<creator>`,
  `GSI1_SK=MATCH#{createdAtMs:020d}#<uuid>`, `GSI2_PK=MATCH`, `GSI2_SK={createdAtMs:020d}#<uuid>`
  (as `_create_match` l.908-914); `executedEventIds`/`eventMarkers`/`visitedLocationIds` from
  `engine`; `locations` sparse (zero rows dropped, uuid from `_location_state`); `registry` rows
  with ids 1…n, new uuids, `idCharacter` = ordinal; `currentLocationId` = `partyLocationId`, else
  the location of ordinal 1, `currentLocationUuid` from the story; robot ttl when the name is a
  robot name (l.917-919).
- `CHARACTER#<uuid>` with ids → uuids through T's story (`characterTemplateUuid`, `classUuid`,
  `traitUuids`, `locationUuid`), `items[]` with new uuids, `food`/`magic`/`coin`; `TURN#<uuid>`.
- `LOG#{timestampMs:013d}#{seq:06d}` per entry with a fresh sequence; `AUDIT#` rows for
  `CHOICE_SELECTED` (one per `CHOICE` entry), `CHOICE_HISTORY`, `STORY_PROGRESS`, `OTHER`;
  `logSeq` = last sequence, `logCount` = `LOG#` rows.
- users: `USER#<uuid>`/`METADATA` (guest: `is_guest`, `GSI2_PK=GUEST_LIST`, no token and no
  `GSI1`).
- story: the body of `story/handler.import_story` (l.544-942) moves to `story/importer.py`, called
  by the story route and by the match import (both functions use `CodeUri: ../lambda/`).
- rollback: any failure after the first match write runs `repo.delete_partition(MATCH#<uuid>)`
  and deletes the `USER#` items it created; the story stays.
- then `IMPORTED` row, snapshot via `snapshots.write_at_time_end`'s builder with the description
  `Imported at clock N`, `_advance_time(match, uuid, snapshot=False)`, status.
- The API Gateway HTTP API integration timeout is 30 s: at the size cap the import is a few
  hundred `BatchWriteItem` calls, inside it; a unit test counts the batches at the cap.

### H.6 Export semantics

**Sequence** (one request, decision 45):

1. Load the match: 404 if absent; latest snapshot = the newest of the existing list
   (`SnapshotStorePort.list` / `snapshots.items`); none → 409 `NO_SNAPSHOT`, nothing touched.
2. Remember the status. `RUNNING` → set `PAUSED` with a status-only write (no `ADMIN_PAUSE` row:
   the restore in step 5 would delete it). `PAUSED` stays paused; `ENDED`/`GAMEOVER` → steps 5-7
   are skipped (doubt 58).
3. Verify the snapshot with the existing check (`SnapshotService.verify` l.160-183,
   `snapshots.verify` l.198-228); errors → status back, 409 `SNAPSHOT_INTEGRITY_FAILED`.
4. Build the document from the snapshot payload, the logs ≤ its mark, the users, the story export
   and the engine state; canonical text, checksum, size cap (over → status back, 413).
5. Restore the source to that snapshot through the existing restore (log cut, rows back,
   `SNAPSHOT_RESTORED clock=N`, time-start N + 1, `PAUSED`); the actions written after the
   snapshot are lost on the source, as decision 45 implies (the react-admin confirm says so).
6. `ADMIN_ACTION EXPORTED clock=N`.
7. Status back to the one of step 2: a `RUNNING` source goes through
   `MatchCommandPort.updateMatch(uuid, RUNNING, null, ADMIN_RESUME)` — the same path as
   `POST …/resume` (`MatchAdminController.java` l.304-307) — and restarts.
8. Answer 200 with the file. No KPI counter moves (decision 44 already says a restore does not
   roll them back; a resume is not a start).

"Restarts" therefore means: decision 18's restore (time-start, then `PAUSED`) followed at once by
the admin resume, in the same request. Source and destination are both at clock N + 1 after their
own time-start; same family = same weather and random event (same `rngSeed`, same clock).

**Per backend:**

- **Java:** `MatchExportService` reads the snapshot payload (`StoredSnapshot.payload`), maps the
  `state` tables with a column codec (the inverse of the H.2.3 tables; numeric `id_user` →
  `users.uuid` in one `IN` query, character ids → uuids from the same payload), reads the log rows
  `WHERE id_match = ? AND id <= mark` of the six `LogTable` tables, maps them with the type mapper
  extracted from `MatchLogsService` (l.237-330, shared so the timeline and the export never drift),
  counts the markers, builds the visited set, calls `StoryExportService`; then steps 5-7 with the
  existing services.
- **Python:** the same, mirrored module by module.
- **AWS:** `snapshots.payload_of` → `metadata`, `characters`, `turns`; `LOG#`/`AUDIT#` items with
  `_seq_of(SK) <= payload.logSeq`; engine from `payload.metadata`; users from `USER#` items; story
  from `story/exporter.py`; then the body of `_admin_restore_snapshot` (l.1530-1550, extracted to a
  helper) and `_update_match(uuid, 'RUNNING', None, ADMIN_RESUME)`.

**Story exporter (internal, all backends):** header of `GET /api/admin/stories/{uuid}` + the 22
entity lists of the admin CRUD, `tsInsert`/`tsUpdate`/`idStory` removed, text ids fixed, nulls
stripped — the server-side twin of `StoriesPage.handleExport` (l.76-135), so the output is what
the owner already re-imports today. Java `StoryExportService` over `StoryCrudPort`; Python over
`story_crud_service`; AWS `story/exporter.py` over the story item and `_normalize_entity_output`.

**Size:** `MATCH_EXPORT_MAX_BYTES`, default `5000000` (canonical size), on all three backends if
doubt 61 keeps it: Java `game.match.export.max-bytes`, Python `config.py`
`match_export_max_bytes`, AWS env in `template/match.yaml`; the dev agent lists the `.env` key
(decision 17). AWS hard limit: 6 MB per synchronous Lambda request and response.

### H.7 Components

- **Java**
  - `core/model/match/export/`: neutral records (`MatchExportDocument` and its parts),
    `CanonicalJson` (null-omitting, sorted), `NeutralColumnCodec` (H.2.3 tables), `LogTypeMapper`
    (extracted from `MatchLogsService`, used by both).
  - `core/port/match/MatchExportPort` (`exportMatch`, `check`, `importMatch`),
    `MatchExportStorePort` (logs ≤ marks, users by ids/uuids, existence checks, one transactional
    `insertImported`), `core/port/story/StoryExportPort`.
  - `core/service/match/MatchExportService`, `MatchImportService`;
    `core/service/story/StoryExportService`, `StoryFingerprint`.
  - `core/persistence/match/MatchExportStoreAdapter` (`JdbcTemplate`, identifier guard as
    `SnapshotStoreAdapter.identifier`).
  - `SnapshotService`: public `writeNow(idMatch, description)`; `MatchLogWriterPort`:
    `ADMIN_EXPORTED`, `ADMIN_IMPORTED`; `MatchCommandPort`: internal `forceDeleteMatch`.
  - `adapter-admin`: `MatchExportAdminController` (`POST /api/admin/matches/{uuidMatch}/export`,
    `POST /api/admin/matches/import`, DTOs, error mapping); `ms-launcher` wiring like
    `SnapshotService`; property `game.match.export.max-bytes`.
- **Python:** `app/core/services/match/match_export_service.py`, `match_import_service.py`,
  `neutral_codec.py`, `log_type_mapper.py` (extracted from `match_logs_service.py`),
  `app/core/services/story/story_export_service.py`, ports in `app/core/ports/match/`,
  `app/adapters/persistence/match/match_export_store_adapter.py`; routes in
  `match_admin_controller.py` next to l.130-138 (`/import` registered before any
  `/{uuid_match}` POST); `config.py` key; `launcher.py` wiring.
- **AWS:** `lambda/match/neutral.py` (canonical, codecs, type mapping),
  `lambda/match/match_export.py` (export and import), `lambda/story/exporter.py`,
  `lambda/story/importer.py` (extracted); `handler.py` dispatch of the two routes; two
  `AWS::ApiGatewayV2::Route` + env `MATCH_EXPORT_MAX_BYTES` in `template/match.yaml`.
- **react-admin:** `api/matchApi.js` `exportMatch(uuid)` (POST, blob download, file name from
  `Content-Disposition`) and `importMatch(body)`; an "Export" button on the match detail
  (`MatchDetailModal.jsx`, next to the snapshots card) with a confirm dialog ("pauses the match,
  rolls it back to the snapshot of clock N, the actions since are lost, then restarts it"), 409
  answers shown with `errors[]`; new `pages/MatchImportPage.jsx` (`/matches/import`): file picker →
  automatic dry-run → source, story status, users table, warnings and errors → `replace` (only when
  `matchExists`), `storyMode` (only when `DIFFERENT`, with the `matchesDeleted` count),
  `startPaused` → Import → link to the match; entry in the matches list and in `Navbar.jsx`; the
  snapshots card shows the "Imported at clock N" row like the others.
- **OpenAPI:** two paths and the DTO schemas in `v0.41.0-alpha-preparation-api.yaml`;
  `match-export-v1.schema.json` (H.4.1) in the same folder, `$ref`'d by `MatchExport`.
- **Docs (via `/doc-update`, after development):** `DataModel.md` (match export file, neutral
  ids), `StoryFormat.md` §7 (server-side story export used by the match export), `Security.md`
  (admin-only import, `PLAYER` role forced, no tokens copied), `Environments.md` (procedure:
  export on S, dry-run and import on T).

### H.8 Tests

**Unit (> 96% of new code, each backend):**

- canonical JSON with the shared vectors; checksum; schema (`SCHEMA_INVALID`), `FORMAT_UNKNOWN`,
  `REFERENCE_INVALID`;
- codec round trips native → neutral → native for every table and attribute of H.2.3; Java with
  both value shapes of decision 51 (`Boolean` and `0/1` integers, timestamp text) so the same file
  goes to SQLite and PostgreSQL;
- AWS uuid ↔ id through the story (class, template, traits, loadout, difficulty, locations);
- engine: Java/Python marker counting and visited set; AWS read; Java/Python rebuild and the
  reconciliation (missing and extra markers); a ONCE event and an open choice survive the round
  trip;
- story: exporter output equals the react-admin export shape for the alpha-prep story; fingerprint
  equal across a re-export; `ABSENT`/`SAME`/`DIFFERENT` × `AUTO`/`KEEP`/`REPLACE`, the
  `matchesDeleted` count;
- users: `NEW`/`EXISTING`/`RENAMED`, `ROLE_DOWNGRADED`, guests without token, no secret column ever
  read into the file;
- export sequence: `RUNNING` (pause, restore, `EXPORTED`, resume), `PAUSED` stays paused,
  terminal untouched, `NO_SNAPSHOT`, integrity failure puts the status back, size cap;
- import sequence: `MATCH_EXISTS`, `replace` on a non-terminal match, `CHARACTER_EXISTS`, rollback
  on a failing insert (Java/Python transaction, AWS partition delete), `IMPORTED` row, imported
  snapshot with marks including it, time-start then `RUNNING`/`PAUSED`, no KPI row,
  `IMPORT_TIME_START_FAILED`;
- AWS: GSI keys, `LOG#` sort keys and `logSeq`/`logCount`, ttl for robot names, batch count.

**react-admin (vitest):** export button (confirm, download, 409 errors); import page (dry-run
render, story modes, users table, `replace` toggle, success link).

**Robot** — written by the dev agent, run by the owner on the four targets (local Java, Java +
PostgreSQL, Python, AWS; decision 35 for AWS). New suite
`code/tests/robot/tests/41_alpha_prep/match_export_import.robot`, helper
`resources/MatchExportHelper.py` (same canonical function as the backends; rewrites match,
character and story uuids and recomputes checksum and fingerprint; validates the file against
`match-export-v1.schema.json` — `jsonschema` added to `code/tests/robot/requirements.txt`), fixtures
in `41_alpha_prep/fixtures/`. Cases:

1. Export of a running match: valid file (schema, checksum); source `RUNNING` at clock N + 1;
   timeline `SNAPSHOT_RESTORED` and `EXPORTED`; the action done after the snapshot is gone.
2. `NO_SNAPSHOT` on a fresh match; 404 on an unknown uuid; a paused source stays paused.
3. Dry-run of the file on the same server: `MATCH_EXISTS`, story `SAME`, users `EXISTING`.
4. Import as a copy (helper rewrites the uuids): 201, `RUNNING`, clock N + 1, the
   `Imported at clock N` snapshot listed, timeline = rows ≤ mark + `IMPORTED`; info, registry,
   inventory, missions and weather equal to the source after its export (same family).
5. `replace=true` on the copy: 201 again; restore of the copy to its imported snapshot works.
6. **Cross-family fixture** `fixtures/match_export_aws_v1.json`: a hand-built file on
   `story_alpha_prep.json` declaring `source.backend = "aws"`, with one ONCE event executed, one
   open choice cycle (executed 1, selected 0), registry keys, an item, a mission, a visited
   location and a guest user. On every target: the ONCE event is not offered, the open choice is
   served again without charge, registry/inventory/mission/visited as in the file, the guest
   exists without token, warning `CROSS_FAMILY` (except on AWS).
7. Story: the fixture with a new story uuid → story `IMPORT`ed; the bundled story changed
   (helper edits one text) on a server that has it → 409 `STORY_DIFFERS`; `storyMode=KEEP` → 201.
8. Tampered checksum → 422 `CHECKSUM_MISMATCH`; `formatVersion: 2` → 422 `FORMAT_UNKNOWN`.
9. KPI report unchanged by export and import.
10. **Golden matrix:** test `Write Golden Export` (tag `golden`, skipped unless
    `${WRITE_GOLDEN}` is set) saves `fixtures/golden/export_<backend>.json` from a scripted match;
    the owner runs it once on Java (SQLite), Python and AWS and commits the three files (doubt 66).
    Test `Golden Exports Import On This Target` imports each committed file (copy uuids) and
    checks the same observable state as case 6; it skips while no golden file exists. Java SQLite
    golden imported on the Java + PostgreSQL target is the proof of decision 51.

Existing suites are not changed; `snapshots.robot` keeps its six tests.

### H.9 Story uuid validation on import (0.41.5)

`POST /api/admin/stories/import` (port 8044) trims and lowercases the story's top-level `uuid` when present and not blank, then requires the canonical shape `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$` (no RFC 4122 version check). Otherwise `400 INVALID_STORY` with rule `R0_STORY_UUID` (entityType `story`, field `uuid`), nothing persisted. Absent, null or blank (AWS now also whitespace-only) still auto-generates a uuid.
- Import-only: `GET /api/admin/stories/{uuid}/validate` does not report it, so legacy non-UUID stories stay valid and playable. Nested entity uuids are not checked.
- Match import (H.5): the bundled story uses the same validator; a malformed uuid gives `STORY_INVALID`.
- Java `core/model/story/StoryUuid.java` (normalize, isValid), rule in `StoryValidatorService.validateImportData`, normalization in `StoryImportService`. Python `app/core/models/story/story_uuid.py`, `story_validator_service.validate_import_data`, `story_import_service`. AWS `story_validator.validate_story_uuid` / `normalize_story_uuid`, called in `story/handler.py` `import_story_data` and `match/match_export.py` `_validate_bundled`.
- react-admin: `utils/storyJson.js` `isValidStoryUuid`; `StoryImportPage` blocks a malformed uuid before the API call (uppercase accepted, backend normalizes).
- Robot: 4 cases in `22_story_validation/story_validation.robot` (tag `story-uuid`). Dev tutorial story uuid is now `bd02e05f-654d-4589-bfae-846a04dc9d3c`; stress `tutorial_story.json` is `2ba49457-e312-4f3b-94bb-5b7c3be4db4c`. OpenAPI `v0.22.0-story-validation-api.yaml` description updated.
- Script `code/scripts/dev/run_robot_everywhere.sh`: with `--aws=remote|all` the AWS_LIMITED pass runs `run_robot_with_aws_serverless_special.sh` (rate limits on in the test stack, then restored); reports in `reports-aws-limited/`.

# Version Control
- **Document Version**: 0.41.5

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.40.0 | First analysis of the alpha preparation step, owner answers | September 27, 2026 |
  | 0.41.0 | Owner decisions completed; patch 1 (security, guests, CI) developed | September 28, 2026 |
  | 0.41.1 | Patch 2 developed: logging and match snapshots | September 29, 2026 |
  | 0.41.2 | Patch 3 developed: KPI report, production CSP; match export analysed | September 29, 2026 |
  | 0.41.4 | Match export and import re-analysed for every backend | October 1, 2026 |
  | 0.41.5 | Story import checks the story identifier format | October 3, 2026 |

- **Last Updated**: October 3, 2026 (v0.41.5)
- **Status**: patches 0.41.0-0.41.2 developed; 0.41.4 (H, match export and import, neutral format) re-analysed, decisions 54-66 taken (shipped: security, allow-list, guests, CI scan, test CSP, logging, snapshots, KPI report, production CSP)

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
