# Step 37 — Mission tracking and progression

`list_missions` and `list_missions_steps` have existed since `V0.10.4`, but nothing read them:
a story could author a mission and no match would ever notice. v0.37.0 gives them an engine,
two endpoints, and a place on `/info` — without adding an operator column, a comparison
routine, or a state table of its own.

## A mission is a projection of the registry

There is no operator on a mission. Every condition — the mission's own, and each step's — is
read through the Step 36 `RegistryService.evaluate` with `"="`, which on a single-valued key
means equality and on a multi-valued (set) key means CONTAINED IN. The comparison is the same
code events use — trimmed and case-folded — because `norm`/`eq`/`containsNorm` were made
**public** on `RegistryService` (java), `norm`/`eq` on `registry_service.py` and
`lambda/match/registry.py`, instead of being copied.

## The condition columns

`condition_value_from`/`condition_value_to` are gone. In their place:

- **`condition_value`** — one value.
- **`condition_values`** — a PIPE-separated list (`a|b|c`). Each segment is trimmed, empty
  segments dropped. It is an **AND**: on a set key every listed value must be present, not
  just one.

When both columns hold something, `condition_values` **wins** — authoring both is not a
validation error, just documented precedence.

A row whose `condition_key` is blank is **invalid**: it never activates, progresses or
completes, and all three backends ignore it silently. This is the exact **opposite** of the
registry's own "blank key = no condition" rule (`RegistryService.noCondition`) — the single
most confusable thing in this step. `react-admin` refuses to save such a row; story validation
reports it as `R10_MISSION_CONDITION`.

---

## 1. The status machine

`AVAILABLE` → `ACTIVE` → `COMPLETED`, plus `FAILED`.

| Transition | What causes it |
|---|---|
| → `AVAILABLE` | the mission's own condition is satisfied |
| → `ACTIVE` | the FIRST step condition is satisfied |
| → `COMPLETED` | the LAST step condition is satisfied |
| → `FAILED` | the story ENDS while the mission is still open |

A single-step mission goes `AVAILABLE` → `COMPLETED` directly, skipping `ACTIVE`. A mission
with no steps at all completes on its own condition — a documented decision, not in the
original roadmap text. An **intermediate** step closing does NOT move the status: a
three-step mission stays `ACTIVE` when its second step closes, and only `stepReached` moves —
which is why the persisted state is **(status + step reached)**, not status alone.

Steps are strictly sequential by their `step` integer, but may be **satisfied out of order**:
on every registry write the engine re-evaluates forward from the step reached, closing each
one already satisfied and stopping at the first that is not. One write can close several steps
and the mission with them.

States are **never reversible**: a status or step reached is never lost, even when the
registry value that produced it is later removed.

`FAILED` applies only to a mission that reached `AVAILABLE` or later and is still open when
the story ENDS. A mission never `AVAILABLE` is ignored entirely — no `FAILED`, no outcome.

Missions are **match-scoped**, not character-scoped.

## 2. State storage

One registry row per mission, on `gaming_state_registry`, using its existing `id_mission` /
`id_mission_steps` columns (modelled since `V0.10.7`, written by nothing until now). Key is the
reserved `mission:<uuidMission>`, `string_value` is the status, `id_mission_steps` is the last
step closed.

**Isolation is enforced at the store**: the repository/adapter reads filter `id_mission IS
NULL` for every player-facing registry read, so a bookkeeping row never appears on
`/registry` (not even `includeHidden=true`), never on `/info`'s registry block, and —
critically — never reaches `evaluate` as if it were a real key. On AWS the same rows live in
the match item's `registry` list, skipped by `registry.is_mission(row)`.

**v0.37.1 bugfix.** A mission gated on the start location's own first-entry key
(`list_locations.key_to_add`, [Step 36 §14](./Step36_RegistrySystem.md#14-v0362--a-location-can-write-the-registry))
could never open: that write only ran through `onArrival`, and the party is seeded already
`flag_visited = 1` there, so it never "arrives". `RegistryService.writeStartLocationEntry` now
writes that pair once, at match start, closing the gap — see
[Step 36 §14.1](./Step36_RegistrySystem.md#141-v0371-bugfix--the-start-locations-own-pair-never-wrote).

## 3. Completion events and firing order

`list_missions_steps.id_event_completed` runs when THAT step closes, not only at the end;
`list_missions.id_event_completed` runs when the mission completes. Steps fire in order, the
mission's own event last. The cascade — an event writes the registry, which completes another
mission — is accepted and capped by the existing `MAX_ENTRY_DEPTH = 8`; no new constant,
`EventExecutionService.MAX_ENTRY_DEPTH` was widened from private to public in Java.

**Firing is deferred.** An event execution buffers the characters it touches and writes them
at the end, so firing a mission event mid-execution would let a fresh execution read state the
outer one has not written yet. `MissionService.beginDeferral()`/`endDeferral()` bracket the
four public entry points of `EventExecutionService` (`executeEvent`, `selectChoice`,
`onArrival`, `runPendingAutomaticEvents`); the queue drains when the outermost hold is
released. On AWS there is one in-memory match dict, so the hook (`registry.set_mission_hook`)
fires from `_written`, the single funnel every successful write passes through.

## 4. Trigger

`RegistryService.log(...)` is the one choke point every registry write passes through (it
writes the `REGISTRY_CHANGE` audit row) — the mission pass is invoked from there. The engine
resolves the story id itself through a new port method `findStoryIdByMatch`.

---

## 5. Endpoint APIs

New spec: `code/backend/java/adapter-rest/src/main/resources/openapi/v0.37.0-missions-api.yaml`.
`v0.19.0-match-creation-api.yaml` gained the `missions` array on the `/info` schema.

### `GET /api/match/{uuidMatch}/missions?status=&lang=`

Owner-only, 404-masked with `MATCH_NOT_FOUND` exactly as the registry endpoints are.
`?status=` (`AVAILABLE`/`ACTIVE`/`COMPLETED`/`FAILED`) filters within the missions already
reached and is read case-insensitively.

```json
{ "missions": [ { "uuid": "...", "name": "...", "status": "ACTIVE", "stepReached": 1, "..." : "..." } ] }
```

**A mission the match has never reached is ABSENT from the list** — not returned as `LOCKED`.
Listing it would spoil it.

### `GET /api/match/{uuidMatch}/missions/{uuidMission}?lang=`

One mission with all its steps, same owner-only/404-masking rule; a mission not yet reached
404s exactly like an unknown one.

### `missions[]` on `GET /api/match/{uuidMatch}/info`

The same deliberate duplication Step 36 gave the registry, so the board renders with no
second request.

### Payload shape (identical in all three places)

```
{ uuid, name, description, idCard, card, status, stepReached, stepsTotal,
  steps: [ { uuid, step, name, description, idCard, card, done } ] }
```

`done` is true for every step up to and including the one reached; a `COMPLETED` mission
reports all of them done. `stepReached` is the `step` NUMBER of the last step closed, null
while none has been.

## 6. DTOs and Domain Models

- Java: `MatchMission` / `MatchMissionStep` (`core/model/match/`), `MatchMissionResponse`
  (`adapter-rest/dto/`), `MissionEntity` / `MissionStepEntity` / `BaseMissionEntity`
  (`core/entity/story/`), `MissionRepository` / `MissionStepRepository`
  (`core/repository/story/`), `MissionEventPort` (`core/port/match/`).
- Python: `app/core/services/match/mission_service.py`; `MissionEntity`
  (`app/models`), `save_mission_steps` added to the persistence port.
- AWS: `lambda/match/missions.py`.

## 7. Roles and Authentication

Both endpoints require the standard bearer JWT and enforce ownership like every other
`/api/match/{uuid}/...` route: a match belonging to a different user is indistinguishable from
one that does not exist.

## 8. Database Tables

- `list_missions`, `list_missions_steps`: dropped `condition_value_from` / `condition_value_to`;
  added `condition_value` (one value) and `condition_values` (PIPE-separated list,
  TEXT/VARCHAR(2000)).
- New unique index `idx_missions_steps_order` on `list_missions_steps (id_story, id_mission,
  step)` — two steps may not claim the same position in the same mission.
- Migrations: `V0.37.0__mission_conditions.sql` in both
  `adapter-sqlite/src/main/resources/db/migration/v0/` and the postgres twin. SQLite ≥ 3.35
  drops the columns in place — no table rebuild, no index touches them.
- Mission state itself adds no table: it rides `gaming_state_registry.id_mission` /
  `id_mission_steps`, modelled since `V0.10.7` (§2).

```sql
ALTER TABLE list_missions DROP COLUMN condition_value_from;
ALTER TABLE list_missions DROP COLUMN condition_value_to;
ALTER TABLE list_missions ADD COLUMN condition_value TEXT;
ALTER TABLE list_missions ADD COLUMN condition_values TEXT;
-- (same four statements on list_missions_steps)

CREATE UNIQUE INDEX IF NOT EXISTS idx_missions_steps_order
    ON list_missions_steps (id_story, id_mission, step);
```

Python's `align_schema()` gained a `_DROPPED_COLUMNS` dict — it could previously only RENAME
and ADD. In the same pass, `list_missions_steps.step_order` was renamed to `step`, and the
step row gained `uuid`, `id_card`, `id_text_name`, `condition_values`: the Python schema had
diverged from Java's, which broke admin CRUD GET/PUT/DELETE on mission-steps
(`find_entity_by_story_and_uuid` filters on `model.uuid`).

AWS keeps the story item's `missions` / `missionSteps` as flat camelCase arrays; the field
rename is the only change, no DynamoDB migration (re-seed).

## 9. Story validation

New rule **`R10_MISSION_CONDITION`**, reported for a mission or step with a blank
`condition_key`, and for one whose key has no value to compare against. **It is a report, not
a gate**: it runs only on the author's own "validate story" pass (`validateStory` /
`GET /api/admin/stories/{uuid}/validate`), NOT on story import and NOT on admin create. Every
backend ignores such a row rather than refusing it, and a story already carrying one must stay
importable — an earlier version blocked import with 400 and was corrected after the E2E run.
On AWS the switch is `validate_story_dict(data, include_mission_conditions=True)`.

## 10. Import fixes (pre-existing bugs closed)

- Java `StoryImportService.importMissions` never set `idEventCompleted`; `importMissionSteps`
  wrote only `id`/`idStory`/`idMission`/`step` and dropped uuid, card, texts and every
  condition field.
- The Python importer **silently dropped** the top-level `missionSteps` array (it read a
  nested `steps` list instead) while the validator validated that same array. New
  `save_mission_steps` on the persistence port closes it.

## 11. Seeds (tutorial story, all four seeds)

The seven mission-step keys (`visited_movement`, `visited_energy`, `visited_graduation`,
`potion_collected`, `snack_used`, `entered_arena`, `door_chosen`) were read by the steps and
**written by nothing**, so no tutorial mission could ever move. Now declared in `list_keys`
(group `missions`, no default value) and each written by a free zero-cost NORMAL event at the
start hall (ids 90380-90389), the same shape as the 36.1/36.2 packs — a zero cost keeps them
invisible to the Step 31/32 fixture finders. `tutorial_progress`, `items_collected` and
`choice_made` get writers too, so the three missions can open.

A **fourth mission**, "Gather the Evidence", was added: key `evidence_found`,
`conditionValues = 'ledger|letter'`, **no steps** — the fixture that proves the AND over a set
key, and the 0-step completion path.

Files: sqlite `R__insert_story_seed_data.sql`, postgres `R__insert_dev_test_data.sql` (which
had **no mission texts at all** — added), python `scripts/seed_stories.py` (which had **no
missions at all** — added) and `seed_dev_data.py`, AWS `lambda/seed/handler.py` (story item now
carries `missions`/`missionSteps`), plus `story_demo_3.json` / `story_demo_4.json` field
rename.

**v0.37.1 addition — a match-start fixture, on the SECOND story.** All four seeds gain key
`journey_begun` (PUBLIC, no default, group `missions`), written on the *second* story's
(Il Valvassore / demo1) starting location via `key_to_add`/`key_value_to_add`, plus a mission
reading it whose one step targets a key still at `0` — so the mission opens `AVAILABLE` but no
further. It deliberately does **not** sit on the tutorial story: a mission opening the instant
a fresh tutorial match starts would have broken three existing suite-37 cases that assert a
fresh match has reached no mission at all.

## 12. Frontends

### react-admin

`missions` and `mission-steps` field schemas swap the from/to pair for `conditionValue` (text)
and `conditionValues` (new `chips` type). New
`src/components/common/story/ChipListInput.jsx` edits the PIPE list as removable chips — the
pipe is the storage format, never typed by hand; duplicates are refused case-blind, exactly as
the backend compares. `EntityForm` gained a `required` guard on the field schema (it had none):
a mission or step with no `conditionKey` cannot be saved — the authoring-time half of
`R10_MISSION_CONDITION`. The old fields were typed `number` while the backend column is
`String`, so a value like `OPEN` was literally unauthorable before this step.

**v0.37.1.** The `mission-steps` section's `idCard` field is now the shared card picker
(`{ options: cardsOptions }`), matching every other section — it had been a raw numeric input.
The admin match-detail page gains a **Missions** tab: new `MissionsCard.jsx`
(`src/components/match/detail/`), a read-only twin of `RegistryCard.jsx` — Mission/Uuid/Status/
Steps/Reached table, a status badge (`AVAILABLE`/`ACTIVE`/`COMPLETED`/`FAILED`), expandable
steps, a per-status count in the header, and "No mission reached by this match" when empty.
No backend change: `MatchQueryService.buildDetail` already populated `detail.missions` on the
admin path and `MatchInfoResponse` already serialized it, so `GET /api/admin/matches/{uuid}/info`
was already carrying `info.missions` — only the tab was missing.

`CardsFastEditPage.jsx` gains `mission-steps` in both `CARD_REF_TYPES` and
`DESC_ALIGN_TYPES`: a card used by a step no longer shows as orphaned in the "used by" column
(and so is no longer deletable by mistake as unreferenced), and the step is now included in the
`idTextDescription` alignment check.

### react-game

`missions` rides on `/info`, so the panel costs no request — the same reasoning
`RegistryCards` documents. New `src/utils/missions.js` (`orderedMissions` puts open ones
first, `openMissions`, `missionProgress`, `missionProgressLabel`), `missionsSummaryProps` in
`boardProps.js` (the badge counts missions still OPEN, not every one reached — a card saying
"4" with all four done reports nothing), and three components mirroring the registry trio:
`MissionCard` (little + page), `MissionCards` (right-page grid), `MissionStepCard` (one
mission, status + progress badges over the image). A closed mission is LOCKED rather than
hidden, with the hint in `lockInfo` — never `label`, which is a display override that would
replace the name.

The **Missions bookmark**, greyed since v0.35.5 with "Missions coming soon", is now live: new
view `'missions'` in `useBookView`, and the `alert('Missions coming soon!')` on the
characteristics card is gone. New i18n block `game.missions.*` in `en.json`/`it.json`;
`game.bookmarks.comingSoon` removed. The missions card sits in the (i) list **after** the
registry card — a parallel section, not absorbed into it.

**v0.37.1 — steps become readable.** `MissionStepCard`'s status badge now shows only on a
CLOSED mission (`COMPLETED`/`FAILED`); an open mission is simply available or in progress, and
badging every card cost space that belongs to progress. Badges switched from `BonusBadgeList`'s
little variant (tooltip only, no label) to full-size, restyled down by a dedicated
`.pg-card--mission` rule in `src/styles/main.css` (0.82rem, mirroring the existing
`.pg-card--registry` rule) so Status/Steps keep their labels. The (i) no longer hides itself
when a mission has steps but no image/description — that page is now where the steps live —
and routes through the new `onOpenMission` when wired, falling back to the old single-page
preview otherwise.

`useBookView` gains view `'missionSteps'`, state field `missionSelected` (cleared by
`closeAll`), and action `openMission({ mission, card, stats })`: the (i) on a mission now opens
the mission card (`variant="page"`) on the LEFT page and its steps list on the RIGHT page — the
same split zaino/registry already use; back returns to the missions grid, not the board. Wired
through `PageLeft.jsx` (`missionSteps` branch), `PageRight.jsx` (renders the new
`MissionStepsCards`), `GameBook.jsx`, `MissionCards.jsx`, and `js/bookmarks.js` (the Missions
bookmark stays lit inside `missionSteps` too). The previous path passed a `steps` field into
`openPreview`, which never destructured it — steps were never actually shown before this.

New `src/features/gameplay/cards/MissionStepsCards.jsx`: one card per step on the right page,
its own (i) opening the step card in `"page"` as an overlay above the list (back returns to the
list); the step number is no longer displayed. A closed step is `locked` with a green
"Completed" badge (`game.missions.status.COMPLETED`, class `.pg-card--mission-done`) doubling as
the lock hint; an open step carries no badge. Of the still-open steps, only the first in story
order is shown — later ones are what the story hasn't asked for yet, and listing them would
spoil it (helper exported as `visibleSteps(mission)`). New i18n key `game.missions.stepsEmpty`
in `en.json`/`it.json`.

Dev-seed note: in every seed except AWS's mission fixture, missions and steps carry no
`id_card`, so in dev they render as image-less cards falling back to their name as title.

**v0.37.3 — badge drops its `label`.** `missionStatusBadge` (`utils/missions.js`) no longer sets
a `label`, so the badge on both the mission card and the step card reads the status word alone
("Completed") instead of "Status: Completed" repeating what the badge already is.
`game.missions.status.COMPLETED` changes "Done" → "Completed" in `en.json` (`it.json` was
already "Completata"). The reading-page stats list, which labels every stat including status,
is unaffected.

## 13. Match log entry `MISSION_CHANGE` (v0.37.2)

Before this, a mission transition left no trace on the match log: `upsertMissionState` wrote
only the state row on `gaming_state_registry` (§2), and the timeline carried the
`REGISTRY_CHANGE` that caused the advance but not the advance itself — reading a log meant
knowing by heart which key belonged to which mission. The only indirect trace was
`automatic event <id> (mission completed)`, and only when the author had wired an
`idEventCompleted`.

Every transition now writes a row from the same place the state is saved — one writer, so a
transition can be neither lost nor doubled, the same rule §4's `REGISTRY_CHANGE` already
follows. Message format:

```
MISSION_CHANGE <uuid mission> <previous status|none> -> <new status>[ step <number>]
```

Examples: `MISSION_CHANGE m-1 none -> AVAILABLE`, `MISSION_CHANGE m-1 AVAILABLE -> ACTIVE step 7`,
`MISSION_CHANGE m-1 ACTIVE -> FAILED`.

Three deliberate choices:

- the mission is named by **uuid**, not id, so the row reads against the API payload with no
  lookup;
- the step number is the **author's own** `step` column, not the row id — a log is read by a
  person, and in the seeds the two do not coincide;
- the row names no character, event or choice — nothing in the fiction moves a mission, the
  engine does.

**Collateral fix.** `onStoryEnd` wrote the FAILED state's key with the mission's `id`, while
`advance` writes it with the `uuid` — same registry key, two different names. It now resolves
an id→uuid map once, at story end, so the closing row names the mission consistently (falling
back to the id when the story cannot be read).

Files: `code/backend/java/core/src/main/java/games/paths/core/service/match/MissionService.java`
(public constant `MSG_MISSION_CHANGE`, new private `transition`, `onStoryEnd` now resolves
`missionUuids`); `code/backend/python/app/core/services/match/mission_service.py`
(`MSG_MISSION_CHANGE`, `_transition`, `_mission_uuids`); `code/backend/aws/lambda/match/missions.py`
(`MSG_MISSION_CHANGE`, `_log`, `_step_number`, `on_story_end(match, story=None)` — now takes the
story).

### One row per thing that happened, second pass (v0.37.2)

The first pass above wrote **one** row per engine pass, naming the last step reached. That
under-reported multi-step passes, and it collided with the next need (§ below): a card can
only narrate one status change, so a row that quietly meant two had no single card to wear.

`transition` now writes one row **per thing that happened**, in story order:

- the mission opening (`none -> AVAILABLE`) is always its own row, with **no** `step` —
  that is what points the timeline at the mission's own card, not a step's;
- each step closed by the pass gets its own `... step N` row, in the order the steps sit in
  the story, not the order the registry happened to close them;
- closing the mission's **last** step writes **two** rows, in this order: the step's
  (`-> COMPLETED step N`) first, then the mission's (`-> COMPLETED`, no step) second — so the
  mission's own card, not the last step's, gets to say the mission ended;
- a mission that opens and closes a step in the same pass writes the mission row before the
  step row;
- a step-less mission that completes in one write still writes exactly one row, as before.

The message format is unchanged — only how many rows one engine pass produces, driven by
whether `step N` is present. New private helper `rowsOf` (Java) / module helper `_rows_of`
(Python `_rows_of`, AWS `_rows_of` in `missions.py`) builds the ordered list of `(step|None)`
entries for one pass; `transition`/`_transition`/`_write` calls `log`/`_log` once per entry.
AWS's `_write` now also takes the pass's closed steps and the `fresh` flag (was: just the
final status) so it can reconstruct the same ordered list.

### Timeline classification

All three match-log assemblers recognize the new prefix and expose it as `type: "MISSION_CHANGE"`:
Java `MatchLogsService`, Python `match_logs_service.py`, and the `elif` chain in AWS
`lambda/match/handler.py`. An unrecognized message is dropped, so without this branch the rows
would never reach the timeline — see
[Step28_MovementSystem.md's "Future Additions"](./Step28_MovementSystem.md#future-additions-out-of-scope-v0287)
for where `MISSION_CHANGE` sits alongside `REGISTRY_CHANGE` in that catalog.

### The row's own card, second pass (v0.37.2)

A `MISSION_CHANGE` row now carries `idCard`/`card` like any other entry — resolved from the
mission's or the step's own card, never the log's (the `log_events` table has no mission
column at all; the uuid inside the message is the only handle). Which one:

- a row with **no** `step` → the mission's own card, keyed by its uuid;
- a row with `step N` → that step's own card, keyed by `"<mission uuid>/<step number>"`;
- **deliberately**: a step with no card leaves the row card-less — it does **not** fall back
  to the mission's card. Narrating an advance with the wrong picture is worse than showing
  none.

Java: new port methods `findMissionIdCardsByUuid` and `findMissionStepIdCardsByMissionUuid` on
`MatchLogsStorePort`, implemented in `MatchLogsStoreAdapter` (now also takes `MissionRepository`
and `MissionStepRepository`), plus helpers `missionUuidOf`/`stepNumberOf` and a new branch in
`MatchLogsService.enrich`. Python: `mission_cards`/`step_cards` maps and helpers
`_mission_uuid_of`/`_step_number_of` in `match_logs_service.py`. AWS: the same two maps and two
helpers in `lambda/match/handler.py`.

**Bugfix found in doing this.** A message with no uuid (any row this branch did not itself
write) used to do `Map.of(...).get(null)` on Java's immutable map, which throws
`NullPointerException` on a null key — one malformed row turned into a 500 on the **entire**
timeline. Guarded: a null uuid now resolves to a null card, not a lookup.

### Frontends

Neither `REGISTRY_CHANGE` nor `MISSION_CHANGE` had a timeline mapping before this: both fell to
the default grey entry, no icon, no filter chip in the admin console. Added to
`code/frontend/react-game/src/features/matches/MatchLogCard.jsx` (`TYPE_ICON`/`TYPE_COLOR`) and
`code/frontend/react-admin/src/components/match/detail/MatchLogsCard.jsx` (`TYPE_META`) —
mission in gold, registry in blue. Also fixed `fa-wand-magic-sparkles` (a Font Awesome 6 glyph)
to `fa-magic` for `AUTOMATIC_EVENT`: react-game loads FA 5.15.4, so the icon was simply invisible.

See "react-game history rewrite, second pass" below for how the resolved card now reaches the
match-log timeline in the game frontend.

### Seed data: missions and steps gain a card (v0.37.2, second pass)

No mission or step in any seed carried an `id_card`, so §12's mission cards and the row card
above had nothing to resolve — missions rendered image-less and a `MISSION_CHANGE` row's (i)
had no picture to open. All four seeds now give the tutorial's 4 missions and 7 steps a card
(reusing cards already present in that story), and the same for the second story's
mission/step pair. Files: `adapter-sqlite/.../R__insert_story_seed_data.sql`,
`adapter-postgres/.../R__insert_dev_test_data.sql`, `code/backend/python/scripts/seed_stories.py`,
`code/backend/aws/lambda/seed/handler.py`.

### react-game history rewrite, second pass (v0.37.2)

- `code/frontend/react-game/src/features/gameplay/cards/PlayerCards.jsx`: the small story card
  that opens the history now passes `entityType="matchlog"` instead of `"story"` — the player
  had no way to tell what tapping it would open. New i18n key `book.matchlog` (`en.json`
  "History", `it.json` "Cronologia") — the history page itself already used this `entityType`
  and, without the key, showed the raw i18n path.
- `MatchLogCard.jsx`: the timeline is a **list of rows**, not a grid of card tiles. New
  exported `LogEntryRow` replaces `LogEntryCard`; the tile-only `entryBadges` helper is
  removed. Each row: a type badge (icon + colour), the entry's card title, and the same (i)
  button as before, opening that card as a page on the right. Date, actor and the resource
  badges (`resourceBadges`) now live only on that page, not on the row.
  - `REGISTRY_CHANGE` rows are the one exception: no card exists behind a registry write, so
    the row shows what the message says instead (the text after the `REGISTRY_CHANGE` prefix,
    e.g. `gate null -> open`, via new exported helper `registryDetail`) and carries no (i).
  - With the backend now resolving the mission's/step's own card (see above), a
    `MISSION_CHANGE` row's title is that card's own title, not a repeated "Mission" label, and
    its (i) opens the real card image.
- New i18n keys `matchLog.types.REGISTRY_CHANGE` / `matchLog.types.MISSION_CHANGE`
  ("Registro"/"Registry", "Missione"/"Mission") — without them the type badge printed the raw
  i18n key.

### Robot suite, second pass (v0.37.2)

`code/tests/robot/tests/37_missions/mission_log.robot` grew from 5 to **8** cases. The three
new ones: a mission row carries the mission's own card (`idCard` + resolved title); a step row
carries its **own** card, not the card of the event that opened it (proves the lookup reads the
right table); and "Closing The Last Step Says So Twice: The Step, Then The Mission", which
plays a mission to completion and asserts the row count (`len(steps) + 2`), that the
second-to-last row names the last step, and that the last row names no step at all — the step
case also checks the step's own `idCard`. All found by BEHAVIOUR, no seeded uuid; the new cases
`Skip` when the story gives no mission a card.

## 14. AWS fixes (v0.37.2)

### Empty class references crashed match creation

`int("")` raises `ValueError`, and any match on an admin-authored story with an empty class
reference answered 500: the guard was `is not None`, but the admin form writes `""` into a
field left blank, and on AWS the story is stored as raw JSON in DynamoDB, so that `""` survives
untouched. Java and Python never hit this because the column is an `Integer` on the database
and import normalizes optional FKs to `NULL`.

New helper `_class_ref(value)` in `code/backend/aws/lambda/match/handler.py`: an empty or
unreadable class reference is **no constraint**, not class zero. Used in
`_resolve_and_validate_traits` (where it crashed) and in `_validate_class`, which had the same
bug silently — an empty column made the template reject every class as
`CLASS_NOT_COMPATIBLE`. The two trait budgets get the same treatment: an empty budget now means
no limit.

### 401 codes aligned with the Java filter

The Java filter has a scale of rejections — `MISSING_TOKEN` (no Bearer header), `EMPTY_TOKEN`
(Bearer with no value), `INVALID_TOKEN` (a token that fails to validate) — while AWS flattened
all three to `UNAUTHENTICATED`, so `37_missions/missions.robot` (which pins `MISSING_TOKEN`)
could not pass on AWS. New helper `bearer_token_error(event)` in
`code/backend/aws/lambda/common/http_utils.py`; `_resolve_user` in `lambda/match/handler.py`
uses it and now answers `INVALID_TOKEN` when the token fails to verify. `UNAUTHENTICATED`
remains only for "user not found". Scoped to the `match` lambda (`/api/matches`, `/api/match/*`,
`/api/gameplay/*`); the `auth` and `story` lambdas still answer `UNAUTHORIZED` — a known
divergence, left for a dedicated pass.

## Test coverage

- Java: `MissionServiceTest` (39), `MissionControllerTest` (6), `MatchMissionResponseTest`,
  `MatchMissionTest`, plus additions to `RegistryStoreAdapterTest`, `MatchQueryServiceTest`,
  `StoryValidatorServiceDbPathTest`. Coverage: `MissionService` 98%, controller/DTO/model 100%.
- Python: `test_mission_service.py` (38), `test_match_controller_missions.py` (6), plus
  `align_schema` and adapter additions. 1620 tests, `mission_service` 98%.
- AWS: `test_missions.py` (28), `test_match_handler_missions.py` (8). 967 tests, `missions.py`
  99%.
- react-admin 786, react-game 1162.
- Robot: new suite `code/tests/robot/tests/37_missions/` — `missions.robot` (10),
  `missions_progression.robot` (7), `missions_conditions.robot` (7), sharing
  `resources/missions.resource`. New keywords `Get Missions` / `Get Mission` in
  `matches.resource`. **685/685 green on java-sqlite and on python.**

**v0.37.1** — Java: `RegistryServiceTest` nested class `StartLocationEntry` (4 cases),
`TurnCycleServiceTest` (1 case). Python: `test_registry_service.py` (5), `test_turn_cycle_service.py`
(2). AWS: `test_turn_cycle_handler.py` (3). react-admin: new `MissionsCard.test.jsx` (8 cases,
100% stmts / 97.8% branch on that file, 794 total). Robot: new
`code/tests/robot/tests/37_missions/mission_from_start.robot` (5 cases) — see
`.claude/docs/robot-suites.md`. Results: Java BUILD SUCCESS, Python 1627 passed, AWS 970 passed,
react-admin 794 passed.

**v0.37.1, second pass (frontend)** — new `MissionStepsCards.test.jsx` and
`MissionCardsRendering.test.jsx` (the latter renders through the real `Card`, not a mock, and
asserts image, labelled badges, and the (i) button actually reach the DOM); updated
`MissionStepCard.test.jsx` and `GameBookViewModel.test.jsx`. Results: react-game 1175 passed /
3 skipped, react-admin 794 passed.

**v0.37.2** — six new backend cases for the mission log (opening, closing a step with the
author's step number, a no-step mission completing, a mission that does not move writing
nothing, story-end failure by uuid, fallback to id with no story port); 3 AWS cases for empty
class references; 5 AWS cases for the 401 codes (`test_common_http_utils.py`,
`test_match_handler.py`). New Robot suite `37_missions/mission_log.robot` (5 cases). Results:
Java BUILD SUCCESS, Python 1633 passed, AWS 983 passed, react-game 1184 passed / 3 skipped,
react-admin 794 passed.

**v0.37.2, second pass** — engine: three new cases (last step closes with two rows, two steps
closed by one write produce two ordered rows, opening a mission and closing a step in the same
pass produce mission-then-step); timeline: three new cases (a mission row resolves the
mission's card, a row with `step N` resolves that step's card, an unknown step resolves no
card); one Java adapter case (`uuid/step` keys, orphan/unnumbered steps excluded). New Robot
cases bring `mission_log.robot` to 8. Results: Java BUILD SUCCESS, Python 1640 passed, AWS 990
passed, react-game 1185 passed / 3 skipped, react-admin 794 passed.

## Scope of change

| Layer | Path |
|---|---|
| Migration | `adapter-{sqlite,postgres}/src/main/resources/db/migration/v0/V0.37.0__mission_conditions.sql` — drops `condition_value_from`/`condition_value_to`, adds `condition_value`/`condition_values` on `list_missions` and `list_missions_steps`; unique `idx_missions_steps_order` |
| OpenAPI | `adapter-rest/src/main/resources/openapi/v0.37.0-missions-api.yaml` (new); `v0.19.0-match-creation-api.yaml` (`/info` gains `missions[]`) |
| Java core | `MissionService` (+ `beginDeferral`/`endDeferral`), `MatchMission`, `MatchMissionStep`, `MissionEntity`, `MissionStepEntity`, `BaseMissionEntity`, `MissionRepository`, `MissionStepRepository`, `MissionEventPort`; `RegistryService.norm`/`eq`/`containsNorm` made public; `EventExecutionService.MAX_ENTRY_DEPTH` made public |
| Java rest | `MissionController`, `MatchMissionResponse` |
| Python | `app/core/services/match/mission_service.py`, `align_schema()` `_DROPPED_COLUMNS`, `save_mission_steps` persistence port, `registry_service.py` public `norm`/`eq` |
| AWS | `lambda/match/missions.py`, `lambda/match/registry.py` public `norm`/`eq` and `is_mission`/`set_mission_hook` |
| react-admin | `ChipListInput.jsx`, `missions`/`mission-steps` field schemas, `EntityForm` required guard. **37.1**: `MissionsCard.jsx` (new, Missions tab on `MatchDetailPage.jsx`); `StoryEditorPage.jsx` `mission-steps` `idCard` picker fix; `CardsFastEditPage.jsx` `CARD_REF_TYPES`/`DESC_ALIGN_TYPES` gain `mission-steps` |
| react-game | `utils/missions.js`, `MissionCard.jsx`, `MissionCards.jsx`, `MissionStepCard.jsx`, `boardProps.js`, `useBookView`, `en.json`/`it.json`. **37.1**: `MissionStepCard.jsx` (badge only on closed mission, full-size badges, (i) always visible), new `MissionStepsCards.jsx`, `useBookView.js` (`missionSteps` view, `openMission`), `PageLeft.jsx`, `PageRight.jsx`, `GameBook.jsx`, `MissionCards.jsx`, `js/bookmarks.js`, `styles/main.css` (`.pg-card--mission`, `.pg-card--mission-done`), `en.json`/`it.json` (`game.missions.stepsEmpty`) |
| Seeds | sqlite `R__insert_story_seed_data.sql`, postgres `R__insert_dev_test_data.sql`, python `scripts/seed_stories.py` + `seed_dev_data.py`, AWS `lambda/seed/handler.py`, `story_demo_3.json`/`story_demo_4.json`. **37.1**: same four files, `journey_begun` key + start-location writer on the second story (§11). **37.2, second pass**: same four files, `id_card` added to the tutorial's 4 missions/7 steps and the second story's mission/step pair |
| Registry engine (37.1) | Java `RegistryService.writeStartLocationEntry`, `TurnCycleService.startMatch`, `CoreConfig` wiring; Python `registry_service.write_start_location_entry`, `turn_cycle_service.start_match`, `story_match_read_adapter.find_locations_by_story_id`, `launcher.py`; AWS `handler.py _write_start_location_registry`, called from `_start_match` — see [Step36 §14.1](./Step36_RegistrySystem.md#141-v0371-bugfix--the-start-locations-own-pair-never-wrote) |
| Robot (37.1) | `code/tests/robot/tests/37_missions/mission_from_start.robot` (5 cases) |
| Match log (37.2) | Java `MissionService` (`MSG_MISSION_CHANGE`, `transition`, `onStoryEnd` `missionUuids`), `MatchLogsService`; Python `mission_service.py` (`MSG_MISSION_CHANGE`, `_transition`, `_mission_uuids`), `match_logs_service.py`; AWS `lambda/match/missions.py` (`MSG_MISSION_CHANGE`, `_log`, `_step_number`, `on_story_end(match, story=None)`), `lambda/match/handler.py` classification. **Second pass**: Java `MissionService` (`rowsOf`, rewritten `transition`), `MatchLogsStorePort`/`MatchLogsStoreAdapter` (`findMissionIdCardsByUuid`, `findMissionStepIdCardsByMissionUuid`), `MatchLogsService.enrich`; Python `mission_service.py` (`_rows_of`), `match_logs_service.py` (`mission_cards`/`step_cards`, `_mission_uuid_of`/`_step_number_of`); AWS `lambda/match/missions.py` (`_rows_of`, `_write` now takes closed steps + `fresh`), `lambda/match/handler.py` (same two maps/helpers) |
| Frontends (37.2) | react-game `MatchLogCard.jsx` (`TYPE_ICON`/`TYPE_COLOR` for `REGISTRY_CHANGE`/`MISSION_CHANGE`, `fa-magic` fix); react-admin `MatchLogsCard.jsx` (`TYPE_META`). **Second pass**: react-game `PlayerCards.jsx` (`entityType="matchlog"`), `MatchLogCard.jsx` (`LogEntryRow` replaces `LogEntryCard`, `registryDetail`, row layout), `en.json`/`it.json` (`book.matchlog`, `matchLog.types.REGISTRY_CHANGE`/`MISSION_CHANGE`) |
| AWS fixes (37.2) | `lambda/match/handler.py` (`_class_ref`, `_resolve_and_validate_traits`, `_validate_class`); `lambda/common/http_utils.py` (`bearer_token_error`), `handler.py` `_resolve_user` |
| Robot (37.2) | `code/tests/robot/tests/37_missions/mission_log.robot` (5 cases; **8** after the second pass) |

---

# Version Control

- **Document Version**: 0.37.3

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.37.0 | Mission tracking and progression, implemented: missions become a projection of the Step 36 registry — no operator, no state table, comparison always `"="` through `RegistryService.evaluate` (§0-§1); `condition_value`/`condition_values` (PIPE-separated AND) replace the from/to pair on `list_missions`/`list_missions_steps`, new unique `idx_missions_steps_order` (§8); status machine `AVAILABLE`→`ACTIVE`→`COMPLETED`/`FAILED`, persisted as (status + step reached) on `gaming_state_registry` via its existing `id_mission`/`id_mission_steps` columns, isolated from every player-facing registry read (§1-§2); completion events deferred through `MissionService.beginDeferral`/`endDeferral` around the four `EventExecutionService` entry points (§3); new `GET /api/match/{uuid}/missions` and `.../missions/{uuid}`, plus `missions[]` on `/info`, owner-only and 404-masked, a mission never reached simply absent from the list (§5); new validation rule `R10_MISSION_CONDITION`, report-only on the validate pass (§9); import bugs closed on Java and Python (§10); tutorial seed gained live writers for all mission keys plus a fourth, 0-step, set-AND mission (§11); react-admin `ChipListInput` and a required-condition-key guard, react-game's Missions bookmark goes live off `/info` (§12). | September 8, 2026 |
  | 0.37.1 | Bugfix: the start location's own first-entry registry pair — the one field a mission could gate on that could never fire — now writes at match start via `RegistryService.writeStartLocationEntry`, all three backends (§2, see [Step36 §14.1](./Step36_RegistrySystem.md#141-v0371-bugfix--the-start-locations-own-pair-never-wrote)); admin gains a read-only Missions tab (`MissionsCard.jsx`) on the match detail page; `mission-steps`' `idCard` field is now the card picker instead of a raw number (§12); new fixture — key `journey_begun` written on the second story's start location plus a mission reading it — in all four seeds (§11); new Robot suite `37_missions/mission_from_start.robot` (5 cases). Second pass, frontend: `MissionStepCard`'s status badge now only on a closed mission, full-size labelled badges, (i) always reachable; new `useBookView` `missionSteps` split-page view and `MissionStepsCards.jsx` render a mission's steps (only the next open one, to avoid spoilers); `CardsFastEditPage.jsx` recognizes `mission-steps` card references (§12). | September 9, 2026 |
  | 0.37.2 | New match-log entry `MISSION_CHANGE`, written by the same call that saves a mission's state, naming it by uuid with the author's own step number (§13); classified by all three timeline assemblers and given an icon/colour in both frontends, alongside the previously-uncoloured `REGISTRY_CHANGE` (§13); collateral fix — `onStoryEnd` now resolves mission uuids once so a FAILED close names the mission consistently with `advance`; new Robot suite `37_missions/mission_log.robot` (5 cases); AWS bugfix — empty class/trait-budget references from admin-authored stories no longer 500 on match creation (§14); AWS 401 codes aligned with the Java filter's `MISSING_TOKEN`/`EMPTY_TOKEN`/`INVALID_TOKEN` scale, scoped to the `match` lambda (§14). **Second pass**: one engine pass now writes one row **per thing that happened** instead of one naming only the last step — mission opening, each step closed (story order), and a completed mission's last step closes with the step's row then the mission's own (§13); a `MISSION_CHANGE` row now resolves and carries its own `idCard`/`card` (mission uuid, or `uuid/step` for a step; a step with no card stays card-less, never falls back to the mission's), fixing a null-uuid `NullPointerException` that 500'd the whole timeline (§13); all four seeds give the tutorial's missions/steps and the second story's mission/step pair an `id_card`; react-game's history is now a row list (`LogEntryRow`) instead of card tiles, opens via `entityType="matchlog"` ("History"/"Cronologia") instead of "Story", and `REGISTRY_CHANGE` rows show the written value with no lens; Robot's `mission_log.robot` grows from 5 to 8 cases. | September 9, 2026 |
  | 0.37.3 | `missionStatusBadge` drops its `label`: the status badge on mission/step cards reads "Completed" instead of "Status: Completed"; `game.missions.status.COMPLETED` "Done" → "Completed" in `en.json`. | September 10, 2026 |

- **Last Updated**: September 10, 2026
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
