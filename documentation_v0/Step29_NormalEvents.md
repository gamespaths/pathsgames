# Step 29 — Normal events (player-triggered actions)


Until this step, events were **read-only data**: `GET /api/match/{uuid}/info` listed them under
`locationsActive[].events[]` with their card, but there was no way to *run* one. The only
executable event was the end-game one (`PATCH /api/match/{uuid}/end/{uuidEvent}`), and it only
accepted the story's `idEventEndGame`.

Step 29 closes the loop:

1. a single **check procedure** decides whether an event is possible;
2. `POST /api/gameplay/{uuid_match}/action/execute-event` runs it and applies its effects;
3. `/info` publishes an **`available`** flag (and, when false, a `reason`) per event, so the
   board can render a locked action *and say why*.

The flag and the endpoint call **the same function**. A board that offers an action can never be
told "no" by the endpoint, and a blocked action already knows its cause.

---

## 1. Schema (V0.29.0)

`list_events` became the **condition** side of an event; `list_events_effects` became the
**effect** side. Nothing an event *does* lives on `list_events` any more.

### `list_events` — conditions, costs and the chain

| Column | Role |
|---|---|
| `id_specific_location` | CONDITION — the character must stand here. **NULL = no location constraint.** |
| `type` | `AUTOMATIC`, `FIRST`, `NORMAL` or **`ONCE`** (new). Only NORMAL and ONCE are player-executable. |
| `cost_enery` *(sic)* | Energy the player pays. The typo is baked into DDL, JSON, entity and admin form. |
| `cost_coin` | Coins the player pays. **Renamed from `coin_cost` in v0.35.3** — JSON key follows (`coinCost` → `costCoin`), but import/admin CRUD keep accepting the old `coinCost` key so a pre-v0.35.3 story export does not silently become free. |
| `cost_food` / `cost_magic` | **New in v0.35.3** — food/magic the player pays, same reading as `cost_coin`. See §2 for the check order and §3 for payment. |
| `flag_end_time` | Executing it forces a time end. |
| `id_event_next` | The chained event. |
| `id_weather` | **CONDITION** — available only under that weather. |
| `registry_key_condition` / `registry_value_condition` | **NEW** — the key must currently hold that value. |
| `id_item_condition` | **NEW** — the character must carry that item. |
| `id_class_condition` | **NEW** — the character must have that class. |
| ~~`characteristic_to_add` / `characteristic_to_remove` / `key_to_add` / `key_value_to_add`~~ | **DROPPED** — moved to `list_events_effects`. |
| `id_item_to_add` | **DEPRECATED** — kept only because it sits in a FK clause; the engine ignores it. Grant items through effects. |

### `list_events_effects` — everything the event does

Existing: `id_event`, `statistics`, `value`, `target`, `traits_to_add`, `traits_to_remove`,
`target_class`, `id_item_target`, `item_action`.

New in v0.29.0: `id_weather`, `key_to_add`, `key_value_to_add`, `characteristic_to_add`,
`characteristic_to_remove`.

New in v0.29.3: `id_location` (nullable, `V0.29.3__event_effect_move_location.sql`). When an
executed effect row carries it, every recipient of that row (the usual `target`/`target_class`
scope, INV-27) is **MOVED** to that location — see §3 "Forced movement" below.

> ⚠️ **`id_weather` means the OPPOSITE thing on the two tables.** On `list_events` it is a
> *condition* (the event is only available under that weather). On `list_events_effects` it is an
> *effect* (it **sets** the match weather). Same name, one table apart. The admin form labels them
> "Weather (condition)" and "Weather to Set (effect)" for exactly this reason.

### `gaming_character_instance`

Two effect targets that previously had nowhere to be written:

- `exp INTEGER NOT NULL DEFAULT 0` — written here in Step 29, spent in Step 37.
- `characteristics TEXT` — CSV, using the existing `MatchTraitCodec` (mirrors `gaming_match.trait_uuids`).

### Data migration

`V0.29.0__events_conditions_and_effects.sql` (identical in `adapter-sqlite` and
`adapter-postgres`) does **add → copy → drop**: it creates the new columns, copies every authored
value of the four moved columns into a *new* `list_events_effects` row, then drops them. The new
row ids come from an uncorrelated `MAX(id)` scalar plus a global `ROW_NUMBER()`, so they cannot
collide with an existing `(id, id_story)` pair. Per-story id gaps are harmless:
`StoryPersistenceAdapter.nextStoryScopedId` allocates `MAX(id)+1` per story.

---

## 2. The check procedure

`core/service/match/EventAvailabilityChecker.java` — **a pure static function, no ports, no I/O.**
One implementation, two call sites: `MatchQueryService` (the `available` flag) and
`EventExecutionService` (the endpoint).

Because it takes a pre-loaded `EventCheckContext` rather than a store port, `/info` evaluates *N*
events against **one** context: a story with fifty events costs exactly what a story with one costs.

**All conditions combine in AND.** There is no `list_events_conditions` table and none is planned —
the conditions are columns on `list_events`. (`list_choices_conditions` is the choice engine's, and
is not used for events.)

The order is the contract; the first failure names the reason:

```
character awake & not in coma   → CHARACTER_CANNOT_ACT
type ∈ {NORMAL, ONCE}           → EVENT_NOT_EXECUTABLE_TYPE
a ONCE event not yet spent      → ONCE_ALREADY_CONSUMED
id_specific_location            → WRONG_LOCATION
cost_enery                      → NOT_ENOUGH_ENERGY
cost_coin                       → NOT_ENOUGH_COINS
cost_food                       → NOT_ENOUGH_FOOD      (v0.35.3)
cost_magic                      → NOT_ENOUGH_MAGIC     (v0.35.3)
registry_key/value_condition    → REGISTRY_CONDITION_NOT_MET
id_weather                      → WEATHER_CONDITION_NOT_MET
id_item_condition               → ITEM_CONDITION_NOT_MET
id_class_condition              → CLASS_CONDITION_NOT_MET
```

Semantics worth stating:

- **`ONCE` is per-MATCH.** Once triggered, it stays spent for the rest of that match — not per
  clock, not per location.
- **A registry key with no expected value is never met.** A condition that can never be satisfied
  must not read as "no condition". The Step 22 validator flags it as `R7_EVENT_CONDITION`.
- **`type` is deliberately NOT a closed vocabulary.** The column is free text and authored stories
  already use values beyond the documented four (`END`, `END_GAME`), while the end-game event is
  identified by `story.idEventEndGame` rather than by its type. Rejecting an unknown type at import
  would break that content for no gain: anything outside `{NORMAL, ONCE}` is simply not
  player-executable, which is the safe default.
- **A null `id_specific_location` means no location constraint.** Such an event is executable
  anywhere via the endpoint, but it is not listed under any location on `/info` (which filters on
  `id_specific_location`).

### ⚠️ "ONCE already consumed" cannot be read from `id_event` alone

`RecoveryStoreAdapter.logCounterZero` (Step 26) and `WeatherStoreAdapter.logWeatherEvent`
(Step 27) already write `log_events` rows carrying an `id_event` — for events that were merely
*referenced*, never run. A naive `SELECT id_event FROM log_events WHERE id_match = ?` would burn a
ONCE event the player never triggered.

The consumed set is therefore built **only** from rows whose message starts with
`EVENT_EXECUTED` (`EventExecutionStorePort.MSG_EVENT_EXECUTED`). That prefix is load-bearing: it is
a shared constant, never a duplicated literal.

---

## 3. Execution

`POST /api/gameplay/{uuid_match}/action/execute-event?lang=` · body `{ "eventUuid": "…" }`

```
1. resolve user → match → the caller's character   (all masked as 404 MATCH_NOT_FOUND)
2. match must be RUNNING
3. resolve the event                               (404 EVENT_NOT_FOUND)
4. load the check context                          ← once
5. run the check procedure                         → 409 with the reason on failure
6. deduct energy + coins                           ← once, for the head of the chain
7. walk the id_event_next chain, applying effects
8. if flag_end_time fired and no coma → force a time end
9. build the response
```

> **v0.31.0**: step 7 now branches. An event owning ≥1 `list_choices` row is a **choice-event**:
> steps 6-9 above are unchanged (cost is still paid, the `EVENT_EXECUTED` marker still written),
> but step 7 presents the choices instead of applying `list_events_effects`, and steps 8-9 are
> skipped. The response gains `status`: `APPLIED` for the plain flow above (with `pendingChoices`
> empty) or `CHOICES_PENDING` for the choice branch. See
> [Step31_ChoiceEngine.md](./Step31_ChoiceEngine.md).

### Costs, and why chained events are free

The player pays **once**, for the event they asked for. Chained events are **consequences, not
choices**: they are neither re-checked nor charged — the player already paid to start the chain. The
one exception is the ONCE invariant, which is a *data* rule rather than an eligibility one: a spent
ONCE event stops the chain before it.

**v0.35.3**: the same "pay once, for the head of the chain" rule now covers `cost_food` and
`cost_magic`, not just energy and coins. The response gains `foodSpent`, `magicSpent`, `newFood`,
`newMagic` beside the existing `energySpent`/`coinSpent`/`newEnergy`/`newCoin`. An AUTOMATIC/FIRST
event never reaches this step at all — see [Step35_ItemsResolution.md §12](./Step35_ItemsResolution.md#12-resource-costs-food-magic-and-coin-become-a-cost-of-acting-v0353)
for the full schema/engine/contract writeup, kept there rather than duplicated here because it
touches movement (Step 28) as much as it touches events.

A cycle is **bounded, not followed**: the executor keeps a visited set plus a depth bound
(`MAX_CHAIN = 32`). The Step 22 validator rejects cycles at import, but the admin CRUD path is
lenient and never sees the whole graph, so an authored `A → B → A` *can* reach the engine.

### Effects

One `list_events_effects` row at a time, in authored order.

- **The narrative is the EFFECT's card**, not the event's. Each `AppliedEffect` in the response
  carries its own `card`.
- **`target=ALL` means every character in the actor's location** (INV-27) — not every character in
  the match. `ONLY_ONE` means the actor. `target_class` narrows either set; matching nobody is legal
  and simply applies nothing.
- **Stats clamp**: `energy ≤ energy_max`, `life ≤ life_max`, `sad ≤ sad_max`, and nothing below
  zero. The response reports `before`, `after` and `delta`, so a clamped effect is visible.
- **The registry and the weather are match-scoped**: written once per effect row, regardless of how
  many characters that row targets. The in-memory context is updated too, so a later effect in the
  same chain reads what the previous one wrote.
- An unknown `statistics` value is authored noise: ignored, not an error.
- **`traits_to_add`/`traits_to_remove` also move stats now (v0.35.2)**: granting or
  removing a trait through this effect no longer just writes the
  `gaming_character_traits` row — the trait's own `life`/`energy`/`sad`/`dexterity`/
  `intelligence`/`constitution`/`weight` deltas are applied (or reversed) the same
  moment, through the same clamp and `statChanges` reporting as any other effect. The
  formula and the reasoning live in
  [Step23_CharacterStatsInitialization.md §6.4](./Step23_CharacterStatsInitialization.md#64-trait-stat-deltas-apply-on-grant-not-only-at-creation-v0352).

### Forced movement (v0.29.3)

An effect row with `id_location` set **moves** every recipient of that row to that location —
**bypassing Step 28 entirely**: no neighbor/adjacency check, no energy cost, no availability
verdict, no location-capacity check. Rules, applied per recipient:

- **A move to the location the recipient already stands in is a no-op** — no `log_movements` row,
  no `LocationChange` entry.
- **An `id_location` matching no location of the story is authored noise**: the engine resolves it
  against a story location id→uuid map and silently skips the move (checked, not an error).
- Each actual move writes a **cost-0** row to `log_movements` (AWS: a cost-0 entry in the match
  item's `movementLog`), purely so the timeline and fog-of-war stay consistent (see
  [Step28_MovementSystem.md](./Step28_MovementSystem.md)): the Match Logs timeline still surfaces a
  `MOVEMENT` entry, and the fog-of-war visited set (built from character positions ∪
  `log_movements`/`movementLog`) stays truthful.
- The recipient's tracked position is updated in the in-memory execution context, so a **later
  effect in the same chain resolves `target=ALL` at the recipient's NEW location**, not the one
  they started the chain at.
- The response gains `movementApplied` (`true` if any move happened) and `locationChanges`
  (`[{characterUuid, fromLocationUuid, toLocationUuid}]` — `fromLocationUuid` is `null` when the
  recipient had no prior location). Both feed the board's `refreshRecommended` signal alongside the
  existing flags (weather/item/coma/time-end). OpenAPI: `LocationChange` schema in
  `v0.29.0-events-api.yaml`.

### Coma short-circuits everything

Life at zero → `is_coma = true`, `is_sleeping = true`, log, **return**. The chain stops and
`flag_end_time` does **not** fire. This is Step 29's whole scope for coma: raise the flags — no
`clock_in_coma` stamp yet (that gap is closed in
[Step30_EdgeStates.md](./Step30_EdgeStates.md)) and no sadness-overflow rule. The all-players-in-coma
story epilogue also arrives in Step 30. Rescue and the game-over transition remain step 59 — which
is also why `gameOver` here is only a flag and never moves `gaming_match.status`.

### Turns

**v0.29.0 deliberately does not touch `gaming_turn_queue`.** An event neither requires nor consumes
a turn — exactly like Step 28 movement. `turnConsumed` is in the response contract but is **always
false**; turn semantics are revisited in Step 61 (multiplayer turn engine).

---

## 4. The `available` flag on `/info`

Every entry of `locationsActive[].events[]` gained:

```json
{ "uuid": "…", "type": "ONCE", "endGame": false, "card": { … },
  "available": false, "reason": "NOT_ENOUGH_ENERGY" }
```

`MatchQueryService` loads the check context **once per request** and loops the pure checker over the
events — no port call inside the loop. The reference character is the creator's (in single-player,
the only one); the admin console uses the same one, so it sees exactly the flags the player would.
Per-character availability arrives with multiplayer (Step 60+).

`EventInfo` has **no 4-argument constructor**: an event must always state whether it can be
triggered, so no call site can silently default to "available".

---

## 5. Logs

Each executed event appends a `log_events` row and surfaces as an **`EVENT`** entry on
`GET /api/matches/{uuid}/logs`.

> `MatchLogsService` derives the entry type from the **message prefix** and *silently drops* what it
> does not recognise. A new writer therefore needs an explicit branch there, or its rows never reach
> the timeline.

---

## 6. Bug fixed on the way in

`StoryImportService.importEvents` never persisted `idSpecificLocation`, `idWeather` or
`idEventNext`, even though the authored JSON carried them and the admin CRUD wrote them. **Every
imported story therefore had zero location-bound events and zero chains** — Step 29 would have had
no data to work on. `importEventEffects` likewise never set `idCard`, the very card that is the
effect's narrative. Both are fixed.

---

## 7. Files

| Layer | Path |
|---|---|
| Migration | `adapter-{sqlite,postgres}/src/main/resources/db/migration/v0/V0.29.0__events_conditions_and_effects.sql` |
| Migration (v0.29.3) | `adapter-{sqlite,postgres}/src/main/resources/db/migration/v0/V0.29.3__event_effect_move_location.sql` — adds `list_events_effects.id_location` |
| Check procedure | `core/service/match/EventAvailabilityChecker.java` |
| Engine | `core/service/match/EventExecutionService.java` (v0.29.3: `applyMovementEffect`) |
| Ports | `core/port/match/EventExecutionPort.java`, `EventExecutionStorePort.java` (v0.29.3: `updateCharacterLocation`, `insertMovementLog`, `findLocationUuidsById`) |
| Persistence | `core/persistence/match/EventExecutionStoreAdapter.java` |
| REST | `adapter-rest/.../controller/match/EventController.java`, `dto/ExecuteEvent{Request,Response}.java` (v0.29.3: `movementApplied`, `locationChanges`/`LocationChangeDto`) |
| Time end | `TimeAdvancementService.forceTimeEnd` + `TurnCycleStorePort.setAllCharactersSleeping` |
| Import fix | `core/service/story/StoryImportService.java` — `importEvents`/`importEventEffects` now persist `idSpecificLocation`/`idWeather`/`idEventNext`/effect `idCard` (§6) |
| Validator | `core/service/story/StoryValidatorService.java` — `R7_EVENT_CONDITION` flags a registry condition with no expected value; v0.29.3: `event-effects.idLocation` wired into the existing `R_LOCATION_REF` dangling-reference check |
| Logs | `core/service/match/MatchLogsService.java` — new `EVENT` branch on `GET /api/matches/{uuid}/logs` |
| OpenAPI | `adapter-rest/src/main/resources/openapi/v0.29.0-events-api.yaml` + patches to `v0.19.0-match-creation-api.yaml` and `v0.19.12-admin-match-control-api.yaml` (v0.29.3: `LocationChange` schema) |
| Admin form | `react-admin/src/constants/story/storiesEntities.jsx`, `storyFieldOptions.js` (v0.29.3: `idLocation` — "Move To Location ID (effect)" — next to `idWeather` on the event-effects form) |
| Game board | `react-game/src/features/gameplay/cards/ActionCard.jsx`, `src/api/matches.js`, `src/api/matchInfoAdapter.js` — **unchanged by v0.29.3**: `GameBook` already reloads clock/weather/locations and the whole board after every executed event, so a forced move arrives with the normal match-info reload |
| Robot | `code/tests/robot/tests/29_events/events.robot` (18 tests — v0.29.3 added "A Location Effect Teleports The Character Without Any Movement Check", run on its own match via `New Teleport Match`; v0.35.3: two id-selector predicates, `Event Uuid By Type`/`Event Uuid By Cost`, updated from `coinCost` to `costCoin` and to exclude the new resource-cost test-bed events). Sibling suite `resource_costs.robot` (9 tests, v0.35.3) covers the `cost_food`/`cost_magic`/`cost_coin` round trip — see [Step35 §12.f](./Step35_ItemsResolution.md#12-resource-costs-food-magic-and-coin-become-a-cost-of-acting-v0353). |

Python and AWS mirror the engine (`app/core/services/match/event_availability.py`/`event_service.py`,
`lambda/match/events.py`); see the [v0.29.0 Roadmap entry](./Roadmap.md) for the full per-backend
file list and test counts. v0.29.3 forced movement mirrors: Python `models.py`, `event_ports.py`,
`event_store_adapter.py`, `event_service.py._apply_movement`, `event_models.py` (+`LocationChange`),
`event_controller.py`; AWS `lambda/match/events.py.apply_location`, `lambda/match/handler.py`
(location-uuid map, `movementApplied`, `locationChanges`), `lambda/seed/handler.py` (tutorial story
gains location 3 "Hidden Grove" with no neighbor edge, event 28 "Secret Passage" costing 2 energy,
effect 14 with `idLocation: 3` — see the [v0.29.3 Roadmap entry](./Roadmap.md)).




# Version Control

- **Document Version**: 0.35.3 (here only due changes)

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.29.0 | Normal events (player-triggered actions) | July 13, 2026 |
  | 0.29.3 | Forced movement via event effects: `list_events_effects.id_location` (nullable), engine bypasses the whole Step 28 check procedure and writes a cost-0 `log_movements` row per move; `movementApplied`/`locationChanges` on the execute-event response; admin form field; Robot suite 17 → 18 tests | July 17, 2026 |
  | 0.31.0 | `execute-event` gained `status` (`APPLIED`/`CHOICES_PENDING`): an event owning `list_choices` rows now branches to the Step 31 choice engine instead of applying effects; a plain event keeps this step's flow unchanged and answers `status: APPLIED` with empty `pendingChoices`. See [Step31_ChoiceEngine.md](./Step31_ChoiceEngine.md). | July 22, 2026 |
  | 0.35.2 | Noted that `traits_to_add`/`traits_to_remove` on this effect row now also move the recipient's stats, not just the trait list. The formula itself is documented in [Step23 §6.4](./Step23_CharacterStatsInitialization.md#64-trait-stat-deltas-apply-on-grant-not-only-at-creation-v0352). | August 22, 2026 |
  | 0.35.3 | `list_events.coin_cost` renamed `cost_coin`, plus new `cost_food`/`cost_magic`: the check procedure gains `NOT_ENOUGH_FOOD`/`NOT_ENOUGH_MAGIC` after `NOT_ENOUGH_COINS` (§1, §2), and payment (§3) now covers all four resources for the head of a chain only. Full writeup in [Step35 §12](./Step35_ItemsResolution.md#12-resource-costs-food-magic-and-coin-become-a-cost-of-acting-v0353). | August 23, 2026 |
  | 0.35.3 | Same version, continued: new Robot suite `resource_costs.robot` (9 tests, §7) covers this event cost round trip end to end; two `events.robot` id-selector predicates fixed after the `coinCost` → `costCoin` rename. Full detail in [Step35 §12.f-g](./Step35_ItemsResolution.md#12-resource-costs-food-magic-and-coin-become-a-cost-of-acting-v0353). | August 24, 2026 |


- **Last Updated**: August 24, 2026
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
