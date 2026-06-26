# Paths Games V0 - Step 28: Movement System — Adjacency, Energy Cost & Validation

This document describes the implementation of **Step 28** as requested in the Roadmap.

Step 28 introduces the **single-player movement system**. A character moves from their
current location to an adjacent (neighbor) location, paying a combined energy cost that
includes the neighbor edge base cost, the target location's entry cost, and the
weather-derived modifier from Step 27. Full validation ensures the target is reachable,
the character is capable of acting, all conditions are met, and sufficient energy is
available before any state change is committed. Every successful move is recorded in the
existing append-only `log_movements` table (created in V0.10.9).

This step builds directly on:
- **Step 24** (turn cycle engine): character active/sleeping state machine.
- **Steps 25/26** (time clock + recovery): `gaming_state_locations` and the energy pool
  that recovery replenishes.
- **Step 27** (weather system): `costMoveSafeLocation` / `costMoveNotSafeLocation`
  modifiers on the current weather rule.

---

## 1. Scope

Step 28 covers the following items from the Roadmap:

- New endpoint `POST /api/gameplay/{uuidMatch}/movements/start` — move the active
  character to a neighbor location, validate the move, deduct energy, update
  `id_location`, and append a `log_movements` row.
- New endpoint `GET /api/match/{uuidMatch}/locations` — return the set of visited
  locations for the match together with neighbor sub-lists that include the
  weather-resolved `totalEnergyCost` and the current `characterCount`.
- New admin endpoint `GET /api/admin/matches/{uuidMatch}/locations` (port 8044) — same
  payload as the public variant but without ownership checks.
- Energy cost formula: `neighborEdge.energyCost + targetLocation.costEnergyEnter +
  weatherModifier`, where `weatherModifier` depends on whether the target location is
  safe.
- Full ordered validation with distinct error codes (see §3).
- Movement audit reuses the existing `log_movements` table (created in V0.10.9), writing
  the total energy cost into its `energy` column (append-only).
- "Visited locations" derived at query time from current character positions ∪ from/to
  entries in `log_movements` — no schema change to `gaming_state_locations`.
- OpenAPI specification file `v0.28.0-movement-api.yaml`.
- Unit tests for all three backends and both React frontends (>90% coverage on new code).
- Robot E2E suite `28_movement/movement.robot` (tags: `movement`, `step28`).
- react-game `MovementCard` component rendered at the "TODO for every neighbor-location"
  point in `GameBook.jsx`.
- react-admin `MatchDetailPage` extended with a "Movement — characters & neighbor energy
  cost" card.

**Out of scope (deferred to later steps):**
- Automatic location-entry events on arrival → Step 32.
- Group/follow movement and concurrent-movement locking → Step 67.
- Full weight/capacity formula → Step 34 (carried weight is treated as 0 in Step 28
  because inventory management is not yet implemented).

---

## 2. Endpoint Changes

### 2.1 New: `POST /api/gameplay/{uuidMatch}/movements/start`

Moves the authenticated character to the specified neighbor location.

**Path parameter:** `uuidMatch` — match UUID (string).

**Request body:**

```json
{
  "targetLocationUuid": "<uuid>"
}
```

**Success response (200):**

```json
{
  "matchUuid": "match-uuid-v4",
  "characterUuid": "char-uuid-v4",
  "fromLocationId": 1,
  "fromLocationUuid": "loc-001",
  "toLocationId": 2,
  "toLocationUuid": "loc-002",
  "energySpent": 4,
  "newEnergy": 6,
  "currentClock": 1
}
```

**Error codes:**

| HTTP | Code | Condition |
|------|------|-----------|
| 400 | `MISSING_TARGET` | `targetLocationUuid` absent or blank |
| 401 | `UNAUTHENTICATED` | Missing or invalid bearer token |
| 404 | `MATCH_NOT_FOUND` | Unknown match UUID, unknown user, or caller has no character in the match (masked as not-found for security) |
| 409 | `MATCH_NOT_RUNNING` | Match status is not RUNNING |
| 409 | `CHARACTER_CANNOT_ACT` | Character is sleeping or in coma |
| 409 | `NOT_A_NEIGHBOR` | Target UUID is not a neighbor of the character's current location, or target UUID is unknown |
| 409 | `MOVEMENT_CONDITION_NOT_MET` | Neighbor edge has a `conditionRegistryKey`/`conditionRegistryValue` and the match registry does not satisfy it |
| 409 | `OVERWEIGHT` | Character's total carried weight exceeds capacity (always passes in Step 28 — weight is 0 until Step 33/34) |
| 409 | `INSUFFICIENT_ENERGY` | Character's current energy is less than the total energy cost |
| 409 | `LOCATION_FULL` | Target location has `maxCharacters > 0` and is already at capacity |

### 2.2 New: `GET /api/match/{uuidMatch}/locations`

Returns visited locations for the match and, for each location, the list of neighbors
with their weather-resolved energy cost and current occupancy.

**Path parameter:** `uuidMatch` — match UUID.

**Query parameter:** `lang` — optional; propagated to card resolution (same pattern as
`/api/match/{uuid}/info`).

**Success response (200):**

```json
{
  "matchUuid": "match-uuid-v4",
  "locations": [
    {
      "idLocation": 1,
      "uuid": "loc-001",
      "idCard": 5,
      "safe": true,
      "characterCount": 1,
      "neighbors": [
        {
          "idLocation": 2,
          "uuid": "loc-002",
          "direction": "NORTH",
          "baseEnergyCost": 2,
          "entryEnergyCost": 0,
          "weatherEnergyCost": 1,
          "totalEnergyCost": 3,
          "conditionMet": true
        }
      ]
    }
  ]
}
```

**Error codes:**

| HTTP | Code | Condition |
|------|------|-----------|
| 401 | `UNAUTHENTICATED` | Missing or invalid bearer token |
| 404 | `MATCH_NOT_FOUND` | Unknown match UUID or caller has no character in the match |

### 2.3 New: `GET /api/admin/matches/{uuidMatch}/locations` (admin port 8044)

Admin-only variant of the locations endpoint. Returns the same payload as §2.2 but
performs no ownership check — any valid admin token may query any match.

**Error codes:**

| HTTP | Code | Condition |
|------|------|-----------|
| 401 | — | Missing or invalid admin token |
| 404 | `MATCH_NOT_FOUND` | Unknown match UUID |

---

## 3. Validation Order

Validations execute in the following order. Each failure returns immediately; later
checks are not reached.

| # | Check | Error code | HTTP |
|---|-------|------------|------|
| 1 | Auth token valid + caller has a character in the match | `MATCH_NOT_FOUND` | 404 |
| 2 | Match status == RUNNING | `MATCH_NOT_RUNNING` | 409 |
| 3 | Character is awake (not sleeping, not in coma) | `CHARACTER_CANNOT_ACT` | 409 |
| 4 | Character has a current location AND target UUID is a listed neighbor | `NOT_A_NEIGHBOR` | 409 |
| 5 | Neighbor `conditionRegistryKey` is null OR match registry satisfies it | `MOVEMENT_CONDITION_NOT_MET` | 409 |
| 6 | Character carried weight ≤ capacity (always passes — weight is 0 in Step 28) | `OVERWEIGHT` | 409 |
| 7 | Character energy ≥ total energy cost | `INSUFFICIENT_ENERGY` | 409 |
| 8 | Target location at capacity? (`maxCharacters > 0` and count == max) | `LOCATION_FULL` | 409 |

Missing `targetLocationUuid` → `400 MISSING_TARGET` (before all other checks).
Missing auth header → `401 UNAUTHENTICATED` (before all other checks).

---

## 4. Energy Cost Formula

The formula is identical in all three backends:

```
safe              = targetLocation.secureParam > 0
                    (Python/AWS: is_safe > 0)

weatherModifier   = safe
                    ? currentWeather.costMoveSafeLocation
                    : currentWeather.costMoveNotSafeLocation

totalEnergyCost   = neighborEdge.energyCost
                  + targetLocation.costEnergyEnter
                  + weatherModifier
```

**Notes:**
- `neighborEdge.energyCost` is the `energy_cost` column on `list_locations_neighbors`.
  The seed data sets this to `2` in all backends for Step 28.
- `targetLocation.costEnergyEnter` is the `cost_energy_enter` column on
  `list_locations`. Python and AWS location schemas do not carry this column, so the
  entry cost is treated as `0` in those backends.
- `weatherModifier` is read from `gaming_match.id_current_weather` →
  `list_weather_rules.cost_move_safe_location` / `cost_move_not_safe_location`. When no
  weather rule is active, the modifier is `0`.
- The resulting `totalEnergyCost` is the value returned in the neighbor sub-list of the
  `GET /api/match/{uuid}/locations` response so the frontend can display the cost before
  the player commits to the move.

---

## 5. DTOs and Domain Models

### 5.1 `MovementStartRequest`

| Field | Type | Notes |
|-------|------|-------|
| `targetLocationUuid` | string | UUID of the target location; required |

### 5.2 `MovementStartResponse`

| Field | Type | Notes |
|-------|------|-------|
| `matchUuid` | string | Match UUID |
| `characterUuid` | string | Character UUID |
| `fromLocationId` | integer | ID of the origin location |
| `fromLocationUuid` | string | UUID of the origin location |
| `toLocationId` | integer | ID of the target location |
| `toLocationUuid` | string | UUID of the target location |
| `energySpent` | integer | Total energy cost deducted |
| `newEnergy` | integer | Character's energy after deduction |
| `currentClock` | integer | Match clock at the time of the move |

### 5.3 `MatchLocationsResponse`

| Field | Type | Notes |
|-------|------|-------|
| `matchUuid` | string | Match UUID |
| `locations` | array | List of `LocationWithNeighborsDto` |

**`LocationWithNeighborsDto`:**

| Field | Type | Notes |
|-------|------|-------|
| `idLocation` | integer | PK of `list_locations` |
| `uuid` | string | Location UUID |
| `idCard` | integer | FK → `list_cards` (nullable) |
| `safe` | boolean | `secureParam > 0` |
| `characterCount` | integer | Number of characters currently at this location |
| `neighbors` | array | List of `NeighborCostDto` |

**`NeighborCostDto`:**

| Field | Type | Notes |
|-------|------|-------|
| `idLocation` | integer | Target location ID |
| `uuid` | string | Target location UUID |
| `direction` | string | Direction label from `list_locations_neighbors` |
| `baseEnergyCost` | integer | Edge cost — `list_locations_neighbors.energy_cost` |
| `entryEnergyCost` | integer | Target location entry cost — `list_locations.cost_energy_enter` (0 in Python/AWS) |
| `weatherEnergyCost` | integer | Weather modifier for the target (safe/unsafe) |
| `totalEnergyCost` | integer | `baseEnergyCost + entryEnergyCost + weatherEnergyCost` (formula in §4) |
| `conditionMet` | boolean | Whether the registry condition (if any) is currently satisfied |

### 5.4 Java core domain models

| Class | Package | Purpose |
|-------|---------|---------|
| `MovementPort` | `core/.../port/match/` | Outbound port: load match/character state, load neighbors, load weather modifier, load location capacity, persist move, append log row |
| `MovementStorePort` | `core/.../port/match/` | Separate store port for write operations (log_movements insert, energy update, location update) |
| `MovementService` | `core/.../service/match/` | Domain orchestrator: validate move sequence (§3), compute cost (§4), commit or reject |
| `MovementStoreAdapter` | `core/.../persistence/match/` | JPA implementation of `MovementStorePort` |
| `LogMovementEntity` + `LogMovementEntityId` | `core/.../entity/match/` | JPA entity for `log_movements` (composite PK: id, id_match) |
| `LogMovementRepository` | `core/.../repository/match/` | Spring Data JPA repository |
| `MovementController` | `adapter-rest/controller/match/` | `POST /api/gameplay/{uuid}/movements/start`; `GET /api/match/{uuid}/locations` |
| `MovementStartRequest` | `adapter-rest/dto/` | Request DTO |
| `MovementStartResponse` | `adapter-rest/dto/` | Response DTO |
| `MatchLocationsResponse` | `adapter-rest/dto/` | Response DTO for the locations endpoint |

`MovementService` is wired in `CoreConfig` (new bean). `MatchAdminController` gains a
new `GET /api/admin/matches/{uuid}/locations` method backed by the same port query.

### 5.5 Python core models

| Item | Path | Purpose |
|------|------|---------|
| `MovementModels` | `app/core/models/match/movement_models.py` | Dataclasses: `MovementStartRequest`, `MovementStartResponse`, `LocationWithNeighbors`, `NeighborCost` |
| `MovementPort` / `MovementStorePort` | `app/core/ports/match/movement_ports.py` | Abstract port interfaces |
| `MovementService` | `app/core/services/match/movement_service.py` | Domain orchestrator; mirrors Java validation sequence |
| `MovementStoreAdapter` | `app/adapters/persistence/match/movement_store_adapter.py` | SQLAlchemy implementation; `LogMovementEntity` SQLAlchemy model added to `models.py` |
| `MovementController` | `app/adapters/rest/match/movement_controller.py` | FastAPI routes for start + locations |
| Admin endpoint | `app/adapters/rest/match/match_admin_controller.py` | New `GET /api/admin/matches/{uuid}/locations` route |

Wired in `launcher.py`. `scripts/seed_stories.py` gains location 2 with a neighbor edge
to location 1 so the movement suite can traverse an edge in tests.

### 5.6 AWS Lambda models

All movement state is stored on / derived from the DynamoDB match item (Single Table Design):

| Attribute | Purpose |
|-----------|---------|
| `movementLog` | Embedded list of `{ uuid, fromLocationId, toLocationId, energyCost, timestampStart }` entries per match |

Key functions in `lambda/match/handler.py`:

| Function | Role |
|----------|------|
| `_start_movement` | Validates and executes a move; appends to `movementLog` |
| `_get_locations` | Builds the locations response: visited set from character positions ∪ `movementLog`; resolves neighbor `totalEnergyCost` |
| `_get_admin_locations` | Admin variant of `_get_locations` (no ownership check) |
| `_visited_locations_payload` | Helper: collects unique visited location IDs |
| Routes | `StartMovementRoute`, `GetLocationsRoute`, `AdminMatchLocationsRoute` in `template/match.yaml` |

---

## 6. Database Schema Changes

### 6.1 Flyway migrations — V0.28.0 (no-op)

Step 28 does **not** create a new table. The `log_movements` table already exists from
`V0.10.9__create_log_tables.sql` (it was provisioned alongside the other `log_*` tables
for the Step 39 action history). Step 28 **reuses** it, so the two V0.28.0 migration files
are intentional **no-ops** that only reserve the version slot for the step:

- `adapter-sqlite/src/main/resources/db/migration/v0/V0.28.0__add_log_movements.sql`
- `adapter-postgres/src/main/resources/db/migration/v0/V0.28.0__add_log_movements.sql`

### 6.2 Reused table: `log_movements` (from V0.10.9)

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER / BIGSERIAL | Surrogate key; UNIQUE |
| `uuid` | VARCHAR | Row UUID |
| `id_match` | INTEGER | FK → `gaming_match(id)` |
| `id_character_match` | INTEGER | FK → `gaming_character_instance(id, id_match)` |
| `id_location_from` | INTEGER | Origin location PK |
| `id_location_to` | INTEGER | Target location PK |
| `energy` | INTEGER | **Total energy cost paid for this move** (Step 28 writes the cost here) |
| `id_event` / `id_choise` / `log_message` | — | Unused by movement; reserved for Step 39 |
| `ts_insert` / `ts_update` | VARCHAR(50) | Row audit timestamps |

Primary key: `(id, id_match)`. Foreign key: `(id_character_match, id_match)` →
`gaming_character_instance`. The table is **append-only**; no row is ever updated or
deleted. The Java `LogMovementEntity` maps only the columns Step 28 needs and records the
total energy cost in `energy`.

Python uses its own ORM (no Flyway): `LogMovementEntity` is declared as a SQLAlchemy model
and the table is created via `Base.metadata.create_all` at startup, with `energy_cost`
holding the move cost (self-contained — Python has no pre-existing log_movements table).

AWS Lambda stores the movement log as an embedded `movementLog` list on the match item
in DynamoDB; no table migration is required.

### 6.3 Visited locations — no schema change

The set of visited locations returned by `GET /api/match/{uuid}/locations` is derived
at query time:

```
visitedLocationIds = { character.id_location for all characters in the match }
                   ∪ { move.id_location_from for all log_movements rows for the match }
                   ∪ { move.id_location_to   for all log_movements rows for the match }
```

No changes are made to `gaming_state_locations` in Step 28. The full location-entry
state machine (including `flag_already_actived` for entry events) belongs to Step 32.

### 6.4 `list_locations_neighbors` — columns read by Step 28

| Column | Type | Role |
|--------|------|------|
| `id_location_from` | INTEGER | Origin location FK |
| `id_location_to` | INTEGER | Target location FK |
| `energy_cost` | INTEGER | Base edge traversal cost |
| `direction` | VARCHAR | Direction label (e.g., "NORTH") |
| `condition_registry_key` | VARCHAR (nullable) | Registry key to check; null = no condition |
| `condition_registry_value` | VARCHAR (nullable) | Expected registry value |

### 6.5 `list_locations` — columns read by Step 28

| Column | Type | Role |
|--------|------|------|
| `secure_param` | INTEGER | Safety indicator: `> 0` = safe; drives `weatherModifier` selection |
| `cost_energy_enter` | INTEGER | Additional energy cost to enter this location (Java/PostgreSQL only; treated as 0 in Python/AWS) |
| `max_characters` | INTEGER | Capacity limit; `0` = unlimited |

---

## 7. Business Logic

### 7.1 Movement execution sequence

`MovementService.startMovement(matchUuid, callerToken, request)`:

1. Resolve caller → character instance; if not found, raise `MATCH_NOT_FOUND`.
2. Load match; assert status == RUNNING → `MATCH_NOT_RUNNING`.
3. Assert character is awake (not sleeping, not in coma) → `CHARACTER_CANNOT_ACT`.
4. Load neighbor edges for the character's current location; assert `targetLocationUuid`
   appears in the list → `NOT_A_NEIGHBOR`.
5. If the matched edge has `conditionRegistryKey != null`, look it up in the match
   registry; assert it equals `conditionRegistryValue` → `MOVEMENT_CONDITION_NOT_MET`.
6. Compute `carriedWeight` (0 in Step 28); assert weight ≤ capacity → `OVERWEIGHT`.
7. Compute `totalEnergyCost` (§4); assert `character.energy >= totalEnergyCost` →
   `INSUFFICIENT_ENERGY`.
8. Count characters at target; if `maxCharacters > 0` and count == max →
   `LOCATION_FULL`.
9. Deduct energy: `character.energy -= totalEnergyCost`.
10. Update `gaming_character_instance.id_location = targetLocation.id`.
11. Insert a `log_movements` row writing `fromId` → `id_location_from`, `toId` → `id_location_to`, and `totalEnergyCost` → `energy` (the existing column; no `energy_cost` or timestamp columns are added in the Java schema).
12. Return `MovementStartResponse`.

### 7.2 Locations query sequence

`MovementService.getLocations(matchUuid, callerToken)`:

1. Resolve caller → character instance; if not found, raise `MATCH_NOT_FOUND`.
2. Compute visited set from character positions and `log_movements` (§6.3).
3. For each visited location:
   a. Count characters currently at that location.
   b. Load neighbor edges (from `list_locations_neighbors`).
   c. Resolve `weatherModifier` from the match's current weather rule.
   d. Compute `totalEnergyCost` per neighbor (§4).
   e. Evaluate `conditionMet` for each neighbor.
4. Return `MatchLocationsResponse`.

### 7.3 Seed data adjustment

The neighbor edge `energy_cost` column in the seed data (Java SQLite and PostgreSQL
`R__insert_story_seed_data.sql` / `R__insert_dev_test_data.sql`) was bumped to `2` to
give the Robot suite a non-zero baseline cost to assert against. Python
`scripts/seed_stories.py` adds a second location with a neighbor link to location 1 for
the same purpose.

---

## 8. Per-Project Implementation

### 8.1 Java (reference implementation)

**Core module**

- [x] `MovementPort` (`core/.../port/match/`): load match + character, load neighbor edges, load weather modifier, load location capacity, load visited location set.
- [x] `MovementStorePort` (`core/.../port/match/`): update character location + energy, insert `log_movements` row.
- [x] `MovementService` (`core/.../service/match/`): full 12-step sequence (§7.1); `getLocations` query (§7.2).
- [x] `MovementStoreAdapter` (`core/.../persistence/match/`): JPA implementation.
- [x] `LogMovementEntity` + `LogMovementEntityId` (`core/.../entity/match/`): composite PK `(id, id_match)`.
- [x] `LogMovementRepository` (`core/.../repository/match/`): Spring Data JPA.
- [x] `CoreConfig`: `MovementPort` and `MovementStorePort` beans wired.

**Flyway migrations**

- [x] `V0.28.0__add_log_movements.sql` in both `adapter-sqlite` and `adapter-postgres`.

**Adapter-rest**

- [x] `MovementController` (`adapter-rest/controller/match/`): `POST /api/gameplay/{uuid}/movements/start`; `GET /api/match/{uuid}/locations`.
- [x] `MovementStartRequest`, `MovementStartResponse`, `MatchLocationsResponse` DTOs.
- [x] `MatchAdminController`: new `GET /api/admin/matches/{uuid}/locations` method.

**OpenAPI**

- [x] `adapter-rest/src/main/resources/openapi/v0.28.0-movement-api.yaml`: documents all three endpoints (start, public locations, admin locations).

**Unit tests**

- [x] `MovementServiceTest`: validation sequence (all 8 codes + 400 + 401), cost formula (safe + unsafe + no weather), location capacity logic, weight check stub, success path.
- [x] `MovementStoreAdapterTest`: DB read/write paths for move commit and log insert.
- [x] `MovementControllerTest`: HTTP 200 / all 4xx paths for start; 200 / 404 for locations.
- [x] `MatchAdminControllerTest` (extended): admin locations 200 / 404 paths.

Full `mvn clean test` = BUILD SUCCESS (core 1060 tests; Flyway V0.28.0 applied as a
no-op; application context boots).

### 8.2 Python backend

- [x] `movement_models.py` (`app/core/models/match/`): dataclasses for request, response, location-with-neighbors, neighbor-cost.
- [x] `movement_ports.py` (`app/core/ports/match/`): abstract port interfaces.
- [x] `movement_service.py` (`app/core/services/match/`): domain orchestrator; mirrors Java validation sequence; `cost_energy_enter` treated as 0 (not in schema).
- [x] `movement_store_adapter.py` (`app/adapters/persistence/match/`): SQLAlchemy implementation; `LogMovementEntity` added to `models.py`.
- [x] `movement_controller.py` (`app/adapters/rest/match/`): FastAPI routes.
- [x] `match_admin_controller.py`: new admin locations route.
- [x] `launcher.py`: movement service + controller wired.
- [x] `scripts/seed_stories.py`: location 2 added with a neighbor edge to location 1.
- [x] `tests/test_movement_service.py` and `tests/test_movement_controller.py`.

Full Python suite: **679 tests passed**. Movement logic coverage ≈ 98%.

### 8.3 AWS Serverless

- [x] `lambda/match/handler.py`:
  - `_start_movement(event, context)`: full validation + move + log append.
  - `_get_locations(event, context)`: public locations endpoint.
  - `_get_admin_locations(event, context)`: admin locations endpoint (no ownership check).
  - `_visited_locations_payload(match)`: derives visited set from characters + `movementLog`.
  - Helper functions: neighbor condition check, weather-modifier resolution, capacity check.
- [x] `template/match.yaml`: `StartMovementRoute`, `GetLocationsRoute`, `AdminMatchLocationsRoute` SAM routes.
- [x] `tests/test_movement_handler.py`.

Full AWS suite: **89 tests passed**.

### 8.4 Robot Framework E2E suite

**Suite:** `code/tests/robot/tests/28_movement/movement.robot`  
**Tags:** `movement`, `step28`

**New keywords in `resources/matches.resource`:**

| Keyword | Purpose |
|---------|---------|
| `Start Movement` | `POST /api/gameplay/{uuid}/movements/start` with bearer token and `targetLocationUuid` body |
| `Get Locations` | `GET /api/match/{uuid}/locations` with bearer token |
| `Admin Get Locations` | `GET /api/admin/matches/{uuid}/locations` with admin token |

**Seed prerequisites:** seed story includes at least two connected locations with a
neighbor edge (`energy_cost = 2`) so the suite can traverse and assert the correct
energy deduction and response fields.

**Result:** 10/10 test cases pass; total Robot run 399/399 passed.

### 8.5 React-game frontend

- [x] `src/api/matches.js`: new `startMovement(uuid, targetLocationUuid, token)` and `getMatchLocations(uuid, token)` functions.
- [x] `src/features/gameplay/cards/MovementCard.jsx`: new card component; displays the neighbor location name, direction, and `totalEnergyCost`; shows a move action button; uses `lockInfo` (not `label`) when energy is insufficient, following the established Card convention.
- [x] `GameBook.jsx`: fetches `getMatchLocations` on load and after each successful move; renders a `<MovementCard>` per neighbor at the previous "TODO for every neighbor-location" comment point; refreshes locations state after move completes.
- [x] `src/i18n/en.json` and `it.json`: new keys `game.movement.action`, `game.movement.cost`, `game.movement.noEnergy`.
- [x] `src/test/MovementCard.test.jsx`: renders cost; renders locked state when energy insufficient; calls `startMovement` on button click.
- [x] Extended `GameBook` mock tests updated for new neighbor props.

Full react-game suite: **408 tests passed**.

> **Convention note:** `MovementCard` uses `lockInfo` (not the `label` prop) to display
> the insufficient-energy message. Do not pass `label` to `Card` or `CardButtons` — use
> `lockInfo` instead (established card convention).

### 8.6 React-admin frontend

- [x] `src/api/matchApi.js`: new `getMatchLocations(uuid)` function.
- [x] `MatchDetailPage.jsx`: new "Movement — characters & neighbor energy cost" card section displaying, for each occupied location, the current `characterCount` and a neighbor sub-list with columns `direction`, `baseEnergyCost`, `totalEnergyCost`. The section is hidden gracefully when the endpoint returns an error (backward compatibility with older backends).
- [x] Test files updated for the new section.

Full react-admin suite: **402 tests passed**.

---

## 9. Testing Strategy

### 9.1 Unit tests

| Project | File | Key scenarios |
|---------|------|---------------|
| Java | `MovementServiceTest` | All 8 ordered validation codes; cost formula safe vs unsafe; no-weather modifier = 0; capacity limit; weight stub always passes; success path energy deduction; log row inserted |
| Java | `MovementStoreAdapterTest` | Load neighbors; load visited set; update character location/energy; insert log_movements row |
| Java | `MovementControllerTest` | HTTP 200 on success; 400 MISSING_TARGET; 404 MATCH_NOT_FOUND; 409 variants for each validation step |
| Java | `MatchAdminControllerTest` | Admin locations 200; 404 on unknown match |
| Python | `test_movement_service.py` | Same validation sequence via pytest with mocked ports |
| Python | `test_movement_controller.py` | HTTP 200 / all error paths; admin endpoint |
| AWS | `test_movement_handler.py` | Start move success + all error codes; locations response shape; admin locations; movementLog append |
| react-game | `MovementCard.test.jsx` | Renders cost; lockInfo shown when energy insufficient; button triggers `startMovement` |
| react-admin | `MatchDetailPage.test.jsx` | Movement card section rendered; characterCount and neighbor costs displayed |

**Test counts (all green):** Java `mvn clean test` BUILD SUCCESS (core 1060; Flyway V0.28.0 no-op); Python 679; AWS 89;
react-game 408; react-admin 402.

### 9.2 Robot Framework E2E suite

**Suite:** `code/tests/robot/tests/28_movement/movement.robot` — **10 test cases, 10/10 passed** (399/399 total live run)

| Test case | Assertion |
|-----------|-----------|
| `Locations Endpoint Returns Visited With Total Energy Cost` | `GET /locations` returns 200; response has `matchUuid`, at least one location with `characterCount`, `safe`, and a non-empty `neighbors` list where each neighbor carries `totalEnergyCost >= 0` |
| `Move To Neighbor Deducts Energy And Updates Location` | `POST movements/start` returns 200; `toLocationUuid` matches the requested target; `energySpent >= 1`; `newEnergy >= 0` |
| `Visited Locations Grow After A Move` | After a successful move, `GET /locations` includes the `toLocationId` returned by the move response |
| `Move To Non Neighbor Returns 409` | Moving to a zero UUID (not adjacent) returns 409 `NOT_A_NEIGHBOR` |
| `Move Without Target Returns 400` | A movement request with blank `targetLocationUuid` returns 400 `MISSING_TARGET` |
| `Move On Non Running Match Returns 409` | Moving on a CREATED (not started) match returns 409 `MATCH_NOT_RUNNING` |
| `Move Unknown Match Returns 404` | Moving on a non-existent match UUID returns 404 `MATCH_NOT_FOUND` |
| `Move Without Token Returns 401` | `POST /movements/start` with no Authorization header returns 401 |
| `Locations Without Token Returns 401` | `GET /locations` with no Authorization header returns 401 |
| `Admin Locations View Returns Visited Locations` | `GET /api/admin/matches/{uuid}/locations` returns 200 with a non-empty `locations` array (admin port, no ownership check) |

---

## 10. API Changes Summary

| Endpoint | Status | Change |
|----------|--------|--------|
| `POST /api/gameplay/{uuidMatch}/movements/start` | **New** (v0.28.0) | Move character to neighbor; validates energy, adjacency, conditions, capacity |
| `GET /api/match/{uuidMatch}/locations` | **New** (v0.28.0) | Visited locations with weather-resolved neighbor energy costs |
| `GET /api/admin/matches/{uuidMatch}/locations` | **New** (v0.28.0) | Admin variant of locations endpoint (port 8044; no ownership check) |

No existing endpoints are modified. No existing error codes are removed.

---

## 11. Notes

1. **Move target identified by UUID, not by direction or id.** The client sends
   `targetLocationUuid` so the API is stable even when the story editor changes the
   direction label. The backend resolves the UUID to a neighbor edge and validates
   adjacency using the `id_location_to` FK.

2. **`log_movements` reused from V0.10.9, not created in Step 28.** The table was
   provisioned alongside the other `log_*` tables during Step 10 for the Step 39 action
   history. Step 28 writes the move's total energy cost into the existing `energy` column.
   The two `V0.28.0__add_log_movements.sql` Flyway files are intentional no-ops that only
   reserve the version slot — they add no columns. The table is append-only and has no
   update path.

3. **Carried weight is 0 until Step 33/34.** The `OVERWEIGHT` validation exists and
   returns a distinct error code, but the weight computation always returns 0 in Step 28
   because inventory management (items in backpack, food, magic stacks) is deferred to
   Step 33/34. The code path is tested with a stub.

4. **`cost_energy_enter` is Java/PostgreSQL only.** Python's `list_locations` model and
   the AWS DynamoDB location records do not carry this column. The Python and AWS
   backends treat entry cost as `0`. The formula is still consistent across backends
   because Java seed data sets `cost_energy_enter = 0` on tutorial locations.

5. **Weather modifier is 0 when no weather is active.** The movement system reads
   `id_current_weather` from the match. When the field is null (before match start, or
   when no rule was eligible at the last time-start), both `costMoveSafeLocation` and
   `costMoveNotSafeLocation` default to `0` and do not inflate the cost.

6. **Visited-locations derivation is a union, not a log replay.** The backend does not
   replay the movement history to reconstruct state; it performs a set union of
   `{ current character positions } ∪ { from/to ids in log_movements }`. This is
   O(characters + moves) and requires no cursor or pagination in Step 28.

7. **Concurrent movement locking is deferred to Step 67.** The capacity check in step 8
   of the validation sequence (§3) is first-come-first-served under the assumption of
   single-player matches in Steps 28–66. Race conditions on the `LOCATION_FULL` check
   when two players move simultaneously are addressed by the concurrent-movement locking
   system in Step 67.

8. **react-game `MovementCard` uses `lockInfo`, not `label`.** When the character lacks
   sufficient energy, the card passes the message via the `lockInfo` prop to `Card` /
   `CardButtons`. Do not add a `label` prop to Card components — this is the established
   convention in the frontend codebase.

9. **Admin locations endpoint is on port 8044 only.** As with all `/api/admin/**`
   routes, `GET /api/admin/matches/{uuid}/locations` is served exclusively on the
   dedicated admin connector (port 8044). The public connector (8042) returns 404 for
   this path.

# Paths Games V0 - Step 0.28.2: Neighbor "Return Card" (idCardBack) — AWS Bugfix & Robot Suite 29

This document covers two related deliveries shipped in **v0.28.2** of Paths Games:

1. **AWS backend bugfix** — `GET /api/match/{uuid}/info` was returning the wrong `cardBack`
   for neighbor edges that had an explicit `idCardBack` set via the admin API.
2. **New Robot E2E suite** `29_neighbor_card_back` — backend-agnostic regression test
   that catches the above desync and validates the full admin-set `idCard`/`idCardBack`
   round-trip on any backend.

Neither change affects the Java or Python backends. No Flyway migration is required.
The version number stays **0.28.2** (pom `0.28.2-SNAPSHOT`; no bump).

---

## 1. AWS Bugfix — neighbor `cardBack` desync

### 1.1 Symptom

After setting a distinct `idCardBack` on a neighbor edge via the react-admin Story Editor
(`PUT /api/admin/stories/{uuid}/location-neighbors/{euuid}` on port 8044), the gameplay
endpoint `GET /api/match/{uuid}/info?lang=en` still returned `cardBack` equal to the
forward `card` — as if `idCardBack` had never been set.

The same issue affected any field written by the admin CRUD on a neighbor edge
(`direction`, `energyCost`, `idCard`, `idCardBack`): changes were invisible to the
gameplay engine.

### 1.2 Root cause (AWS-only)

On the AWS DynamoDB Single Table Design, the STORY item stores **two separate arrays** for
location neighbor edges:

| Array key | Written by | Read by |
|-----------|-----------|---------|
| `neighbors` | Story seed / import (`POST /api/admin/stories/import`) | Gameplay engine (`match/handler.py`) — match-info, movement, visited locations |
| `locationNeighbors` | Admin CRUD (`PUT /api/admin/stories/.../location-neighbors/{uuid}`) via `TYPE_MAP` entity handling | Admin read endpoints only |

When an admin updated a neighbor edge (including setting `idCardBack`), the change landed
in `locationNeighbors`. The gameplay engine continued to read from `neighbors`, which
still held the original seed values — so `cardBack` fell back to the forward card because
the stale `neighbors` copy carried no `idCardBack`.

This was a **general desync**, not limited to `cardBack`: any admin edit to direction,
energyCost, idCard, or idCardBack was invisible to the gameplay engine on AWS.

Java and Python were **not** affected: both backends maintain a single source-of-truth
table (`list_locations_neighbors`) that admin writes and gameplay reads share.

### 1.3 Fix

A new helper `_story_neighbors(story)` was added to
`code/backend/aws/lambda/match/handler.py`:

```python
def _story_neighbors(story):
    """Return the authoritative neighbor list for a story item.

    Admin CRUD edits the `locationNeighbors` array (the content-API copy), while
    the seed writes only the gameplay `neighbors` array. Read `locationNeighbors`
    first so admin edits (direction, energyCost, idCard, idCardBack, …) are
    always visible to the gameplay engine. Fall back to `neighbors` for seed
    stories that never carried a `locationNeighbors` copy."""
    return (story or {}).get('locationNeighbors') or (story or {}).get('neighbors') or []
```

The helper is applied at the **three gameplay read-points** in `match/handler.py`:

| Function | Role |
|----------|------|
| `_build_locations_active` | Builds the `locationsActive` neighbor list in `GET /api/match/{uuid}/info` |
| `_find_edge` | Resolves the neighbor edge for `POST /api/gameplay/{uuid}/movements/start` (movement validation) |
| `_build_locations_visited` | Builds the neighbor sub-list for `GET /api/match/{uuid}/locations` |

Priority: `locationNeighbors` (admin-edited, always up-to-date) over `neighbors`
(seed/import copy, may be stale). Seed stories that were never admin-edited carry only
`neighbors` and continue to work via the fallback.

### 1.4 Unit tests

New regression test added in `code/backend/aws/tests/test_match_handler.py`:

```
test_match_info_neighbor_cardback_reads_admin_edited_location_neighbors
```

The test constructs a story item with a stale `neighbors` copy (no `idCardBack`) and an
admin-edited `locationNeighbors` copy (with a distinct `idCardBack`). It asserts that
`GET /api/match/{uuid}/info` returns the `cardBack` from `locationNeighbors`, not the
stale fallback from `neighbors`.

**AWS test suite after fix: 407 pass** (was 402 before — net +5 for this fix plus
prior tests that were already green).

### 1.5 Deploy note

The fix is in `lambda/match/handler.py`. The live AWS endpoint at
`api-test.paths.games` requires a **Lambda redeploy** (`sam deploy --config-env dev`) to
reflect the fix — it is not yet deployed as of the time of writing.

---

## 2. New Robot Suite — `29_neighbor_card_back`

**File:** `code/tests/robot/tests/29_neighbor_card_back/neighbor_card_back.robot`

**Tags:** `match-info`, `movement-back`, `step28`, `regression`

### 2.1 Purpose

End-to-end regression that validates the full `idCard` + `idCardBack` contract on a
neighbor edge — from admin write to gameplay read. It is the canonical test that catches
the AWS desync described in §1.

### 2.2 Backend agnosticism

Card IDs and the story's start location are discovered at runtime via admin API calls,
not hard-coded. The suite therefore runs identically against:

- Java + SQLite (default dev profile)
- Java + PostgreSQL (prod profile)
- Python backend
- AWS Serverless backend

### 2.3 Test flow

| Phase | Actions |
|-------|---------|
| **Suite Setup** | Create admin session (port 8044); call `Pick Story Loadout` for a joinable story/difficulty/character/class/trait combo; obtain a guest token via `POST /api/auth/guest` |
| **Admin: discover catalog** | `GET /api/admin/stories/{uuid}/cards` → pick two distinct cards (A and B) |
| **Admin: discover start location** | `GET /api/admin/stories/{uuid}` → read `idLocationStart` |
| **Admin: find neighbor edge** | `GET /api/admin/stories/{uuid}/location-neighbors` → first edge with an endpoint on the start location |
| **Admin: wire idCard + idCardBack** | `PUT /api/admin/stories/{uuid}/location-neighbors/{euuid}` with `{idCard: A, idCardBack: B}` |
| **Player: create match** | `POST /api/matches` → `POST /api/matches/{uuid}/join` → `POST /api/matches/{uuid}/start` |
| **Player: read match-info** | `GET /api/match/{uuid}/info?lang=en` |
| **Assert** | The edited neighbor in `locationsActive[start].neighbors` has `card.uuid == uuid_A`, `cardBack.uuid == uuid_B`, and `card.uuid != cardBack.uuid`; both cards resolve via `GET /api/admin/stories/{uuid}/cards/{uuid}` |
| **Teardown** | `PUT` the neighbor back to its original `idCard`/`idCardBack` values |

### 2.4 Keywords

New keywords implemented in the suite file itself (not extracted to shared resources,
since they are specific to this regression):

| Keyword | Purpose |
|---------|---------|
| `Suite Setup Neighbor Card Back` | Wires admin session + guest token + loadout suite variables |
| `Admin List Entities` | `GET /api/admin/stories/{uuid}/{entity_type}` → returns list |
| `Card Id And Uuid` | Extracts `(cardId, cardUuid)` from a card entity dict |
| `Story Start Location` | Reads `idLocationStart` from story detail |
| `Neighbor Touching` | Finds first neighbor edge with an endpoint on the given location ID |
| `Start Match And Get Info` | Creates, joins, starts a match and returns the match-info JSON |
| `Active Location` | Finds the start location entry in `locationsActive` |
| `Neighbor In Info By Edge` | Finds a neighbor by its `(idLocationFrom, idLocationTo)` pair |
| `Restore Neighbor Cards` | Teardown: restores original `idCard`/`idCardBack` on the edited neighbor |

### 2.5 Assertions

```
card.uuid         == uuid of card A (set via idCard)
cardBack.uuid     == uuid of card B (set via idCardBack)
card.uuid         != cardBack.uuid
GET /cards/uuid_A → HTTP 200  (real catalog card)
GET /cards/uuid_B → HTTP 200  (real catalog card)
```

### 2.6 Status

Validated in dry-run. The suite is designed to be the definitive catch for the
`locationNeighbors` / `neighbors` desync on AWS — it will **fail** against the
pre-fix AWS Lambda and **pass** against all backends with the fix applied.

---

## 3. Files Changed

| File | Change |
|------|--------|
| `code/backend/aws/lambda/match/handler.py` | Added `_story_neighbors()` helper; applied at `_build_locations_active`, `_find_edge`, `_build_locations_visited` |
| `code/backend/aws/tests/test_match_handler.py` | New regression test `test_match_info_neighbor_cardback_reads_admin_edited_location_neighbors` |
| `code/tests/robot/tests/29_neighbor_card_back/neighbor_card_back.robot` | New E2E suite |

No changes to Java backend, Python backend, React frontends, Flyway migrations,
DynamoDB schema, or OpenAPI specs.

---

## 4. API Contract

No new endpoints. The affected endpoint is:

| Endpoint | Status |
|----------|--------|
| `GET /api/match/{uuid}/info?lang=en` | Bug fix only (AWS): `neighbors[*].cardBack` now correctly resolves `idCardBack` when it differs from `idCard`. Contract unchanged. |

The `idCardBack` field on `list_locations_neighbors` / the DynamoDB `locationNeighbors`
array was already part of the API contract (added in v0.28.2 react-admin Story Editor
feature). This fix ensures the gameplay engine honours it on AWS.

---

## 5. Notes

1. **Java and Python are not affected.** Both backends use a single table
   (`list_locations_neighbors`) for admin writes and gameplay reads. The desync is
   structurally impossible there.

2. **The fix is backward-compatible.** Seed stories that only carry `neighbors` (no
   `locationNeighbors`) continue to work via the fallback in `_story_neighbors`. No
   data migration is required.

3. **The Lambda must be redeployed to take effect on `api-test.paths.games`.** Running
   `sam deploy --config-env dev` from `code/backend/aws/` will push the fix to the live
   dev endpoint.

4. **Suite 29 is backend-agnostic.** Because it discovers card IDs and the start location
   at runtime, it does not require any changes to the seed data and runs correctly on all
   four backend targets.


# Version Control

- **Document Version**: 0.28.2

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.28.0 | Initial Step 28 documentation: movement system (adjacency validation, energy cost formula, 8-code ordered validation, existing log_movements table reused from V0.10.9, V0.28.0 Flyway no-ops, visited-locations derivation), new POST movements/start + GET locations + GET admin/locations endpoints, MovementCard in react-game, movement card in react-admin MatchDetailPage, Robot suite 28_movement 10/10 (399/399 total) | June 25, 2026 |
  | 0.28.2 | Initial documentation: AWS neighbor cardBack desync bugfix (`_story_neighbors` helper applied at 3 gameplay read-points); new Robot suite 29 backend-agnostic regression | June 26, 2026 |

- **Last Updated**: June 25, 2026
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
