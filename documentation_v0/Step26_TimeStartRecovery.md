# Paths Games V0 - Step 26: Time-Start Recovery, Class Bonuses & Location Counters

This document describes the implementation of **Step 26** as requested in the Roadmap.

Step 26 extends the time-advancement engine introduced in Step 25. Between waking
characters and rebuilding the turn queue (the "time-start" moment), the backend now:

1. Recovers each character's energy, life, and sadness based on their current location
   safety and the match difficulty energy parameter.
2. Applies class bonuses (from `list_classes_bonus`) on top of the base recovery, then
   clamps all stats to their stored maximum values.
3. Seeds a `gaming_state_locations` row for any occupied location that carries a
   `counter_time > 0` but has no row yet, then decrements every existing
   `clock_counter > 0`; when a counter reaches zero it logs the location's
   `id_event_if_counter_zero` as a PENDING event (actual event execution is wired
   in Step 29).
4. Surfaces a per-character recovery recap (`energyDelta`, `lifeDelta`, `sadDelta`)
   on the `POST /api/gameplay/{uuidMatch}/action/sleep` response under a new
   `recovery` array.
5. Adds a `clockCounter` field to the location objects in the match-info response so
   the frontend can display it.
6. Frontend: `BonusBadgeList` gains a `clockCounter`/`clock` icon; `matchInfoAdapter`
   maps the current location's residual counter; `LocationCard` renders it as a
   statistic when `> 0`; react-admin `MatchDetailPage` location table relabelled to
   "Location state — gaming_state_locations" with a Counter column.

---

## 1. Scope

Step 26 covers the following items from the Roadmap:

- Per-character stat recovery at time-start based on location safety. A location is
  **safe** when `list_locations.secure_param > 0`. The parameter `P` is defined as
  `secure_param + difficulty.energy`.
  - Safe location: `energy += DEX + P`, `life += COS + secure_param`, `sadness -= INT + secure_param`.
  - Unsafe location: `energy += difficulty.energy` only (no DEX, no secure_param; life and sadness unchanged).
- Class bonuses from `list_classes_bonus` (keyed by the character's `id_class`) applied
  additively to the recovery result, followed by stat clamping:
  `0 <= energy <= energy_max`, `0 <= life <= life_max`, `0 <= sad <= sad_max`.
- Persistence of `id_class` on `gaming_character_instance` via a new Flyway migration
  (`V0.26.0`) so the recovery engine can look up bonuses at time-start.
- Seeding and decrementing `gaming_state_locations.clock_counter`. When a counter
  reaches zero, the location's `id_event_if_counter_zero` is logged in `log_events`
  as a pending entry (stub; event execution deferred to Step 29).
- Per-character recovery recap on the sleep response (`recovery[]` array).
- Frontend `LocationCard` showing `clockCounter` as a statistic badge when `> 0`.
- Frontend react-admin `MatchDetailPage` showing the `gaming_state_locations` table
  with the Counter column.
- New Flyway migration `V0.26.0__add_character_class.sql` (both SQLite and PostgreSQL
  adapters).
- Robot E2E suite `26_time_recovery` validating the recap shape, stat caps, counter
  presence, and counter decrement.
- Unit tests for all four backends and both React frontends.

**Out of scope (Steps 27+):** weather selection and energy delta, movement validation
against weight, coma-triggered recovery, and WebSocket broadcast of the recovery recap.

---

## 2. Endpoint Changes

No new endpoints are introduced. The following existing endpoints are extended.

### 2.1 `POST /api/gameplay/{uuidMatch}/action/sleep`

Endpoint is unchanged from Step 25. The response body gains a new `recovery` array
that is populated only when `timeEndTriggered == true`.

HTTP status codes and error codes are identical to Step 25.

**Extended `SleepActionResponse`:**

```json
{
  "matchUuid": "match-uuid-v4",
  "characterUuid": "char-uuid-v4",
  "isSleeping": true,
  "timeEndTriggered": true,
  "currentClock": 2,
  "recovery": [
    {
      "characterUuid": "char-uuid-v4",
      "energyDelta": 3,
      "lifeDelta": 2,
      "sadDelta": -1
    }
  ]
}
```

When `timeEndTriggered == false` the `recovery` array is present but empty.

### 2.2 `GET /api/match/{uuidMatch}/info`

The `locations` array in the response gains a `clockCounter` field (integer, >= 0)
representing the residual time counter from `gaming_state_locations.clock_counter`.
The field is `null` when no `gaming_state_locations` row exists for that location.

No other fields or status codes change.

---

## 3. DTOs and Domain Models

### 3.1 `RecoveryItem` (nested in `SleepActionResponse`)

| Field | Type | Notes |
|-------|------|-------|
| `characterUuid` | string | Public UUID of the character |
| `energyDelta` | integer | Change in energy after recovery + class bonus + clamp (can be 0) |
| `lifeDelta` | integer | Change in life (0 when location is unsafe) |
| `sadDelta` | integer | Change in sadness (0 or negative when location is unsafe) |

> **Note on zero deltas:** a freshly-joined character starts at full energy/life.
> Because no energy-draining action exists before Step 28, all three deltas are
> typically `0` in the tutorial scenario — the character recovers from 0 to 0.
> The recap contract (shape + presence) is still validated by the Robot suite.

### 3.2 Java core domain models

| Class | Package | Purpose |
|-------|---------|---------|
| `TimeStartRecoveryService` | `core/.../service/match/` | Pure recovery logic: `applyAtTimeStart(idMatch)` orchestrator + `computeRecovery(...)` static pure math method |
| `TimeStartRecoveryService.StatTriple` | same file | Record holding computed `(energy, life, sad)`; gained `sadUnclamped` in v0.30.0 so the edge-state rules ([Step30_EdgeStates.md](./Step30_EdgeStates.md)) can read the pre-clamp value recovery actually computed |
| `TimeStartRecoveryService.RecoveryRecap` | same file | Record `(characterUuid, energyDelta, lifeDelta, sadDelta)` |
| `RecoveryStorePort` | `core/.../port/match/` | Outbound port with nested records: `RecoveryMatchContext`, `RecoveryCharacter`, `LocationSafety`, `ClassBonusView`, `StateLocationView`. v0.30.0: `RecoveryCharacter` gained `isComa`, `RecoveryMatchContext` gained `currentClock` — both feed the edge-state coma stamp ([Step30_EdgeStates.md](./Step30_EdgeStates.md)) |
| `RecoveryStoreAdapter` | `core/.../persistence/match/` | SQLite/PostgreSQL implementation of `RecoveryStorePort` |
| `LogEventsEntity` + `LogEventsEntityId` | `core/.../entity/match/` | JPA entity writing to the existing `log_events` table (audit recovery and counter-zero events) |

`TimeStartRecoveryService` is injected into `TimeAdvancementService.advanceTime(...)`:
the call `recoveryService.applyAtTimeStart(match.id())` fires between waking characters
(step 5 of the clock advance) and rebuilding the turn queue (step 7).

`TimeAdvancementPort.SleepResult` gains a `List<RecoveryItem> recovery()` accessor;
`SleepActionResponse` (adapter-rest) serializes the list into the JSON `recovery` array.

### 3.3 Python core models

| Item | Path | Purpose |
|------|------|---------|
| `TimeStartRecoveryService` | `app/core/services/match/time_start_recovery_service.py` | Mirror of Java; `apply_at_time_start(id_match)` |
| `compute_recovery(...)` | same file | Module-level pure function for unit testing |
| `RecoveryItem` | `app/core/models/match/time_models.py` | Dataclass `(character_uuid, energy_delta, life_delta, sad_delta)` |
| `TimeStorePort` extensions | `app/core/ports/match/time_ports.py` | New abstract methods: `load_recovery_context`, `find_recovery_characters`, `find_location_safety`, `find_class_bonuses`, `find_state_locations`, `update_character_stats`, `insert_state_location`, `update_state_location_counter`, `log_recovery`, `log_counter_zero` |
| `time_store_adapter.py` | `app/adapters/persistence/match/` | SQLAlchemy implementations of the new port methods |

> **Python note:** Python's `list_locations` uses the column `is_safe` (treated as a
> numeric `secure_param` proxy); the counter column is now unified as `counter_time`
> (exposed as `counterTime` in the API, matching Java/PostgreSQL). The recovery
> logic is otherwise identical.

### 3.4 AWS Lambda models

The AWS backend stores class information on the embedded character as `classUuid`. At
time-start recovery, `_apply_time_start_recovery` resolves the class id from the
story's `classes` array by UUID, then looks up bonuses on the in-memory class object.
Location counters live on the embedded match `locations` array; a counter reaching zero
sets a `pendingEvent` marker on the match item. The `recovery` array is appended to the
sleep response.

---

## 4. Recovery Math

### 4.1 Parameters

| Symbol | Source |
|--------|--------|
| `P` | `list_locations.secure_param` + `list_difficulties.energy` (the `energy` column of the match's difficulty, not the character's current energy) |
| `safe` | `secure_param > 0` |
| `DEX` | `gaming_character_instance.dexterity` |
| `INT` | `gaming_character_instance.intelligence` |
| `COS` | `gaming_character_instance.constitution` |
| `difficulty.energy` | `list_difficulties.energy` (flat value from the match's difficulty row) |

### 4.2 Base recovery

| Condition | Energy delta | Life delta | Sadness delta |
|-----------|-------------|------------|---------------|
| Safe location | `DEX + P` | `COS + secure_param` | `-(INT + secure_param)` |
| Unsafe location | `difficulty.energy` | `0` | `0` |

> **Unsafe formula change (v0.26.x bugfix):** unsafe locations now grant only the flat
> `difficulty.energy` bonus — no DEX contribution and no `secure_param` addend.
> Previously the formula was `DEX + P`, identical to the safe branch; the corrected
> formula makes unsafe locations meaningfully worse than safe ones.

### 4.3 Class bonus application and clamping

After the base recovery:

```
energy  = energy  + bonus(energy)
life    = life    + bonus(life)
sadness = sadness + bonus(sadness)

energy  = clamp(energy,  0, energy_max)
life    = clamp(life,    0, life_max)
sadness = clamp(sadness, 0, sad_max)
```

`bonus(stat)` is the sum of all `list_classes_bonus.value` rows where
`id_class == character.id_class` and `statistic == stat` (case-insensitive).
Characters without a class (`id_class IS NULL`) receive no class bonus.

---

## 5. Database Schema Changes

### 5.1 Flyway migrations — V0.26.0

Two new migration files add a single column to `gaming_character_instance`:

- `adapter-sqlite/src/main/resources/db/migration/v0/V0.26.0__add_character_class.sql`
- `adapter-postgres/src/main/resources/db/migration/v0/V0.26.0__add_character_class.sql`

```sql
ALTER TABLE gaming_character_instance ADD COLUMN id_class INTEGER;
```

The column is nullable; existing rows default to `NULL` (no class bonus at next
time-start). It is populated by `CharacterCommandService.buildInstance` on every
new character join.

Python does not use Flyway; the `id_class` column is declared on the SQLAlchemy model
and created via `create_all` on startup. No migration file is needed for Python.
AWS Lambda stores `classUuid` on the DynamoDB character item; no schema change.

### 5.2 `gaming_character_instance` — new column

| Column | Type | Notes |
|--------|------|-------|
| `id_class` | INTEGER (nullable) | FK → `list_classes(id)`; persisted at join, used by time-start recovery to look up `list_classes_bonus` |

### 5.3 `gaming_state_locations` (existing table, new usage)

| Column | Type | Role in Step 26 |
|--------|------|-----------------|
| `id_match` | INTEGER | FK → `gaming_match(id)` |
| `id_location` | INTEGER | FK → `list_locations(id)` |
| `flag_already_actived` | BOOLEAN | Set to `1` when the counter legitimately reaches zero; prevents re-seeding after activation (see §6.4) |
| `clock_counter` | INTEGER | Seeded from `list_locations.counter_time`; decremented on each time-start; when it reaches `0` the location's `id_event_if_counter_zero` is logged as pending |

### 5.4 `list_locations` — columns read by Step 26

| Column | Type | Role |
|--------|------|------|
| `secure_param` | INTEGER | Safety indicator: `> 0` = safe; used as the `P` addend |
| `counter_time` | INTEGER | Initial value seeded into `gaming_state_locations.clock_counter` |
| `id_event_if_counter_zero` | INTEGER (nullable) | Event to log as pending when `clock_counter` reaches `0` |

### 5.5 `log_events` (existing table, new writes)

`LogEventsEntity` writes two types of recovery audit records to this table:

- **Recovery log**: one row per character per time-start containing `safe`, `P`, and
  the three deltas.
- **Counter-zero log**: one row per location whose counter reaches `0`, containing the
  `id_event_if_counter_zero` if present (PENDING stub; executed in Step 29).

---

## 6. Business Logic

### 6.1 Time-start recovery sequence

`TimeStartRecoveryService.applyAtTimeStart(idMatch)` is called by
`TimeAdvancementService.advanceTime(...)` immediately after waking all characters
(step 5 of the Step 25 clock-advance sequence) and before rebuilding the turn queue.

Full sequence:

1. Load match context: `id_story` and `difficulty.energy` (`RecoveryMatchContext`).
2. Load all `gaming_character_instance` rows for the match (`RecoveryCharacter` list).
3. Load `list_locations` safety data for the story (`LocationSafety` list): reads
   `secure_param`, `counter_time`, `id_event_if_counter_zero` per location.
4. Load `list_classes_bonus` rows for the story (`ClassBonusView` list).
5. Load existing `gaming_state_locations` rows for the match (`StateLocationView` list).
6a. **Re-seed stale rows** (v0.26.1 fix): for each occupied location whose existing
    `gaming_state_locations` row has `clock_counter = 0` AND `flag_already_actived = 0`
    but whose story definition now carries `counter_time > 0`, call
    `updateStateLocationCounter` to reinitialize `clock_counter` to the definition value.
    Rows where `flag_already_actived != 0` are skipped (counter legitimately reached zero).
6b. **Seed missing state-location rows**: for each location currently occupied by a
    character (`gaming_character_instance.id_location`) that has `counter_time > 0`
    but no `gaming_state_locations` row yet, INSERT a row with
    `clock_counter = counter_time`.
7. **Recover each character**: compute `(safe, P)` from the location, compute base
   recovery, add class bonuses, clamp; call `updateCharacterStats`; call `logRecovery`.
8. **Decrement counters**: for each `gaming_state_locations` row with
   `clock_counter > 0`, decrement by 1; when the result is `0`, call `logCounterZero`
   with the `id_event_if_counter_zero` (may be `null`), then call
   `markStateLocationActivated` to set `flag_already_actived = 1`.
9. Return `List<RecoveryRecap>` (one item per character) to `TimeAdvancementService`,
   which stores it in `SleepResult.recovery()` for serialization.

### 6.2 Counter seeding rationale

A character who joins a match at a counter-location does not automatically create a
`gaming_state_locations` row; that row is normally created on location entry (Step 29).
Step 26 pre-seeds it at the first time-start if the character is already there, so that
the decrement logic has a row to work with.

### 6.3 Re-seed fix for counters added after match creation (v0.26.1)

**Problem.** When a match is created, the backend pre-seeds a `gaming_state_locations`
row for each occupied location using `counter_time || 0`. If `counter_time` is then
raised on the story definition _after_ the match already exists, the row is already
present with `clock_counter = 0` and is never re-initialized: the counter stays at zero
and is never decremented.

**Fix.** `TimeStartRecoveryService.applyAtTimeStart` now includes a re-seed step (step
1a in the sequence below) that runs _before_ the normal seed-missing-rows step (1b):

> For every occupied location whose `gaming_state_locations` row has
> `clock_counter = 0` **and** `flag_already_actived = 0`, but whose story definition
> now carries `counter_time > 0`, the service calls
> `updateStateLocationCounter(idMatch, idLocation, counterTime)` to reinitialize
> the counter to the definition value. The row is then decremented in step 3 as
> usual.

The fix is applied identically in Java (`TimeStartRecoveryService`), Python
(`time_start_recovery_service.py`), and AWS Lambda (`_apply_time_start_recovery` in
`lambda/match/handler.py`).

### 6.4 Guard flag — no re-seed after counter reaches zero

When a counter is legitimately decremented to zero, the service sets
`gaming_state_locations.flag_already_actived = 1` by calling:

- **Java** `RecoveryStorePort.markStateLocationActivated(idMatch, idLocation)` (new
  port method, implemented in `RecoveryStoreAdapter`).
- **Python** `time_store_adapter.mark_state_location_activated(id_match, id_location)`
  (new method on `TimeStorePort`).
- **AWS** sets the embedded field `flagAlreadyActived = 1` on the match's `locations`
  array entry in DynamoDB.

The re-seed check in step 1a skips any location where `flag_already_actived != 0`,
so a location whose counter has legitimately reached zero will never be re-seeded on
subsequent time-starts. This prevents a false re-seed when `counter_time > 0` on the
story definition but the counter has already fired.

`StateLocationView` (Java record in `RecoveryStorePort`) and its Python/AWS equivalents
now expose `flagAlreadyActived` so the service can perform this check.

### 6.5 Pending counter-zero events (stub)

When `clock_counter` reaches `0`, `logCounterZero` writes a row to `log_events` with
type PENDING and the `id_event_if_counter_zero` as a reference. The actual execution of
the event (trigger evaluation, effect application, chaining) is deferred to Step 29.
Step 26 guarantees only that the event id is recorded.

---

## 7. Per-Project Implementation Plan

### 7.1 Java (reference implementation)

**Core module**

- [x] `TimeStartRecoveryService` (`service/match/`): `applyAtTimeStart(long idMatch)` orchestrator; static `computeRecovery(...)` for pure-math unit tests; inner records `StatTriple` and `RecoveryRecap`.
- [x] `RecoveryStorePort` (`port/match/`): all read/write methods; inner records `RecoveryMatchContext`, `RecoveryCharacter`, `LocationSafety`, `ClassBonusView`, `StateLocationView` (now includes `flagAlreadyActived`). New method `markStateLocationActivated(idMatch, idLocation)` sets `flag_already_actived = 1` when a counter reaches zero.
- [x] `RecoveryStoreAdapter` (`persistence/match/`): JDBC/JPA implementations of all port methods including `markStateLocationActivated`.
- [x] `LogEventsEntity` + `LogEventsEntityId` (`entity/match/`): JPA entity for `log_events` table writes.
- [x] `TimeAdvancementService`: inject `TimeStartRecoveryService`; call `applyAtTimeStart` between wake-all and queue rebuild; store result in `SleepResult`.
- [x] `TimeAdvancementPort.SleepResult`: add `List<RecoveryItem> recovery()` accessor.
- [x] `GamingCharacterInstanceEntity`: add `id_class` column mapping.

**Flyway migrations**

- [x] `V0.26.0__add_character_class.sql` in both `adapter-sqlite` and `adapter-postgres`.

**Adapter-rest**

- [x] `SleepActionResponse`: add `List<RecoveryItem> recovery` field; populate from `SleepResult.recovery()` via `RecoveryItem` inner class.

**Unit tests**

- [x] `TimeStartRecoveryServiceTest`: `Compute` nested — safe branch (all three deltas), unsafe branch (life/sad unchanged), class bonus addition, clamp at max, clamp at zero; `Flow` nested — stub port integration; recovery list size matches character count.
- [x] `TimeAdvancementServiceTest`: updated with `TimeStartRecoveryService` mock; asserts `applyAtTimeStart` called exactly once per time-end.
- [x] `TimeClockDtoSerializationTest` (adapter-rest): asserts `recovery` field serializes as an array in the JSON response.

### 7.2 Python backend

- [x] `time_start_recovery_service.py` (`app/core/services/match/`): `apply_at_time_start(id_match)` and module-level `compute_recovery(...)`.
- [x] `RecoveryItem` dataclass added to `time_models.py`.
- [x] `TimeStorePort` extended with 11 new abstract methods for recovery and counter operations (including `mark_state_location_activated`).
- [x] `time_store_adapter.py`: all new port methods implemented via SQLAlchemy / raw SQL, including `mark_state_location_activated`.
- [x] `time_clock_controller.py`: recovery recap serialized into the sleep response JSON.
- [x] `tests/test_time_start_recovery_service.py`: pytest suite mirroring Java unit tests.

**SQLAlchemy note**: Python's `GamingCharacterInstance` model gains `id_class`; `create_all` adds the column at startup (no migration file).

### 7.3 AWS Lambda

- [x] `lambda/match/handler.py`:
  - `_compute_recovery(dexterity, intelligence, constitution, energy, life, sad, energy_max, life_max, sad_max, safe, p, bonus_energy, bonus_life, bonus_sad)` — pure function.
  - `_apply_time_start_recovery(match, match_uuid, story)` — iterates characters, resolves class bonuses from `story.classes`, re-seeds counters stuck at zero (see §6.3), seeds/decrements location counters (embedded on the match `locations` array), sets `flagAlreadyActived = 1` and `pendingEvent` marker when counter reaches zero; returns recovery list.
  - `_advance_time(match, match_uuid)` — calls `_apply_time_start_recovery` after waking characters; appends the result to the sleep response.
- [x] `lambda/seed/handler.py`: tutorial location 1 set as safe (`secureParam: 1`); tutorial location 2 carries `counterTime: 2` and `idEventIfCounterZero: 1` for testing the counter path.
- [x] `tests/test_time_advancement_handler.py`: extended to cover recovery recap shape, class bonus application, safe vs unsafe branch, and counter decrement/zero flag.


### 7.5 React-Game frontend

- [x] `BonusBadgeList.jsx`: `STAT_VISUAL` map gains `clockCounter` and `clock` entries, both mapped to `fas fa-hourglass-half` icon in gold (`#d4af37`).
- [x] `matchInfoAdapter.js`: finds the `gaming_state_locations` entry for the player's current location (`idLocation`) in `info.locations`, reads its `clockCounter`, and merges it onto `actualLocationCard` as a property.
- [x] `LocationCard.jsx`: reads `location.clockCounter`; when `> 0` builds a single-item `statItemsToPageContent` array with key `clockCounter`, the i18n label, and the value; delegates rendering to `Card`'s `statItemsToPageContent` prop.
- [x] `src/i18n/en.json` and `it.json`: new key `game.location.clockCounter` ("Time counter" / Italian equivalent).
- [x] `src/test/LocationCard.test.jsx`: new test asserting the counter badge renders when `clockCounter > 0` and is absent when `0` or missing.

### 7.6 React-Admin frontend

- [x] `MatchDetailPage.jsx`: location section relabelled to "Location state — gaming_state_locations (`{count}`)"; columns updated to include "Counter" (renders `l.clockCounter ?? 0`); comment explains the counter is decremented at each time-start and reaches zero to fire Step 29 events.
- [x] `src/tests/pages/MatchDetailPage.test.jsx`: mock data includes `clockCounter: 3` on the location fixture; asserts the heading "Location state — gaming_state_locations (1)" is present and the counter value is rendered.

---

## 8. Testing Strategy

### 8.1 Unit tests

| Backend | File | Key scenarios |
|---------|------|---------------|
| Java | `TimeStartRecoveryServiceTest` | Safe branch (energy=DEX+P, life=COS+secureParam, sad=INT+secureParam); unsafe branch (`energy = difficulty.energy` only, life/sad unchanged); class bonus addition; clamp at max (energy and sad); clamp at zero; no class (id_class null); re-seed when counter=0 and flag=0; no re-seed when flag=1 |
| Java | `TimeAdvancementServiceTest` | `applyAtTimeStart` called once per time-end; recovery list propagated to `SleepResult` |
| Java | `TimeClockDtoSerializationTest` | `recovery` field serializes as JSON array |
| Python | `test_time_start_recovery_service.py` | Same safe/unsafe/bonus/clamp/re-seed scenarios via pytest (life/sad use secureParam); `apply_at_time_start` with mocked `TimeStorePort` |
| AWS | `test_time_advancement_handler.py` | Recovery recap shape; class bonus from story classes; counter seed, decrement, zero flag; safe vs unsafe; re-seed when counter stuck at 0; no-reseed after `flagAlreadyActived=1` |
| react-game | `LocationCard.test.jsx` | Counter badge present when `> 0`; absent when `0` or missing |
| react-admin | `MatchDetailPage.test.jsx` | Location section heading; counter column value |

**Test counts (all green):** Java mvn test BUILD SUCCESS; Python 627; AWS 370;
react-game 344; react-admin 333.

### 8.2 Robot Framework E2E suites

**Suite 1:** `code/tests/robot/tests/26_time_recovery/time_recovery.robot`

| Test case | Assertion |
|-----------|-----------|
| `Sleep Returns A Recovery Recap` | Sleep response with `timeEndTriggered == True` contains a non-empty `recovery` array; each item has `characterUuid`, `energyDelta`, `lifeDelta`, `sadDelta` fields |
| `Recovered Stats Never Exceed The Caps` | After time-end, match-info `players[0].energy <= energyMax`, `sad <= sadMax`, `life <= lifeMax`, all values `>= 0` |
| `Match Info Exposes Location Clock Counters` | Match-info `locations` array contains at least one entry with a `clockCounter` field |
| `Location Counter Decrements Across Time Ends` | Max `clockCounter` value in locations after second time-end is `<=` that after first time-end |

> **Note on zero deltas in the Robot suite:** the suite only validates the contract
> (array shape, field presence, cap compliance). It does not assert specific non-zero
> deltas because a freshly-joined character starts at full stats and no energy-draining
> action exists before Step 28 — the deltas are legitimately `0` in this context.

**Suite 2 (v0.26.1):** `code/tests/robot/tests/26_time_recovery/location_counter_reseed.robot`

Validates the re-seed fix and the guard flag using admin `PUT` on the location's
`counterTime` to simulate both the bug scenario and the legitimate-zero scenario.

| Test case | Scenario | Assertion |
|-----------|----------|-----------|
| `Normal Seeding Counter Decrements On Sleep` | `counterTime = 3` set before match creation | `clockCounter` pre-seeded to `3`; decrements to `2` after one time-end sleep |
| `Counter Reseeds When Set After Match Creation` | Match created with `counterTime = 0`; then raised to `3` | First sleep re-seeds counter to `3`, then decrements to `2` |
| `Counter Does Not Reseed After Reaching Zero` | `counterTime = 1`; counter reaches `0`; `flag_already_actived = 1` | Second sleep leaves `clockCounter` at `0` — no re-seed |

Suite teardown restores the location's original `counterTime` via admin `PUT`.

**Suite 3 (v0.26.1 — regression):** `code/tests/robot/tests/26_time_recovery/match_info_lang.robot`

The file already covered `GET /api/match/{uuid}/info?lang=` propagation tests. A new
test case was added as a regression guard for the AWS i18n bug:

| Test case | Assertion |
|-----------|-----------|
| `Story List Lang IT Never Blanks A Title That English Has` | `GET /api/stories?lang=it` must not return a null/empty `title` for any story that has a title under `lang=en`. Compares the full story list in both languages; for each English title present, the corresponding Italian title must be non-null and non-empty (translated when available, English fallback otherwise). Backend-agnostic and order-independent — survives CRUD mutations from earlier suites. Tags: `stories lang i18n regression` |

The new keyword `Build Title Map By Uuid` builds a `{uuid: title}` dict from a story
list, making the cross-language comparison order-independent.

Robot suite Python execution after this addition: **383 tests**, all green.

**Seed prerequisites:**

| Backend | Location config |
|---------|-----------------|
| Java SQLite | `R__insert_story_seed_data.sql`: location 90001 `secure_param=1`, `counter_time=2`; location 90005 `secure_param=0` (unsafe) |
| Java PostgreSQL | `R__insert_dev_test_data.sql`: same location rows |
| Python | `scripts/seed_stories.py`: `is_safe` / `counterTime` equivalents |
| AWS Lambda | `seed/handler.py`: location 1 `secureParam=1`; location 2 `counterTime=2`, `idEventIfCounterZero=1` |

---

## 9. API Changes Summary

| Endpoint | Status | Change |
|----------|--------|--------|
| `POST /api/gameplay/{uuidMatch}/action/sleep` | Modified (v0.26.0) | Response body gains `recovery[]` array |
| `GET /api/match/{uuidMatch}/info` | Modified (v0.26.0) | `locations[]` items gain `clockCounter` field |

No new endpoints. No status codes removed or added.

---

## 10. Notes

1. **Safe vs unsafe formula is intentionally different.**
   For **safe** locations, `P = secure_param + difficulty.energy`; energy recovery is
   `DEX + P`, life recovery is `COS + secure_param`, and sadness reduction is
   `INT + secure_param`. Life and sadness use only `secure_param` (not the full `P`),
   so `difficulty.energy` exclusively boosts energy recovery.
   For **unsafe** locations, the recovery is only the flat `difficulty.energy` value —
   no DEX contribution, no secure_param. This makes unsafe locations meaningfully worse
   than safe ones. The formula is consistent across Java, Python, and AWS backends.

2. **Energy drain is a Step 28 concern.** Until Step 28 (movement) introduces actions
   that consume energy, all characters start each test match at `energy_max`. The
   recovery deltas will therefore be `0` (recovery cannot exceed the cap) in all
   current E2E scenarios. This is by design and documented in the Robot suite header.

3. **Counter seeding happens only once per missing row.** If a `gaming_state_locations`
   row already exists for a location (e.g., inserted at location entry in a future step),
   the seed step (6b) in `applyAtTimeStart` skips it. The re-seed step (6a) may still
   update an existing row when `clock_counter = 0` and `flag_already_actived = 0`.

3a. **Re-seed is bounded by `flag_already_actived`.** Once a counter has legitimately
   reached zero, `flag_already_actived` is set to `1` by `markStateLocationActivated`.
   Subsequent calls to `applyAtTimeStart` skip that location in step 6a, so the counter
   is never re-seeded after it has fired.

4. **Counter-zero event execution is deferred to Step 29.** Step 26 only writes the
   pending audit row to `log_events`. No event handler, stat change, or choice
   presentation is triggered in this step.

5. **Python column name difference.** Python's `list_locations` model uses `is_safe`
   (treated as numeric `secure_param`). The counter column is now unified as
   `counter_time` (`counterTime` in the API) across Java/PostgreSQL, Python and AWS.
   Both resolve to the same recovery formula.

6. **`id_class` is nullable.** Characters joined before the V0.26.0 migration have
   `id_class = NULL` and receive no class bonus at time-start. New joins persist the
   class from the join request in `CharacterCommandService.buildInstance`.

7. **Log events table is append-only.** Both `logRecovery` and `logCounterZero`
   INSERT new rows; no UPDATE is performed on `log_events`.



## 15. Addendum (v0.26.1) — `locationsActive[].idCard` + seed consistency fix

### 15.1 Problem

`GET /api/match/{uuid}/info` returned in `locationsActive[].card` a card object
that was **not present** in the `list_cards` table of the story. The root cause
was that only the AWS seed (`lambda/seed/handler.py`) embedded a literal inline
`card` object directly on each location row (with `idCard: None`), detached from
`raw_cards`. All other backends derived the card at read-time from `id_card` on
`list_locations`, so the AWS runtime was the only path that could return an
orphan card. In addition, no backend exposed `idCard` on the `LocationInfo`
domain object, so the API consumer could not verify the FK itself.

### 15.2 What changed

**`idCard` field added to `locationsActive[]` entries (all backends):**

- **Java.** `core/model/match/LocationInfo.java` — new `idCard` (Long) field,
  constructor and getter. `core/service/match/MatchQueryService.java` — passes
  `loc.getIdCard()` when building the `LocationInfo`. `adapter-rest/dto/
  MatchInfoResponse.java` — `LocationInfoDto.idCard` serialised.
- **Python.** `core/models/match/match_models.py` — `id_card` field on
  `LocationInfo`. `core/services/match/match_query_service.py` — populated from
  the location row. `adapters/rest/match/match_controller.py` —
  `_location_info_to_camel` serialises `"idCard"`.
- **AWS Lambda.** `lambda/match/handler.py` — `_build_locations_active` reads
  `"idCard"` from the location record and forwards it in the response.

**OpenAPI.** `adapter-rest/src/main/resources/openapi/v0.19.0-match-creation-api.yaml`
— `LocationInfo` schema gains `idCard` (integer, nullable) with description
_"Logical reference to the location's visual card (list_cards id); the resolved
card is returned in `card`."_

**AWS seed fixed (`lambda/seed/handler.py`):**

- Removed inline literal `card` objects from location entries; locations now
  carry an `idCard` that references a real entry in `raw_cards`.
- `raw_cards` enriched with the missing card objects; `raw_texts` enriched with
  the corresponding title/description text entries.
- New helper `_enrich_locations_with_cards(locations, raw_cards, raw_texts)` —
  resolves the `card` dict from `idCard` at write-time, exactly as the story
  import path does.
- Supporting helpers added: `_safe_int`, `_resolve_raw_text`,
  `_resolve_card_from_raw`.

**Seed data — `id_card` set on all locations (SQL + Python):**

| Seed file | Scope |
|-----------|-------|
| `adapter-sqlite/src/main/resources/db/migration/dev/R__insert_story_seed_data.sql` | Java dev / SQLite |
| `adapter-postgres/src/main/resources/db/migration/dev/R__insert_dev_test_data.sql` | Java dev / PostgreSQL |
| `app/adapters/persistence/seed_dev_data.py` | Python backend |

All seed locations now carry a valid `id_card` value that references an existing
`list_cards` row for the same story.

### 15.3 Result

`GET /api/match/{uuid}/info` now returns in every `locationsActive[]` entry:

```json
{
  "idLocation": 1,
  "uuid": "loc-001",
  "idCard": 5,
  "card": { "title": "Welcome Hall", "urlImage": "...", "awesomeIcon": "fas fa-door-open" },
  "neighbors": [ ... ],
  "events": [ ... ]
}
```

The `card` object is guaranteed to correspond to the `list_cards` row identified
by `idCard`. The fix is consistent across Java, Python, and AWS.

### 15.4 Tests

- Java: `mvn clean test` — BUILD SUCCESS (all existing suites).
- Python: 604 tests pass.
- AWS: 322 tests pass.



## 16. Addendum (v0.26.1) — Location counter re-seed bugfix

### 16.1 Problem

When a match is created, the backend pre-seeds `gaming_state_locations` rows for all
occupied locations using `counter_time || 0`. If `counter_time` is added or raised on a
story location _after_ the match already exists, the row is present with
`clock_counter = 0` and `flag_already_actived = 0` — and since the seed step (6b) skips
existing rows, the counter is never re-initialized and never decremented.

### 16.2 Fix

A new step **6a** was added to `TimeStartRecoveryService.applyAtTimeStart` (and its
Python / AWS equivalents) that runs before the existing seed step 6b:

> For each occupied location whose `gaming_state_locations` row has
> `clock_counter = 0` AND `flag_already_actived = 0`, but whose story definition
> now carries `counter_time > 0`, call `updateStateLocationCounter` to restore
> `clock_counter` to the definition value.

The counter is then decremented as normal in step 8.

### 16.3 Guard: `flag_already_actived`

To prevent the re-seed from firing on a location that has legitimately counted down
to zero, step 8 now also calls `markStateLocationActivated(idMatch, idLocation)` when
`clock_counter` reaches `0`. This sets `flag_already_actived = 1`, which causes step
6a to skip the location on all future time-starts.

**New port method across all backends:**

| Backend | Method / field |
|---------|----------------|
| Java | `RecoveryStorePort.markStateLocationActivated(idMatch, idLocation)` → `RecoveryStoreAdapter` |
| Python | `TimeStorePort.mark_state_location_activated(id_match, id_location)` → `time_store_adapter.py` |
| AWS Lambda | Sets `flagAlreadyActived = 1` on the embedded location entry in `_apply_time_start_recovery` |

`StateLocationView` (all backends) now exposes `flagAlreadyActived` so the service
can read it during step 6a.

### 16.4 New Robot suite

`code/tests/robot/tests/26_time_recovery/location_counter_reseed.robot` — 3 test cases
(see §8.2 Suite 2 for details). The suite uses admin `PUT` on the location's
`counterTime` field to control the before/after state and is backend-agnostic.

### 16.5 Files changed

| File | Change |
|------|--------|
| `core/.../service/match/TimeStartRecoveryService.java` | Step 6a re-seed block; step 8 calls `markStateLocationActivated` |
| `core/.../port/match/RecoveryStorePort.java` | New `markStateLocationActivated` method; `StateLocationView` gains `flagAlreadyActived` |
| `core/.../persistence/match/RecoveryStoreAdapter.java` | Implements `markStateLocationActivated` |
| `core/.../service/match/TimeStartRecoveryServiceTest.java` | New re-seed and no-reseed-after-zero test cases |
| `core/.../persistence/match/RecoveryStoreAdapterTest.java` | Tests for `markStateLocationActivated` |
| `app/core/ports/match/time_ports.py` | New `mark_state_location_activated` abstract method |
| `app/adapters/persistence/match/time_store_adapter.py` | Implements `mark_state_location_activated`; re-seed logic |
| `app/core/services/match/time_start_recovery_service.py` | Step 6a re-seed + flag check |
| `tests/test_time_start_recovery_service.py` | New re-seed and no-reseed-after-zero test cases |
| `lambda/match/handler.py` | `_apply_time_start_recovery` re-seed step + `flagAlreadyActived` guard |
| `tests/test_time_advancement_handler.py` | New re-seed and no-reseed-after-zero test cases |
| `code/tests/robot/tests/26_time_recovery/location_counter_reseed.robot` | NEW — 3 test cases |

---

# Version Control
- Versions created with AI prompt:
   ```
   step=26
   ciao read <step> on roadmap file (documentation_v0/Roadmap.md) and write a plan to realize all components. 
   projects are backend/java, robot test, aws lambda and and python project. in this plan i wanna change react-game, react-admin projects too!
   at the end use paths-games-doc to write Step<step>_xxx.md file with specific documentation agent
   let's go to develop all components
   ```

- **Document Version**: 0.26.1

   | Version | Description | Date |
   |---------|-------------|------|
   | 0.26.0 | Time Advancement & Clock Cycle: sleep action, time-end trigger (all-sleeping / all-zero-energy), clock increment + log_clock_history insert, queue recalculation reusing Step 24 TurnPriorityCalculator, GET /clock endpoint, TimeAdvanced domain event (in-process); backends only (Java / Python / AWS) + Robot suite 25_time_clock; no frontend, no new DB migration expected | June 19, 2026 |
   | 0.26.0 | ciao, i wanna create a new API on all backend project, POST admin/match/{uuid_match}/player/{uuid_player}/changeStatistics with in input dex,int,con, Energy, Life, Sad, coin, food, magic. This API updates actual values if value is not -1 and <= of max (for energy, life, sad). update the react-admin to show a button an "Players & characters" list to insert new values and send to API.  | June 19, 2026 |
   | 0.26.1 | locationsActive.idCard + seed consistency fix | June 22, 2026 |
   | 0.26.1 | Bugfix: location counter re-seed when counter_time added after match creation; `flag_already_actived` guard prevents re-seed after counter reaches zero; new Robot suite `location_counter_reseed.robot` (3 test cases); `markStateLocationActivated` added to all 3 backends | June 23, 2026 |
   | 0.26.1 | Unified `counterTime`/`counter_time` field name across all backends: Python renamed `counterStart`/`counter_start` → `counterTime`/`counter_time`; AWS renamed `counterStart` → `counterTime` (legacy `counter_time` read fallback kept for existing DynamoDB documents); Java was already correct. Robot suite `location_counter_reseed.robot` updated to send `counterTime`. No `counterStart` remains in code or seeds. Python 627 tests pass; AWS 364 tests pass; Robot --dryrun 3/3 PASS | June 23, 2026 |
   | 0.61.1 | Bugfix i18n propagation: `GET /api/match/{uuid}/info` now accepts `?lang=` (Java/Python/AWS) and propagates it to location/event/neighbour `resolveCard`; react-game `getStories(lang)`, `getStory(uuid,lang)`, `getMatchInfo(uuid,token,lang)` forward `?lang=`; callers updated (HomePage, GamePage, UserMatchesList); lang-propagation + fallback-en tests added; all suites green (react-game 386, Java core 993 + adapter-rest 188, Python 629, AWS 366) | June 23, 2026 |
   | 0.26.1 | AWS i18n bugfix (`GET /api/stories?lang=it` returning null title for imported stories): `_resolve_text` gains per-field English fallback; new `_resolve_story_text` reads title/description from `raw_texts` first (same approach as cards), then falls back to derived map; 4 new AWS unit tests (370 total); Robot regression test `Story List Lang IT Never Blanks A Title That English Has` added to `26_time_recovery/match_info_lang.robot` (383 robot tests total, all green) | June 23, 2026 |

- **Last Updated**: June 23, 2026
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
