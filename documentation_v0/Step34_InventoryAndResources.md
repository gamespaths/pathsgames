# Step 34 & 35 — Inventory and resources

Steps 34 and 35 ship **together**, because the carried-weight formula of step 35 is what
gives the inventory of step 34 its consequence. Most of the engine already existed and is
reused, not rebuilt: events and choices have added and removed items since Step 29, and have
written `food`/`magic`/`coin` for just as long ([Step09](./Step09_DesignCoreDataModel.md),
[Step29](./Step29_NormalEvents.md), [Step32](./Step32_ChoiceResolution.md)). What was missing
was a way for the **player** to act on the inventory, and a weight that actually blocks a
move.

Two things follow from that framing and shape every decision below:

- The player, not the engine, is the actor. Steps 29-33 all describe things the engine does to
  a character; `use-item` and `drop-item` are the first two match actions in this range of the
  roadmap the character's own player calls directly.
- Because an item usage can move a stat, it must go through the same overflow/coma gate an
  event effect goes through — the response it returns is shaped accordingly (§2).

---

## 1. Four endpoints, all under `/api/gameplay/`

| Method | Path | Answers |
|---|---|---|
| GET  | `/api/gameplay/{uuidMatch}/inventory?lang=xx` | the caller's items, carried weight, capacity |
| POST | `/api/gameplay/{uuidMatch}/inventory/use-item` | the **execute-event payload** |
| POST | `/api/gameplay/{uuidMatch}/inventory/drop-item` | what left the inventory |
| GET  | `/api/gameplay/{uuidMatch}/resources` | food, magic, coin, weight, weightMax |

New OpenAPI spec:
[`v0.34.0-inventory-resources-api.yaml`](../code/backend/java/adapter-rest/src/main/resources/openapi/v0.34.0-inventory-resources-api.yaml).
It carries the full prose rationale for every decision below; this document draws on it rather
than repeating it verbatim.

### `itemInstanceUuid` is the ROW, not the item

Both request bodies name a single field, **`itemInstanceUuid`** — the uuid of the
`gaming_inventory_items` row (`items[].uuid`), **never** `items[].itemUuid`, which identifies
the story definition in `list_items`. `use-item`/`drop-item` act on the row it names, spending
or removing units from it (v0.35.1, [Step35 §8](./Step35_ItemsResolution.md#8-quantities-and-the-per-character-cap-v0351)),
so the row is the only thing a request can correctly name — even though, since v0.35.1, the
schema now guarantees at most one row per (character, item) (`uq_inventory_char_item`; before
that migration a character could in principle hold duplicate rows for the same item, which is
what originally motivated naming the row rather than the item). This is the single most likely
integration mistake in this step.

### Error codes

| Status | Code | Meaning |
|---|---|---|
| 401 | `UNAUTHENTICATED` | no user identity on the request |
| 404 | `MATCH_NOT_FOUND` | unknown match, unknown user, or the caller owns no character in it |
| 404 | `ITEM_NOT_FOUND` | unknown row uuid — **or** a row belonging to another character |
| 400 | `MISSING_ITEM` | the body carries no `itemInstanceUuid` |
| 409 | `MATCH_NOT_RUNNING` / `COMA` / `SLEEPING` | the usual action gates |
| 409 | `ITEM_NOT_CONSUMABLE` | `is_consumabile != 1` — use-item only |
| 409 | `ITEM_CLASS_NOT_PERMITTED` / `ITEM_CLASS_PROHIBITED` | class gate — use-item only |
| 409 | `ITEM_NOT_ENOUGH` | fewer units carried than `list_items.amount_use` spends — use-item only (v0.35.1, [Step35 §8](./Step35_ItemsResolution.md#8-quantities-and-the-per-character-cap-v0351)) |

"The row belongs to the caller" is enforced by **masking**, not by a separate ownership check:
`findOwnRow` only ever searches the caller's own rows, so another player's row is
indistinguishable from a missing one — the same reasoning [Step28 §6.3](./Step28_MovementSystem.md)
already applies to fog-of-war.

## 2. `use-item` answers `execute-event`

`use-item` returns the **same body** `POST .../action/execute-event` returns
([Step29](./Step29_NormalEvents.md)), so react-game's `handleEventExecuted` handles it almost
unchanged. The reason is not convenience: an item carrying a `SADNESS` effect can trip the
Step-30 sadness overflow or coma, and the response has to be able to say so. On an item usage:

- `eventUuid` and `eventType` are **null** — an item owns no event;
- `card` is the **item's own** card, resolved in the requested language;
- `executedEventUuids` is empty, `energySpent` and `coinSpent` are `0`;
- `effects[]` carries one entry per `list_items_effects` row, each with its own card;
- `edgeState` is filled by the very same evaluator an event effect goes through;
- `itemRemoved` is `true`;
- `pendingChoices` is always empty and `gameOver` is only ever set by the coma epilogue — the
  `CHOICES_PENDING` and end-game branches of Step 31/32 do not apply to items.

### Rules of use

- **Only consumables can be used.** `list_items.is_consumabile = 1`. A non-consumable item is
  carried — it adds weight and can satisfy an item condition on an event or a choice — but
  `use-item` refuses it with `ITEM_NOT_CONSUMABLE`.
- **Class restrictions are honoured**: `id_class_permitted` and `id_class_prohibited` are
  checked against the character's class, exactly as they already are for traits and character
  templates. `0` or `null` means "no restriction".
- **Using spends `list_items.amount_use` units, not the whole row** (v0.35.1,
  [Step35 §8](./Step35_ItemsResolution.md#8-quantities-and-the-per-character-cap-v0351)). An
  empty column reads as `1`. `amount` is decremented by that many; the row is deleted only when
  nothing is left. Owning fewer units than the column asks is a refusal, `ITEM_NOT_ENOUGH` (409)
  — this was previously an all-or-nothing deletion with no notion of quantity.
- **Dropping removes `list_items.amount_drop` units, not the whole row** (same v0.35.1 section).
  An empty column also reads as `1`. Owning fewer than that is **not** a refusal: the drop takes
  what is there, and the response's `amountDropped` reports exactly that number.
  `drop-item` applies **neither** the consumable gate **nor** the class gate: a non-consumable
  item must be droppable, that is the point of carrying one. Handing an item to another
  character is multiplayer (steps 71-76) and out of scope — there is no recipient field and no
  transfer endpoint.
- **A character may be capped per item.** `list_items.max_per_character` (0 or `NULL` = no
  limit, v0.35.1) refuses an event/choice ADD that would cross it — no error, the effect chain
  keeps running and reports the refusal as an `itemChanges` entry with `action: NOT_ADDED`.
- **Using costs nothing.** `number_max_free_action` stays unenforced across the whole project:
  using an item costs neither the turn nor a free-action slot.
- Every successful usage appends a row to `log_item_usage`: character, item, the units spent
  (`counter`, v0.35.1 — this column existed before but always wrote `1`), `effects_json`,
  timestamp. **v0.35.4**: the table stopped being "the usage log" and became the register of
  every item action — `use-item` writes `action=USE`, and `add`/`drop`/an effect's `REMOVE`
  now write their own row too, each carrying the signed `energy`/`food`/`magic`/`coin` it
  produced and (for an effect-driven ADD/REMOVE) the `id_event` that moved it. These rows
  surface on `GET /api/matches/{uuid}/logs` as `ITEM_ADD`/`ITEM_USE`/`ITEM_DROP` entries — see
  [Step28 "New: Item Actions and Resource Gains (v0.35.4)"](./Step28_MovementSystem.md).

## 3. One effect engine, not two

`InventoryService` (java) / `inventory_service.py` owns everything item-shaped: validation
order, row removal, `log_item_usage`, listing, resources. It does **not** duplicate the effect
engine. Instead it delegates effect application to a single package-private door on
`EventExecutionService`:

```java
EventExecutionResult applyStandaloneEffects(long idMatch, long idCharacter,
                                             List<StandaloneEffect> effects,
                                             CardInfo card, String lang,
                                             boolean sourceConsumed)
```

with a new record on `EventExecutionPort`:

```java
record StandaloneEffect(String effectUuid, String statistic, Integer value,
                         String traitsToAdd, String traitsToRemove, Integer idCard) {}
```

Mirrored as `EventService.apply_standalone_effects(...)` in python (`app/core/services/match/event_service.py`)
and inline in AWS's `lambda/match/events.py`. The rationale, stated in the python docstring, is
worth repeating: `Live.setSad` / `_Live.set_sad` exist precisely so that no future effect type
can bypass the Step-30 overflow check — a second engine would be exactly that effect type.
`applyStandaloneEffects` runs the same clamping, the same single-write flush, the same edge-
state verdict and the same all-players-in-coma epilogue an event effect runs; it just skips the
event-specific bookkeeping (`executedEventUuids`, choice branching) that does not apply here.

### Effect-code vocabulary

`list_items_effects.effect_code` is **case-insensitive** and speaks the same vocabulary
`list_events_effects.statistics` already speaks: `life, energy, exp, sad, dex, int, cos, food,
magic, coin`. The one documented alias is **`SADNESS` → `sad`** (plus `COINS` → `coin`),
implemented by `EffectStatCodec.normalize()` (java) / `normalize_effect_code` (python, AWS) and
applied **on the item path only**. Normalising inside the shared engine would silently widen
the event and choice vocabularies too, diverging further from what the schema actually
documents. An unknown code is authored noise: the engine skips that part of the effect rather
than failing the whole usage.

## 4. Database — additive columns, one dialect fix

```sql
-- V0.34.0__add_item_effect_traits.sql  (SQLite and PostgreSQL)
ALTER TABLE list_items_effects ADD COLUMN traits_to_add    VARCHAR(200); -- TEXT on SQLite
ALTER TABLE list_items_effects ADD COLUMN traits_to_remove VARCHAR(200); -- TEXT on SQLite
```

Same column names and the same CSV-of-story-scoped-`list_traits`-ids format
`list_events_effects` already uses (`V0.10.4`) — no third format was invented. No FK,
deliberately, same as every other effect column: the reference is story-scoped and the
Step-22 validator owns the existence check (§6). No table was created: `list_items`,
`list_items_effects`, `gaming_inventory_items` and `gaming_backpack_resources` have carried
everything else since `V0.10.x`.

The postgres migration also converts `log_item_usage.effects_json` from `JSONB` to `TEXT` —
a dialect-convergence fix, the same class of bug as `V0.19.1` and `V0.26.1`: the Java entity
field is a `String` like every other log column, and binding a String to JSONB raises
`PSQLException 42804`. Nothing in the project reads `effects_json` with a JSON operator, so
`JSONB` bought nothing and cost a dialect-specific Hibernate type mapping.

`log_item_usage` carries `UNIQUE (id)`, unlike `gaming_inventory_items` — its ids are allocated
from the table-wide maximum, never per match, the same allocation style every other `log_*`
audit table already uses.

New Java entity/repository: `LogItemUsageEntity`, `LogItemUsageEntityId`,
`LogItemUsageRepository`.

## 5. `/info` changes

- `players[].items[]` now carries `idCard` **and** the resolved `card` object, plus
  `isConsumabile`, and the item name is resolved in the **requested** language (it was
  hardcoded to `"en"` before this step).
- The `items` key stays on **every** player, but is populated **only** for the calling user's
  character — an empty array for the others. No leak of another player's inventory, DTO shape
  unchanged. `weight` is deliberately **not** masked: a scalar total says a rival is heavy, the
  array says what they carry.
- **The admin view is exempt.** `getMatchInfoForAdmin` has no requester at all, so masking
  there would blank every player's items in the console.
- `food` / `magic` / `coin` are promoted onto the shared character stats block
  (`AbstractCharacterStatsResponse`), so `/info players[]` finally reports them — they were
  only on the full `CharacterInstanceResponse` before. The backpack row is already loaded by
  `buildAll()`, so this costs no extra query. JSON key set unchanged.

## 6. Validation — Step 22 extension

One new target, one new rule, consistent with [Step22](./Step22_StoryValidation.md):

| Code | Rule |
|---|---|
| `R_TRAIT_REF` | a `traits_to_add` / `traits_to_remove` CSV entry (on `list_items_effects`, and equally on `list_events_effects` / `list_choices_effects`) names a trait id that does not exist in the story |

`Target.TRAIT` is a genuinely new referential-integrity target — there was no trait target at
all before this step, even though `traits_to_add`/`traits_to_remove` already existed on
`list_events_effects` and `list_choices_effects`. An id matching no trait of the story was
previously authored noise the engine silently skipped; it now hard-fails import and is
reported leniently by `/validate` and admin CRUD, exactly like every other `R1`-family rule.

`StoryImportService.importItems` now also imports `idClassPermitted` / `idClassProhibited` —
those two columns existed on `list_items` since `V0.10.x` but the importer never populated
them, so the class restriction was not expressible from a seed at all. (`uuid` was already
imported; only the two class columns were missing.)

## 7. Carried weight and movement (Step 35)

- Capacity is `weight_max`, computed **once at character creation**
  (`CharacterCommandService`): `class.weight_max + difficulty.weight + Σ traits.weight +
  Σ class-bonus.weight` — the formula [Step23](./Step23_CharacterStatsInitialization.md) and
  [Step27](./Step27_WeatherSystem.md) already built and tested. The older roadmap formula
  (constitution + difficulty `max_weight` + `DefaultInventoryCapacity`) is dropped: the roadmap
  is adapted to the code, not the reverse.
- Carried weight is `Σ (item.weight × amount)`. A null weight counts as `0`, a null amount as
  `1`, and an item the story no longer defines weighs nothing. This is exactly the formula
  `CharacterMapper.buildItems()` already computed for `/info`; the two **must** agree, or
  `/info` would show a weight the movement gate does not act on.
- **Food, magic and coins weigh nothing.** Only items do.
- `list_stories_difficulty.max_weight` is a live field of the difficulty CRUD/import/public API
  pipeline (`DifficultyInfo`, `DifficultyResponse`) — it is simply **not** the column the
  capacity formula uses; that is the separate `weight` column added in `V0.19.7`. Both stay
  exactly as they are. The seed parameter `DefaultInventoryCapacity` (`V0.10.12`) is
  genuinely dead — nothing reads it — and is deliberately left in place, not wired, not
  removed.
- Movement now receives the **real** carried weight, which switches on the `OVERWEIGHT`
  refusal `MovementAvailabilityChecker` had always implemented but that was dead because
  `MovementStoreAdapter` passed a hardcoded `0`. Same fix in java, python and AWS. Computed in
  a constant number of queries per match (one query for unit weights, one for inventory rows,
  summed in memory), not one query per character.

## 8. Other backends and frontends

### AWS — not a plain mirror

There is no inventory table on DynamoDB: items are an embedded list on the character item
(`char.setdefault("items", [])`, `lambda/match/events.py`), and rows now carry their own
`uuid` so `use-item`/`drop-item` can name one. `_character_summary()` and `_character_full()`
in `lambda/match/handler.py` used to hardcode `"weight": 0, "items": []` with a comment saying
the schema had no inventory table; un-hardcoding those two functions was the bulk of the AWS
response-layer work. There is no separate `log_item_usage` table either — the usage log is an
embedded `itemUsageLog` list on the match METADATA item, mirroring `eventLog`. New module
`lambda/match/inventory.py`. Four routes were added to `template/match.yaml` — without them API
Gateway 404s before the lambda runs at all.

### Python

`ItemEntity` gained `is_consumabile` / `id_class_permitted` / `id_class_prohibited`, and
`ItemEffectEntity` was renamed `effect_type` → `effect_code`, plus the two trait CSVs — the
python schema was previously disjoint from java's, exactly like the `EventEffectEntity`
realignment that already happened for events. `StoryImportService`'s equivalent now reads the
canonical top-level `itemEffects` array with `effectCode`; the nested `item["effects"]` shape
still imports, as a legacy fallback. New: `app/core/ports/match/inventory_ports.py`,
`app/core/services/match/inventory_service.py`,
`app/adapters/persistence/match/inventory_store_adapter.py`,
`app/adapters/rest/match/inventory_controller.py`.

### react-game

New `features/gameplay/cards/ItemCard.jsx`, prop contract copied from `ActionCard` /
`MovementCard` (`item`, `story`, `onPreview`, `previewSide="right"`, `playerStats`,
`matchUuid`, `accessToken`, `onDone`, `onError`) — rendered in `GameBook.jsx` right after the
actions `.map()` and before the sleep action row. No `label` prop on `Card`/`CardButtons`; use
`lockInfo`, per project convention. Four new functions in `src/api/matches.js`.
`matchInfoAdapter.toPlayerStats()` now reads the real `food`/`magic`/`coins` — the backend
field is `coin` (singular), the frontend key stays `coins` (plural). The use-item handler is
modelled on `handleEventExecuted`: reload, then the narrative card, then the edge state.

**Known limitation, not fixed here**: react-game reads `info.players?.[0]` rather than the
calling user's player. Correct in single-player, wrong once multiplayer lands — to be fixed in
the multiplayer frontend steps (81-84), not in this step.

### react-admin

The `item-effects` form and list gained `traitsToAdd` / `traitsToRemove` (CSV-of-ids text
fields, same as the event/choice effects forms).

### Story seed

Both `story_demo_3.json` and `story_demo_4.json` were extended with item `id`, `idCard`,
`itemEffects`, at least one item restricted by class, and an event carrying
`itemAction: ADD`. Both, not one: those two demo files are used only by
`14_admin/story_import.robot` (imported then deleted) — the gameplay suites actually play
against stories 9001/9002 from `R__insert_story_seed_data.sql`, and **that** SQL seed is the
one steps 34/35 actually exercise. Mirrored in the python (`scripts/seed_stories.py`) and AWS
(`lambda/seed/handler.py`) seeds — the AWS seed had never declared an `items` list at all,
despite its event effects already naming item ids.

## 9. Test coverage

- New robot suite `code/tests/robot/tests/34_inventory/`: `inventory.robot` (7 tests),
  `use_item.robot` (10 tests; **v0.35.6** adds coma-lock cases — see
  [Step30_EdgeStates.md](./Step30_EdgeStates.md)), `resources.robot` (8 tests) — passing against
  a local java server. Four new keywords in `resources/matches.resource`: `Get Inventory`,
  `Use Item`, `Drop Item`, `Get Resources`. Includes the acceptance test the roadmap named: a
  consumed item must stop satisfying an event's item condition.
- Unit tests on every backend: java (`InventoryServiceTest`, `InventoryStoreAdapterTest`,
  `InventoryControllerTest`, `InventoryDtosTest`, `EventExecutionServiceStandaloneTest`,
  `EffectStatCodecTest`, `ItemInstanceMapperTest`, `LogItemUsageEntityTest`), python
  (`test_inventory_service.py`, `test_inventory_store_adapter.py`,
  `test_inventory_controller.py`, `test_event_service_standalone.py`), AWS
  (`test_inventory.py`, `test_match_handler_inventory.py`). React-game gained
  `test/ItemCard.test.jsx`. Coverage of the new code is 100% instructions on java/python/aws.
- Regression watch: the `28_movement` robot suites ran with `carriedWeight = 0` before this
  step; turning on the real weight can change their outcome, so the whole suite was re-run
  after the change.

## 10. Scope of change

| Layer | Path |
|---|---|
| Migration | `adapter-{sqlite,postgres}/src/main/resources/db/migration/v0/V0.34.0__add_item_effect_traits.sql` — two columns on `list_items_effects`; postgres also converts `log_item_usage.effects_json` `JSONB`→`TEXT` |
| Entities (Java) | `ItemEffectEntity.traitsToAdd/traitsToRemove`; `LogItemUsageEntity`, `LogItemUsageEntityId` (new) |
| Engine (Java) | `core/service/match/InventoryService.java` (new, implements `InventoryPort`); `EventExecutionService.applyStandaloneEffects` (new package-private door); `EventExecutionPort.StandaloneEffect` (new record); `model/match/EffectStatCodec.java` (new); `service/match/ItemInstanceMapper.java` (new); `CharacterMapper`, `CharacterQueryService`, `MatchQueryService`, `MovementService` updated |
| Ports/persistence (Java) | `core/port/match/InventoryPort.java`, `InventoryStorePort.java` (new); `core/persistence/match/InventoryStoreAdapter.java` (new); `MovementStoreAdapter` (real carried weight); `MatchPersistenceAdapter` (food/magic/coin on `/info`) |
| REST (Java) | `adapter-rest/.../controller/match/InventoryController.java` (new); `InventoryResponse`, `DropItemRequest`, `DropItemResponse`, `ResourcesResponse`, `UseItemRequest` DTOs (new); `AbstractCharacterStatsResponse`, `CharacterInstanceResponse`, `ItemInstanceResponse` updated |
| Authoring (Java) | `StoryCrudService`, `StoryImportService` (`idClassPermitted`/`idClassProhibited` on items), `StoryValidatorService` (`Target.TRAIT`, `R_TRAIT_REF`) |
| OpenAPI | `v0.34.0-inventory-resources-api.yaml` (new, four endpoints) |
| Engine (Python) | `app/core/services/match/inventory_service.py` (new); `EventService.apply_standalone_effects` (new); `app/core/services/match/character_query_service.py`, `match_query_service.py`, `movement_service.py` updated |
| Ports/persistence (Python) | `app/core/ports/match/inventory_ports.py` (new); `app/adapters/persistence/match/inventory_store_adapter.py` (new); `movement_store_adapter.py` (`_carried_weight_by_character`, real carried weight replacing the hardcoded `0`); `story_match_read_adapter.py`, `story_persistence_adapter.py` updated |
| REST (Python) | `app/adapters/rest/match/inventory_controller.py` (new); `match_controller.py` updated |
| Schema (Python) | `app/adapters/persistence/match/models.py`, `app/adapters/persistence/story/models.py` — `ItemEntity` gains `is_consumabile`/`id_class_permitted`/`id_class_prohibited`; `ItemEffectEntity` renamed `effect_type`→`effect_code` plus the two trait CSVs |
| Authoring (Python) | `story_import_service.py` (canonical top-level `itemEffects` array, legacy nested fallback) |
| Engine (AWS) | `lambda/match/inventory.py` (new); `lambda/match/events.py`, `handler.py`, `movements.py` updated (`_character_summary`/`_character_full` un-hardcoded, real `carriedWeight`); `lambda/story/handler.py`, `lambda/seed/handler.py` updated |
| Infra (AWS) | `template/match.yaml` — four new routes |
| Seed (all four) | `R__insert_story_seed_data.sql` (the seed the gameplay suites actually play against), `story_demo_3.json`, `story_demo_4.json`, `scripts/seed_stories.py`, `lambda/seed/handler.py` |
| Game board | `react-game/src/features/gameplay/cards/ItemCard.jsx` (new); `src/api/matches.js` (four functions); `src/api/matchInfoAdapter.js` (real food/magic/coins); `GameBook.jsx` updated; i18n `en.json`/`it.json` |
| Admin | `react-admin` `item-effects` form and list gain `traitsToAdd`/`traitsToRemove` (`storiesEntities.jsx`, `StoryEditorPage.jsx`) |
| Robot | `code/tests/robot/tests/34_inventory/{inventory,use_item,resources}.robot` (25 tests); four new keywords in `resources/matches.resource` — see `.claude/docs/robot-suites.md` for suite/keyword detail, not duplicated here |
| Tests | Java: `InventoryServiceTest`, `InventoryStoreAdapterTest`, `InventoryControllerTest`, `InventoryDtosTest`, `EventExecutionServiceStandaloneTest`, `EffectStatCodecTest`, `ItemInstanceMapperTest`, `LogItemUsageEntityTest`. Python: `test_inventory_service.py`, `test_inventory_store_adapter.py`, `test_inventory_controller.py`, `test_event_service_standalone.py`. AWS: `test_inventory.py`, `test_match_handler_inventory.py`. React-game: `test/ItemCard.test.jsx`. |

Python and AWS mirror the java engine and validator described above, subject to the AWS note
in §8.

---

# Version Control

- **Document Version**: 0.35.6

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.34.0 | Inventory and resources, implemented: four endpoints under `/api/gameplay/` (`inventory`, `use-item`, `drop-item`, `resources`), with `use-item` answering the execute-event payload through one shared door on the effect engine — no second engine, so an item trips the same Step 30 edge states an event does (§1-§3). `V0.34.0__add_item_effect_traits.sql` adds the trait CSVs to `list_items_effects`, `/info` masks every inventory but the caller's, and Step 35 switches on the `OVERWEIGHT` refusal the movement gate had always implemented against a hardcoded zero (§4-§7). | August 20, 2026 |
  | 0.35.6 | react-game: `use_item.robot` gains coma-lock regression cases (§9), covering the `ItemCard` change documented in [Step35 §8f](./Step35_ItemsResolution.md). | August 28, 2026 |

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
