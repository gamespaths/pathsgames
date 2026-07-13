# Paths Games V0 - Step 24: Turn Cycle Engine for Single-Player

This document describes the implementation plan for **Step 24** as requested in the Roadmap.

> **Implementation status — v0.24.0 (June 12, 2026): DONE.** Implemented across all
> backends and both frontends. Two deviations from the original plan below are worth
> noting:
>
> 1. **Explicit `status` column adopted (instead of derivation).** Migration `V0.24.0`
>    adds a `status` column to `gaming_turn_queue` (postgres + sqlite) carrying the
>    `WAITING → ACTIVE → COMPLETED` lifecycle explicitly. It is the single source of
>    truth for the queue, superseding the derivation approach discussed in §5.3. This
>    proved simpler and more robust than deriving the active row from
>    `timestamp_start`/`timestamp_end`.
> 2. **Turn timestamps left null.** Because the SQLite `LocalDateTime ↔ TIMESTAMP`
>    round-trip failed on re-read, `timestamp_start`/`timestamp_end` are written as
>    null; the explicit `status` column makes them non-essential for the lifecycle.
>
> Per-backend notes:
> - **Java** (reference): `core` service `TurnCycleService` + `TurnPriorityCalculator`,
>   ports, `TurnCycleStoreAdapter`, `TurnCycleController`, DTOs, OpenAPI
>   `v0.24.0-turn-cycle-engine-api.yaml`. 13 unit tests.
> - **Python**: `turn_models` / `turn_ports` / `TurnCycleService` /
>   `TurnCycleStoreAdapter` (SQLAlchemy) / `TurnCycleController`, wired in `launcher`.
>   17 unit tests.
> - **AWS Lambda**: turn cycle added to `lambda/match/handler.py`; the queue is stored
>   in the DynamoDB single table as `TURN#{characterUuid}` items under the
>   `MATCH#{uuid}` partition, with the active character tracked on the match item
>   (`activeCharacterUuid`). 3 routes in `template/match.yaml`. 12 unit tests.
> - **React-Game**: `startMatch` / `passTurn` / `getTurnSequence` API + presentational
>   `TurnPanel` component + i18n keys.
> - **React-Admin**: no admin-scoped turn-sequence endpoint exists (the player one is
>   owner-restricted), so the console shows a read-only **projected** turn order
>   (`utils/turnPriority` + `TurnOrderPanel`) computed client-side from the match
>   players using the same stat formula.
> - **Robot**: backend-agnostic suite `24_turn_cycle` (12 tests) validates Java and
>   Python end-to-end (300/300 each, no regressions).

Step 24 introduces the **turn cycle engine** for single-player matches. The gaming tables
`gaming_turn_queue` and `gaming_match` were already designed and migrated in Step 10
(V0.10.7 / V0.10.6); this step implements the service layer, REST endpoints, and
frontend components that bring them to life.

The relationship between adjacent steps:

- **Step 23** completes trait selection and character stat initialization at join time;
  `gaming_character_instance` rows are fully populated with stats before this step runs.
- **Step 24** reads those stats to compute turn priority, initializes the queue on match
  start, and drives the WAITING → ACTIVE → COMPLETED turn state machine.
- **Steps 25-27** (time advancement, weather) consume the queue produced here and
  recalculate it at each new clock cycle.

---

## 1. Scope

Step 24 covers the following items from the roadmap:

- `POST /api/matches/{uuidMatch}/start` — transitions a match from `CREATED` to
  `RUNNING`; initialises `gaming_turn_queue` with one row per character; sets
  `gaming_match.id_character_current_turn` to the highest-priority character; the first
  entry becomes **ACTIVE**.
- Turn priority formula: `priority = (DEX×3 + INT×2 + COS×1) × 1000 + LIFE×10 + idCharacter`
  where DEX = `dexterity`, INT = `intelligence`, COS = `constitution`, LIFE = `life`
  from `gaming_character_instance`, and `idCharacter` = the character's internal `id`
  (tie-breaker).  Higher priority acts first.
- Turn state machine on `gaming_turn_queue`: **WAITING → ACTIVE → COMPLETED**.  The
  "current" row is the one whose `id_character_match` equals
  `gaming_match.id_character_current_turn` and whose `timestamp_start` is non-null and
  `timestamp_end` is null.  Derivation approach is preferred over an explicit `status`
  column (see §5.3 for details).
- `POST /api/gameplay/{uuidMatch}/action/pass` — voluntary pass without energy cost;
  increments `pass_counter`; closes the current turn (sets `timestamp_end`); activates
  the next character in priority order.
- `GET /api/match/{uuidMatch}/turn-sequence` — returns the full turn queue ordered by
  `priority DESC`, with computed status, timestamps, and the active character indicator.
- Backend unit tests covering priority calculation, queue initialisation, state
  transitions, and pass logic across all backends.
- Frontend components in react-game: "Start Match" action, "Pass Turn" button, and a
  Turn Order panel.
- React-admin read-only turn-sequence monitor in the match detail view.
- Robot Framework suite `24_turn_cycle` (backend-agnostic, runs against all backends).

**Out of scope:** time advancement at clock boundaries (Step 26); turn timeout /
auto-pass (Step 63, multiplayer); WebSocket broadcast of turn changes (Step 64).

---

## 2. Endpoint APIs

The OpenAPI source of truth will be created at
`code/backend/java/adapter-rest/src/main/resources/openapi/v0.24.0-turn-cycle-api.yaml`.

### 2.1 `POST /api/matches/{uuidMatch}/start`

Authenticated endpoint (player JWT, public port 8042).  Only the match creator may call
this endpoint.

| HTTP status | Condition |
|-------------|-----------|
| `200`       | Match transitioned to `RUNNING`; queue initialised; `MatchStartResponse` body (see §3) |
| `401`       | Missing or invalid JWT |
| `404`       | `MATCH_NOT_FOUND` — match uuid not found **or** the authenticated user is not the creator (ownership check; 404 is returned to avoid leaking existence to third parties) |
| `409`       | `MATCH_NOT_STARTABLE` — match is not in `CREATED` status (e.g., already `RUNNING`, `ENDED`, or `GAMEOVER`) |
| `409`       | `NO_CHARACTERS_JOINED` — no `gaming_character_instance` rows exist for this match (cannot build a queue) |

**Side effects on success:**
1. One `gaming_turn_queue` row inserted per `gaming_character_instance` of the match.
2. `priority` computed and stored for each row.
3. `clock` set to `gaming_match.current_clock` at start time.
4. `timestamp_start` of the highest-priority row set to NOW(); all others remain null.
5. `gaming_match.status` set to `RUNNING`.
6. `gaming_match.timestamp_start` set to NOW().
7. `gaming_match.id_character_current_turn` set to the `id` of the highest-priority
   character.

### 2.2 `POST /api/gameplay/{uuidMatch}/action/pass`

Authenticated endpoint (player JWT, public port 8042).  The calling user must own the
character whose turn is currently ACTIVE.

| HTTP status | Condition |
|-------------|-----------|
| `200`       | Turn passed; `PassTurnResponse` body (see §3) |
| `401`       | Missing or invalid JWT |
| `404`       | `MATCH_NOT_FOUND` — match uuid not found or the calling user has no character in the match |
| `409`       | `MATCH_NOT_RUNNING` — match is not in `RUNNING` status |
| `409`       | `NOT_YOUR_TURN` — the active character in the queue does not belong to the calling user |

**Side effects on success:**
1. `gaming_turn_queue.timestamp_end` of the current ACTIVE row set to NOW().
2. `gaming_turn_queue.pass_counter` of that row incremented by 1.
3. Next character in queue (by `priority DESC`, excluding already COMPLETED rows in the
   current clock) has its `timestamp_start` set to NOW().
4. `gaming_match.id_character_current_turn` updated to the next character's `id`.
5. If all characters in the current clock have `timestamp_end` set (all COMPLETED), a
   new clock cycle begins: all queue rows for this clock are closed and new rows
   inserted for the next clock (or the time-advancement hook is invoked — see Step 26).

### 2.3 `GET /api/match/{uuidMatch}/turn-sequence`

Authenticated endpoint (player JWT, public port 8042).  Any participant in the match
may call this endpoint.

| Query param | Default | Description |
|-------------|---------|-------------|
| *(none)*    |         | Returns the complete current-clock queue |

| HTTP status | Condition |
|-------------|-----------|
| `200`       | `TurnSequenceResponse` body (see §3) |
| `401`       | Missing or invalid JWT |
| `404`       | `MATCH_NOT_FOUND` — match uuid not found or caller has no character in the match |

Response is ordered by `priority DESC` (highest priority first = first to act).

---

## 3. DTOs and Domain Models

### 3.1 `TurnQueueEntryResponse` (shared shape)

```json
{
  "characterUuid": "char-uuid-v4",
  "idCharacter":   12,
  "name":          "Aelar the Rogue",
  "priority":      47120,
  "clock":         0,
  "status":        "ACTIVE",
  "passCounter":   0,
  "timestampStart": "2026-06-12T10:15:00Z",
  "timestampEnd":   null
}
```

`status` is a **derived field** computed by the service layer (see §6.2), not stored in
the database.

| Field | Type | Notes |
|-------|------|-------|
| `characterUuid` | string | Public UUID of `gaming_character_instance` |
| `idCharacter` | integer | Internal id — used for priority tie-breaking display |
| `name` | string | Character display name |
| `priority` | long | Computed priority value |
| `clock` | integer | Clock cycle this entry belongs to |
| `status` | string | `WAITING`, `ACTIVE`, or `COMPLETED` (derived) |
| `passCounter` | integer | Times this character has passed in the current clock |
| `timestampStart` | string (ISO-8601) | When the turn became ACTIVE; null if WAITING |
| `timestampEnd` | string (ISO-8601) | When the turn ended; null if ACTIVE or WAITING |

### 3.2 `TurnSequenceResponse`

```json
{
  "matchUuid": "match-uuid-v4",
  "status": "RUNNING",
  "currentClock": 0,
  "activeCharacterUuid": "char-uuid-v4",
  "queue": [ /* array of TurnQueueEntryResponse, priority DESC */ ]
}
```

### 3.3 `MatchStartResponse`

```json
{
  "uuid": "match-uuid-v4",
  "status": "RUNNING",
  "currentClock": 0,
  "activeCharacterUuid": "char-uuid-v4",
  "queue": [ /* array of TurnQueueEntryResponse */ ]
}
```

### 3.4 `PassTurnResponse`

```json
{
  "matchUuid": "match-uuid-v4",
  "passedCharacterUuid": "prev-char-uuid",
  "nextActiveCharacterUuid": "next-char-uuid",
  "status": "RUNNING"
}
```

### 3.5 Java REST DTOs

| DTO | File (adapter-rest) | Purpose |
|-----|---------------------|---------|
| `TurnQueueEntryResponse` | `dto/match/TurnQueueEntryResponse.java` | Single entry in the queue array |
| `TurnSequenceResponse` | `dto/match/TurnSequenceResponse.java` | Full turn-sequence payload |
| `MatchStartResponse` | `dto/match/MatchStartResponse.java` | Response for POST start |
| `PassTurnResponse` | `dto/match/PassTurnResponse.java` | Response for POST action/pass |

### 3.6 Java Core Domain Models

| Model / Service | Package | Purpose |
|-----------------|---------|---------|
| `TurnPriorityCalculator` | `core/.../service/match/` | Pure function: computes `priority` from a `gaming_character_instance` |
| `TurnCycleService` | `core/.../service/match/` | Orchestrates start, pass, and sequence-query operations |
| `TurnQueueEntry` | `core/.../model/match/` | Domain model mirroring queue row + derived `status` |
| `TurnSequenceResult` | `core/.../model/match/` | Aggregation returned by the service |
| `GamingTurnQueueRepository` | `core/.../repository/match/` | Port: insert queue rows, find by match, update timestamp/counter |
| `MatchStartException` (extended) | `core/.../service/match/` | New codes: `MATCH_NOT_STARTABLE`, `NO_CHARACTERS_JOINED` |
| `TurnPassException` | `core/.../service/match/` | New codes: `MATCH_NOT_RUNNING`, `NOT_YOUR_TURN` |

### 3.7 Python Core Models

| Item | Path | Purpose |
|------|------|---------|
| `TurnPriorityCalculator` | `app/core/services/match/turn_priority_calculator.py` | Priority formula |
| `TurnCycleService` | `app/core/services/match/turn_cycle_service.py` | Start / pass / sequence logic |
| `TurnQueueEntry` | `app/core/models/match/turn_queue.py` | Dataclass with derived `status` |
| `TurnQueuePort` | `app/core/ports/match/turn_queue_port.py` | Repository interface |

### 3.8 AWS Lambda — DynamoDB item design

Turn queue entries are stored as individual DynamoDB items in the single-table design:

| Attribute | Value |
|-----------|-------|
| PK | `MATCH#{matchUuid}` |
| SK | `TURN#{clock}#{priority_padded}#{idCharacter}` |
| GSI (if needed) | `idCharacter` projection for current-turn lookup |

The `MATCH#{matchUuid}` item (status item) stores `id_character_current_turn` and
`current_clock` as attributes alongside `status`.  The SK structure ensures natural
ordering by `priority DESC` when querying with `ScanIndexForward=false`.

---

## 4. Roles and Authentication

All three endpoints are on the **public port (8042)** and require a valid **guest JWT**
(player role).  There is no admin-port equivalent for write operations; the react-admin
turn-sequence panel is read-only and may use the admin port 8044 if the endpoint is
exposed there, or can call the player endpoint directly with an admin JWT.

**Ownership checks:**

- `POST .../start` — caller's `id_user` must equal `gaming_match.id_user_creator`.
  Return `404 MATCH_NOT_FOUND` (not `403`) to avoid leaking match existence.
- `POST .../action/pass` — caller's `id_user` must match the `id_user` of the
  `gaming_character_instance` whose `id` equals
  `gaming_match.id_character_current_turn`.  Return `409 NOT_YOUR_TURN` when the user
  is a participant but it is not their turn; return `404 MATCH_NOT_FOUND` when the user
  has no character in the match at all.
- `GET .../turn-sequence` — caller must have at least one `gaming_character_instance`
  in the match.  Read-only; `404` for non-participants.

---

## 5. Tables

No schema changes are required.  All tables were created in Step 10.  This section
documents the relevant columns and how they are used.

### 5.1 `gaming_match` (relevant columns)

| Column | Type | Role in Step 24 |
|--------|------|-----------------|
| `uuid` | TEXT / UUID | Public identifier in all endpoints |
| `status` | TEXT | `CREATED` → `RUNNING` on start |
| `current_clock` | INTEGER | Seed value for new queue rows |
| `id_character_current_turn` | INTEGER | FK → `gaming_character_instance(id)`; tracks active turn |
| `timestamp_start` | TEXT / TIMESTAMP | Set to NOW() when match starts |
| `counter_consecutive_pass` | INTEGER | Incremented when all characters in a clock pass (Step 26 input) |

### 5.2 `gaming_turn_queue` (all columns)

| Column | Type | Notes |
|--------|------|-------|
| `id_match` | INTEGER (PK) | FK → `gaming_match(id)` |
| `id_character_match` | INTEGER (PK) | FK → `gaming_character_instance(id, id_match)` |
| `uuid` | TEXT / UUID | Public identifier (used in API responses) |
| `clock` | INTEGER | Clock cycle this row belongs to; copied from `gaming_match.current_clock` at creation |
| `timestamp_start` | TEXT / TIMESTAMP | Set when turn becomes ACTIVE; null = WAITING |
| `timestamp_end` | TEXT / TIMESTAMP | Set when turn COMPLETES; null = not yet ended |
| `pass_counter` | INTEGER DEFAULT 0 | Incremented on each voluntary pass action |
| `priority` | INTEGER DEFAULT 0 | Computed: `(DEX×3 + INT×2 + COS×1) × 1000 + LIFE×10 + id` |
| `ts_insert` | TEXT / TIMESTAMP | Row creation time |
| `ts_update` | TEXT / TIMESTAMP | Last modification time |

### 5.3 Turn status derivation

Rather than adding a `status` column to `gaming_turn_queue` (which would require a
Flyway migration and risk inconsistency), the service derives status from the existing
columns:

| `timestamp_start` | `timestamp_end` | Derived status |
|:-----------------:|:---------------:|----------------|
| null | null | `WAITING` |
| non-null | null | `ACTIVE` |
| non-null | non-null | `COMPLETED` |

This derivation is implemented in `TurnPriorityCalculator` / `turn_priority_calculator`
and in the Lambda handler.  It is consistent with the constraint that `id_character_current_turn`
always points to the single ACTIVE row.

**Alternative (not chosen):** add `status TEXT NOT NULL DEFAULT 'WAITING'` to
`gaming_turn_queue` via a new Flyway migration (V0.24.1 for both SQLite and PostgreSQL).
This would simplify SQL queries at the cost of a schema change.  Implementors may
choose this path if query complexity becomes a maintenance burden; document the decision
in the migration file header.

### 5.4 Existing tables read

| Table | Read | Write | Notes |
|-------|:----:|:-----:|-------|
| `gaming_match` | ✔ | ✔ | Status, clock, `id_character_current_turn`, `timestamp_start` |
| `gaming_character_instance` | ✔ | | Stats (DEX/INT/COS/LIFE/id), UUID, name, `id_user` |
| `gaming_turn_queue` | ✔ | ✔ | Full CRUD for queue management |

---

## 6. Business Logic

### 6.1 Priority formula

```
priority = (dexterity × 3 + intelligence × 2 + constitution × 1) × 1000
           + life × 10
           + id_character_instance
```

All values are read from `gaming_character_instance` at the moment `POST .../start` is
called (i.e., the character's stats at start time, after trait initialisation from
Step 23).  The formula is deterministic and produces a total ordering over all
characters in the match (the `+ id` term ensures no ties).

The `TurnPriorityCalculator` is a **pure stateless function** (no DB access) so it can
be unit-tested independently.

### 6.2 Queue initialisation (`POST .../start`)

1. Validate match exists and caller is the creator (→ 404 if not).
2. Validate `status == CREATED` (→ 409 `MATCH_NOT_STARTABLE` if not).
3. Load all `gaming_character_instance` rows for the match.
4. Validate at least one exists (→ 409 `NO_CHARACTERS_JOINED` if empty).
5. Compute `priority` for each character using §6.1.
6. Insert one `gaming_turn_queue` row per character:
   - `clock` = `gaming_match.current_clock` (typically 0 at first start)
   - `priority` = computed value
   - `timestamp_start` = null (all WAITING initially)
   - `timestamp_end` = null
   - `pass_counter` = 0
7. Sort queue by `priority DESC`; select the first (highest priority).
8. Set `timestamp_start` of that row to NOW() → first character becomes ACTIVE.
9. Update `gaming_match`: `status = 'RUNNING'`, `timestamp_start = NOW()`,
   `id_character_current_turn = first_character.id`.
10. Return `MatchStartResponse` with the full ordered queue.

### 6.3 Pass turn logic (`POST .../action/pass`)

1. Validate match exists and caller has a character in it (→ 404 if not).
2. Validate `status == RUNNING` (→ 409 `MATCH_NOT_RUNNING`).
3. Load active queue entry (`id_character_current_turn`); check that `id_user` of the
   active character equals the calling user (→ 409 `NOT_YOUR_TURN`).
4. Set `timestamp_end = NOW()` and increment `pass_counter` on the active row.
5. Load all remaining WAITING rows for the current clock (ordered by `priority DESC`).
6. If a WAITING row exists: set its `timestamp_start = NOW()`; update
   `gaming_match.id_character_current_turn`.
7. If no WAITING rows remain (all COMPLETED for this clock): the clock cycle ends.
   - For Step 24 (single-player), a single-character match ends the clock immediately;
     a new queue round begins (insert fresh rows for the same clock + 1, or delegate to
     Step 26 time-advancement hook).
   - `gaming_match.counter_consecutive_pass` is incremented when all characters passed
     with remaining energy (all-pass round detection, consumed by Step 26/66).
8. Return `PassTurnResponse`.

### 6.4 Turn sequence query (`GET .../turn-sequence`)

1. Validate match and caller participation (→ 404 if not).
2. Load all `gaming_turn_queue` rows for the match's `current_clock`.
3. Derive `status` for each row (§5.3).
4. Enrich with character name and uuid from `gaming_character_instance`.
5. Sort by `priority DESC`.
6. Return `TurnSequenceResponse`.

---

## 7. Per-Project Implementation Plan

### 7.1 Java (reference implementation)

**Core module (`core/src/main/java/.../`)**

- [ ] `service/match/TurnPriorityCalculator.java` — pure static helper; formula §6.1
- [ ] `service/match/TurnCycleService.java` — start / pass / sequence methods
- [ ] `model/match/TurnQueueEntry.java` — domain model with derived `TurnStatus` enum
- [ ] `model/match/TurnSequenceResult.java` — aggregate result model
- [ ] `repository/match/GamingTurnQueueRepository.java` — port interface:
  - `insertAll(List<TurnQueueEntry>)`
  - `findByMatch(long idMatch, int clock)`
  - `updateStart(long idMatch, long idCharacter, Instant now)`
  - `updateEnd(long idMatch, long idCharacter, Instant now)`
  - `incrementPassCounter(long idMatch, long idCharacter)`
- [ ] Exception codes: `MATCH_NOT_STARTABLE`, `NO_CHARACTERS_JOINED` in `MatchStartException`
- [ ] Exception: `TurnPassException` with codes `MATCH_NOT_RUNNING`, `NOT_YOUR_TURN`

**Adapter-postgres / adapter-sqlite**

- [ ] `GamingTurnQueueRepositoryImpl.java` — JPA entity + JPQL or native queries
- [ ] `GamingTurnQueueEntity.java` — `@Entity` mapped to `gaming_turn_queue`

**Adapter-rest**

- [ ] `dto/match/TurnQueueEntryResponse.java`
- [ ] `dto/match/TurnSequenceResponse.java`
- [ ] `dto/match/MatchStartResponse.java`
- [ ] `dto/match/PassTurnResponse.java`
- [ ] `TurnController.java` (or extend `MatchController`):
  - `POST /api/matches/{uuidMatch}/start`
  - `POST /api/gameplay/{uuidMatch}/action/pass`
  - `GET /api/match/{uuidMatch}/turn-sequence`
- [ ] OpenAPI spec `v0.24.0-turn-cycle-api.yaml`

**Unit tests (`core/src/test/.../service/match/`)**

- [ ] `TurnPriorityCalculatorTest` — formula correctness, tie-breaking
- [ ] `TurnCycleServiceTest`:
  - `StartMatch` nested: success; `MATCH_NOT_STARTABLE`; `NO_CHARACTERS_JOINED`; queue ordering
  - `PassTurn` nested: success; `MATCH_NOT_RUNNING`; `NOT_YOUR_TURN`; next-in-queue activation; all-completed round detection
  - `TurnSequence` nested: correct status derivation; ordering; caller not in match

### 7.2 Python backend

- [ ] `app/core/services/match/turn_priority_calculator.py` — `compute_priority(char)` function
- [ ] `app/core/services/match/turn_cycle_service.py` — `start_match`, `pass_turn`, `get_turn_sequence`
- [ ] `app/core/models/match/turn_queue.py` — `TurnQueueEntry` dataclass
- [ ] `app/core/ports/match/turn_queue_port.py` — abstract port
- [ ] `app/adapters/persistence/match/turn_queue_repository.py` — SQLAlchemy / raw SQL implementation
- [ ] `app/adapters/rest/match/turn_controller.py` — three FastAPI routes
- [ ] `tests/match/test_turn_priority_calculator.py`
- [ ] `tests/match/test_turn_cycle_service.py`
- [ ] `tests/match/test_turn_controller.py`

### 7.3 AWS Lambda (Python 3.13 + DynamoDB)

- [ ] `lambda/match/turn_handler.py` — handlers for `start_match`, `pass_turn`, `get_turn_sequence`
- [ ] DynamoDB item design (§3.8): turn entries with PK=`MATCH#{uuid}`, SK=`TURN#{clock}#{priority}#{idChar}`
- [ ] Update match item: `status`, `id_character_current_turn`, `timestamp_start` attributes
- [ ] `template/match.yaml` — SAM routes:
  - `POST /api/matches/{uuidMatch}/start`
  - `POST /api/gameplay/{uuidMatch}/action/pass`
  - `GET /api/match/{uuidMatch}/turn-sequence`
- [ ] `tests/test_turn_handler.py` — pytest unit tests (mock DynamoDB with `moto`)


### 7.4 React-Game (`code/frontend/react-game/src`)

- [ ] `src/api/matches.js` — add `startMatch(matchUuid)` function
- [ ] `src/api/gameplay.js` — add `passTurn(matchUuid)` function
- [ ] `src/api/matches.js` — add `getTurnSequence(matchUuid)` function
- [ ] `src/mock/matchMock.js` — mock responses for `start`, `pass`, `turn-sequence`
- [ ] `src/components/TurnOrderPanel.jsx` — displays the ordered queue; highlights ACTIVE row
- [ ] `src/components/PassTurnButton.jsx` — disabled when it is not the player's turn
- [ ] `src/pages/MatchPage.jsx` (or equivalent game page) — integrate "Start Match" button
  (visible only in `CREATED` status) and `TurnOrderPanel`
- [ ] `src/context/MatchContext.js` — store `activeCharacterUuid` and `queue` state;
  refresh after `start` and `pass` calls
- [ ] `src/test/TurnOrderPanel.test.js` — unit tests for rendering / active highlight
- [ ] `src/test/PassTurnButton.test.js` — enabled/disabled state
- [ ] `src/test/turnApi.test.js` — mock API call coverage

### 7.5 React-Admin (`code/frontend/react-admin/src`)

The turn-sequence endpoint is informational for administrators.  No write operations
are exposed in the admin console.

- [ ] `src/constants/match/matchEntities.jsx` — extend match detail to include a
  "Turn Sequence" sub-section calling `GET /api/match/{uuid}/turn-sequence` via the
  admin JWT on port 8044 (if the endpoint is routed through the admin connector) or
  directly on 8042.
- [ ] `src/components/TurnSequenceAdminView.jsx` — read-only table showing character
  name, priority, status, clock, passCounter, and timestamps.
- [ ] Note: if the turn-sequence endpoint is not proxied through port 8044 in the Java
  admin connector configuration, the react-admin view should either call 8042 (with
  admin JWT allowed on the public port) or be deferred to Step 41 (full game board).

---

## 8. Testing Strategy

### 8.1 Unit tests

| Backend | Target file(s) | Key scenarios |
|---------|----------------|---------------|
| Java | `TurnPriorityCalculatorTest` | Formula with all zero stats; max values; tie-breaking via `id` |
| Java | `TurnCycleServiceTest` | Queue ordering; all 5 error codes; single-character all-completed detection |
| Python | `test_turn_priority_calculator.py` | Same formula scenarios as Java |
| Python | `test_turn_cycle_service.py` | Start / pass / sequence with mock port |
| AWS | `test_turn_handler.py` | DynamoDB item creation; SK ordering; status derivation |

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

Suite: `code/tests/robot/tests/24_turn_cycle/turn_cycle.robot`

New keywords in `code/tests/robot/resources/matches.resource`:
- `Start Match` (POST `.../start`)
- `Pass Turn` (POST `.../action/pass`)
- `Get Turn Sequence` (GET `.../turn-sequence`)

#### Test cases

| Test case | Assertions |
|-----------|------------|
| Start match transitions status to RUNNING | `status == RUNNING` in response |
| Turn sequence returns ordered queue | First entry has highest priority; `status == ACTIVE` |
| Priority formula is deterministic | Computed priority matches `(DEX×3+INT×2+COS×1)×1000+LIFE×10+id` |
| Only one entry is ACTIVE at a time | Exactly one `ACTIVE` in queue; others `WAITING` |
| Pass turn advances to next character | `nextActiveCharacterUuid` differs from `passedCharacterUuid`; queue updated |
| Pass turn increments pass counter | `passCounter` of passed entry is 1 after one pass |
| 409 MATCH_NOT_STARTABLE on double start | Second start call returns `409 MATCH_NOT_STARTABLE` |
| 409 NOT_YOUR_TURN on wrong player | Pass by user who is not the active character returns `409 NOT_YOUR_TURN` |
| 409 MATCH_NOT_RUNNING on pass before start | Pass on a CREATED match returns `409 MATCH_NOT_RUNNING` |
| 404 MATCH_NOT_FOUND for non-participant | Turn sequence for unknown uuid returns `404` |

Variables potentially added to `code/tests/robot/variables/dev.yaml`: none required;
the suite reuses `MATCH_UUID`, `GUEST_TOKEN`, and character uuids from the existing
match / join flow established in suites 19 and 21.

---

## 9. API Changes Summary

| Endpoint | Status |
|----------|--------|
| `POST /api/matches/{uuidMatch}/start` | NEW (v0.24.0) |
| `POST /api/gameplay/{uuidMatch}/action/pass` | NEW (v0.24.0) |
| `GET /api/match/{uuidMatch}/turn-sequence` | NEW (v0.24.0) |

---

## 10. Notes and Open Questions

1. **Admin port exposure** — the `GET /api/match/{uuidMatch}/turn-sequence` endpoint
   may be duplicated on port 8044 under `/api/admin/matches/{uuid}/turn-sequence` to
   allow the react-admin console to poll it without cross-port calls.  Decide at
   implementation time.

2. **All-completed round transition** — when all characters complete their turns in a
   clock cycle, Step 24 may either (a) start a new round immediately (re-insert queue
   rows for the same clock) or (b) delegate to Step 26 time-advancement.  For
   single-player with one character, (a) is the correct behaviour.  Implementors should
   stub the Step 26 hook as a no-op now.

3. **Priority on re-joins** — if Step 26 recalculates the queue, it will call
   `TurnPriorityCalculator` again with updated stats.  The calculator must remain
   pure and stateless to support this.

4. **`priority` column type** — defined as `INTEGER` in the V0.10.7 SQLite migration
   and `BIGINT DEFAULT 0` in the comment.  For PostgreSQL use `BIGINT` to avoid
   overflow on high-stat characters; SQLite `INTEGER` can hold up to 64 bits so both
   are safe.

---

# Version Control

- **Document Version**: 0.24.0

    | Version | Description | Date |
    | --- | --- | --- |
    | 0.24.0 | Planning document for Turn Cycle Engine: priority formula, queue initialisation on match start, WAITING/ACTIVE/COMPLETED state machine, pass action, turn-sequence query; full implementation plan for Java/Python/AWS/React-Game/React-Admin/Robot | June 13, 2026 |

- **Last Updated**: June 13, 2026
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
