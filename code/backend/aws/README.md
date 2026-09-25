# Paths Games - AWS Serverless Backend

Welcome to the **Serverless** version of the Paths Games backend! This project offers a high-performance, scalable, and extremely cost-effective alternative to traditional backends (Java & Python) based on relational databases.

## 🚀 Architecture 

The infrastructure is built entirely on managed AWS services:

- **AWS API Gateway (HTTP API v2)**: Lightweight gateway with CORS configured for localhost and credentials enabled.
- **AWS Lambda (Python 3.13)**: FaaS functions with explicit names (`pathsgames-<env>-<Function>`).
- **AWS DynamoDB**: NoSQL Database using Single Table Design with Global Secondary Indexes (GSI).
- **AWS CloudWatch Logs**: Log Groups managed by the template, automatically deleted with the stack (retention: 14 days).
- **AWS SAM + CloudFormation**: Infrastructure-as-Code with multi-environment deployment.

### Created Resources

| Resource | Name | Type |
| :--- | :--- | :--- |
| DynamoDB Table | `PathsGamesBackend-<env>` | `AWS::DynamoDB::Table` |
| HTTP API (public) | `pathsgames-<env>` | `AWS::ApiGatewayV2::Api` — player/public routes |
| HTTP API (admin) | `pathsgames-<env>-admin` | `AWS::ApiGatewayV2::Api` — `/api/admin/**` only, gated by `AdminIpAuthorizer` |
| Lambda Echo | `pathsgames-<env>-EchoFunction` | Health check (`GET /api/echo/status`) |
| Lambda Auth | `pathsgames-<env>-AuthFunction` | Guest + admin authentication (11 routes) |
| Lambda Story | `pathsgames-<env>-StoryFunction` | Story catalog + admin + content (9 routes); story detail includes resolved `card` objects on difficulties, classes, character templates and traits |
| Lambda Match | `pathsgames-<env>-MatchFunction` | Match creation and listing (`POST /api/matches`, `GET /api/matches`, `GET /api/match/{uuid}/info`, `GET /api/admin/matches` with pagination & filters) |
| Lambda Content | `pathsgames-<env>-ContentFunction` | Content detail: cards, texts, creators (3 routes) |
| Lambda Seed | `pathsgames-<env>-SeedFunction` | Dev-only: inserts test data (stories, cards) |
| Lambda AdminIpAuthorizer | `pathsgames-<env>-AdminIpAuthorizer` | REQUEST authorizer (no caching) gating the admin HTTP API by source IP |
| Log Groups ×7 | `/aws/lambda/pathsgames-<env>-*` | One per Lambda above, deleted with the stack |

### Tagging

Every taggable resource (table, both HTTP APIs + stages, all 7 Lambdas, all 7 log groups, the
custom domain, the 6 nested stacks) carries the same seven tags:
- `CostCenter` = `Paths.games`
- `Environment` = `dev` | `test` | `production` (mapped from the `Environment` parameter — the
  parameter keeps `prod`, only the tag says `production`)
- `ManagedBy` = `CloudFormation`
- `Owner` = `AlNao`
- `Project` = `Paths.games.aws.serverless`
- `version` = the project version (e.g. `0.38.1`), from the template's `Version` parameter;
  its default, the `samconfig.toml` `version=` tag value, and `VERSION` in the root `.env` are
  kept in sync by `code/scripts/dev/bump-version.sh`.
- `Name` = a per-resource identifier: resources with an explicit name reuse it (table
  `PathsGamesBackend-<env>`, HTTP APIs `pathsgames-<env>` / `pathsgames-<env>-admin`, Lambdas
  `pathsgames-<env>-<Fn>`, log groups `/aws/lambda/pathsgames-<env>-<Fn>`); resources without
  one get `pathsgames-<env>-<service>` (e.g. `pathsgames-<env>-ApiStage`,
  `pathsgames-<env>-EchoModule`).

`Route`/`Integration`/`Authorizer`/`Permission`/`ApiMapping`/`RecordSet` resources do not support
tags. Stack-level `tags` in `samconfig.toml` (and `--tags` in `aws_backend_deploy.sh`) propagate
`CostCenter`/`Environment`/`ManagedBy`/`Owner`/`Project`/`version`/`Name` to every resource, nested
stacks included. That stack-level `Name=pathsgames-<env>` is what tags the root stack itself (a
CloudFormation stack has no `Tags` property in the template, so this is the only source for it);
every resource that sets its own `Name` in the template overrides the propagated value, so the
per-resource `Name`s above still apply everywhere except the root stack. Worth checking once after
the first deploy of a new environment, e.g. `aws lambda list-tags --resource <arn>` on one function
should show its own `Name`, not `pathsgames-<env>`.


### Additional commands

#### Create custom domain name

```bash
# Request a new ACM certificate
aws acm request-certificate \
    --domain-name "api-dev.paths.games" \
    --validation-method DNS \
    --region us-east-2
```

#### Yaml validation

```bash
# Validate the template
sam validate --lint --region us-east-2 --config-env dev
```

### Custom Domain Name

You can configure a custom domain name for the API by providing the following parameters at deployment time:
- `CustomDomainName`: The custom domain name (e.g., `api-test.paths.games`)
- `CustomDomainCertificateArn`: The ARN of the ACM certificate for the custom domain name
- `CustomDomainHostedZoneId`: The Hosted Zone ID of the custom domain name

### Complete Cleanup

When the stack is deleted (`sam delete`), **all** objects are removed:
- Lambda Functions, API Gateway, DynamoDB Table
- **CloudWatch Log Groups** (explicitly managed in the template with `DeletionPolicy: Delete`)

No orphaned objects remain in the AWS account.

## 🔐 Authentication

The Lambdas support two authentication modes:

1. **Real JWTs (HS256)**: Tokens issued by the Java backend, verified with the same secret key. Claims: `sub` (UUID), `username`, `role`, `type`, `exp`.
2. **Mock tokens**: `MOCK_ACCESS_{uuid}` tokens for local development and testing with users created via seed.

Verification is centralized in `lambda/common/jwt_utils.py` (pure Python stdlib, no external dependencies).

## 🗂️ Project Structure

```text
code/backend/aws/
├── template.yaml         # Unified AWS SAM template
├── samconfig.toml        # Environment configurations (dev, test, prod)
├── lambda/               # Function source code
│   ├── common/           # Shared code (db_utils, jwt_utils)
│   ├── auth/             # Guest login, sessions, admin guests (11 routes)
│   ├── authorizer/       # AdminIpAuthorizer: REQUEST authorizer for the admin HTTP API
│   ├── story/            # Catalog, categories, groups, enriched detail, import (9 routes)
│   ├── content/          # Content detail: cards, texts, creators (3 routes)
│   ├── match/            # Match creation and listing (POST, GET /api/matches, GET /api/admin/matches with pagination & filters)
│   ├── seed/             # Dev seed: inserts test users and stories
│   └── echo/             # Health check and diagnostics
└── README.md             # This file
```

## 🛠️ Data Mapping (PK/SK Example)

All entities coexist in the same table using a prefix for differentiation:

| Entity | Partition Key (PK) | Sort Key (SK) | GSI1_PK (Example) | GSI2_PK | GSI2_SK |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **User** | `USER#<uuid>` | `METADATA` | — | — | — |
| **Guest** | `USER#<uuid>` | `METADATA` | `GUEST_TOKEN#<token>` | `GUEST_LIST` | `USER#<uuid>` |
| **Story** | `STORY#<uuid>` | `METADATA` | — | `STORY_LIST` | `STORY#<uuid>` |
| **Card** | `CARD#<id>` | `METADATA` | — | — | — |
| **Match** | `MATCH#<uuid>` | `METADATA` | `USER_MATCHES#<uuid>` | `MATCH` | `{tsInsert:020d}#{uuid}` |
| **Character** | `MATCH#<uuid>` | `CHARACTER#<uuid>` | — | — | — |
| **Turn** | `MATCH#<uuid>` | `TURN#<characterUuid>` | — | — | — |
| **Log entry** | `MATCH#<uuid>` | `LOG#{ts_ms:013d}#{seq:06d}` | — | — | — |
| **Audit row** | `MATCH#<uuid>` | `AUDIT#{ts_ms:013d}#{seq:06d}` (one per request, entries in `rows`) | — | — | — |
| **Cache stamp** | `SYSTEM#cache` | `METADATA` | — | — | — |

### v0.37.5 — cost layout: log rows, gzipped stories, one write per request, INCLUDE indexes

Until v0.37.4 the match METADATA item embedded seven ever-growing log lists and was rewritten
whole (and replicated by two `ALL` indexes) at every action, while every action re-read the
~330 KB story item with a consistent read. The layout now is:

- **Logs are rows.** `match/logbook.py` queues every timeline entry on the match dict
  (`_pendingLogs`) and `logbook.persist(match)` — the only writer of the match item — turns
  them into `LOG#` items already in the shape `GET /api/matches/{uuid}/logs` answers. Rows the
  timeline never shows (edge states, choice history, story progress) are packed in **one**
  `AUDIT#` item per request (`rows: [...]`, 1 WRU, never read back). `logCount` on METADATA is
  the `total` of the logs endpoint, `logSeq` keeps sort keys unique inside one millisecond.
- **One read, one write per row per request** (`match/repo.py`): `lambda_handler` opens a
  unit of work, the METADATA item / roster / turn queue are read once and every step works on
  the same dicts, `repo.save` queues a snapshot and `flush()` batch-writes the dirty set at the
  end. A request that persists twice (an event that ends the time unit) still writes the match
  item once. Outside a request `repo` is write-through, so helpers stay unit-testable.
- **Stories travel gzipped** (`db_utils._pack/_unpack`): every list/map of a `STORY#` item
  except `summary` is one Binary `_gz` attribute (the tutorial story: 334 KB → 75 KB, 11 ms to
  pack, 3 ms to unpack). A cold read costs ~10 RRU instead of ~41, a write ~76 WRU instead of
  ~326, and the 400 KB item limit is far away. Transparent to every handler.
- **Derived state on METADATA** replaces every scan of the old lists: `executedEventIds` (ONCE
  gating), `eventMarkers` (`{idEvent: {executed, selected}}`, the open-choice cycle),
  `visitedLocationIds` (fog of war). The location state is **sparse**: only the start location
  and the ones with a counter get a row at creation, a visit adds one; the API still answers
  one entry per story location (all-zero when there is no row, uuid = uuid5(match, location)).
- **Partition reads by prefix**: characters and turn rows are `Query PK + begins_with(SK)`
  (`db_utils.query_sk_prefix`), never the whole partition. Read-only routes (info, weather,
  logs, players, registry, missions, clock, admin GETs, admin story entity GETs) use
  eventually consistent reads: half the RRU.
- **Story cache** (`common/story_cache.py`): a warm container serves the story from memory for
  `STORY_CACHE_TTL_SECONDS` (template parameter `StoryCacheTtlSeconds`, default 3600, `0` = off)
  and re-reads it when `SYSTEM#cache` (one consistent 1-RRU read per invocation) carries a
  newer stamp for that story. Every admin story write bumps the story's stamp;
  `POST /api/admin/cache/flush` bumps the global one so every container drops everything.
- **Two INCLUDE indexes, no `ALL`**: `GSI1` = "by owner" (`USER_MATCHES#<uuid>` for
  `GET /api/matches`, `GUEST_TOKEN#<token>` for the guest resume), `GSI2` = "by type" (`MATCH`
  for the admin list, `STORY_LIST`, `GUEST_LIST`). Stories and guests carry ONE `summary` map
  with everything their list needs (`common/story_index.py`, `auth/handler.py`
  `GUEST_SUMMARY_FIELDS`) — DynamoDB projects at most 20 non-key attributes per index. No
  reader scans the table any more: the admin guest list, the purge, the stats and the Robot
  cleanup are all index Queries. Matches are deleted whole (`delete_all_by_pk`, keys-only
  query), so no `LOG#`/`CHARACTER#` orphans are left behind.
- **Infra**: every function runs on `arm64` (pure Python, −20 % on GB-s);
  `LambdaSystemLogLevel` (default `WARN`) drops the START/END/REPORT lines of every invocation
  (set `INFO` to read `Max Memory Used` again); `TableBillingMode` lets a dev table run
  `PROVISIONED` inside the always-free 25 RCU/WCU (`samconfig.toml` dev: 10/10 on the table,
  5/5 on each GSI; prod stays `PAY_PER_REQUEST`). Switch dev back to on-demand before a k6 run.

Per gameplay action the estimate goes from ~93 RRU + ~70 WRU (v0.37.4) to ~5 RRU + ~14 WRU
(story cached, match item ~4 KB written once, one small row per log entry, one audit row,
two INCLUDE replicas of ~1 KB).

**GSI2 — "by type" index** (added v0.28.1): enables a single newest-first **Query** on all match items without scanning the full table. `GSI2_PK` is the constant string `"MATCH"`; `GSI2_SK` is a zero-padded epoch timestamp followed by the UUID, ensuring natural descending order. The `sinceDays` filter uses a range condition on `GSI2_SK`; `status`, `userUuid`, `storyUuid` are applied as FilterExpression.

Cards are stored as standalone items (`PK=CARD#<id>`) and resolved on-the-fly during story detail requests. The `_build_card()` helper in `story/handler.py` fetches the card from DynamoDB and maps its fields (urlImage, alternativeImage, awesomeIcon, styleMain, styleDetail, styleImageLittle, styleImageMedium, styleImageLarge, cardType, localised title/description/copyrightText, linkCopyright). Sub-entities that reference a card (difficulties, characterTemplates, classes, traits) expose both `idCard` (integer) and the fully resolved `card` object in the API response.

## 🚀 Deployment with AWS SAM

The project uses **AWS SAM** to handle packaging and deployment across different environments.

### Prerequisites
- Install [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html).
- Configure AWS credentials (`aws configure`).
- Create the S3 bucket for CloudFormation artifacts: `pathsgames-test-iac` (dev, test — Ohio) /
  `pathsgames-production-iac` (prod — N. Virginia).

### Main Commands

| Operation | Command |
| :--- | :--- |
| **Validate** | `sam validate --lint` |
| **Build** | `sam build` |
| **Deploy (Dev)** | `sam deploy --config-env dev` |
| **Deploy (Test)** | `sam deploy --config-env test` |
| **Deploy (Prod)** | `sam deploy --config-env prod` |
| **Real-time Logs** | `sam logs -f --stack-name pathsgames-dev` |
| **Delete stack** | `sam delete --config-env dev` |
| **Read API url** | `API_URL=$(aws cloudformation describe-stacks --stack-name pathsgames-dev --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text)` |
| **Seed test users** | `curl -X POST "$API_URL/api/dev/seed" -H "Content-Type: application/json" -d '{}'` |

### Environment Configuration (`samconfig.toml`)

| Parameter | Dev | Test | Prod |
| :--- | :--- | :--- | :--- |
| Stack name | `pathsgames-dev` | `pathsgames-test` | `pathsgames-prod` |
| S3 bucket | `pathsgames-test-iac` | `pathsgames-test-iac` | `pathsgames-production-iac` |
| Region | `us-east-2` (Ohio) | `us-east-2` (Ohio) | `us-east-1` (N. Virginia) |
| `TableBillingMode` | `PROVISIONED` (10/10 table, 5/5 per GSI) | `PAY_PER_REQUEST` | `PAY_PER_REQUEST` |
| `LambdaSystemLogLevel` | `WARN` | `WARN` | `WARN` |
| `StoryCacheTtlSeconds` | `3600` | `3600` | `3600` |

`sam deploy` does not merge a config-env with `[default]`: each of `dev`/`test`/`prod` is
self-contained, including its stack-level `tags`. `test` exists because `dev` alone already
uses 20 of the region's always-free 25 RCU/WCU, so a second `PROVISIONED` table in the same
region would not fit; `test` runs `PAY_PER_REQUEST` instead. `code/scripts/test/aws/aws_backend_deploy.sh`
and `aws_backend_remove.sh` take a `[dev|test]` CLI argument that also selects the matching
stack (`pathsgames-<env>`); production is only ever deployed via `sam deploy --config-env prod`.

The `deploy` command output will provide the **API Endpoint URL** to be configured in the frontend.

---

## 🧐 Why one table? (Single Table Design)

In DynamoDB, the modern best practice is to use **a single table** instead of one table per entity. Here's why we chose this path for Paths Games:

### 1. Minimal Costs 📉
DynamoDB bills based on read/write capacity units (RCU/WCU) or per request. With a single table, we centralize capacity and optimize spending.

### 2. High Performance & Pre-calculated Joins ⚡
We model data so that related entities share the same **Partition Key (PK)** but have different **Sort Keys (SK)**. Thus, with a single query, we can download everything needed for an operation, achieving sub-10ms latencies.

### 3. Unlimited Horizontal Scalability 🌐
AWS manages the scaling of a single table transparently.

### 4. Operational Simplicity 🛠️
One set of IAM Roles, one backup plan, and one point of monitoring on CloudWatch. Fewer moving parts mean less chance of error.

---

## 📝 Changelog

### v0.39.1 — Robot test-data bugfix + DynamoDB TTL

- **Bugfix**: `_test_marker()` in `lambda/auth/handler.py` honoured the `X-Test-Marker` header
  (tags a guest `robottest_…` for cleanup) only on `ENV=dev`; the Robot suites run against the
  `test` stack, so ~416 tagged guests per run were created as untracked `guest_…` rows instead
  (the `test` table reached 29,237 items / 18.9 MB, ~28k of them guests). Now accepts `ENV` in
  `dev`/`test` (prod unchanged).
- **New DynamoDB TTL**: `lambda/common/test_data_ttl.py` (env `ROBOT_TEST_DATA_TTL_HOURS`,
  dev/test only, 0/unset = disabled) sets a `ttl` attribute on robot-tagged guests
  (`auth/handler.py create_guest`) and on `robottest…`-named matches (`match/handler.py
  _create_match`); `match/repo.py` (`_inherit_ttl`) copies it to the match's
  `CHARACTER#`/`TURN#`/`LOG#`/`AUDIT#` rows. DynamoDB deletes expired rows for free, "within a
  few days". `seed/handler.py _handle_cleanup()` now skips rows that already carry a `ttl` (one
  extra eventually-consistent `get_item`) instead of deleting them; `purge_robot_test_data.py`
  is unchanged, so running it (e.g. weekly) still deletes robottest rows immediately — the TTL
  only saves cost the rest of the time.
- New template parameter `RobotTestDataTtlHours` (default `"0"`, i.e. disabled unless overridden)
  passed to `AuthModule`/`MatchModule` as `ROBOT_TEST_DATA_TTL_HOURS`.
  `code/scripts/test/aws/aws_backend_deploy.sh` passes `AWS_ROBOT_TEST_DATA_TTL_HOURS_TEST`
  (default `1`); `samconfig.toml`'s `dev`/`test`/`prod` config-envs don't override it, so a plain
  `sam deploy --config-env ...` leaves it disabled.

### v0.38.1 — Per-target `Project` tag

- `Project` tag now `Paths.games.aws.serverless` in `template.yaml`, the 6 nested `template/*.yaml` modules, `samconfig.toml` (all config-envs) and `aws_backend_deploy.sh`.

### v0.38.0 — Resource tagging & `test` deploy environment

- **`template.yaml`** + the 6 nested `template/*.yaml` modules: old `project`/`env` tags
  replaced everywhere (table, both HTTP APIs + stages, all 7 Lambdas, all 7 log groups, the
  custom domain, all 6 nested stacks) with `CostCenter=Paths.games`,
  `Environment=dev|test|production`, `ManagedBy=CloudFormation`, `Owner=AlNao`,
  `Project=Paths.games`. New `Mappings.EnvironmentTags` maps the `Environment` parameter
  (`dev`/`test`/`prod`) to its tag value (`prod` → `production`); nested stacks receive a new
  `EnvironmentTag` parameter.
- **`samconfig.toml`** rewritten: three config-envs (`dev`, `test`, `prod`) plus `default`=dev,
  each with stack-level `tags` (CloudFormation propagates them to every resource, nested stacks
  included). New `test` config-env (`pathsgames-test`, `us-east-2`, `PAY_PER_REQUEST` — `dev`
  already uses 20 of the region's always-free 25 RCU/WCU). `prod` gains its own bucket/region
  for the first time (`us-east-1`, `s3://pathsgames-production-iac/production/backend/`).
- **`code/scripts/test/aws/aws_backend_deploy.sh`** / **`aws_backend_remove.sh`**: accept a
  `[dev|test]` CLI argument that also selects the matching stack (`pathsgames-<env>`), guarded
  so a stack name not ending in `-<env>` is refused (a mismatch would rename the DynamoDB
  table); the deploy script passes `--tags` with the five tags.
- **`version` tag**: new root parameter `Version` (default kept in sync with `VERSION` in the
  root `.env` by `bump-version.sh` steps `[10/6]`/`[11/6]`), tagged on every resource and passed
  to every nested stack; `samconfig.toml` stack-level `tags` gained `version=<VERSION>` in all
  three config-envs; `aws_backend_deploy.sh` reads `VERSION` from `.env` (falls back to the
  `pom.xml` version with a WARNING, errors if neither exists) and passes it as both
  `--tags ... version=$VERSION` and `--parameter-overrides Version=$VERSION`.
- **`Name` tag**: every taggable resource also gets a per-resource `Name` (explicit-name
  resources reuse their name; the rest get `pathsgames-<env>-<service>`, e.g. API stages and
  nested stacks) — template-only, not part of the `samconfig.toml` stack-level tags.
- **Root-stack `Name` tag** (follow-up): the root stack has no `Tags` property in the template,
  so it had no `Name` tag until now; `samconfig.toml` stack-level `tags` gain a leading
  `Name=pathsgames-<env>` in every config-env, and `aws_backend_deploy.sh`'s `--tags` gain
  `Name=$AWS_STACK_NAME_TEST`. Resource-level `Name` in the template still overrides it for
  every other resource.
- No API contract or DynamoDB item-shape change.

### v0.29.3 — Forced movement via event effects

- **`lambda/match/events.py`**: new `apply_location(...)` helper. An executed
  `list_events_effects` row that carries `idLocation` now MOVES every recipient of that row
  (usual `target`/`target_class` scope) straight to that location, **skipping the whole
  movement check procedure** — no neighbor check, no energy cost, no availability verdict,
  no capacity check.
- **`lambda/match/handler.py`**: builds a story location id→uuid map so an authored
  `idLocation` that matches no location is silently skipped (not an error); a move to the
  recipient's current location is a no-op. Each real move appends a cost-0 entry to the
  match item's `movementLog` (so the Match Logs timeline and the fog-of-war visited set stay
  correct) and sets the new `movementApplied` flag plus a `locationChanges` list
  (`{characterUuid, fromLocationUuid, toLocationUuid}`) on the execute-event response. Later
  effects in the same chain resolving `target=ALL` use the recipient's new location.
- **`lambda/seed/handler.py`**: the tutorial story gains location 3 "Hidden Grove"
  (`loc-tutorial-3`, deliberately **no** neighbor edge to anything), event 28
  `evt-step29-teleport` "Secret Passage" (`costEnery` 2) and effect 14
  (`idLocation: 3`, `target: ONLY_ONE`). The cost is 2 on purpose — the Robot lookup
  "Event Uuid By Cost 1" must keep meaning the plain (non-teleport) event.
- No DynamoDB item shape change beyond the new `movementLog`/response fields already
  supported by the existing schema. See `wiki/documentation_v0/Step29_NormalEvents.md` —
  "Forced movement (v0.29.3)" and `wiki/documentation_v0/Step28_MovementSystem.md` —
  "Step 0.29.3 (cross-reference)".

### v0.29.1 — Movement availability verdict on `/info`

- Every `neighbors[]` entry under `locationsActive[]` on `GET /api/match/{uuid}/info` now
  carries `available`/`reason`, mirroring the `available`/`reason` flag already published
  for events (Step 29). New pure checker `lambda/match/movements.py`, sharing the same
  8-code order used by the movement-start handler: `CHARACTER_CANNOT_ACT` →
  `MATCH_NOT_RUNNING` → `COMA` → `SLEEPING` → `NOT_A_NEIGHBOR` →
  `MOVEMENT_CONDITION_NOT_MET` → `OVERWEIGHT` → `INSUFFICIENT_ENERGY` → `LOCATION_FULL`.
- `handler.py`'s `_start_movement` refactored to call the checker instead of its own
  if-chain — same logic, same codes, one source of truth with the `/info` verdict loop.
- The check context (character state, weather, per-location character counts, registry) is
  loaded once per request; no per-neighbor query.
- No DynamoDB item shape change. OpenAPI `v0.19.0-match-creation-api.yaml` `LocationNeighborInfo`
  schema updated. See `wiki/documentation_v0/Step28_MovementSystem.md` — "Step 0.29.0 (addendum):
  Movement Availability Verdict on /info".

### v0.28.6 — Bugfix: fog-of-war leak on neighbor location cards

- **`lambda/match/handler.py`**: The v0.28.5 card enrichment below leaked the card of
  locations the match had **never visited**, via the neighbor sub-lists it added. Fixed
  by gating the neighbor's location-card resolution on the visited set:
  - `_detail_from_item` now computes `visited_loc_ids` (character positions ∪ every
    `movementLog` entry's `idLocationFrom`/`idLocationTo`) and passes it into
    `_build_locations_active(..., visited_loc_ids)`, which nulls only the **fallback**
    to `other.get("idCard")` when the destination is unvisited — an authored
    `n.get("idCard")` link card on the neighbor edge itself is always kept.
  - `_visited_locations_payload` already tracked visited ids in its `seen` set; it now
    nulls a neighbor's `idCard`/`card` when the destination is not in `seen`.
- **Unit tests**: `tests/test_match_handler.py` and `tests/test_movement_handler.py` gain
  regression tests for both the hide-when-unvisited and keep-authored-link-card cases.
  416 Lambda unit tests pass.
- **Robot**: new backend-agnostic test file
  `code/tests/robot/tests/28_movement/location_fog_of_war.robot` (4 tests): hides
  `card`/`idCard` on unvisited neighbors in `GET /locations`; the card reappears (and
  resolves via `/content`) after moving into that location; `GET /info` never leaks the
  location card ahead of the visit; the admin locations view applies the same gating.
- No API contract change — nullability only. See
  `wiki/documentation_v0/Step28_MovementSystem.md` §14.

### v0.28.5 — Location cards on `GET /locations`

- **`lambda/match/handler.py`**: `_visited_locations_payload(match, match_uuid, lang='en')`
  now resolves a full `card` object (not just `idCard`) for every visited location and
  every neighbor, reusing the existing `resolve_card_from_raw` helper against the story's
  `raw_cards`/`raw_texts` — the same resolution path already used by `GET /api/match/{uuid}/info`.
  `_get_locations` and `_get_admin_locations` now read the optional `lang` query-string
  parameter (default `en`) and pass it through. No change to the visited-locations/neighbor
  lookup logic itself.
- **Unit tests**: 414 Lambda unit tests pass.
- **Robot**: new test file `code/tests/robot/tests/28_movement/location_cards.robot`
  (backend-agnostic, 5 tests: card per location, card per neighbor, full `CardInfo`
  fields, `?lang=` param, admin view matches player view).
- **Frontend**: this enrichment feeds the new interactive world map in react-game
  (`Map.jsx`/`mapGraph.js`/`MapCard.jsx`), which renders a photo for every visited
  location without a second round-trip per node. See
  `wiki/documentation_v0/Step28_MovementSystem.md` §12–13.

### v0.28.2 — AWS bugfix: neighbor `cardBack` desync

- **`lambda/match/handler.py`**: Added `_story_neighbors(story)` helper that returns
  the authoritative neighbor list for a STORY item. The AWS DynamoDB item carries two
  separate arrays: `locationNeighbors` (written by admin CRUD) and `neighbors` (written
  by seed/import). Before this fix, the gameplay engine read only `neighbors`, so admin
  edits to `idCard`, `idCardBack`, `direction`, or `energyCost` were invisible to
  `GET /api/match/{uuid}/info`, `POST /api/gameplay/{uuid}/movements/start`, and
  `GET /api/match/{uuid}/locations`. The helper reads `locationNeighbors` first and
  falls back to `neighbors` for seed stories that predate admin edits. Applied at the
  three gameplay read-points: `_build_locations_active` (match-info),
  `_find_edge` (movement validation), `_build_locations_visited` (locations query).
- **`tests/test_match_handler.py`**: New regression test
  `test_match_info_neighbor_cardback_reads_admin_edited_location_neighbors` — asserts
  that a stale `neighbors` copy does not shadow the `locationNeighbors` admin edit.
- **Unit tests**: 407 Lambda unit tests pass.
- **Robot**: New suite `code/tests/robot/tests/29_neighbor_card_back/neighbor_card_back.robot`
  (backend-agnostic): admin sets `idCard`+`idCardBack` on a neighbor touching the start
  location; player reads `GET /api/match/{uuid}/info?lang=en`; asserts distinct
  `card`/`cardBack` UUIDs, both resolving as real catalog cards; teardown restores
  originals. See `wiki/documentation_v0/Step29_NeighborCardBack.md` for full details.
- **Note**: `api-test.paths.games` requires a Lambda redeployment (`sam deploy
  --config-env dev`) to apply this fix.

### v0.28.1 — Admin match listing: pagination, filtering, GSI2 index

- **`template.yaml`**: New DynamoDB **GSI2** index `PathsGamesGSI2` on attribute pair `GSI2_PK` / `GSI2_SK`. Every MATCH METADATA item now carries `GSI2_PK="MATCH"` and `GSI2_SK="{tsInsert:020d}#{uuid}"`.
- **`lambda/match/handler.py`**: `_list_all_matches` rewritten to call `db_utils.query_index_page` on GSI2 instead of `scan_pk_prefix`. Accepts query params `limit` (default 50, clamped to [1, 200]), `cursor`, `status`, `userUuid`, `storyUuid`, `sinceDays`. Returns paged envelope `{"items": [...], "nextCursor": string|null, "limit": int}`.
- **`lambda/common/db_utils.py`**: New helpers `query_index_page`, `encode_cursor`, `decode_cursor` (cursor = base64 of DynamoDB `LastEvaluatedKey`), and `backfill_gsi2_matches` (one-time migration adding GSI2 keys to pre-v0.28.1 matches; idempotent).
- **`scripts/backfill_gsi2_matches.py`**: CLI wrapper for the migration — run once per environment after deploy (`--env dev` / `--table ...`, `--dry-run` supported) so existing matches appear in the admin list.
- **Unit tests**: 406 Lambda unit tests pass.
- **Robot**: `List All Matches` keyword in `resources/matches.resource` accepts optional `params`; new tests in `19_match/match_creation.robot` for paged envelope shape, limit/cursor pagination, and status filter.

### v0.19.10 — Admin-wide match listing

- **`lambda/match/handler.py`**: New `_list_all_matches` handler implements `GET /api/admin/matches`. Requires ADMIN role (checked explicitly from the decoded JWT claims). Uses `db_utils.scan_pk_prefix` to scan all `MATCH#` items in DynamoDB, returning them newest-first. Returns the same `MatchSummary` shape as `GET /api/matches` but covers all players.
- **`template/match.yaml`**: New `ListAllMatchesRoute` event registered on the Lambda.
- **Unit tests**: 160 Lambda unit tests pass.
- **Robot**: `code/tests/robot/tests/19_match/match_creation.robot` — new tests for admin 200 and non-admin 403. New `List All Matches` keyword in `resources/matches.resource`.

### v0.19.9 — Match creation loadout fields

- **`lambda/match/handler.py`** (or the relevant Lambda function): `POST /api/matches` now accepts and persists `characterTemplateUuid`, `classUuid`, `traitUuids` (stored comma-separated in DynamoDB item attribute `trait_uuids`), and `singlePlayer` (integer flag, defaults to `1`). Previously `characterTemplateUuid` was accepted but discarded; the other three fields are new. All four are echoed back on `MatchSummary` / `GET /api/match/{uuid}/info`.
- **Unit tests**: 27 Lambda unit tests pass.
- **Robot**: `code/tests/robot/tests/19_match/match_creation.robot` — new `Create Match With Loadout` keyword in `matches.resource`; new test verifies the complete loadout round-trips through `GET /api/match/{uuid}/info`.

### v0.19.7 — Seven stat fields on difficulties

- **`lambda/story/handler.py`**: `DifficultyResponse` build path extended to include the 7 new stat fields (`life`, `energy`, `sad`, `dexterity`, `intelligence`, `constitution`, `weight`) in the story detail response. Import path (`import_story`) persists the same 7 fields from the request payload, defaulting to `life=100, energy=100, sad=0, dexterity=10, intelligence=10, constitution=10, weight=10` when absent.
- **`lambda/seed/handler.py`**: All 3 demo stories in the seed dataset now include the 7 stat fields on each difficulty entry so Robot suite `14_stories/difficulty_stat_fields.robot` passes against the AWS endpoint.
- **Robot**: New suite `code/tests/robot/tests/14_stories/difficulty_stat_fields.robot` — 4 tests covering presence/type, expected seed values for the tutorial, and sign constraints; all pass (4/4).

### v0.19.4 — difficulties/classes/traits idTextName/idTextDescription cross-backend consistency

- **`lambda/story/handler.py`** (`_build_full_story`): `import_story` now persists `idTextName` and `idTextDescription` as raw integer fields on the `difficulties`, `classes`, and `traits` DynamoDB items. Previously these FK integers were discarded on import for all three entities, making the AWS backend inconsistent with Java (`list_stories_difficulty`, `list_classes`, `list_traits` all have `id_text_name`/`id_text_description` columns via `BaseStoryEntity`), Python. The other inline-built entities (`characterTemplates`) were fixed in the same release (see below); pass-through entities built via `_assign_ids` already preserved all fields and did not need changes.

### v0.19.4 — character_templates idTextName/idTextDescription cross-backend consistency

- **`lambda/story/handler.py`** (`_build_full_story`): `import_story` now persists `idTextName` and `idTextDescription` as raw integer fields on the `characterTemplates` DynamoDB item, alongside the existing `texts` dict. Previously these FK integers were discarded on import, making the AWS backend inconsistent with Java, Python, and AWS (all of which store `id_text_name`/`id_text_description` in `list_character_templates`).
- **Robot**: `14_admin/story_import.robot` — "Import Explicit ID For list_character_templates Returns 201" extended to include `idCard`, `idTextName`, `idTextDescription` in the payload. New test "Import list_character_templates Round-Trips idTextName And idTextDescription" imports a story with a character template, reads it back via `GET /api/admin/stories/{uuid}/character-templates`, and asserts all three FK fields are present — validates consistency across all four backends.

### v0.19.4 — Bug fix: card urlImage/imageUrl key normalization

- **`lambda/story/handler.py`**: Canonical DynamoDB storage key is **`urlImage`** (matching Java import JSON and JPA); `imageUrl` is never stored. `import_story` writes only `urlImage`. `_normalize_entity_input` (admin write path) promotes a legacy `imageUrl` value to `urlImage` and drops the alias. `_normalize_entity_output` (admin read path) surfaces a legacy-only `imageUrl` as `urlImage` for the admin form. Public readers (`_find_card_from_raw`, `get_card`) read `card.get('urlImage') or card.get('imageUrl')` and emit `imageUrl` in the public API response.

### v0.19.4 — card_type field on list_cards

- **`lambda/content/handler.py`** and **`lambda/story/handler.py`**: New nullable `cardType` field added to the card model and mapped in `_build_card()`.
- **`lambda/seed/handler.py`**: Seed card data updated to include `cardType` (set to `"character"` in the robot-facing seed entry to cover the round-trip Robot test).
- **Robot**: `17_admin_crud/admin_crud.robot` extended to assert `cardType=character` round-trips through create and GET.

### v0.19.3 — Card image-size style fields

- **`lambda/content/handler.py`** and **`lambda/story/handler.py`**: Three new nullable fields (`styleImageLittle`, `styleImageMedium`, `styleImageLarge`) added to the card item model and mapped in `_build_card()`.
- **`lambda/seed/handler.py`**: Seed card data updated to include the new columns (all `null` by default in seed).

### v0.19.2 — Card resolution in story detail

- **`lambda/story/handler.py`**: Added `_build_card(id_card, lang)` helper that fetches a `CARD#<id>` item from DynamoDB and returns a fully localised card object. Story detail now includes resolved `card` on every difficulty, characterTemplate, class, and trait sub-entity.
- **`import_story`**: `idCard` field is now persisted for difficulties, characterTemplates, classes, and traits during story import, keeping parity with the Java reference backend.
- **`lambda/seed/handler.py`**: Seed data updated — DEMO_1 difficulties now include card data (`idCard`, `urlImage`) so the regression robot test `story_card_populated` passes on the AWS environment.

### v0.19.1 — Match creation (single-player)

- Added single-player match creation endpoints under `/api/gameplay/{uuid_match}/`.
- Extended Auth Lambda with match-scoped token validation.

### v0.19.0 — Story admin CRUD + Robot E2E baseline

- Story admin CRUD (create, update, delete) via `StoryFunction`.
- Robot Framework suites `14_admin`, `15_story_content`, `16_content_detail`, `17_admin_crud` verified against AWS endpoint.

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
