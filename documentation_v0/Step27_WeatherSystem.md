# Paths Games V0 - Step 27: Weather System — Random Selection & Effects

This document describes the implementation of **Step 27** as requested in the Roadmap.

Step 27 introduces a **weather engine** that fires at every time-start (match start and
each clock advance). It selects one active weather rule from the story's catalogue using a
**deterministic weighted roll**, applies an energy delta to every character, and stores
the result so the frontend can display the current conditions. A reproducible
**RNG seed** is saved on the match so the same roll can be reproduced in tests.

---

## 1. Scope

Step 27 covers the following items from the Roadmap:

- Add `rng_seed` (BIGINT) to `gaming_match`; generate a random seed at match creation
  unless an explicit value is supplied in the create request body. Robot tests use
  `rngSeed=42` for deterministic outcomes.
- Weighted weather selection at every time-start: filter `list_weather_rules` by
  `is_active`, current clock time range (`time_from`/`time_to`), and an optional
  registry condition (`condition_key`/`condition_value`, compared with
  `registry_value_operator_condition` since v0.36.0 — see
  [Step36 §5](./Step36_RegistrySystem.md#5-the-operator-column-four-conditions-one-comparison)).
  Roll using each rule's `probability` as its weight.
- Apply the winning rule's `delta_energy` to every character in the match, clamped to
  `[0, energy_max]`.
- Persist the chosen rule id in `gaming_match.id_current_weather`; append a row to
  `log_weather`. Clear `id_current_weather` when no rule is eligible.
- When the winning rule has an `id_event`, record the event as pending in `log_events`
  (execution deferred to Step 29).
- New public endpoint `GET /api/matches/{uuid}/weather` → current weather info.
- New admin endpoint `GET /api/admin/matches/{uuid}/weather` (port 8044) → rngSeed +
  current weather + full `log_weather` history.
- OpenAPI specification for the new endpoints.
- Unit tests for all five backends and both React frontends.
- Robot E2E suite `27_weather` (6 tests, all deterministic with `rngSeed=42`).
- react-game `WeatherCard` component rendered after both `GoToSleepCard` render points.
- react-admin `MatchDetailPage` extended with rngSeed row and a Weather panel.

**Out of scope (Steps 28+):** movement-cost modifiers are returned by the weather
endpoint (`costMoveSafeLocation`, `costMoveNotSafeLocation`) but movement itself is
implemented in Step 28. Weather-linked event execution is deferred to Step 29.

---

## 2. Endpoint Changes

### 2.1 New: `GET /api/matches/{uuid}/weather`

Returns the current weather conditions for the match. Returns 404 when no weather rule
is set (either because the match has not started or no rule was eligible at the last
time-start).

**Path parameter:** `uuid` — match UUID.

**Success response (200):**

```json
{
  "idWeather": 3,
  "uuid": "story-uuid",
  "idTextName": 10,
  "deltaEnergy": -2,
  "costMoveSafeLocation": 1,
  "costMoveNotSafeLocation": 3,
  "currentClock": 2
}
```

**Error codes:**

| HTTP | Code | Condition |
|------|------|-----------|
| 404 | `WEATHER_NOT_FOUND` | No weather rule is currently set on the match |

### 2.2 New: `GET /api/admin/matches/{uuid}/weather` (admin port 8044)

Admin-only view of weather state for a match. Returns the RNG seed, the current weather,
and the full `log_weather` history ordered by clock ascending.

**Success response (200):**

```json
{
  "rngSeed": 42,
  "current": {
    "idWeather": 3,
    "uuid": "story-uuid",
    "idTextName": 10,
    "deltaEnergy": -2,
    "costMoveSafeLocation": 1,
    "costMoveNotSafeLocation": 3,
    "currentClock": 2
  },
  "log": [
    {
      "clock": 0,
      "idWeather": 1,
      "deltaEnergy": 0
    },
    {
      "clock": 1,
      "idWeather": 3,
      "deltaEnergy": -2
    }
  ],
  "rules": [
    {
      "id": 3, "uuid": "rule-uuid", "idTextName": 10, "name": "storm",
      "probability": 30, "deltaEnergy": -2,
      "costMoveSafeLocation": 1, "costMoveNotSafeLocation": 3,
      "active": true, "current": true,
      "conditionKey": "depth", "conditionValue": "3", "conditionOperator": ">",
      "registryMet": true
    }
  ]
}
```

`rules[]` (one row per `list_weather_rules` catalogue entry, all of them, not just the
winner) predates v0.36.2. **v0.36.2** adds `conditionKey`/`conditionValue`/
`conditionOperator`/`registryMet` to each row — see §3.2.

**Error codes:**

| HTTP | Code | Condition |
|------|------|-----------|
| 400 | — | Blank or malformed UUID |
| 401 | — | Missing or invalid admin token |

### 2.3 Modified: `POST /api/matches` (match creation)

The request body gains an optional `rngSeed` field (Long/integer). When omitted the
backend generates a random seed. When provided the supplied value is persisted as-is.

```json
{
  "idStory": "story-uuid",
  "idDifficulty": 1,
  "rngSeed": 42
}
```

No changes to the response shape or status codes.

---

## 3. DTOs and Domain Models

### 3.1 `WeatherResponse` (public endpoint)

| Field | Type | Notes |
|-------|------|-------|
| `idWeather` | integer | PK of the winning `list_weather_rules` row |
| `uuid` | string | Story UUID (for client-side reference) |
| `idTextName` | integer | FK → text catalogue for the weather name (i18n) |
| `deltaEnergy` | integer | Energy delta applied to characters (negative = drain) |
| `costMoveSafeLocation` | integer | Extra energy cost to move to a safe location (applied in Step 28) |
| `costMoveNotSafeLocation` | integer | Extra energy cost to move to an unsafe location (applied in Step 28) |
| `currentClock` | integer | Clock value at which this weather was selected |

### 3.2 Admin weather response

| Field | Type | Notes |
|-------|------|-------|
| `rngSeed` | long | The match's RNG seed |
| `current` | `WeatherResponse` | Current weather (may be null when none is set) |
| `log` | array | Each entry: `{ clock, idWeather, deltaEnergy }` |
| `rules` | array | Every catalogue rule for the story, admin view (see below) |

**`rules[]` row** (Java `WeatherStorePort.WeatherRuleSummary`, widened v0.36.2 from 10 to
14 components — the adapter fills the first 10 plus the three authored condition
columns, the service computes the 14th):

| Field | Type | Notes |
|-------|------|-------|
| `id`, `uuid`, `idTextName`, `name`, `probability`, `deltaEnergy`, `costMoveSafeLocation`, `costMoveNotSafeLocation`, `active`, `current` | — | Pre-existing, unchanged |
| `conditionKey` | string (nullable) | Authored registry key; `null` = unconditional. Exposed since v0.36.2; the column itself is v0.36.0 |
| `conditionValue` | string (nullable) | Authored comparison value |
| `conditionOperator` | string (nullable) | Authored operator (`=`, `!=`, `>`, `<`, …); `null` means `=` |
| `registryMet` | boolean | **v0.36.2.** Whether the rule's condition currently passes, computed with the very comparison `WeatherSelectionService` uses to pick the winner, so this cannot disagree with the engine |

### 3.3 Java core domain models

| Class | Package | Purpose |
|-------|---------|---------|
| `WeatherSelectionService` | `core/.../service/match/` | Pure domain service: weighted roll, time/condition filter, `delta_energy` apply, clear-on-none. Entry points: `selectAtTimeStart(idMatch, clock)` and `clearWeather(idMatch)` |
| `WeatherStorePort` | `core/.../port/match/` | Outbound port: load eligible rules, load match seed, persist current weather, insert log_weather, bulk update character energy |
| `WeatherStoreAdapter` | `core/.../persistence/match/` | JPA implementation of `WeatherStorePort` |
| `LogWeatherEntity` + `LogWeatherEntityId` | `core/.../entity/match/` | JPA entity for `log_weather` table (composite PK: id_match + clock) |
| `LogWeatherRepository` | `core/.../entity/match/` | Spring Data JPA repository |
| `WeatherController` | `adapter-rest/` | `GET /api/matches/{uuid}/weather` |

`WeatherSelectionService` is injected into:
- `TimeAdvancementService.advanceTime(...)` — called after Step 26 recovery.
- `TurnCycleService.startMatch(...)` — called at clock 0.

DI wired in `CoreConfig`.

**v0.36.2**: `weatherAdmin(matchUuid)` now runs every rule through a new private
`withRegistryVerdict`/`registryMet` pair before returning it, so the admin `rules[]` rows
carry the registry verdict (§3.2).

### 3.4 Python core models

| Item | Path | Purpose |
|------|------|---------|
| `WeatherSelectionService` | `app/core/services/match/weather_selection_service.py` | Mirror of Java: `select_at_time_start(id_match, clock)` |
| `WeatherStorePort` extensions | `app/core/ports/match/weather_ports.py` | Abstract port methods |
| `WeatherStoreAdapter` | `app/adapters/persistence/match/weather_store_adapter.py` | SQLAlchemy implementation |
| `WeatherController` | `app/adapters/rest/match/weather_controller.py` | `GET /api/matches/{uuid}/weather` and admin endpoint |
| `LogWeatherEntity` | SQLAlchemy model | Table `log_weather` |

Python's `WeatherRuleEntity` model columns relevant to Step 27: `probability` (Float),
`time_start`/`time_end` (nullable integers matching clock range), `condition_key`/
`condition_value` (nullable strings), `is_active` (Boolean), `id_text_name` (Integer).

Wired in `launcher.py`. Hooked into `time_advancement_service._advance_time` and
`turn_cycle_service.start_match`.

**v0.36.2**: `weather_selection_service._with_registry_verdict` mirrors the Java
`withRegistryVerdict`/`registryMet` pair, adding `registry_met` (camelCased to
`registryMet` in `match_admin_controller.py`) to each admin `rules[]` row.

### 3.5 AWS Lambda models

All weather state lives on the DynamoDB match item (Single Table Design):

| Attribute | Purpose |
|-----------|---------|
| `currentWeatherId` | ID of the current weather rule (null when none) |
| `weatherLog` | Embedded list of `{ clock, idWeather, deltaEnergy }` entries |
| `rngSeed` | Stored at creation; returned in create summary and admin endpoint |

Key functions in `lambda/match/handler.py`:

| Function | Role |
|----------|------|
| `_weather_time_matches(rule, clock)` | Checks `time_from`/`time_to` inclusive, null = open bound |
| `_weather_condition_matches(rule, registry)` | No `condition_key` → always matches; otherwise `RegistryService.evaluate` decides (v0.36.0, [Step36](./Step36_RegistrySystem.md)) |
| `_weather_weighted_pick(eligible_rules, seed, clock)` | Deterministic weighted roll using `seed + clock` |
| `_apply_weather_at_time_start(match, clock)` | Orchestrator hooked into `_advance_time` and `_start_match` |

Seed weather rules embedded in `lambda/seed/handler.py`: two rules (clear and storm)
on the seed story item.

**v0.36.2**: the admin weather handler reuses the same `_weather_condition_matches(rule,
registry)` that selection already calls, to fill `registryMet` on each admin `rules[]`
row — no separate comparison to drift out of sync.

---

## 4. Weather Selection Algorithm

### 4.1 Filter step

From `list_weather_rules` for the match's story, retain only rules where:

1. `is_active == true`
2. `time_from IS NULL OR clock >= time_from`
3. `time_to IS NULL OR clock <= time_to`
4. `condition_key IS NULL OR RegistryService.evaluate(registry_value_operator_condition,
   condition_key_value, match_registry[condition_key])` — **v0.36.0** ([Step36
   §5](./Step36_RegistrySystem.md#5-the-operator-column-four-conditions-one-comparison)):
   before this step a `condition_key` with a null `condition_key_value` meant "the key must be
   unset"; that reading is retired, and a null expected value is now never met, exactly as it
   already was for events and movement

### 4.2 Weighted roll

Let `eligible` be the filtered list. If `eligible` is empty, clear
`gaming_match.id_current_weather` and return without writing a `log_weather` row.

Otherwise compute the cumulative weight sum `W = Σ probability`. Generate a random
value `r ∈ [0, W)` using seed `rng_seed + clock` (Null `rng_seed` falls back to
`id_story`). Walk the list in order, accumulating weights; the first rule whose
cumulative weight exceeds `r` is the winner. This is a standard linear weighted random
selection and is fully reproducible for a given `(rng_seed, clock)` pair.

### 4.3 Per-clock seed formula

```
per_clock_seed = rng_seed + clock
```

The seed changes with each clock advance so the weather varies over time while remaining
reproducible. Robot tests supply `rngSeed=42` so the roll at clock 0 always picks the
same rule, enabling deterministic assertions.

### 4.4 Energy delta application

For each `gaming_character_instance` in the match:

```
new_energy = clamp(current_energy + delta_energy, 0, energy_max)
```

When `delta_energy == 0` no update is issued. The delta can be negative (storm drains
energy) or positive (good weather restores energy).

### 4.5 Event linking (stub)

When the winning rule has `id_event IS NOT NULL`, a row is inserted in `log_events` with
`type = PENDING` and the event id as a reference. Actual event execution is deferred to
Step 29.

---

## 5. Database Schema Changes

### 5.1 Flyway migrations — V0.27.0

Two new migration files add one column to `gaming_match`:

- `adapter-sqlite/src/main/resources/db/migration/v0/V0.27.0__add_match_rng_seed.sql`
- `adapter-postgres/src/main/resources/db/migration/v0/V0.27.0__add_match_rng_seed.sql`

```sql
ALTER TABLE gaming_match ADD COLUMN rng_seed BIGINT;
```

The column is nullable; existing matches default to `NULL` (falls back to `id_story`
for the seed). New matches populate `rng_seed` at creation.

Python does not use Flyway; `rng_seed` is declared on the SQLAlchemy model and added via
`create_all` at startup. AWS Lambda stores `rngSeed` on the DynamoDB match item; no
schema migration is required.

### 5.2 `gaming_match` — new column

| Column | Type | Notes |
|--------|------|-------|
| `rng_seed` | BIGINT (nullable) | Seed for deterministic weather rolls; generated at match creation; supplied explicitly in tests |

### 5.3 `gaming_match` — existing column used by Step 27

| Column | Type | Role in Step 27 |
|--------|------|-----------------|
| `id_current_weather` | INTEGER (nullable) | FK → `list_weather_rules(id)`; updated at every time-start; cleared when no rule is eligible |

### 5.4 `log_weather` (existing table, new writes)

| Column | Type | Notes |
|--------|------|-------|
| `id_match` | INTEGER | Part of composite PK |
| `clock` | INTEGER | Part of composite PK; the clock value when weather was applied |
| `id_weather_rule` | INTEGER | FK → `list_weather_rules(id)` |
| `delta_energy` | INTEGER | Snapshot of the delta applied at this clock tick |

One row is written per time-start when a rule wins the roll. No row is written when no
eligible rule exists.

### 5.5 `list_weather_rules` — columns read by Step 27

| Column | Type | Role |
|--------|------|------|
| `id` | INTEGER | PK |
| `id_story` | INTEGER | FK → `list_stories(id)` |
| `probability` | FLOAT | Weight for the weighted roll |
| `time_from` | INTEGER (nullable) | Inclusive lower bound on clock; null = no lower bound |
| `time_to` | INTEGER (nullable) | Inclusive upper bound on clock; null = no upper bound |
| `condition_key` | VARCHAR (nullable) | Registry key to check; null = no condition |
| `condition_value` | VARCHAR (nullable) | Expected registry value |
| `is_active` | BOOLEAN | Only active rules participate in rolls |
| `id_text_name` | INTEGER | FK → text catalogue (i18n weather name) |
| `delta_energy` | INTEGER | Energy change applied to all characters |
| `cost_move_safe_location` | INTEGER | Extra move cost for safe locations (consumed in Step 28) |
| `cost_move_not_safe_location` | INTEGER | Extra move cost for unsafe locations (consumed in Step 28) |
| `id_event` | INTEGER (nullable) | Event to log as pending when this rule wins |

---

## 6. Business Logic

### 6.1 Weather selection sequence at time-start

`WeatherSelectionService.selectAtTimeStart(idMatch, clock)` is called:
- by `TurnCycleService.startMatch(...)` at clock 0 (initial weather).
- by `TimeAdvancementService.advanceTime(...)` after Step 26 recovery (subsequent clocks).

Full sequence:

1. Load `rng_seed` and `id_story` from the match.
2. Compute `effective_seed = rng_seed ?? id_story`.
3. Load all `list_weather_rules` rows for the story where `is_active = true`.
4. Filter by time range: retain rules where clock falls within `[time_from, time_to]`
   (null bounds are open).
5. Filter by registry condition: retain rules where `condition_key IS NULL` or
   `RegistryService.evaluate` (`=`/`!=`/`>`/`<`, via `registry_value_operator_condition`)
   is met against `registry[condition_key]`. **v0.36.0**: a `condition_key` with a null
   `condition_key_value` used to mean "the key must be unset"; it is now never met, unifying
   this rule with events and movement — see
   [Step36 §5](./Step36_RegistrySystem.md#5-the-operator-column-four-conditions-one-comparison).
6. If the eligible list is empty: set `gaming_match.id_current_weather = NULL`; return.
7. Perform the weighted roll using seed `effective_seed + clock`.
8. Persist the winner: update `gaming_match.id_current_weather`.
9. Insert a `log_weather` row with `(id_match, clock, id_weather_rule, delta_energy)`.
10. Apply `delta_energy` to every character: `clamp(energy + delta, 0, energy_max)`.
11. If winner has `id_event IS NOT NULL`: insert a `log_events` row with `type = PENDING`.

### 6.2 Null rng_seed fallback

When `rng_seed` is `NULL` (matches created before V0.27.0 migration or legacy data),
`id_story` is used as the seed. The roll is still deterministic per `(story, clock)` but
will not vary between matches on the same story.

### 6.3 Pending weather events (stub)

Logging a `PENDING` event record in `log_events` is the only action taken. No stat
change, narrative text, or choice presentation is triggered in Step 27. Full event
execution is wired in Step 29.

### 6.4 Movement cost modifiers — returned, not applied

`costMoveSafeLocation` and `costMoveNotSafeLocation` are included in the `WeatherResponse`
DTO so the frontend can preview movement costs. The movement validation logic (which
deducts the cost) is implemented in Step 28. Step 27 only computes and exposes these
values.

---

## 7. Per-Project Implementation

### 7.1 Java (reference implementation)

**Core module**

- [x] `WeatherSelectionService` (`core/.../service/match/`): `selectAtTimeStart(long idMatch, int clock)`; `clearWeather(long idMatch)`.
- [x] `WeatherStorePort` (`core/.../port/match/`): load eligible rules, load match seed, persist current weather, insert `log_weather`, bulk-update character energy.
- [x] `WeatherStoreAdapter` (`core/.../persistence/match/`): JPA implementation.
- [x] `LogWeatherEntity` + `LogWeatherEntityId` (`core/.../entity/match/`): JPA entity; composite PK `(id_match, clock)`.
- [x] `LogWeatherRepository`: Spring Data JPA.
- [x] `GamingMatchEntity.rngSeed`: new `BIGINT` field.
- [x] `MatchCreateCommand.rngSeed`: new overloaded constructor accepting seed.
- [x] `MatchCreateRequest.rngSeed`: optional field in REST DTO.
- [x] `MatchCommandService.createMatch`: generates random seed when `rngSeed` is absent.
- [x] `TimeAdvancementService.advanceTime(...)`: calls `WeatherSelectionService.selectAtTimeStart` after recovery.
- [x] `TurnCycleService.startMatch(...)`: calls `WeatherSelectionService.selectAtTimeStart` at clock 0.
- [x] `CoreConfig`: DI wiring for `WeatherSelectionService` and `WeatherStoreAdapter`.

**Flyway migrations**

- [x] `V0.27.0__add_match_rng_seed.sql` in both `adapter-sqlite` and `adapter-postgres`.

**Adapter-rest**

- [x] `WeatherController`: `GET /api/matches/{uuid}/weather`; delegates to `WeatherSelectionService`; returns `WeatherResponse`; 404 `WEATHER_NOT_FOUND` when no weather set.
- [x] `WeatherResponse` DTO.
- [x] `MatchAdminController`: `GET /api/admin/matches/{uuid}/weather` (port 8044); returns `{ rngSeed, current, log[] }`.

**OpenAPI**

- [x] `adapter-rest/src/main/resources/openapi/v0.27.0-weather-api.yaml`: documents both public and admin weather endpoints.

**Unit tests**

- [x] `WeatherSelectionServiceTest` (18 test cases): weighted roll, time filter, condition filter, delta apply, clamp at max, clamp at zero, clear-on-no-eligible, event logging stub, null rng_seed fallback.
- [x] `WeatherStoreAdapterTest` (14 test cases): DB read/write paths.
- [x] `WeatherControllerTest`: HTTP 200 / 404 paths.
- [x] Admin controller tests: 200 / 400 paths.

Full `mvn test` = BUILD SUCCESS.

### 7.2 Python backend

- [x] `weather_selection_service.py` (`app/core/services/match/`): `select_at_time_start(id_match, clock)`.
- [x] `WeatherStorePort` abstract methods in `app/core/ports/match/weather_ports.py`.
- [x] `WeatherStoreAdapter` in `app/adapters/persistence/match/weather_store_adapter.py`.
- [x] `LogWeatherEntity` SQLAlchemy model.
- [x] `GamingMatchEntity.rng_seed` (BigInteger, nullable).
- [x] `MatchCreateCommand.rng_seed`; seed generated in `match_command_service`; `rngSeed` body field in `match_controller`.
- [x] `weather_controller.py` (`app/adapters/rest/match/`): `GET /api/matches/{uuid}/weather`.
- [x] Admin endpoint in `match_admin_controller`: `GET /api/admin/matches/{uuid}/weather`.
- [x] `time_advancement_service._advance_time` and `turn_cycle_service.start_match` hooked.
- [x] `launcher.py` wired.
- [x] `test_weather_selection_service.py` and `test_weather_controllers.py`. Full suite = **645 passed**.

### 7.3 AWS Serverless

- [x] `lambda/match/handler.py`:
  - `rngSeed` field on create request and stored on match item.
  - `_weather_time_matches(rule, clock)`.
  - `_weather_condition_matches(rule, match)`.
  - `_weather_weighted_pick(eligible_rules, seed, clock)`.
  - `_apply_weather_at_time_start(match, clock)`: orchestrator.
  - Routes `GET /api/matches/{uuid}/weather` and `GET /api/admin/matches/{uuid}/weather`.
  - Weather stored as `currentWeatherId` + embedded `weatherLog` list on match item.
- [x] `lambda/seed/handler.py`: `weatherRules` embedded on seed story items (clear + storm rules).
- [x] `tests/test_weather_handler.py`. Full suite = **374 passed**.

### 7.4 React-game frontend

- [x] `src/api/matches.js`: new `getMatchWeather(uuid, token)` function (maps HTTP 404 response to `null`).
- [x] `src/features/gameplay/cards/WeatherCard.jsx`: new card component.
- [x] `src/utils/loadoutCards.js`: `buildWeatherCard` helper.
- [x] `src/mock/images.json`: new `'weather'` image entry.
- [x] `src/i18n/en.json` and `it.json`: new i18n keys under `game.weather.*`.
- [x] `GameBook.jsx`: weather state + fetch effect + refresh on sleep-reload; `<WeatherCard>` rendered after **both** `GoToSleepCard` render points.
- [x] `src/test/weather.test.jsx` and `buildWeatherCard` cases in `loadoutCards.test.js`. Full suite = **397 passed**.

### 7.5 React-admin frontend

- [x] `src/api/matchApi.js`: new `getMatchWeather(uuid)` function.
- [x] `MatchDetailPage.jsx`:
  - "RNG seed" row added to the match config table.
  - New Weather panel: current weather info (`idWeather`, `deltaEnergy`, safe/unsafe move costs) + `log_weather` history table (columns: clock, idWeather, deltaEnergy).
  - Panel hidden gracefully when the endpoint returns an error (backward compatibility with older backends).
- [x] `MatchDetailPage.test.jsx` and `matchApi.test.js` updated. Full suite = **398 passed**.
- [x] **v0.36.2** — `WeatherCard.jsx` gains a **Registry** column in the rules table:
  `—` when `conditionKey` is null, a green badge with the clause (e.g. `depth > 3`) when
  `registryMet` is true, a red badge titled "blocked by the registry" when false.

---

## 8. Testing Strategy

### 8.1 Unit tests

| Project | File | Key scenarios |
|---------|------|---------------|
| Java | `WeatherSelectionServiceTest` | Weighted roll picks winner; time filter (clock in/out of range); condition filter match/mismatch; delta applied; clamp at max; clamp at zero; clear when no eligible rule; event-id logged as PENDING; null rng_seed uses story id |
| Java | `WeatherStoreAdapterTest` | Read eligible rules; persist current weather; insert log_weather row; bulk energy update |
| Java | `WeatherControllerTest` | 200 with weather DTO; 404 `WEATHER_NOT_FOUND` |
| Python | `test_weather_selection_service.py` | Same scenarios as Java via pytest with mocked port |
| Python | `test_weather_controllers.py` | 200 and 404 HTTP paths; admin 200 with log |
| AWS | `test_weather_handler.py` | Weighted roll; time/condition filters; energy clamp; clear-on-none; admin endpoint with log; rngSeed on create |
| react-game | `weather.test.jsx` | `WeatherCard` renders with delta; hidden when null |
| react-game | `loadoutCards.test.js` | `buildWeatherCard` cases |
| react-admin | `MatchDetailPage.test.jsx` | rngSeed row; weather panel; log table |
| react-admin | `matchApi.test.js` | `getMatchWeather` call and error path |

**Test counts (all green):** Java `mvn test` BUILD SUCCESS; Python 645; AWS 374;
react-game 397; react-admin 398.

### 8.2 Robot Framework E2E suite

**Suite:** `code/tests/robot/tests/27_weather/weather.robot`

All six tests use `rngSeed=42` via `Create Match With Rng Seed`.

| Test case | Assertion |
|-----------|-----------|
| `Weather Endpoint Returns 404 Before Match Start` | `GET /api/matches/{uuid}/weather` returns 404 immediately after match creation but before start |
| `Weather Is Selected At Match Start` | After `POST /api/matches/{uuid}/start` the weather endpoint returns 200 with a valid `idWeather` and a `deltaEnergy` field |
| `Weather Is Deterministic For Same Seed` | Two separate matches created with `rngSeed=42` select the same `idWeather` at clock 0 |
| `Weather Persists After Time End` | After one full sleep-cycle (time-end), the weather endpoint returns 200 with an updated or unchanged rule |
| `Admin View Exposes Rng Seed And Log` | `GET /api/admin/matches/{uuid}/weather` returns `rngSeed=42`, a `current` block, and a `log` array with at least one entry |
| `Admin Returns 400 On Blank Uuid` | `GET /api/admin/matches/ /weather` returns 400 |

**New keywords in `resources/matches.resource`:**

| Keyword | Purpose |
|---------|---------|
| `Create Match With Rng Seed` | Creates a match passing `rngSeed` in the request body |
| `Get Match Weather` | `GET /api/matches/{uuid}/weather` with bearer token |
| `Get Admin Match Weather` | `GET /api/admin/matches/{uuid}/weather` with admin token |

**Seed prerequisites:**

| Backend | Weather rules |
|---------|---------------|
| Java SQLite | `R__insert_story_seed_data.sql`: `list_weather_rules` rows already present; Step 27 confirmed rows include at least a clear rule (`probability=0.7`) and a storm rule (`probability=0.3`, `delta_energy=-2`) |
| Java PostgreSQL | `R__insert_dev_test_data.sql`: same rows |
| Python | `scripts/seed_stories.py`: `weatherRules` list added to seed story |
| AWS Lambda | `lambda/seed/handler.py`: `weatherRules` embedded on seed story item |

> **Validation note:** the suite was validated with `robot --dryrun` (6/6 PASS). A full
> live run requires a running backend with the V0.27.0 Flyway migration applied.

---

## 9. API Changes Summary

| Endpoint | Status | Change |
|----------|--------|--------|
| `POST /api/matches` | Modified (v0.27.0) | Request body gains optional `rngSeed` field |
| `GET /api/matches/{uuid}/weather` | **New** (v0.27.0) | Current weather; 404 when none set |
| `GET /api/admin/matches/{uuid}/weather` | **New** (v0.27.0) | Admin: rngSeed + current + log[] (port 8044) |
| `GET /api/admin/matches/{uuid}/weather` | Modified (v0.36.2) | Each `rules[]` row gains `conditionKey`/`conditionValue`/`conditionOperator`/`registryMet` — no new columns, only exposing the verdict |

No existing endpoints have status codes removed.

---

## 10. Notes

1. **Weather fires at clock 0.** The initial weather selection runs inside
   `TurnCycleService.startMatch`, so `GET /api/matches/{uuid}/weather` returns 404 before
   the match is started and 200 immediately after. This is the expected Robot test sequence.

2. **Movement costs are informational in Step 27.** `costMoveSafeLocation` and
   `costMoveNotSafeLocation` are returned by the weather endpoint but are not consumed by
   any game action until the movement system is implemented in Step 28.

3. **Weather-linked events are a stub.** Inserting a `PENDING` record in `log_events` is
   the complete Step 27 behavior for event-linked weather. No stat change or narrative
   trigger fires from Step 27.

4. **Energy delta clamping is character-local.** Each character has its own `energy` and
   `energy_max`; the clamp is applied independently per character. A character at
   `energy=0` does not go negative; a character at full energy receiving a positive delta
   stays at `energy_max`.

5. **Null `rng_seed` fallback.** Matches created before the V0.27.0 migration have
   `rng_seed = NULL`. The weather engine falls back to `id_story` as the seed so the roll
   is still deterministic (though not match-specific). New matches always have a
   generated seed.

6. **Single Table Design for AWS.** DynamoDB does not have a `log_weather` table; the
   history is stored as an embedded list attribute `weatherLog` on the match item. The
   admin endpoint reads this list directly. There is no migration step for AWS.

7. **Weather panel in react-admin is backward-compatible.** The panel is rendered only
   when the admin weather endpoint returns 200. If the backend is an older version that
   does not expose this endpoint, the panel is silently hidden — no error is shown to the
   admin user.

8. **The per-clock seed increments monotonically.** Because the seed is `rng_seed + clock`,
   the effective seed increases by 1 each clock advance. There is no reset or modular
   wrapping in the current implementation. Integer overflow at extremely high clock values
   is not protected in Step 27 and is considered out of scope.

---

# Version Control

- Document created with the following AI prompt context:
  ```
  step=27 weather system random selection & effects
  ```

- **Document Version**: 0.36.2

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.27.0 | Initial Step 27 documentation: weather engine (weighted roll, time/condition filter, rng_seed, delta_energy, log_weather), new GET /api/matches/{uuid}/weather and admin weather endpoint, WeatherCard in react-game, weather panel + rngSeed row in react-admin MatchDetailPage, Robot suite 27_weather (6 tests with rngSeed=42) | June 24, 2026 |
  | 0.36.2 | Admin weather `rules[]` exposes the registry verdict: `conditionKey`/`conditionValue`/`conditionOperator`/`registryMet`, computed with the same comparison the weather selection uses. `WeatherCard.jsx` gets a Registry column. No new DB columns. | September 5, 2026 |

- **Last Updated**: September 5, 2026
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
