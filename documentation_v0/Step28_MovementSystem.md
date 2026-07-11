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
| `flag_back` | INTEGER | One-way link control: `1` = two-way (destination B lists source A as a neighbor); `0` = one-way (B does NOT list A as a neighbor). Forward travel A→B is always permitted regardless of this flag. See §v0.28.3. |
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


# Paths Games V0 - Step 0.28.2: Neighbor "Return Card" (idCardBack)

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



# Paths Games V0 - Bugfix Event-to-Location Binding — idSpecificLocation

This document describes a **cross-backend bugfix** shipped as part of v0.28.2.

The issue affected `GET /api/match/{uuid}/info?lang=en`: events appeared under the wrong
location (or not at all) inside `locationsActive[].events` when their owning location had
been set or changed via the admin panel.

Java was not affected. AWS and Python each had a distinct root cause. The fix is
regression-guarded by new unit tests in both backends and a new backend-agnostic Robot
E2E suite `30_event_location`.

---

## 1. Symptom

After an admin updates an event's location via
`PUT /api/admin/stories/{uuid}/events/{euuid}` (field `idSpecificLocation`), a subsequent
call to `GET /api/match/{uuid}/info?lang=en` returned that event:

- under the **old** location (AWS), or
- **not at all** (Python and any event created entirely through the admin panel).

---

## 2. Root Causes

### 2.1 AWS Lambda (`lambda/match/handler.py`)

At story import time the seed handler copies `idSpecificLocation` into a derived alias
field `idLocation` on each event item stored in DynamoDB:

```python
# story/handler.py — import path (simplified)
e['idLocation'] = e.get('idSpecificLocation')
```

`_build_locations_active` then filtered events using this `idLocation` alias.

The alias was **set once at import and never refreshed** when an admin later changed
`idSpecificLocation` via the CRUD endpoints. Consequence:

| Scenario | Observed result |
|----------|-----------------|
| Admin changes `idSpecificLocation` from A to B | Event still appears under A (`idLocation` stale) |
| Event created entirely via admin (no import) | Event missing from `locationsActive` (`idLocation` never set) |

### 2.2 Python (`app/adapters/persistence/story/`)

The Python `EventEntity` model originally declared the column as `id_location`, while the
shared admin/seed contract uses the camelCase key `idSpecificLocation` (snake_case:
`id_specific_location`, matching Java's column name).

The mismatch meant:

- `save_events` read `item.get("idLocation")` — the field seed data does **not** send
  (`seed_stories.py` uses `idSpecificLocation`), so the column was never populated.
- React-admin sends `idSpecificLocation` → the admin PUT path wrote `idSpecificLocation`
  correctly, but the read path (match-info filter) used the old `id_location` column which
  was always null.

### 2.3 Java

Java was **not affected**. The JPA `EventEntity` maps directly to the `id_specific_location`
column (shared with the admin table). `MatchQueryService` filters events using
`getIdSpecificLocation()`, so admin edits are reflected immediately.

---

## 3. Fix

### 3.1 AWS — new helper `_event_location`

Added to `code/backend/aws/lambda/match/handler.py`:

```python
def _event_location(event):
    """Owning location id of an event.
    `idSpecificLocation` is the admin-canonical field (what the admin form writes).
    `idLocation` is a legacy alias set only at import time and NOT refreshed on admin edits.
    Prefer idSpecificLocation so a location change in admin is reflected immediately;
    fall back to idLocation for seeded events that pre-date this fix.
    """
    e = event or {}
    return e.get('idSpecificLocation') if e.get('idSpecificLocation') is not None \
        else e.get('idLocation')
```

`_build_locations_active` now calls `_event_location(e)` instead of reading `e.get('idLocation')`
directly. No DynamoDB schema change; no re-import required.

### 3.2 Python — column rename + dual-key read

Changes in `code/backend/python/app/adapters/persistence/story/`:

| File | Change |
|------|--------|
| `models.py` — `EventEntity` | Column renamed from `id_location` to `id_specific_location` (aligns with Java and the shared SQL schema) |
| `story_persistence_adapter.py` — `save_events` | Now reads `item.get("idSpecificLocation") or item.get("idLocation")` (fallback preserves legacy seed data) |
| `story_read_adapter.py` — `find_events_by_story_id` | Returns `"id_specific_location": r.id_specific_location` |
| `match/story_match_read_adapter.py` — `find_events_by_story_id` | Returns `"id_specific_location": r.id_specific_location` |

The match query service filters events using `event.get("id_specific_location")`, replacing
the previous `event.get("id_location")`.

**No Flyway migration required** for Python (SQLite/PostgreSQL column name change handled
by SQLAlchemy model; existing rows with data in `id_location` are handled via fallback in
`save_events`).

---

## 4. API Contract

No API contract change. `GET /api/match/{uuid}/info?lang=en` already declared
`locationsActive[].events` in its response. This fix makes the field populate correctly
after admin edits.

The relevant admin endpoint used to trigger the bug (and validate the fix):

```
PUT /api/admin/stories/{storyUuid}/events/{eventUuid}
Body: { "idSpecificLocation": "<location-uuid>" }
```

---

## 5. Tests

### 5.1 AWS Unit Tests

New regression test in `code/backend/aws/tests/test_match_handler.py`:

```
test_match_info_event_appears_under_idSpecificLocation_not_stale_idLocation_alias
```

Scenario: an event has `idSpecificLocation = "loc-B"` but a stale `idLocation = "loc-A"`.
The test asserts the event appears under location B in `locationsActive`, not A.

AWS suite after fix: **408 pass**.

### 5.2 Python Unit Tests

New tests in `code/backend/python/tests/test_story_persistence_adapter_extra.py`:

- `save_events` persists `idSpecificLocation` into the `id_specific_location` column.
- `save_events` with only legacy `idLocation` key still writes the column (fallback path).
- `find_events_by_story_id` returns `id_specific_location` in the dict.

Python suite after fix: **702 pass**.

### 5.3 New Robot Suite — `30_event_location`

File: `code/tests/robot/tests/30_event_location/event_location.robot`

Tags: `match-info`, `event-location`, `step28`, `regression`

The suite is backend-agnostic (runs against Java, Python, and AWS via `dev.yaml`):

| Step | Action |
|------|--------|
| Setup | Authenticate admin + player; discover story UUID and start location |
| 1 | Pick the first addressable event; record its original `idSpecificLocation` |
| 2 | `PUT /api/admin/stories/{uuid}/events/{euuid}` — set `idSpecificLocation` to the start location |
| 3 | Create match → join → start match |
| 4 | `GET /api/match/{uuid}/info?lang=en` — assert the event appears under `locationsActive[start].events` |
| Teardown | Restore the event's original `idSpecificLocation` via another PUT |

---

## 6. Deployment Note (AWS)

The AWS fix is in `lambda/match/handler.py`. **Lambda redeployment is required** on
`api-test.paths.games` before the fix takes effect in the cloud environment. Local SAM
runs pick it up immediately.

---

## 7. Files Changed

| Backend | File(s) |
|---------|---------|
| AWS Lambda | `code/backend/aws/lambda/match/handler.py` — `_event_location()` helper + filter call in `_build_locations_active` |
| AWS Tests | `code/backend/aws/tests/test_match_handler.py` — new regression test |
| Python | `code/backend/python/app/adapters/persistence/story/models.py` — column rename on `EventEntity` |
| Python | `code/backend/python/app/adapters/persistence/story/story_persistence_adapter.py` — `save_events` dual-key read |
| Python | `code/backend/python/app/adapters/persistence/story/story_read_adapter.py` — `find_events_by_story_id` |
| Python | `code/backend/python/app/adapters/persistence/match/story_match_read_adapter.py` — `find_events_by_story_id` |
| Python Tests | `code/backend/python/tests/test_story_persistence_adapter_extra.py` — new unit tests |
| Robot | `code/tests/robot/tests/30_event_location/event_location.robot` — new E2E suite |
| Java | No change |




---

# Paths Games V0 - Step 0.28.3: One-Way Neighbor Links (flagBack)

This section documents the **v0.28.3 bugfix** that enforces one-way neighbor link semantics
via the `flag_back` column of `list_locations_neighbors` across all backends.

---

## Overview

Before v0.28.3 every backend treated all neighbor edges as bidirectional: if an edge
A→B existed in `list_locations_neighbors`, the gameplay APIs always returned A as a neighbor
of B, regardless of the `flag_back` value. The `flag_back` column was stored but never
read by any backend's neighbor-filtering logic.

v0.28.3 enforces the following contract, which was already documented in the data model
(Step 09) but had not been implemented in the movement engine:

| `flag_back` value | Meaning | Effect on "standing on B" |
|---|---|---|
| `1` (YES) | Two-way link | A **is** returned in B's neighbor list by `/info` and `/locations` |
| `0` (NO) | One-way link | A is **not** returned in B's neighbor list; the forward link A→B remains fully traversable |

Forward travel (A→B) is always allowed regardless of `flag_back`. Only the reverse view
(what neighbors are visible from B) is gated.

---

## Affected APIs

All three gameplay read-points that produce a neighbor list now honour `flag_back`:

| Endpoint | Read-point |
|----------|-----------|
| `GET /api/match/{uuid}/info` | `locationsActive[].neighbors` |
| `GET /api/match/{uuid}/locations` | `locations[].neighbors` |
| `POST /api/gameplay/{uuid}/movements/start` | Neighbor lookup used in `NOT_A_NEIGHBOR` validation (step 4 in §3) |

A `POST /movements/start` request that targets location A while the character stands on B,
where the A→B edge has `flag_back=0`, returns **409 `NOT_A_NEIGHBOR`** because A is not
visible in B's neighbor list.

---

## Per-Backend Changes

### Java

- `MovementStorePort.NeighborEdge` gained a `flagBack` field and a helper method
  `traversableFrom(locId)` that returns `true` when `locId == idLocationFrom` (forward
  direction is always open) or when `flagBack == 1` (two-way edge).
- `MovementStoreAdapter` maps the `flag_back` column into `NeighborEdge`.
- `MovementService.buildLocations` (GET /locations neighbor list) and `findEdge`
  (POST /movements/start adjacency check) filter using `traversableFrom`.
- `MatchQueryService` (GET /api/match/{uuid}/info) filters `locationsActive` neighbor
  lists using the same `traversableFrom` predicate.
- Postgres dev seed: neighbor rows now set `flag_back=1` to restore expected bidirectional
  behaviour for existing tests.

### Python

- `flag_back` column was entirely absent from the `LocationNeighborEntity` ORM model; it
  has been added and mapped in the read adapters.
- `match_query_service` and `movement_service` filter neighbors using `flag_back`.
- `seed_dev_data` neighbor rows updated to `flag_back=1`.
- The generic admin CRUD path already persists `flagBack` automatically through the shared
  entity dict — no additional change required there.

### AWS Lambda

- `handler.py` gained a `_neighbor_traversable_from(neighbor, loc_id)` helper.
- Applied at three filter points: `_build_active_locations` (match-info),
  `neighbor_costs` (locations), and `_find_edge` (movement validation).
- Seed data already carried `flagBack=1` on all test edges.

### React-admin (Story Editor)

- The "Flag Back" select in the Loc Neighbors form now correctly saves the value `0` (NO).
  Previously the form submitted the empty string for the NO option, which was interpreted
  as a truthy value by some backends.
- The "Card Back ID" field is now hidden in the neighbor form unless Flag Back = YES,
  preventing confusion about card-back display on one-way edges.
- The entity table column previously labelled "flagBack" now renders the value as a
  human-readable "YES" / "NO" badge (column header: "Back").

---

## New Robot E2E Suite — `neighbor_flag_back.robot`

**File:** `code/tests/robot/tests/28_movement/neighbor_flag_back.robot`

**Tags:** `match-info`, `movement-back`, `flag-back`, `step28`, `regression`

### Purpose

End-to-end regression covering the full `flagBack` contract end-to-end: admin sets the
flag, a player moves to the destination B, and both `/info` and `/locations` are asserted
for the presence or absence of the backward link.

### Backend agnosticism

The suite discovers the forward edge A→B at runtime (no hard-coded IDs), so it runs
identically on Java (SQLite/PostgreSQL), Python, and AWS.

### Test flow

| Phase | Actions |
|-------|---------|
| **Suite Setup** | Admin + guest sessions; pick a joinable story loadout; find a forward edge leaving the start location A; set `flagBack=1` on that edge; start a match and perform the forward move A→B |
| **Test 1 — Flag Back YES** | Admin sets `flagBack=1`; asserts A appears in B's neighbors in both `/info` and `/locations` |
| **Test 2 — Flag Back NO** | Admin sets `flagBack=0`; asserts A is absent from B's neighbors in both `/info` and `/locations` |
| **Suite Teardown** | Restores the edge's original `flagBack` value via admin PUT |

### Test cases

| Test case | Assertion |
|-----------|-----------|
| `Flag Back YES Returns The Backward Neighbor` | `locationsActive[B].neighbors` contains the A→B edge in `/info`; location B's neighbor list in `/locations` contains A |
| `Flag Back NO Hides The Backward Neighbor` | A→B edge absent from `/info` and `/locations` for location B; B's own forward neighbors remain intact |

---

## Notes

1. **Forward travel is never blocked by `flag_back`.** `POST /movements/start` with
   `targetLocationUuid = B` while standing on A always succeeds (subject to energy and
   other conditions). Only the reverse view from B is affected.

2. **`flag_back=1` is the expected default for tutorial seed data.** All seed neighbor
   rows in Java (SQLite + PostgreSQL), Python, and AWS carry `flag_back=1`, ensuring
   existing Robot suites (which depend on bidirectional traversal) continue to pass without
   change.

3. **The admin form fix (React-admin) is the trigger, not an afterthought.** Before
   v0.28.3 the form could not reliably save `flagBack=0`; the backend fix is only fully
   usable now that the editor correctly persists the NO value.

---

# Paths Games V0 - Step 0.28.5: Location Cards on `GET /locations`

This section documents a **v0.28.5 feature** shipped across all three backends: the
locations endpoints now resolve a **full card object** for every visited location and
every neighbor, instead of exposing only the raw `idCard` foreign key.

## 12.1 Motivation

The new interactive world map (§13) needs a location photo/title/description to render
each node without issuing a second round-trip per location. Before v0.28.5, the client
had to resolve `idCard` → card details itself (or not render an image at all for
locations outside `/info`'s `locationsActive`, e.g. distant/unvisited nodes reachable via
`GET /locations`).

## 12.2 API changes

Both `GET /api/match/{uuid}/locations` and `GET /api/admin/matches/{uuid}/locations`
(admin port 8044) gain:

- A `card` field (nullable, `CardInfo` shape — same as the `card`/`cardBack` objects
  already returned by `GET /api/match/{uuid}/info`) on every entry of `locations[]`,
  resolved from that location's `idCard`.
- An `idCard` + `card` field on every entry of `locations[].neighbors[]`, resolved from
  the **neighbor location's** `idCard` (not the edge itself — the neighbor sub-list
  already returns `idLocation`/`uuid` for the target location, so `card` mirrors that
  same target).
- An optional query parameter `lang` (default `en`, falls back to `en` when the
  requested language has no text), following the same pattern already used by
  `GET /api/match/{uuid}/info` and `GET /api/stories`/`GET /api/stories/{uuid}`
  (see the `v0.19.13` lang-propagation note in Step 21).

No existing field is removed or renamed. The location/neighbor **lookup logic itself is
unchanged** — this is a pure enrichment of the existing response with resolved card data.

**Example (`locations[]` entry, abridged):**

```json
{
  "idLocation": 1,
  "uuid": "loc-001",
  "idCard": 5,
  "card": {
    "uuid": "card-uuid-v4",
    "cardType": "location",
    "urlImage": "https://...",
    "title": "The Old Mill",
    "description": "..."
  },
  "safe": true,
  "characterCount": 1,
  "neighbors": [
    {
      "idLocation": 2,
      "uuid": "loc-002",
      "direction": "NORTH",
      "idCard": 8,
      "card": { "uuid": "card-uuid-v4-2", "title": "Riverbank", "...": "..." },
      "baseEnergyCost": 2,
      "entryEnergyCost": 0,
      "weatherEnergyCost": 1,
      "totalEnergyCost": 3,
      "conditionMet": true
    }
  ]
}
```

## 12.3 Per-backend implementation

### Java

- `core/.../port/match/MovementPort.java`: `VisitedLocation` gained a `card` field;
  `NeighborCost` gained `idCard` + `card`; the `listLocations`/`listLocationsForAdmin`
  port method signatures gained a `lang` parameter.
- `core/.../service/match/MovementService.java`: now takes a `ContentQueryPort`
  dependency (in addition to `MovementStorePort`); a private `resolveCard(storyId,
  idCard, lang)` helper resolves each location/neighbor card. **The legacy 2-argument
  constructor is preserved** (delegates to a no-op content resolver) so any existing
  direct instantiation keeps compiling.
- `adapter-rest/.../dto/MatchLocationsResponse.java`: builds `card` via
  `CardInfoResponse.fromModel(...)`.
- `adapter-rest/.../controller/match/MovementController.java` and
  `adapter-admin/.../controller/match/MatchAdminController.java`: both locations
  endpoints accept `@RequestParam(required = false, defaultValue = "en") String lang`.
- `ms-launcher/.../config/CoreConfig.java`: `movementPort` bean now also wires the
  `ContentQueryPort` bean.
- OpenAPI `adapter-rest/src/main/resources/openapi/v0.28.0-movement-api.yaml`: new
  `CardInfo` schema (uuid, cardType, urlImage, alternativeImage, awesomeIcon, styleMain,
  styleDetail, styleImageLittle/Medium/Large, title, description, copyrightText,
  linkCopyright); `card` added to the location and neighbor schemas; `lang` query param
  added to both endpoints.

`mvn clean test` → **BUILD SUCCESS**.

### Python

- `app/core/models/match/movement_models.py`: `LocationWithNeighbors` and `NeighborCost`
  dataclasses gained `card` (and `idCard` on the neighbor).
- `app/core/services/match/movement_service.py`: `MovementService.__init__` gained an
  optional `story_read_port=None` parameter (backward-compatible — existing call sites
  that don't need card resolution keep working); `_resolve_card(story_id, id_card, lang)`
  and `_resolve_card_text(story_id, id_text, lang)` helpers resolve the card and its
  localized texts through `StoryMatchReadPort`.
- `app/adapters/rest/match/movement_controller.py` and `match_admin_controller.py`: both
  routes accept a `lang` query parameter (default `"en"`).
- `app/launcher.py`: `MovementService` construction wires the story read port.
- `scripts/seed_stories.py`: the tutorial story's locations now carry `idCard` (already
  present on Java/AWS seed data; Python seed previously omitted it).

Python suite: **711 tests pass**.

### AWS Serverless

- `lambda/match/handler.py`: `_visited_locations_payload(match, match_uuid, lang='en')`
  resolves each location/neighbor `card` from the story's `raw_cards`/`raw_texts` arrays,
  reusing the existing `resolve_card_from_raw` helper (`common.data_utils`) — the same
  function already used to resolve `card`/`cardBack` in `GET /api/match/{uuid}/info`, so
  card resolution stays consistent across endpoints.
- `_get_locations(user, match_uuid, lang='en')` and `_get_admin_locations(match_uuid,
  lang='en')` extract the `lang` query-string parameter and pass it through.

AWS suite: **414 tests pass**.

## 12.4 New Robot suite file

**File:** `code/tests/robot/tests/28_movement/location_cards.robot`
**Tags:** `movement`, `locations`, `location-card`, `step28`

Added to the existing `28_movement` folder (not a new numbered suite) since it exercises
the same `GET /locations` endpoints as `movement.robot`. Backend-agnostic — discovers a
joinable story/difficulty/character/class/trait loadout at runtime.

| Test case | Assertion |
|-----------|-----------|
| `Locations Endpoint Returns A Card For Every Visited Location` | Every entry in `locations[]` has a `card` key; when `idCard` is set, the card's `uuid` resolves via the content API |
| `Locations Endpoint Returns A Card For Every Neighbor` | Every neighbor has both `idCard` and `card`; the card resolves the same way |
| `Location Card Has All Required Fields` | The resolved card carries the full `CardInfoResponse` shape |
| `Locations Endpoint Accepts The Lang Parameter` | `?lang=en` is honored; the resolved card's `uuid` is non-empty |
| `Admin Locations Returns The Same Cards As The Player View` | The admin variant (port 8044) resolves the same card `uuid` as the player view for the first location |

## 12.5 Files changed

| Backend | File(s) |
|---------|---------|
| Java | `core/.../port/match/MovementPort.java`, `core/.../service/match/MovementService.java`, `adapter-rest/.../dto/MatchLocationsResponse.java`, `adapter-rest/.../controller/match/MovementController.java`, `adapter-admin/.../controller/match/MatchAdminController.java`, `ms-launcher/.../config/CoreConfig.java`, `adapter-rest/src/main/resources/openapi/v0.28.0-movement-api.yaml` |
| Java tests | `MovementServiceTest`, `MovementControllerTest`, `MatchAdminControllerTest` |
| Python | `app/core/models/match/movement_models.py`, `app/core/services/match/movement_service.py`, `app/adapters/rest/match/movement_controller.py`, `app/adapters/rest/match/match_admin_controller.py`, `app/launcher.py`, `scripts/seed_stories.py` |
| Python tests | `tests/test_movement_service.py` |
| AWS | `lambda/match/handler.py` |
| AWS tests | `tests/test_movement_handler.py` |
| Robot | `code/tests/robot/tests/28_movement/location_cards.robot` (new) |

## 12.6 Notes

1. **No change to location/neighbor lookup logic.** This is a read-time enrichment —
   the set of visited locations and the neighbor adjacency computation (§6–7 above) are
   untouched.
2. **Java's legacy 2-arg `MovementService` constructor is intentionally kept** so any
   caller that does not need card resolution (or predates this change) still compiles;
   it wires a no-op content resolver internally.
3. **AWS reuses `resolve_card_from_raw`**, the same helper already used for `card`/
   `cardBack` in `GET /api/match/{uuid}/info` — no new card-resolution code path was
   introduced, only extended to the locations endpoints.

---

# Paths Games V0 - Step 0.28.5: Interactive World Map (react-game)

This section documents the **v0.28.5 frontend feature**: an interactive, pannable/
zoomable map of the visited world, consumed from the enriched `GET /locations` response
(§12). No backend change is required beyond §12 — this section is react-game only.

## 13.1 Overview

The map is rendered as the **LEFT page of the game book**, in the same
`book-page-content` card style used elsewhere (gold title bar, back-arrow navigation),
with a parchment-light background. It replaces the current-location card while open;
the RIGHT page shows the `LocationCard` of whichever node is selected (defaulting to the
character's current location).

## 13.2 New files

| File | Role |
|------|------|
| `src/components/layout/Map.jsx` (exports `MapPage`) | The map page component: pan/zoom SVG canvas, node rendering, arrow rendering, zoom controls |
| `src/utils/mapGraph.js` (`buildMapGraph`, `edgeVisibility`) | Pure graph-building utility: turns the `/locations` payload + match-info into a `{ nodes, edges, currentId, width, height }` layout |
| `src/features/gameplay/cards/MapCard.jsx` | Small stats-view card (image from `data/images.json`, id `"map"`) whose footer button opens the map |
| `src/test/Map.test.jsx`, `src/test/mapGraph.test.js`, `src/test/MapCard.test.jsx` | Unit tests for the three new modules |

## 13.3 Graph construction (`mapGraph.js`)

`buildMapGraph(info, matchLocations)` combines two data sources:

- `GET /api/match/{uuid}/locations` (§12) — **authoritative** for which locations have
  been visited and for each location/neighbor's resolved `card`.
- The match-info payload (`/info`) — authoritative for the **authored edge
  orientation** (`idLocationFrom`/`idLocationTo`, `flagBack`) so two-way pairs collapse
  into a single edge instead of being drawn twice.

Layout algorithm: a breadth-first walk over the four cardinal directions
(NORTH/SOUTH/EAST/WEST) starting from the character's current location, placing each
node on a grid cell (`MAP_CELL` spacing) with lateral probing to avoid collisions when
the authored graph is not a perfect grid. `edgeVisibility(edge, isVisited)` hides the
outgoing arrow from any location that has not been visited yet (fog-of-war — the player
should not see exits from a place they have never been).

## 13.4 Rendering (`Map.jsx` / `MapPage`)

- **Nodes**: the location's card image when available; unvisited locations render as a
  plain circle with a `"?"` glyph instead of a photo.
- **"You are here" marker**: a `fa-street-view` icon pinned to the character's current
  location node.
- **Arrows**: small double-headed gold arrows for standard two-way edges; a larger arrow
  for the exits leaving the character's current location; dashed arrows for edges that
  are one-way from the viewer's perspective (`flagBack=0`, see §"One-Way Neighbor Links"
  above).
- **Pan & zoom**: drag-to-pan; mouse-wheel zoom (non-passive listener, `preventDefault`s
  page scroll); zoom in/out/center buttons (`+`/`−`/`◎`). Initial zoom `1.6`×, clamped to
  `[0.4, 2.6]`.
- **Selection**: clicking a visited node calls back to `GameBook` with the selected
  location; unvisited nodes are not clickable.
- **Responsive**: the map is visible on both desktop and mobile. The `.game-map-canvas`
  container needed a fixed-height override under `@media (max-width: 767px)` in
  `src/styles/main.css`, because the flex-column mobile layout otherwise collapsed
  `flex: 1` to zero height.

## 13.5 `GameBook.jsx` integration

- New state: `mapView` (boolean, map open/closed) and `mapSelected` (the currently
  selected map node, or `null` for "use the character's current location").
- New state `matchLocations`, populated from `getMatchLocations(matchUuid,
  user?.accessToken, lang)` — fetched on load and refreshed after each successful move
  (same refresh point already used for the movement/weather cards). The current UI
  `lang` is now forwarded to this call.
- When `mapView` is true: LEFT page = `<MapPage>`, RIGHT page = the `LocationCard` of
  `mapSelected` (or the character's current location if nothing is selected).
- **Re-entering gameplay from the map**: `Card.jsx` gained a new optional `onForward`
  prop — a right-side arrow button in the page title bar (mirrors the existing back
  arrow). `LocationCard.jsx` gained a matching `onEnterLocation` prop, passed through to
  `Card`'s `onForward`. When the location selected on the map is the character's actual
  current location, `LocationCard` receives `onEnterLocation`, and clicking the forward
  arrow closes the map and returns to the normal gameplay view (LEFT = current-location
  card, RIGHT = movement/actions board).
- On mobile, opening the map scrolls the view to `.book-mobile-left` (mobile-only, and
  only triggered by the `MapCard` open action).

## 13.6 i18n

New keys added to `src/i18n/en.json` and `it.json`:

- `game.map.title`, `game.map.here` ("Selected" / "Selezionata"), `game.map.youAreHere`,
  `game.map.unexplored`, `game.map.zoomIn`, `game.map.zoomOut`, `game.map.center`,
  `game.map.open`.
- `card.back` / `card.forward` — labels for the new back/forward navigation arrows
  shared by every `Card` instance (aria-labels).

## 13.7 Testing

- `src/test/Map.test.jsx` — renders visited/unvisited nodes, "you are here" marker,
  selection callback, zoom controls.
- `src/test/mapGraph.test.js` — `buildMapGraph` layout correctness, edge collapsing for
  two-way pairs, `edgeVisibility` fog-of-war behavior.
- `src/test/MapCard.test.jsx` — renders the map-entry card and calls `onOpen` on click.

react-game suite: **477 tests pass** (1 pre-existing unrelated turnstile-TTL failure).

## 13.8 Prototypes

Static HTML/CSS concept mockups (desktop and mobile) live under
`documentation_v0/website_concepts_v0/v0.28.5 Map/` and
`documentation_v0/website_concepts_v0/v0.28.5-Map-mobile/`.

## 13.9 Files changed

| File | Change |
|------|--------|
| `src/components/layout/Map.jsx` | New — `MapPage` component |
| `src/utils/mapGraph.js` | New — `buildMapGraph`, `edgeVisibility` |
| `src/features/gameplay/cards/MapCard.jsx` | New — map-entry stats card |
| `src/test/Map.test.jsx`, `src/test/mapGraph.test.js`, `src/test/MapCard.test.jsx` | New tests |
| `src/features/gameplay/GameBook.jsx` | Map view state, `matchLocations` fetch (with `lang`), left/right page switch when map is open |
| `src/components/layout/Card.jsx` | New `onForward` prop (forward arrow in the page title bar) |
| `src/features/gameplay/cards/LocationCard.jsx` | New `onEnterLocation` prop, wired to `Card`'s `onForward` |
| `src/api/matches.js` | `getMatchLocations` now forwards `lang` |
| `src/data/images.json` | New `"map"` image entry |
| `src/i18n/en.json`, `src/i18n/it.json` | New `game.map.*`, `card.back`, `card.forward` keys |
| `src/styles/main.css` | `.game-map-canvas` mobile fixed-height override |

---

# Paths Games V0 - Step 0.28.6: Fog-of-War on Neighbor Location Cards

This section documents a **v0.28.6 bugfix** for the card enrichment shipped in v0.28.5
(§12). No new endpoint is added; the fix only tightens what the existing endpoints are
allowed to reveal.

## 14.1 Problem

v0.28.5 added a full `card` object (photo, title, description) to every entry of
`GET /api/match/{uuid}/locations` and to the neighbor fallback used by
`GET /api/match/{uuid}/info`. A subsequent review found that this leaked the card of
locations the match had **never visited**: any neighbor of a visited/active location
exposed its destination's card regardless of whether the player had actually been there —
defeating the fog-of-war intent of the interactive map (§13).

## 14.2 Fix

For a neighbor whose destination location is **not in the visited set**, the card must not
be returned (null). "Visited" is defined exactly as in §6.3 — the same set
`findVisitedLocationIds` already computes:

```
visitedLocationIds = { character.id_location for all characters in the match }
                   ∪ { move.id_location_from for all log_movements rows for the match }
                   ∪ { move.id_location_to   for all log_movements rows for the match }
```

This is **not** `flagAlreadyActived` — that flag tracks the location's entry-event state
(Step 32), a different concept.

| Endpoint | Behaviour |
|----------|-----------|
| `GET /api/match/{uuid}/locations` | The neighbor's card **is** the destination location's card by definition (§5.3 `NeighborCostDto`). Both `idCard` and `card` are set to null when the destination is unvisited. |
| `GET /api/match/{uuid}/info` | The neighbor's card is the authored **LINK** card (`n.idCard`) when set, with a fallback to the destination LOCATION's card. The authored link card is always kept; only the **fallback** to the location card is hidden for an unvisited destination. `cardBack` is unaffected directly — it already falls back to the (now-gated) neighbor `card`, so it inherits the same gating without separate logic. |

## 14.3 Per-backend implementation

No change to location/neighbor lookup logic — the fix only gates which card is attached
to an already-computed neighbor entry.

### Java

- `core/.../service/match/MovementService.java` — `buildLocations` builds a `Set<Long>`
  from `store.findVisitedLocationIds(...)` and nulls both `idCard` and the resolved `card`
  on `NeighborCost` when the neighbor's destination is not in that set.
- `core/.../service/match/MatchQueryService.java` — gained a 6th constructor argument,
  `MovementStorePort movementStorePort` (nullable; a legacy 5-arg constructor delegates
  with `null` so existing callers keep compiling and simply skip gating). `buildLocationsActive`
  now takes a `visitedLocIds` set and only nulls the **fallback** to `other.getIdCard()` —
  an authored `n.getIdCard()` link card is never touched.
- `ms-launcher/.../config/CoreConfig.java` — the `matchQueryPort` bean now also wires
  `MovementStorePort` into the new constructor argument.

### Python

- `app/core/services/match/movement_service.py` — `_build_locations` builds a
  `visited_set` from `store.find_visited_location_ids(...)`; the neighbor's `id_card`
  (and the `card` resolved from it) is nulled when the destination is not visited.
- `app/core/services/match/match_query_service.py` — `__init__` gained an optional
  `movement_store=None` parameter; `_build_locations_active` gained a `visited_loc_ids`
  parameter and only skips the **fallback** to `other.get("id_card")` for an unvisited
  destination — an explicit `n.get("id_card")` link card is always kept.
- `app/launcher.py` — `movement_store_adapter` is now instantiated once, before
  `match_query_service` is built, and passed into both `MatchQueryService` (for fog-of-war
  gating) and `MovementService` (its original Step 28 purpose), replacing the previous
  ordering where the adapter was created only for `MovementService`.

### AWS Serverless

- `lambda/match/handler.py`:
  - `_visited_locations_payload` already computed a `seen` set of visited location ids;
    it now nulls the neighbor's `idCard`/`card` when the destination is not in `seen`.
  - `_detail_from_item` computes `visited_loc_ids` (character positions ∪ the
    `movementLog` entries' `idLocationFrom`/`idLocationTo`) and passes it into
    `_build_locations_active(..., visited_loc_ids)`, which now only skips the **fallback**
    to `other.get("idCard")` for an unvisited destination, keeping any authored
    `n.get("idCard")` link card untouched.

## 14.4 OpenAPI

- `adapter-rest/src/main/resources/openapi/v0.28.0-movement-api.yaml` — `NeighborCost`
  description and the `card` field description note that `idCard`/`card` are null when
  the neighbor's destination location has never been visited by the match.
- `adapter-rest/src/main/resources/openapi/v0.19.0-match-creation-api.yaml` —
  `LocationNeighborInfo.card` description clarifies that the authored LINK card is always
  shown, while the LOCATION-card fallback stays null until the destination is visited
  (fog of war).

## 14.5 New Robot suite

**File:** `code/tests/robot/tests/28_movement/location_fog_of_war.robot`
**Tags:** `movement`, `locations`, `fog-of-war`, `step28` (third test also tagged `match-info`)

Backend-agnostic — discovers a joinable story/difficulty/character/class/trait loadout at
runtime, no hard-coded IDs:

| Test case | Assertion |
|-----------|-----------|
| `Locations Hides The Card Of Unvisited Neighbor Locations` | Every neighbor in `GET /locations` whose destination is not in the visited set has `card == null` and `idCard == null` |
| `Moving Into A Neighbor Reveals Its Card And It Resolves Via Content` | Cross-check that the hidden card exists rather than being absent: after moving into a previously-unvisited neighbor, its location entry in `/locations` carries a non-null `card`, and that card's `uuid` resolves via `GET /api/content/.../cards` |
| `Info Never Exposes The Location Card Of An Unvisited Neighbor` | Before moving, the neighbor card returned by `/info` (if any) is never equal to the destination's own location card once visited — i.e. `/info` never leaked the LOCATION card ahead of the visit |
| `Admin Locations Applies The Same Fog Gating` | `GET /api/admin/matches/{uuid}/locations` hides `card` for unvisited neighbor destinations exactly like the player view |

## 14.6 Files changed

| Backend | File(s) |
|---------|---------|
| Java | `core/.../service/match/MovementService.java`, `core/.../service/match/MatchQueryService.java`, `ms-launcher/.../config/CoreConfig.java`, OpenAPI `v0.28.0-movement-api.yaml` + `v0.19.0-match-creation-api.yaml` |
| Java tests | `MovementServiceTest` (+1), `MatchQueryServiceLocationsActiveTest` (+3) |
| Python | `app/core/services/match/movement_service.py`, `app/core/services/match/match_query_service.py`, `app/launcher.py` |
| Python tests | `tests/test_movement_service.py`, `tests/test_match_query_service.py` |
| AWS | `lambda/match/handler.py` |
| AWS tests | `tests/test_match_handler.py`, `tests/test_movement_handler.py` |
| Robot | `code/tests/robot/tests/28_movement/location_fog_of_war.robot` (new) |

## 14.7 Notes

1. **"Visited" is the movement-derived set, not `flagAlreadyActived`.** The location
   entry-event flag (`gaming_state_locations.flag_already_actived`, Step 32) is a
   different concept and is not used for this gating.
2. **`cardBack` needed no separate gating logic.** In all three backends, `cardBack`
   already falls back to the (now-gated) neighbor `card` when no explicit `idCardBack` is
   set, so hiding the location-card fallback on `card` automatically hides it on
   `cardBack` too.
3. **Authored LINK cards are never hidden.** Only the fallback path — resolving the
   destination LOCATION's own card when the edge itself defines no card — is subject to
   fog-of-war gating. An admin who explicitly sets `idCard` on a neighbor edge always sees
   that card, visited or not.
4. **Backward-compatible constructor changes.** Java's new `MatchQueryService` argument
   and Python's new `movement_store` parameter are both optional/nullable; any caller that
   does not pass them gets the pre-v0.28.6 behaviour (no gating) rather than an error.

---

# Paths Games V0 - Step 0.28.6: Visited-Only Match-Info Locations & Endpoint Location Cards

This section completes the fog-of-war work of §14 on the **match-info** payload. No new
endpoint is added; `GET /api/match/{uuid}/info` changes shape.

## 15.1 Problem

Three defects in the `locations` block of `/info`:

1. **`locations[]` returned every story location**, not only the visited ones — the raw
   projection of `gaming_state_locations`. It handed the client the full map, contradicting
   the fog-of-war already enforced on `/locations` and on the neighbor cards (§14).
2. **The `name` field was useless.** It was the synthetic string `"location-{id}"`
   (Java/Python) or `null` (AWS, on imported stories). The same synthetic name also appeared
   as `currentLocationName` (root) and `players[].locationName`. No consumer used it:
   react-admin resolves names from the story context, react-game used it only as a fallback
   after `card.title`.
3. **Neighbors did not expose the destination's LOCATION card.** A client saw only `card`
   (the authored LINK/movement card) and `cardBack` (the return LINK card), so it could not
   show the photo/title of the place an edge leads to without cross-referencing `/locations`
   — a payload that, in react-game, is fetched in `GameBook` while the adapter runs in
   `GamePage`.

## 15.2 Contract change

| Field | Before | After |
|-------|--------|-------|
| `locations[]` | every story location | **only the already-visited ones** (player endpoint) |
| `locations[].name` | `"location-{id}"` / null | **removed** |
| `currentLocationName` | `"location-{id}"` / null | **removed** |
| `players[].locationName` | `"location-{id}"` / null | **removed** (also from `/players`, `/characters/{uuid}` and the join response) |
| `locationsActive[].neighbors[].cardLocationFrom` | — | **new**: card of the LOCATION at `idLocationFrom` |
| `locationsActive[].neighbors[].cardLocationTo` | — | **new**: card of the LOCATION at `idLocationTo` |

"Visited" is the same movement-derived set as §14.2 — the very set `GET /locations` returns
as its `locations[]`, so the two payloads now agree id-for-id.

**Where a name is still needed, it comes from a card title** (`LocationInfo.card`,
`cardLocationFrom` / `cardLocationTo`, or the `/locations` payload), or stays null when no
location card is available at that point.

## 15.3 Fog semantics of the two new cards

Each endpoint is gated on **its own** visited flag, independently of where the player stands:

```
cardLocationFrom = card(locations[idLocationFrom].idCard)  if idLocationFrom ∈ visited  else null
cardLocationTo   = card(locations[idLocationTo].idCard)    if idLocationTo   ∈ visited  else null
```

This is self-consistent because **the active location is always visited** (a character stands
on it), so the endpoint matching it always resolves. It follows that:

> **The move destination's card is `cardLocationFrom` when the player stands on
> `idLocationTo`, and `cardLocationTo` otherwise.**

They are distinct from `card` (authored LINK card) and `cardBack` (return LINK card). A null
visited set (legacy wiring) disables the gating, exactly as in §14.

## 15.4 The admin exception

`GET /api/admin/matches/{uuid}/info` keeps **every** location in `locations[]` — no visited
filter — because the react-admin console renders the full `gaming_state_locations` runtime
table (`LocationStateCard.jsx`). The **fog gating on the neighbor cards is unchanged and
identical** to the player view: only the list differs. A single `allLocations` flag is
threaded through the shared builder in each backend.

## 15.5 Per-backend implementation

| Backend | Change |
|---------|--------|
| Java | `MatchQueryService.buildDetail` gains a `boolean allLocations` param; the visited-set computation is hoisted above the state-row loop, which now skips unvisited rows. New private `resolveLocationCard(...)` resolves an endpoint's card behind the visited check. `resolveCard` gained a per-request memo (`Map<Integer, CardInfo>`): a location card is reachable from every edge touching it, so without it the same card was re-read from the content port once per edge. `MatchLocationState.name`, `MatchDetail.currentLocationName`, `CharacterInstanceInfo.locationName` removed; `LocationNeighborInfo` ctor 10 → 12 args. |
| Python | Mirrors Java. **Plus a real bugfix** (see §15.6). `MatchLocationState.name`, `MatchDetail.current_location_name`, `CharacterInstanceInfo.location_name` removed; `LocationNeighborInfo` gains `card_location_from` / `card_location_to`. |
| AWS | `_detail_from_item` gains `all_locations`; it filters on the already-computed `visited_loc_ids` **and strips the persisted `name` key on READ** — matches created before v0.28.6 already carry it on the `MATCH#{uuid}/METADATA` item, so stopping the write alone would leave old matches leaking it. `_create_match` / `_join_match` also stop writing `name` / `currentLocationName` / `locationName`. This incidentally moots the pre-existing bug where `_start_movement` never refreshed a character's stale `locationName`. |

## 15.6 Python bugfix: the truncated location projection

`StoryMatchReadAdapter.find_locations_by_story_id` projected only
`{id, uuid, counter_time}`, but `_build_locations_active` reads `id_card` and `secure_param`
off those very dicts. **In production the Python `/info` therefore always returned
`locationsActive[].card = null`, `.secureParam = null`, and a dead neighbor location-card
fallback.** The unit fixture mocked `id_card`, which hid it.

The projection now also carries `id_card` and `secure_param` (in the Python schema `is_safe`
doubles as `secure_param` — the same mapping `MovementStoreAdapter._location_dict` already
used). Without this fix `cardLocationFrom` / `cardLocationTo` would have been born broken on
Python. **Side effect:** `locationsActive[].secureParam` now returns `0|1` instead of `null`,
finally matching Java.

## 15.7 Frontend

| App | Change |
|-----|--------|
| react-game | `matchInfoAdapter.js`: the neighbor's display card now falls back to the destination's LOCATION card (`playerAtTo ? cardLocationFrom : cardLocationTo`) before the generic direction card, and the destination NAME comes from that card's title. The generic "Move to …" card therefore appears only when no card exists anywhere — in which case the destination is by definition unexplored. `mapGraph.js`: `info.locations[]` is now an exact visited set (the old `flagAlreadyActived` fallback would have left the map with **zero** visited nodes and is removed); node names come from card titles; `cardLocationFrom`/`cardLocationTo` feed node photos, so the map shows real photos **before** the `/locations` payload arrives. The two visited sets are **unioned**, not overridden: both payloads derive from the same query, so a union can never hide a genuinely visited node. |
| react-admin | `MatchConfigCard` / `PlayersCard` resolve the location name via the existing `locationName20` (story context: `list_locations.id_text_name` → `list_texts`); `MatchDetailModal` uses its existing `locationTitle(uuid)`. `LocationStateCard` is untouched — it is precisely why the admin keeps all locations (§15.4). |

## 15.8 OpenAPI

- `v0.19.0-match-creation-api.yaml` — `LocationState`: `name` removed, visited-only contract
  + admin exception documented. `MatchInfo`: `currentLocationName` removed.
  `LocationNeighborInfo`: `cardLocationFrom` / `cardLocationTo` added.
- `v0.21.0-character-selection-api.yaml` — `locationName` removed from `CharacterSummary`
  and `CharacterInstance`.
- `v0.19.12-admin-match-control-api.yaml` — `getAdminMatchInfo` documents the "all locations,
  no visited filter" exception.

## 15.9 New Robot suite

`code/tests/robot/tests/28_movement/match_info_visited_locations.robot` (5 tests) — no suite
previously asserted on `/info locations[]`, on any `name` field, or on the visited filter.

| Test | Asserts |
|------|---------|
| `Info Locations Contains Only Visited Locations` | The ids of `/info locations[]` equal the visited ids from `/locations`, and are strictly fewer than the admin list (proving the filter ran) |
| `Info Carries No Synthetic Location Name` | No `name` on any `locations[]` entry, no `currentLocationName`, no `players[].locationName`; `idLocation`/`uuid`/`flagAlreadyActived`/`clockCounter` all still present |
| `Neighbor Location Cards Follow The Visited Gating` | Per edge endpoint: `cardLocationFrom`/`cardLocationTo` resolved when that endpoint is visited, null when it is not |
| `Moving Reveals The Destination In Locations And Its Card` | Before the move the destination is absent from `locations[]` and its endpoint card is null; after it, it appears, the two payloads stay in sync, and the revealed card resolves via `GET /api/content/.../cards` |
| `Admin Info Returns All Locations With The Same Fog Gating` | Admin `locations[]` ⊃ player's and larger; still no `name`; neighbor cards gated identically |

## 15.10 Files changed

| Area | File(s) |
|------|---------|
| Java | `core/.../model/match/{MatchLocationState,MatchDetail,CharacterInstanceInfo,LocationNeighborInfo}.java`, `core/.../service/match/{MatchQueryService,CharacterMapper,CharacterCommandService}.java`, `adapter-rest/.../dto/{MatchInfoResponse,AbstractCharacterStatsResponse}.java` |
| Java tests | `MatchQueryServiceTest` (+1), `MatchQueryServiceLocationsActiveTest` (+3), `MatchDtosTest`, `CharacterDtosTest`, `MatchControllerTest`, `LocationInfoTest`, `MatchModelsTest` |
| Python | `app/adapters/persistence/match/story_match_read_adapter.py` (**bugfix**), `app/core/models/match/match_models.py`, `app/core/services/match/{match_query_service,character_query_service,character_command_service}.py`, `app/adapters/rest/match/match_controller.py` |
| Python tests | `test_match_query_service.py` (+4), `test_match_persistence_adapter.py`, `test_match_controller.py`, `test_match_admin_controller.py`, `test_match_models.py`, `test_character_controller.py` |
| AWS | `lambda/match/handler.py` |
| AWS tests | `tests/test_match_handler.py` (+3) |
| OpenAPI | `v0.19.0-match-creation-api.yaml`, `v0.21.0-character-selection-api.yaml`, `v0.19.12-admin-match-control-api.yaml` |
| react-game | `src/api/matchInfoAdapter.js`, `src/utils/mapGraph.js`, `src/test/fixtures/matchInfo.json`, `src/test/{matchInfoAdapter,mapGraph}.test.js`, `src/test/Map.test.jsx` |
| react-admin | `src/pages/MatchDetailPage.jsx`, `src/components/match/detail/{MatchConfigCard,PlayersCard}.jsx`, `src/components/match/MatchDetailModal.jsx` + 3 test files |
| Robot | `code/tests/robot/tests/28_movement/match_info_visited_locations.robot` (new) |

## 15.11 Notes

1. **A match with no character has an empty `locations[]`.** Nothing is visited until
   somebody joins. The key is still present, so
   `19_match/match_creation.robot`'s `Dictionary Should Contain Key` still passes.
2. **The test fixtures were lying.** `react-game`'s `matchInfo.json` populated real names
   where the API returned `location-{id}`, and listed every location — which is why the
   "destination name only when visited" comment in the adapter had never actually been true.
   The fixture now mirrors the real payload.
3. **`flagAlreadyActived` is still not a visited flag** (§14.7.1). `mapGraph.js` had been
   using it as a visited fallback; since it is ~always 0, that fallback was near-dead and is
   now replaced by `info.locations[]`, which *is* the visited set.

---

# Version Control

- **Document Version**: 0.28.6

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.28.0 | Initial Step 28 documentation: movement system (adjacency validation, energy cost formula, 8-code ordered validation, existing log_movements table reused from V0.10.9, V0.28.0 Flyway no-ops, visited-locations derivation), new POST movements/start + GET locations + GET admin/locations endpoints, MovementCard in react-game, movement card in react-admin MatchDetailPage, Robot suite 28_movement 10/10 (399/399 total) | June 25, 2026 |
  | 0.28.2 | Initial documentation: AWS neighbor cardBack desync bugfix (`_story_neighbors` helper applied at 3 gameplay read-points); new Robot suite 29 backend-agnostic regression | June 26, 2026 |
  | 0.28.2 | Initial document — cross-backend bugfix for event-to-location binding | June 26, 2026 |
  | 0.28.3 | One-way neighbor links: `flag_back` enforcement across all backends; `flag_back` column added to §6.4 schema table; new Robot regression suite `neighbor_flag_back.robot` (2 tests, tags: match-info/movement-back/flag-back/step28/regression); react-admin Flag Back form fix and YES/NO badge in entity table | June 28, 2026 |
  | 0.28.5 | `GET /locations` (player + admin) now resolves a full `card` object per location/neighbor plus `?lang=`, across Java/Python/AWS, no lookup-logic change; new Robot test file `28_movement/location_cards.robot` (5 tests). §13: new interactive world map in react-game (`MapPage`/`Map.jsx`, `mapGraph.js`, `MapCard.jsx`), pan/zoom SVG graph with fog-of-war, opened from the stats card list or closed via a new `onForward` arrow on `Card.jsx`/`LocationCard.jsx`. Test counts: Java BUILD SUCCESS, Python 711 pass, AWS 414 pass, react-game 477 pass, Robot green on all 4 environments | July 11, 2026 |
  | 0.28.6 | §14: bugfix — v0.28.5's neighbor card enrichment leaked the card of never-visited locations. Neighbor `card`/`idCard` on `GET /locations` now null for unvisited destinations; `/info` keeps the authored LINK card but hides only the LOCATION-card fallback. Java: `MatchQueryService` gained an optional `MovementStorePort` 6th constructor arg; `MovementService.buildLocations` gates on `findVisitedLocationIds`. Python: `match_query_service` gained an optional `movement_store` param; `movement_service._build_locations` gates on `find_visited_location_ids`; `launcher.py` shares one `movement_store_adapter` instance between both services. AWS: `_detail_from_item` computes `visited_loc_ids` (positions ∪ `movementLog`) passed into `_build_locations_active`; `_visited_locations_payload` gates on its existing `seen` set. OpenAPI `v0.28.0-movement-api.yaml` + `v0.19.0-match-creation-api.yaml` document the nullability. New Robot suite `28_movement/location_fog_of_war.robot` (4 tests). Test counts: Java BUILD SUCCESS (+4 tests), Python 715 pass, AWS 416 pass, Robot dry-run 4/4 | July 11, 2026 |
  | 0.28.6 | §15: `/info` `locations[]` is now VISITED-ONLY on the player endpoint (the admin endpoint keeps every location for the console's runtime table); the synthetic `name` / `currentLocationName` / `players[].locationName` are removed from all three backends and titles now come from card titles; `locationsActive[].neighbors[]` gains `cardLocationFrom` / `cardLocationTo` — the LOCATION card of each edge endpoint, gated on that endpoint's own visited flag (so the move destination's card is `cardLocationFrom` when the player stands on `idLocationTo`, `cardLocationTo` otherwise). Java: `buildDetail` gains an `allLocations` flag, new `resolveLocationCard`, and a per-request card memo; `LocationNeighborInfo` ctor 10 → 12 args. **Python bugfix**: `find_locations_by_story_id` did not project `id_card`/`secure_param`, so `/info` `locationsActive[].card` and `.secureParam` were ALWAYS null in production (`secureParam` now returns `0|1`). AWS: the persisted `name`/`locationName` are stripped on READ (old matches already carry them) and no longer written. react-game: the adapter's neighbor card now falls back to the destination's LOCATION card and `mapGraph` feeds node photos from the new fields (real photos before `/locations` lands); its `flagAlreadyActived` visited fallback — which was near-dead — is replaced by `info.locations[]`. react-admin resolves names via the existing story-context resolvers. New Robot suite `28_movement/match_info_visited_locations.robot` (5 tests). Test counts: Java BUILD SUCCESS, Python 719 pass (92% cov), AWS 419 pass, react-game 484 pass, react-admin 429 pass | July 11, 2026 |

- **Last Updated**: July 11, 2026
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
