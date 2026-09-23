# Step 39 — Random events

`list_global_random_events` has existed since `V0.10.4` (`condition_key`, `condition_value`,
`probability`, `id_event`, `id_card`, `id_text`), was imported and admin-CRUD-able, but no
engine on any backend ever read it. v0.39.0 gives it an engine: at every time-start, after the
weather and before the turn queue, at most one row fires — a global, actor-less event that
reaches the whole party.

## 1. When it fires

Only at time-start, on `RUNNING` matches, in the existing `TimeAdvancementService` sequence:
clock++ → clock history → wake all → recovery → pending automatic events (counter-zero,
start-time) → weather → **random events (new)** → turn queue. Never at clock 0 (match start),
never on arrival, never on a player action — Java wires it as
`randomEventService.pickAtTimeStart(match.id())` right after the weather roll
(`TimeAdvancementService`, guarded by `ctx.currentClock() <= 0` inside
`RandomEventSelectionService.pickAtTimeStart`). Python and AWS mirror the same position in
`time_advancement_service.py` / `match/handler.py`'s time-start branch.

## 2. The pick — an absolute percentage, not a weight

Eligible rows: the registry condition holds (`conditionKey` blank = no condition — the same
rule normal events use, the opposite of a mission's; the new
`registry_value_operator_condition` column, `=`/`!=`/`>`/`<`, `null`/blank read as `=`),
`probability > 0`, the referenced event exists, owns no choices, and is not a spent `ONCE`
event (checked against the same `EVENT_EXECUTED` markers normal automatic events already
write). Only eligible rows count towards the total; an excluded row takes no share.

Algorithm (`RandomEventSelectionService.pick`, Java; `random_event_selection_service.py`,
Python; `lambda/match/random_events.py`, AWS — three independent, near-identical
implementations, not a shared library):

1. Order the eligible rows by `probability` DESC then `id` ASC (`probability` doubles as
   priority, no new column needed).
2. `total` = sum of eligible probabilities.
3. Roll an integer in `[0, max(100, total))` with the seeded RNG (§3).
4. Walk the ordered rows accumulating `probability`; the row whose cumulative range contains
   the roll fires. `roll >= total` → nothing fires.

So with `total <= 100` each row fires with exactly its own percentage and `100 - total`% is
"nothing"; above 100 the roll range scales every row down proportionally and **one row always
fires** — no decimals, no rounding, just the wider roll range. Examples: Wolves 10 → 10% wolves
/ 90% nothing. Wolves 10 + Merchant 30 → 10% / 30% / 60% nothing. Wolves 70 + Merchant 60
(total 130) → 70/130 and 60/130, always one fires. A row can fire again on a later day unless
its event's `type = ONCE`.

## 3. Seed

`(rngSeed ?? idStory) + clock + 1_000_003` — the `1_000_003` salt (`SEED_SALT` in all three
implementations) keeps day N's random roll away from day N+1's weather roll (Step 27 uses
`rngSeed + clock` with no salt), so the two draws never collide or influence each other.
`rngSeed` is random per match at creation (a 63-bit value on Python/AWS, a `SecureRandom` long
on Java) unless the caller supplies one explicitly — Robot always passes `42` — so every match
draws its own sequence.

Java rolls with `new Random(seed).nextInt(Math.max(100, total))`; Python/AWS with
`random.Random(seed).randrange(max(100, total))`. The seed formula is shared, the generator is
not: the same seed can land on a *different* eligible row on Java than on Python/AWS, so
`rngSeed=42` is reproducible **per backend**, never across all three at once — the Robot suite
is written around that (§10).

**Known limitation, not fixed**: `java.util.Random` seeded with consecutive integers (one per
clock tick) does not roll uniformly — the low-order bits form a sawtooth, so the roll grows by
roughly 26 per day before wrapping. A row sitting at exactly 25% therefore tends to fire on a
predictable ~4-day cadence on Java instead of every fourth day at random, while Python/AWS's
Mersenne-Twister-backed `random.Random` does not show the pattern. A future fix could switch
Java to `SplittableRandom`, which is designed for exactly this kind of short-lived,
consecutive-seed use; not done in v0.39.0.

## 4. Party run — no actor, no location

Like a mission's completion event ([Step 37 §3](./Step37_MissionSystem.md#3-completion-events-and-firing-order),
[Step 38 §13](./Step38_ExperienceSystem.md#13-a-missions-reward-reaches-the-party)),
a random event runs with **no actor**. The Step 38 `missionRun` flag is generalised into
`partyRun` (Java `boolean partyRun` on `EventExecutionService`'s internal accumulator, set by
`isPartyTrigger(trigger)` = `TRIGGER_MISSION.equals(trigger) || TRIGGER_RANDOM_EVENT.equals(trigger)`;
Python `_Exec.mission_run` → `_Exec.party_run`; AWS `acc['missionRun']` → `acc['partyRun']`,
same on all three): `target = ALL` reaches **every** character of the match regardless of
state or location, `ONLY_ONE` names nobody, `target_class` still narrows. Every effect a normal
event may carry is allowed **except a weather change** — an effect with `idWeather` set on
`list_events_effects` is refused by the validator (§7), not filtered by the engine. An event
that owns choices cannot be picked at all: `RandomEventSelectionService.isRunnable` excludes it
from eligibility outright, so there is nothing to skip or log.

## 5. Log entry — trigger `RANDOM_EVENT`

A new automatic-event trigger constant, `RANDOM_EVENT` (uppercase, alongside `COUNTER_ZERO`,
`START_TIME`, `MISSION` — **not** `"random"`, lower-case, the way the original plan read it).
`EventExecutionService.automaticLogMessage` writes the `log_events` row as
`"random event <idEvent> (RANDOM_EVENT)"`; `MatchLogsService` on Java/Python classifies any row
whose message starts with that prefix as timeline type `RANDOM_EVENT`
(`LocationEntryStorePort.MSG_RANDOM_EVENT`), AWS's `_logbook` writes the type directly. One log
row per fired event, carrying the event's card, no location (§4 — it isn't tied to one). No row
when nothing fires. `v0.28.7-match-logs-api.yaml`'s `type` enum gains `RANDOM_EVENT`.

## 6. Sleep answer — rides the existing `counterZero[]`, not a new list

The original roadmap plan proposed a dedicated `automaticEvents[]` list on the sleep answer;
the shipped design reuses the **existing** `SleepActionResponse.counterZero[]`
([Step 33 §3](./Step33_LocationEntryEvents.md)) instead — there is no `automaticEvents[]` on
the sleep response. A fired random event is appended to `counterZero[]` with:

- `trigger: "RANDOM_EVENT"`
- `idLocation: null` — `TimeAdvancementPort.CounterZeroItem.idLocation` is now a nullable
  `Long` (was a primitive `long`), because a party-wide event has no single place
- `visibility: "FULL"` — always; unlike a counter-zero fuse tied to one location and gated by
  who has visited it, a random event is everyone's news
- `card` (the event's card) and `cardEffects[]` (one card per applied effect), the same shape
  every other `counterZero[]` entry already carries

## 7. react-game — weather first, then the effect card (not the event card, and not last)

`AutomaticEvents.jsx` — the component that already reads the whole `counterZero[]` list one
notice at a time — needed **no change**: it already renders `firstEffectCard(item) ?? item.card`,
i.e. the card of the **first** effect that has one, falling back to the event's own card only
when no effect carries one. The original plan described the *last* effect's card; the shipped
(and unchanged) behaviour has always been the first, inherited from Step 33.

What *is* new (`js/useGameplayResults.js`, the weather-change effect that watches
`[weather]`): when a sleep both changes the weather **and** produces a `counterZero[]` list
(any trigger — counter-zero, start-time, mission, or the new random event), the new-weather
card is shown **first**, and its forward arrow (`onForward`) chains into the wake-up list
instead of the two competing independently. A page that already owns the right side for a
better reason — a coma card, a pending choice — still keeps the weather away entirely, exactly
as before; this only orders two things that both wanted the page.

`MatchLogCard.jsx` gains `RANDOM_EVENT: 'fa-dice'` / `'#fbbf24'`; i18n
`matchLog.types.RANDOM_EVENT` = "Random event" (`en.json`) / "Evento casuale" (`it.json`).

## 8. Validation `R11_RANDOM_EVENT` + `warnings[]`

Import hard-fails, admin CRUD stays lenient, the `validate` endpoint reports — the usual three
tiers ([Step 22](./Step22_StoryValidation.md)). `StoryValidatorService.validateRandomEvents`
(Java), the Python and AWS equivalents:

- `probability` outside 0..100
- `idEvent` missing or `0`
- the referenced event owns choices
- the referenced event carries an effect with `idWeather` set (`list_events_effects`) — a
  random event may not change the weather
- `conditionKey` set with a blank `conditionValue`, or `conditionValue` set with a blank
  `conditionKey`

New on all three backends: a **`warnings[]`** array on the validation report, populated only by
`validateStory(storyId)` — the author's own "validate this story" pass, never import or
admin-create — so it can never turn `valid` false and is not counted alongside the hard errors.
Today it carries exactly one check: `R11_RANDOM_EVENT` warns when the sum of a story's random
-event probabilities exceeds 100 ("percentages will be scaled"), since that is legal (§2) but
worth flagging to the author. react-admin does not surface `warnings[]` yet.

## 9. Schema

New column, both Flyway migrations:

```sql
ALTER TABLE list_global_random_events ADD COLUMN registry_value_operator_condition TEXT DEFAULT '=';
```

`adapter-postgres/.../V0.39.0__random_event_operator.sql`,
`adapter-sqlite/.../V0.39.0__random_event_operator.sql` — `DEFAULT '='` keeps every
pre-existing row's behaviour unchanged. Python's `align_schema` (`database.py`, `_ADDED_COLUMNS`)
adds the same TEXT column; AWS carries it as a raw story-item attribute, no migration needed.
Import and admin CRUD carry it on all three backends.

**Java import bugfix**: `StoryImportService.importGlobalRandomEvents` never saved `idEvent` or
`idText` — every imported random-event row landed with both FKs `null`, so the engine (which
requires `idEvent`) could never fire an imported row regardless of the JSON's content. Fixed
alongside the new column; Python and AWS import already read `idEvent` correctly.

## 10. react-admin

`constants/story/storiesEntities.jsx`, entity `global-random-events` (nav label "Random
Events", `fa-dice`): form field `probability` is now `required`, `min: 0`, `max: 100`, label
"Probability (%)"; `idEvent` is `required`; new `registryValueOperatorCondition` select reusing
`CHOICE_CONDITION_OPERATOR_OPTIONS`. Table view gains an "Operator" column
(`registryValueOperatorCondition`). `components/common/story/EntityForm.jsx` gained a
**generic** min/max range check (any field carrying `min`/`max` is now validated on submit,
not just this entity) — `MatchLogsCard.jsx` gains `TYPE_META.RANDOM_EVENT` (icon `fa-dice`,
`#fbbf24`, matching react-game's palette).

## 11. Seeds and fixtures

The tutorial story (`stories/infinite_paths.json`) got its random events added by hand, not by
this change. The two SQLite dev demo stories, `story_demo_3.json` / `story_demo_4.json`, had
`globalRandomEvents` rows with **no `idEvent`** (dead weight even before the engine existed);
those rows are now removed rather than left to trip the R11 `idEvent`-missing rule on every
dev boot. The SQL seed stories 9001/9002 (`R__insert_dev_test_data.sql` on Java,
`seed_dev_data.py` on Python) still carry a `list_global_random_events` row with no `id_event`
— `validate` reports `R11_RANDOM_EVENT` on them and the engine simply never selects them
(`idEvent <= 0` fails `isRunnable`), which is accepted as-is rather than back-filled.

## 12. Robot (`code/tests/robot/tests/39_random_events/`)

Own story `story_random_events.json` (PRIVATE, category `robottest`) with four random rows
whose eligibility is switched through the admin registry so that **at most one row is ever
eligible at a time** — necessary because Java and Python/AWS can pick differently given the
same seed (§3), so the suite cannot assert "which of several eligible rows fired". Matches use
`rngSeed=42`. Shared `random_events_common.resource`.

- `random_events.robot` (6): the story validates with an `R11_RANDOM_EVENT` warning
  (probabilities sum to 300); nothing fires with no row eligible; a `probability=100` row
  always fires party-wide (`counterZero[]` entry, trigger `RANDOM_EVENT`, `FULL`, `idLocation`
  null, its effect applied); the fired event's `RANDOM_EVENT` timeline row; a `ONCE` event
  fires once across two days; the `>` condition operator.
- `random_events_admin.robot` (9): the `R11_RANDOM_EVENT` import refusals (probability out of
  range, missing `idEvent`, event with choices, event with a weather effect, condition key/value
  mismatches — six cases), the imported operator round-trips through admin CRUD, and a legacy
  payload without the new column still imports (operator defaults to `=`).

`14_admin/story_import.robot`'s existing import fixture (test 971014) now carries a random
event with an `idEvent`, closing the gap the Java bug (§9) would otherwise have hidden.

All four run environments (Java, Python, AWS, and the cross-backend dry run) came back green
except one case that needed a follow-up fix — a Robot **generator-expression scope bug inside
the new suite itself** (not an engine bug), since corrected.

## 13. Other UI changes in v0.39.0

Two small, unrelated frontend changes shipped alongside random events in this release:

### react-game — the end-game card

The board's action card for the story's `idEventEndGame` event (`EndGameCard.jsx`) now labels
itself "End Game" (`game.endGame` — "Termina Partita" in Italian) with a
`fa-flag-checkered` icon on the board's **little** card, instead of the generic "Info" label
every other action card shows; clicking it still opens the same full page with the end-game
confirmation action. Whenever this card is present, `PageRightMain` now **always** hides the
"Go to sleep?" card (`hasEndGame = actions.some(a => a.endGame)` short-circuits `showSleep`),
even when the party is energy-stuck or a sleep would otherwise be forced — the story is over,
there is nothing left to advance.

### react-admin — story editor sidebar + Cards Fast Edit

`StoryEditorPageSidebar.jsx`: the vertical tab rail is 60% narrower
(`md:w-64` → `md:w-[9.6rem]`) and gains a last entry, "Cards fast edit" (`fa-id-card`), below
the existing tabs, opening `/stories/{uuid}/cards-fast-edit`. `CardsFastEditPage.jsx` gains a
matching "Edit story" button (`fa-pen`) placed right after "Save All", navigating back to
`/stories/{uuid}/edit` — closing the loop between the two story-editing surfaces.

## 14. Files

- **Java core**: `RandomEventSelectionService` (new), `RandomEventStorePort` (new),
  `RandomEventStoreAdapter` (new, `core/persistence/match/`), `TimeAdvancementService`
  (random-event hook after the weather), `EventExecutionService` (`runRandomEvent`,
  `isPartyTrigger`, `automaticLogMessage`, `describeForRecipient`), `MatchLogsService`
  (`TYPE_RANDOM_EVENT`), `StoryValidatorService` (`validateRandomEvents`,
  `warnRandomEventTotal`), `StoryValidationReport` (`warnings[]`), `StoryImportService`
  (`importGlobalRandomEvents` fix), `StoryCrudService`, `CoreConfig` (DI wiring). New OpenAPI
  `v0.39.0-random-events-api.yaml`; patched `v0.22.0-story-validation-api.yaml` (`warnings[]`),
  `v0.25.0-time-clock-api.yaml` and `v0.33.0-location-entry-events-api.yaml`
  (`RANDOM_EVENT` trigger, nullable `idLocation`), `v0.28.7-match-logs-api.yaml`
  (`RANDOM_EVENT` log type). Migration `V0.39.0__random_event_operator.sql` (sqlite +
  postgres).
- **Python**: `random_event_selection_service.py`, `random_event_store_adapter.py` (new),
  `time_advancement_service.py`, `event_service.py`, `match_logs_service.py`,
  `story_validator_service.py` / `story_validator_port.py`, `models.py`, `database.py`
  (`align_schema`), `launcher.py` (DI wiring).
- **AWS**: `lambda/match/random_events.py` (new), `lambda/match/events.py`,
  `lambda/match/handler.py`, `lambda/story/story_validator.py`, `lambda/story/handler.py`.
- **react-game**: `PageRightMain.jsx`, `EndGameCard.jsx`, `js/useGameplayResults.js`,
  `features/matches/MatchLogCard.jsx`, `data/images.json`, `i18n/en.json` / `it.json`.
  `AutomaticEvents.jsx` unchanged (§7).
- **react-admin**: `constants/story/storiesEntities.jsx`,
  `components/common/story/EntityForm.jsx`,
  `components/match/detail/MatchLogsCard.jsx`, `pages/story/StoryEditorPageSidebar.jsx`,
  `pages/story/StoryEditorPage.jsx`, `pages/story/CardsFastEditPage.jsx`.
- **Robot**: `code/tests/robot/tests/39_random_events/` (`story_random_events.json`,
  `random_events_common.resource`, `random_events.robot`, `random_events_admin.robot`);
  `14_admin/story_import.robot`.

## Test coverage

- Java: new `RandomEventSelectionServiceTest` (18 cases: eligibility, ordering, the
  absolute-percentage pick including the `roll >= total` and `total > 100` scaling paths,
  `ONCE` exclusion), `RandomEventStoreAdapterTest` (6 cases); `EventExecutionServiceAutomaticTest`,
  `MatchLogsServiceTest`, `TimeAdvancementServiceTest`, `StoryValidatorServiceTest`,
  `StoryImportServiceTest`, `StoryCrudServiceFieldMappingTest` updated for the new behaviour.
- Python: new `test_random_event_selection_service.py` (18 cases),
  `test_random_event_store_adapter.py` (5 cases); `test_time_advancement_service.py`,
  `test_match_logs_service.py`, `test_story_validator_service.py`,
  `test_story_validation_report.py`, `test_database_align_schema.py`,
  `test_location_entry_events.py` updated.
- AWS: new `test_random_events.py` (10 cases); `test_events.py`, `test_story_handler.py`,
  `test_story_validator.py`, `test_match_handler_logs.py`, `test_time_advancement_handler.py`
  updated.
- react-game: new `test/PageRightMainEndGame.test.jsx`; `EndGameCard.test.jsx`,
  `GameBook.test.jsx`, `MatchLogCard.test.jsx`, `useGameplayResultsMissions.test.jsx` updated.
- react-admin: `EntityForm.test.jsx`, `MatchDetailCardsSparse.test.jsx`,
  `storiesEntities.test.js`, `CardsFastEditPage.test.jsx`, `StoryEditorPage.test.jsx`,
  `StoryEditorPageSidebar.test.jsx` updated.
- Robot: 15 new tests in `39_random_events/` (§12), plus one updated case in
  `14_admin/story_import.robot`.

## Scope of change

| Layer | Path |
|---|---|
| Migration | `adapter-{sqlite,postgres}/src/main/resources/db/migration/v0/V0.39.0__random_event_operator.sql` — adds `list_global_random_events.registry_value_operator_condition` |
| OpenAPI | `adapter-rest/src/main/resources/openapi/v0.39.0-random-events-api.yaml` (new); `v0.22.0-story-validation-api.yaml` (`warnings[]`); `v0.25.0-time-clock-api.yaml`/`v0.33.0-location-entry-events-api.yaml` (`RANDOM_EVENT` trigger, nullable `idLocation`); `v0.28.7-match-logs-api.yaml` (`RANDOM_EVENT` log type) |
| Java core | `RandomEventSelectionService`, `RandomEventStorePort`, `RandomEventStoreAdapter` (new); `TimeAdvancementService`, `EventExecutionService`, `MatchLogsService`, `StoryValidatorService`, `StoryValidationReport`, `StoryImportService`, `StoryCrudService`, `GlobalRandomEventEntity`; `ms-launcher/config/CoreConfig` |
| Java rest | `SleepActionResponse` (nullable `idLocation` on `CounterZeroItem`), `StoryValidationReportResponse` (`warnings[]`) |
| Python | `random_event_selection_service.py`, `random_event_store_adapter.py` (new); `time_advancement_service.py`, `event_service.py`, `match_logs_service.py`, `story_validator_service.py`, `story_validator_port.py`, `models.py`, `database.py`, `launcher.py` |
| AWS | `lambda/match/random_events.py` (new); `lambda/match/events.py`, `lambda/match/handler.py`, `lambda/story/story_validator.py`, `lambda/story/handler.py` |
| react-game | `PageRightMain.jsx`, `EndGameCard.jsx`, `js/useGameplayResults.js`, `features/matches/MatchLogCard.jsx`, `data/images.json`, `i18n/en.json`/`it.json` |
| react-admin | `constants/story/storiesEntities.jsx`, `components/common/story/EntityForm.jsx`, `components/match/detail/MatchLogsCard.jsx`, `pages/story/StoryEditorPageSidebar.jsx`, `pages/story/StoryEditorPage.jsx`, `pages/story/CardsFastEditPage.jsx` |
| Seeds | `story_demo_3.json`/`story_demo_4.json` (globalRandomEvents rows removed); seed stories 9001/9002 unchanged (still `idEvent`-less, by design, §11) |
| Robot | `code/tests/robot/tests/39_random_events/` — `story_random_events.json`, `random_events_common.resource`, `random_events.robot` (6), `random_events_admin.robot` (9); `14_admin/story_import.robot` |

## Out of scope / decisions recorded

Multiplayer broadcast of a fired random event (§65 stays as it is). An admin "force a random
event" endpoint — the deterministic seed is judged enough for testing/authoring. Decimal
probabilities. An `id_text` narrative override (the column is kept in the schema, read by
nothing). The engine does not itself refuse a weather-changing effect on a random event's
event — only the validator does (§8); an already-invalid story imported before v0.39.0 could
still carry one. Python's `force_time_end` admin action still returns an empty `counterZero`
(pre-existing drift, not touched here). The `java.util.Random` sawtooth (§3) is a known,
unfixed limitation.

---

# Version Control

- **Document Version**: 0.39.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.39.0 | Random events, implemented: at every time-start, after the weather, at most one `list_global_random_events` row fires — an absolute-percentage pick (§2) seeded by `rngSeed + clock + 1_000_003` (§3), running party-wide with no actor (§4) as trigger `RANDOM_EVENT` (§5), riding the existing `counterZero[]` on the sleep answer rather than a new list (§6). New validation rule `R11_RANDOM_EVENT` plus a `warnings[]` array on the validate-endpoint report (§8); new `registry_value_operator_condition` column (§9) and a Java import bugfix that had silently dropped `idEvent`/`idText` on every imported random event. New Robot suite `39_random_events/` (15 tests, §12). | September 23, 2026 |

- **Last Updated**: September 23, 2026 (v0.39.0)
- **Status**: Complete




# &lt; Paths Games /&gt;
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



