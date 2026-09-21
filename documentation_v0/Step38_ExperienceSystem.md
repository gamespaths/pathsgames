# Step 38 — Experience and character advancement

`gaming_character_instance.exp` has existed since `V0.29.0` ([Step 29](./Step29_NormalEvents.md#gaming_character_instance)) and was already written by event, choice and item effects — but nothing ever read it: no endpoint reported it, and no action let a player spend it. v0.38.0 projects `exp` on every player row and adds the one action that spends it: a permanent +1 on DEX, INT or COS.

## The price of a point

`cost = max(1, exp_cost × current_value + exp_cost_base)`. All three inputs — `exp_cost`,
`exp_cost_base`, `max_stat_value` — are read from the **difficulty row** the match was created
on, not from the match itself; `gaming_match.exp_cost` (present since the original schema) is
only the fallback used when that difficulty row has since been deleted. `max_stat_value` caps
the stat: once a stat sits at the cap, the next point costs `null` on `/info` and the action
answers `409 MAX_STAT_VALUE`.

Guards: `exp_cost <= 0` reads as `1`, `exp_cost_base <= 0` reads as `0`, `max_stat_value <= 0`
or unset means no cap. One calculator, three backends: Java
`core/service/match/ExperienceCostCalculator.java`, Python
`app/core/services/match/experience_cost.py` (`ExperienceCost`), AWS
`lambda/match/experience.py` (`Pricing`).

## 1. The action

`POST /api/gameplay/{uuidMatch}/action/use-exp`, body `{"stat": "dex|int|cos"}` — the token is
trimmed and case-folded through the same vocabulary `EffectStatCodec` already uses for event/item
effects. The action costs **zero energy**, does **not** pass the turn, and is effective at once:
turn priority is only re-read at the next time-start. It is **not** coupled to sleeping — an
earlier draft tied advancement to the sleep action, but the shipped design lets a character spend
experience any time it is awake, in a safe location, on its own turn, exactly like `use-item`
([Step 34](./Step34_InventoryAndResources.md)) answers through its own action rather than riding
another one.

## 2. Gates, in order

All refusals are `409` except the two marked otherwise:

1. `MATCH_NOT_FOUND` (404) — unknown match, unknown user, or the caller owns no character in it.
2. `MATCH_NOT_RUNNING`
3. `NOT_YOUR_TURN` — checked only when the match has an active turn character and it is not the
   caller's.
4. `COMA`
5. `SLEEPING`
6. `INVALID_STAT` (400) — anything other than `dex`/`int`/`cos`.
7. `LOCATION_NOT_SAFE` — the character's location has `secure_param <= 0`
   ([Step 26](./Step26_TimeStartRecovery.md#the-p-bonus)), or the location no longer exists.
8. `MAX_STAT_VALUE` — the stat already sits at the difficulty's cap.
9. `NOT_ENOUGH_EXP` — the price exceeds the character's current `exp`.

`UNAUTHENTICATED` is `401` as everywhere else. `COMA` and `SLEEPING` are reused on purpose from
the inventory/event refusal vocabulary ([Step 30](./Step30_EdgeStates.md),
[Step 34](./Step34_InventoryAndResources.md)) rather than minted as new codes.

## 3. Response shape

`UseExpResponse`: `matchUuid, characterUuid, stat, statBefore, statAfter, expBefore, expAfter,
expCost, expCosts{dex,int,cos}` (the refreshed price list after the purchase) plus
`statChanges[]` — two rows in the same shape `execute-event` already uses
(`{characterUuid, statistic, before, after, delta}`): the purchased stat with `delta +1`, then
`exp` with `delta -cost`. Reusing that shape lets react-game render the purchase through the
stat-change badges it already has for events and items.

## 4. Match log entry `EXP_USE`

One `log_events` row per purchase, character attached, message
`EXP_USE <stat> <before>-><after> cost <n>` (Java `ExperienceService.MSG_EXP_USE`, Python
`experience_service.MSG_EXP_USE`, AWS a `LOG#` row carrying `type: EXP_USE`, `message`, `stat`,
`expCost`). `MatchLogsService` classifies it on all three backends.
`v0.28.7-match-logs-api.yaml`'s type enum now lists `REGISTRY_CHANGE, MISSION_CHANGE, EXP_USE`.

## 5. Endpoint APIs

New spec: `code/backend/java/adapter-rest/src/main/resources/openapi/v0.38.0-experience-api.yaml`.
`v0.14.0-story-api.yaml` and `v0.15.0-story-content-api.yaml` swap the difficulty properties
(`expCostBase`/`maxStatValue` replace `costMaxCharacteristics`).

### `POST /api/gameplay/{uuidMatch}/action/use-exp`

See §1-§3 above for body, gates and response.

### `players[]` on `GET /api/match/{uuidMatch}/info`

Also on `/players`, `/character`, and the admin `/info`. New `exp` (int) and
`expCosts {dex, int, cos}` — the cost of the **next** point on each stat, `null` where the stat
is already at the cap. Java: `CharacterInstanceInfo` + `CharacterMapper` (resolves the
difficulty via `storyReadPort.findDifficultiesByStoryId`, keyed by `match.idDifficulty`) +
`AbstractCharacterStatsResponse`. Python: `character_query_service.build_character_infos` +
`match_controller._character_summary_to_camel`/`_character_full_to_camel`. AWS:
`_character_summary`/`_character_full` gained a `match` argument to reach the difficulty row.

### Admin

`POST /api/admin/matches/{uuidMatch}/player/{uuidCharacter}/changeStatistics` accepts `exp`
(`-1` or omitted = untouched, floored at `0`) alongside the existing stat fields, on all three
backends; Java `CharacterPersistencePort.updateCharacterExp`, Python `update_character_exp`.

## 6. DTOs and Domain Models

- Java: `core/port/match/ExperiencePort.java` (+ `UseExpResult`, `StatChange`,
  `ExperienceException.Code`), `core/port/match/ExperienceStorePort.java` (views `MatchExpView`,
  `CharacterExpView`, `DifficultyExpView`), `core/service/match/ExperienceService.java`,
  `core/service/match/ExperienceCostCalculator.java`,
  `core/persistence/match/ExperienceStoreAdapter.java`; `LocationRepository` and
  `StoryDifficultyRepository` gain `findByIdStoryAndId`;
  `adapter-rest/.../controller/match/ExperienceController.java`, DTOs `UseExpRequest`,
  `UseExpResponse`, `DifficultyResponse` (`expCostBase`/`maxStatValue`),
  `AbstractCharacterStatsResponse` (`exp`/`expCosts`); `ms-launcher/config/CoreConfig.java` bean
  `experiencePort`. Entities: `StoryDifficultyEntity` (`expCostBase`/`maxStatValue`, default
  `0`), `LocationEntity` (`isSafe` removed), `DifficultyInfo`; `StoryCrudService`/
  `StoryImportService`/`StoryQueryService` maps updated.
- Python: `app/core/ports/match/experience_ports.py`,
  `app/core/services/match/experience_service.py`,
  `app/core/services/match/experience_cost.py`,
  `app/adapters/persistence/match/experience_store_adapter.py`,
  `app/adapters/rest/match/experience_controller.py` (wired in `launcher.py`); `database.py`
  `align_schema` entries; `story/models.py`, `story_persistence_adapter.py`,
  `story_read_adapter.py`, `story_query_service.py`, `difficulty_info.py`; `match_models.py`
  (`CharacterInstanceInfo.exp`/`exp_costs`); `match_logs_service.py` (`_TYPE_EXP_USE`); admin
  `match_admin_controller.py` (`exp`); `character_command_service.py`,
  `character_persistence_adapter.py`.
- AWS: `lambda/match/experience.py` (new: `Pricing`, `pricing_for`, `difficulty_of`,
  `normalize_stat`, `check`, `apply`), `lambda/match/handler.py` (`_use_exp`, dispatch branch,
  `_character_summary`/`_character_full(match=)`, admin `exp`), `template/match.yaml`
  `UseExpRoute`, `lambda/story/handler.py` difficulty maps, `lambda/seed/handler.py`.

## 7. Roles and Authentication

Standard bearer JWT. `use-exp` enforces the same ownership rule as every other
`/api/gameplay/{uuidMatch}/action/...` route: a match belonging to a different user is
indistinguishable from one that does not exist (`MATCH_NOT_FOUND`, §2).

## 8. Database Tables

Migration `V0.38.0` (Flyway, both DBs):
`adapter-postgres/src/main/resources/db/migration/.../V0.38.0__experience_columns.sql`,
`adapter-sqlite/src/main/resources/db/migration/.../V0.38.0__experience_columns.sql`.

```sql
DROP INDEX idx_locations_safe;
ALTER TABLE list_locations DROP COLUMN is_safe;

ALTER TABLE list_stories_difficulty DROP COLUMN cost_max_characteristics;
ALTER TABLE list_stories_difficulty ADD COLUMN exp_cost_base INTEGER NOT NULL DEFAULT 0;
ALTER TABLE list_stories_difficulty ADD COLUMN max_stat_value INTEGER NOT NULL DEFAULT 0;
```

`list_locations.is_safe` was read by nothing — `secure_param` is the one "safe" signal the
engine has ever read ([Step 26](./Step26_TimeStartRecovery.md)). `cost_max_characteristics`'s
meaning changed three times during design, so it is dropped rather than repurposed.

Python's `align_schema` **RENAMES** `is_safe → secure_param` instead of dropping it: the Python
schema never had its own `secure_param` column, it used `is_safe` in that role, so the rename
keeps the data's meaning. The Python import now reads `secureParam` (was `isSafe`) — closing a
real contract drift, where the same story JSON was safe on Java and unsafe on Python.
`align_schema` adds/drops the same two difficulty columns as Java; AWS story-item difficulties
carry `expCostBase`/`maxStatValue`.

## 9. Story validation and import

Import ignores the legacy keys `costMaxCharacteristics` and `isSafe` silently (Java `getInteger`
on an unread key, Python `item.get`, AWS an explicit map) — a story authored before v0.38.0 stays
importable. Export (`GET /api/admin/stories/{uuid}`), entity lists and admin CRUD all carry
`expCostBase`/`maxStatValue`, never the old keys.

Two import gaps closed by the Robot run: the **Java import never read `secureParam`** (only
the admin CRUD and the SQL seeds ever wrote it, so an imported location was never safe —
`StoryImportService.importLocations` now reads it), and the **AWS import stored a raw
location with its legacy `isSafe`** (now popped). "Export" in react-admin is the story head
plus the admin entity lists, not one endpoint: those lists are the contract.

## 10. Seeds and fixtures

Updated for the new/removed difficulty columns: seeds (Java dev SQL ×2,
`R__insert_dev_test_data.sql`; Python `seed_dev_data.py`; AWS `lambda/seed/handler.py`), the JSON
fixtures (`tutorial_story_dev.json`, `story_demo_3.json`/`story_demo_4.json`,
`stories/infinite_paths.json`, stress `tutorial_story.json`) and the Robot fixtures.

## 11. Frontends

### react-game

- `api/matches.js`: `useExp(uuidMatch, stat, accessToken)`.
- `api/matchInfoAdapter.js`: `playerStats.experience = player.exp`, `playerStats.expCosts`.
- `utils/experience.js`: `EXP_STATS`, `EXP_STAT_KEY`, `EXP_STAT_ICON`,
  `isLocationSafe(gameData)` (reads `locationsActive[0].secureParam`, the same field
  `GoToSleepCard` reads), `expStatRows(playerStats)`, `cheapestExpCost`,
  `canUseExp(gameData, playerStats)` (safe location, awake, not coma, at least one affordable
  point).
- Cards: `features/gameplay/cards/ExperienceCard.jsx` (door card; `little` variant sits **last**
  on the board, after `GoToSleepCard`, and `page` variant opens on the **left** page),
  `ExperienceStatCard.jsx` (one per stat — current value, price or "Max", locked with
  `lockInfo` for `NOT_ENOUGH_EXP`/`MAX_STAT_VALUE`, action "Improve" → `useExp` → `onDone`),
  `ExperienceCards.jsx` (the **right**-page grid, affordable stats first).
- `js/useBookView.js`: new view `'exp'`, action `openExp`; `PageLeft`/`PageRight`/
  `PageRightMain`/`GameBook` wired (`onOpenExp`, `onCloseExp`, `onExpUsed`); `js/boardProps.js`
  `expSummaryProps`; `js/useGameplayResults.js` `handleExpUsed(result) =
  handleEventExecuted(result, buildExperienceCard(t))` so the +1 stat / -cost XP badges render
  through the existing `statChangeItems` path; `utils/loadoutCards.js` `buildExperienceCard`.
- `data/images.json` gains an `experience` entry (icon `fas fa-star`, placeholder image reused
  from the registry card); `features/matches/MatchLogCard.jsx` gains an `EXP_USE` icon/colour.
- `utils/bonusStats.js` + `BonusBadgeList.jsx`: difficulty badges show `expCostBase`/
  `maxStatValue`, replacing `costMaxCharacteristics`.
- i18n: `game.exp.{title,description,open,use,current,cost,atMax,reason.*,reasonFull.*}`,
  `matchLog.types.EXP_USE`, `book.stats.expCostBase`/`maxStatValue` (`en.json`/`it.json`).

### react-admin

`constants/story/storiesEntities.jsx`: difficulty form/columns gain `expCostBase`,
`maxStatValue`, drop `costMaxCharacteristics`; location form/columns lose `isSafe` (columns show
`secureParam` instead). `components/match/detail/PlayersCard.jsx` gains an `XP` column;
`EditStatsModal.jsx` gains an `exp` field; `MatchLogsCard.jsx` gets `TYPE_META.EXP_USE` (detail =
the log message); `StoryImportPage.jsx`'s example payload is updated to match.

## 12. Robot (`code/tests/robot/tests/38_experience/`)

Own story `story_experience.json` (uuid `f0380001-0000-4000-8000-000000000380`, PRIVATE,
category `robottest`): template DEX/INT/COS `2`, class bases `0`, difficulty `expCost 1,
expCostBase 0, maxStatValue 4`; location 1 "Hall" (`secureParam 1`, start), location 2 "Wilds"
(`secureParam 0`); events 10 (+1 exp), 11 (+50 exp), 18 (`quests=open`), 12/13/14
(`qa`/`qb`/`qc=done`), 15/16/17 rewards (+1 exp, no location — only a completed mission fires
them); missions A/B/C available on `quests=open`, one step each on `qa`/`qb`/`qc=done`, with
`idEventCompleted` 15/16/17 ([Step 37](./Step37_MissionSystem.md) for `id_event_completed`).
Shared `experience_common.resource` (Suite Setup/Teardown, `Fresh Experience Match`, `Run Event`,
`The Player`, `Give Exp`, `Rows Of Type`).

- `experience.robot` — 14 tests (pricing, gates in order, response shape, log entry).
- `experience_missions.robot` — 2 tests: a mission's reward events feed `exp`; v0.38.3 — three
  `use-exp` purchases write `use-exp`/`use-exp-DEX` and move two missions waiting on them,
  leaving no row for the undeclared `use-exp-INT` (§15).
- `experience_admin.robot` — 6 tests (import/export/CRUD contract for the new difficulty columns
  plus the legacy-key payload).

`resources/matches.resource` gains the `Use Exp` keyword; `Admin Change Statistics` gains `exp`,
`sleeping`, `coma`. The legacy `isSafe`/`costMaxCharacteristics` fields are removed from the
`14_admin`, `17_admin_crud`, `35_import_integrity` and `36_registry` fixtures (`36`'s locations
now carry `secureParam: 1`).

## Test coverage

- Java: `mvn test` green; JaCoCo 100% lines on `ExperienceService`, `ExperienceStoreAdapter`,
  `ExperienceController`, `ExperienceCostCalculator` and the new DTOs.
- Python: 1722 tests (new `test_experience_cost.py`/`test_experience_service.py`/
  `test_experience_store_adapter.py`/`test_experience_controller.py`, an `align_schema` Step 38
  case, a players `exp` projection test, admin `exp` tests).
- AWS: 1094 tests (`test_experience.py`, `test_match_handler_experience.py`, plus projection,
  admin-`exp` and story-import cases).
- react-admin 802; react-game 1309 (`experience.test.js`, `ExperienceCard.test.jsx`,
  `ExperienceStatCard.test.jsx`, plus board/hook/log-card/view-model cases).
- Robot: 21 new tests across `38_experience/`; a dry-run of the whole tree is **750/750** green —
  the live (non-dry-run) runs are still to be executed.

## Scope of change

| Layer | Path |
|---|---|
| Migration | `adapter-{sqlite,postgres}/src/main/resources/db/migration/v0/V0.38.0__experience_columns.sql` — drops `list_locations.is_safe` + `idx_locations_safe`; drops `list_stories_difficulty.cost_max_characteristics`, adds `exp_cost_base`/`max_stat_value` |
| OpenAPI | `adapter-rest/src/main/resources/openapi/v0.38.0-experience-api.yaml` (new); `v0.14.0-story-api.yaml`/`v0.15.0-story-content-api.yaml` (difficulty properties swapped); `v0.28.7-match-logs-api.yaml` (`EXP_USE` enum value) |
| Java core | `ExperiencePort`, `ExperienceStorePort`, `ExperienceService`, `ExperienceCostCalculator`, `ExperienceStoreAdapter`; `LocationRepository`/`StoryDifficultyRepository` gain `findByIdStoryAndId`; `StoryDifficultyEntity`, `LocationEntity`, `DifficultyInfo`, `CharacterPersistencePort.updateCharacterExp` |
| Java rest | `ExperienceController`, `UseExpRequest`, `UseExpResponse`, `DifficultyResponse`, `AbstractCharacterStatsResponse`; `CoreConfig` bean `experiencePort` |
| Python | `app/core/ports/match/experience_ports.py`, `experience_service.py`, `experience_cost.py`, `experience_store_adapter.py`, `experience_controller.py` (wired in `launcher.py`); `database.py` `align_schema`; `story/models.py`, `story_persistence_adapter.py`, `story_read_adapter.py`, `story_query_service.py`, `difficulty_info.py`; `match_models.py` (`CharacterInstanceInfo.exp`/`exp_costs`); `match_logs_service.py` (`_TYPE_EXP_USE`); `match_admin_controller.py` (`exp`); `character_command_service.py`, `character_persistence_adapter.py` (`update_character_exp`) |
| AWS | `lambda/match/experience.py` (new); `lambda/match/handler.py` (`_use_exp`, dispatch branch, `_character_summary`/`_character_full(match=)`, admin `exp`); `template/match.yaml` `UseExpRoute`; `lambda/story/handler.py` difficulty maps; `lambda/seed/handler.py` |
| react-game | `api/matches.js` (`useExp`), `api/matchInfoAdapter.js`, `utils/experience.js`, `ExperienceCard.jsx`, `ExperienceStatCard.jsx`, `ExperienceCards.jsx`, `js/useBookView.js`, `js/boardProps.js`, `js/useGameplayResults.js`, `utils/loadoutCards.js`, `data/images.json`, `features/matches/MatchLogCard.jsx`, `utils/bonusStats.js`, `BonusBadgeList.jsx`, `en.json`/`it.json` |
| react-admin | `constants/story/storiesEntities.jsx` (difficulties gain `expCostBase`/`maxStatValue`, locations lose `isSafe`); `components/match/detail/PlayersCard.jsx` (`XP` column); `EditStatsModal.jsx` (`exp`); `MatchLogsCard.jsx` (`TYPE_META.EXP_USE`); `StoryImportPage.jsx` (example payload) |
| Seeds | Java dev SQL ×2, Python `seed_dev_data.py`, AWS `seed/handler.py`; JSON fixtures `tutorial_story_dev.json`, `story_demo_3.json`/`story_demo_4.json`, `stories/infinite_paths.json`, stress `tutorial_story.json` |
| Robot | `code/tests/robot/tests/38_experience/` — `story_experience.json`, `experience_common.resource`, `experience.robot` (14), `experience_missions.robot` (2), `experience_admin.robot` (6); `resources/matches.resource` (`Use Exp` keyword, `Admin Change Statistics` gains `exp`/`sleeping`/`coma`); legacy `isSafe`/`costMaxCharacteristics` removed from `14_admin`, `17_admin_crud`, `35_import_integrity`, `36_registry` fixtures; **v0.38.3** — `story_experience.json` gains keys `use-exp`/`use-exp-DEX`, event 19 "Teacher's gift", missions "First lesson"/"Nimble"; `experience_common.resource` gains `Registry Values Of`/`Mission Named` (§15) |

## 13. A mission's reward reaches the party

The roadmap's scenario — a completed mission fires an event granting `exp` — could not work as
the engine stood: a mission's event runs with no actor ([Step 37 §3](./Step37_MissionSystem.md#3-completion-events-and-firing-order)),
and `resolveRecipients` answered nobody, so the `exp` effect was skipped on all three
backends. v0.38.0 adds the one exception to INV-27: on a mission-fired event (`Exec.missionRun`
/ `_Exec.mission_run` / `acc['missionRun']`, set from the `mission completed` trigger)
`target = ALL` means every character of the match; `target_class` still narrows, `ONLY_ONE`
still names nobody, and any other actor-less run (a counter-zero fuse) is unchanged. Covered
by `EventExecutionServiceAutomaticTest`, `test_location_entry_events.py` (Python and AWS) and
`test_events.py`.

## 14. AWS fix — the stale-guest preview timed out

`GET/DELETE /api/admin/guests/stale` ([Step 12 §Admin guest management](./Step12_GuestLoginMethod.md), v0.36.2) resolved the
matches of the stale guests with one `USER_MATCHES#` GSI1 query **per guest**; with
`olderThanDays=0` every guest qualifies, and a table that had grown to a few hundred test
guests pushed the preview past the 30 s Lambda timeout — API Gateway answered `503`, the one
red row of the AWS Robot run. `_matches_of` now reads the GSI2 "by type" partition
(`GSI2_PK = MATCH`, `userCreatorUuid` projected — the same index the admin match list pages)
once and filters in memory; nobody to purge reads nothing. Covered by
`test_auth_handler_admin.py`. Needs a deploy.

## 15. `use-exp` writes the registry (v0.38.3)

After `updateCharacter` and the `EXP_USE` log row (§4), `use-exp` writes up to two registry
keys so a [Step 37](./Step37_MissionSystem.md#4-trigger) mission can wait for experience being
spent — **only a key the story declares in `list_keys`**; an undeclared key is skipped in
silence, no row, no `REGISTRY_CHANGE`, and a story declaring neither key sees no change at all:

1. `use-exp` — the highest numeric value currently stored for that key (non-numeric → 0) plus
   one: `1` on the party's first purchase of the match, `2` on the second, and so on. It is per
   **match**, not per character — in a multiplayer party it is the party's running total.
2. `use-exp-<STAT>` — `use-exp-DEX`/`use-exp-INT`/`use-exp-COS`, the stat token upper-cased,
   set to `statAfter`, the value the stat just reached.

Each write goes through the ordinary `RegistryService.upsert`, so it logs its own
`REGISTRY_CHANGE` row (`idCharacter` = the buyer, `clock` = the match clock, no event/choice)
and runs the Step 37 mission pass synchronously — a mission with `conditionKey=use-exp`,
`conditionValue=1` completes on the first purchase, `use-exp-DEX=4` completes when DEX reaches
4 through experience, and neither status ever regresses (`use-exp` moving to 2 does not reopen
a mission closed on 1).

Caveats: the stat key reflects only points bought with experience, not the starting value or
event/item stat effects; a declared-but-never-written key still shows on `GET .../registry` as
`values: []` ([Step 36](./Step36_RegistrySystem.md)), not absent; a story that declares
`use-exp` as a multi-value key reads the counter off its highest member.

Java: `ExperienceService` gains `KEY_USE_EXP`/`KEY_USE_EXP_PREFIX`, a 3-arg constructor
`(ExperienceStorePort, UserAccessPort, RegistryService)` (the 2-arg form keeps `registryService`
null — no writes), private `writeRegistry`/`intOrZero`; `RegistryService.isDeclared(idStory,
key)` is now public, `isDeclaredForMatchUuid` delegates to it; `CoreConfig`'s `experiencePort`
bean wires the registry service in. Python mirrors it: `experience_service.py` gains
`KEY_USE_EXP`, `KEY_USE_EXP_PREFIX`, `_int_or_zero`, `registry_service=None` on the
constructor, `_write_registry`; `registry_service.is_declared(id_story, key)`; `launcher.py`
passes it in. AWS: `lambda/match/experience.py` adds a pure `registry_writes(story, match,
token, after)` returning the `(key, value)` pairs to write, `lambda/match/handler.py`'s
`_use_exp` loops them into `_registry.upsert` before `_logbook.persist`. No new endpoint, no
OpenAPI change, no migration, no frontend change. Covered by `ExperienceServiceTest`'s nested
"the registry (v0.38.3)" (5 tests), `RegistryServiceTest`'s `isDeclared` assertions,
`test_experience_service.py` (+6), `test_experience.py` (+2) and
`test_match_handler_experience.py` (+1); Robot `38_experience/experience_missions.robot` gains
"Spending Experience Writes The Declared Keys And Moves The Missions Waiting On Them" (§12).

## Out of scope / decisions recorded

Missions stay `ACTIVE` after `GAMEOVER`, untouched by this step
([Step 37](./Step37_MissionSystem.md)). The orphan class bonus `exp` is still not applied at
time-start recovery ([Step 26](./Step26_TimeStartRecovery.md)). No cap is enforced on
event/item `dex`/`int`/`cos` effects — only `use-exp` honours `max_stat_value`.

---

# Version Control

- **Document Version**: 0.38.3

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.38.0 | Experience and character advancement, implemented: `gaming_character_instance.exp` (written since V0.29.0, unspent until now) gets a spender — `POST /api/gameplay/{uuid}/action/use-exp` raises DEX/INT/COS by one at `cost = max(1, exp_cost × current + exp_cost_base)`, read from the match's difficulty row and capped by `max_stat_value` (§0-§3); zero-energy, turn-preserving action gated by match/turn/coma/sleep/stat/safe-location/cap/afford checks in that order (§2); new match-log type `EXP_USE` (§4); `players[]` on `/info` (and `/players`, `/character`, admin `/info`) gain `exp`/`expCosts{dex,int,cos}` (§5). `list_locations.is_safe` dropped (Python renames it to `secure_param` instead, closing a Java/Python safety-field contract drift) and `list_stories_difficulty.cost_max_characteristics` dropped for `exp_cost_base`/`max_stat_value` (§8); admin `changeStatistics` gains `exp` (§5). react-game gains the Experience door card and per-stat purchase cards, react-admin gains an `XP` column and an `exp` edit field; new Robot suite `38_experience/` (21 tests, §12). | September 17, 2026 |
  | 0.38.3 | `use-exp` becomes a registry writer: after the `EXP_USE` log row it writes `use-exp` (running purchase count, per match) and `use-exp-<STAT>` (stat value just reached) through the ordinary `RegistryService.upsert`, each gated on the story declaring that key in `list_keys` (§15). No endpoint, OpenAPI, migration or frontend change; Robot `story_experience.json` gains keys 5-6 and a "Nimble" mission, `experience_missions.robot` grows from 1 to 2 cases (§12). | September 21, 2026 |

- **Last Updated**: September 21, 2026 (v0.38.3)
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
