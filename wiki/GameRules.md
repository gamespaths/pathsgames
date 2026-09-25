# Game Rules

Paths Games is a browser-based gamebook: a story told through locations, events and choices,
played by a party of characters advancing through discrete time units. This document describes
the rules **as implemented today** (v0.40.0, Steps 21-39) — a reference for players and story
designers, not a changelog.

## 1. Overview

A **match** is one playthrough of one **story**, created by a user who selects a difficulty and
a starting loadout. The engine models a **party** of characters sharing one clock, one turn
queue, one weather state and one registry — the schema and the turn/priority engine (§4) are
already built for several characters per match. **Today the platform is single-player**: one
human controls the match's characters, there is no second human joining, and no player-to-player
interaction exists. A match ends in a terminal status when its story reaches an end-game event or
when the whole party is comatose and the story's epilogue runs (§11).

Details: [Roadmap](documentation_v0/Roadmap.md), [Step01](documentation_v0/Step01_StartProject.md)

## 2. Characters

A character is created from a **template** (base stats, permitted/prohibited classes), a
**class** (base stats, weight capacity, class bonuses), the match's **difficulty** row, and a set
of selected **traits**. All are resolved once, at match creation or at `join`.

**Base stat formula** (dexterity, intelligence, constitution, life, energy):

| Stat | Formula |
|------|---------|
| `dexterity` | template + class + difficulty + Σtrait + Σclass-bonus |
| `intelligence` | template + class + difficulty + Σtrait + Σclass-bonus |
| `constitution` | template + class + difficulty + Σtrait + Σclass-bonus |
| `life` (= `lifeMax`) | template + difficulty + Σtrait + Σclass-bonus |
| `energy` (= `energyMax`) | template + difficulty + Σtrait + Σclass-bonus |

**Max-stat formula** (`lifeMax`, `energyMax`, `sadMax`, `weightMax`), computed once at join,
persisted because the class is not otherwise stored on the instance:

```
lifeMax/energyMax/sadMax = template.<stat>Max + difficulty.<stat> + Σtrait.<stat> + Σclassbonus.<stat>
weightMax = class.weightMax + difficulty.weight + Σtrait.weight + Σclassbonus.weight   (0 if no class)
```

`sad` starts at 0, backpack (food/magic/coin) starts at 0, starting location is the story's
lowest-id location.

**Traits** are validated in order: unknown uuid → `TRAIT_NOT_FOUND`; duplicate →
`TRAIT_DUPLICATED`; a trait flagged `hideOnStartMatch` → `TRAIT_NOT_SELECTABLE` (still grantable
mid-match by an event or item, never pickable at creation); class-incompatible →
`TRAIT_NOT_COMPATIBLE`; over budget → `TRAIT_COST_EXCEEDED`. **Cost budgets are creation-only**:
`list_stories_difficulty.trait_cost_positive_budget` / `trait_cost_negative_budget` bound the sum
of selected traits' positive/negative cost (`NULL` = unlimited); traits granted later never count
against them.

Details: [Step21](documentation_v0/Step21_CharacterSelection.md), [Step23](documentation_v0/Step23_CharacterStatsInitialization.md)

## 3. Match lifecycle and statuses

A match is `CREATED` at creation (creator loadout stored, no character joined yet needed for
single-player, since join can be automatic). `POST .../start` requires at least one character and
moves it to `RUNNING`, seeding the turn queue (§4). A running match ends in a terminal status when
the story's end-game event fires, or through the all-in-coma epilogue (§11). An owner/admin can
also stop, pause or resume a match out-of-band through the admin API; those transitions are an
operational control, not part of normal play.

Details: [Step24](documentation_v0/Step24_TurnCycleEngine.md), [Step19_SinglePlayerMatchUtils](documentation_v0/Step19_SinglePlayerMatchUtils.md)

## 4. Turns and actions

Every character in `RUNNING` gets one `gaming_turn_queue` row per clock, state
`WAITING → ACTIVE → COMPLETED`. **Priority formula** (higher acts first, deterministic, no ties):

```
priority = (dexterity×3 + intelligence×2 + constitution×1) × 1000 + life×10 + idCharacter
```

Priority is recomputed at every clock start from current stats. The active character can move
(§8), execute an event or choice (§9, §10), use/drop an item or spend exp (§12, §15) — none of
these consume the turn or advance the queue in single-player. **`pass`** is the only action that
explicitly ends a turn: it is free (no energy cost), increments `pass_counter`, and activates the
next WAITING character; when none remain the clock's round is over.

Details: [Step24](documentation_v0/Step24_TurnCycleEngine.md)

## 5. Time and clock

**Time-end** fires once every character satisfies at least one of: `energy == 0`, `is_sleeping`,
`is_coma`. In single-player (one character) it fires as soon as that character sleeps or runs out
of energy. On time-end the shipped sequence is, in order:

```
clock++  →  write log_clock_history  →  wake all characters
   →  recovery (§6, Step 26)
   →  pending automatic events: counter-zero, start-time (§9, Step 33)
   →  weather roll (§7, Step 27)
   →  random event, at most one (§9, Step 39)
   →  rebuild turn queue for the new clock (§4, Step 24/25)
```

`GET .../clock` exposes the current clock, the story's clock-unit label, and each character's
sleeping state.

Details: [Step25](documentation_v0/Step25_TimeAdvancementClockCycle.md)

## 6. Recovery at time-start

Per character, based on whether the occupied location is **safe** (`secure_param > 0`). Let
`P = location.secure_param + difficulty.energy`:

| Location | Energy Δ | Life Δ | Sadness Δ |
|----------|----------|--------|-----------|
| Safe | `DEX + P` | `COS + secure_param` | `-(INT + secure_param)` |
| Unsafe | `difficulty.energy` only | 0 | 0 |

Class bonuses (`list_classes_bonus`, matched by `id_class` and stat name) are added afterwards,
then every stat is clamped to `[0, max]`. A comatose character on a safe location whose life ends
up `> 0` after this pass **wakes** (`is_coma` cleared, `COMA_RECOVERED` logged); an unsafe
location heals no life, so it never wakes there. Location counters (`clock_counter`) decrement
here too; reaching zero fires the location's counter-zero event exactly once per match (§9).

Details: [Step26](documentation_v0/Step26_TimeStartRecovery.md), [Step30](documentation_v0/Step30_EdgeStates.md)

## 7. Weather

At every time-start, eligible `list_weather_rules` rows (`is_active`, clock in `[time_from,
time_to]`, registry condition met — §13) are weighted by `probability` and one is picked with a
seed of `rng_seed + clock` (falls back to `id_story` when `rng_seed` is null). The winning rule's
`delta_energy` is applied to every character, clamped to `[0, energy_max]`; its
`cost_move_safe_location` / `cost_move_not_safe_location` feed the movement energy formula (§8).
No eligible rule → weather clears. An optional linked event is queued, not executed by Step 27
itself.

Details: [Step27](documentation_v0/Step27_WeatherSystem.md)

## 8. Movement

`POST .../movements/start` moves the active character to a listed neighbor location. Checks run
in order, first failure wins:

| # | Check | Refusal |
|---|-------|---------|
| 1 | Character awake, not comatose | `CHARACTER_CANNOT_ACT` |
| 2 | Target is a listed neighbor | `NOT_A_NEIGHBOR` |
| 3 | Neighbor registry condition met | `MOVEMENT_CONDITION_NOT_MET` |
| 4 | Carried weight ≤ capacity | `OVERWEIGHT` |
| 5 | Energy ≥ total cost | `INSUFFICIENT_ENERGY` |
| 6 | Coin / food / magic ≥ edge cost | `NOT_ENOUGH_COINS/FOOD/MAGIC` |
| 7 | Target not at capacity | `LOCATION_FULL` |

**Energy cost** = `neighborEdge.energyCost + targetLocation.costEnergyEnter + weatherModifier`
(weather modifier depends on whether the target is safe). Coin/food/magic costs come from the
edge alone, no entry or weather term. A move writes a `log_movements` row and updates the
character's location. **Fog-of-war**: only already-visited locations (and their cards) are
exposed to the player; the destination's own card is shown before the move, gated on the *other*
endpoint's visited flag.

Details: [Step28](documentation_v0/Step28_MovementSystem.md)

## 9. Events

An event's **conditions** live on `list_events`, its **effects** on `list_events_effects`. Type
is `NORMAL`, `ONCE`, `AUTOMATIC` or `FIRST`; only `NORMAL`/`ONCE` are player-executable via
`execute-event`. Availability is checked in one fixed order — first failure is the reason:

```
awake & not comatose → executable type → ONCE not yet spent → location match
   → energy → coin → food → magic → registry condition → weather condition
   → item condition → class condition
```

`ONCE` is spent **per match**, forever. The player pays once, for the head of the chain
(`id_event_next` walk, cycle-bounded); chained events are never re-checked or re-charged.
Effects apply in authored order: `target=ALL` reaches everyone in the actor's location,
`ONLY_ONE` the actor, `target_class` narrows either; stats clamp at `[0, max]`. An effect can
grant/remove traits (with their own stat deltas applied live) or force a move to a location,
bypassing all movement checks. Life reaching 0 short-circuits the chain into coma (§11).

**Automatic triggers** are authored on the *location*, not the event, through five columns:
first entry, subsequent entry, character-enters-empty-location (resolved on arrival), and
counter-zero / character-start-time (resolved at time-start, ordered by
`priority_automatic_event` then location id). A **random event** (at most one per time-start,
after weather) picks an eligible `list_global_random_events` row by absolute percentage — see
§16 for the seed — and runs with no single actor, reaching the whole party.

Details: [Step29](documentation_v0/Step29_NormalEvents.md), [Step33](documentation_v0/Step33_LocationEntryEvents.md), [Step39](documentation_v0/Step39_RandomEvents.md)

## 10. Choices

An event owning ≥1 `list_choices` row is a **choice-event**: `execute-event` pays the usual cost
and returns `status: CHOICES_PENDING` with every option (including unavailable ones, disabled not
hidden) instead of applying effects. Re-fetching an open cycle is free and re-evaluates only each
option's own availability — never the event-level check, which would wrongly reject an event
already paid for. **Per-option availability**: `otherwise_flag` always passes; then inline
stat limits (AND); then `list_choices_conditions` combined under the choice's own AND/OR.

`POST .../action/select-choice` charges nothing (cost was paid on open) and applies
`list_choices_effects` in authored order — stat change, registry set/clear, item add/remove,
forced move, weather set, or an inline event. `flag_group` sends the recipients to everyone in
the actor's location instead of just the actor. All rows land first (a lethal one does not
silence its siblings); only then does the edge-state pass run once, and only then do
consequence events run (`id_event`, then `id_event_torun`) — which may themselves present a new
`CHOICES_PENDING`, chaining choice onto choice.

Details: [Step31](documentation_v0/Step31_ChoiceEngine.md), [Step32](documentation_v0/Step32_ChoiceResolution.md)

## 11. Edge states

Two rules, evaluated together (order matters — the second reads life after the first):

1. **Sadness overflow** — `sad >= sad_max` (only when `sad_max > 0`) subtracts `constitution`
   from life (floored at 0), resets `sad` to 0, forces sleep.
2. **Coma** — `life <= 0` sets `is_coma` and `is_sleeping`, stamps `clock_in_coma`. A character
   already comatose is not re-triggered.

These rules run after event/choice effects and after time-start recovery — never inside the
admin's raw stat-change tool. When **every** character of the match is comatose, the story's
`id_event_all_player_coma` epilogue runs once (and, if itself `ONCE`, at most once per match); a
story authoring none is legal — the collapse is only logged. Waking from coma happens during
recovery (§6): safe location + post-recovery life `> 0` clears `is_coma`.

Details: [Step30](documentation_v0/Step30_EdgeStates.md)

## 12. Inventory and resources

`GET .../inventory` lists the character's items, weight and capacity; `use-item` and `drop-item`
act on the inventory **row** (`itemInstanceUuid`), never the item definition directly.

- **Using** a consumable spends `amount_use` units (default 1); insufficient units → `ITEM_NOT_ENOUGH`.
  Non-consumables cannot be used, only carried/dropped. Class restrictions apply as elsewhere.
- **Dropping** removes `amount_drop` units (default 1); takes whatever is held if less, never refused.
- **`max_per_character`** caps how many units an event/choice ADD may grant; exceeding it is a
  silent `NOT_ADDED`, not an error.
- **Carried weight** = `Σ(item.weight × item.amount)`; food/magic/coin weigh nothing. Capacity is
  `weightMax` (§2). Movement refuses `OVERWEIGHT` when weight exceeds capacity.
- **Resource costs (v0.35.3)**: events and movement edges can also cost `cost_food`/`cost_magic`
  in addition to `cost_coin`; the check order after energy is coin → food → magic. Automatic
  events, chained events and choice resolution never pay any of the four costs.

Details: [Step34](documentation_v0/Step34_InventoryAndResources.md), [Step35](documentation_v0/Step35_ItemsResolution.md)

## 13. Registry

The match registry (`gaming_state_registry`) is a set of key → value(s) pairs, written by
events, choices, movement edges and locations. One service (`render`/`parse`/`evaluate`) backs
every reader. A key can hold a **set** of values (multi-value); comparisons act over the whole
set:

| Operator | Meaning | On an empty/absent key |
|---|---|---|
| `=` (default) | ∃ — any member equals the value | never met |
| `!=` | ∄ — no member equals the value | **the only one an absent key can satisfy** |
| `>` / `<` | ∀ — every member compares that way | never met |

A **null expected value is never met**, regardless of operator — a typo must lock a door, never
open one. A **blank condition key** means no condition at all, the opposite reading. All four
condition owners (events, movement edges, weather rules, choices) share this evaluator.

Details: [Step36](documentation_v0/Step36_RegistrySystem.md)

## 14. Missions

A mission is a **projection of the registry**, not a separate state table: every condition —
the mission's own and each step's — is `RegistryService.evaluate("=", ...)`, which is equality
on a single-valued key and "contained in" on a set. `condition_value` is one value;
`condition_values` is a PIPE-separated list read as **AND** (every listed value must be present);
if both are set, `condition_values` wins.

Status machine: `AVAILABLE` (mission condition met) → `ACTIVE` (first step met) →
`COMPLETED` (last step met); `FAILED` if the story ends while still open (never for a mission
that was never `AVAILABLE`). Steps are strictly ordered but may satisfy out of order — one
registry write can close several steps and the mission at once. **States never reverse.**
Missions are match-scoped, not per-character; a completion event's `target=ALL` effect reaches
the whole party.

Details: [Step37](documentation_v0/Step37_MissionSystem.md)

## 15. Experience

`POST .../action/use-exp` (`{"stat": "dex|int|cos"}`) raises one stat by exactly 1. Price:

```
cost = max(1, exp_cost × current_value + exp_cost_base)
```

read from the match's difficulty row, capped by `max_stat_value` (`MAX_STAT_VALUE` refusal at
the cap). Gates, in order: match running → caller's turn (if a turn is active) → not comatose →
not sleeping → valid stat → location safe (`secure_param > 0`) → under the cap → enough exp. The
action costs **zero energy**, does not consume the turn, and is effective immediately. It also
writes `use-exp` / `use-exp-<STAT>` registry keys so missions can watch experience spending.

Details: [Step38](documentation_v0/Step38_ExperienceSystem.md)

## 16. Randomness

Every match has its own `rng_seed` (random unless supplied at creation; Robot tests use `42` for
determinism). It seeds two independent, reproducible-per-backend draws each clock:

- **Weather** (§7): `rng_seed + clock`.
- **Random events** (§9): `rng_seed + clock + 1_000_003` — the salt keeps the two draws from ever
  landing on the same roll.

Java, Python and AWS each use their own RNG implementation over the same seed formula, so a given
`rngSeed` reproduces the same outcome **within one backend**, never identically across all three.

Details: [Step27](documentation_v0/Step27_WeatherSystem.md), [Step39](documentation_v0/Step39_RandomEvents.md)

## 17. What the game does NOT have

**There is no combat system, and there will be none before multiplayer.** Also not implemented
today:

- **No permadeath** — coma is always recoverable; planned for V1.
- **No NPCs** — planned for V2.
- **No multiplayer** — a match has one human player today, even though the turn/priority/party
  engine is already built for it; planned for V4+.

Details: [Roadmap](documentation_v0/Roadmap.md)

# Version Control
- **Document Version**: 0.40.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.40.0 | First version of the game rules reference | September 25, 2026 |

- **Last Updated**: September 25, 2026 (v0.40.0)

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
