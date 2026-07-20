# Step 30 — Edge states (sadness overflow, coma)

Until this step, `sad` and `life` were numbers that events could push around, but nothing in
the engine reacted when they hit their limits: `sad` could sit at `sad_max` forever, and `life`
could reach `0` without the character actually stopping. Step 30 adds the two rules that make
those limits mean something, plus a party-wide epilogue for when every character is down.

**No new endpoint.** The rules run inside the two places that already change stats, and their
outcome is folded into an existing response.

The deliberate boundary: Step 30 raises the flags and runs the epilogue narrative. It does
**not** implement rescue, and it does **not** move `gaming_match.status` to `GAMEOVER` — both are
deferred to **step 59** of the roadmap. `gameOver` stays a boolean flag driven only by
`list_stories.id_event_end_game`, exactly as before this step.

---

## 1. Scope

Two engine rules, evaluated together because the first can cause the second:

1. **Sadness overflow** — `sad >= sad_max` costs the character its COS (constitution) in life
   points (floored at `0`), resets `sad` to `0`, and raises `is_sleeping`. Sadness therefore
   never rests at its cap: reaching it always discharges immediately, it never just sits there.
2. **Coma** — `life <= 0` raises `is_coma` and `is_sleeping`, and stamps `clock_in_coma` with the
   match's current clock. A character already in coma is not re-triggered, so the stamp keeps
   meaning "when they went down" rather than "when they were last hurt."

Because rule 1 subtracts life, the coma rule reads the life **after** that subtraction: one
event (or one recovery pass) can push a character over the sadness cap and into a coma in a
single pass. That is the reason both rules live in one evaluator instead of two independent
checks scattered across call sites.

A guard disables rule 1 when `sad_max <= 0`: `clamp(value, 0, max)` returns `min` when
`max < min`, so an unauthored `sad_max` (default `0`) would otherwise leave `sad == 0`, make
`0 >= 0` true, and drain COS life on **every single event** a character takes part in. The guard
is load-bearing, not defensive decoration.

### Where the rules run, and where they deliberately do not

| Call site | Runs the rules? | Why |
|---|---|---|
| `EventExecutionService` (Step 29 event execution) | Yes, over every character the executed event touched | The obvious trigger: an effect drops life or raises sad. |
| `TimeStartRecoveryService` (Step 26 time-start recovery) | Yes | Recovery is not only healing: an unsafe location restores no life, and a positive class `sad` bonus can push a character over the cap during what is nominally a rest. |
| `POST /api/admin/matches/{uuidMatch}/player/{uuidPlayer}/changeStatistics` | **No** | Deliberate, not an omission. This is a god-mode admin tool whose whole purpose is to force a state — an admin who sets `sad` to its cap means it, and should not have that overridden on write. Nothing is lost: a forced state self-corrects at the next event or time-start, since both sweep every character. |

### All players in coma

When every character of the match is comatose, the engine resolves and runs
`list_stories.id_event_all_player_coma` — the party epilogue — through the normal event chain
runner (Step 29 §3). It is resolved **at most once per execution**, and if the epilogue event is
itself `ONCE`, it fires **at most once per match**. A story that authors no epilogue is legal:
the collapse is still logged, there is just no narrative to show for it.

Six silent early exits, none of them errors:

1. the epilogue was already resolved earlier in this same execution;
2. the party is not (yet) fully down;
3. the roster is empty (`allInComa` treats an empty roster as **not** all-in-coma — otherwise a
   match with zero living characters would spuriously "collapse");
4. the story authors no `id_event_all_player_coma`;
5. the authored id is dangling (points at no event of the story);
6. the epilogue is `ONCE` and was already spent.

**Sequencing note.** The epilogue cannot live inside the chain runner: `runChain` unwinds as
soon as the acting character falls into a coma, and the actor is necessarily one of the
comatose — a comatose character is rejected by the availability check before an execution even
starts (Step 29 §2). So by the time everyone is down, the chain that triggered it has already
returned. The epilogue therefore runs in `executeEvent`, right after `runChain` returns, and
**before** the time-end branch — `forceTimeEnd` flushes stats to disk and latches a `flushed`
guard, and running the epilogue after that point would freeze its stat changes out of the
database.

---

## 2. Endpoint APIs

No new endpoint. The two call sites are existing ones, unchanged in shape:

- `POST /api/gameplay/{uuidMatch}/action/execute-event?lang=` (Step 29)
- the internal time-start recovery path invoked by `POST /api/gameplay/{uuidMatch}/action/sleep` (Step 25/26)

Both now return an additional `edgeState` object; see §3.

The character projection gained one field, `clockInComa`, on every endpoint that returns a
character (`GET /api/match/{uuidMatch}/characters/{uuidCharacter}`, `POST /api/matches/{uuid}/join`
and the `players[]` of match-info). Without it the headline of this step — the stamp of *when*
a character went under — is written to the database and never observable, which also made it
untestable end-to-end. Step 59's rescue will need it to answer "how long have they been down".

OpenAPI: `code/backend/java/adapter-rest/src/main/resources/openapi/v0.30.0-edge-states-api.yaml`
— a schema-only spec (`paths: {}`) that documents `EdgeStateOutcome` and cross-references the
Step 29 event API, so the rules read on their own without duplicating the endpoint definition.

---

## 3. DTOs and Domain Models

### `ExecuteEventResponse.edgeState` (new)

Added to the Step 29 `ExecuteEventResponse`. Never null — a quiet execution returns empty lists
and `allPlayersInComa: false`:

| Field | Type | Meaning |
|---|---|---|
| `sadnessOverflowUuids` | `string[]` | Characters whose sadness reached its cap during this execution. |
| `comaUuids` | `string[]` | Characters who **newly** entered a coma. A character already comatose before this execution is absent here, even if this event hurt them further. |
| `allPlayersInComa` | `boolean` | True when every character of the match is comatose after this execution. Does not by itself end the match. |
| `comaEventUuid` | `string`, nullable | The story's `id_event_all_player_coma` that was run. Null when the story authors none, the id is dangling, or a `ONCE` epilogue was already spent. |
| `comaEventCard` | `CardInfo`, nullable | The epilogue event's own card. |
| `comaExecutedEventUuids` | `string[]` | The epilogue chain in execution order. |
| `comaEffects` | `AppliedEffect[]` | The epilogue's applied effects, each carrying its own card. |

**Kept deliberately separate from the top-level fields.** The epilogue's own
`comaExecutedEventUuids` / `comaEffects` are never merged into the response's top-level
`executedEventUuids` / `effects` — that separation is what lets the board tell "the narrative
the player triggered" apart from "the engine's answer to their collapse." `statChanges`, by
contrast, stays unified: a stat is a stat regardless of which chain moved it.

### `EdgeStateEvaluator` (Java: `core/service/match/EdgeStateEvaluator.java`)

A pure function, no ports, no I/O — the same shape as `EventAvailabilityChecker` (Step 29 §2).

```
CharacterState { idCharacter, life, sadUnclamped, sadMax, constitution, alreadyComa }
    → Verdict { idCharacter, sadnessOverflow, comaTriggered, forcedSleep, lifeAfter, sadAfter }
```

`sadUnclamped` is the raw pre-clamp sum: for a well-authored character it agrees with the
clamped value (clamping a number at or above the cap yields the cap), but it is carried
separately so the rule reads what the effect actually did, not what storage could represent.

`alreadyComa` suppresses only the coma **trigger** — the log row and the `clock_in_coma` stamp —
never the arithmetic: a comatose character caught by a `target=ALL` sadness effect still takes
the life hit.

### Audit rows (`log_events`)

Three new message prefixes, all constants on `EdgeStateStorePort`:

| Prefix | Written when | `id_character_match` |
|---|---|---|
| `SADNESS_OVERFLOW` | a character's sadness reached its cap | the character |
| `COMA` | a character's life reached zero | the character |
| `ALL_PLAYER_COMA` | every character of the match is comatose | the actor's row from event execution; **null** when written from the recovery path |

Two constraints worth stating plainly:

- **None of the three may start with `EVENT_EXECUTED`** — that literal prefix is what the
  engine scans to decide a `ONCE` event is spent (Step 29 §2). An edge-state row that
  accidentally carried it would silently consume a `ONCE` event the player never triggered.
- **`ALL_PLAYER_COMA` *contains* `COMA`** as a substring. Any code that classifies these rows
  must match with `startsWith`, never `contains` — this bit both the Java `MatchLogsService`
  branch and the AWS equivalent, so it is called out explicitly at both message-constant
  declarations.

The party row (`ALL_PLAYER_COMA`) carries a null `id_event` always, and a null
`id_character_match` specifically when it is written by the time-start recovery path (there is
no single "actor" during recovery — every character in the match is swept).

---

## 4. Roles and Authentication

No change from Step 29 / Step 26. `execute-event` and `sleep` are both authenticated player
endpoints, scoped to the caller's own match and character exactly as before; the edge-state
rules ride along inside those existing authorization boundaries. The admin `changeStatistics`
endpoint keeps its own admin-port (8044) authorization and is, as noted in §1, the one call site
that does not invoke the evaluator at all.

---

## 5. Database Tables

**No migration in this step.** Every column the rules read or write already existed before
Step 30:

- `gaming_character_instance`: `sad`, `sad_max`, `life`, `is_coma`, `is_sleeping`, `clock_in_coma`
- `list_stories`: `id_event_all_player_coma`
- `list_stories_difficulty`: `cost_help_coma` — present but **unused until step 59** (the rescue
  mechanic it prices does not exist yet)

See [Step09_DesignCoreDataModel.md](./Step09_DesignCoreDataModel.md) for where these columns sit
in the entity model; none of their definitions changed.

---

## 6. Files

| Layer | Path |
|---|---|
| Evaluator | `core/service/match/EdgeStateEvaluator.java` |
| Port | `core/port/match/EdgeStateStorePort.java` |
| Persistence | `core/persistence/match/EdgeStateStoreAdapter.java` |
| Event execution | `core/service/match/EventExecutionService.java` — evaluates after each effect row, runs `resolveAllPlayerComa` after `runChain` and before `forceTimeEnd` |
| Event execution port | `core/port/match/EventExecutionPort.java` (new `EdgeStateOutcome` record) |
| Event execution store port | `core/port/match/EventExecutionStorePort.java` — `setCharacterComa` **deleted** (not deprecated) so the old clock-less write cannot survive anywhere; new `findIdEventAllPlayerComa` |
| Event execution store adapter | `core/persistence/match/EventExecutionStoreAdapter.java` |
| Time-start recovery | `core/service/match/TimeStartRecoveryService.java` — `StatTriple` gains `sadUnclamped` |
| Recovery port | `core/port/match/RecoveryStorePort.java` — `RecoveryCharacter` gains `isComa`, `RecoveryMatchContext` gains `currentClock` |
| Recovery adapter | `core/persistence/match/RecoveryStoreAdapter.java` |
| REST DTO | `adapter-rest/.../dto/ExecuteEventResponse.java` — new `EdgeStateOutcomeDto` |
| DI wiring | `ms-launcher/.../CoreConfig.java` |
| OpenAPI | `adapter-rest/src/main/resources/openapi/v0.30.0-edge-states-api.yaml` |
| Python mirror | `app/core/services/match/edge_state_evaluator.py`, `app/core/ports/match/edge_state_ports.py`, `app/adapters/persistence/match/edge_state_store_adapter.py`; modified `event_service.py`, `event_models.py`, `event_ports.py`, `event_store_adapter.py`, `time_start_recovery_service.py`, `time_ports.py`, `time_store_adapter.py`, `time_advancement_service.py`, `event_controller.py`, `launcher.py` |
| AWS mirror | `lambda/match/events.py` — `evaluate_edge_state`, `all_in_coma`, `MSG_SADNESS_OVERFLOW`/`MSG_COMA`/`MSG_ALL_PLAYER_COMA`; `lambda/match/handler.py` — `_log_edge_state`, `_resolve_all_player_coma`. No new SAM route. The AWS engine evaluates the already-**clamped** `sad` straight off the character dict rather than carrying a shadow pre-clamp field like the Java/Python `sadUnclamped` — those dicts are exactly what gets written to DynamoDB, and a shadow key would end up persisted as a real column. The verdict is identical either way. |
| react-game | new `features/gameplay/cards/SadnessCard.jsx`, `ComaCard.jsx`; new `sad`/`coma` entries in `data/images.json` (icon-only, Font Awesome 5, no photo credit invented); `buildCardSad`/`buildCardComa` in `utils/loadoutCards.js`; `GameBook.jsx` consumes `edgeState` in `handleEventExecuted`, adds `sad`/`coma` right-page card kinds; `matchInfoAdapter.js` projects `constitution`, `isComa`, `isSleeping`; new `game.sad.*`, `game.coma.*`, `game.allComa.*` keys in `i18n/en.json`, `i18n/it.json`. `ComaCard` prefers the story's own epilogue card when the party is down, filling in only the halves the author left blank. |
| Robot | `code/tests/robot/tests/30_edge_states/edge_states.robot` (6 tests) |

---

## Test coverage

All green as of this step, except Robot (see below).

- **Java**: `mvn test` green. New `EdgeStateEvaluatorTest` (16 tests), `EventExecutionServiceEdgeStatesTest` (10), `EdgeStateStoreAdapterTest` (5), `EdgeStateOutcomeDtoTest` (6). JaCoCo: `EdgeStateEvaluator`, `EdgeStateStoreAdapter` and `EdgeStateOutcomeDto` all at **100% lines and 100% branches**.
- **Python**: 901 tests green, including new `tests/test_edge_state_evaluator.py` (18) and `tests/test_event_service_edge_states.py` (11).
- **AWS**: 519 tests green, including new `tests/test_match_handler_edge_states.py` (9).
- **react-game**: 567 tests green, including new `src/test/EdgeStateCards.test.jsx` (11). `vite build` succeeds.
- **Robot**: new suite `code/tests/robot/tests/30_edge_states/edge_states.robot` (6 tests) —
  `A Quiet Event Answers With An Empty Edge State`,
  `Sadness At Its Cap Discharges And Costs COS Life`,
  `Life At Zero Opens A Coma And Stamps The Clock`,
  `Everyone Down Runs The Story Epilogue And Keeps It Separate`,
  `The Match Stays RUNNING After A Party Collapse`,
  `The Admin Endpoint Is Deliberately Not Subject To The Rules`.
  **Executed and green on LOCAL_JAVA, LOCAL_JAVA_POSTGRES and LOCAL_PYTHON** (464 tests each,
  0 failures). Against the deployed AWS environment it is still red, but only because that
  environment runs an older build: `run_robot_with_aws_serverless.sh` tests whatever is
  currently deployed and does not deploy first, so the suite goes green there only after a
  redeploy.

  The suite pins the *no-epilogue* branch of the party collapse, not the authored one: the
  seeded story sets no `id_event_all_player_coma`, which is legal. The authored-epilogue path
  is covered by the unit tests of all three backends, which can seed a story that has one.

---

## Bug fixed on the way in

Step 29's coma write raised `is_coma`/`is_sleeping` but never touched `clock_in_coma` — the
column existed but nothing set it. That gap is closed here: the coma rule now always stamps
`clock_in_coma` with the match's current clock. `EventExecutionStorePort.setCharacterComa`, the
old clock-less write, was **deleted rather than deprecated**, so it cannot be called from
anywhere by accident.

Two more surfaced while getting the Robot suite green, both parity defects in the AWS
backend against the Java reference:

1. `forcedSleep` was computed as `time_ended or comaTriggered`, so a **sadness overflow that
   forces sleep without a coma was reported as `false`**. It now has a flag of its own — the
   condition cannot be derived from `comaTriggered`.
2. The character projections did not expose `clockInComa`, so the stamp was unobservable over
   the API on that backend.

Both are now covered by unit tests, so they cannot regress silently.

Separately, stale references to a non-existent "Step 38" (an old working number for this
feature) were corrected to "step 59" — the roadmap number that now carries rescue and the
`GAMEOVER` transition — across the Java, Python, AWS, OpenAPI and Robot sources, and in
[Step29_NormalEvents.md](./Step29_NormalEvents.md) §3.

---

# Version Control

- **Document Version**: 0.30.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.30.0 | Edge states: sadness overflow and coma rules (`EdgeStateEvaluator`), `clock_in_coma` stamping, all-players-in-coma story epilogue, `edgeState` on `ExecuteEventResponse`. No new endpoint, no migration. | July 20, 2026 |

- **Last Updated**: July 20, 2026
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
