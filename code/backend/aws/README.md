# Paths Games - AWS Serverless Backend

Welcome to the **Serverless** version of the Paths Games backend! This project offers a high-performance, scalable, and extremely cost-effective alternative to traditional backends (Java/Python/PHP/Node.js) based on relational databases.

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
| Lambda Match | `pathsgames-<env>-MatchFunction` | Match creation and listing (`POST /api/matches`, `GET /api/matches`, `GET /api/match/{uuid}/info`, `GET /api/admin/matches`) |
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
│   ├── match/            # Match creation and listing (POST, GET /api/matches, GET /api/admin/matches)
│   ├── seed/             # Dev seed: inserts test users and stories
│   └── echo/             # Health check and diagnostics
└── README.md             # This file
```

## 🛠️ Data Mapping (PK/SK Example)

All entities coexist in the same table using a prefix for differentiation:

| Entity | Partition Key (PK) | Sort Key (SK) | GSI1_PK (Example) |
| :--- | :--- | :--- | :--- |
| **User** | `USER#<uuid>` | `METADATA` | `USER_LIST` |
| **Story** | `STORY#<uuid>` | `METADATA` | `STORY_LIST` |
| **Card** | `CARD#<id>` | `METADATA` | — |
| **Match** | `MATCH#<uuid>` | `METADATA` | `USER#<uuid>` |

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

- **`lambda/story/handler.py`** (`_build_full_story`): `import_story` now persists `idTextName` and `idTextDescription` as raw integer fields on the `difficulties`, `classes`, and `traits` DynamoDB items. Previously these FK integers were discarded on import for all three entities, making the AWS backend inconsistent with Java (`list_stories_difficulty`, `list_classes`, `list_traits` all have `id_text_name`/`id_text_description` columns via `BaseStoryEntity`), Python, and PHP. The other inline-built entities (`characterTemplates`) were fixed in the same release (see below); pass-through entities built via `_assign_ids` already preserved all fields and did not need changes.

### v0.19.4 — character_templates idTextName/idTextDescription cross-backend consistency

- **`lambda/story/handler.py`** (`_build_full_story`): `import_story` now persists `idTextName` and `idTextDescription` as raw integer fields on the `characterTemplates` DynamoDB item, alongside the existing `texts` dict. Previously these FK integers were discarded on import, making the AWS backend inconsistent with Java, Python, and PHP (all of which store `id_text_name`/`id_text_description` in `list_character_templates`).
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
