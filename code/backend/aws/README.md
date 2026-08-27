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
| HTTP API | — | `AWS::Serverless::HttpApi` |
| Lambda Echo | `pathsgames-<env>-EchoFunction` | Health check (`GET /api/echo/status`) |
| Lambda Auth | `pathsgames-<env>-AuthFunction` | Guest + admin authentication (11 routes) |
| Lambda Story | `pathsgames-<env>-StoryFunction` | Story catalog + admin + content (9 routes); story detail includes resolved `card` objects on difficulties, classes, character templates and traits |
| Lambda Match | `pathsgames-<env>-MatchFunction` | Match creation and listing (`POST /api/matches`, `GET /api/matches`, `GET /api/match/{uuid}/info`, `GET /api/admin/matches` with pagination & filters) |
| Lambda Seed | `pathsgames-<env>-SeedFunction` | Dev-only: inserts test data (stories, cards) |
| Log Groups ×5 | `/aws/lambda/pathsgames-<env>-*` | Deleted with the stack |

### Tagging

All resources are tagged with:
- `project` = `PathsGames`
- `env` = `dev` | `prod`


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
├── samconfig.toml        # Environment configurations (dev, prod)
├── lambda/               # Function source code
│   ├── common/           # Shared code (db_utils, jwt_utils)
│   ├── auth/             # Guest login, sessions, admin guests (11 routes)
│   ├── story/            # Catalog, categories, groups, enriched detail, import (9 routes)
│   ├── match/            # Match creation and listing (POST, GET /api/matches, GET /api/admin/matches with pagination & filters)
│   ├── seed/             # Dev seed: inserts test users and stories
│   └── echo/             # Health check and diagnostics
└── README.md             # This file
```

## 🛠️ Data Mapping (PK/SK Example)

All entities coexist in the same table using a prefix for differentiation:

| Entity | Partition Key (PK) | Sort Key (SK) | GSI1_PK (Example) | GSI2_PK | GSI2_SK |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **User** | `USER#<uuid>` | `METADATA` | `USER_LIST` | — | — |
| **Story** | `STORY#<uuid>` | `METADATA` | `STORY_LIST` | — | — |
| **Card** | `CARD#<id>` | `METADATA` | — | — | — |
| **Match** | `MATCH#<uuid>` | `METADATA` | `USER#<uuid>` | `MATCH` | `{tsInsert:020d}#{uuid}` |

**GSI2 — "by type" index** (added v0.28.1): enables a single newest-first **Query** on all match items without scanning the full table. `GSI2_PK` is the constant string `"MATCH"`; `GSI2_SK` is a zero-padded epoch timestamp followed by the UUID, ensuring natural descending order. The `sinceDays` filter uses a range condition on `GSI2_SK`; `status`, `userUuid`, `storyUuid` are applied as FilterExpression. Matches created before v0.28.1 lack GSI2 keys and will not appear in the admin list until their items are rewritten. **After deploying the GSI2 template, run the one-time backfill once per environment** to index existing matches:

```bash
# from code/backend/aws/ (needs AWS creds with DynamoDB scan/update on the table)
python scripts/backfill_gsi2_matches.py --env dev            # or --table PathsGamesBackend-prod
python scripts/backfill_gsi2_matches.py --env dev --dry-run  # preview only, no writes
```

The script is idempotent (rows already carrying `GSI2_PK` are skipped) and reuses `db_utils.backfill_gsi2_matches`, which writes the exact `GSI2_SK` format `_create_match` uses, so backfilled and new rows sort together.

Cards are stored as standalone items (`PK=CARD#<id>`) and resolved on-the-fly during story detail requests. The `_build_card()` helper in `story/handler.py` fetches the card from DynamoDB and maps its fields (urlImage, alternativeImage, awesomeIcon, styleMain, styleDetail, styleImageLittle, styleImageMedium, styleImageLarge, cardType, localised title/description/copyrightText, linkCopyright). Sub-entities that reference a card (difficulties, characterTemplates, classes, traits) expose both `idCard` (integer) and the fully resolved `card` object in the API response.

## 🚀 Deployment with AWS SAM

The project uses **AWS SAM** to handle packaging and deployment across different environments.

### Prerequisites
- Install [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html).
- Configure AWS credentials (`aws configure`).
- Create an S3 bucket for CloudFormation templates (e.g., `pathsgames-dev`).

### Main Commands

| Operation | Command |
| :--- | :--- |
| **Validate** | `sam validate --lint` |
| **Build** | `sam build` |
| **Deploy (Dev)** | `sam deploy --config-env dev` |
| **Deploy (Prod)** | `sam deploy --config-env prod` |
| **Real-time Logs** | `sam logs -f --stack-name pathsgames-dev` |
| **Delete stack** | `sam delete --config-env dev` |
| **Read API url** | `API_URL=$(aws cloudformation describe-stacks --stack-name pathsgames-dev --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text)` |
| **Seed test users** | `curl -X POST "$API_URL/api/dev/seed" -H "Content-Type: application/json" -d '{}'` |

### Environment Configuration (`samconfig.toml`)

| Parameter | Dev | Prod |
| :--- | :--- | :--- |
| Stack name | `pathsgames-dev` | `pathsgames-prod` |
| S3 bucket | `pathsgames-dev` | `pathsgames-prod` |
| Region | `us-east-2` | — |

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
  supported by the existing schema. See `documentation_v0/Step29_NormalEvents.md` —
  "Forced movement (v0.29.3)" and `documentation_v0/Step28_MovementSystem.md` —
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
  schema updated. See `documentation_v0/Step28_MovementSystem.md` — "Step 0.29.0 (addendum):
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
  `documentation_v0/Step28_MovementSystem.md` §14.

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
  `documentation_v0/Step28_MovementSystem.md` §12–13.

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
  originals. See `documentation_v0/Step29_NeighborCardBack.md` for full details.
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





# < Paths Games />

All source code and information in this repository are the result of careful and patient development work by the developer team, who have made every effort to verify their correctness to the greatest extent possible. If part of the code or any content has been taken from external sources, the original provenance is always cited, in respect of transparency and intellectual property.

Some content and portions of code in this repository were also produced with the support of artificial intelligence tools, whose contribution helped enrich and accelerate the creation of the material. Every piece of information and code fragment has nevertheless been carefully checked and validated with the goal of ensuring the highest quality and reliability of the provided content.

For all details, in-depth information, or requests for clarification, please visit the [Paths.Games](https://paths.games/) website.

## License

Made with ❤️ by the <a href="https://github.com/gamespaths/pathsgames">paths.games dev team</a>

Public projects:
<a href="https://www.gnu.org/licenses/gpl-3.0" valign="middle"> <img src="https://img.shields.io/badge/License-GPL%20v3-blue?style=plastic" alt="GPL v3" valign="middle" /></a>
*Free Software!*

The software is distributed under the terms of the GNU General Public License v3.0. Use, modification, and redistribution are permitted, provided that any copy or derivative work is released under the same license. The content is provided "as is", without any warranty, express or implied.

Narrative Content & Assets: The story, dialogues, characters, sounds, music, art, and world-building (located in the `/data` folder) are NOT open source. They are licensed under Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 (CC BY-NC-ND 4.0).

(ITA) Il software è distribuito secondo i termini della GNU General Public License v3.0. L'uso, la modifica e la ridistribuzione sono consentiti, a condizione che ogni copia o lavoro derivato sia rilasciato con la stessa licenza. Il contenuto è fornito "così com'è", senza alcuna garanzia, esplicita o implicita.
