# Step 1 — Version 1 launch (daily smoke test)

**Status: DEVELOPED (October 13, 2026).** AWS pytest 1475 passed; `lambda/smoke/` 100% lines, 99% branches; Robot not run (no API change).
Roadmap line: *V1 starts on top of the launched alpha* ([Roadmap](./Roadmap.md) step 1).
Current version `1.0.0`; the step is released as `1.1.0` (the owner bumps, never an agent).
Touches only the **AWS backend** (`code/backend/aws/`), `code/scripts/` and docs. **No API, OpenAPI,
schema, Java, Python, react-game, react-admin or Robot change.**

Hard rules for the developing agent: change no `.env` / `.env.test` (new keys go in `.env.example`
only, the owner adds them by hand); never run `sam`, `aws`, `gh`, `terraform` or Robot commands;
never commit, push or bump the version.

## 1. Scope

| # | Sub-point | Tag | State |
|---|-----------|-----|-------|
| 1 | Version bump to `1.0.0` on every component | all | DONE (owner) |
| 2 | Versioning: plain `X.Y.Z`, `bump-version.sh` with pre-check and `--check` | infra, docs | DONE |
| 3 | V0 documents frozen; `documentation_v1` current in [INDEX](../INDEX.md) | docs | DONE |
| 4 | Alpha urgent fixes stay on `0.42.z` (V0 `Hotfixes.md`) | docs | rule only |
| 5 | Robot green on all three backends with `1.0.0` | tests | owner runs |
| 6 | **Daily smoke test on AWS** (guest, stories, match, gameplay, Turnstile), failure notified | tests, infra | DONE (developed) |

**In**: one new Lambda `pathsgames-<env>-SmokeTestFunction` in a new nested stack
`template/smoke.yaml`, scheduled daily by EventBridge Scheduler and invoked after every deploy;
SNS message and two CloudWatch alarms on public stages; IAM policy update for GitHub Actions.

**Out**: Java and Python backends (the smoke test is not part of the shared API contract); Robot
suites; react-game and react-admin; filtering smoke data out of admin lists or KPI reports (the
owner wants it visible for 7 days); the dev stage (excluded by the condition, trivial to add later).

### Context (decisions, October 13, 2026)

- Runs on **test** and on the public stages **alpha, beta, prod**, with identical behaviour on
  test and alpha. Only differences: no SNS topic on test (log only), Turnstile check skipped where
  no Turnstile secret is configured.
- The match is created **in-process** (the smoke Lambda imports `match.handler`), so Turnstile is
  skipped only because the smoke function has no `TURNSTILE_SECRET_KEY`. Every other call goes
  through the real public API.
- Smoke rows get a DynamoDB `ttl` of 7 days on both partitions (`MATCH#`, `USER#`) in a `finally`.

## 2. Endpoint APIs

No new or changed endpoint, no OpenAPI file. The smoke Lambda **calls** these existing routes:

| # | Call | Via | Expected |
|---|------|-----|----------|
| a | `GET <website>/` | HTTPS | 200 and the marker `Paths Games` (the `<title>` of react-game `index.html`); skipped when the URL is empty |
| b | `GET /api/echo/status` | public API | 200, `status == "UP"`, `properties.version == APP_VERSION` (stack `Version`) |
| c1 | `GET /api/stories?lang=en` | public API | 200, at least one story; pick the first whose `title` and `uuid` do not contain `robottest` (case-insensitive) |
| c2 | `GET /api/stories/{uuid}?lang=en` | public API | 200; first `difficulties[]`, first `characterTemplates[]`, first `classes[]` compatible with that template (same rule as `_validate_class`: `idClassPermitted` / `idClassProhibited` against class `id`; none compatible → no class), no traits |
| d | `POST /api/auth/guest` | public API | 201, `accessToken` and `csrfToken` (on test the token is `MOCK_ACCESS_<uuid>`, `AllowMockAccess=true`: the smoke only forwards it) |
| e | `POST /api/matches` | **in-process** `match.handler.lambda_handler` | 201, `uuid` |
| f1 | `POST /api/matches/{uuid}/join` | public API | 201 (body = the loadout, as `StartMatchFlow.jsx` does) |
| f2 | `POST /api/matches/{uuid}/start` | public API | 200 |
| f3 | `GET /api/match/{uuid}/info?lang=en` | public API | 200, `status == "RUNNING"` |
| f4 | `GET /api/match/{uuid}/clock` | public API | 200, read `currentClock` (c0) |
| f5 | `GET /api/match/{uuid}/locations?lang=en` | public API | 200; neighbours of the location with `characterCount > 0` |
| f6 | `POST /api/gameplay/{uuid}/movements/start` `{targetLocationUuid}` | public API | try neighbours in order until a 200; 409/400 → next; none accepted → `WARNING`, the run still passes |
| f7 | `POST /api/gameplay/{uuid}/action/pass` | public API | 200 |
| f8 | `POST /api/gameplay/{uuid}/action/sleep` (no body) | public API | 200; if the response has `timeEndTriggered` it must be `true` |
| f9 | `GET /api/match/{uuid}/clock` (step `clock-after-sleep`) | public API | 200, `currentClock` (c1) `> c0`; otherwise blocking failure `clock not advanced by sleep: c0 -> c1` |
| g | `POST /api/matches` without `turnstileToken` | public API | 400 `TURNSTILE_VALIDATION_FAILED`; skipped (log line) when `TURNSTILE_ENABLED=false` |

Headers on every public call: `Authorization: Bearer <accessToken>` (after d),
`Content-Type: application/json`, `User-Agent: PathsGamesSmokeTest/<version>`. `X-CSRF-TOKEN:
<csrfToken>` on both `POST /api/matches` (e and g).

**Check g body**: valid `storyUuid` and `difficultyUuid` (else the handler answers 400
`INVALID_INPUT` before the Turnstile check), no `turnstileToken`. Order in `_dispatch` /
`_create_match`: CSRF → per-IP limit → per-guest limit → body → Turnstile; it never writes a match.

**Base URLs**: `SMOKE_API_BASE_URL` = `https://<CustomDomainName>` when the stack has one, else
`https://<apiId>.execute-api.<region>.amazonaws.com/<env>` (the `ApiUrl` output);
`SMOKE_WEBSITE_URL` from the parameter `SmokeTestWebsiteUrl`.

## 3. DTOs and Domain Models

No API DTO. Internal shapes of the smoke Lambda only:

- **Synthetic HTTP API v2 event** for step e: `version "2.0"`, `routeKey "POST /api/matches"`,
  `rawPath "/api/matches"`, `headers` (`authorization`, `x-csrf-token`, `content-type`,
  `user-agent`, all lowercase), `requestContext.http = {method: "POST", path: "/api/matches",
  sourceIp: "42.42.42.42"}`, `requestContext.requestId = "smoke-<uuid>"`, `body` JSON:
  `storyUuid`, `difficultyUuid`, `characterTemplateUuid`, `classUuid`, `traitUuids: []`,
  `name: "smoketest-<YYYYMMDD-HHMM>"`, `singlePlayer: 1` (same keys as `StartMatchFlow.jsx`).
  The name never starts with `robottest`, so no Robot TTL applies.
- **Run summary** (one JSON log line `SMOKE_SUMMARY`, also the invoke result):
  `result` (`PASS` / `FAIL`), `env`, `version`, `trigger` (`schedule` / `deploy`), `failedCheck`,
  `httpStatus`, `error`, `userUuid`, `matchUuid`, `warnings[]`, `totalMs`, `steps[]` with
  `{name, status, httpStatus, ms, slow}`; `slow` = above `SMOKE_LATENCY_WARN_MS` (warning only).
- **SNS message** (failure only): subject `[pathsgames-<env>] smoke test FAILED: <check>`
  (≤ 100 chars), body = the summary pretty-printed plus the CloudWatch log group name.

## 4. Roles and Authentication

- The smoke Lambda uses a **normal guest** (`POST /api/auth/guest`, role `PLAYER`); no admin token,
  no admin API, no `X-Test-Marker` header.
- **Security notes** (to copy in the AWS README and one line in [Security](../Security.md)):
  - no new code path in any public Lambda: no flag, header, token or bypass is added;
  - the smoke Lambda has no API Gateway integration and no resource policy for API Gateway: it is
    reachable only by EventBridge Scheduler and by an IAM principal with `lambda:InvokeFunction`;
  - Turnstile is skipped only for the in-process creation, because that function has no
    `TURNSTILE_SECRET_KEY` / `TURNSTILE_BYPASS_TOKEN`; the public `MatchFunction` is unchanged,
    and check g proves every run that the public route still refuses a missing token;
  - the smoke function carries the real `JWT_SECRET` (else `jwt_utils.misconfigured()` answers 500
    on alpha); it never logs tokens, only uuids, statuses and timings.

## 5. Database Tables

No Flyway migration (SQLite, PostgreSQL untouched), no new DynamoDB item type.

- Rows written per run: `USER#<uuid>` (guest), `MATCH#<uuid>` (METADATA, CHARACTER#, TURN#, LOG#,
  AUDIT#, snapshot rows), `RATELIMIT#…` (already carry `ttl`), `KPI#<storyUuid>` counters (kept on
  purpose, no exclusion).
- **TTL in `finally`** (also on failure): `ttl = now + SMOKE_TTL_DAYS * 86400` on **every** row of
  `MATCH#<matchUuid>` and `USER#<userUuid>`: key-only Query (`ProjectionExpression PK, SK`,
  `ConsistentRead`, paginated), then one `UpdateItem SET #ttl = :ttl` per key with
  `ConditionExpression attribute_exists(PK)` (a row deleted meanwhile is never recreated). Partition
  skipped when its uuid is unknown (guest or match never created). Reason: `match/repo.py
  _inherit_ttl` copies `ttl` only when `test_data_ttl.hours() > 0`, i.e. dev/test with Robot TTL.
- Table TTL attribute is `ttl`, already enabled on every stage (`template.yaml`).

## 6. Components

### 6.1 AWS — Lambda `code/backend/aws/lambda/smoke/` (new)

- `__init__.py`; `handler.py` — `lambda_handler(event, context)`: reads `trigger` from the event
  (`schedule` when invoked by Scheduler, `deploy` when the payload says so), runs the checks a→g in
  order, stops at the first hard failure, `finally` applies the TTL, logs `SMOKE_SUMMARY`, on
  failure publishes SNS (when `SMOKE_ALARM_TOPIC_ARN` is set) and raises `SmokeTestFailed` (the
  invocation ends in error → `Errors` metric, CLI `FunctionError`). On success returns the summary.
- `http.py` (or `client.py`) — `urllib.request` JSON GET/POST with per-call timeout
  `SMOKE_HTTP_TIMEOUT_S` (default 20, hard failure), timing in ms, slow flag over
  `SMOKE_LATENCY_WARN_MS` (default 5000), `HTTPError` turned into a status, never raised raw.
- `inprocess.py` — builds the synthetic event of §3 and calls `match.handler.lambda_handler(event,
  None)`; parses `statusCode` / `body`. Imported lazily so a broken import is a reported failure.
- `ttl.py` — the TTL sweep of §5 (own boto3 calls on `db_utils._get_table()`; no change in `common/`).
- `notify.py` — SNS `publish` with boto3; an SNS error is logged and never hides the test result.
- Logging: `print` of JSON lines like the other handlers (JSON log format on the function); one
  line per step, a `WARNING` line for no accepted movement and for each slow call.
- Environment variables: **all** variables of `MatchFunction` (`TABLE_NAME`, `ENV`, `JWT_SECRET`,
  `STORY_CACHE_TTL_SECONDS`, `ALLOW_MOCK_ACCESS`, `ADMIN_IP_WHITELIST`, `ADMIN_IP_EMPTY_MEANS`,
  `RATE_LIMIT_MATCH_PER_IP`, `RATE_LIMIT_WINDOW_SECONDS`, `RATE_LIMIT_MATCH_PER_GUEST`,
  `RATE_LIMIT_MATCH_PER_GUEST_WINDOW_SECONDS`, `CSRF_ENFORCED`, `ROBOT_TEST_DATA_TTL_HOURS`,
  `LOG_WARN_ROWS`, `LOG_WARN_METADATA_KB`, `SNAPSHOT_KEEP_PER_MATCH`, `MATCH_EXPORT_MAX_BYTES`,
  `APP_VERSION`) with the same values, **except** `TURNSTILE_SECRET_KEY` and
  `TURNSTILE_BYPASS_TOKEN`; plus `SMOKE_API_BASE_URL`, `SMOKE_WEBSITE_URL`, `SMOKE_TTL_DAYS`,
  `SMOKE_LATENCY_WARN_MS`, `SMOKE_ALARM_TOPIC_ARN`, `TURNSTILE_ENABLED` (`"true"`/`"false"`, a
  flag computed by the root stack, never the secret).

### 6.2 AWS — nested stack `code/backend/aws/template/smoke.yaml` (new)

- Parameters: `Environment`, `EnvironmentTag`, `Version`, `LambdaSystemLogLevel`, `TableName`,
  `StoryCacheTtlSeconds`, `JwtSecret` (NoEcho), `AllowMockAccess`, `AdminIpWhitelist`,
  `AdminIpEmptyMeans`, `RateLimitMatchPerIp`, `RateLimitWindowSeconds`, `RateLimitMatchPerGuest`,
  `RateLimitMatchPerGuestWindowSeconds`, `CsrfEnforced`, `RobotTestDataTtlHours`, `ApiBaseUrl`,
  `AlarmTopicArn` (default `""`), `TurnstileEnabled`, `SmokeTestEnabled`, `SmokeTestSchedule`,
  `SmokeTestTtlDays`, `SmokeTestWebsiteUrl`, `SmokeTestLatencyWarnMs`.
- Conditions: `IsSmokeEnabled` (`SmokeTestEnabled == "true"`), `HasAlarmTopic` (`AlarmTopicArn !=
  ""`), `HasSmokeAlarms` (both).
- `SmokeTestLogGroup`: `/aws/lambda/pathsgames-${Environment}-SmokeTestFunction`, 14 days,
  `DeletionPolicy: Delete`, the 7 tags.
- `SmokeTestScheduleGroup`: `AWS::Scheduler::ScheduleGroup` `pathsgames-${Environment}-smoke-test`,
  the 7 tags (a schedule takes no tags).
- `SmokeTestFunction`: `pathsgames-${Environment}-SmokeTestFunction`, `python3.13`, `arm64`,
  `CodeUri: ../lambda/`, `Handler: smoke.handler.lambda_handler`, `Timeout: 180`,
  `MemorySize: 512`, `LoggingConfig` JSON (`SystemLogLevel` parameter, `ApplicationLogLevel INFO`),
  `PropagateTags: true`, the 7 tags, env of §6.1; `EventInvokeConfig.MaximumRetryAttempts: 0`
  (an async failure must not re-run the smoke twice more); Policies: `DynamoDBCrudPolicy` on the
  table and `!If [HasAlarmTopic, {Statement: sns:Publish on AlarmTopicArn}, !Ref AWS::NoValue]`.
  Event `DailySmokeTest`: `ScheduleV2`, name `pathsgames-${Environment}-smoke-test-daily`, group
  above, `ScheduleExpression: !Ref SmokeTestSchedule` (default `cron(42 4 * * ? *)`),
  `ScheduleExpressionTimezone: UTC`, `State: !If [IsSmokeEnabled, ENABLED, DISABLED]`,
  `FlexibleTimeWindow OFF`, `RetryPolicy.MaximumRetryAttempts: 0`, `Input: {"trigger":"schedule"}`.
- `SmokeTestFailedAlarm` (`HasSmokeAlarms`): `pathsgames-${Environment}-smoke-failed`,
  `AWS/Lambda Errors`, dimension `FunctionName`, `Sum`, `Period 86400`, `EvaluationPeriods 1`,
  `>= 1`, `TreatMissingData notBreaching`, `AlarmActions [AlarmTopicArn]`, the 7 tags.
- `SmokeTestMissingAlarm` (`HasSmokeAlarms`): `pathsgames-${Environment}-smoke-missing`,
  `AWS/Lambda Invocations`, same dimension, `Sum`, `Period 86400`, `< 1`
  (`LessThanThreshold`, threshold 1), `TreatMissingData breaching`, same actions and tags.
  Alarm metrics on the account: 6 + 2 = 8, inside the 10 free.

### 6.3 AWS — root `template.yaml` and `template/monitoring.yaml`

- New root parameters: `SmokeTestEnabled` (`"true"`, AllowedValues true/false),
  `SmokeTestSchedule` (`cron(42 4 * * ? *)`), `SmokeTestTtlDays` (`"7"`), `SmokeTestWebsiteUrl`
  (`""`), `SmokeTestLatencyWarnMs` (`"5000"`).
- New conditions: `HasSmokeTest: !Or [!Equals [!Ref Environment, test], !Condition IsPublicStage]`;
  `HasTurnstile: !Not [!Equals [!Ref TurnstileSecretKey, ""]]`.
- `SmokeModule` (`AWS::Serverless::Application`, `Condition: HasSmokeTest`,
  `Location: template/smoke.yaml`, `DependsOn: [EchoModule, AuthModule, StoryModule, MatchModule]`,
  the 7 tags) with the parameters of §6.2: `ApiBaseUrl: !If [HasCustomDomain,
  !Sub "https://${CustomDomainName}", !Sub "https://${PathsGamesApi}.execute-api.${AWS::Region}.amazonaws.com/${Environment}"]`,
  `AlarmTopicArn: !If [IsPublicStage, !GetAtt MonitoringModule.Outputs.AlarmTopicArn, ""]`,
  `TurnstileEnabled: !If [HasTurnstile, "true", "false"]`; never `TurnstileSecretKey` nor
  `TurnstileBypassToken`.
- `monitoring.yaml`: new output `AlarmTopicArn: !If [HasAlarms, !Ref AlarmTopic, ""]` (always
  present, so the root `GetAtt` never fails when `AlarmEmail` is empty); the smoke function added to
  the three Lambda widgets (Invocations, Errors, Duration p95): 42 → 45 metrics, under 50.
- New root output `SmokeTestFunctionName` (`Condition: HasSmokeTest`).
- `samconfig.toml` `[alpha]` `parameter_overrides` += `SmokeTestWebsiteUrl=https://paths.games`
  (beta/prod empty until their sites exist).

### 6.4 Scripts and workflow

- New helper `code/scripts/lib/smoke_test.sh`: `smoke_test_invoke <function> <region>` →
  `aws lambda invoke --invocation-type RequestResponse --cli-read-timeout 300
  --cli-binary-format raw-in-base64-out --payload '{"trigger":"deploy"}'` into a temp file; prints
  the summary; returns 1 when the CLI output has `FunctionError` or the result is not `PASS`.
- `code/scripts/prod/aws_backend_deploy_stage.sh`: after `sam deploy`, source the helper and invoke
  `pathsgames-<stage>-SmokeTestFunction` in the samconfig region; a failure exits non-zero. Passes
  `SmokeTestEnabled` / `SmokeTestWebsiteUrl` from the optional stage keys
  `AWS_<STAGE>_LAMBDA_SMOKE_TEST_ENABLED` / `AWS_<STAGE>_LAMBDA_SMOKE_WEBSITE_URL`; when enabled is
  `false` the invoke is skipped with a log line.
- `code/scripts/test/aws/aws_backend_deploy.sh`: same, only for `test` (dev has no smoke function);
  new keys `AWS_TEST_LAMBDA_SMOKE_TEST_ENABLED` (default `true`) and
  `AWS_TEST_LAMBDA_SMOKE_WEBSITE_URL` (the test site, empty = website check skipped).
- `.github/workflows/alpha-deploy-backend-aws.yml`: its deploy step already runs
  `deploy_backend.sh` → the stage script, so the smoke invoke runs there and a failure fails the
  job; no second invoke step (it would run the smoke twice), only the step name and header comment
  updated.
- `code/scripts/prod/aws_create_policy_github_actions.sh`: add `Scheduler` (`scheduler:*` on
  `schedule-group/{stack}-*` and `schedule/{stack}-*/*`); extend `PassRoleToLambda` to
  `iam:PassedToService` `[lambda.amazonaws.com, scheduler.amazonaws.com]` (renamed
  `PassRoleToServices`). CloudWatch alarms and `lambda:InvokeFunction` are already covered; the
  6144-character guard stays. The owner re-runs the script.
- `.env.example`: the new keys of this section, commented.

### 6.5 Java, Python, react-game, react-admin, Robot

No change.

### 6.6 Docs (doc agent, through `/doc-update`)

- `code/scripts/alpha/README.md`: runbook "smoke alarm" (read `SMOKE_SUMMARY` in the log group,
  re-run by hand with `aws lambda invoke`, what `smoke-missing` means, how to switch off).
- `wiki/Environments.md` AWS section: smoke function, schedule, parameters, new `.env` keys.
- `code/backend/aws/README.md`: new Lambda and nested stack, security notes of §4.
- `wiki/Security.md`: one line (smoke Lambda not reachable from the internet, no bypass).
- `wiki/documentation_v1/Roadmap.md` step 1: the `- p:` sub-point rewritten with these decisions.

## 7. Tests

Unit tests (pytest, `code/backend/aws/tests/`, `PYTHONPATH=lambda`), coverage > 96% of the new code:

- `test_smoke_handler.py` (urllib mocked, `match.handler.lambda_handler` monkeypatched):
  happy path a→g (summary `PASS`, step order, timings); every hard-failure branch (website status
  and marker, echo status/version, no story, only `robottest` stories, detail error, guest error,
  in-process non-201, join, start, info not RUNNING, clock, locations, pass, sleep (`timeEndTriggered` false), clock not advanced by sleep,
  Turnstile check not 400); website and Turnstile checks skipped when not configured; class
  compatibility pick; no accepted movement → `WARNING` and `PASS`; slow call → warning only;
  HTTP timeout → failure; `SmokeTestFailed` raised after SNS on failure.
- `test_smoke_ttl.py`: TTL applied to **every** row of both partitions (pagination included), in
  `finally` on success and on failure, skipped partition when its uuid is missing, conditional
  update error logged and not raised.
- `test_smoke_notify.py`: SNS published with subject/body when the topic is set; nothing when unset
  (test stage); SNS error logged, the run still fails with the original check.
- `test_smoke_inprocess.py`: the real `match.handler` in-process with `helpers.FakeTable` and a story
  fixture (as `test_match_handler.py`): synthetic event → 201 with no Turnstile secret; CSRF header
  honoured; `sourceIp 42.42.42.42` used by the per-IP limit.
- `test_v1_step01_smoke_template.py` (style of `test_step42_template_hardening.py`):
  `HasSmokeTest` true on test/alpha/beta/prod, false on dev; schedule `cron(42 4 * * ? *)` UTC,
  state tied to `SmokeTestEnabled`, retries 0; the 7 tags on log group, schedule group, function,
  alarms; both alarms (metric, period, threshold, `TreatMissingData`, condition); smoke env equals
  `MatchFunction` env minus `TURNSTILE_SECRET_KEY` / `TURNSTILE_BYPASS_TOKEN`; no Turnstile
  parameter passed to `SmokeModule`; `AlarmTopicArn` output always present; total alarm metrics
  ≤ 10; dashboard ≤ 50 metrics.
- Update `test_step42_template_hardening.py`: `FUNCTIONS` += `SmokeTestFunction` (it scans
  `template/*.yaml`), dashboard count 3 per function still holds.
- Scripts: `bash -n` on the changed scripts; the helper tested with a stub `aws` on `PATH`
  (PASS, `FunctionError`, FAIL summary).
- Robot: none (no API change); the owner keeps the suites green on all backends.

## 8. Deviations from the analysis (development)

- No location with `characterCount > 0` found: the movement check ends in a `WARNING` and the run still passes.
- Movement answers 500 or 404 are a blocking error; 400 and 409 make the check try the next neighbour.
- Flow extended after approval: after `pass` the run calls `sleep` and re-reads the clock (f8, f9).
- `SMOKE_HTTP_TIMEOUT_S` (default 20) is read by the code but not set in `template/smoke.yaml`.
- First-deploy check: the monitoring output `AlarmTopicArn` is `""` when `AlarmEmail` is empty (no smoke alarms then).

## 9. Doubts

No open doubt. Decided (owner flow start → movement → pass → sleep): `pass` only ends the turn, so the clock is checked after `sleep`, which triggers the time-end.

# Version Control
- **Document Version**: 1.0.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 1.0.0 | Daily automatic check of the online game developed | October 13, 2026 |

- **Last Updated**: October 13, 2026 (v1.0.0)
- **Status**: developed; no open doubt

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
