# Step 32 — Choice resolution (apply effects & outcomes)

[Step 31](./Step31_ChoiceEngine.md) opened the choice flow and stopped at its threshold:
executing a choice-owning event pays energy and coins, writes the `EVENT_EXECUTED` marker,
and answers `status: CHOICES_PENDING` with the options — but applies nothing. Step 32 closes
what that open left ajar: it takes the option the player picked, applies its
`list_choices_effects`, runs the events those effects point at, records the narrative
milestone, and writes the `CHOICE_SELECTED` marker Step 31 defined but never wrote.

**No new controller.** `POST /api/gameplay/{uuidMatch}/action/select-choice?lang=xx`, body
`{"choiceUuid": "..."}`, joins the existing `EventController` (Java) / `event_controller.py`
(Python) / the `match` lambda's route table (AWS) alongside `execute-event`.

---

## 1. It charges nothing

`energySpent` and `coinSpent` always come back `0`, and a `ONCE` event is **not**
re-consumed. Everything was paid when the event was *opened* in Step 31; resolving is what
that payment bought.

This is also why the gate on this endpoint is **not** the Step 29 `EventAvailabilityChecker`
— re-running it would reject the very event the player already paid for
(`ONCE_ALREADY_CONSUMED`, or `NOT_ENOUGH_ENERGY` once the deduction left them short).

## 2. The gate: an open cycle

A choice-event cycle is **open** while its `EVENT_EXECUTED` markers outnumber its
`CHOICE_SELECTED` markers — the same count comparison Step 31 uses to decide whether to
re-serve the options (`countLogMarkers`, paired by event). That single predicate is the
**cost-bypass guard**: it is `false` both for an event that was never opened (so its effects
cannot be had for free) and for one already resolved (so they cannot be had twice). A
rejected resolution writes nothing.

The option's own availability is **re-evaluated at resolution time**, not trusted from the
open — `ChoiceAvailabilityChecker`, unchanged from Step 31. The world may have moved since
the options were served: an item spent, a stat drained, a key flipped by another action.

## 3. Guard order and HTTP codes

1. Match `RUNNING` and the caller owns a character in it — 404 `MATCH_NOT_FOUND` (masks both
   cases deliberately, as elsewhere).
2. The choice exists — 404 `CHOICE_NOT_FOUND` (**new**).
3. Its owning event exists — 404 `EVENT_NOT_FOUND`.
4. The character is not comatose — 409 `COMA`.
5. The character is not sleeping — 409 `SLEEPING`. Coma outranks sleep everywhere in this
   engine, and this endpoint is no exception.
6. The cycle is open (§2) — 409 `CHOICE_NOT_OPEN` (**new**).
7. The option is still available (§2, per-option) — 409 `CHOICE_NOT_AVAILABLE` (**new**; the
   message carries the `ChoiceAvailabilityChecker` reason).

**No turn check.** Consistent with Steps 24, 28 and 29, which never touch
`gaming_turn_queue` in single-player, `select-choice` doesn't either — requiring a turn here
and not on the `execute-event` that opened the choice would let a player open a choice-event
and then be unable to resolve it. `turnConsumed` stays `false`; turn semantics for every
action arrive together in Step 61. (The original roadmap sketch said "has turn" — this
deviation is deliberate.)

## 4. What a resolved option does

`list_choices_effects` rows apply in **authored (id) order**. Each row is one of:

| Column(s) | Effect |
|---|---|
| `statistics` + `value` | Moves a statistic on the recipient(s). |
| `key` + `value_to_add` | Sets a registry key. |
| `key` + `value_to_remove` | Clears a registry key — **only** when the stored value still matches, so an option cannot wipe a key the story has since moved on. |
| `id_item_target` + `item_action` (ADD/REMOVE) | Adds or removes an item. |
| `id_location` | Forced movement of the recipients — no adjacency check, no energy cost, no availability check; each actual move writes a cost-0 `log_movements` row. |
| `id_weather` | SETS the match weather — once per row, no matter how many characters it targets (weather is a property of the match, not of a character). |
| `id_event` | Runs that event inline, with its whole `id_event_next` chain. |

Each applied row contributes one `AppliedEffect` carrying **the row's own card** — the
narrative the board renders for that row.

### Recipients — `flag_group` (INV-46)

`flag_group = 1` targets **every character standing in the actor's location** — the same set
an event effect's `target = ALL` resolves ([INV-27](./Step09_DesignCoreDataModel.md)), never
every character of the match. Any other value targets the acting character alone.

### Ordering rule — a lethal row does not silence its siblings

All the effect rows land first, in authored order, so a later row can build on what an
earlier one wrote. **Only then** does the Step 30 edge pass run once over everyone the rows
touched. This mirrors event-effect handling exactly: a lethal row does not silence its
siblings, any more than a lethal effect silences the other effects of its own event.

Only after the edge pass do the **consequences** run: the events an effect row's `id_event`
names, then the option's own `id_event_torun`. A coma stops those — a character who can no
longer act does not act out what follows. A linked event is a consequence, never re-checked
and never charged, exactly like a link in an `id_event_next` chain.

### A choice that leads to another choice

When `id_event_torun`, or an effect row's `id_event`, is itself a choice-owning event, the
resolution **presents its options** instead of dropping them silently: the response comes
back with `status: CHOICES_PENDING`, `pendingChoices`, and a fresh `EVENT_EXECUTED` marker
for that event — served free, the open having already been paid for by the choice that led
there. The board renders it exactly as it renders a first open, so a story can chain a
choice onto a choice.

## 5. What it records

Three rows, all written **after** the effects and their consequences, so a failure midway
leaves no marker claiming otherwise:

- **`log_events`** row `CHOICE_SELECTED <idEvent>` — `id_event` carries the **owning event**
  id, never the choice id: `countLogMarkers` pairs the two markers by event, and a row
  stamped with the choice id would leave the cycle open forever. This honours the contract
  Step 31 wrote down for `MSG_CHOICE_SELECTED`'s first writer.
- **`log_choices_executed`** (event, choice, clock) — the narrative record the match-log
  APIs read, as opposed to the marker above, which is engine bookkeeping.
- **`gaming_story_progress`** — **only** when the option carries `is_progress = 1`. Ordinary
  options resolve without touching this table, which is what keeps it a story outline rather
  than a second copy of the choice history.

## 6. Response — `SelectChoiceResponse`

**Extends** `ExecuteEventResponse` (Step 29) — every field, plus:

| Field | Meaning |
|---|---|
| `choiceUuid` | The option that was resolved. |
| `narrative` | The option's `id_text_narrative`, resolved in the requested `lang`. Step 31 deliberately withheld this — returning it with the pending options would have leaked the consequence of a choice not yet made — revealed now that the choice is irreversible. |
| `choiceCard` | The option's own card (`id_card`). |
| `choiceEventUuid` / `choiceEventCard` | The event an effect row's `id_event` ran inline, if any; its card is what the board narrates with — the event has already happened, so it narrates rather than offers. |
| `progressRecorded` | `true` when the option carried `is_progress = 1` and a `gaming_story_progress` row was written. |

`energySpent`/`coinSpent` are always `0`. `eventUuid` keeps its Step 29 meaning — here, the
event that owned the resolved option. `status` is `APPLIED`, or `CHOICES_PENDING` when a
linked event turned out to be another choice-event (§4).

**v0.35.6 — `edgeState` parity on AWS.** `SelectChoiceResponse` extends `ExecuteEventResponse`
(Step 30 §3), so `comaEventUuid`/`comaEventCard`/`comaExecutedEventUuids`/`comaEffects` were
already part of the contract, but AWS's `_resolve_choice` answered them hardcoded null/empty —
only `execute-event` ran the party-collapse epilogue on that backend. `_resolve_choice` now
calls the same `_resolve_epilogue` helper Java/Python always did. Two more AWS-only gaps closed
alongside it: a lethal choice effect that forces a move is itself an arrival, so
`_resolve_choice` now drains those arrivals and resolves the epilogue on their automatic events
too (Step 33); a per-request latch keeps the epilogue answered exactly once even when several
fold points (the choice itself, a forced move, a chained automatic event) could each trigger it.
No schema change, no new endpoint.

## 7. Database — `V0.32.0__choice_effect_targets.sql`

`ALTER TABLE list_choices_effects ADD COLUMN` × 5: `id_event`, `id_location`, `id_weather`,
`id_item_target`, `item_action` — named and typed exactly like their `list_events_effects`
twins (v0.29.0/v0.29.3), so the engine applies both tables through the same helpers. **No
FKs** — same reasoning as the v0.29.3 event-effect columns: the references are story-scoped,
the Step 22 validator owns the existence check, and a value matching no row of the story is
authored noise the engine skips rather than a reason to fail the whole resolution. Applied
to both SQLite and PostgreSQL.

`log_choices_executed` (V0.10.9) and `gaming_story_progress` (V0.10.7) need **no migration**
— they have existed all along and Step 32 is simply their first writer. Java gained the two
entities and repositories it never had (`LogChoicesExecutedEntity`, `GamingStoryProgressEntity`
+ their `*EntityId`), wired into the match-delete cleanup (SQLite does not enforce the
schema's `ON DELETE CASCADE`).

See [Step09_DesignCoreDataModel.md](./Step09_DesignCoreDataModel.md) for the updated
`ChoiceEffect` row and the new `INV-46`.

## 8. Validation — Step 22 `R1` extension

Referential integrity (`R1`) is extended to the four new choice-effect columns: `idEvent` →
EVENT, `idLocation` → LOCATION, `idItemTarget` → ITEM (plus `idWeather` → WEATHER on Java
only — the Python and AWS validators have no weather target, matching how they already treat
event effects). Runs on **both** the import path and the entity-local CRUD path, on all three
backends.

## 9. Python schema fix

`ChoiceEffectEntity` was **broken**: it declared `id_choice` / `effect_type` / `effect_value`,
none of which matched the canonical column set, so no Java-authored choice effect survived a
story import through the Python backend. Realigned onto
`uuid`/`statistics`/`value`/`key`/`value_to_add`/`value_to_remove` plus the five new v0.32.0
columns — the same class of fix Step 29 applied to `EventEffectEntity` and Step 31 to
`list_choices`.

## 10. Frontend

Picking an option calls `selectChoice`, then reloads the board — which puts the **left**
page back on the current location (the `id_location` case needs no extra code, since the
board always re-reads `/info`). The **right** page then shows `choiceEventCard` when an
effect ran an event, else the last effect card, with the stat badges. A same-transaction
weather change attaches a **forward arrow** to that card rather than covering it (event
first, then weather). `CHOICES_PENDING` re-arms the options list — `PendingChoicesList`
renders again exactly as on a first open. Every option locks while a call is in flight.
Registry/item/stat changes ride on the payload but get no dedicated UI this step — Steps
34/36 own that.

---

## 11. Files

| Layer | Path |
|---|---|
| Migration | `adapter-{sqlite,postgres}/src/main/resources/db/migration/v0/V0.32.0__choice_effect_targets.sql` |
| Engine (Java) | `core/service/match/EventExecutionService.java` — `selectChoice` + the choice-effect helpers; `applyStat`/`applyItem`/`applyMove` generalised so both effect tables share them |
| Entities (Java) | `core/entity/story/ChoiceEffectEntity.java` (5 new fields); `core/entity/match/LogChoicesExecutedEntity.java`, `GamingStoryProgressEntity.java` + their `*EntityId` (new) |
| Repositories (Java) | `core/repository/match/LogChoicesExecutedRepository.java`, `GamingStoryProgressRepository.java` (new) |
| Ports (Java) | `core/port/match/EventExecutionPort.java` (`selectChoice`, `ChoiceResolutionResult`, 3 new codes), `EventExecutionStorePort.java` (4 new methods) |
| Persistence (Java) | `core/persistence/match/EventExecutionStoreAdapter.java`, `MatchPersistenceAdapter.java` (delete cleanup) |
| REST (Java) | `adapter-rest/controller/match/EventController.java`, `dto/SelectChoiceRequest.java`, `dto/SelectChoiceResponse.java` (new) |
| Authoring (Java) | `core/service/story/StoryCrudService.java`, `StoryValidatorService.java` |
| OpenAPI | `adapter-rest/src/main/resources/openapi/v0.32.0-choice-resolution-api.yaml` (new) |
| Engine (Python) | `app/core/services/match/event_service.py` (`select_choice`), `models/match/event_models.py`, `ports/match/event_ports.py`, `adapters/persistence/match/event_store_adapter.py`, `adapters/rest/match/event_controller.py` |
| Schema fix (Python) | `app/adapters/persistence/story/models.py`, `story_persistence_adapter.py`, `adapters/persistence/match/models.py` (2 new entities) |
| Engine (AWS) | `lambda/match/choices.py` (`choice_by_uuid`, `effects_for_choice`, `choice_recipients`), `lambda/match/handler.py` (`_select_choice`, `_resolve_choice`, `_run_linked_event`, `_run_event_chain`; **v0.35.6** — `_resolve_epilogue` call, arrival draining, per-request latch) |
| Validators | Java `StoryValidatorService`, Python `story_validator_service.py`, AWS `lambda/story/story_validator.py` |
| Seed | Java `adapter-sqlite` dev seed (`R__insert_story_seed_data.sql`), Python `seed_dev_data.py`, AWS `lambda/seed/handler.py` — event 90032 (cost 3) with three options + outcome event 90033 (cost 9, never charged) |
| Game board | `react-game/src/api/matches.js` (`selectChoice`), `features/gameplay/GameBook.jsx`, `cards/ChoiceCard.jsx`, `cards/PendingChoicesList.jsx`, `i18n/{en,it}.json` |
| Robot | `code/tests/robot/tests/32_choice_resolution/choice_resolution.robot` (new, 11 cases); `resources/matches.resource` (`Select Choice`); **v0.35.6** adds `30_edge_states/choice_coma_epilogue.robot` |
| Tests | Java: `EventExecutionServiceSelectChoiceTest` (36), `ChoiceResolutionEntitiesTest`, `SelectChoiceResponseTest`, plus additions to `EventControllerTest`, `EventExecutionStoreAdapterReadWriteTest`, `StoryValidatorServiceTest`, `StoryCrudServiceCompleteTest`, `MatchPersistenceAdapterTest`. Python: `test_event_service_select_choice.py` (35) + additions to `test_event_controller.py`, `test_event_store_adapter.py`, `test_story_persistence_adapter.py`, `test_story_validator_service.py`. AWS: `test_match_handler_select_choice.py` (29) + `test_choices.py`, `test_story_validator.py`. Frontend: `ChoiceCard.test.jsx`, `GameBookCoverage.test.jsx`. |

Python and AWS mirror the Java engine and validator described above; see
[Roadmap.md](./Roadmap.md) (step 32) for the originating spec.

### Test results

Java 2033 tests pass (`EventExecutionService` 98.3% line coverage, every other new/changed
class 97.5–100%). Python 1098 pass. AWS 667 pass. react-game 655 pass, react-admin 489 pass.
The Robot suite dry-runs clean (11 cases); it has **not** been executed against a live server.

---

# Version Control

- **Document Version**: 0.35.6

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.32.0 | Choice resolution: select-choice applies list_choices_effects (stats, registry, items, forced movement, weather, inline events), runs id_event_torun, reveals the withheld narrative, records log_choices_executed + gaming_story_progress, writes CHOICE_SELECTED; charges nothing (the open paid); open-cycle cost-bypass guard; V0.32.0 choice-effect targets; react-game resolution flow | July 23, 2026 |
  | 0.35.6 | AWS bugfix: select-choice now resolves the party-collapse epilogue (`_resolve_epilogue`) like Java/Python always did, drains arrivals a forced move produces, and answers the epilogue once per request via a new latch. No schema change. | August 28, 2026 |

- **Last Updated**: August 28, 2026
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
