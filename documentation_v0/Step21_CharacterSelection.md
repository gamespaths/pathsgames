# Paths Games V0 - Step 21: Character Template and Class Selection

This document describes the implementation of **Step 21** as requested in Roadmap.

Step 21 ships the character materialisation layer that sits immediately after
match creation. When a player joins a match the platform resolves the chosen
character template, class, traits and difficulty, computes the starting stats
through a deterministic formula, places the character at the story start
location, creates the backpack and trait rows, and exposes a set of read
endpoints so the frontend and admin console can inspect the in-match roster.

---

## 1. Scope

Step 21 covers the following items from the roadmap:

- `POST /api/matches/{uuidMatch}/join` — materialise the caller's character
  inside an existing match.  When the request body is omitted or fields are
  absent the platform falls back to the creator loadout stored on
  `gaming_match` at creation time (single-player path introduced in v0.19.9).
- `GET /api/match/{uuidMatch}/players` — list character summaries for all
  participants; access is restricted to the match creator and any joined
  participant.
- `GET /api/match/{uuidMatch}/characters/{uuidCharacter}` — return the full
  detail for one character.
- Additive enrichment of `GET /api/match/{uuidMatch}/info` and
  `GET /api/admin/matches/{uuidMatch}/info` with a `players[]` array
  containing the summary of every character in the match.
- Stat formula: for every new `gaming_character_instance` the six base stats
  are derived from template + class + difficulty + selected traits.
- Class–template compatibility check: `list_character_templates.id_class_permitted`
  and `id_class_prohibited` are enforced before insertion.
- Cascade deletion: `MatchPersistenceAdapter.deleteMatchesByNameLike` and
  `deleteMatchByUuid` now also remove character instance, backpack and trait
  rows so robot-test cleanups and admin deletes leave no orphans.
- Backend unit tests with full branch coverage on all new code paths across
  all four backends.
- react-admin `MatchDetailPage` at `/matches/:uuid` showing players,
  locations and registry.
- react-game `StartMatchFlow` auto-joins after creating the match so the
  character is always instantiated before `GamePage` is reached.

**Relationship to adjacent steps:** the per-instance trait cost-budget
validation belongs to Step 23.  The turn engine, which consumes the character
instances to build the queue, is Step 25.  The class uuid is echoed on the
join response but is not stored as a persistent column (stats are baked in at
join time); this is a documented V0 limitation that will be revisited in a
later step.

**Note on trait stat application:** Step 21 folds the trait *stat delta*
calculation into the join operation (traits are fully resolved at join time).
The cost-budget enforcement — preventing a player from selecting traits whose
combined cost exceeds the difficulty allowance — remains in Step 23.

---

## 2. Endpoint APIs

The OpenAPI source of truth is
[`code/backend/java/adapter-rest/src/main/resources/openapi/v0.21.0-character-selection-api.yaml`](../code/backend/java/adapter-rest/src/main/resources/openapi/v0.21.0-character-selection-api.yaml).
No previously published endpoint contract was changed.

### 2.1 `POST /api/matches/{uuidMatch}/join`

Joins a match and materialises the caller's character.

| Header          | Required | Description                              |
|-----------------|----------|------------------------------------------|
| `Authorization` | yes      | `Bearer <accessToken>` (PLAYER or ADMIN) |
| `Content-Type`  | yes      | `application/json`                       |

Request body (`JoinMatchRequest`) — all fields optional:

```json
{
  "characterTemplateUuid": "1a2b…",
  "classUuid": "5c7e…",
  "traitUuids": ["9f01…", "9f02…"]
}
```

When the body is absent or a field is null/empty the platform substitutes the
value stored in `gaming_match.character_template_uuid`, `class_uuid` and
`trait_uuids` (the creator loadout written at match-creation time).

| HTTP status | Condition                                                          |
|-------------|---------------------------------------------------------------------|
| `201`       | Character created — body is `CharacterInstanceResponse`            |
| `400`       | `INVALID_INPUT` — blank match uuid or unresolvable loadout         |
| `401`       | Missing / invalid bearer token                                      |
| `403`       | `USER_BANNED`                                                       |
| `404`       | `MATCH_NOT_FOUND`, `TEMPLATE_NOT_FOUND`, `CLASS_NOT_FOUND`, `USER_NOT_FOUND` |
| `409`       | `ALREADY_JOINED`, `CLASS_NOT_COMPATIBLE`, `MATCH_NOT_JOINABLE`     |

### 2.2 `GET /api/match/{uuidMatch}/players`

Returns the list of character summaries for the match.  Access is allowed for
the match creator and for any joined participant.

| HTTP status | Condition                                      |
|-------------|------------------------------------------------|
| `200`       | Array of `CharacterSummaryResponse`            |
| `401`       | Missing / invalid bearer token                 |
| `404`       | `MATCH_NOT_FOUND`                              |

### 2.3 `GET /api/match/{uuidMatch}/characters/{uuidCharacter}`

Returns the full character detail including all six stats, backpack resources,
active traits and current location.

| HTTP status | Condition                                      |
|-------------|------------------------------------------------|
| `200`       | `CharacterInstanceResponse`                    |
| `401`       | Missing / invalid bearer token                 |
| `404`       | `MATCH_NOT_FOUND` or `CHARACTER_NOT_FOUND`     |

### 2.4 `GET /api/match/{uuidMatch}/info` and `GET /api/admin/matches/{uuidMatch}/info` — additive change

Both info endpoints gain a `players` field in their response body.

`CharacterSummaryResponse` fields (also returned by `GET /api/match/{uuid}/players`):

```json
{
  "match": { /* MatchSummary */ },
  "players": [
    {
      "uuid": "char-uuid",
      "userUuid": "user-uuid",
      "classUuid": "5c7e…",
      "traitUuids": ["9f01…", "9f02…"],
      "dexterity": 8,
      "intelligence": 6,
      "constitution": 7,
      "life": 15,
      "energy": 12,
      "sad": 0,
      "idLocation": 10,
      "isSleeping": false,
      "isComa": false
    }
  ],
  "currentLocationId": 10,
  "locations": [ … ],
  "registry": [ … ],
  "events": [],
  "choices": []
}
```

`classUuid` and `traitUuids` allow consumers to display which class and traits each
player chose at join time without a separate round-trip to the character-detail endpoint.
```

This change is additive and backward compatible; existing consumers that
ignore unknown fields are unaffected.

---

## 3. DTOs and Domain Models

### 3.1 Java REST DTOs

| DTO                         | File (adapter-rest)                                  | Purpose                                           |
|-----------------------------|------------------------------------------------------|---------------------------------------------------|
| `JoinMatchRequest`          | `dto/JoinMatchRequest.java`                          | POST `/api/matches/{uuid}/join` request body      |
| `CharacterInstanceResponse` | `dto/CharacterInstanceResponse.java`                 | Full character detail — 201 on join, 200 on detail|
| `CharacterSummaryResponse`  | `dto/CharacterSummaryResponse.java`                  | Lightweight row in the players list               |
| `MatchInfoResponse.players` | nested field on `dto/MatchInfoResponse.java`         | `List<CharacterSummaryResponse>` added to info    |

### 3.2 Java Core Domain Models

| Model                   | Package                        | Purpose                                    |
|-------------------------|--------------------------------|--------------------------------------------|
| `JoinMatchCommand`      | `core/.../model/match/`        | Input to `CharacterCommandService`         |
| `CharacterInstanceInfo` | `core/.../model/match/`        | Domain representation of a character       |
| `MatchDetail.players`   | `core/.../model/match/`        | `List<CharacterInstanceInfo>` on MatchDetail|

---

## 4. Roles and Authentication

All three new endpoints and the enriched info endpoints require a valid bearer
token issued by the existing `JwtAuthenticationFilter` (Step 13).  Both
`PLAYER` and `ADMIN` roles are accepted.  The user identity propagated on the
request as attribute `userUuid` is used both for the ban check and to
associate the caller with the new character instance.

The ban check for `POST /api/matches/{uuidMatch}/join` follows the same state
taxonomy as match creation:

| state | meaning        | allowed to join? |
|-------|----------------|-----------------|
| 1     | registration   | yes             |
| 2     | active         | yes             |
| 3     | blocked        | no — `USER_BANNED` |
| 4     | banned         | no — `USER_BANNED` |
| 5     | password reset | yes             |
| 6     | guest          | yes             |

`GET /api/match/{uuidMatch}/players` enforces that the caller is either the
match creator or a participant (an already-joined character exists for that
user in the match).

---

## 5. Tables

No new Flyway migration was created for Java or Python — all three tables were
already part of the schema introduced in v0.10.6.  The PHP backend added the
three tables to `database.sql` as part of this step.

| Table                       | Read | Write | Notes                                                  |
|-----------------------------|:----:|:-----:|--------------------------------------------------------|
| `users`                     | ✔    |       | Resolve caller id, ban state                           |
| `gaming_match`              | ✔    |       | Load match, access creator loadout fallback            |
| `list_stories_difficulty`   | ✔    |       | Provide stat delta columns for the formula             |
| `list_character_templates`  | ✔    |       | Base stats, `id_class_permitted`, `id_class_prohibited`|
| `list_classes`              | ✔    |       | Class base stats                                       |
| `list_classes_bonus`        | ✔    |       | Additional stat bonuses keyed by statistic name        |
| `list_traits`               | ✔    |       | Stat delta per selected trait                          |
| `list_locations`            | ✔    |       | Identify the story start location (id = min / first)   |
| `gaming_character_instance` | ✔    | ✔     | One row per joined player per match                    |
| `gaming_backpack_resources` |      | ✔     | One row created with food/magic/coin = 0               |
| `gaming_character_traits`   |      | ✔     | One row per selected trait                             |

### 5.1 `gaming_character_instance`

Composite primary key `(id, id_match)`.  The `id` value is assigned
sequentially per match starting at 1 (count + 1), mirroring the pattern used
by registry and location state rows.

| Column                    | Type    | Notes                              |
|---------------------------|---------|------------------------------------|
| `id`                      | INT     | Per-match sequence; PK part 1      |
| `id_match`                | INT     | FK to `gaming_match.id`; PK part 2 |
| `uuid`                    | VARCHAR | Auto-assigned on creation          |
| `id_user`                 | INT     | FK to `users.id`                   |
| `id_character_template`   | INT     | FK to `list_character_templates.id`|
| `dexterity`               | INT     | Computed at join — see §6          |
| `intelligence`            | INT     | Computed at join — see §6          |
| `constitution`            | INT     | Computed at join — see §6          |
| `life`                    | INT     | = `life_max` at join               |
| `energy`                  | INT     | = `energy_max` at join             |
| `sad`                     | INT     | 0 at join                          |
| `id_location`             | INT     | Story start location id            |
| `is_sleeping`             | BOOLEAN | false at join                      |
| `is_coma`                 | BOOLEAN | false at join                      |
| `clock_in_coma`           | INT     | 0 at join                          |
| `counter_consecutive_pass`| INT     | 0 at join                          |

### 5.2 `gaming_backpack_resources`

Composite PK `(id, id_match)`.

| Column             | Type | Notes                  |
|--------------------|------|------------------------|
| `id_character_match` | INT | FK to character instance |
| `food`             | INT  | 0 at join (schema default) |
| `magic`            | INT  | 0 at join              |
| `coin`             | INT  | 0 at join              |

### 5.3 `gaming_character_traits`

Composite PK `(id, id_match)`.

| Column             | Type | Notes                            |
|--------------------|------|----------------------------------|
| `id_character_match` | INT | FK to character instance         |
| `id_traits`        | INT  | FK to `list_traits.id`           |
| `id_event`         | INT  | null at join; used by event engine|

---

## 6. Business Logic

### 6.1 `CharacterCommandService.joinMatch`

1. Reject the request when `userUuid` or `matchUuid` is blank — HTTP 400
   `INVALID_INPUT`.
2. Resolve the user via the user access port.  Missing user → 404; banned or
   blocked → 403.
3. Load the match by uuid.  Missing → 404 `MATCH_NOT_FOUND`.  Status is not
   `CREATED` or `RUNNING` → 409 `MATCH_NOT_JOINABLE`.
4. If the user already has a character in this match → 409 `ALREADY_JOINED`.
5. Resolve the character template uuid: use the request value when present,
   otherwise fall back to `gaming_match.character_template_uuid`.  Missing
   both → 400.  Template row not found → 404 `TEMPLATE_NOT_FOUND`.
6. Resolve the class uuid in the same priority order.  Class row not found
   → 404 `CLASS_NOT_FOUND`.
7. **Compatibility check:** if `template.idClassPermitted` is set and does not
   equal the resolved class id → 409 `CLASS_NOT_COMPATIBLE`.  If
   `template.idClassProhibited` is set and equals the resolved class id →
   409 `CLASS_NOT_COMPATIBLE`.
8. Resolve the trait list from the request `traitUuids` (or the
   comma-separated `gaming_match.trait_uuids` fallback).  Load all matching
   `list_traits` rows.  Unknown trait uuids are silently ignored in V0.
9. Load all `list_classes_bonus` rows for the resolved class.
10. Load the difficulty row for the match.
11. **Stat formula** — compute the six values:

    | Stat          | Formula                                                                                           |
    |---------------|---------------------------------------------------------------------------------------------------|
    | `dexterity`   | `template.dexterityStart` + `class.dexterityBase` + `difficulty.dexterity` + Σ `trait.dexterity` + Σ `classBonus('dex')` |
    | `intelligence`| `template.intelligenceStart` + `class.intelligenceBase` + `difficulty.intelligence` + Σ `trait.intelligence` + Σ `classBonus('int')` |
    | `constitution`| `template.constitutionStart` + `class.constitutionBase` + `difficulty.constitution` + Σ `trait.constitution` + Σ `classBonus('con')` |
    | `lifeMax`     | `template.lifeMax` + `difficulty.life` + Σ `trait.life` + Σ `classBonus('life')` |
    | `energyMax`   | `template.energyMax` + `difficulty.energy` + Σ `trait.energy` + Σ `classBonus('energy')` |

    `life = lifeMax`; `energy = energyMax`; `sad = 0`.
    The `exp` statistic is excluded from the formula (it belongs to Step 37).
    Class-bonus statistic names map as follows: `dex` → dexterity,
    `int` → intelligence, `con` → constitution, `life` → life, `energy` →
    energy.

12. Determine `idLocation`: the story start location (lowest `id` in
    `list_locations` for the story).
13. Determine the per-match `id` for the instance: count existing characters
    in the match and add 1.
14. Persist `gaming_character_instance`, `gaming_backpack_resources` (one row,
    all resources 0), and one `gaming_character_traits` row per resolved trait.
15. Return `CharacterInstanceInfo` populated from the saved rows.

### 6.2 `CharacterQueryService`

- `listPlayers(matchUuid, userUuid)` — loads the match, verifies the caller
  is the creator or a participant, returns all character instance rows.
- `getCharacter(matchUuid, characterUuid, userUuid)` — loads the match and the
  requested character.  Returns null (→ 404) if either is not found.

### 6.3 Cascade deletion

`MatchPersistenceAdapter.deleteMatchesByNameLike` and `deleteMatchByUuid` now
delete `gaming_character_traits`, `gaming_backpack_resources` and
`gaming_character_instance` rows (in that order, children before parent) for
every match being removed.  This ensures robot-test cleanup and admin delete
operations leave no orphaned character data.

---

## 7. Test Cases

The test suite covers every branch listed in §6. Key files by backend:

### 7.1 Java

| Test class                          | Scenarios covered                                                                          |
|-------------------------------------|--------------------------------------------------------------------------------------------|
| `CharacterCommandServiceTest`       | Blank inputs; user not found / banned; match not found / not joinable; already joined; template / class not found; class not compatible (permitted and prohibited); trait resolution; stat formula for each of the six stats with and without class bonuses; successful happy path. |
| `CharacterQueryServiceTest`         | Blank inputs; match not found; access denied (neither creator nor participant); players list; character not found; character detail. |
| `CharacterPersistenceAdapterTest`   | Save instance / backpack / traits; find characters by match; find backpack; find traits; cascade delete for name-like and uuid. |
| `CharacterEntitiesTest`             | `@PrePersist` uuid default, `equals` / `hashCode` on composite PK classes for instance, backpack and traits entities. |
| `CharacterDtosTest`                 | `fromModel(null)` paths and getter/setter coverage for `JoinMatchRequest`, `CharacterInstanceResponse` and `CharacterSummaryResponse`. |
| `CharacterControllerTest`           | All `CharacterJoinException.Code` branches mapped to HTTP statuses; auth-missing 401; happy path 201; players 200 / 401 / 404; character detail 200 / 401 / 404. |
| `MatchQueryServicePlayersTest`      | `MatchDetail.players` populated from `CharacterQueryService`; null character list handled. |

Run from the Java project root:

```bash
mvn -pl core,adapter-rest -am test
```

Total tests added: **~120** across the seven new classes. All pass.

### 7.2 Python

```bash
cd code/backend/python && source .venv/bin/activate && pytest tests
```

458 tests pass. New modules: `character_persistence_adapter.py`,
`character_command_service.py`, `character_query_service.py`,
`character_controller.py`. Coverage on new modules ~98 %.

### 7.3 PHP

```bash
cd code/backend/php && XDEBUG_MODE=coverage vendor/bin/phpunit tests --coverage-text
```

516 tests pass. **Seed fix:** `database_seed_dev_data.sql` now includes UPDATE
statements that backfill UUIDs for rows in `list_character_templates`,
`list_classes` and `list_traits` — required because MySQL does not evaluate
UUID() as a column default the same way SQLite does.

### 7.4 AWS

```bash
cd code/backend/aws && source .venv/bin/activate && pytest tests
```

222 tests pass. New lambda handlers: `_join_match`, `_list_players`,
`_get_character`. Character items are stored in DynamoDB with
`PK=MATCH#{uuid}`, `SK=CHARACTER#{charUuid}`.

---

## 8. API Changes Summary

Step 21 introduces three new player-API endpoints and additively enriches two
existing info endpoints with the `players[]` array.  All changes are backward
compatible.

| Endpoint                                        | Status                                           |
|-------------------------------------------------|--------------------------------------------------|
| `POST /api/matches/{uuid}/join`                 | NEW (v0.21.0)                                    |
| `GET /api/match/{uuid}/players`                 | NEW (v0.21.0)                                    |
| `GET /api/match/{uuid}/characters/{uuidChar}`   | NEW (v0.21.0)                                    |
| `GET /api/match/{uuid}/info`                    | EXTENDED — `players[]` added (v0.21.0)           |
| `GET /api/admin/matches/{uuid}/info`            | EXTENDED — `players[]` added (v0.21.0)           |

---

## 9. Frontend

### 9.1 react-game: StartMatchFlow auto-join (v0.21.0)

`StartMatchFlow` (`src/features/start-match/StartMatchFlow.jsx`) gains a new
`'joining'` phase that executes immediately after the match is created:

1. Phase `'starting'` — countdown timer, then calls `POST /api/matches`.
2. Phase `'joining'` — calls `POST /api/matches/{uuid}/join` with the full
   loadout payload.  The bearer token is read from `GuestUserContext.accessToken`.
3. Phase `'created'` — displays "Match created, the story book is loading…",
   waits the configured delay, then navigates to `GamePage`.

Three new API functions in `src/api/matches.js`: `joinMatch`,
`getMatchPlayers`, `getCharacter` — each with automatic mock fallback when the
backend is unreachable.

### 9.2 react-admin: MatchDetailPage (v0.21.0)

A new dedicated page `src/pages/MatchDetailPage.jsx` is mounted at the route
`/matches/:uuid` (registered in `src/App.jsx`). It calls
`GET /api/admin/matches/{uuid}/info` and renders:

- **Match configuration table** — key/value rows for match name, story,
  difficulty (name resolved from `storyCtx.difficulties`), status, creator and
  timestamps.
- **Players & Characters** — stat table (dexterity, intelligence, constitution,
  life, energy, sadness) plus current location, sleeping/coma state, selected
  class (name resolved from `storyCtx.classes`) and traits (names resolved from
  `storyCtx.traits`).  colSpan is 12 to accommodate the two new columns.
- **Locations** — list of `gaming_state_locations` rows with clock counter and
  activation flag.
- **Registry** — full `gaming_state_registry` table for the match.

**`UuidCopy` inline component:** every UUID displayed on the page is wrapped in
`UuidCopy` — a small wrapper that sets `title={uuid}` (tooltip shows full UUID
on hover) and copies the UUID to clipboard on click, briefly flashing a gold `✓`
confirmation.  Used for match uuid, character uuid, class chip and each trait
chip.

`MatchesPage` gains a navigation button on each row that pushes the user to
`/matches/:uuid`.

**Test file** `MatchDetailPage.test.jsx` covers the two new columns and the
`UuidCopy` clipboard interaction (`navigator.clipboard` mock), plus difficulty
name resolution from `listEntities`.  Three new test cases added; total
react-admin suite: 261 tests.

---

## 10. Robot Framework Coverage

Tests live under `code/tests/robot/tests/21_character_selection/character_selection.robot`.

The suite covers seven test cases:

| Test case                          | Assertions                                                      |
|------------------------------------|------------------------------------------------------------------|
| Join match and verify stats        | 201; all six computed stats match expected formula              |
| List players                       | 200; at least one player returned after join                    |
| Get character detail               | 200; character uuid matches join response                       |
| Join same match twice              | Second join returns 409 `ALREADY_JOINED`                        |
| Join unknown match                 | 404 `MATCH_NOT_FOUND`                                           |
| List players without token         | 401                                                             |
| Get unknown character              | 404 `CHARACTER_NOT_FOUND`                                       |

New keywords added to `code/tests/robot/resources/matches.resource`:
`Pick Story Loadout`, `Join Match`, `Get Match Players`, `Get Character Detail`.

The suite runs green against all four backends:

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

| Backend | Join service | Query service | Persistence | REST controller | DI wiring |
|---------|-------------|---------------|-------------|-----------------|-----------|
| Java    | `core/.../service/match/CharacterCommandService` | `CharacterQueryService` | `CharacterPersistenceAdapter` + `CharacterReadAdapter` | `adapter-rest/.../controller/match/CharacterController` | `ms-launcher/.../CoreConfig` |
| Python  | `app/core/services/match/character_command_service.py` | `character_query_service.py` | `app/adapters/persistence/match/character_persistence_adapter.py` | `app/adapters/rest/match/character_controller.py` | `app/launcher.py` |
| PHP     | `src/Core/Service/Matches/CharacterCommandService.php` | `CharacterQueryService.php` | `src/Adapter/Persistence/Matches/CharacterMysqlPersistenceAdapter.php` | `src/Adapter/Rest/Matches/CharacterController.php` | `bootstrap.php` |
| AWS     | `lambda/match/handler.py` `_join_match` | `_list_players`, `_get_character` | DynamoDB items `PK=MATCH#…, SK=CHARACTER#…` | Inline in handler; routes in `template/match.yaml` | Not deployed (code + tests only) |

---

## 12. Post-release Fixes

### 12.1 PostgreSQL boolean type mismatch (Java+Postgres — 500 on join)

**Root cause:** `GamingCharacterInstanceEntity` mapped `is_sleeping` and `is_coma` as
`Integer`, but the PostgreSQL Flyway migration `V0.10.6__create_gaming_core.sql` defines
those columns as `BOOLEAN`.  SQLite silently accepts `0`/`1` for boolean columns;
PostgreSQL enforces strict type checking — this caused a 500 error on
`POST /api/matches/{uuid}/join` when running with the Java+Postgres backend.

**Files changed:**
- `core/entity/match/GamingCharacterInstanceEntity.java` — `Integer isSleeping/isComa`
  changed to `Boolean`; defaults changed from `0` to `false`.
- `core/model/match/CharacterInstanceInfo.java` — same field-type change.
- `adapter-rest/dto/CharacterInstanceResponse.java` and `CharacterSummaryResponse.java`
  — same field-type change.
- `core/service/match/CharacterCommandService.java` — `setIsSleeping(0)` changed to
  `setIsSleeping(false)` (and likewise `isComa`).
- Tests updated: `CharacterEntitiesTest`, `CharacterCommandServiceTest`,
  `CharacterQueryServiceTest`, `CharacterDtosTest`.

**Why Java+SQLite passed originally:** SQLite stores booleans as integers and does not
enforce the column type at the driver level.  PostgreSQL does — hence the fix was only
visible when running the Java+Postgres robot suite.

**Result:** all four robot backends (`java-sqlite`, `java-postgres`, `python`, `php`)
now pass the full `21_character_selection` suite (7 tests).

### 12.2 `CharacterSummaryResponse` missing `classUuid` and `traitUuids`

**Root cause:** `CharacterSummaryResponse` (the DTO embedded as the `players[]` array in
`GET /api/admin/matches/{uuid}/info` and `GET /api/match/{uuid}/info`) did not include
`classUuid` or `traitUuids`.  The full `CharacterInstanceResponse` (returned by the join
and character-detail endpoints) had both fields, but the summary did not — so the class
and traits chosen at join time were stored in the database but never surfaced in the
match-info players list.

**Files changed (all 4 backends):**

| Backend | Change |
|---------|--------|
| Java    | `CharacterSummaryResponse.java`: added `classUuid` (String) and `traitUuids` (List\<String\>); `fromModel` mapping updated; getters/setters added |
| PHP     | `CharacterInstanceInfo.php` `toSummaryArray()`: added `'classUuid'` and `'traitUuids'` keys |
| AWS     | `lambda/match/handler.py` `_character_summary()`: added `"classUuid"` and `"traitUuids"` keys |
| Python  | Already complete — both fields were present before this fix |

**Result:** the `players[]` array in both info endpoints now exposes the full loadout
selection (see the updated schema in §2.4).

### 12.3 react-admin MatchDetailPage enhancements

Three targeted enhancements were applied to `src/pages/MatchDetailPage.jsx` after the
initial Step 21 release:

1. **`UuidCopy` component** — a small inline wrapper that shows the full UUID as a
   tooltip on hover and copies it to the clipboard on click, briefly flashing a gold `✓`.
   Used on every UUID displayed on the page (match, character, class, traits).

2. **Difficulty row** added to the Match configuration table — difficulty name is
   resolved from `storyCtx.difficulties` and displayed with a `UuidCopy` chip.

3. **Class column** and **Traits column** added to the Players & characters table —
   class name resolved from `storyCtx.classes`; trait names resolved from
   `storyCtx.traits` via `resolveEntityName(texts, entity)`.  Each value is rendered as
   a `UuidCopy` chip.  `colSpan` updated from `10` to `12`.

**Test coverage:** `MatchDetailPage.test.jsx` updated with `classUuid`/`traitUuids` in
the mock player fixture, `difficulty`/`classes`/`traits` in the `listEntities` mock, a
`navigator.clipboard` mock, and three new test cases.  Total react-admin suite: 261
tests passing.

---

# Version Control

- Created with AI prompt:
  ```
  ciao read step 21 on roadmap file (documentation_v0/Roadmap.md) and write a plan to realize all components. 
  projects are backend/java, robot test, react-game, react-admin, aws lambda and php and python project. 
  don't look and change backend/node project. at the end write Step21_xxx.md file with specific documentation agent. let's go

  ```
- **Document Version**: 0.21.0
    | Version | Description | Date |
    | --- | --- | --- |
    | 0.21.0 | Character template & class selection — join, players, character detail endpoints across all backends; admin MatchDetailPage; react-game auto-join flow | June 9, 2026 |
    | 0.21.0 | Post-release fixes: PostgreSQL boolean type mismatch on `is_sleeping`/`is_coma`; `classUuid`+`traitUuids` added to `CharacterSummaryResponse` (Java/PHP/AWS); react-admin MatchDetailPage `UuidCopy` component + Difficulty row + Class/Traits columns | June 9, 2026 |

- **Last Updated**: June 9, 2026
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

