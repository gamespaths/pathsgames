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

// The one registry comparison. = and != are textual, > and < need both sides numeric.
// A null expected value, an unparseable operand or an unknown operator is NOT met.
// An absent key satisfies only !=.
public static boolean evaluate(String operator, String expected, String actual) { ... }
```

`render`/`parse` are exact inverses — trimmed in both branches, which is the seeding behaviour
that won over the write-side parsers it replaced. `evaluate` is reused, unchanged, by
`EventAvailabilityChecker` (event conditions), `MovementService` (edge conditions),
`WeatherSelectionService` (weather rule conditions) and `ChoiceAvailabilityChecker` (choice
conditions, which already had the widest vocabulary and lost nothing by delegating to it).
Java, Python and AWS carry the identical three functions — the AWS module's own docstring says
it plainly: "Mirrors the Java `RegistryService` and the Python `registry_service`."

| Operator | Meaning |
|---|---|
| `=` (default) | Textual equality. A `null`/blank operator column reads as `=`. |
| `!=` | Textual inequality — the **only** operator an absent key can satisfy. |
| `>` / `<` | Numeric only; either side failing to parse as an integer makes the condition **not met**, never an error. |

A **null expected value is never met**, regardless of operator — "a typo must lock a door,
never open one" is the comment on all three backends. A **blank condition key** means "no
condition at all" (`RegistryService.noCondition(key)` / `no_condition`), which is a different
thing from a key with no expected value; the former short-circuits to *always available*, the
latter to *never met*.

## 2. `GET /api/match/{uuidMatch}/registry`

| Method | Path | Answers |
|---|---|---|
| GET | `/api/match/{uuidMatch}/registry` | the caller's match registry, grouped by category |

New OpenAPI spec:
[`v0.36.0-registry-api.yaml`](../code/backend/java/adapter-rest/src/main/resources/openapi/v0.36.0-registry-api.yaml).
Owner-only, like `/info`: any other caller — including a match that genuinely does not exist —
gets `404 MATCH_NOT_FOUND`, never `403`, so a match nobody may see is indistinguishable from
one that is not there.

```jsonc
{
  "groups": [
    {
      "category": "tutorial",
      "entries": [
        { "uuid": "3f2b1c4d-…", "key": "tutorial_progress",
          "stringValue": null, "intValue": 3,
          "idCharacter": 12, "category": "tutorial", "visible": true,
          "priority": 1, "idCard": 950, "card": { "title": "Training progress", "...": "..." } }
      ]
    }
  ]
}
```

Query parameters:

| Param | Default | Role |
|---|---|---|
| `lang` | `en` | Resolves each key's card, falling back to English. |
| `includeHidden` | `false` | Owner-only debugging door: also returns keys whose definition is not `PUBLIC` — usually a puzzle the player has not solved yet. |

## 3. Values, visibility, ordering

**Values.** A row's value lives in exactly one of `stringValue`/`intValue`, never both, so a
client can tell `"0"` from `0`. Booleans are integers by convention: `0` is no, anything else
is yes — see §5 for the sweep that made this actually true across the story schema.

**Visibility.** A key is visible when `list_keys.visibility` is `PUBLIC`; anything else hides
it. The column is free text with no enum, deliberately: a typo hides a key rather than leaking
one, the safe direction for authored content nobody validates at runtime. `?includeHidden=true`
adds the hidden keys and is owner-only; `/info` **never** returns hidden keys, whatever the
caller asks — there is no `includeHidden` on that path at all.

**Ordering.** Entries sort by category, then by the key's `priority`, then by key name. Groups
come out in the order their first entry appears (`LinkedHashMap` on java, an ordered dict on
python), so the grouping is stable across calls without a second sort pass.

**A row whose key the story no longer declares is kept but reads as hidden.** It is state the
engine wrote; dropping it silently would hide a bug rather than a key.

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
reusing that vocabulary rather than inventing a second one:

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

## 7. One writer, one audit row

Every write — engine, event effect, choice effect — now goes through
`RegistryService.upsert(idMatch, key, value, idCharacter, idEvent, idChoice, clock)`, which
reads the previous value, writes the new one, and appends exactly one
`log_events`/`eventLog` row:

```
REGISTRY_CHANGE <key> <old> -> <new>
```

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
a change, and a brand-new match's log history starts empty.

### 7.1 What the provenance columns mean

`upsert` stamps `id_character`, `id_event`, `id_choice` and `clock` on the row it writes, so a
registry row always says **who moved it last and when** — not who first created it. A seeded
row therefore carries a null `id_character` until something writes it, and every later write
overwrites the stamp rather than appending to it: the registry is state, not a history, and the
history is what `REGISTRY_CHANGE` is for. `id_character` is the actor who executed the event or
chose the option, never the recipient of its effects — a registry key is match-scoped, so an
effect targeting every character still writes one row, stamped once, by the one who acted.

### 7.2 A key effect SETS a value, it does not add to one

The effect columns are named `key_to_add` / `key_value_to_add` (events) and
`key` / `value_to_add` / `value_to_remove` (choices), and the verb "add" there means *add a
key/value pair to the registry* — **not** increment. `value` replaces whatever the key held,
whether the column in play ends up being `string_value` or `int_value`; there is no `+1`/`-1`
arithmetic anywhere in the write path. A story that wants a counter to climb authors one effect
per value it should reach, or drives the arithmetic from the event chain.

`value_to_remove` on a choice effect is the one conditional write: it clears the key only when
the stored value still equals it, so an option cannot wipe a key some other branch of the story
has since moved on. `value_to_add` wins whenever both are set.

## 8. `/info` gains the same six fields, deliberately duplicated

`MatchInfoResponse.RegistryEntryDto` gains `idCharacter`, `category`, `visible`, `priority`,
`idCard` and `card` — exactly the fields the new endpoint's `RegistryEntry` carries. The
duplication is deliberate, not an oversight: the game board already loads `/info` on every
reload, so rendering the registry section costs no second request and, because both payloads
are built from the same `RegistryService.listEntries` call, can never disagree with what the
dedicated endpoint would answer. `/info`'s registry list is always built with
`includeHidden=false` — there is no way to ask `/info` for hidden keys; that door only exists
on `/registry` itself.

## 9. Five bugs fixed in passing

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
  key), so the frontend can never present the entries in an order the backend did not.
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
key/string-value/int-value table — it has carried that since `v0.28.0` and Step 36 leaves it
untouched; it is unrelated to the new `react-game` component of the same name.

## 13. Test coverage

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

## 14. Scope of change

| Layer | Path |
|---|---|
| Migration | `adapter-{sqlite,postgres}/src/main/resources/db/migration/v0/V0.36.0__registry_operator_conditions.sql` — `registry_value_operator_condition` on `list_events`, `list_locations_neighbors`, `list_weather_rules`; dedup + `UNIQUE INDEX idx_state_reg_key ON gaming_state_registry(id_match, key)` |
| Entities (Java) | `EventEntity`, `LocationNeighborEntity`, `WeatherRuleEntity` gain `registryValueOperatorCondition` |
| Engine (Java) | `core/service/match/RegistryService.java` (new); `MovementService`, `WeatherSelectionService`, `ChoiceAvailabilityChecker`, `EventAvailabilityChecker`, `EventExecutionService.applyRegistryEffect`/choice-effect write, `MatchCommandService.createMatch` (seeding), `MatchQueryService` (`/info` + `getMatchRegistry`), `MatchLogsService` (`REGISTRY_CHANGE` type) all updated to call it |
| Ports/persistence (Java) | `core/port/match/RegistryStorePort.java` (new); `core/persistence/match/RegistryStoreAdapter.java` (new); `GamingStateRegistryRepository.findByIdMatchAndKey` (new) |
| Model (Java) | `core/model/match/MatchRegistryEntry.java` (extended: `idCharacter`/`category`/`visible`/`priority`/`idCard`/`card`), `MatchRegistryGroup.java` (new) |
| REST (Java) | `adapter-rest/.../controller/match/RegistryController.java` (new); `MatchRegistryResponse` (new DTO); `MatchInfoResponse.RegistryEntryDto` extended (same six fields) |
| Wiring (Java) | `ms-launcher/.../config/CoreConfig.java` — new `registryService` bean; `MatchCommandPort`, `MatchQueryPort`, `WeatherSelectionService` beans gain the `RegistryService` dependency |
| OpenAPI | `v0.36.0-registry-api.yaml` (new); `v0.28.7-match-logs-api.yaml` updated (`REGISTRY_CHANGE` documented, no longer a future addition) |
| Authoring (Java) | `StoryCrudService`, `StoryImportService` — `registryValueOperatorCondition` round-trips on events, edges, weather rules |
| Engine (Python) | `app/core/services/match/registry_service.py` (new); `choice_availability.py`, `event_availability.py`, `movement_service.py`, `weather_selection_service.py`, `event_service.py`, `match_command_service.py`, `match_logs_service.py`, `match_query_service.py` updated |
| Ports/persistence (Python) | `app/core/ports/match/registry_ports.py` (new); `app/adapters/persistence/match/registry_store_adapter.py` (new); `story_match_read_adapter.find_keys_by_story_id` (vocabulary normalisation, bug §9.3) |
| REST (Python) | `app/adapters/rest/match/match_controller.py` — new route + `_registry_to_camel`; `/info`'s `_detail_to_camel` extended |
| Schema (Python) | `app/adapters/persistence/story/models.py` — `KeyEntity.priority`; `registry_value_operator_condition` on `LocationNeighborEntity`/`WeatherRuleEntity`/`EventEntity`; `database.py` `align_schema()` drift replayer extended, `_TEXT_COLUMNS` |
| Engine (AWS) | `lambda/match/registry.py` (new); `lambda/match/events.py` (`apply_registry` now delegates, bug §9.1); `lambda/match/handler.py` (`_edge_condition_met` consolidation — bug §9.2 —, `_weather_condition_matches`, `_get_match_registry`, dispatcher route) |
| Infra (AWS) | `template/match.yaml` — one new route |
| Seed (all four + demo JSON) | `R__insert_story_seed_data.sql`, `scripts/seed_stories.py` (registry keys added — gap §9), `lambda/seed/handler.py`, `story_demo_3.json`, `story_demo_4.json` — boolean vocabulary sweep (§5) |
| Game board | `react-game/src/features/gameplay/cards/RegistryCard.jsx`, `RegistryCards.jsx`, `RegistryKeyCard.jsx` (new); `utils/registry.js` (new); `useBookView.js`, `GameBook.jsx`, `PageLeft.jsx`, `PageRight.jsx`, `PageRightInfo.jsx`, `PageRightMain.jsx`, `js/boardProps.js`, `utils/loadoutCards.js`, `api/matchInfoAdapter.js` (doc only) updated; `data/images.json`, i18n `en.json`/`it.json` |
| Admin | `constants/story/storiesEntities.jsx` — `registryValueOperatorCondition` select on `events`/`location-neighbors`/`weather-rules`, reusing `CHOICE_CONDITION_OPERATOR_OPTIONS` |
| Robot | `code/tests/robot/tests/36_registry/registry.robot` (10 tests); `Get Registry` keyword in `resources/matches.resource` — see `.claude/docs/robot-suites.md` for suite/keyword detail, not duplicated here |
| Tests | Java: `RegistryServiceTest`, `RegistryStoreAdapterTest`, `RegistryControllerTest`, plus updates across `EventAvailabilityCheckerTest`, `WeatherSelectionServiceTest`, `MovementServiceTest` and more. Python: `test_registry_service.py`, `test_registry_store_adapter.py`, `test_match_controller_registry.py`, plus equivalents. AWS: `test_registry.py`, `test_match_handler_registry.py`. React-game: `RegistryCard.test.jsx`, `RegistryCards.test.jsx`, `registryUtils.test.js`. |

Python and AWS mirror the Java engine described above, subject to the AWS storage note in §10
and the bugs fixed in §9.

---

# Version Control

- **Document Version**: 0.36.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.36.0 | Registry System, implemented: `RegistryService` consolidates every registry read, write and comparison behind `render`/`parse`/`evaluate` on all three backends (§1); `GET /api/match/{uuid}/registry` reads the visible keys grouped by `list_keys.group`, duplicated onto `/info` (§2-§4, §8); a new `registry_value_operator_condition` column on events, edges and weather rules reuses the choice-conditions operator vocabulary, retiring weather's old "null value means unset" doctrine in favour of the strict reading events and movement already used (§5); `V0.36.0__registry_operator_conditions.sql` also makes `idx_state_reg_key` unique (§6); every write now leaves exactly one `REGISTRY_CHANGE` match-log row (§7); five bugs fixed in passing — AWS registry rows with no id/uuid, three duplicated AWS neighbour checks missing a null-guard, Python's `list_keys` model realigned to the Java vocabulary, plus the two the AWS Robot run caught after the first pass: `/info` not joining the registry there, and a null actor crashing the event chain on a time-start write (§9). | September 3, 2026 |

- **Last Updated**: September 3, 2026
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
