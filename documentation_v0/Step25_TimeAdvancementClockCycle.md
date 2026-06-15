# Paths Games V0 - Step 25: Time Advancement & Clock Cycle (Backends Only)

This document describes the implementation plan for **Step 25** as requested in the Roadmap.

Step 25 introduces the **time-advancement engine**: the backend logic that fires when
all active characters in a match are done for the current clock cycle (either sleeping
or out of energy), advances the `current_clock` counter, logs the transition, rebuilds
the turn queue for the new clock, and emits a `TimeAdvanced` domain event for later
subscribers.

The relationship between adjacent steps:

- **Step 24** built the turn queue and the WAITING → ACTIVE → COMPLETED state machine.
  Step 25 consumes that queue and rebuilds it at each clock boundary, reusing
  `TurnPriorityCalculator` directly.
- **Step 25** introduces the sleep action, time-end trigger, `log_clock_history` record
  insertion, queue recalculation, the `/clock` endpoint, and the `TimeAdvanced` domain
  event. It is backends only; no frontend changes ship in this step.
- **Step 26** (frontend: clock widget, sleep button) and **Steps 27+** (per-character
  recovery math, class bonuses, location counter decrement, weather selection) hook into
  the time-start moment and the `TimeAdvanced` event introduced here.

---

## 1. Scope

Step 25 covers the following items from the Roadmap:

- Time-advancement trigger service, multi-character-ready: fires when **all** active
  characters in the match have zero energy **or** are sleeping. In a single-player match
  the list has exactly one character, so the trigger fires after the sole character
  sleeps or exhausts energy.
- `POST /api/gameplay/{uuidMatch}/action/sleep` — voluntary sleep action: sets
  `gaming_character_instance.is_sleeping = true`, then evaluates whether this triggers
  time-end for the current clock.
- On time-end: advance `gaming_match.current_clock` to the next integer and INSERT a
  row into `log_clock_history` recording the closed clock cycle.
- Recalculate `gaming_turn_queue` for all characters at the start of the new clock,
  reusing the Step 24 `TurnPriorityCalculator`. All queue rows for the new clock are
  inserted with status WAITING; the highest-priority character is immediately activated.
- `GET /api/match/{uuidMatch}/clock` — returns the current clock value, the story clock
  label (from `list_stories.id_text_clock_singular` / `id_text_clock_plural`), a
  derived day/phase indicator, and the sleeping state of each character.
- Emit a `TimeAdvanced` domain event immediately on time-end (WebSocket broadcast is
  deferred to Step 64). The event is published in-process so Steps 26, 27, and later
  can subscribe instead of being retrofitted.
- Backend unit tests: trigger logic (all-sleeping / all-zero-energy), sleep endpoint,
  clock increment + `log_clock_history` insert, queue recalculation, `/clock` endpoint,
  and event emission.

**Out of scope (Steps 26 and 27):** per-character energy/life recovery on wake, class
bonuses applied at time-start, location counter decrements, weather selection, and all
frontend changes.

---

## 2. Endpoint APIs

The OpenAPI source of truth will be created at:
`code/backend/java/adapter-rest/src/main/resources/openapi/v0.25.0-time-clock-api.yaml`

### 2.1 `POST /api/gameplay/{uuidMatch}/action/sleep`

Authenticated endpoint (player JWT, public port 8042). The calling user must own the
character whose turn is currently ACTIVE.

| HTTP status | Condition |
|-------------|-----------|
| `200` | Sleep action accepted; `SleepActionResponse` body (see §3); time-end triggered if all characters are now sleeping or have zero energy |
| `401` | Missing or invalid JWT |
| `404` | `MATCH_NOT_FOUND` — match uuid not found **or** the calling user has no character in the match (ownership masking, same pattern as Step 24) |
| `409` | `MATCH_NOT_RUNNING` — match is not in `RUNNING` status |
| `409` | `NOT_YOUR_TURN` — the active character in the queue does not belong to the calling user |
| `409` | `ALREADY_SLEEPING` — the character's `is_sleeping` flag is already `true` |

**Side effects on success:**

1. `gaming_character_instance.is_sleeping` set to `true` for the calling user's
   character.
2. Time-end check executed (see §6.2). If triggered:
   a. `gaming_match.current_clock` incremented by 1.
   b. One row inserted into `log_clock_history` for the closed clock cycle.
   c. All characters' `is_sleeping` flags reset to `false` (wake all).
   d. `gaming_turn_queue` rows for the new clock inserted, with the highest-priority
      character set ACTIVE (see §6.3).
   e. `gaming_match.id_character_current_turn` updated to the newly ACTIVE character.
   f. `TimeAdvanced` domain event emitted with `matchUuid`, `previousClock`, and
      `newClock` fields.

### 2.2 `GET /api/match/{uuidMatch}/clock`

Authenticated endpoint (player JWT, public port 8042). Any participant in the match may
call this endpoint.

| HTTP status | Condition |
|-------------|-----------|
| `200` | `ClockResponse` body (see §3) |
| `401` | Missing or invalid JWT |
| `404` | `MATCH_NOT_FOUND` — match uuid not found or caller has no character in the match |

Response includes the current clock integer, the story's clock label text, the derived
day/phase string, and a list of characters with their `isSleeping` and `energy` fields.

---

## 3. DTOs and Domain Models

### 3.1 `SleepActionResponse`

```json
{
  "matchUuid": "match-uuid-v4",
  "characterUuid": "char-uuid-v4",
  "isSleeping": true,
  "timeEndTriggered": true,
  "previousClock": 0,
  "currentClock": 1,
  "activeCharacterUuid": "char-uuid-v4"
}
```

| Field | Type | Notes |
|-------|------|-------|
| `matchUuid` | string | Public UUID of the match |
| `characterUuid` | string | The character that went to sleep |
| `isSleeping` | boolean | Always `true` in a success response |
| `timeEndTriggered` | boolean | `true` if this sleep action triggered the clock advance |
| `previousClock` | integer | The clock value before advancement; same as `currentClock` if not triggered |
| `currentClock` | integer | The match's `current_clock` after the action |
| `activeCharacterUuid` | string | The character whose turn is now ACTIVE (may change if time advanced) |

### 3.2 `ClockCharacterView` (nested in `ClockResponse`)

```json
{
  "characterUuid": "char-uuid-v4",
  "name": "Aelar the Rogue",
  "energy": 42,
  "isSleeping": false
}
```

### 3.3 `ClockResponse`

```json
{
  "matchUuid": "match-uuid-v4",
  "currentClock": 1,
  "clockLabel": "Dawn",
  "dayPhase": "DAY_1",
  "characters": [
    { "characterUuid": "...", "name": "Aelar", "energy": 42, "isSleeping": false }
  ]
}
```

| Field | Type | Notes |
|-------|------|-------|
| `matchUuid` | string | Public UUID of the match |
| `currentClock` | integer | `gaming_match.current_clock` |
| `clockLabel` | string | Derived from `list_stories.id_text_clock_singular` / `_plural`; falls back to `"Clock N"` if no text record exists |
| `dayPhase` | string | Trivial derivation from `currentClock` (see §6.4 and open-design note in §10) |
| `characters` | array | One `ClockCharacterView` per `gaming_character_instance` in the match |

### 3.4 Java REST DTOs

| DTO | File (adapter-rest) | Purpose |
|-----|---------------------|---------|
| `SleepActionResponse` | `dto/match/SleepActionResponse.java` | Response for POST action/sleep |
| `ClockCharacterView` | `dto/match/ClockCharacterView.java` | Nested character state in ClockResponse |
| `ClockResponse` | `dto/match/ClockResponse.java` | Response for GET clock |

### 3.5 Java Core Domain Models

| Model / Service | Package | Purpose |
|-----------------|---------|---------|
| `TimeAdvancementService` | `core/.../service/match/` | Orchestrates sleep, time-end trigger, clock increment, queue recalculation, event emission |
| `TimeAdvanced` | `core/.../model/match/event/` | Domain event: `matchUuid`, `previousClock`, `newClock` |
| `DomainEventPublisher` | `core/.../port/event/` | Port interface: `publish(Object event)` — in-process dispatch only (no Kafka/WebSocket yet) |
| `InProcessDomainEventPublisher` | `core/.../service/event/` | Default in-process implementation (simple list of listeners) |
| `TimeAdvancementStorePort` | `core/.../port/match/` | New port methods for sleep/clock persistence (see §7.1) |
| `ClockView` | `core/.../model/match/` | Query result: clock value, label ids, character states |
| `SleepException` | `core/.../service/match/` | Error codes: `ALREADY_SLEEPING`, `NOT_YOUR_TURN`, `MATCH_NOT_RUNNING` |

### 3.6 Python Core Models

| Item | Path | Purpose |
|------|------|---------|
| `TimeAdvancementService` | `app/core/services/match/time_advancement_service.py` | Same logic as Java |
| `TimeAdvanced` (dataclass) | `app/core/models/match/events.py` | Domain event dataclass |
| `DomainEventPublisher` | `app/core/ports/event/domain_event_publisher.py` | Port interface |
| `TimeAdvancementStorePort` | `app/core/ports/match/time_advancement_port.py` | Repository interface for new store operations |
| `ClockView` | `app/core/models/match/clock_view.py` | Dataclass for /clock query result |

### 3.7 AWS Lambda — DynamoDB additions

Clock history is stored as individual items under the match partition:

| Attribute | Value |
|-----------|-------|
| PK | `MATCH#{matchUuid}` |
| SK | `CLOCK#{clockNumber}` |
| `timestampStart` | ISO-8601 string (start of this clock cycle) |
| `timestampEnd` | ISO-8601 string (end of this clock cycle, set at time-end) |
| `idEventStart` | event id at start (nullable, for Step 27 use) |
| `idEventEnd` | event id at end (nullable) |

The match item (`SK = METADATA`) gains a `current_clock` attribute update on time-end.
Character sleep state is stored as an attribute on each `CHARACTER#{characterUuid}` item
(`is_sleeping: true/false`).

---

## 4. Roles and Authentication

Both endpoints are on the **public port (8042)** and require a valid **guest JWT** (player
role). There is no admin-port equivalent; react-admin will display the clock value
read-only from the match detail — that is a Step 26 concern.

**Ownership checks:**

- `POST .../action/sleep` — the calling user's `id_user` must match the `id_user` of the
  `gaming_character_instance` whose `id` equals `gaming_match.id_character_current_turn`.
  Return `409 NOT_YOUR_TURN` when the user is a participant but it is not their turn;
  return `404 MATCH_NOT_FOUND` when the user has no character in the match at all (same
  masking convention as Step 24).
- `GET .../clock` — caller must have at least one `gaming_character_instance` in the
  match. Read-only; `404` for non-participants.

---

## 5. Database Tables

No new Flyway migration is expected for this step. All required columns already exist
in the schema. Confirm during implementation; if anything is found missing, create
`V0.25.0` migrations in both
`adapter-sqlite/src/main/resources/db/migration/v0/` and
`adapter-postgres/src/main/resources/db/migration/v0/`.

### 5.1 `gaming_match` (relevant columns, no changes)

| Column | Type | Role in Step 25 |
|--------|------|-----------------|
| `uuid` | TEXT / UUID | Public identifier in all endpoints |
| `status` | TEXT | Must be `RUNNING`; validated before sleep action |
| `current_clock` | INTEGER DEFAULT 0 | Incremented on time-end; seed for new queue rows |
| `id_character_current_turn` | INTEGER | Updated to newly ACTIVE character after queue rebuild |
| `id_current_weather` | INTEGER | Read; not changed here (Step 27 writes this) |
| `counter_consecutive_pass` | INTEGER | Incremented if the time-end was triggered by all-pass (Step 26 input) |
| `timestamp_start` | TEXT / TIMESTAMP | Not modified in Step 25 |

### 5.2 `gaming_character_instance` (relevant columns, no changes)

| Column | Type | Role in Step 25 |
|--------|------|-----------------|
| `id` | INTEGER | FK target for `id_character_current_turn`; priority tie-breaker |
| `uuid` | TEXT / UUID | Public identifier in `/clock` response |
| `id_user` | INTEGER | Ownership check on sleep action |
| `energy` | INTEGER | Time-end trigger condition: all characters with `energy == 0` fires time-end |
| `is_sleeping` | BOOLEAN | Set to `true` by sleep action; reset to `false` on time-start (wake all) |
| `is_coma` | BOOLEAN | Read during trigger check; a character in coma counts as inactive |
| `dexterity`, `intelligence`, `constitution`, `life` | INTEGER | Read by `TurnPriorityCalculator` for queue rebuild |

### 5.3 `log_clock_history` (existing table V0.10.9, INSERT on time-end)

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER (PK part) | Auto-assigned sequence |
| `uuid` | TEXT / UUID | New UUID generated at insert time |
| `id_match` | INTEGER (PK part) | FK → `gaming_match(id)`; composite PK with `id` |
| `clock` | INTEGER | The clock value that just ended |
| `weather` | INTEGER | FK → weather table; null for Step 25 (Step 27 fills this) |
| `timestamp_start` | TEXT / TIMESTAMP | Start of this clock cycle (set when the clock opened) |
| `timestamp_end` | TEXT / TIMESTAMP | NOW() at time-end |
| `id_event_start` | INTEGER | Nullable; for Step 27 event hooks |
| `id_event_end` | INTEGER | Nullable; for Step 27 event hooks |
| `ts_insert` | TEXT / TIMESTAMP | Row creation time |
| `ts_update` | TEXT / TIMESTAMP | Last modification time |

### 5.4 `gaming_turn_queue` (reused, new rows inserted per clock)

Behaviour is identical to Step 24 queue initialisation (§6.2 of Step 24 doc). On
time-end, new rows are inserted for `current_clock` (now incremented) following the
same insert-and-activate pattern. Existing WAITING rows from the previous clock are
left with `status = COMPLETED` (or their `timestamp_end` is set) before inserting the
new batch.

### 5.5 `list_stories` (read only)

| Column | Notes |
|--------|-------|
| `id_text_clock_singular` | FK → text table; human label for a single clock unit |
| `id_text_clock_plural` | FK → text table; human label for multiple clock units |

These are looked up by the `/clock` endpoint to populate `clockLabel`. There is no
column for clocks-per-day or day/phase on `list_stories` — see open design note in §10.

---

## 6. Business Logic

### 6.1 Time-end trigger condition

Time-end fires when **all** `gaming_character_instance` rows for the match satisfy at
least one of:

- `energy == 0`, **or**
- `is_sleeping == true`, **or**
- `is_coma == true`

For single-player (one character), the trigger fires as soon as the sole character
sleeps or reaches zero energy. The service must evaluate this condition after every
sleep action and (for completeness) after every energy-drain event that the Step 24
pass action might trigger in future steps.

### 6.2 Sleep action flow (`POST .../action/sleep`)

1. Validate match exists and caller has a character (→ `404 MATCH_NOT_FOUND`).
2. Validate `status == RUNNING` (→ `409 MATCH_NOT_RUNNING`).
3. Check that the active character belongs to the caller (→ `409 NOT_YOUR_TURN`).
4. Check `is_sleeping` is not already `true` (→ `409 ALREADY_SLEEPING`).
5. Set `gaming_character_instance.is_sleeping = true`.
6. Evaluate time-end condition (§6.1).
7. If **not** triggered: return `SleepActionResponse` with `timeEndTriggered = false`.
8. If **triggered**: execute time-advancement sequence (§6.3).
9. Return `SleepActionResponse` with `timeEndTriggered = true`, updated `currentClock`,
   and new `activeCharacterUuid`.

### 6.3 Time-advancement sequence (called on time-end)

1. Record `previousClock = gaming_match.current_clock`.
2. Compute `newClock = previousClock + 1`.
3. Mark any still-WAITING or ACTIVE turn queue rows for `previousClock` as COMPLETED
   (set `timestamp_end = NOW()` on rows lacking it).
4. INSERT one row into `log_clock_history`:
   - `clock = previousClock`
   - `timestamp_start` = the `timestamp_start` of the match (or the `timestamp_end` of
     the previous `log_clock_history` row if one exists)
   - `timestamp_end = NOW()`
   - All nullable columns (`weather`, `id_event_start`, `id_event_end`) left null.
5. Wake all characters: set `is_sleeping = false` for all `gaming_character_instance`
   rows of the match (`is_coma` is NOT reset here).
6. Update `gaming_match.current_clock = newClock`.
7. Rebuild turn queue for `newClock`:
   a. Load all `gaming_character_instance` rows (excluding those in coma if applicable).
   b. Compute priority using `TurnPriorityCalculator` (same formula as Step 24;
      stats are re-read so updated values take effect in Step 26+).
   c. INSERT one `gaming_turn_queue` row per character with `clock = newClock`,
      `status = WAITING`, `timestamp_start = null`, `timestamp_end = null`,
      `pass_counter = 0`.
   d. Activate the highest-priority character: set its row's `timestamp_start = NOW()`.
   e. Update `gaming_match.id_character_current_turn` to that character's `id`.
8. Publish `TimeAdvanced` domain event with `matchUuid`, `previousClock`, `newClock`.

### 6.4 Clock label and day/phase derivation (`GET .../clock`)

1. Validate match and caller participation (→ `404`).
2. Load `gaming_match.current_clock` and the story's `id_text_clock_singular` /
   `id_text_clock_plural` text ids. Resolve to the locale string (or fall back to
   `"Clock N"` if no record).
3. Derive `dayPhase` as a trivial function of `current_clock`:
   - This is a **provisional** derivation; the schema does not yet have a
     `clocks_per_day` configuration field on `list_stories`. See §10 for the open
     design decision. For now, return `"DAY_1"` (or a similar constant) unless the
     implementation team chooses a specific integer-division rule.
4. Load all `gaming_character_instance` rows for the match.
5. Build `ClockResponse` with the character array.

### 6.5 `TimeAdvanced` domain event — in-process dispatch

The `DomainEventPublisher` port has a single method:

```java
void publish(Object event);
```

The default `InProcessDomainEventPublisher` maintains an in-memory list of typed
listeners registered at startup. `TimeAdvancementService` injects this port and calls
`publish(new TimeAdvanced(matchUuid, previousClock, newClock))` as the last step of
§6.3. No Kafka topic, no WebSocket frame — those are Step 64 concerns. Future step
services register as listeners via the port's `register` method.

---

## 7. Per-Project Implementation Plan

### 7.1 Java (reference implementation)

**Core module (`core/src/main/java/.../`)**

- [ ] `model/match/event/TimeAdvanced.java` — record/value object: `matchUuid`, `previousClock`, `newClock`
- [ ] `port/event/DomainEventPublisher.java` — single-method port interface
- [ ] `service/event/InProcessDomainEventPublisher.java` — default listener-list implementation
- [ ] `port/match/TimeAdvancementStorePort.java` — new port methods:
  - `setCharacterSleeping(long idCharacter, boolean sleeping)`
  - `wakeAllCharacters(long idMatch)`
  - `getCharacterStatesForMatch(long idMatch)` → `List<CharacterStateView>`
  - `incrementMatchClock(long idMatch)` → `int newClock`
  - `insertClockHistory(long idMatch, int clock, Instant start, Instant end)`
  - `completeRemainingQueueRows(long idMatch, int clock, Instant now)`
  - `getClockView(long idMatch)` → `ClockView`
- [ ] Extend `TurnCycleStorePort.CharacterTurnView` in
  `core/src/main/java/games/paths/core/port/match/TurnCycleStorePort.java`
  to include `energy` and `isSleeping` fields (needed by the trigger check and by the
  priority recalculation).
- [ ] `service/match/TimeAdvancementService.java` — constructor-injected ports; reuses
  `TurnPriorityCalculator` from Step 24 for queue rebuild (§6.3 step 7b).
- [ ] `model/match/ClockView.java` — domain model for `/clock` query result
- [ ] `service/match/SleepException.java` — error codes: `ALREADY_SLEEPING`,
  `NOT_YOUR_TURN`, `MATCH_NOT_RUNNING`

**Adapter-sqlite / adapter-postgres**

- [ ] Implement `TimeAdvancementStorePort` in `TurnCycleStoreAdapter` (or a sibling
  `TimeAdvancementStoreAdapter`) — SQL for each port method above.
- [ ] Verify `TurnCycleStoreAdapter.findCharactersByMatchId` projection includes `energy`
  and `is_sleeping`; add columns to the SELECT if missing.

**Adapter-rest**

- [ ] `dto/match/SleepActionResponse.java`
- [ ] `dto/match/ClockCharacterView.java`
- [ ] `dto/match/ClockResponse.java`
- [ ] `TimeClockController.java`:
  - `POST /api/gameplay/{uuidMatch}/action/sleep`
  - `GET /api/match/{uuidMatch}/clock`
- [ ] OpenAPI spec `v0.25.0-time-clock-api.yaml`

**Unit tests (`core/src/test/.../service/match/`)**

- [ ] `TimeAdvancementServiceTest`:
  - `TriggerCondition` nested: all-sleeping triggers time-end; all-zero-energy triggers
    time-end; mixed sleeping+zero-energy triggers; one character still awake+energy
    does NOT trigger; coma character counts as inactive
  - `SleepAction` nested: sets `is_sleeping`; returns `timeEndTriggered = false` when
    not all done; returns `timeEndTriggered = true` with new clock when triggered;
    `ALREADY_SLEEPING`; `NOT_YOUR_TURN`; `MATCH_NOT_RUNNING`
  - `TimeAdvancement` nested: `current_clock` incremented; `log_clock_history` INSERT
    called with correct fields; `wakeAllCharacters` called; queue rebuilt with all WAITING
    then top ACTIVE; `TimeAdvanced` event emitted exactly once
  - `ClockEndpoint` nested: correct `clockLabel` lookup; `dayPhase` derivation;
    character sleeping states present in response

### 7.2 Python backend (`code/backend/python/`)

Mirror the Java structure:

- [ ] `app/core/models/match/events.py` — `@dataclass TimeAdvanced(match_uuid, previous_clock, new_clock)`
- [ ] `app/core/ports/event/domain_event_publisher.py` — abstract base class
- [ ] `app/core/services/event/in_process_publisher.py` — listener-list implementation
- [ ] `app/core/ports/match/time_advancement_port.py` — abstract port with same methods as §7.1
- [ ] `app/core/models/match/clock_view.py` — `@dataclass ClockView`
- [ ] `app/core/services/match/time_advancement_service.py` — imports and reuses
  `TurnPriorityCalculator` from `turn_priority_calculator.py` (Step 24)
- [ ] `app/adapters/persistence/match/time_advancement_repository.py` — SQLAlchemy / raw
  SQL implementing the port; extend `turn_cycle_store_adapter.py` SQL projection to
  include `energy` and `is_sleeping`
- [ ] `app/adapters/rest/match/time_clock_controller.py` — two FastAPI routes; JSON
  responses in camelCase via the same `to_camel` helper used in `turn_cycle_controller.py`
- [ ] Wire new controller and publisher in `app/launcher.py`
- [ ] `tests/match/test_time_advancement_service.py` — pytest covering same scenarios as Java unit tests
- [ ] `tests/match/test_time_clock_controller.py` — FastAPI TestClient covering 200/401/404/409 codes

### 7.3 AWS Lambda (`code/backend/aws/`)

- [ ] `lambda/match/handler.py` — add two handler functions:
  - `sleep_action(event, context)` — sets `is_sleeping` on the character item; evaluates
    trigger; calls `time_advancement(match_uuid)` if triggered
  - `get_clock(event, context)` — queries match item + character items for sleeping state
  - `time_advancement(match_uuid)` — shared helper: increments clock, inserts
    `CLOCK#{n}` item, wakes characters, rebuilds turn queue (reusing the existing
    `build_turn_queue` helper from the Step 24 handler), publishes `TimeAdvanced`
    in-process record (Lambda-local dict/list; no SNS/EventBridge yet)
- [ ] DynamoDB item additions:
  - `CLOCK#{clockNumber}` item per `MATCH#{uuid}` partition (schema in §3.7)
  - `is_sleeping` attribute on each `CHARACTER#{uuid}` item (already in design;
    confirm attribute name matches the character join handler from Step 21)
- [ ] `template/match.yaml` — add two SAM routes:
  - `POST /api/gameplay/{uuidMatch}/action/sleep` → `SleepActionFunction`
  - `GET /api/match/{uuidMatch}/clock` → `GetClockFunction`
  (follow the naming pattern of `StartMatchRoute`, `PassTurnRoute`,
  `GetTurnSequenceRoute` from the Step 24 template additions)
- [ ] `tests/match/test_time_clock_handler.py` — pytest with `moto` mocking:
  trigger condition scenarios; clock item created; character `is_sleeping` reset;
  `current_clock` incremented on match item; turn queue rebuilt

---

## 8. Testing Strategy

### 8.1 Unit tests

| Backend | Target file(s) | Key scenarios |
|---------|----------------|---------------|
| Java | `TimeAdvancementServiceTest` | All-sleeping trigger; all-zero-energy trigger; mixed; one awake suppresses; coma counts; `ALREADY_SLEEPING`; clock increment; log insert; wake all; queue rebuild (WAITING then top ACTIVE); event emitted once |
| Python | `test_time_advancement_service.py` | Same scenarios with mock port |
| Python | `test_time_clock_controller.py` | 200/401/404/409 HTTP codes via FastAPI TestClient |
| AWS | `test_time_clock_handler.py` | DynamoDB state before/after with `moto`; `CLOCK#{n}` item created; character `is_sleeping` reset; turn queue rebuilt |

Run commands:

```bash
# Java
cd code/backend/java && mvn clean test

# Python
cd code/backend/python && source .venv/bin/activate && pytest tests

# AWS
cd code/backend/aws && source .venv/bin/activate && pytest tests
```

### 8.2 Robot Framework E2E suite

Suite: `code/tests/robot/tests/25_time_clock/time_clock.robot`

New keywords (in `code/tests/robot/resources/matches.resource` or a new
`time_clock.resource`):

- `Sleep Action` — POST `.../action/sleep`; asserts 200 and returns body
- `Get Clock` — GET `.../clock`; asserts 200 and returns body
- `Should Have Clock` — asserts `currentClock` equals expected integer

#### Test cases

| Test case | Assertions |
|-----------|------------|
| Sleep action sets character sleeping | `isSleeping == true` in response; `timeEndTriggered == false` if energy > 0 after sleep (multi-char scenario) |
| Single-player sleep triggers time-end | `timeEndTriggered == true`; `currentClock` incremented by 1 |
| Clock endpoint reflects new clock | GET /clock returns `currentClock == 1` after time-end; `characters[0].isSleeping == false` (woken) |
| Turn queue rebuilt after time-end | GET /turn-sequence (Step 24 endpoint) shows all WAITING then top ACTIVE for new clock |
| Pass then sleep in same clock triggers time-end | Combined pass+sleep scenario forces time-end in a single-player match |
| 409 ALREADY_SLEEPING on double sleep | Second sleep on same character returns `409 ALREADY_SLEEPING` |
| 409 NOT_YOUR_TURN on wrong player | Sleep by user who is not the active character returns `409 NOT_YOUR_TURN` |
| 409 MATCH_NOT_RUNNING on sleep before start | Sleep on a CREATED match returns `409 MATCH_NOT_RUNNING` |
| 404 for non-participant | GET /clock for unknown uuid returns `404` |

**Seed prerequisites per backend:**

| Backend | Seed mechanism |
|---------|----------------|
| Java / SQLite | `R__insert_story_seed_data.sql` in `adapter-sqlite/src/main/resources/db/migration/` |
| Java / PostgreSQL | `R__insert_dev_test_data.sql` in `adapter-postgres/.../db/migration/dev/` |
| Python | `code/backend/python/scripts/seed_stories.py` |
| AWS | `seed/handler.py` |

The suite reuses the match creation, guest auth, character join, and trait selection
flow established in suites 12, 19, 21, and 23. A started match (Step 24 start endpoint)
is a prerequisite for all sleep/clock test cases.

---

## 9. API Changes Summary

| Endpoint | Status |
|----------|--------|
| `POST /api/gameplay/{uuidMatch}/action/sleep` | NEW (v0.25.0) |
| `GET /api/match/{uuidMatch}/clock` | NEW (v0.25.0) |

No existing endpoints are modified. The Step 24 `POST .../action/pass` and
`GET .../turn-sequence` endpoints are called by the Robot suite as setup steps but are
not changed.

---

## 10. Notes and Open Questions

1. **Day/phase model is deferred.** `list_stories` has `id_text_clock_singular` and
   `id_text_clock_plural` for the label of a time unit, but there is **no column** for
   `clocks_per_day`, `clocks_per_phase`, or any day↔night cycle configuration. The
   `/clock` endpoint therefore cannot derive a meaningful `DAY_1 / NIGHT_1` breakdown
   from the schema alone. For Step 25, `dayPhase` SHOULD be returned as a simple string
   derived from `currentClock % N` where `N` is a hardcoded constant (e.g., 2 for a
   day/night split, or 4 for a four-phase model) **or** omitted entirely and
   marked `null`. The real implementation requires a new story-config field — that work
   is deferred to a future step. Document the choice in code comments and in the OpenAPI
   spec deprecation note.

2. **`log_clock_history.timestamp_start` source.** The `timestamp_start` column on a
   new clock-history row should ideally be the moment the previous clock began (i.e.,
   `timestamp_end` of the preceding row, or `gaming_match.timestamp_start` for the
   first clock). If no prior row exists, fall back to `gaming_match.timestamp_start`.
   Implementors should confirm this is accessible via the store port without an extra
   round-trip.

3. **Coma characters and the trigger.** A character in coma (`is_coma = true`) should
   be counted as inactive for the trigger condition — the time-end must not be blocked
   by a character who is physically unable to act. Confirm coma handling in
   `gaming_character_instance` semantics with the Step 21/23 design before
   implementation.

4. **Energy drain and auto-trigger.** Future steps (e.g., action endpoints that consume
   energy) should call into `TimeAdvancementService.evaluateTimeEnd(matchUuid)` after
   any energy modification. Step 25 only wires this call from the sleep action; other
   callers are deferred.

5. **`TimeAdvanced` event consumers in future steps.** Steps 26 (recovery math), 27
   (weather selection), and others will register listeners on `DomainEventPublisher`.
   The port's `register` or `subscribe` method signature should be established now to
   avoid retrofits. Suggested Java signature:
   `void subscribe(Class<T> eventType, Consumer<T> listener)`.

6. **Admin-port exposure of `/clock`.** The GET /api/match/{uuidMatch}/clock endpoint
   may optionally be mirrored on port 8044 as `/api/admin/matches/{uuid}/clock` to
   allow the react-admin console to read the current clock without cross-port calls.
   Decide at Step 26 implementation time.

---

## 11. Cross-Step Relationship

```
Step 23  ──►  Step 24  ──►  Step 25  ──►  Step 26  ──►  Step 27
             (queue +         (sleep,         (frontend     (weather
              turn state)      time-end,        clock        selection,
                               clock log,       widget)      recovery)
                               queue rebuild,
                               TimeAdvanced)
```

- **Step 24** is a hard prerequisite: the turn queue (`gaming_turn_queue`), the
  WAITING/ACTIVE/COMPLETED state machine, and `TurnPriorityCalculator` must all be
  in place before Step 25 can rebuild the queue at clock boundaries.
- **Step 25** introduces `TimeAdvanced` as a domain event so Steps 26, 27, and later
  attach recovery/weather/counter logic by subscription rather than by modifying the
  `TimeAdvancementService` directly.
- **Steps 26 and 27** consume the `TimeAdvanced` event and extend the time-start
  moment with per-character stat recovery and weather selection. Neither is implemented
  in this step.

---

# Version Control

- **Document Version**: 0.25.0

    | Version | Description | Date |
    |---------|-------------|------|
    | 0.25.0 | Time Advancement & Clock Cycle: sleep action, time-end trigger (all-sleeping / all-zero-energy), clock increment + log_clock_history insert, queue recalculation reusing Step 24 TurnPriorityCalculator, GET /clock endpoint, TimeAdvanced domain event (in-process); backends only (Java / Python / AWS) + Robot suite 25_time_clock; no frontend, no new DB migration expected | June 15, 2026 |

- **Last Updated**: June 15, 2026
- **Status**: PLANNED



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
