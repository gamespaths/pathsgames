# Paths Games V0 - Step 25: Time Advancement & Clock Cycle (Backends Only)

This document describes the implementation plan for **Step 25** as requested in the Roadmap.

Step 25 introduces the **time-advancement engine**: the backend logic that fires when
all active characters in a match are done for the current clock cycle (either sleeping
or out of energy), advances the `current_clock` counter, logs the transition, rebuilds
the turn queue for the new clock, and emits a `TimeAdvanced` domain event for later
subscribers.

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
  "clockLabelSingular": "Dawn",
  "clockLabelPlural": "Dawns",
  "anyCharacterSleeping": false,
  "characters": [
    { "characterUuid": "...", "energy": 42, "isSleeping": false }
  ]
}
```

> **Note:** the original plan used `clockLabel` (single field) and `dayPhase`. The shipped
> implementation splits the label into `clockLabelSingular` / `clockLabelPlural` and
> removes `dayPhase` entirely (deferred — see §10). Per-character `name` is also absent
> from this payload; the frontend resolves names from the match detail endpoint.

| Field | Type | Notes |
|-------|------|-------|
| `matchUuid` | string | Public UUID of the match |
| `currentClock` | integer | `gaming_match.current_clock` |
| `clockLabelSingular` | string | Human label for a single clock unit; resolved from `list_stories.id_text_clock_singular` → `list_texts`; `null` if no text record |
| `clockLabelPlural` | string | Human label for multiple clock units; resolved from `list_stories.id_text_clock_plural` → `list_texts`; `null` if no text record |
| `anyCharacterSleeping` | boolean | Convenience aggregate over the `characters` array |
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

### 6.4 Clock label resolution (`GET .../clock`)

1. Validate match and caller participation (→ `404`).
2. Load `gaming_match.current_clock`.
3. Resolve the story's clock labels — **language is always fixed to `"en"`** (no per-user
   locale at this endpoint):
   - `list_stories.id_text_clock_singular` → look up `list_texts` row for `lang = "en"`;
     expose as `clockLabelSingular`. Return `null` if the text row does not exist.
   - `list_stories.id_text_clock_plural` → same lookup; expose as `clockLabelPlural`.
   - Java: `TurnCycleStoreAdapter.findStoryClockLabels(idMatch, lang)` (constant
     `DEFAULT_LANG = "en"`). Python: `time_store_adapter.find_story_clock_labels(...)`,
     same constant. AWS: see §6.4.1 below.
4. Load all `gaming_character_instance` rows for the match.
5. Build `ClockResponse` (no `dayPhase` field — deferred; see §10 note 1).

#### 6.4.1 AWS clock label resolution

The AWS Lambda backend uses a different lookup path because DynamoDB does not have a
relational JOIN:

- **Preferred path**: read `clockSingularDescription` / `clockPluralDescription`
  attributes directly off the persisted `STORY#` item (`SK = METADATA`). These are
  written at story import time (see §7.3 fix below).
- **Fallback path**: if either attribute is absent or null on the STORY item (legacy
  items created before the fix), resolve at runtime from the story's `texts` map:
  `texts["en"][clockSingular|clockPlural]`.
- **Helper**: `_story_clock_label(story, direct_key, text_field, lang='en')` in
  `code/backend/aws/lambda/match/handler.py` encapsulates this two-step lookup.
- The language used by this path is always `"en"`, consistent with Java and Python.

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

- [x] `lambda/match/handler.py` — two handler functions implemented:
  - `sleep_action(event, context)` — sets `is_sleeping` on the character item; evaluates
    trigger; calls `time_advancement(match_uuid)` if triggered
  - `get_clock(event, context)` — queries match item + character items for sleeping state;
    uses `_story_clock_label(...)` helper for clock label resolution (see §6.4.1)
  - `time_advancement(match_uuid)` — shared helper: increments clock, inserts
    `CLOCK#{n}` item, wakes characters, rebuilds turn queue (reusing the existing
    `build_turn_queue` helper from the Step 24 handler), publishes `TimeAdvanced`
    in-process record (Lambda-local dict/list; no SNS/EventBridge yet)
- [x] DynamoDB item additions:
  - `CLOCK#{clockNumber}` item per `MATCH#{uuid}` partition (schema in §3.7)
  - `is_sleeping` attribute on each `CHARACTER#{uuid}` item
- [x] `template/match.yaml` — two SAM routes added:
  - `POST /api/gameplay/{uuidMatch}/action/sleep` → `SleepActionFunction`
  - `GET /api/match/{uuidMatch}/clock` → `GetClockFunction`

**Clock label bug fix (applied post-v0.25.0):**

A bug existed for imported (non-seed) stories. `_get_clock` read
`clockSingularDescription` / `clockPluralDescription` from the persisted STORY item, but
the story import handler only stored `idTextClockSingular` / `idTextClockPlural` and the
raw `texts` map — not the resolved descriptions. As a result, imported stories returned
`null` clock labels while the seed story (which explicitly wrote the descriptions) worked
correctly.

Two fixes were applied:

1. **`lambda/match/handler.py`**: `_get_clock` now calls the helper
   `_story_clock_label(story, direct_key, text_field, lang='en')` which:
   - First returns the already-persisted description if present (covers the seed and
     post-fix imports).
   - Otherwise falls back to `story["texts"][lang][text_field]` at runtime (covers
     legacy items that lack the description attribute).

2. **`lambda/story/handler.py`**: the story import handler now writes
   `clockSingularDescription` and `clockPluralDescription` (resolved for `lang="en"`) on
   the STORY item at import time, matching the seed behaviour and ensuring that any newly
   imported story will use the preferred path.

These fixes ensure full parity between the seed and import paths, and between the AWS
backend and the Java/Python implementations.

---

## 8. Testing Strategy

### 8.1 Unit tests

| Backend | Target file(s) | Key scenarios |
|---------|----------------|---------------|
| Java | `TimeAdvancementServiceTest` | All-sleeping trigger; all-zero-energy trigger; mixed; one awake suppresses; coma counts; `ALREADY_SLEEPING`; clock increment; log insert; wake all; queue rebuild (WAITING then top ACTIVE); event emitted once |
| Python | `test_time_advancement_service.py` | Same scenarios with mock port |
| Python | `test_time_clock_controller.py` | 200/401/404/409 HTTP codes via FastAPI TestClient |
| AWS | `test_time_advancement_handler.py` | DynamoDB state before/after with `moto`; `CLOCK#{n}` item created; character `is_sleeping` reset; turn queue rebuilt; clock label resolution scenarios (see below) |

**AWS clock label test cases** (in `code/backend/aws/tests/test_time_advancement_handler.py`):

| Test | Assertion |
|------|-----------|
| `test_clock_resolves_labels_from_texts_when_descriptions_absent` | When a STORY item has no `clockSingularDescription` / `clockPluralDescription` attributes but has a populated `texts["en"]` map, `_story_clock_label(...)` resolves the correct label from the texts map |
| `test_clock_labels_null_when_story_has_no_clock_data` | When neither direct attributes nor texts entries exist, the helper returns `null` without raising an exception |

Total AWS pytest suite after these additions: **71 tests pass**.

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
| Clock Labels Are Saved And Retrieved From Story | `GET /clock` returns `clockLabelSingular` and `clockLabelPlural` that are both non-null and non-empty; backend-agnostic (runs against any backend) |

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

2. **Clock labels are not localised per user.** All three backends (Java, Python, AWS)
   resolve clock labels in English only (`DEFAULT_LANG = "en"`). The `GET /clock`
   endpoint does not accept a `lang` query parameter, and `getMatchClock` in the
   frontend does not pass one. If per-locale labels are needed in a future step, the
   `TurnCycleStorePort` / `time_store_adapter` lookup and the DynamoDB texts map
   resolution would each need a language parameter.

3. **`log_clock_history.timestamp_start` source.** The `timestamp_start` column on a
   new clock-history row should ideally be the moment the previous clock began (i.e.,
   `timestamp_end` of the preceding row, or `gaming_match.timestamp_start` for the
   first clock). If no prior row exists, fall back to `gaming_match.timestamp_start`.
   Implementors should confirm this is accessible via the store port without an extra
   round-trip.

4. **Coma characters and the trigger.** A character in coma (`is_coma = true`) should
   be counted as inactive for the trigger condition — the time-end must not be blocked
   by a character who is physically unable to act. Confirm coma handling in
   `gaming_character_instance` semantics with the Step 21/23 design before
   implementation.

5. **Energy drain and auto-trigger.** Future steps (e.g., action endpoints that consume
   energy) should call into `TimeAdvancementService.evaluateTimeEnd(matchUuid)` after
   any energy modification. Step 25 only wires this call from the sleep action; other
   callers are deferred.

6. **`TimeAdvanced` event consumers in future steps.** Steps 26 (recovery math), 27
   (weather selection), and others will register listeners on `DomainEventPublisher`.
   The port's `register` or `subscribe` method signature should be established now to
   avoid retrofits. Suggested Java signature:
   `void subscribe(Class<T> eventType, Consumer<T> listener)`.

7. **Admin-port exposure of `/clock`.** The GET /api/match/{uuidMatch}/clock endpoint
   may optionally be mirrored on port 8044 as `/api/admin/matches/{uuid}/clock` to
   allow the react-admin console to read the current clock without cross-port calls.
   Decide at Step 26 implementation time.



# Paths Games V0 - Step 25: Time Advancement & Clock Cycle (Frontend)

This document describes the frontend implementation for **Step 25** as described in the Roadmap.
Step 25 delivered the backends (sleep action, time-end trigger, clock endpoint). Step 26 delivers:

- A **ClockWidget** and **SleepButton** in `react-game`, wired into the `GameBook` and `GameBookMobile` views.
- A read-only **Clock status panel** in `react-admin`'s `MatchDetailPage`.
- A new **admin backend endpoint** `GET /api/admin/matches/{uuidMatch}/clock` (port 8044) that the admin panel consumes without an ownership check.

---

## 1. Scope

| Item | Delivered in |
|------|-------------|
| `ClockWidget.jsx` — read-only clock number + story label + sleeping badge | react-game |
| `SleepButton.jsx` — sleep action with confirm modal; surfaces 409 errors | react-game |
| `getMatchClock` + `sleepCharacter` in `api/matches.js` | react-game |
| `GameBook.jsx` / `GameBookMobile.jsx` integration | react-game |
| `game.clock.*` / `game.sleep.*` i18n keys (en.json + it.json) | react-game |
| `.clock-widget` / `.sleep-*` CSS in `main.css` | react-game |
| `ClockWidget.test.jsx` + `SleepButton.test.jsx` + updated `GameBook.test.jsx` | react-game |
| `getMatchClock(uuid)` → `GET /api/admin/matches/{uuid}/clock` in `api/matchApi.js` | react-admin |
| Clock status pg-card in `MatchDetailPage.jsx` | react-admin |
| Updated `MatchDetailPage.test.jsx` (mock + graceful failure) | react-admin |
| `GET /api/admin/matches/{uuidMatch}/clock` endpoint | Java backend (adapter-admin) |
| `TimeAdvancementPort.clockForAdmin(String matchUuid)` + shared `buildClock(...)` | Java backend (core) |

**Out of scope** (Steps 27+): per-character stat recovery on wake, class bonuses at time-start,
location counter decrements, weather selection, "new time" recap panel.

---

## 2. New Admin Backend Endpoint

### `GET /api/admin/matches/{uuidMatch}/clock`

- **Port**: 8044 (admin port only)
- **Auth**: admin token (same as all other `adapter-admin` endpoints)
- **Controller**: `MatchAdminController` — injects `TimeAdvancementPort`
- **Port method**: `TimeAdvancementPort.clockForAdmin(String matchUuid)`
  - No participant ownership check (admin may read any match's clock)
  - Throws only `MATCH_NOT_FOUND`
  - Reuses the private `buildClock(...)` helper shared with `clock(matchUuid, userUuid)`

| HTTP status | Condition |
|-------------|-----------|
| `200` | `ClockResponse` body |
| `400` | Blank / null `uuidMatch` |
| `401` | Missing or invalid admin token |
| `404` | `MATCH_NOT_FOUND` |

---

## 3. Shipped DTO Field Names

The canonical field names as deployed (some differ from the Step 25 planning doc §3):

### `ClockResponse`

```json
{
  "matchUuid": "match-uuid-v4",
  "currentClock": 2,
  "clockLabelSingular": "Dawn",
  "clockLabelPlural": "Dawns",
  "anyCharacterSleeping": false,
  "characters": [
    { "characterUuid": "char-uuid-v4", "isSleeping": false, "energy": 42 }
  ]
}
```

| Field | Notes |
|-------|-------|
| `clockLabelSingular` | From `list_stories.id_text_clock_singular`; null if no text record |
| `clockLabelPlural` | From `list_stories.id_text_clock_plural`; null if no text record |
| `anyCharacterSleeping` | Convenience aggregate; no per-character `name` in this payload |

The frontend resolves character names by cross-referencing the `players` list returned by the match detail endpoint.

### `SleepActionResponse`

```json
{
  "matchUuid": "match-uuid-v4",
  "characterUuid": "char-uuid-v4",
  "isSleeping": true,
  "timeEndTriggered": true,
  "currentClock": 2
}
```

Fields **not** present (removed from plan): `previousClock`, `activeCharacterUuid`, `dayPhase`, per-character `name`.

---

## 4. React-Game Components

### 4.1 `ClockWidget.jsx` (`src/features/gameplay/ClockWidget.jsx`)

Read-only presentational component. Receives a `clock` prop (the `ClockResponse` object).

- Renders the clock number and story label: uses `clock.clockLabelSingular` when
  `currentClock === 1`, `clock.clockLabelPlural` otherwise.
- Falls back to `t('game.clock.fallback')` (e.g. "Clock 2") when both label fields are
  null or absent (story has no text record for the clock).
- The sleeping badge is rendered with `title={clock?.clockLabelSingular ?? t('game.clock.title')}`
  as a tooltip, providing the singular clock label as hover text (falls back to the
  generic i18n key when the label is absent).
- Shows an `anyCharacterSleeping` badge when at least one character is sleeping.
- No day/night indicator (no `dayPhase` in the backend response; deferred to a future step).
- CSS class: `.clock-widget`.

### 4.2 `SleepButton.jsx` (`src/features/gameplay/SleepButton.jsx`)

Action button + confirm modal component.

Props:

| Prop | Type | Purpose |
|------|------|---------|
| `matchUuid` | string | Passed to the sleep API call |
| `accessToken` | string | Guest JWT for the API call |
| `disabled` | boolean | Set when character is already sleeping (avoids the 409 round-trip) |
| `onSlept` | function | Called with the `SleepActionResponse` after a successful sleep |

Behaviour:

1. Clicking the button opens a medieval-themed confirm modal (controlled by React state, reuses `.modal-content` look).
2. On confirm, calls `sleepCharacter(matchUuid, accessToken)` → `POST /api/gameplay/{uuid}/action/sleep`.
3. On success, closes the modal and calls `onSlept(result)`.
4. On 409 error (`ALREADY_SLEEPING` / `NOT_YOUR_TURN` / `MATCH_NOT_RUNNING`), surfaces the error inline inside the modal.

### 4.3 `api/matches.js` additions

```js
getMatchClock(uuid, token)  // GET /api/match/{uuid}/clock
sleepCharacter(uuid, token) // POST /api/gameplay/{uuid}/action/sleep
```

Both include mock fallbacks for offline/dev mode.

### 4.4 `GameBook.jsx` integration

- `clock` state, fetched on mount and after every successful `onSlept` callback.
- `<ClockWidget clock={clock} />` rendered in the book view.
- `<SleepButton matchUuid={...} accessToken={...} disabled={anyCharacterSleeping} onSlept={refreshClock} />` in the action row.
- Same wiring applied to `GameBookMobile.jsx`.

### 4.5 i18n keys added

In `src/i18n/en.json` and `src/i18n/it.json`:

```
game.clock.title       — section header ("Clock")
game.clock.fallback    — fallback label ("Clock {n}")
game.sleep.action      — button label ("Sleep")
game.sleep.sleeping    — sleeping badge label ("Sleeping")
game.sleep.confirmTitle — modal title
game.sleep.confirmBody  — modal body text
game.sleep.confirm     — confirm button
game.sleep.cancel      — cancel button
```

---

## 5. React-Admin Changes

### 5.1 `api/matchApi.js`

```js
export const getMatchClock = (uuid) =>
  apiClient().get(`/api/admin/matches/${uuid}/clock`).then(r => r.data)
```

### 5.2 `MatchDetailPage.jsx` — Clock status panel

A new read-only `pg-card` section titled "Clock status" is shown below the existing match configuration card when the clock data is available:

- **Current clock** row: `currentClock` plus the resolved story label (singular at 1, plural otherwise; blank when story has no label text).
- **Any sleeping** row: "Yes" / "No".
- **Per-character table**: `characterUuid` resolved to a player name via the `players` list already loaded on the page; columns for energy and sleeping state.

The panel is **silently hidden** if `getMatchClock` fails (e.g. older backends without the endpoint). This ensures backward compatibility.

---

## 6. Tests

| File | Scope |
|------|-------|
| `src/test/ClockWidget.test.jsx` | Renders clock number; singular/plural label; fallback; sleeping badge; null clock returns null |
| `src/test/SleepButton.test.jsx` | Button renders; confirm modal opens/closes; calls sleepCharacter on confirm; surfaces 409 error; disabled prop respected |
| `src/test/GameBook.test.jsx` | Updated mocks for `getMatchClock` and `sleepCharacter`; ClockWidget and SleepButton present |
| `react-admin/src/tests/pages/MatchDetailPage.test.jsx` | Mocks `getMatchClock`; asserts "Clock status" panel renders; asserts graceful absence when endpoint fails |

All 283 react-admin suite tests pass. react-game targeted tests pass.

---

## 7. API Changes Summary

| Endpoint | Status |
|----------|--------|
| `GET /api/admin/matches/{uuidMatch}/clock` | NEW (v0.26.0) — admin port 8044 |
| `GET /api/match/{uuidMatch}/clock` | Unchanged (v0.25.0) — public port 8042 |
| `POST /api/gameplay/{uuidMatch}/action/sleep` | Unchanged (v0.25.0) — public port 8042 |

---

## 8. Cross-Step Relationship

```
Step 25  ──►  Step 26  ──►  Step 27
(sleep,        (clock         (weather
 time-end,      widget,        selection,
 /clock,        sleep btn,     per-char
 TimeAdvanced)  admin panel)   recovery)
```


# Paths Games V0 - Step 25: Character Max Stats, Carried Weight & Items on Match Info

This document describes the implementation of **Step 25** as requested in the Roadmap.

Step 25 enriches every player/character object returned by the match-info family of
endpoints with three categories of data that were previously absent:

- **Maximum statistics** (`lifeMax`, `energyMax`, `sadMax`, `weightMax`) — computed once
  at join time using the same additive formula as the starting values and persisted on the
  `gaming_character_instance` row, because the class id is not retained there and cannot
  be re-derived on read.
- **Current carried weight** (`weight`) — the sum of `item.weight × amount` over all rows
  in `gaming_inventory_items` for the character (0 when the inventory is empty).
- **Item list** (`items[]`) — a list of carried-item objects with enough detail for the
  game frontend to display the backpack.

---

## 1. Scope

Step covers:

- New Flyway migrations (`V0.25.2`) adding four columns to `gaming_character_instance`
  in both the SQLite and PostgreSQL adapters.
- A new `gaming_inventory_items` entity and repository (Java / Python) for reading the
  character's current inventory.
- `CharacterCommandService` extended to compute and persist the four max-stat values
  immediately after the existing stat initialisation at join time.
- `CharacterReadPort` / `CharacterQueryService` extended to load inventory rows and
  derive `weight` and `items[]` on read.
- New DTOs: `AbstractCharacterStatsResponse` (shared base) and `ItemInstanceResponse`.
- Extended OpenAPI schemas (`CharacterSummary`, `CharacterInstance`, new `ItemInstance`).
- New OpenAPI spec file `v0.25.2-character-max-stats-api.yaml`.
- All four backends (Java, Python, AWS) and both React frontends updated to
  expose or consume the new fields.
- Robot E2E assertions added to suite `21_character_selection` for all new fields.

**Out of scope (future steps):** movement validation against `weightMax`, item
acquisition/use endpoints (Step 33), trade (Step 71).

---

## 2. Endpoint Changes

No new endpoints are introduced. The following existing endpoints are extended to carry
the new fields on every player/character object in their response.

| Endpoint | Port | Change |
|----------|------|--------|
| `GET /api/match/{uuid}/info` | 8042 | `players[]` objects gain `lifeMax`, `energyMax`, `sadMax`, `weightMax`, `weight`, `items[]` |
| `GET /api/match/{uuid}/players` | 8042 | Same enrichment on every player object |
| `GET /api/match/{uuid}/characters/{uuidCharacter}` | 8042 | Character detail object gains all six fields |
| `POST /api/matches/{uuid}/join` | 8042 | Join response body gains all six fields |
| `GET /api/admin/matches/{uuid}/info` | 8044 | Admin info endpoint gains same fields on player objects |

HTTP status codes, authentication requirements, and error codes for all five endpoints
are unchanged.

---

## 3. New Fields — Contract

The following fields are added to every player/character DTO:

| Field | Type | Notes |
|-------|------|-------|
| `lifeMax` | integer | Maximum life — persisted at join |
| `energyMax` | integer | Maximum energy — persisted at join |
| `sadMax` | integer | Maximum sadness — persisted at join |
| `weightMax` | integer | Maximum carry weight — persisted at join |
| `weight` | integer | Current total weight of carried items; 0 when inventory is empty |
| `items` | array of `ItemInstance` | Each element: `{ uuid, itemUuid, name, weight, amount, state }` |

### 3.1 `ItemInstance` object

```json
{
  "uuid":     "inv-row-uuid-v4",
  "itemUuid": "item-uuid-v4",
  "name":     "Rusty Sword",
  "weight":   3,
  "amount":   1,
  "state":    "ACTIVE"
}
```

| Field | Type | Source |
|-------|------|--------|
| `uuid` | string | `gaming_inventory_items.uuid` — the inventory row UUID |
| `itemUuid` | string | `gaming_inventory_items.id_item` resolved to `list_items.uuid` |
| `name` | string | `list_items.name` (default locale) |
| `weight` | integer | `list_items.weight` |
| `amount` | integer | `gaming_inventory_items.amount` |
| `state` | string | `gaming_inventory_items.state` (e.g. `"ACTIVE"`) |

---

## 4. Max-Stat Formulas

All four max-stat values are computed once at `POST /api/matches/{uuid}/join` using the
same additive formula applied to current stats during Step 23 character initialisation.
The class is available in the join request context but is not stored on the instance,
which makes recalculation on read impossible — persistence is therefore mandatory.

```
lifeMax   = characterTemplate.lifeMax
            + difficulty.life
            + Σ trait.life          (over all selected traits)
            + Σ classBonus.life     (over all bonuses for the character's class)

energyMax = characterTemplate.energyMax
            + difficulty.energy
            + Σ trait.energy
            + Σ classBonus.energy

sadMax    = characterTemplate.sadMax
            + difficulty.sad
            + Σ trait.sad
            + Σ classBonus.sad

weightMax = class.weightMax
            + difficulty.weight
            + Σ trait.weight
            + Σ classBonus.weight
            (no characterTemplate contribution; 0 if the character has no class)
```

`difficulty.*` refers to the per-stat columns on the `list_difficulties` row selected
for the match. `classBonus.*` refers to rows in `list_classes_bonus` for the class.
The formulas are **identical** across Java, Python, and AWS Lambda.

---

## 5. Database Schema Changes

### 5.1 Flyway migrations — V0.27.0

Two new migration files are required (one per adapter):

- `adapter-sqlite/src/main/resources/db/migration/v0/V0.25.0__add_character_max_stats.sql`
- `adapter-postgres/src/main/resources/db/migration/v0/V0.25.0__add_character_max_stats.sql`

Both add the same four columns to `gaming_character_instance`:

```sql
ALTER TABLE gaming_character_instance ADD COLUMN life_max   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE gaming_character_instance ADD COLUMN energy_max INTEGER NOT NULL DEFAULT 0;
ALTER TABLE gaming_character_instance ADD COLUMN sad_max    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE gaming_character_instance ADD COLUMN weight_max INTEGER NOT NULL DEFAULT 0;
```

Existing rows are left at the default `0`; they are populated at the next join operation.

### 5.2 `gaming_character_instance` — updated column list (relevant subset)

| Column | Type | Notes |
|--------|------|-------|
| `life` | INTEGER | Current life value (existing) |
| `energy` | INTEGER | Current energy value (existing) |
| `sad` | INTEGER | Current sadness value (existing) |
| `life_max` | INTEGER | NEW — maximum life (v0.25.0) |
| `energy_max` | INTEGER | NEW — maximum energy (v0.25.0) |
| `sad_max` | INTEGER | NEW — maximum sadness (v0.25.0) |
| `weight_max` | INTEGER | NEW — maximum carry weight (v0.25.0) |

### 5.3 `gaming_inventory_items` (read-only in this step)

This table already exists in the schema (added in Step 10). Step 25 introduces the
first read path through Java's `GamingInventoryItemsEntity` + `GamingInventoryItemsRepository`
and the Python `GamingInventoryItemsEntity` (SQLAlchemy model, no new `create_all`
migration needed beyond the existing schema).

| Column | Role |
|--------|------|
| `id` | PK |
| `uuid` | Public identifier → `ItemInstance.uuid` |
| `id_character_instance` | FK to `gaming_character_instance.id` |
| `id_item` | FK to `list_items.id` |
| `amount` | Quantity → `ItemInstance.amount` |
| `state` | Item state string → `ItemInstance.state` |

---

## 6. Business Logic

### 6.1 Max-stat computation at join time

`CharacterCommandService.join(...)` is extended to:

1. Resolve the `list_difficulties` row for the match.
2. Resolve the `list_classes_bonus` rows for the chosen class (empty list if no class).
3. Resolve the selected traits.
4. Apply the four formulas from §4.
5. Persist the four values via a new `CharacterReadPort.persistMaxStats(...)` call
   before returning the join response.

The computation reuses the stat-initialisation helpers already present from Step 23
(`TraitStatCalculator`, `ClassBonusCalculator`, etc.) so no new formula logic is needed.

### 6.2 Weight and items on read

`CharacterMapper` (Java) / the character query service (Python) now:

1. Calls `CharacterReadPort.findInventory(characterInstanceId)` which executes a single
   JOIN query: `gaming_inventory_items` joined with `list_items` for name and weight.
2. Maps each row to an `ItemInstanceResponse` / `ItemInstance` dict.
3. Computes `weight = Σ (item.weight × row.amount)` in application code.
4. Returns `weight = 0` and `items = []` when the inventory is empty (guaranteed for
   any character that has never received an item, which is all characters in the current
   test story).

### 6.3 AWS Lambda — contract parity without inventory table

The DynamoDB single-table design does not yet have an inventory partition. The AWS
handler computes and persists the four max-stat values on the `CHARACTER#{uuid}` item at
join time (same formulas) and returns `weight = 0` / `items = []` on all read endpoints
for contract parity. Inventory items will be added when Step 33 is implemented.

---

## 7. DTOs and Domain Models

### 7.1 Java

| Class | Module | Purpose |
|-------|--------|---------|
| `AbstractCharacterStatsResponse` | `adapter-rest/dto/match/` | Shared base carrying `lifeMax`, `energyMax`, `sadMax`, `weightMax`, `weight`, `items` |
| `ItemInstanceResponse` | `adapter-rest/dto/match/` | Single item in the `items[]` array |
| `CharacterSummary` | `adapter-rest/dto/match/` | Extended to extend `AbstractCharacterStatsResponse` |
| `CharacterInstance` (OpenAPI) | `openapi/v0.25.2-character-max-stats-api.yaml` | Extended schema |
| `GamingInventoryItemsEntity` | `adapter-sqlite` / `adapter-postgres` | JPA entity mapping `gaming_inventory_items` |
| `GamingInventoryItemsRepository` | `adapter-sqlite` / `adapter-postgres` | Spring Data repository with JOIN fetch |

### 7.2 Python

| Item | Path | Purpose |
|------|------|---------|
| `GamingInventoryItemsEntity` | `app/adapters/persistence/match/models.py` | SQLAlchemy model; `Table.create_all` already handles the existing table |
| `character_command_service.py` | `app/core/services/match/` | Computes and persists max stats at join |
| `character_query_service.py` | `app/core/services/match/` | Loads inventory, computes weight |
| `match_controller.py` | `app/adapters/rest/match/` | camelCase mappers emit all six new fields |

### 7.3 OpenAPI

New spec file:
`code/backend/java/adapter-rest/src/main/resources/openapi/v0.25.2-character-max-stats-api.yaml`

Schemas extended: `CharacterSummary`, `CharacterInstance`. New schema: `ItemInstance`.

---

## 8. Per-Backend Implementation Notes

### 8.1 Java (reference implementation)

- New Flyway `V0.25.0` in both adapters.
- `GamingInventoryItemsEntity` + `GamingInventoryItemsRepository` (JOIN fetch with `list_items`).
- `CharacterReadPort` gains `findInventory(long characterInstanceId)` returning `List<InventoryItemView>`.
- `CharacterCommandService.join(...)` calls new `persistMaxStats(...)` after the existing `initStats(...)`.
- `CharacterMapper` builds `weight` sum and maps `items[]` via `ItemInstanceResponse`.
- `AbstractCharacterStatsResponse` base DTO so all six fields are declared once.
- All `mvn clean test` pass (Java full suite green).

### 8.2 Python

- SQLAlchemy `GamingInventoryItemsEntity` added to the persistence models.
- `character_command_service.py` computes and persists max stats on join.
- `character_query_service.py` fetches inventory and builds weight/items.
- `match_controller.py` camelCase mappers extended.
- 539 pytest tests pass.

### 8.3 AWS Lambda

- `CHARACTER#{uuid}` DynamoDB item gains `life_max`, `energy_max`, `sad_max`, `weight_max` attributes written at join.
- All read handlers (`get_match_info`, `get_players`, `get_character`, `admin_match_info`) emit the four maxes plus `weight = 0` and `items = []`.
- 280 AWS Lambda tests pass.

---

## 9. Frontend Changes

### 9.1 react-game

| File | Change |
|------|--------|
| `src/api/matchInfoAdapter.js` | NEW — thin adapter translating raw `/info` payload to a normalised player object including the six new fields |
| `src/api/matches.js` | Updated to pipe through `matchInfoAdapter` |
| `src/api/game.js` | References `matchInfoAdapter` for the game state |
| `src/features/gameplay/GameBook.jsx` | `PlayerStats` component receives `lifeMax`, `energyMax`, `sadMax`; current/max gauges rendered |
| `src/features/gameplay/GameBookMobile.jsx` | Same changes as `GameBook.jsx` |
| `src/features/start-book/ConfigView.jsx` | Weight limit shown from `weightMax` |
| `src/features/start-match/StartMatchFlow.jsx` | Join response normalised through adapter |
| `src/features/gameplay/EndGameBook.jsx` | End-screen stats use max values |
| `src/pages/GamePage.jsx` | State wired through adapter |
| `src/utils/bonusStats.js` | Utility for computing display ratios (current/max) |
| `src/i18n/en.json` / `it.json` | New key `game.items.label` ("Items" / "Oggetti") |
| `src/styles/main.css` | Gauge bar styles for current/max stat display |
| `src/mock/matchInfo.json` | NEW — replaces deleted `gameData.json`; includes `lifeMax`, `energyMax`, `sadMax`, `weightMax`, `weight`, `items[]` |
| `src/mock/gameData.json` | DELETED — superseded by `matchInfo.json` |

#### Stat gauges

Each stat (life, energy, sadness) is displayed as a gauge showing `current / max` (e.g.
`42 / 100`). The gauge bar fill percentage = `current / max * 100`. When `max = 0` the
bar renders at 0% to avoid division-by-zero.

#### Items list

When `items[]` is non-empty, a collapsible items panel is rendered below the stat gauges
showing item name, weight, amount, and state per row. An empty items array renders
nothing (no panel).

### 9.2 react-admin

| File | Change |
|------|--------|
| `src/api/matchApi.js` | Updated to forward new fields on player objects |
| `src/pages/MatchDetailPage.jsx` | Players table gains "Weight" column and "Items" count column; stat cells now show `current / max` gauges |

---

## 10. Tests

### 10.1 Java unit tests

`mvn clean test` passes the full suite. Key new/updated test classes:

| Test class | New assertions |
|------------|----------------|
| `CharacterCommandServiceTest` | Max stats computed correctly for all four formulas; persisted via store port |
| `CharacterMapperTest` | `weight` summed from inventory rows; `items[]` mapped correctly; empty inventory → `weight=0`, `items=[]` |
| `MatchAdminControllerTest` | Admin info response includes max stats and items (updated) |

### 10.2 Python unit tests

539 tests pass. New/updated test modules:

- `test_character_command_service.py` — max-stat formula assertions for all four values.
- `test_character_query_service.py` — inventory load, weight sum, items list.
- `test_match_controller.py` — camelCase field names verified in HTTP responses.

### 10.3 AWS Lambda tests

280 tests pass. New assertions:
- Join handler stores four `*_max` attributes on the `CHARACTER#` item.
- All read handlers return `weight=0`, `items=[]` with correct types.

### 10.4 React-game tests

| Test file | Scope |
|-----------|-------|
| `src/test/GameBook.test.jsx` | Updated mocks include max-stat fields; gauge components render |
| `src/test/GamePage.test.jsx` | End-to-end page render with new adapter |
| `src/test/ClockWidget.test.jsx` | No change (clock feature; stat fields not relevant) |
| `src/test/SleepButton.test.jsx` | No change |

### 10.5 React-admin tests

`MatchDetailPage.test.jsx` updated: mock player objects include all six new fields;
"Weight" and "Items" columns asserted present. 283 tests pass.

### 10.6 Robot Framework E2E

Suite: `code/tests/robot/tests/21_character_selection/character_selection.robot`

New assertions added (no new suite file; the character selection flow already creates a
joined character with stats):

| Assertion | Endpoint under test |
|-----------|---------------------|
| `lifeMax`, `energyMax`, `sadMax`, `weightMax` all present and `> 0` | POST join response |
| `weight == 0` (empty inventory at join) | POST join response |
| `items` is empty list | POST join response |
| Same six fields present on `GET /api/match/{uuid}/info` players[] | GET match info |
| Same six fields present on `GET /api/match/{uuid}/players` | GET players |
| Same six fields present on `GET /api/match/{uuid}/characters/{uuidCharacter}` | GET character detail |

Full Java/SQLite Robot suite: **357 tests pass**, no regressions.

---

## 11. API Changes Summary

| Endpoint | Status | Change |
|----------|--------|--------|
| `GET /api/match/{uuid}/info` | MODIFIED (v0.25.0) | Players gain `lifeMax`, `energyMax`, `sadMax`, `weightMax`, `weight`, `items[]` |
| `GET /api/match/{uuid}/players` | MODIFIED (v0.25.0) | Same enrichment |
| `GET /api/match/{uuid}/characters/{uuidCharacter}` | MODIFIED (v0.25.0) | Same enrichment |
| `POST /api/matches/{uuid}/join` | MODIFIED (v0.25.0) | Join response body gains all six fields |
| `GET /api/admin/matches/{uuid}/info` | MODIFIED (v0.25.0) | Admin player objects gain all six fields |

No endpoints are added or removed. The changes are additive; existing consumers that
ignore unknown fields are unaffected.

---

## 12. Cross-Step Relationships

```
Step 23  ──►  Step 25  ──►  Step 28
(trait            (max stats,    (movement —
 selection,        weight,        weight vs
 stat init)        items[])       weightMax
                                  check)
```

Step 33 (inventory management — use item, drop item) will write to `gaming_inventory_items`
and will rely on the `weight` / `weightMax` values established here. Step 28 (movement)
will enforce `weight ≤ weightMax` using the persisted `weight_max` column.

---

## 13. Notes

1. **Class id not stored on instance.** The `gaming_character_instance` table has no
   `id_class` column. The four max stats must therefore be computed at join time (when
   the class is known from the request) and persisted. Re-deriving them on read is not
   possible without a schema change.

2. **Default 0 for existing rows.** The migration adds columns with `DEFAULT 0`. Rows
   created before v0.25.0 (dev data) will show `0` for all four max stats until the
   character re-joins. This is acceptable for development environments; production has no
   live matches with this history.

3. **`weightMax = 0` when no class.** If a character joins without selecting a class
   (`class.weightMax = 0` and no `classBonus.weight`), `weightMax` is the sum of
   `difficulty.weight + Σ trait.weight`, which may also be 0. Movement validation (Step
   28) must handle this as "no weight limit enforced" or "cannot carry anything" — the
   design decision is deferred to Step 28.

4. **AWS inventory items deferred.** The DynamoDB backend returns `weight = 0` and
   `items = []` for all characters as a placeholder. When Step 33 implements inventory
   management, the AWS handler must also write `INVENTORY#{itemUuid}` items and update
   the read paths accordingly.



## 14. Addendum (v0.25.3) — Enriched Match Info: `locationsActive`

### 14.1 Problem & goal

Until now `GET /api/match/{uuidMatch}/info` returned `events` / `choices` as
hardcoded empty lists, `locations` as bare per-match state rows (no card /
neighbor / event content), and `currentLocation*` derived from the **story start
location**. The game board (GameBook, react-game) therefore could not show
*where the player actually is*, nor the reachable locations or the events as
cards.

This addendum enriches the same endpoint (additively — fully backward
compatible) so the board can render the player's current location plus its
neighbors and events, each as a card.

### 14.2 New response field `locationsActive[]`

Added to `MatchInfo`; `locations` / `registry` / `events` / `choices` /
`players` are **unchanged**. `locationsActive` lists the locations occupied by
**one or more players**. Each entry:

- `idLocation` (int64), `uuid`
- `card` — resolved `CardInfo` (`uuid`, `cardType`, `urlImage`,
  `alternativeImage`, `awesomeIcon`, `styleMain` / `styleDetail` /
  `styleImageLittle` / `styleImageMedium` / `styleImageLarge`, `title`,
  `description`, `copyrightText`, `linkCopyright`)
- `neighbors[]` — the locations reachable from it, **both directions** (every
  link whose `idLocationFrom` **or** `idLocationTo` is the active location).
  Each: `idLocation` (the *other* endpoint), `uuid`, `direction`, `flagBack`,
  `energyCost`, `card` (the neighbor link's own card, falling back to the
  destination location's card).
- `events[]` — events specific to that location (`event.idSpecificLocation ==
  location.id`). Each: `uuid`, `type`, `card`.

In addition, **`currentLocationId` / `currentLocationUuid` / `currentLocationName`
now reflect the player's position** (`players[0].idLocation`), falling back to
the story start location only when no player / `idLocation` is present.

### 14.3 Filtering rules (the load-bearing logic)

- `activeLocIds` = the set of non-null `players[].idLocation`.
- a location is in `locationsActive` **only if** it has ≥ 1 player on it;
- neighbors are included per active location (so a link shared by two occupied
  locations is scoped under each, not duplicated in a flat list);
- events are included only when their location is player-occupied.

### 14.4 Example

```jsonc
{
  "match": { "...": "unchanged" },
  "currentLocationId": 1,            // = players[0].idLocation (fallback: story start)
  "currentLocationUuid": "loc-001",
  "currentLocationName": "location-1",
  "locations":  [ /* unchanged per-match STATE rows */ ],
  "events":     [ /* unchanged lean uuid/name/type */ ],
  "choices":    [ /* unchanged */ ],
  "players":    [ { "...": "unchanged", "idLocation": 1 } ],

  "locationsActive": [
    {
      "idLocation": 1,
      "uuid": "loc-001",
      "card": { "title": "Welcome Hall", "description": "...", "awesomeIcon": "fas fa-door-open", "urlImage": null },
      "neighbors": [
        { "idLocation": 2, "uuid": "loc-002", "direction": "N", "flagBack": 1,
          "energyCost": 1, "card": { "title": "To the Practice Yard", "awesomeIcon": "fas fa-arrow-up" } }
      ],
      "events": [
        { "uuid": "evt-1", "type": "NORMAL", "card": { "title": "Intro Greeting", "awesomeIcon": "fas fa-comment" } }
      ]
    }
  ]
}
```

### 14.5 Per-backend implementation

- **Java (reference).** New domain models `LocationInfo` / `LocationNeighborInfo`
  / `EventInfo` (`core/model/match`); `ContentQueryPort.getCardByStoryIdAndCardId(
  storyId, idCard, lang)` reuses the existing card/text resolution (English
  fallback). `MatchQueryService` gains an optional 5-arg constructor taking
  `ContentQueryPort` (wired in `CoreConfig`); `buildDetail` builds players first,
  derives the active-location set, sets the current location from the player and
  assembles `locationsActive`. DTOs `LocationInfoDto` / `LocationNeighborDto` /
  `EventInfoDto` in `MatchInfoResponse` (+ `CardInfoResponse.fromModel`).
  OpenAPI `v0.19.0-match-creation-api.yaml` adds `CardInfo` / `LocationInfo` /
  `LocationNeighborInfo` / `EventInfo` schemas.
- **Python.** Mirror in `match_models.py`; `StoryMatchReadPort` gains
  `find_location_neighbors_by_story_id`, `find_events_by_story_id`,
  `find_card_by_story_id_and_card_id`, `find_text_by_story_id_text_and_lang`
  (implemented in `story_match_read_adapter.py`); `match_query_service._build_detail`
  + `_resolve_card`; controller `_location_info_to_camel` serialises the block.
- **AWS Lambda.** The DynamoDB seed (`seed/handler.py`) now embeds `neighbors[]`
  per story, an `idLocation` + `card` on each event, and a `card` on each
  location; `match/handler.py` `_detail_from_item` / `_build_locations_active`
  reads them from the STORY item filtered by player location. (AWS cards are an
  inline subset `{title, description, urlImage, awesomeIcon}`.)
- **Frontend (react-game).** `matchInfoAdapter.matchInfoToGameData` derives the
  current location from `players[0].idLocation` → the matching `locationsActive`
  entry → the board's current-location card; `neighbors` → board move-target
  cards; the active location's `events` → action cards (added to the lean events;
  END_GAME handling preserved). GameBook's left page renders the active location
  card whenever one is present.

### 14.6 Language

Card text resolves with an `"en"` fallback — the info endpoint carries no `lang`
parameter (consistent with §10.2 for clock labels).

### 14.7 Tests

- Java: `MatchQueryServiceLocationsActiveTest` (active location, player-derived
  current location, neighbor/event filtering, empty case) + `MatchDtosTest`
  mapping; full core / adapter-rest / ms-launcher suites green.
- Python: `test_match_query_service` (enriched path) + `test_match_controller`
  serialisation; 597 tests pass.
- AWS: `test_match_handler` enriched-path test; 320 tests pass.
- react-game: `matchInfoAdapter.test.js` (actualLocationCard from player, neighbors →
  locations, events → actions, empty fallback); 367 tests pass.
- Robot E2E: `tests/25_time_clock/match_locations_active.robot` — backend-agnostic
  structural checks (field present, active location matches the player, card /
  neighbors / events keys, empty when no character joined).

### 14.8 Out of scope

Movement and location-entry-event **execution** (Roadmap Step 28 / 29). This
addendum only *exposes* the neighbors and events; it does not act on them.

### 14.9 End-game flag on events (v0.25.4)

Each entry of `locationsActive[].events` now carries a boolean **`endGame`**:
`true` only when the event is the story's end-game event
(`event.id == story.idEventEndGame`), `false` otherwise. This lets the frontend
render an explicit "end game" affordance without re-deriving it from the event
`type`.

- Java: `EventInfo.endGame` (computed in `MatchQueryService.buildLocationsActive`
  from `StoryEntity.getIdEventEndGame()`), `EventInfoDto.endGame`, OpenAPI
  `EventInfo.endGame`.
- Python: `EventInfo.end_game`; controller serialises `endGame`.
- AWS: `_build_locations_active` flags `endGame` from the STORY item's
  `idEventEndGame`.
- react-game: the adapter maps `event.endGame` onto the action; `GameBook`
  renders the action `ConfigCard` with an **end-game button** wired via
  `ConfigCard` `onAction` / `actionLabel` (`game.endGame`) / `actionIcon`
  (`fa-flag-checkered`) — `ConfigCard` now accepts these overrides (defaulting to
  the existing "change" action).
- Robot: `match_locations_active.robot` asserts every active event exposes a
  boolean `endGame` key.




# Version Control
- Versions created with AI prompt:
  ```
  ciao read step 25 on roadmap file (documentation_v0/Roadmap.md) and write a plan to realize all components. 
  projects are backend/java, robot test, aws lambda and and python project. 
    --> in this plan i don't wanna change nothing into frontend project. 
    --> in this plan i wanna change react-game, react-admin projects too!
  at the end use paths-games-doc to write Step24_xxx.md file with specific documentation agent
  let's go to develop all components

  read documentation_v0/Step25_TimeAdvancementClockCycle.md and roadmap, write a plan to develop frontend react-game 
  e react-admin components, let's go

  Ciao, i wanna new edit: on api api/match/{uuid}/info on response, on player object add fields energyMax, lifeMax, sadMax, weightMax (for ever player sum class, charater, traits and difficulty values like start game procedure). Add weight like sum of Items weight and add Items list. Remember to edit all backend (java, aws, python) and frontends (react-game and react-admin). edit robot test to test new fields. use paths-games-doc to update all documentation files into documentation_v0. let's go

  I wanna GameBook component loads actual location (filed idLocation on player object) on leftContent- LocationCard. With api/match/[uuid]/info api load allo location* and locationsNeighbor* and all events*, every elementi with cards informations. Important: load location only if there are one or more player, load locationsNeighbor only if there are one or more player on location (to and from), load all events if there are one or more players on event locationId

  into locationsActive into events add endGame flag, true if event is "end game event id" from story, else false. add robot test, if necessary use "0.25.4" version, edit all backends and react-game to show "end game" button to ConfigCard using onAction,actionLabel e actionIcon. Let's go

  ciao, on card GoToSleepCard i wanna call API to sleep onAction method , undestand what sleed means and if there are others API to call and conmponents to reload. 

  on runCreateMatch i wanna this change: between createMatch, joinMatch and startMatch you have to wait delaySeconds() and show messages with states and countdown. let's go

  I wanna change, when user click on (x) icon on GameBook, show a modal with a message, show like card object (GameCard using title and image from story). Let's go.

  ```

- **Document Version**: 0.25.4

    | Version | Description | Date |
    |---------|-------------|------|
    | 0.25.0 | Time Advancement & Clock Cycle: sleep action, time-end trigger (all-sleeping / all-zero-energy), clock increment + log_clock_history insert, queue recalculation reusing Step 24 TurnPriorityCalculator, GET /clock endpoint, TimeAdvanced domain event (in-process); backends only (Java / Python / AWS) + Robot suite 25_time_clock; no frontend, no new DB migration expected | June 15, 2026 |
    | 0.25.1 | Addendum: shipped DTO field names corrected (no previousClock / activeCharacterUuid / clockLabel / dayPhase / per-character name); admin endpoint GET /api/admin/matches/{uuidMatch}/clock added (clockForAdmin port method + MatchAdminController) | June 15, 2026 |
    | 0.25.2 | Per-player max stats (lifeMax/energyMax/sadMax/weightMax), current carried weight and items list added to all match-info endpoints; Flyway V0.25.2 migrations (sqlite + postgres); GamingInventoryItemsEntity + repository; CharacterCommandService persists maxes at join; CharacterMapper resolves weight + items; ItemInstanceResponse DTO; OpenAPI v0.25.2-character-max-stats-api.yaml; Python 539 tests pass, AWS 280, react-admin 283; Robot suite 21 assertions added, 357 tests pass | June 15, 2026 |
    | 0.25.2 | Clock label fix: ClockResponse uses clockLabelSingular/clockLabelPlural (split from single clockLabel); AWS bug fixed — _story_clock_label() helper with fallback from texts map; story import now persists resolved descriptions; ClockWidget uses clockLabelSingular as badge tooltip; 2 new AWS pytest tests (71 total); Robot test "Clock Labels Are Saved And Retrieved From Story" added; Note §10.2 added: labels not localised per user (always "en") | June 16, 2026 |
    | 0.25.3 | Enriched match info: new `locationsActive[]` block on GET /api/match/{uuid}/info (player-occupied locations, each with card + neighbors[] + events[], all carrying cards); currentLocation* now derived from players[].idLocation (fallback story start); Java reference (LocationInfo/LocationNeighborInfo/EventInfo, ContentQueryPort.getCardByStoryIdAndCardId, MatchQueryService 5-arg + CoreConfig, MatchInfoResponse DTOs, OpenAPI schemas) + Python + AWS (seed neighbors/event-location/cards + handler) + react-game adapter/GameBook; backend tests green (Java core/adapter-rest/ms-launcher, Python 597, AWS 320, react-game 367); Robot suite match_locations_active.robot added (§14) | June 16, 2026 |
    | 0.25.4 | End-game flag on events: locationsActive[].events now carries a boolean `endGame` (true when event.id == story.idEventEndGame) across Java/Python/AWS (+ EventInfoDto.endGame, OpenAPI); react-game adapter maps it and GameBook renders an "end game" button via ConfigCard onAction/actionLabel/actionIcon (ConfigCard made override-friendly); Robot test "Event Cards Expose The End Game Flag" added; tests green: Java core 910 + adapter-rest 188, Python 597, AWS 320, react-game 367 (§14.9) | June 16, 2026 |
    | 0.25.4 | Events cards into GameBook and end match flag to complete a match | June 16, 2026 |
    | 0.25.4 | EndGame and sleep card on GameBook, sleep action to call APIs | June 16, 2026 |

- **Last Updated**: June 16, 2026
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
