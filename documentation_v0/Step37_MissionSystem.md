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

## Scope of change

| Layer | Path |
|---|---|
| Migration | `adapter-{sqlite,postgres}/src/main/resources/db/migration/v0/V0.37.0__mission_conditions.sql` — drops `condition_value_from`/`condition_value_to`, adds `condition_value`/`condition_values` on `list_missions` and `list_missions_steps`; unique `idx_missions_steps_order` |
| OpenAPI | `adapter-rest/src/main/resources/openapi/v0.37.0-missions-api.yaml` (new); `v0.19.0-match-creation-api.yaml` (`/info` gains `missions[]`) |
| Java core | `MissionService` (+ `beginDeferral`/`endDeferral`), `MatchMission`, `MatchMissionStep`, `MissionEntity`, `MissionStepEntity`, `BaseMissionEntity`, `MissionRepository`, `MissionStepRepository`, `MissionEventPort`; `RegistryService.norm`/`eq`/`containsNorm` made public; `EventExecutionService.MAX_ENTRY_DEPTH` made public |
| Java rest | `MissionController`, `MatchMissionResponse` |
| Python | `app/core/services/match/mission_service.py`, `align_schema()` `_DROPPED_COLUMNS`, `save_mission_steps` persistence port, `registry_service.py` public `norm`/`eq` |
| AWS | `lambda/match/missions.py`, `lambda/match/registry.py` public `norm`/`eq` and `is_mission`/`set_mission_hook` |
| react-admin | `ChipListInput.jsx`, `missions`/`mission-steps` field schemas, `EntityForm` required guard |
| react-game | `utils/missions.js`, `MissionCard.jsx`, `MissionCards.jsx`, `MissionStepCard.jsx`, `boardProps.js`, `useBookView`, `en.json`/`it.json` |
| Seeds | sqlite `R__insert_story_seed_data.sql`, postgres `R__insert_dev_test_data.sql`, python `scripts/seed_stories.py` + `seed_dev_data.py`, AWS `lambda/seed/handler.py`, `story_demo_3.json`/`story_demo_4.json` |

---

# Version Control

- **Document Version**: 0.37.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.37.0 | Mission tracking and progression, implemented: missions become a projection of the Step 36 registry — no operator, no state table, comparison always `"="` through `RegistryService.evaluate` (§0-§1); `condition_value`/`condition_values` (PIPE-separated AND) replace the from/to pair on `list_missions`/`list_missions_steps`, new unique `idx_missions_steps_order` (§8); status machine `AVAILABLE`→`ACTIVE`→`COMPLETED`/`FAILED`, persisted as (status + step reached) on `gaming_state_registry` via its existing `id_mission`/`id_mission_steps` columns, isolated from every player-facing registry read (§1-§2); completion events deferred through `MissionService.beginDeferral`/`endDeferral` around the four `EventExecutionService` entry points (§3); new `GET /api/match/{uuid}/missions` and `.../missions/{uuid}`, plus `missions[]` on `/info`, owner-only and 404-masked, a mission never reached simply absent from the list (§5); new validation rule `R10_MISSION_CONDITION`, report-only on the validate pass (§9); import bugs closed on Java and Python (§10); tutorial seed gained live writers for all mission keys plus a fourth, 0-step, set-AND mission (§11); react-admin `ChipListInput` and a required-condition-key guard, react-game's Missions bookmark goes live off `/info` (§12). | September 8, 2026 |

- **Last Updated**: September 8, 2026
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
