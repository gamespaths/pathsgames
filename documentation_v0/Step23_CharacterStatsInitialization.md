# Paths Games V0 - Step 23: Character Stats Initialization

This document describes the implementation of **Step 23** as requested in the Roadmap.

Step 23 hardens the trait selection layer that was laid down in Step 21. Step 21
already persisted `gaming_character_traits` rows and folded trait stat deltas into
the join-time formula; what Step 23 adds is **strict validation** of every selected
trait (unknown uuid → error, duplicate → error, class incompatibility → error, cost
budget exceeded → error) and a **class-filtered trait listing endpoint** so the
frontend can show only traits that are valid for the chosen class. Two new nullable
budget columns on `list_stories_difficulty` bound the total positive and total
negative trait cost a player may accumulate.

The relationship between Step 21 and Step 23 is therefore:

- **Step 21** computes and persists all starting stats including trait deltas; unknown
  trait uuids are silently ignored (lenient).
- **Step 23** replaces that leniency with strict validation, adds the
  class-compatibility filter on trait listing, and introduces the difficulty
  cost-budget mechanism.  The stat formula itself is **unchanged**.

---

## 1. Scope

Step 23 covers the following items from the roadmap:

- `GET /api/stories/{uuidStory}/classes/{uuidClass}/traits` — new public endpoint
  listing traits filtered by class compatibility.
- Strict trait validation on `POST /api/matches` (creator loadout) and
  `POST /api/matches/{uuidMatch}/join`: four new `400` error codes replace the
  previous silent-ignore behaviour for unknown or invalid trait uuids.
- Difficulty cost budgets: two new nullable columns
  `trait_cost_positive_budget` / `trait_cost_negative_budget` on
  `list_stories_difficulty` that bound how much positive and negative trait cost a
  player may select.  `NULL` means no limit.
- Flyway migrations for Java (SQLite and PostgreSQL); SQLAlchemy model update for
  Python; `database.sql` update for PHP; DynamoDB embedded field for AWS.
- `TraitSelectionValidator` (or equivalent) extracted as a shared service so both the
  create-match and join-match paths apply identical rules.
- Validation order on join: match → user → template → class (Step 21 rules) →
  difficulty → **traits** (Step 23 rules; difficulty is resolved first so its budgets
  are available during trait checks).
- Dev-seed enrichment across all four backends: new traits (including
  class-restricted and negative-cost variants) and budget values on the tutorial story
  difficulty rows.
- Backend unit tests for trait listing, cost validation, stat computation, and
  initialization edge cases.
- react-game multi-trait picker with live budget display and lock-out.
- react-admin difficulty entity fields for the two new budget columns.
- Robot Framework suite `23_trait_selection` — 10 backend-agnostic tests.

**Relationship to adjacent steps:** the stat formula introduced in Step 21 is not
modified.  The turn engine that consumes character instances to build the queue is
Step 25.

---

## 2. Endpoint APIs

The OpenAPI source of truth is
[`code/backend/java/adapter-rest/src/main/resources/openapi/v0.23.0-character-stats-api.yaml`](../code/backend/java/adapter-rest/src/main/resources/openapi/v0.23.0-character-stats-api.yaml).

### 2.1 `GET /api/stories/{uuidStory}/classes/{uuidClass}/traits` (NEW)

Public endpoint; no authentication required (consistent with other story-content
endpoints such as `GET /api/stories/{uuid}/classes`).

| Query param | Default | Description |
|-------------|---------|-------------|
| `lang`      | `en`    | Language code for localised name/description |

Filter rule: a trait is included when **both** conditions hold:

- `idClassPermitted` is `NULL` **or** equals the resolved class id.
- `idClassProhibited` is `NULL` **or** differs from the resolved class id.

| HTTP status | Condition |
|-------------|-----------|
| `200`       | Array of `TraitInfo` (see §3) |
| `404`       | `STORY_NOT_FOUND` — story uuid does not exist |
| `404`       | `CLASS_NOT_FOUND` — class uuid does not exist within the story |

### 2.2 `POST /api/matches` — creator loadout validation (extended)

The loadout stored at match creation time is now validated strictly.  An unknown
class uuid is treated as "no class" (not a hard error at this stage) so that
`TRAIT_NOT_COMPATIBLE` is still the signal when a class-restricted trait is selected
without a compatible class.

Four new `400` error codes (see §2.4) may be returned.

| HTTP status | Condition |
|-------------|-----------|
| `400`       | Any trait validation error (see §2.4) |
| All others  | Unchanged from Step 19 |

### 2.3 `POST /api/matches/{uuidMatch}/join` — join validation (extended)

Validation order:

1. Match exists and is joinable (Step 21).
2. User exists and is not banned (Step 21).
3. Template resolved and compatible (Step 21).
4. Class resolved and compatible with template (Step 21).
5. Difficulty resolved — **required before traits** so budgets are available.
6. Traits validated strictly (Step 23 — see §2.4).

| HTTP status | Condition |
|-------------|-----------|
| `400`       | Any trait validation error (see §2.4) |
| All others  | Unchanged from Step 21 |

### 2.4 New error codes (HTTP 400, both endpoints)

| Code | Trigger |
|------|---------|
| `TRAIT_NOT_FOUND` | A non-blank trait uuid in the request does not resolve to any trait in the story. **Behaviour change from Step 21:** previously unknown uuids were silently ignored; they are now rejected.  Blank uuids are still ignored. |
| `TRAIT_DUPLICATED` | The same trait uuid appears more than once in the selected list. |
| `TRAIT_NOT_COMPATIBLE` | The trait has `idClassPermitted` set and it differs from the selected class (or no class is selected), **or** `idClassProhibited` equals the selected class. |
| `TRAIT_COST_EXCEEDED` | The sum of `costPositive` across selected traits exceeds `difficulty.traitCostPositiveBudget`, **or** the sum of `costNegative` exceeds `difficulty.traitCostNegativeBudget`.  The two budgets are checked independently.  A `NULL` budget means no limit. |

---

## 3. DTOs and Domain Models

### 3.1 `TraitInfo` (new — returned by §2.1)

```json
{
  "uuid": "trait-uuid",
  "name": "Quick Reflexes",
  "description": "Increases dexterity at the cost of constitution.",
  "costPositive": 1,
  "costNegative": 0,
  "idClassPermitted": null,
  "idClassProhibited": null,
  "idCard": 42,
  "card": { /* CardInfoResponse */ },
  "life": 0,
  "energy": 0,
  "sad": 0,
  "dexterity": 2,
  "intelligence": 0,
  "constitution": -1,
  "weight": 0
}
```

### 3.2 `DifficultyInfo` / `DifficultyResponse` (extended)

Two new nullable integer fields are added to the existing difficulty payload so that
the frontend can display the remaining budget to the player:

| Field | Type | Notes |
|-------|------|-------|
| `traitCostPositiveBudget` | `Integer` (nullable) | `NULL` = unlimited |
| `traitCostNegativeBudget` | `Integer` (nullable) | `NULL` = unlimited |

The fields are present on the story-detail `difficulties[]` array and passed through
the admin difficulties CRUD (create / update / list).  Story import accepts them; the
Step 22 validator's `R6_STAT_RANGE` rule enforces non-negative values when present.

### 3.3 Java REST DTOs

| DTO | File (adapter-rest) | Purpose |
|-----|---------------------|---------|
| `TraitInfoResponse` | `dto/TraitInfoResponse.java` | Single element in the trait listing array |
| `DifficultyResponse` | `dto/DifficultyResponse.java` | Extended with `traitCostPositiveBudget` / `traitCostNegativeBudget` |

### 3.4 Java Core Domain Models

| Model | Package | Purpose |
|-------|---------|---------|
| `TraitsForClassResult` | `core/.../port/story/StoryQueryPort` (nested) | Port result for the new query |
| `TraitSelectionValidator` | `core/.../service/match/` | Shared validator used by both create and join paths |

New exception codes added to `CharacterJoinException.Code` and
`MatchCreationException.Code`: `TRAIT_NOT_FOUND`, `TRAIT_DUPLICATED`,
`TRAIT_NOT_COMPATIBLE`, `TRAIT_COST_EXCEEDED`.

---

## 4. Roles and Authentication

`GET /api/stories/{uuidStory}/classes/{uuidClass}/traits` is **public** — no bearer
token is required.  This is consistent with the rest of the story-content read
endpoints (categories, groups, card detail, etc.) established in Steps 15 and 16.

`POST /api/matches` and `POST /api/matches/{uuidMatch}/join` continue to require a
valid bearer token (`PLAYER` or `ADMIN` role) as established in Steps 19 and 21
respectively.  The new trait validation errors are returned with the same `400`
status regardless of role.

---

## 5. Tables

### 5.1 Schema change — `list_stories_difficulty`

Two new nullable `INTEGER` columns are added.  `NULL` means "no limit" and is the
default, making the migration fully backward-compatible.

| Column | Type | Notes |
|--------|------|-------|
| `trait_cost_positive_budget` | INTEGER (nullable) | Maximum sum of `cost_positive` across selected traits; NULL = unlimited |
| `trait_cost_negative_budget` | INTEGER (nullable) | Maximum sum of `cost_negative` across selected traits; NULL = unlimited |

**Java (SQLite):** `adapter-sqlite/src/main/resources/db/migration/v0/V0.23.1__add_difficulty_trait_budget_columns.sql`

**Java (PostgreSQL):** `adapter-postgres/src/main/resources/db/migration/v0/V0.23.1__add_difficulty_trait_budget_columns.sql`

**Python:** `StoryDifficultyEntity` in `app/adapters/persistence/story/models.py` gains the two columns.  The dev database is recreated by the robot launch script.

**PHP:** `database.sql` updated.  No migration framework is used by the PHP backend; existing dev databases must be recreated or altered manually.

**AWS:** `traitCostPositiveBudget` / `traitCostNegativeBudget` are embedded in the `difficulties[]` attribute of the `STORY#` DynamoDB item.

### 5.2 Existing tables read by the new endpoint

| Table | Read | Write | Notes |
|-------|:----:|:-----:|-------|
| `list_stories` | ✔ | | Validate story exists |
| `list_classes` | ✔ | | Validate class exists and get its id |
| `list_traits` | ✔ | | Source of trait rows; filter applied in query or service |
| `list_stories_difficulty` | ✔ | | Read `trait_cost_positive_budget` / `trait_cost_negative_budget` during join/create |

All other tables involved in character creation remain as documented in Step 21.

---

## 6. Business Logic

### 6.1 Stat formula (unchanged from Step 21 — formalised)

| Stat | Formula |
|------|---------|
| `dexterity` | `template.dexterityStart` + `class.dexterityBase` + `difficulty.dexterity` + Σ `trait.dexterity` + Σ `classBonus('dex')` |
| `intelligence` | `template.intelligenceStart` + `class.intelligenceBase` + `difficulty.intelligence` + Σ `trait.intelligence` + Σ `classBonus('int')` |
| `constitution` | `template.constitutionStart` + `class.constitutionBase` + `difficulty.constitution` + Σ `trait.constitution` + Σ `classBonus('con')` |
| `lifeMax` | `template.lifeMax` + `difficulty.life` + Σ `trait.life` + Σ `classBonus('life')` |
| `energyMax` | `template.energyMax` + `difficulty.energy` + Σ `trait.energy` + Σ `classBonus('energy')` |

`life = lifeMax`; `energy = energyMax`; `sad = 0`; initial location = story start
location (lowest id in `list_locations`); backpack food/magic/coin = 0;
`gaming_character_traits` rows persisted per selected trait.

### 6.2 `TraitSelectionValidator` — shared validation service

Extracted as a standalone domain service/class shared by both
`CharacterCommandService.joinMatch` and `MatchCommandService.createMatch`.

Validation steps (applied in order):

1. **Blank uuid filter** — entries with blank/null uuid are silently removed from the
   list before further checks (preserves backward-compatible behaviour for callers
   that may send empty strings as placeholder).
2. **`TRAIT_NOT_FOUND`** — each remaining uuid must resolve to a `list_traits` row
   within the story.  Unknown uuids cause immediate `400`.
3. **`TRAIT_DUPLICATED`** — after resolution the uuid list must be distinct.
4. **`TRAIT_NOT_COMPATIBLE`** — for every resolved trait:
   - If `idClassPermitted` is set and does not equal the resolved class id (or no
     class is selected) → `TRAIT_NOT_COMPATIBLE`.
   - If `idClassProhibited` equals the resolved class id → `TRAIT_NOT_COMPATIBLE`.
5. **`TRAIT_COST_EXCEEDED`** — compute Σ `costPositive` and Σ `costNegative` over
   resolved traits.  If `difficulty.traitCostPositiveBudget` is non-null and the sum
   exceeds it → `TRAIT_COST_EXCEEDED`.  Same for the negative budget.  The two
   budgets are independent.

On `createMatch` the class uuid is resolved leniently: an unknown uuid is treated as
"no class" (so a class-restricted trait will then fail `TRAIT_NOT_COMPATIBLE`).  No
new `CLASS_NOT_FOUND` error is introduced at create time.

On `joinMatch` the difficulty is loaded **before** this validator is invoked so the
budget values are available.

### 6.3 `StoryQueryService.listTraitsForClass`

1. Validate that the story exists; return `STORY_NOT_FOUND` if not.
2. Validate that the class exists within the story; return `CLASS_NOT_FOUND` if not.
3. Load all `list_traits` rows for the story.
4. Apply the filter:
   - Include when `idClassPermitted IS NULL OR idClassPermitted = resolvedClassId`.
   - **AND** `idClassProhibited IS NULL OR idClassProhibited != resolvedClassId`.
5. Return the filtered list as `TraitInfo` / `TraitsForClassResult`.

---

## 7. Test Cases

### 7.1 Java

| Test class | Scenarios covered |
|------------|-------------------|
| `CharacterCommandServiceTest` (extended) | `TraitValidation` nested suites: `TRAIT_NOT_FOUND` on unknown uuid; blank uuids ignored; `TRAIT_DUPLICATED`; `TRAIT_NOT_COMPATIBLE` (permitted mismatch; prohibited match); `TRAIT_COST_EXCEEDED` (positive budget; negative budget; both null = unlimited; one null one set). |
| `MatchCommandServiceTest` (extended) | `CreatorTraitValidation` nested suites: same four codes on the create-match path; unknown class uuid treated as no class. |
| `StoryQueryServiceTest` (extended) | `ListTraitsForClass` nested suite: story not found; class not found; unrestricted traits included; permitted-match included; permitted-mismatch excluded; prohibited-match excluded; prohibited-mismatch included. |

Run command:

```bash
mvn clean test
```

Result: **BUILD SUCCESS** — core 851+ tests passing (including all new nested suites).

### 7.2 Python

```bash
cd code/backend/python && source .venv/bin/activate && pytest tests
```

New modules: `app/core/services/match/trait_selection_validator.py` (new),
validator/listing/controller tests added to existing test files.

Result: **505 passed**.

### 7.3 PHP

```bash
cd code/backend/php && XDEBUG_MODE=coverage vendor/bin/phpunit tests --coverage-text
```

New files: `src/Core/Service/Matches/TraitSelectionValidator.php`,
`TraitSelectionException.php`. New tests in `CharacterCommandServiceTest`,
`MatchCommandServiceTest`, `StoryQueryServiceTest`.

Result: **558 tests OK**.

### 7.4 AWS

```bash
cd code/backend/aws && source .venv/bin/activate && pytest tests
```

New tests in `test_character_handler.py` and `test_story_handler.py`.

Result: **255 passed**.

---

## 8. API Changes Summary

| Endpoint | Status |
|----------|--------|
| `GET /api/stories/{uuidStory}/classes/{uuidClass}/traits` | NEW (v0.23.0) |
| `POST /api/matches` | EXTENDED — trait validation strict; 4 new 400 codes |
| `POST /api/matches/{uuidMatch}/join` | EXTENDED — trait validation strict; 4 new 400 codes; difficulty resolved before traits |
| `GET /api/stories/{uuid}` (difficulties[]) | EXTENDED — `traitCostPositiveBudget` / `traitCostNegativeBudget` added (v0.23.0) |
| `POST/PUT /api/admin/stories/{uuid}/difficulties` | EXTENDED — new budget fields passed through |

---

## 9. Frontend

### 9.1 react-game: multi-trait picker with budget display (v0.23.0)

**`src/utils/traitBudget.js`** (new) — pure utility functions:

| Function | Purpose |
|----------|---------|
| `traitCostTotals(selectedTraits)` | Returns `{ totalPositive, totalNegative }` |
| `remainingTraitBudget(difficulty, selectedTraits)` | Returns remaining positive and negative budget |
| `canAddTrait(difficulty, selectedTraits, candidate)` | Returns `true` if adding the candidate would not exceed either budget |
| `isTraitSelected(selectedTraits, traitUuid)` | Predicate |
| `toggleTrait(selectedTraits, trait)` | Immutable add/remove |

**`src/api/stories.js`** — new function `getTraitsForClass(storyUuid, classUuid, lang)` with automatic mock fallback when the backend is unreachable.

**`OptionPicker`** — config key renamed from `config.trait` (single) to
`config.traits[]` (multi-select).  The picker displays the remaining positive and
negative budget below the list and locks options that would exceed a budget with a
`'budget'` lock kind.  i18n keys: `book.traitBudgetPositive`,
`book.traitBudgetNegative`, `book.traitBudgetExceeded`, `book.remove`.

**`ConfigView`** — aggregates every selected trait's costs into the totals displayed
in the configuration summary.  The trait `ConfigCard` shows the count of selected
traits.

**`StartMatchFlow`** — sends all selected trait uuids in the join request payload.

Vitest result: **267 passed** (new `src/test/traitBudget.test.js`).

### 9.2 react-admin: difficulty budget fields (v0.23.0)

`src/constants/story/storiesEntities.jsx` — the `difficulties` entity definition
gains two new fields:

| Field key | Label |
|-----------|-------|
| `traitCostPositiveBudget` | `Trait Cost Budget (+)` |
| `traitCostNegativeBudget` | `Trait Cost Budget (−)` |

Both fields are rendered as optional numeric inputs in the difficulty create/edit
forms and as columns in the difficulty list.

Vitest result: **269 passed**.

---

## 10. Robot Framework Coverage

Suite: `code/tests/robot/tests/23_trait_selection/trait_selection.robot`

New helper: `code/tests/robot/resources/Step23Helper.py` (pure-Python keyword
library):

| Helper function | Purpose |
|-----------------|---------|
| `filtered_trait_uuids(allTraits, classId)` | Client-side filter mirrors the server rule |
| `find_incompatible_trait(allTraits, classId)` | Returns a trait that would fail class check |
| `find_positive_budget_overflow(allTraits, budget)` | Returns a selection that exceeds the positive budget |
| `find_negative_budget_overflow(allTraits, budget)` | Returns a selection that exceeds the negative budget |
| `trait_stat_deltas(traits)` | Sums stat fields for formula assertion |

New keyword `Get Traits For Class` added to
`code/tests/robot/resources/matches.resource`.

Updated: `tests/19_match/match_creation.robot` — the "Create Match With Loadout
Persists…" test now passes a real seed trait uuid.  Bogus trait uuids that Step 21
silently ignored now return `400` and the test is updated accordingly.

### 10.1 Test cases

| Test case | Assertions |
|-----------|------------|
| Filtered listing matches client-side filter | Server array equals `filtered_trait_uuids` result |
| 404 on unknown class | `CLASS_NOT_FOUND` |
| 404 on unknown story | `STORY_NOT_FOUND` |
| Stat delta assertion | Join with trait vs without — dexterity difference matches `trait_stat_deltas` |
| `TRAIT_NOT_FOUND` | 400 with code `TRAIT_NOT_FOUND` |
| `TRAIT_DUPLICATED` | 400 with code `TRAIT_DUPLICATED` |
| `TRAIT_NOT_COMPATIBLE` | 400 with code `TRAIT_NOT_COMPATIBLE` |
| Positive budget exceeded | 400 with code `TRAIT_COST_EXCEEDED` |
| Negative budget exceeded | 400 with code `TRAIT_COST_EXCEEDED` |
| Create match loadout `TRAIT_NOT_FOUND` | 400 with code `TRAIT_NOT_FOUND` |

Scenarios the seed cannot express are skipped via `Pass Execution` (backend-agnostic
design).

### 10.2 Dev seed — tutorial story (id 9001)

| Backend | File |
|---------|------|
| Java SQLite | `adapter-sqlite/.../R__insert_story_seed_data.sql` |
| Java PostgreSQL | `adapter-postgres/.../R__insert_dev_test_data.sql` |
| Python | `app/adapters/persistence/seed_dev_data.py`, `scripts/seed_stories.py` |
| PHP | `database_seed_dev_data.sql` |
| AWS | `lambda/seed/handler.py` |

Seed data highlights:

- `difficulty[0]`: `trait_cost_positive_budget = 2`, `trait_cost_negative_budget = 3`;
  `difficulty[1]`: both budgets `NULL` (unlimited).
- Trait 90001 — unrestricted, `cost_positive = 1`; remains first so existing robot
  loadouts stay valid.
- Trait 90002 — `idClassPermitted = 90002` (permitted only for that class).
- Trait 90003 — `idClassProhibited = 90001` (prohibited for that class).
- Traits 90004 / 90005 — `cost_negative = 2`; stat deltas: `life −2` / `energy −2`.
- AWS seed names: `tr-tut-quick` (permitted class 2), `tr-tut-resilient` (prohibited
  class 1), `tr-tut-frail` / `tr-tut-weary` (negative cost).

### 10.3 Full suite results

| Backend | Total | Pass |
|---------|------:|-----:|
| Java + SQLite | 288 | 288 |
| Java + PostgreSQL | 288 | 288 |
| Python | 288 | 288 |
| PHP | 288 | 288 |
| AWS | not run (deploy requires confirmation) | — |

```bash
# Java + SQLite (from repo root)
code/script/dev/run_robots/run_robot_with_local_java.sh

# Java + PostgreSQL
code/script/dev/run_robots/run_robot_with_local_java_postgres.sh

# Python
code/script/dev/run_robots/run_robot_with_local_python.sh

# PHP
code/script/dev/run_robots/run_robot_with_local_php.sh
```

Reports are written to the respective `reports-local-*/report.html` folder.

---

## 11. Per-backend Implementation Table

| Backend | Trait listing | Trait validator | Wiring (create + join) | REST route |
|---------|---------------|-----------------|------------------------|------------|
| Java | `StoryQueryService.listTraitsForClass` + `StoryQueryPort.TraitsForClassResult` | `core/.../service/match/TraitSelectionValidator` | `CharacterCommandService.resolveAndValidateTraits`; `MatchCommandService.validateCreatorTraitSelection` | `StoryController` new GET; `CharacterController` + `MatchController` map 4 codes → 400 |
| Python | `story_query_service.list_traits_for_class` | `app/core/services/match/trait_selection_validator.py` | `character_command_service.py` + `match_command_service.py` | `story_controller` new route; controller status maps → 400 |
| PHP | `StoryQueryService::listTraitsForClass` | `src/Core/Service/Matches/TraitSelectionValidator.php` + `TraitSelectionException.php` | `CharacterCommandService.php` + `MatchCommandService.php` | `StoryController::listTraitsForClass`; `RouteRegistrar` route; `StoryMatchMysqlReadAdapter` SELECT extended |
| AWS | `lambda/story/handler.py` `list_traits_for_class` + `_trait_detail` | `lambda/match/handler.py` `_resolve_and_validate_traits` (shared) | `_create_match` + `_join_match` | `template/story.yaml` `ListTraitsForClassRoute`; `lambda/seed/handler.py` enriched seeds |

---

# Version Control

- Created with AI prompts:
  ```
  ciao read step 23 on roadmap file (documentation_v0/Roadmap.md) and write a plan to realize all components. 
  projects are backend/java, robot test, react-game, react-admin, aws lambda and php and python project. 
  don't look and change backend/node project. at the end write Step21_xxx.md file with specific documentation agent. let's go

  ciao, start a new adventure: new project "frontend/python-flask-game", i wanna create game website with python-flask tecnoloty and use javascript less as possibile.
  pages: story list with netflix style. page to story detail with book, on left the big card story detail, on right the configuration (classes, characters, traits, difficulties, login, and single player).
  a page to change configuration detail. a page to start a new match with antobot system. a page to match (mock for now). a page to user detail with link from navbar. pages from footer to privary, terms of conditions and cookies policy.
  add cookies and google tag management. a version/styles/theme for visually impaired. 
  never touch outside new folder. remember about test unit. I wanna use same styles and same labes from "src/i18n/en.json" e "src/i18n/it.json". le'ts go

  now let't go new project "frontend/python-flask-admin", i wanna create a new project to run admin section using only flask tecnology and less javascript as possibile. use bootstrap5 and fontawesome.
  i wanna page to admin user (guest), i wanna page to list/edit stories, a page with story detail and crud to all entities. in all entities a fast way to create card without change page. 
  a page to import a new story. a page to admin/list/change match with full detail page. and search if there are others page there are in react-admin and add it to new project.

  ```
- **Document Version**: 0.23.0
    | Version | Description | Date |
    | --- | --- | --- |
    | 0.23.0 | Character stats initialization — class-filtered trait listing, strict trait validation (TRAIT_NOT_FOUND/DUPLICATED/NOT_COMPATIBLE/COST_EXCEEDED) on match create/join, difficulty cost budgets, dev seeds, robot suite 23_trait_selection | June 11, 2026 |

- **Last Updated**: June 11, 2026
- **Status**: Complete



# < Paths Games />
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
