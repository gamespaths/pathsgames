# Step 33 — Location entry events (automatic triggers)

[Step 28](./Step28_MovementSystem.md) made movement geometric: adjacency, energy cost,
validation, and nothing else — its own header states the scope is "only the move + energy.
Automatic location-entry events are Step 33". [Step 26](./Step26_TimeStartRecovery.md)
decremented location counters and, when one reached zero, wrote a log row naming the
location's `id_event_if_counter_zero` as *pending* — and stopped there. Step 33 closes both
openings with a single engine hook: the story reacts to a character **arriving somewhere**,
and to a time unit **starting** — whether because a location's clock ran out or simply
because someone was standing there when it began.

Two things follow from that framing and shape every decision below:

- The trigger is the engine, never the player. There is no new endpoint and no new player
  action — arrival and time-start are consequences of `movements/start`, `execute-event`,
  `select-choice` and the time-start recovery pass that already exist.
- Because there is no player in the loop, an automatic event has **no one to ask**. This is
  the reasoning behind §4, the hardest constraint in this step, and it holds regardless of
  which column names the event (§1).

---

## 1. Why triggers bind on the location, not the event

Every automatic trigger is authored on `list_locations`, through five columns that have
existed since `V0.10.3__create_story_locations_items.sql`:

| Column | Fires when |
|---|---|
| `id_event_if_first_time` | the party arrives at the location for the first time in the match |
| `id_event_not_first_time` | any later arrival |
| `id_event_if_character_enter_first_time` | the arriving character found nobody else there |
| `id_event_if_counter_zero` | the location's `counter_time` fuse (Step 26) reached zero |
| `id_event_if_character_start_time` | a time unit began with somebody standing there |
| `priority_automatic_event` | orders one time-start's events across locations — lower first, ties by `id_location` |

An alternative was on the table: three new `list_events.type` values
(`AUTOMATIC_FIRST_ENTRY`, `AUTOMATIC_SUBSEQUENT_ENTRY`, `AUTOMATIC_FIRST_IN_LOCATION`),
selected at runtime by `type` plus the event's own `idSpecificLocation` column — the same
column
[`EventAvailabilityChecker.java:73`](../code/backend/java/core/src/main/java/games/paths/core/service/match/EventAvailabilityChecker.java#L73)
already uses to scope `NORMAL`/`ONCE` events to a place. It was rejected, because the six
columns above were not a gap waiting to be filled — they were already wired end-to-end,
through `LocationEntity.java` and `StoryCrudService.java`, and — the detail that made this
decisive rather than merely convenient — **already exposed as event pickers in the
react-admin story editor** (`StoryEditorPage.jsx`, `pathSelectorOptionsByTab.locations`, one
form field per column). Adding three new `type` values would have left those columns dead
forever and built a second, parallel mechanism to do the job the first one was already set
up to do.

Location-side binding has one direct consequence for the schema: **no new
`list_events.type` value exists.** A referenced event keeps `type = 'AUTOMATIC'` — the same
value every seeded story already carried before this step — and the executability allowlist
(`EXECUTABLE_TYPES = {NORMAL, ONCE}`) refuses it to players automatically. It is an
allowlist rather than a denylist: a value the engine never adds to the player-executable set
stays refused by default, with no per-value gate to maintain and no migration required for
the column itself.

It also has one consequence for authoring: automatic events are never selected by an event's
own `idSpecificLocation`. A location's five columns point *at* an event; the event does not
point back. `idSpecificLocation` keeps its existing, unrelated job of scoping `NORMAL`/`ONCE`
events to a place, untouched by this step.

## 2. Trigger resolution — five triggers, two passes, one order

The Roadmap's original three triggers (first entry, subsequent entry, first-in-location) are
joined by two more that share the time-start pass with the counter (Step 26's dead end,
closed in §3): a counter reaching zero, and a time unit beginning with a character standing
somewhere. Five triggers in total, resolved in two different passes:

| Trigger | Column read | Pass |
|---|---|---|
| First entry | `id_event_if_first_time` | Arrival (`movements/start`, or any effect that moves a character) |
| Subsequent entry | `id_event_not_first_time` | Arrival |
| First-in-location | `id_event_if_character_enter_first_time` | Arrival |
| Counter-zero | `id_event_if_counter_zero` | Time-start recovery |
| Character-start-time | `id_event_if_character_start_time` | Time-start recovery |

**On arrival**, the first two are mutually exclusive — a location's history trigger is either
"first" or "subsequent", never both, decided by `flag_visited` **before** it is latched for
this arrival — and the third is orthogonal, a property of who else is standing there, and may
fire alongside either. The order within one location is therefore fixed, not authored:
history trigger, then occupancy trigger —
[`EventExecutionService.java:1195-1207`](../code/backend/java/core/src/main/java/games/paths/core/service/match/EventExecutionService.java#L1195-L1207).

**At time-start**, counter-zero and character-start-time are independent of each other and of
the arrival pair — a location's counter reaching zero and a time unit beginning with someone
in that same location are two separate reasons for two separate events, and both can fire on
the same location in the same pass.

**Ordering across locations is specified.** The pending list built during time-start recovery
is sorted deterministically,
[`TimeStartRecoveryService.java:220-222`](../code/backend/java/core/src/main/java/games/paths/core/service/match/TimeStartRecoveryService.java#L220-L222):

```java
// Deterministic across locations: priority_automatic_event first, then location id.
pending.sort(Comparator.comparingInt(PendingAutomaticEvent::priority)
        .thenComparingLong(PendingAutomaticEvent::idLocation));
```

`priority_automatic_event` runs first (lower first, defaulting to `0` when unauthored), ties
broken by `id_location`. **Tests may assert this order** — it is a contract the
`priority_automatic_event` column exists specifically to give authors, not an incidental
detail of query order.

`flag_visited` is latched **after** an arrival's triggers are read — including when the
location authors no trigger at all, because the flag records the party's history, not
whether anything fired.

## 3. Counter-zero events — finally executed, and by whom

[Step 26](./Step26_TimeStartRecovery.md) left a genuine dead end. In
`TimeStartRecoveryService`, the counter was decremented, and on reaching zero the location's
`id_event_if_counter_zero` was written to the log as `pending event N` — after which no one
executed it. Step 26's own "known limitations" list called this out and pointed at Step 29 as
the step that would close it; Step 29 turned out not to be that step either. Step 33 finally
executes it, through the same chain runner used for entry triggers.

### The no-restart invariant

**When a location counter reaches zero it stays at zero. It never restarts, and its event
fires exactly once per match.** This was already enforced by Step 26 and Step 33 does not
touch the mechanism: the decrement loop skips exhausted counters (`if (current <= 0)
continue;`), `markStateLocationActivated` latches `flag_already_actived = 1` on reaching zero,
and the counter re-seed block is guarded by that same flag. `flag_already_actived` continues
to mean exactly "this location's counter has been consumed" — Step 33 does not reuse it for
anything else (§5).

### The actor — who a counter-zero event happens to

An entry trigger always has an actor: the character who just walked in. A counter-zero or
character-start-time trigger does not — it belongs to a location, not to whoever happens to
be in the room, and the room can be **empty**.

**The nominal actor is the lowest-id character standing in that location** at the moment the
time-start pass resolves it — deterministic, and irrelevant to a story author who should not
be writing effects that depend on *which* character receives them. `target: ALL` on an effect
then resolves to **everyone standing there**, never the whole match — the same
recipient-resolution rule Step 27's weather and Step 29's events already use (INV-27),
reused rather than reinvented.

If the location has **no one in it**, the event runs anyway, with **no actor at all**:
registry writes, weather changes, and the `id_event_next` chain still apply, because they
describe the world rather than a character. Effects that need a recipient — a stat change, an
item grant — are silently skipped; there is no one to receive them and no error to raise. A
counter can legitimately expire in an empty room, and the world still needs to record that the
fire went out, even though nobody who could have life or sadness changed was there to see it.

This forced one internal change worth recording, because it is easy to reintroduce by
accident: `applyRegistryEffect` used to sit behind an `actor != null` guard inherited from the
ordinary event-execution path, so with no recipients present a registry write would have been
silently dropped along with the stat effects. It was hoisted out of the per-recipient loop so
it always runs once, regardless of who — if anyone — is standing there. Behaviour for a
populated location is unchanged; an empty one now actually writes the registry key it was
supposed to.

## 4. An automatic event carries effects, never choices

> **Invariant: no event named by any of the five trigger columns — entry-triggered or
> counter-triggered — may own rows in `list_choices`. Automatic events apply effects and
> chain; they never open a decision.**

This is not a simplification, it is forced by the architecture of Steps 31–32. A
choice-owning event does not resolve when executed: [Step 31](./Step31_ChoiceEngine.md)
branches `execute-event` to `status: CHOICES_PENDING` and hands the options back **in the
HTTP response**, and [Step 32](./Step32_ChoiceResolution.md) resolves them through a second
call to `select-choice`, gated on an open cycle counted from `EVENT_EXECUTED` vs
`CHOICE_SELECTED` markers.

An automatic event has neither half of that mechanism:

- **No response to carry the options.** A counter reaching zero happens inside the time-start
  recovery pass, which answers no one. An entry trigger fires mid-movement, whose response is
  a movement result.
- **No actor guaranteed to be able to answer.** A counter-zero or character-start-time event
  fires for a location, not for a player — §3 established the actor may not even exist — and
  even where characters are present they may be asleep or comatose, with Step 29's guards
  refusing them the choice anyway.
- **An unresolvable open cycle.** Writing `EVENT_EXECUTED` for a choice-owning automatic
  event would open a cycle that no `select-choice` call can ever close — the match would carry
  a permanently pending decision, and Step 32's guard would treat the event as still open
  forever.

Branching narrative therefore stays where a player exists to choose it: `NORMAL` and `ONCE`
events. An automatic event that needs to *lead somewhere* uses `idEventNext` — the chain
already runs effects unconditionally and honours the interrupt flag — or an effect's
`idEventTorun`. Both are deterministic, which is the correct semantics for something the
engine decides on the player's behalf.

Enforcement is at authoring time, not at runtime: §6 hard-fails the import. The engine
additionally refuses such an event and logs it rather than opening a cycle, so a story that
somehow reaches production cannot wedge a match —
[`EventExecutionService.java:1256-1261`](../code/backend/java/core/src/main/java/games/paths/core/service/match/EventExecutionService.java#L1256-L1261).

## 5. Database — two additive columns

Distinguishing first entry from subsequent entry needs a per-`(match, location)` "has been
visited" latch. Making the counter-zero log row sortable (§7) needs a structured place for the
location id, which would otherwise live only inside a log message string. Both land in one
migration:

```sql
-- V0.33.0__location_entry_events.sql  (SQLite and PostgreSQL)
ALTER TABLE gaming_state_locations ADD COLUMN flag_visited INTEGER NOT NULL DEFAULT 0;
ALTER TABLE log_events            ADD COLUMN id_location  INTEGER;  -- BIGINT on Postgres
```

Both columns are additive — defaulted or nullable — with no backfill. Matches in flight start
every location at "never visited", which is the correct reading for a trigger that did not
exist when they began; existing `log_events` rows simply have no location, which is also
correct — nothing retroactively knows where they happened.

**`flag_already_actived` is not reused for `flag_visited`.** §3 established that the former
means "the counter has been consumed". Overloading it with "the location has been visited"
would produce two bugs at once, in opposite directions: entering a location would suppress the
legitimate counter re-seed of Step 26 block `1a`, and a counter reaching zero would make a
never-entered location look already visited — permanently suppressing its first-entry event.
`flag_visited` is a distinct column for a distinct fact.

**Scope of the flag.** `flag_visited` is keyed `(id_match, id_location)`, exactly like the
rest of `gaming_state_locations`. First entry is the **party's**, not the character's: in
multiplayer, player B arriving where player A has already been receives the subsequent-entry
event, never the first-entry one — it has already been spent. This is deliberate: an automatic
location event is **ambient**, describing something happening in the world once — a door found
open, a body discovered, a fire still warm — not a per-witness cutscene replayed for each
arrival. Per-character first entry is a non-goal; it would require a table keyed `(id_match,
id_location, id_character)`, growing with party size rather than with the map.

**The starting location is seeded as already visited.** Characters are placed at
`list_stories.id_location_start` when they are created, with no movement logged, so left alone
`flag_visited` would stay `0` there and the first time a player walked **back** to where they
began, the first-entry event would fire — announcing as a discovery the place the story opened
in. The fix is one line inside the loop that already seeds every location's state row at match
creation
([`MatchCommandService.java:154-156`](../code/backend/java/core/src/main/java/games/paths/core/service/match/MatchCommandService.java#L154-L156)):

```java
sl.setFlagVisited(loc.getId() != null
        && story.getIdLocationStart() != null
        && loc.getId().longValue() == story.getIdLocationStart().longValue() ? 1 : 0);
```

It is deterministic and multiplayer-safe without further thought, because `id_location_start`
is a story-level column shared by every character in the match. This also reconciles
`flag_visited` with the *derived* visited set of [Step 28 §6.3](./Step28_MovementSystem.md),
which already counts `character.id_location` as visited from match creation for fog-of-war
purposes — the two notions serve different consumers (query-time fog of war vs. stored
trigger state) but had to agree from turn one, and do.

### Forced movement — the authoring contract and the depth cap

An automatic event may move a character: `EventEffectEntity.idLocation` is applied through
`applyMove`, and a counter-zero event is explicitly allowed to pull characters into a given
location. That move is itself an arrival, so it re-enters trigger resolution — a story can
describe a cycle (A moves you to B, B moves you back to A). **Not creating one is the story
author's responsibility; the engine does not detect the cycle statically.**

What the engine does do is bound the blast radius: **`MAX_ENTRY_DEPTH = 8`**, in all three
backends. Location-side binding (§1) makes this kind of loop cheap to write by accident — two
admin form fields on two locations, no coordinated event types, no code — so an unbounded
cascade turns one bad edit into a request that never returns. `MAX_ENTRY_DEPTH` converts that
hang into a logged abort at depth 8, chosen as comfortably above any legitimate chain the
seeded stories use, not as a claim about how deep a story is allowed to reason. It does not
replace the authoring contract: a looping story still does not do what its author intended, it
just no longer hangs the server while doing it wrong.

## 6. Validation — Step 22 extension

Two rules, hard-failing on import and reported leniently by `/validate` and admin CRUD,
consistent with [Step 22](./Step22_StoryValidation.md):

| Code | Rule |
|---|---|
| `R9_AUTOMATIC_EVENT_CHOICES` | an event named by any of the five trigger columns owns rows in `list_choices` (§4) |
| `R9_AUTOMATIC_EVENT_TYPE` | an event named by any of the five trigger columns has `type` equal to `NORMAL` or `ONCE` |

`R9_AUTOMATIC_EVENT_TYPE` exists because an event a location trigger column names must
**not** be `NORMAL` or `ONCE` — either would make it *simultaneously* player-executable
(through the ordinary availability checkers) and engine-fired (through this step), two
different callers independently deciding when the same event runs, exactly the ambiguity the
`EXECUTABLE_TYPES` allowlist exists to prevent for every other event. Because triggers bind on
the location (§1), this check reads the location's five columns rather than an event's own
`idSpecificLocation`.

The five trigger columns also joined the `R1` referential-integrity walk. They had never been
checked before this step — a location could point `id_event_if_first_time` at a non-existent
event and nothing said so; `R1` now walks them like every other event reference.

## 7. Bug fix — `logCounterZero` never stamped the clock (and AWS never wrote a row at all)

`RecoveryStoreAdapter` wrote the counter-zero row with `id_match`, `id_event` and
`log_message`, and left `clock` NULL — unlike `logSleep`, which stamps it. `MatchLogsService`
surfaced these rows by typing any `log_message LIKE 'counter%'` as `RECOVERY`, so the row was
visible in `GET /api/matches/{uuidMatch}/logs` but unsortable — outside the clock-ordered
timeline. AWS had the same gap in a more literal form: it wrote **no row at all**, because
AWS's match-log timeline did not exist yet when Step 26 shipped.

Now, across all three backends:

- `clock` is stamped with the match's current clock when the row is written.
- The row gets its own log type, `COUNTER_ZERO`, instead of being folded into `RECOVERY` — a
  counter expiring and a character recovering stats are unrelated events, and the frontend
  needs to tell them apart. A second new type, `AUTOMATIC_EVENT`, covers the *execution* of the
  event the counter scheduled: `MatchLogsService` drops any `log_events` row whose message
  prefix it does not recognise, and an executed automatic event is a distinct audit fact that
  needed its own branch to survive that filter.
- `id_location` is a structured column (§5's migration) instead of a value parsed out of the
  message string.

This repairs timeline ordering, and it made the counter-zero row exist on AWS for the first
time.

## 8. Frontend — automatic events on arrival, and the wake-up list

Two different surfaces carry Step 33's output, because arrival and time-start deliver to
different places.

### Arrival — `automaticEvents[]` on the response that caused it

Any response that can cause a character to arrive somewhere carries the events firing
produced: `POST movements/start` (an ordinary move), and `POST action/execute-event` and
`POST action/select-choice`, because either can move a character through an effect, which is
itself an arrival (§5's forced-movement note). Each entry is one fired event and its whole
`id_event_next` chain:

```jsonc
"automaticEvents": [
  {
    "trigger": "FIRST_ENTRY",
    "idLocation": 90002,
    "eventUuid": "6b1f7a2c-6f3e-4a5d-9c11-0b2d3e4f5a60",
    "card": { "...": "..." },
    "effects": [ /* AppliedEffect[] */ ],
    "statChanges": [ /* StatChange[] */ ],
    "locationChanges": [ /* characters this event itself moved — each one an arrival too */ ],
    "gameOver": false
  }
]
```

`trigger` is one of `FIRST_ENTRY`, `SUBSEQUENT_ENTRY`, `FIRST_IN_LOCATION`, `COUNTER_ZERO`,
`CHARACTER_START_TIME` — a plain string tag on the response, not a `list_events.type` value
(§1: no such values exist). react-game's `GameBook.jsx` renders the list through
`showAutomaticEvents(result.automaticEvents)`, called from `handleMovementDone`: each fired
event is chained behind the existing forward arrow (→), so a movement that triggers one, two,
or several automatic events reads as a sequence of pages rather than arriving all at once.

### Time-start — `counterZero[]` on the sleep response

A time-start can fire counter-zero and character-start-time events at **several** locations at
once (§2's ordering applies here too), so this payload is a list, delivered on the book's
right page immediately after the sleep that advanced the clock — the player falls asleep and
wakes to find what changed in the world:

```jsonc
"counterZero": [
  { "trigger": "COUNTER_ZERO", "idLocation": 90001,
    "card": { "...": "..." },
    "cardLocation": { "...": "..." },
    "cardEffects": [
      { "eventUuid": "…", "effectUuid": "…", "statistic": "…", "value": 1,
        "target": "…", "targetClass": null, "characterUuids": [], "card": { "...": "..." } }
    ],
    "eventUuid": "…", "clock": 7, "visibility": "FULL" }
]
```

**v0.33.1 bugfix:** `card` now carries the **event's** narrative, not the location's — the
event's card and its applied effects were already computed into `AutomaticEventFired` and then
discarded by `describeForRecipient`, so the player woke up to the name of a place instead of
the news of what happened in it. Two fields were added to recover what was lost: `cardLocation`
(nullable) holds what `card` used to hold — the location's own card — and `cardEffects` is the
array of `AppliedEffect` the fired event produced (same shape `execute-event` returns:
`eventUuid, effectUuid, statistic, value, target, targetClass, characterUuids, card`), each
row's own `card` being the narrative the board actually renders per effect. `trigger`,
`idLocation`, `eventUuid`, `clock`, `visibility` are unchanged. No new DB columns, no schema
change, no new endpoint — `SleepActionResponse` reuses the existing
`ExecuteEventResponse.AppliedEffectDto` rather than a new DTO.

The payload no longer carries a synthetic `locationName` string — deliberately, since v0.28.6
removed those fields from the API surface (`list_locations.id_card` is how a place is named
now), and a name field here would have reintroduced exactly what that step tore out. Under
`ANONYMOUS` visibility, all three card fields are **omitted from the payload entirely**, not
hidden client-side — nothing about a place the player has never seen leaves the server:

| Recipient's relation to the location | `visibility` | Rendered as |
|---|---|---|
| is currently there | `FULL` | the event's card, the location's card, and per-effect cards |
| has visited it before | `NAMED` | the same three cards |
| has never visited it | `ANONYMOUS` | `card: null`, `cardLocation: null`, `cardEffects: []` |

react-game renders this list through `AutomaticEvents.jsx` (v0.33.1; replaces the earlier
`CounterZeroList.jsx`), reusing the right-page mechanics `PendingChoicesList` established for
Step 31. It renders reading pages (`Card variant="page"`) rather than the small
`selection-list` grid `CounterZeroList` used — this is something to read, not a set of things
to choose between. Card choice per entry: the first
`cardEffects[].card` that exists, else the event's `card`, else a generic "time ran out"
notice; `ANONYMOUS` shows the anonymous notice with no preview lens. `cardLocation` is computed
by the backend but deliberately not rendered by the board yet. Precedence on wake-up, highest
first: **`previewRight` → `pendingChoices` → `counterZero` → `weather` → board.** A
counter-zero card that opens choices cannot exist (§4), so `pendingChoices` and `counterZero`
never actually contend for the same beat; the ordering only decides what the player reads
first when a weather change and a counter-zero list are both pending on the same wake-up.

## 9. Multiplayer — why this payload is designed as a list of recipients

Time advances **once per match**, when `allCharactersDone()` turns true — every character
asleep or out of energy. In multiplayer that means the clock is advanced by whoever falls
asleep **last**, and only that player has an open HTTP request at that instant; everyone else
is holding the response to their own earlier sleep call, which returned `triggered: false` and
an empty `counterZero[]`.

So §8's delivery is complete for single-player and structurally insufficient for multiplayer —
a request/response can only reach the one player who happened to close the cycle. The same
applies to `forceTimeEnd`: one player's `flag_end_time` event ends the time unit for everybody.

The seam for the fix already existed and did not need to change: `advanceTime` publishes a
domain event,

```java
eventPublisher.publish(new TimeAdvanced(match.uuid(), newClock));  // TimeAdvancementService:181
```

and Step 33 hooks into it rather than beside it. One wiring detail is worth being explicit
about, because a future reader will not guess it from the class names alone:
**`TimeStartRecoveryService` collects the pending automatic events during its pass but does
not run them.** The event engine sits above it in the dependency graph — a counter-zero
event's own chain can itself force a time end, which loops straight back into
`TimeAdvancementService` — so running the pending list from inside `TimeStartRecoveryService`
would have closed a cycle in the bean graph. Instead, `TimeAdvancementService` runs the list
once the recovery pass returns, through a setter-injected callback,
`TimeAdvancementService.setAutomaticEventRunner`. That setter is the only cycle-breaker in the
bean graph, and it exists for exactly this reason.

When [Steps 49-54](./Roadmap.md) land the WebSocket broker, the same `TimeAdvanced` event
carries the `counterZero[]` payload and is broadcast to `/topic/match/{matchId}`; every client
renders the identical right-page list on waking, and the HTTP response becomes a redundant
fast path for the one player who triggered it.

The fog-of-war filter of §8 must be applied **per recipient**, because every player has their
own visited set — so the engine produces the counter-zero list **unfiltered**, and only the
delivery layer applies `visibility`, once per recipient. Single-player is simply the
one-recipient case of that same code path.

One more implementation detail earns a mention here, because it follows §3's "no actor
guaranteed" reasoning into a different backend: AWS's `events.build_context` used to
short-circuit to `{"idCharacter": None}` whenever it was called with no caller, because every
previous caller of the event engine was a player. An automatic event in an empty location is
not a player — it needs a full context (registry, weather, story state) with no character in
it, so `build_context` now returns the same shape it would for a player, minus the
character-specific fields.

`flag_visited` remains match-scoped, so a first-entry event fires once for the party, not once
per player (§5) — the asymmetry between *whether* an event fires (a property of the match) and
*what each player is told about it* (a property of the recipient) is the design in one line.

## 10. Scope of change

| Layer | Path |
|---|---|
| Migration | `adapter-{sqlite,postgres}/src/main/resources/db/migration/v0/V0.33.0__location_entry_events.sql` — **two** columns: `gaming_state_locations.flag_visited` and `log_events.id_location` |
| Engine (Java) | `EventExecutionService` implements `EventExecutionPort` and `LocationEntryPort` (`onArrival`, `runPendingAutomaticEvents`, `describeForRecipient`, `runAutomaticEvent`, `resolveArrival`, `drainArrivals`, `MAX_ENTRY_DEPTH`); `MovementService` gains a nullable `LocationEntryPort` hooked after its two commit writes; `TimeStartRecoveryService.TimeStartOutcome(recovery, pending)` — collects the pending list but does not run it (§9); `TimeAdvancementService.setAutomaticEventRunner` runs it once recovery returns |
| Entities (Java) | `GamingStateLocationsEntity.flagVisited`; `LogEventsEntity.idLocation` |
| Inbound port (Java) | `core/port/match/LocationEntryPort.java` (new) — implemented by `EventExecutionService` itself rather than a dedicated service, because a forced move IS an arrival: splitting entry-resolution out would only have created a second cycle against the chain runner |
| Persistence (Java) | `core/persistence/match/LocationEntryStoreAdapter.java` (new — implements `LocationEntryStorePort`); `RecoveryStoreAdapter.logCounterZero` (clock + `idLocation`) |
| REST (Java) | `AutomaticEventResponse`; `MovementStartResponse.automaticEvents`; `SleepActionResponse.counterZero` (v0.33.1 — `CounterZeroItem` widened to `card`/`cardLocation`/`cardEffects`, reusing `ExecuteEventResponse.AppliedEffectDto`); `ExecuteEventResponse.automaticEvents`; `MatchInfoResponse.LocationStateDto.flagVisited` |
| Authoring (Java) | `core/service/story/StoryCrudService.java` (unchanged — the five trigger columns and `priorityAutomaticEvent` have round-tripped through admin CRUD since `V0.10.3`); `core/service/story/StoryValidatorService.java` (`R9_AUTOMATIC_EVENT_CHOICES`, `R9_AUTOMATIC_EVENT_TYPE`, `R1` extended to the five trigger columns) |
| OpenAPI | `v0.33.0-location-entry-events-api.yaml` (new); `v0.28.0-movement-api.yaml` (`automaticEvents[]`), `v0.25.0-time-clock-api.yaml` (`counterZero[]`), `v0.28.7-match-logs-api.yaml` (two new log types) updated |
| Engine (Python) | `EventService` location engine; `MovementService.location_entry`; `TimeStartOutcome`; `TimeAdvancementService.set_automatic_event_runner`; `launcher.py` wiring; v0.33.1 widened `describeForRecipient`'s equivalent in `app/core/services/match/event_service.py` and `app/core/models/match/location_entry_models.py` to carry `card`/`cardLocation`/`cardEffects` |
| Schema (Python) | `app/core/models/match/location_entry_models.py`, `core/ports/match/location_entry_ports.py`, `adapters/persistence/match/location_entry_store_adapter.py` (all new); the five trigger columns added to `LocationEntity` (Python never carried them before this step); `flag_visited` on `GamingStateLocationEntity`; `id_location` on `LogEventsEntity`. **No migration file** — Python owns no Flyway equivalent; `Base.metadata.create_all()` picks up the new columns. |
| Engine (AWS) | `lambda/match/events.py` (Step 33 constants, null-actor-safe `resolve_recipients`, full `build_context` when `caller is None`); `lambda/match/handler.py` (`_resolve_arrival`, `_run_automatic_event`, `_run_pending_automatic_events`, `_describe_for_recipient` — v0.33.1 widened to emit `card`/`cardLocation`/`cardEffects` instead of the location card alone —, `_visited_location_ids`, `flagVisited` seeding, counter-zero log row — AWS wrote none before this step — movement/sleep payloads, log types) |
| Validators | Java `StoryValidatorService`, Python `story_validator_service.py`, AWS `lambda/story/story_validator.py` — all three add `R9` and extend `R1` to the five trigger columns |
| Seed (all four) | Events 90040-90044, `type = AUTOMATIC`, bound to no location of their own (a location's trigger columns point at them, not the reverse). Locations 90002 (first/subsequent entry), 90003 (first-in-location), 90001 (counter-zero, reusing the start's existing `counter_time = 2` fuse), 90004 (character-start-time). Registry keys `STEP33_*` identify each trigger in tests. |
| Game board | `react-game/src/features/gameplay/cards/AutomaticEvents.jsx` (v0.33.1 — replaces the deleted `CounterZeroList.jsx`; renders `card`/`cardEffects[].card` as reading pages); `GameBook.jsx` (`handleMovementDone`, `handleSlept`, `showAutomaticEvents`; precedence `previewRight > pendingChoices > counterZero > weather > board`; v0.33.1 fixed `buildCardCharacteristicsRight(...)` passing `handleReloadClockWeatherAndMatchData` as `onSlept`, which dropped `counterZero` so the list never appeared on that path); i18n `game.automaticEvents.*` (v0.33.1, renamed from `game.counterZero.*`) plus `book.automatic-event` / `book.automatic-event-done`, `matchLog.types.COUNTER_ZERO` / `AUTOMATIC_EVENT` (en + it); react-admin shows `flagVisited` beside `flagAlreadyActived` in the location state table |
| Robot | `code/tests/robot/tests/33_location_events/location_events.robot` (12 tests; as of v0.33.1 the fog-of-war case asserts `card`, `cardLocation` and `cardEffects` are all absent/empty under `ANONYMOUS`) + `counter_zero_cards.robot` (v0.33.1, 6 tests — the three card fields present, each resolving against the content API, effect rows belonging to the event the notice names, empty list on an ordinary sleep) — see `.claude/docs/robot-suites.md` for suite/keyword detail, not duplicated here |
| Tests | Java: `EventExecutionServiceAutomaticTest` + additions to `TimeStartRecoveryServiceTest`, `MovementServiceTest`, `RecoveryStoreAdapterTest`, `MatchLogsServiceTest`, `StoryValidatorServiceTest`. Python: `test_location_entry_events.py`, `test_location_entry_store_adapter.py`. AWS: `test_location_entry_events.py`. |

Python and AWS mirror the Java engine and validator described above.

### Test results

Java 1597 tests pass. Python 1155 pass. AWS 694 pass. react-game 673 pass, react-admin 510
pass. The Robot suite dry-runs clean (12 cases); it has **not** been executed against a live
server.

---

# Version Control

- **Document Version**: 0.33.1

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.33.1 | Bugfix on the sleep response's `counterZero[]` items: `card` used to be the **location's** card (`list_locations.id_card`); it was already computed as the event's card and its applied effects in `AutomaticEventFired`, then discarded by `describeForRecipient` before reaching the player, who woke up to the name of a place instead of the news of what happened in it. `card` now carries the event's narrative; `cardLocation` (new, nullable) holds what `card` used to hold; `cardEffects` (new) is the array of `AppliedEffect` the event produced, same shape `execute-event` returns. `trigger`, `idLocation`, `eventUuid`, `clock`, `visibility` unchanged; no new DB columns, no schema change, no new endpoint — `SleepActionResponse` still reuses `ExecuteEventResponse.AppliedEffectDto`. Fog-of-war widened to all three fields: `ANONYMOUS` now nulls/empties `card`, `cardLocation` and `cardEffects` together. Implemented in all three backends. react-game's `CounterZeroList.jsx` deleted, replaced by `AutomaticEvents.jsx`, rendering reading pages (`variant="page"`) instead of the small selection-list grid; card choice per entry falls back `cardEffects[].card` → `card` → generic notice; `cardLocation` computed but not yet rendered. `GameBook.jsx` also fixed a bug where `buildCardCharacteristicsRight(...)` passed `handleReloadClockWeatherAndMatchData` as `onSlept`, dropping `counterZero` so the list never appeared on that path. i18n `game.counterZero.*` renamed to `game.automaticEvents.*`; added `book.automatic-event` / `book.automatic-event-done`. Robot gained a dedicated suite, `33_location_events/counter_zero_cards.robot` (6 tests), and `location_events.robot` widened its fog-of-war assertion to all three fields (12 tests). | August 13, 2026 |
  | 0.33.0 | Location entry events, implemented. Triggers bind on the location, not the event: five columns on `list_locations` (`id_event_if_first_time`, `id_event_not_first_time`, `id_event_if_character_enter_first_time`, `id_event_if_counter_zero`, `id_event_if_character_start_time`) plus `priority_automatic_event`, wired since `V0.10.3` and already exposed as event pickers in the react-admin story editor — no new `list_events.type` values (an event-side alternative selected via `idSpecificLocation` was considered and rejected, §1). Five triggers resolved across two passes (arrival: first/subsequent/first-in-location; time-start: counter-zero/character-start-time), with a specified cross-location order (`priority_automatic_event` then `id_location`; tests may assert it). Counter-zero finally executed, closing Step 26's dead end; nominal actor = lowest-id character present, with a no-actor path for empty locations that required hoisting `applyRegistryEffect` out of the per-recipient loop. Automatic events never own choices, enforced by `R9_AUTOMATIC_EVENT_CHOICES` + `R9_AUTOMATIC_EVENT_TYPE` at import time and a runtime refusal-and-log; the five trigger columns joined the `R1` referential-integrity walk. `V0.33.0__location_entry_events.sql` adds `gaming_state_locations.flag_visited` and `log_events.id_location`. `MAX_ENTRY_DEPTH = 8` bounds forced-movement cascades (location-side binding makes a loop two admin form fields away). `logCounterZero` now stamps `clock` and a structured `idLocation` and is typed `COUNTER_ZERO` instead of folding into `RECOVERY`; a second new type `AUTOMATIC_EVENT` covers executed automatic events; AWS previously wrote no counter-zero row at all. `automaticEvents[]` added to movement/execute-event/select-choice responses; `counterZero[]` added to the sleep response, carrying `card` (not a `locationName` string, consistent with v0.28.6) with per-recipient fog-of-war visibility. `TimeStartRecoveryService` collects the pending automatic events but does not run them; `TimeAdvancementService.setAutomaticEventRunner` runs the list once recovery returns, the one cycle-breaker in the bean graph, ahead of the Step 49-54 WebSocket broadcast. `flag_visited` is match-scoped and seeded on the story's starting location at match creation. Test counts: Java 1597, Python 1155, AWS 694, react-game 673, react-admin 510; Robot suite `33_location_events/location_events.robot` (12 tests, dry-run clean, not yet run live). | August 12, 2026 |

- **Last Updated**: August 13, 2026
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

