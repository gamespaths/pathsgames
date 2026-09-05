# Step 36 — Registry System

`gaming_state_registry` has existed since `V0.10.7`, and events, choices, movement, weather
and the engine have all been reading and writing it since Steps 27-32. What did not exist was
a *system*: before this step there were **eight** copies of the "a row becomes one comparable
string" rule (disagreeing on what "both columns null" meant), **three** copies of the write-side
value parser — two of them behaviourally different, so a float default of `1.5` became
`int_value=1` in the Python seed and `stringValue="1.5"` on AWS — and **three** mutually
incompatible readings of "condition key set, expected value null". No `findByIdMatchAndKey`
existed anywhere, so every single-key lookup scanned all rows of the match in application code
— once per edge in movement, once per candidate rule in weather. `GET /api/match/{uuid}/info`
loaded the registry twice per request. Ordering comparison (`>`, `<`) existed only for choice
conditions. `list_keys.group` and `list_keys.visibility` were imported and never read. The
player could never see the registry at all. Step 36 is mostly a consolidation: it does not
change what a registry value *is*, it changes how many places compute it and whether the
answer agrees.

Two things follow from that framing and shape every decision below:

- **One service owns every read, write and comparison.** `RegistryService` (java) /
  `registry_service.py` (python) / `lambda/match/registry.py` (AWS) replaces the eight readers
  and three writers; `render`/`parse` are now exact inverses of each other, and `evaluate` is
  the single comparison every registry condition — event, edge, weather rule, choice option —
  goes through.
- **The registry becomes readable, not only writable.** The new
  `GET /api/match/{uuid}/registry` endpoint and the duplication of its six new fields onto
  `/info` exist because this step's audience is finally the player, not only the engine.

---

## 1. One service: `render`, `parse`, `evaluate`

```java
// A row as one comparable string: the string wins, else the int, else null.
public static String render(String stringValue, Integer intValue) { ... }

// A value as the pair of columns: numeric to int_value, anything else to string_value,
// never both. Trimmed in both branches, so what an author types is what a condition reads.
public static RegistryRow parse(String key, String value) { ... }

// The one registry comparison, over the SET of values a key holds (Step 36.1 generalised it):
// = is ∃ (any member equals the value), != is ∄ (no member does, so an absent key still
// satisfies it), > and < are ∀ (EVERY member compares that way) and are never met over an
// empty set — vacuous truth would open a door, and a typo must close one. On a one-element
// set every reading below is the equality or comparison it always was.
public static boolean evaluate(String operator, String expected, Collection<String> actual) { ... }
```

`render`/`parse` are exact inverses — trimmed in both branches, which is the seeding behaviour
that won over the write-side parsers it replaced. `evaluate` is reused, unchanged in who calls
it, by `EventAvailabilityChecker` (event conditions), `MovementService` (edge conditions),
`WeatherSelectionService` (weather rule conditions) and `ChoiceAvailabilityChecker` (choice
conditions, which already had the widest vocabulary and lost nothing by delegating to it) —
Step 36.1 widened what it compares against, not who calls it or with what operator.
Java, Python and AWS carry the identical three functions — the AWS module's own docstring says
it plainly: "Mirrors the Java `RegistryService` and the Python `registry_service`."

| Operator | Meaning |
|---|---|
| `=` (default) | ∃ — met when ANY member of the key's set equals the value. A `null`/blank operator column reads as `=`. |
| `!=` | ∄ — met when NO member equals the value; the **only** operator an absent key (an empty set) can satisfy. |
| `>` / `<` | ∀ — met when EVERY member compares that way numerically, and never over an empty set; a member failing to parse as an integer makes the whole condition **not met**, never an error. |

A **null expected value is never met**, regardless of operator — "a typo must lock a door,
never open one" is the comment on all three backends. A **blank condition key** means "no
condition at all" (`RegistryService.noCondition(key)` / `no_condition`), which is a different
thing from a key with no expected value; the former short-circuits to *always available*, the
latter to *never met*. On a single-valued key — still the overwhelming majority — the set has
at most one member, so every one of these readings collapses to the equality or comparison it
always was; that is why Step 36.1 changed no authored story's meaning (§7.2).

## 2. `GET /api/match/{uuidMatch}/registry`

| Method | Path | Answers |
|---|---|---|
| GET | `/api/match/{uuidMatch}/registry` | the caller's match registry, grouped by category |

OpenAPI spec:
[`v0.36.0-registry-api.yaml`](../code/backend/java/adapter-rest/src/main/resources/openapi/v0.36.0-registry-api.yaml)
— the filename stayed, the `version:` field inside it is `0.36.1` since the multi-value payload
change (§3) is documented there. Owner-only, like `/info`: any other caller — including a match
that genuinely does not exist — gets `404 MATCH_NOT_FOUND`, never `403`, so a match nobody may
see is indistinguishable from one that is not there.

```jsonc
{
  "groups": [
    {
      "category": "tutorial",
      "entries": [
        { "uuid": "3f2b1c4d-…", "key": "tutorial_progress",
          "values": ["3"], "multiValue": false,
          "idCharacter": 12, "category": "tutorial", "visible": true,
          "priority": 1, "idCard": 950, "card": { "title": "Training progress", "...": "..." } }
      ]
    },
    {
      "category": "evidence",
      "entries": [
        { "uuid": "7a8b9c0d-…", "key": "monastery_records",
          "values": ["ledger", "letter", "seal"], "multiValue": true,
          "idCharacter": null, "category": "evidence", "visible": true,
          "priority": 1, "idCard": null, "card": null }
      ]
    }
  ]
}
```

`values` and `multiValue` are Step 36.1: they replace `stringValue`/`intValue` on this payload
and on `/info`'s `registry[]` (§8). `values` is the SET of rendered strings the key holds,
ordered by the backend (§3); a single-valued key's set has at most one member, a multi-valued
one's may have many, and an empty array is a key with no members at all, not a key that is
missing.

Query parameters:

| Param | Default | Role |
|---|---|---|
| `lang` | `en` | Resolves each key's card, falling back to English. |
| `includeHidden` | `false` | Owner-only debugging door: also returns keys whose definition is not `PUBLIC` — usually a puzzle the player has not solved yet. |

## 3. Values, visibility, ordering

**Values.** Step 36.1 replaced the one-row-one-value shape with one entry per **key**, holding
the whole SET of values it has. `values` is the array of rendered strings (§1's `render`,
applied per row); `multiValue` says whether the key accumulates. A single-valued key's set has
at most one member and reads exactly as the old `stringValue`/`intValue` pair did — those two
fields are gone from both payloads, though they remain the storage columns underneath (§6). A
multi-valued key's set can hold many members, and an **empty set (`values: []`) is the absence
of rows, not a row holding nothing**. Booleans are integers by convention: `0` is no, anything
else is yes — see §5 for the sweep that made this actually true across the story schema.

**One entry per key, the union of story and match.** `listEntries` starts from every key the
story declares, adds every key the match's rows actually name, and builds one entry per name —
so a key whose members were all removed, or one the story added after the match began, still
gets an entry, just with an empty `values`. `uuid` and `idCharacter` on that entry come from the
LAST row written, which on a multi key means "who last touched this key at all," not who wrote
any one member.

**Visibility.** A key is visible when `list_keys.visibility` is `PUBLIC`; anything else hides
it. The column is free text with no enum, deliberately: a typo hides a key rather than leaking
one, the safe direction for authored content nobody validates at runtime. `?includeHidden=true`
adds the hidden keys and is owner-only; `/info` **never** returns hidden keys, whatever the
caller asks — there is no `includeHidden` on that path at all.

**Ordering.** Entries sort by category, then by the key's `priority`, then by key name. Groups
come out in the order their first entry appears (`LinkedHashMap` on java, an ordered dict on
python), so the grouping is stable across calls without a second sort pass. Inside an entry, the
members of `values` are ordered by the backend too (`RegistryService.ordered`): numbers
numerically first, then everything else alphabetically, so every client renders the same set
the same way without sorting it itself.

**A key whose story definition is gone is kept but reads as hidden.** It is state the engine
wrote; dropping it silently would hide a bug rather than a key.

## 4. `list_registry_keys` does not exist — `list_keys` does

The obvious name for a key-definitions table would be `list_registry_keys`. It was not
created, because the real table already existed: `list_keys` (`V0.10.2`) already carried
`"group"` (the category), `visibility`, `priority` and `id_card` — every field the registry
needed to describe a key was already there, just never read by anything before this step.

| `list_keys` column | Role in the registry read |
|---|---|
| `name` / `value` | The key's story-scoped identity and default, seeded into `gaming_state_registry` at match creation. |
| `"group"` | The `category` a `gaming_state_registry` row is bucketed under. |
| `visibility` | `PUBLIC` shows the key; anything else hides it (§3). |
| `priority` | Orders entries inside their category. |
| `id_card` | Resolved into the `card` object on each entry, in the requested language. |

`RegistryService.listEntries(idMatch, idStory, includeHidden, lang)` joins every
`gaming_state_registry` row of the match against `storyReadPort.findKeysByStoryId(idStory)`,
keyed by name. A values-only `RegistryService` (constructed with no `storyReadPort`/
`contentQueryPort`) is still valid — every write, comparison and `loadAll()` keeps working —
its entries simply carry no category, card or visibility, which is what the plain read/write
door needed all along and all the engine callers keep using.

## 5. The operator column: four conditions, one comparison

Before this step, `=` was the only comparison a registry condition could express anywhere but
`list_choices_conditions`, which already carried `operator` (`=`/`!=`/`>`/`<`) and was the
widest vocabulary in the project. Step 36 widens the other three condition owners to match, by
reusing that vocabulary rather than inventing a second one. Step 36.1 later changed what these
four operators compare *against* — the whole set a key holds, not one row — without touching
this column, its vocabulary, or any of its callers at all (§1):

```sql
-- V0.36.0__registry_operator_conditions.sql (SQLite and PostgreSQL)
ALTER TABLE list_events              ADD COLUMN registry_value_operator_condition TEXT DEFAULT '=';
ALTER TABLE list_locations_neighbors ADD COLUMN registry_value_operator_condition TEXT DEFAULT '=';
ALTER TABLE list_weather_rules       ADD COLUMN registry_value_operator_condition TEXT DEFAULT '=';
-- list_choices_conditions already has `operator` with the same vocabulary; reused as is.
```

`DEFAULT '='` means every row authored before `v0.36.0` keeps exactly the behaviour it had.
`ChoiceAvailabilityChecker.keysMet` itself was rewritten to **call** `RegistryService.evaluate`
instead of carrying its own copy of the same switch — the widest vocabulary in the project is
now also the one place that vocabulary is implemented.

### The null-expected doctrine, unified on strict

Before this step the three condition owners disagreed about what a condition with a key but no
expected value meant:

| Owner | Old reading of "key set, value null" |
|---|---|
| Events, movement | Never met (a condition that can never be satisfied is not "no condition") |
| Weather | **The key must be unset** — `expected == null ? actual == null : expected.equals(actual)` |
| Choices | Never met (same as events/movement) |

Weather was the odd one out, and Step 36 retires that reading: **a condition key with a null
expected value is now never met, everywhere.** A story that meant "the key must be unset" says
so explicitly now, with `!=` and an expected value the key will never actually hold, or more
naturally with `!=` against the sentinel it expects the key to carry once set. This was
verified safe before merging: **zero** weather rules in any seed set `condition_key` at all, so
no authored content changed behaviour — the retirement closed a doctrine gap, it did not break
a story.

### Boolean vocabulary, swept to one spelling

`evaluate`'s `>`/`<` branch only works when both sides parse as integers, and the project's
boolean convention (§3) is `0`/non-zero — so a column still holding the strings `"true"`/
`"false"` could never be compared with `>`/`<`, and disagreed with every other boolean-shaped
column in the schema. Step 36 sweeps `'true'` → `'1'`, `'false'` → `'0'` across seven
cross-referencing columns, in five seed sources:

| Column | Table |
|---|---|
| `value` | `list_keys` |
| `key_value_to_add` | `list_events_effects` |
| `value` | `list_choices_conditions` |
| `value_to_add` / `value_to_remove` | `list_choices_effects` |
| `condition_value_from` / `condition_value_to` | `list_missions` |
| `condition_value_from` / `condition_value_to` | `list_missions_steps` |
| `condition_value` | `list_global_random_events` |

in `R__insert_story_seed_data.sql` (java), `scripts/seed_stories.py` (python),
`lambda/seed/handler.py` (AWS), `story_demo_3.json` and `story_demo_4.json`. Migrating only the
new-format defaults would have broken content that already depended on the old spelling: the
seeded spy event in `list_global_random_events` fires while `monk_testimony = 'false'`, so the
column it reads and the column the registry actually writes had to move together, in the same
change, or the event would have stopped firing the day the registry started writing `'0'`
instead.

## 6. Database — one migration, one index made unique

```sql
-- Nothing should have written a duplicate key on one match, but list_keys does not forbid
-- two keys with the same name, so a story could seed one; drop the older row before the
-- unique index makes it impossible.
DELETE FROM gaming_state_registry
 WHERE rowid NOT IN (SELECT MAX(rowid) FROM gaming_state_registry GROUP BY id_match, key);
-- (PostgreSQL: a self-join DELETE on the same GROUP BY, since rowid does not exist there.)

DROP INDEX IF EXISTS idx_state_reg_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_state_reg_key ON gaming_state_registry(id_match, key);
```

`idx_state_reg_key` existed since `V0.10.11` but was never `UNIQUE` — the upsert path has
always *assumed* one row per `(id_match, key)`, but nothing enforced it, and the story
validator does not reject two `list_keys` rows sharing a name. The dedup delete runs first so
the index creation cannot fail against pre-existing duplicates on an upgrading database.

### 6.1 V0.36.1 — a key may hold a SET, the mirror, two partial indexes

```sql
-- V0.36.1__registry_multi_value.sql (SQLite and PostgreSQL)
ALTER TABLE list_keys              ADD COLUMN multi_value INTEGER DEFAULT 0; -- the declaration
ALTER TABLE gaming_state_registry  ADD COLUMN multi_value INTEGER DEFAULT 0; -- the mirror

DROP INDEX IF EXISTS idx_state_reg_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_state_reg_key_single
    ON gaming_state_registry(id_match, key) WHERE multi_value = 0;

-- One row per DISTINCT value. The expression is literally RegistryService.render — the string
-- wins, else the int — so '1' and 1 are the same member. KEEP IN SYNC WITH render(): if one
-- changes, the other must.
CREATE UNIQUE INDEX IF NOT EXISTS idx_state_reg_key_multi
    ON gaming_state_registry(id_match, key, COALESCE(string_value, CAST(int_value AS TEXT)))
    WHERE multi_value = 1;
```

`list_keys.multi_value` is the author's declaration; `gaming_state_registry.multi_value` is a
**mirror** of it, copied onto the state row the first time a match writes the key and never
reconciled afterwards — a match already in progress keeps the behaviour it was born with even
if the author flips the flag on the story later. The single `idx_state_reg_key` from V0.36.0
cannot serve both kinds at once, so it is dropped and replaced by two **partial** indexes:
`idx_state_reg_key_single` keeps the V0.36.0 invariant (one row per key) for `multi_value = 0`
rows, and `idx_state_reg_key_multi` keeps one row per DISTINCT value for `multi_value = 1` rows.
The multi index is built on the **rendered expression**, not the two raw columns, because
PostgreSQL treats NULLs as distinct in a unique index and exactly one of `string_value`/
`int_value` is always null — indexing the columns directly would let every duplicate through.
That expression is `render` (§1) written in SQL, which is why the migration carries a
`KEEP IN SYNC` comment: change one and the other silently stops matching it.

**A key holds one row per DISTINCT value; an empty set is the absence of rows, not a row
holding nothing.** Nothing needed migrating for this: a multi key that has never been written
simply has no rows yet, on an upgraded database exactly as on a fresh one.

## 7. One writer, one audit row

Every write — engine, event effect, choice effect — goes through
`RegistryService.upsert(idMatch, idStory, key, value, idCharacter, idEvent, idChoice, clock)`
(gained `idStory` in Step 36.1, to resolve a never-written multi key's declaration — §7.2), and
every removal through the sibling `remove(idMatch, key, value, idCharacter, idEvent, idChoice,
clock)`. Both now RETURN the resulting SET rather than `void`, and both append **at most** one
`log_events`/`eventLog` row:

```
REGISTRY_CHANGE <key> <old> -> <new>        -- a single key
REGISTRY_CHANGE <key> +<member>             -- a multi key, a member added
REGISTRY_CHANGE <key> -<member>             -- a multi key, a member removed
```

**A refused write leaves no trace in the log — new in Step 36.1.** Before this step even a
no-op (`old == new`) still emitted a `REGISTRY_CHANGE` row; now `upsert`/`remove` compare the
SET they return against the SET they started from and log only when it actually differs. A
duplicate member on a multi key, or a `value_to_remove` naming a value the key does not hold,
changes nothing, so it reports nothing — the log is a history of changes, not of write
attempts. `EventExecutionService.applyRegistryEffect` (event effects) and
`applyChoiceRegistryEffect` (choice effects) both guard the same comparison
(`if (!after.equals(before))`) before adding a `RegistryChange` to the response — one doctrine,
enforced identically at both call sites of the same class.

`RegistryService.MSG_REGISTRY_CHANGE` is the prefix `MatchLogsService` now recognises as its
own log type, `REGISTRY_CHANGE`, surfaced on `GET /api/matches/{uuidMatch}/logs` — the
[`v0.28.7-match-logs-api.yaml`](../code/backend/java/adapter-rest/src/main/resources/openapi/v0.28.7-match-logs-api.yaml)
spec had listed `REGISTRY_CHANGE` as a "future addition" since Step 28; this step is that
addition. Because both `EventExecutionService.applyRegistryEffect` (an event effect's
`key_to_add`/`key_value_to_add`) and the choice-effect registry write run through the same
method on the same class (choices resolve inside `EventExecutionService` since Step 32), a
registry change can neither be missed nor logged twice — there was never a second writer to
diverge from the first.

**Seeding a match writes no `REGISTRY_CHANGE` rows.** `RegistryService.seed(idMatch, keys)`
calls `store.insertAll` directly, bypassing `upsert` and its logging entirely: a default is not
a change, and a brand-new match's log history starts empty. A **MULTI** key with no authored
default seeds **no row at all** — its set starts empty, consistent with §6.1's rule that an
empty set is the absence of rows, not a row holding nothing — and every row seeding does write
carries the `multi_value` mirror that will govern how this match writes that key from here on.

### 7.1 What the provenance columns mean

`upsert` stamps `id_character`, `id_event`, `id_choice` and `clock` on the row it writes, so a
registry row always says **who moved it last and when** — not who first created it. A seeded
row therefore carries a null `id_character` until something writes it, and every later write
overwrites the stamp rather than appending to it: the registry is state, not a history, and the
history is what `REGISTRY_CHANGE` is for. `id_character` is the actor who executed the event or
chose the option, never the recipient of its effects — a registry key is match-scoped, so an
effect targeting every character still writes one row, stamped once, by the one who acted. On a
multi key the stamp is per KEY, not per member (§3): it says who last touched the key at all.

### 7.2 A key effect SETS a value on a single key — a multi key ACCUMULATES

*(Corrected for Step 36.1 — a single key still works exactly as this section always said; a
multi key does not.)*

The effect columns are named `key_to_add` / `key_value_to_add` (events) and
`key` / `value_to_add` / `value_to_remove` (choices), and the verb "add" there has always meant
*add a key/value pair to the registry*, never arithmetic increment — there is no `+1`/`-1`
anywhere in the write path. What "add" resolves to now depends on the key's kind (§6.1):

- **Single key** (unchanged since Step 36.0): `value_to_add` REPLACES whatever the key held,
  whether the column in play ends up being `string_value` or `int_value`. A story that wants a
  counter to climb still authors one effect per value it should reach, or drives the arithmetic
  from the event chain.
- **Multi key** (new in Step 36.1): `value_to_add` JOINS the set — it adds that member
  alongside whatever the key already holds. Adding a member the key already has changes nothing
  and logs nothing (§7).

`value_to_remove` on a choice effect is still the one conditional write, but what it clears now
depends on the same kind: on a single key it is the compare-and-clear it has always been — it
clears the key only when the stored value still equals it, so an option cannot wipe a value
some other branch of the story has since moved on. On a multi key it takes **that one member**
away and leaves the rest; removing the last member leaves the key with an empty set, not a row
deleted out from under it — the row goes, the key does not (§6.1). `value_to_add` wins whenever
both are set, on either kind.

## 8. `/info` gains the same six fields, deliberately duplicated

`MatchInfoResponse.RegistryEntryDto` gains `idCharacter`, `category`, `visible`, `priority`,
`idCard` and `card` — exactly the fields the new endpoint's `RegistryEntry` carries. The
duplication is deliberate, not an oversight: the game board already loads `/info` on every
reload, so rendering the registry section costs no second request and, because both payloads
are built from the same `RegistryService.listEntries` call, can never disagree with what the
dedicated endpoint would answer. `/info`'s registry list is always built with
`includeHidden=false` — there is no way to ask `/info` for hidden keys; that door only exists
on `/registry` itself.

Step 36.1's payload change (§2-§3) lands here identically: `registry[]` entries on `/info`
carry `values`/`multiValue` instead of `stringValue`/`intValue` too, precisely because both
payloads are built from that one shared call — there was never a second shape to update.
`v0.19.0-match-creation-api.yaml`'s `RegistryEntry` schema was updated alongside the dedicated
`v0.36.0-registry-api.yaml` spec so the two documents describe the one shape identically.

## 9. Six bugs fixed in passing

1. **AWS registry rows had no `id` and no `uuid`.** `events.apply_registry` used to mutate the
   match's embedded `registry` list directly, so a row created at runtime was shaped
   differently from a seeded one on the same match — visible as a gap in `/info`. It is now a
   thin wrapper over `_registry.upsert`, which mints both on first write, exactly like a seeded
   row.
2. **The three duplicated AWS neighbour checks all missed a guard.** Java's and Python's
   `conditionMet` have always required the expected value to be non-null before treating an
   edge as blocked; all three AWS copies (the movement gate, the execute-movement path, and the
   `/info` availability verdict) omitted that guard, so an edge with a key but no expected value
   read as **open** whenever the key was unset. One new `_edge_condition_met(edge, registry)`
   replaces all three call sites (`handler.py`, movement gate / movement execution / `/info`
   neighbour verdict); the edge now reads as blocked, matching Java and Python.
3. **Python's `list_keys` model diverged from the Java schema.** Python stored
   `key_name`/`key_value`/`key_group`/`is_visible` (a boolean flag) and had no `priority`
   column at all. `find_keys_by_story_id` now normalises its answer to the Java vocabulary
   (`visibility: "PUBLIC" | "HIDDEN"`) so both backends' registry endpoints answer the same
   JSON shape; `priority` was added to `KeyEntity` and to the `align_schema()` drift replayer
   (`database.py`), which also learned to type the new operator columns `TEXT` rather than the
   default `INTEGER` it uses for every other added column (`_TEXT_COLUMNS` set).

Also, not a bug but a gap: the Python story seeder (`scripts/seed_stories.py`) declared **no**
registry keys at all before this step, so the Python Robot run exercised none of this. Four
keys were added, one of them hidden, so `includeHidden` has something to reveal there too.

### 9.1 Two more the AWS Robot run caught, after the first pass

The first implementation shipped green on Java and Python and **failed on AWS**, in two ways
the unit suites could not see. Both are fixed, and both now have a test that fails without the
fix:

4. **AWS `/info` did not join the registry at all.** `_detail_from_item` passed
   `item.get('registry')` straight through, so the payload carried the raw embedded rows with
   no `visible` flag — and §8's whole promise, that the two payloads cannot disagree, was false
   on one backend. It now calls `_registry.list_entries(item, story, include_hidden=False)`,
   the same call the endpoint makes. `test_info_carries_the_same_joined_entries_as_the_endpoint`
   pins it.
5. **A registry write with no actor crashed the chain.** An automatic event fired at a
   time-start has no actor — the world changed, but around no one — and `_run_event_chain` is
   entered with `caller=None`. Reading `caller.get('id')` unguarded raised `AttributeError`, so
   `POST /api/gameplay/{uuid}/action/sleep` answered **500** whenever a time-start event wrote
   a key. Java had always stamped a null `idCharacter` there; AWS now does too, via
   `(caller or {}).get(...)`. `test_the_event_chain_survives_a_null_caller_and_writes_the_key`
   exercises the real chain, not `upsert` alone, because the chain is where it broke.

The lesson is worth keeping: a payload built by three backends needs a cross-backend test of
the payload itself. Both defects were invisible to 4700 unit tests and obvious to the Robot
suite the moment it ran against AWS.

### One more, found while building v0.36.2

6. **Python's `execute-event` and `/info` disagreed on the operator.** `event_store_adapter.py`'s
   `_event_dict` built its row without `registry_value_operator_condition`, so an event authored
   with `>`, `<` or `!=` was evaluated as `=` on the execute-event path while `/info` (built from
   `RegistryService.evaluate` through a different read) reported the correct verdict — the two
   disagreed on the very same event. `_event_dict` now carries the column like every other one.

## 10. Other backends

### AWS — the registry as an embedded list, not a table

There is no `gaming_state_registry` table on DynamoDB: the registry is a list embedded on the
match item (`match['registry']`), so `lambda/match/registry.py`'s "store" is that list and
every write mutates the item the caller already holds — the same shape `lambda/match/events.py`
already followed for the item inventory (Step 34). `render`/`parse`/`evaluate`/`no_condition`
are free functions mirroring the Java statics exactly; `list_entries`/`list_groups` join
against `story.get('keys')`; `seed(story)` builds the initial rows at match creation;
`upsert(match, key, value, changes, ...)` both writes the row and appends the `eventLog` entry
in one call. `GET /api/match/{uuidMatch}/registry` is a new route in `template/match.yaml` and
a new branch in `lambda_handler`'s dispatcher — without the route, API Gateway 404s before the
lambda runs at all, the same class of gap every other AWS endpoint addition in this project has
had to close.

**Step 36.1** widened the module the same way it widened Java: `rows_in(match, key)` /
`values_in(match, key)` replace the old single-row lookup over the embedded list,
`upsert(match, key, value, changes, ..., story=None)` gained the optional `story` argument that
resolves a never-written key's declaration exactly like Java's `idStory`, and a new
`remove(match, key, value, changes, ...)` mirrors `RegistryService.remove` over the same list.
The rules are identical to Java's (§1, §6.1, §7.2) — only the storage shape (an embedded list,
not a table with two partial indexes) differs.

### Python

`RegistryService` mirrors the Java class field-for-field, wrapping a `store` port plus optional
`story_read_port`/`content_query_port`, exactly like the java bare/full constructors. New:
`app/core/ports/match/registry_ports.py`,
`app/adapters/persistence/match/registry_store_adapter.py`,
`app/core/services/match/registry_service.py`. `GET /api/match/{uuid_match}/registry` is wired
into `match_controller.py`'s router alongside `/info`, with `_registry_to_camel` converting the
grouped snake_case model into the OpenAPI shape. `KeyEntity.priority`,
`LocationNeighborEntity.registry_value_operator_condition`,
`WeatherRuleEntity.registry_value_operator_condition` and
`EventEntity.registry_value_operator_condition` are new SQLAlchemy columns; no Flyway migration
exists on this backend, so `align_schema()` (`app/adapters/persistence/database.py`) is what a
running dev database actually gets — see §9.3.

**Step 36.1** added `KeyEntity.multi_value` and the matching mirror column on the state-row
model, the same pair Java's `V0.36.1__registry_multi_value.sql` adds (§6.1); the store gained
`insert_value`/`delete_value` and its `find_by_match_and_key` now returns a LIST, so
`registry_service.py`'s `upsert`/`remove` stay the same algorithm as Java's, field for field
(§1, §7.2). `align_schema()` is again what actually lands the two new columns on a running dev
database — the same mechanism §9's third bug fix already relied on.

## 11. Frontend — react-game

A new **Registry** section, built as the backpack's structural twin (Step 34's `ItemsCard`/
`ItemsCards`/`ItemCard`):

- `RegistryCard.jsx` — two shapes of the same component, exactly like `ItemsCard`: `little`
  (the summary card in the (i) information list, one footer action that opens the section) and
  `page` (the LEFT reading page while the registry is open, carrying the title, the count badge
  and the way back).
- `RegistryCards.jsx` — the RIGHT reading page: one `RegistryKeyCard` per visible key, grouped
  under an `<h3>` per category, reading `gameData.info.registry` — no request of its own.
- `RegistryKeyCard.jsx` — one key as a little card, its value in a badge (`showZeros`, so a key
  worth `0` or holding an empty-looking string still renders something); its `(i)` opens the
  same reading-page preview `ItemCard` uses, through `onPreview`.
- `utils/registry.js` — `registryValue`, `visibleRegistry`, `groupRegistry`: the same
  render/sort rule the backend uses (string wins, else int, else nothing; category → priority →
  key), so the frontend can never present the entries in an order the backend did not. **Step
  36.1** adds `registryValues(entry)`, returning the raw `values` array a multi-valued entry
  carries, beside `registryValue(entry)`, which keeps doing what display needs: the members
  joined for one line of text, `null` on an empty set — so `RegistryKeyCard.jsx` did not have
  to change to keep working on a multi key, it just shows a comma-joined badge instead of a
  single value.
- `useBookView.js` gains a `'registry'` view alongside `'board' | 'info' | 'items' | 'map'`, and
  `openRegistry`/`onOpenRegistry`/`onCloseRegistry` are threaded through `GameBook.jsx` →
  `PageLeft`/`PageRight`/`PageRightInfo`/`PageRightMain`, mirroring the items wiring exactly.
- The board's `(i)` shortcut row previously had two dead `alert('coming soon')` buttons; the
  `fa-scroll` one now opens the registry (`onOpenRegistry`), and the remaining
  `fa-clipboard-list` placeholder (missions, Step 37) was reworded from "Missions and registry
  coming soon" to just "Missions coming soon".
- `data/images.json` gained a `registry` entry (`fa-scroll`), and `i18n/en.json`/`it.json`
  gained `game.registry.*` (`title`, `description`, `open`, `empty`, `back`, `count`, `value`).

**react-game does not call the new endpoint.** It reads the registry from the six duplicated
fields on `/info` (§8) — one request, and it can never disagree with the board it is already
rendering.

## 12. Admin

`registryValueOperatorCondition` is a new `select` field on the `events`,
`location-neighbors` and `weather-rules` forms in `storiesEntities.jsx`, reusing the existing
`CHOICE_CONDITION_OPERATOR_OPTIONS` constant — the same options list the choice-conditions form
has used since Step 31, so no second operator vocabulary was authored for the admin UI either.

The admin match-detail page already had a `RegistryCard.jsx`
(`code/frontend/react-admin/src/components/match/detail/`) showing the raw
key/string-value/int-value table — it carried that from `v0.28.0` through Step 36.0
untouched. **Step 36.1** replaces those two columns with **Values** (the set, joined for
display) and **Multi** (a badge for `multiValue`), in both `RegistryCard.jsx` and
`MatchDetailModal`, because `stringValue`/`intValue` no longer exist on the payload (§3) — the
raw pair simply is not there to show anymore. It remains unrelated to the `react-game`
component of the same name.

The story key editor (`list_keys`, also in `storiesEntities.jsx`) gained a **Multi Value**
checkbox — `multiValue`, a checkbox input in the form and a boolean column in the list —
authoring `list_keys.multi_value` (§6.1) directly. Story import/export carries `multiValue` on
keys the same way, on all three backends.

## 13. v0.36.2 — case-insensitive, whitespace-trimmed value comparison

Scoped deliberately narrow: **values only, at comparison time.** Registry KEYS still match
exactly, and nothing is normalised in storage — `/registry` and the admin console still answer
exactly what the story wrote, padding and capitals included. Only the moment a value is
*compared* now folds case and trims both sides, via the same `norm`/`_norm` helper on all three
backends (Java `norm`, python `_norm`, AWS `_norm` in `lambda/match/registry.py`).

Three call sites share the one helper:

- **`evaluate()`** — `=` (∃) and `!=` (∄) now compare case-insensitively and trimmed on both
  sides; `>`/`<` are unchanged — still ∀ over a non-empty set, still requiring a number on both
  sides, where case does not apply.
- **The multi-key dedupe in `upsert()`** — a set can no longer hold two spellings of the same
  value (`"Ledger"` and `"ledger"` are one member, not two); `containsNorm`/`firstMatching`
  (java), the python and AWS equivalents, decide membership case-blind.
- **The compare-and-clear in `remove()`** — on a single key the compare is now case-blind; on a
  multi key the member to remove is *named* case-blind but **deleted exactly as stored**, so a
  `value_to_remove` of `"LEDGER"` finds and removes a stored `"ledger"` without rewriting it.

Files: `core/.../service/match/RegistryService.java`, `app/core/services/match/registry_service.py`,
`lambda/match/registry.py`.

## 14. v0.36.2 — a LOCATION can write the registry

Until this step only events and choices could write `gaming_state_registry`; a location itself
could not. New migration **`V0.36.2__location_registry_keys.sql`** (SQLite and PostgreSQL) adds
four nullable columns to `list_locations`:

| Column | Written on |
|---|---|
| `key_to_add` / `key_value_to_add` | the party's **first** arrival at the location |
| `key_to_add_not_first` / `key_value_to_add_not_first` | **every later** arrival |

An arrival takes exactly one branch, never both — the same split `id_event_if_first_time` /
`id_event_not_first_time` already draws for automatic events (Step 33). The write happens during
arrival resolution, **before** `flag_visited` is latched, with no event involved at all; a blank
key is authored noise and `upsert` already skips it. It goes through the ordinary
`RegistryService.upsert`, so it leaves the usual single `REGISTRY_CHANGE` audit row, stamped with
the arriving character and a null `idEvent`/`idChoice` — the place wrote it, not an event.

Entry points: Java `EventExecutionService.resolveArrival` → new `writeArrivalRegistry`; Python
`event_service._resolve_arrival` → `_write_arrival_registry`; AWS `match/handler.py
_resolve_arrival` → `_write_arrival_registry`. The four columns round-trip through story
import/export and admin CRUD as camelCase `keyToAdd`, `keyValueToAdd`, `keyToAddNotFirst`,
`keyValueToAddNotFirst`.

## 15. v0.36.2 — Admin registry edit API

Two new admin-only routes, all three backends, port 8044 / the IP-restricted admin API on AWS:

| Method | Path | Body / Query | Answers |
|---|---|---|---|
| PUT | `/api/admin/matches/{uuidMatch}/registry` | `{ key, value }` | `{ key, values[] }` |
| DELETE | `/api/admin/matches/{uuidMatch}/registry?key=K[&value=V]` | — | `{ key, values[] }` |

Naming no `value` on the DELETE empties the key outright, whatever it holds. Both go through the
ordinary `RegistryService` (`upsertByMatchUuid`/`removeByMatchUuid` on java) — a single key is
replaced and a multi key gains or loses a member exactly as an event or choice effect would, so
the console gets no private set of rules, and every write leaves a `REGISTRY_CHANGE` row: a
correction the log does not mention is one nobody can trace. `idCharacter`/`idEvent`/`idChoice`
are stamped null — nobody in the fiction did this. 404 on an unknown match, 400 on a blank key.

react-admin `RegistryCard.jsx` (`code/frontend/react-admin/src/components/match/detail/`) gained
per-row controls: a pen to write/replace a value, a minus per member to drop it from a multi key,
an eraser to clear a key outright, and an "Add a key" row to write a key the match does not yet
carry. Every action calls `updateMatchRegistry`/`deleteMatchRegistry` and refreshes the card from
the response.

## 16. Test coverage

New: java `RegistryServiceTest`, `RegistryStoreAdapterTest`, `RegistryControllerTest`; python
`test_registry_service.py`, `test_registry_store_adapter.py`, `test_match_controller_registry.py`;
AWS `test_registry.py`, `test_match_handler_registry.py`; react-game `RegistryCard.test.jsx`,
`RegistryCards.test.jsx`, `registryUtils.test.js`. Plus updates to every existing test touching
a registry condition — `EventAvailabilityCheckerTest`, `WeatherSelectionServiceTest`,
`MovementServiceTest` and their python/AWS equivalents — to cover the operator column and the
retired null-expected doctrine.

New Robot suite `code/tests/robot/tests/36_registry/registry.robot` (10 cases, tags `registry` +
`step36`) and a `Get Registry` keyword in `resources/matches.resource`. The suite is
deliberately backend-agnostic: it discovers writable registry keys from the story's own
admin-CRUD payload rather than addressing a seeded id, so it runs unmodified on
java-sqlite, java-postgres, python and AWS, whatever each backend's seed happens to declare. It
asserts the read/write contract end-to-end: visible-only grouping, `includeHidden` as a strict
superset, `/info` and `/registry` agreeing on every visible key, one `REGISTRY_CHANGE` per
write and none at seeding, and owner-only 404 masking.

**Results reported, not invented**: java 2466 tests pass, python 1397, AWS 849, react-game
1032, react-admin 662. Robot: 614/614 against a local java server, and 614/614 against python.
AWS Robot was deliberately not run this pass.

**Step 36.1** added dedicated coverage for the SET semantics: java `RegistryService` 99.5%
lines / 95.5% branches, `RegistryStoreAdapter` 100%/100%; python 99% lines / 100% branches; AWS
`registry.py` 99%.

New Robot suite `code/tests/robot/tests/36_registry/registry_multi_value.robot` (9 tests, tags
`registry` + `step36`): an empty set on a fresh match, two writes leaving both members, a
duplicate add changing and reporting nothing, `=` satisfied by any member, `value_to_remove`
taking one member and leaving the rest, an emptied key keeping its entry, a removal of a member
never held being a no-op, the response reporting the whole set as `newValue`, and `/info`
agreeing with `/registry`. The existing `registry.robot` was updated to the new `values`/
`multiValue` payload shape and gained a set-shape case, growing from 10 cases to 11.

All four seeds now ship a multi-value test-bed on the tutorial story: key `evidence_found`
(group `evidence`, `PUBLIC`, no default — an empty set), two FREE events each adding one
member, one event gated on a member being present, and one choice-event whose only option
removes a member. Every one of those events costs **zero** energy on purpose, so the Step 31/32
fixture finders — which only pick a choice-event with a positive cost — can never latch onto it
by accident.

**v0.36.2** added three new Robot suites under `code/tests/robot/tests/36_registry/`:
`registry_case_insensitive.robot` (5 cases — folded comparison on `=`/`!=`, dedupe on upsert,
case-blind removal by name, storage left untouched), `registry_location_writes.robot` (5 cases —
first-arrival vs. later-arrival pair, one `REGISTRY_CHANGE` per arrival, a blank key writing
nothing), `registry_admin_edit.robot` (6 cases — PUT replacing/joining, DELETE with and without
a value, 404 on an unknown match, 400 on a blank key). `registry_multi_value.robot`'s fixture
discovery was also made behaviour-based (it used to grab "the first multi key" declared by the
story, which broke the moment a second one was seeded) so it now picks the key by what it can do,
not by position. All four seeds gained the v0.36.2 pack described above (`case_notes`, `signal`,
`vault_seen`, the Records Vault location, four FREE events at the start hall). `tests/14_admin/
guest_admin.robot` was reworked for the new `/api/admin/guests` paged envelope and gained
stale-purge cases (17 total) — see [Step12 §Admin guest management](./Step12_GuestLoginMethod.md).

Full verification for v0.36.2: Java `mvn clean install -P dev` green, python 1432 tests,
AWS 879, react-admin 687, react-game 1069. Robot green on **all four targets**: 645/645 on
java/SQLite, java/Postgres and python, 641/641 on AWS — the four it does not run there are
the Turnstile dev-bypass cases, which the AWS dev environment does not bypass.

## 17. Scope of change

| Layer | Path |
|---|---|
| Migration | `adapter-{sqlite,postgres}/src/main/resources/db/migration/v0/V0.36.0__registry_operator_conditions.sql` — `registry_value_operator_condition` on `list_events`, `list_locations_neighbors`, `list_weather_rules`; dedup + `UNIQUE INDEX idx_state_reg_key ON gaming_state_registry(id_match, key)`. **Step 36.1**: `V0.36.1__registry_multi_value.sql` — `multi_value` on `list_keys` and `gaming_state_registry`; `idx_state_reg_key` split into `idx_state_reg_key_single`/`idx_state_reg_key_multi` (§6.1). **36.2**: `V0.36.2__location_registry_keys.sql` — `key_to_add`/`key_value_to_add`/`key_to_add_not_first`/`key_value_to_add_not_first` on `list_locations` (§14) |
| Entities (Java) | `EventEntity`, `LocationNeighborEntity`, `WeatherRuleEntity` gain `registryValueOperatorCondition`. **36.1**: `KeyEntity.multiValue`. **36.2**: `LocationEntity` gains the four arrival-registry columns |
| Engine (Java) | `core/service/match/RegistryService.java` (new); `MovementService`, `WeatherSelectionService`, `ChoiceAvailabilityChecker`, `EventAvailabilityChecker`, `EventExecutionService.applyRegistryEffect`/choice-effect write, `MatchCommandService.createMatch` (seeding), `MatchQueryService` (`/info` + `getMatchRegistry`), `MatchLogsService` (`REGISTRY_CHANGE` type) all updated to call it. **36.1**: `evaluate`/`upsert`/`remove`/`ordered` widened to sets (§1, §7, §7.2); `applyChoiceRegistryEffect` now also calls `remove`. **36.2**: `RegistryService` gains `norm`/`eq`/`containsNorm`/`firstMatching` for case-insensitive, trimmed value comparison (§13); `EventExecutionService.resolveArrival` gains `writeArrivalRegistry` (§14) |
| Ports/persistence (Java) | `core/port/match/RegistryStorePort.java` (new); `core/persistence/match/RegistryStoreAdapter.java` (new); `GamingStateRegistryRepository.findByIdMatchAndKey` (new). **36.1**: `findByMatchAndKey` returns a LIST; `insertValue`/`deleteValue` added |
| Model (Java) | `core/model/match/MatchRegistryEntry.java` (extended: `idCharacter`/`category`/`visible`/`priority`/`idCard`/`card`), `MatchRegistryGroup.java` (new). **36.1**: `MatchRegistryEntry` gains `values`/`multiValue`, drops the row-shaped fields |
| REST (Java) | `adapter-rest/.../controller/match/RegistryController.java` (new); `MatchRegistryResponse` (new DTO); `MatchInfoResponse.RegistryEntryDto` extended (same six fields). **36.1**: both DTOs' `stringValue`/`intValue` replaced by `values`/`multiValue`. **36.2**: `adapter-admin/.../MatchAdminController` gains `PUT`/`DELETE /{uuidMatch}/registry` (§15) and its weather `rules[]` rows gain `conditionKey`/`conditionValue`/`conditionOperator`/`registryMet` ([Step27](./Step27_WeatherSystem.md)) |
| Wiring (Java) | `ms-launcher/.../config/CoreConfig.java` — new `registryService` bean; `MatchCommandPort`, `MatchQueryPort`, `WeatherSelectionService` beans gain the `RegistryService` dependency |
| OpenAPI | `v0.36.0-registry-api.yaml` (new); `v0.28.7-match-logs-api.yaml` updated (`REGISTRY_CHANGE` documented, no longer a future addition). **36.1**: `v0.36.0-registry-api.yaml` bumped to `version: 0.36.1` (Values / Conditions-over-a-set / Ordering rewritten, §2); `v0.19.0-match-creation-api.yaml`'s `RegistryEntry` schema updated too (§8) |
| Authoring (Java) | `StoryCrudService`, `StoryImportService` — `registryValueOperatorCondition` round-trips on events, edges, weather rules. **36.1**: `multiValue` round-trips on keys too |
| Engine (Python) | `app/core/services/match/registry_service.py` (new); `choice_availability.py`, `event_availability.py`, `movement_service.py`, `weather_selection_service.py`, `event_service.py`, `match_command_service.py`, `match_logs_service.py`, `match_query_service.py` updated. **36.1**: `evaluate`/`upsert`/`remove` widened to sets, mirroring Java. **36.2**: `registry_service.py` gains `_norm`/`_eq` for case-insensitive comparison (§13); `event_service._resolve_arrival` gains `_write_arrival_registry` (§14); `event_store_adapter._event_dict` bugfix (§9, bug 6) |
| Ports/persistence (Python) | `app/core/ports/match/registry_ports.py` (new); `app/adapters/persistence/match/registry_store_adapter.py` (new); `story_match_read_adapter.find_keys_by_story_id` (vocabulary normalisation, bug §9.3). **36.1**: list-returning `find_by_match_and_key`, `insert_value`/`delete_value` added |
| REST (Python) | `app/adapters/rest/match/match_controller.py` — new route + `_registry_to_camel`; `/info`'s `_detail_to_camel` extended. **36.1**: both drop `stringValue`/`intValue` for `values`/`multiValue`. **36.2**: `match_admin_controller.py` gains `PUT`/`DELETE /{uuidMatch}/registry` (§15) and the admin weather rule rows gain the registry-verdict fields ([Step27](./Step27_WeatherSystem.md)) |
| Schema (Python) | `app/adapters/persistence/story/models.py` — `KeyEntity.priority`; `registry_value_operator_condition` on `LocationNeighborEntity`/`WeatherRuleEntity`/`EventEntity`; `database.py` `align_schema()` drift replayer extended, `_TEXT_COLUMNS`. **36.1**: `multi_value` added on `KeyEntity` and the state-row model, applied via `align_schema()` (no Flyway on this backend, §10). **36.2**: `LocationEntity` gains the four arrival-registry columns (§14), also applied via `align_schema()` |
| Engine (AWS) | `lambda/match/registry.py` (new); `lambda/match/events.py` (`apply_registry` now delegates, bug §9.1); `lambda/match/handler.py` (`_edge_condition_met` consolidation — bug §9.2 —, `_weather_condition_matches`, `_get_match_registry`, dispatcher route). **36.1**: `registry.py` gains `rows_in`/`values_in`/`remove`; `upsert(..., story=None)` (§10). **36.2**: `registry.py` gains `_norm`/`_eq` (§13); `handler.py _resolve_arrival` gains `_write_arrival_registry` (§14); new `PUT`/`DELETE` registry routes and admin-weather registry fields (§15, [Step27](./Step27_WeatherSystem.md)) |
| Infra (AWS) | `template/match.yaml` — one new route. **36.2**: two more routes (admin registry PUT/DELETE) |
| Seed (all four + demo JSON) | `R__insert_story_seed_data.sql`, `scripts/seed_stories.py` (registry keys added — gap §9), `lambda/seed/handler.py`, `story_demo_3.json`, `story_demo_4.json` — boolean vocabulary sweep (§5). **36.1**: all four gain the `evidence_found` multi-value test-bed on the tutorial story (§13). **36.2**: all four gain `case_notes`/`signal`/`vault_seen` keys, the Records Vault location and four FREE events (§16) |
| Game board | `react-game/src/features/gameplay/cards/RegistryCard.jsx`, `RegistryCards.jsx`, `RegistryKeyCard.jsx` (new); `utils/registry.js` (new); `useBookView.js`, `GameBook.jsx`, `PageLeft.jsx`, `PageRight.jsx`, `PageRightInfo.jsx`, `PageRightMain.jsx`, `js/boardProps.js`, `utils/loadoutCards.js`, `api/matchInfoAdapter.js` (doc only) updated; `data/images.json`, i18n `en.json`/`it.json`. **36.1**: `utils/registry.js` gains `registryValues(entry)` (§11). **36.2**: `src/utils/matchStatus.js`/`StoryCard.jsx` Replay button — unrelated to the registry, see [Step18](./Step18_GameMainFrontend.md) |
| Admin | `constants/story/storiesEntities.jsx` — `registryValueOperatorCondition` select on `events`/`location-neighbors`/`weather-rules`, reusing `CHOICE_CONDITION_OPERATOR_OPTIONS`. **36.1**: `RegistryCard.jsx`/`MatchDetailModal` show Values/Multi instead of String/Int value; `storiesEntities.jsx`'s key form gains a `multiValue` checkbox (§12). **36.2**: `RegistryCard.jsx` gains per-row edit/remove-member/clear-key controls and an "Add a key" row (§15); `WeatherCard.jsx` gains the Registry column ([Step27](./Step27_WeatherSystem.md)); `GuestsPage.jsx` bugfix (§9.2 note in [Step12](./Step12_GuestLoginMethod.md)) |
| Robot | `code/tests/robot/tests/36_registry/registry.robot` (10 tests); `Get Registry` keyword in `resources/matches.resource` — see `.claude/docs/robot-suites.md` for suite/keyword detail, not duplicated here. **36.1**: new `36_registry/registry_multi_value.robot` (9 tests); `registry.robot` updated to the new payload shape and grew to 11 tests (§13). **36.2**: new `registry_case_insensitive.robot` (5), `registry_location_writes.robot` (5), `registry_admin_edit.robot` (6); `registry_multi_value.robot` fixture discovery made behaviour-based (§16) |
| Tests | Java: `RegistryServiceTest`, `RegistryStoreAdapterTest`, `RegistryControllerTest`, plus updates across `EventAvailabilityCheckerTest`, `WeatherSelectionServiceTest`, `MovementServiceTest` and more. Python: `test_registry_service.py`, `test_registry_store_adapter.py`, `test_match_controller_registry.py`, plus equivalents. AWS: `test_registry.py`, `test_match_handler_registry.py`. React-game: `RegistryCard.test.jsx`, `RegistryCards.test.jsx`, `registryUtils.test.js`. **36.1** coverage: java `RegistryService` 99.5%/95.5% branches, `RegistryStoreAdapter` 100%/100%; python 99%/100%; AWS `registry.py` 99% (§13). **36.2**: java 2466+ tests, python 1432, AWS 879, react-admin 687, react-game 1069 — full suite green (§16) |

Python and AWS mirror the Java engine described above, subject to the AWS storage note in §10
and the bugs fixed in §9.

---

# Version Control

- **Document Version**: 0.36.2

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.36.0 | Registry System, implemented: `RegistryService` consolidates every registry read, write and comparison behind `render`/`parse`/`evaluate` on all three backends (§1); `GET /api/match/{uuid}/registry` reads the visible keys grouped by `list_keys.group`, duplicated onto `/info` (§2-§4, §8); a new `registry_value_operator_condition` column on events, edges and weather rules reuses the choice-conditions operator vocabulary, retiring weather's old "null value means unset" doctrine in favour of the strict reading events and movement already used (§5); `V0.36.0__registry_operator_conditions.sql` also makes `idx_state_reg_key` unique (§6); every write now leaves exactly one `REGISTRY_CHANGE` match-log row (§7); five bugs fixed in passing — AWS registry rows with no id/uuid, three duplicated AWS neighbour checks missing a null-guard, Python's `list_keys` model realigned to the Java vocabulary, plus the two the AWS Robot run caught after the first pass: `/info` not joining the registry there, and a null actor crashing the event chain on a time-start write (§9). | September 3, 2026 |
  | 0.36.1 | Registry multi-value keys, implemented: `list_keys.multi_value` lets a key hold a SET instead of one value, mirrored onto `gaming_state_registry.multi_value` per match so a match already in progress keeps the behaviour it was born with (§6.1); `evaluate` now reads `=`/`!=` as ∃/∄ and `>`/`<` as ∀ over the set, never vacuously true on an empty one, and a single-valued key's set still collapses to the reading it always had (§1, §7.2). Both registry payloads drop `stringValue`/`intValue` for a backend-ordered `values` array plus `multiValue` (§2-§3, §8); `value_to_add`/`value_to_remove` join or remove one member on a multi key instead of replacing it (§7.2); a write the registry refuses now leaves no `REGISTRY_CHANGE` row at all (§7). | September 4, 2026 |
  | 0.36.2 | Value comparison folds case and trims both sides, at comparison time only — keys still match exactly and storage is untouched (§13); `list_locations` gains two registry pairs, one for the first arrival and one for every later one (§14); new admin `PUT`/`DELETE /api/admin/matches/{uuid}/registry` route the console through the ordinary engine (§15). A sixth bug fixed in passing: Python's `_event_dict` dropped the operator column, so `execute-event` and `/info` disagreed on the same event (§9, bug 6). | September 5, 2026 |

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
