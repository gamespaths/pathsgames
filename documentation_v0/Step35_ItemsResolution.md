# Step 35 — Items resolution: closing the UX gaps of the inventory engine

[Step 34](./Step34_InventoryAndResources.md) already built `use-item`, `drop-item`,
`applyStandaloneEffects` and the `list_items_effects` vocabulary; §7 of that same document
already covers the roadmap's Step 35 ("carried weight and movement"). What this step closes are
gaps found only by actually playing with the engine and actually authoring content against it:
the board's own handling of a used item, the admin form an author fills in to write a
`list_items_effects` row, the fact that an item's effects reached the client only in the
*answer* of `use-item` (§5), an author's way to keep one item's promise secret plus a card bug
that surfaced only once items actually started carrying that promise around (§6-§7), and —
v0.35.1, §8 below — the quantities every one of those actions actually moves, and the cap on
what a character may carry. The first two problems are frontend-only, exactly as their framing
below describes; the effects preview (§5) reaches into all three backends as one additive
field, `effects[]`, on a payload each of them already returns; the opt-out flag (§6) touches a
migration — one nullable `INTEGER` column, on all three backends, on the very table the preview
already reads; §8 (v0.35.1) touches a migration too, and — unlike every part before it — changes
engine behavior, not just presentation: an ADD can now be refused, a REMOVE now takes everything,
and a use/drop can now be a partial spend. The version bumps on all three (`pom.xml`,
`application.yml`, `config.py`, `pyproject.toml`, and the two footer components) that came with
parts one through three were plain number rolls with no behavior attached; v0.35.1 is not one of
those.

Five things follow from that framing:

- Two of the first three fixes are entirely in the frontends: react-game's own reaction to its
  own `use-item` call, and react-admin's own form for a table column the engine already reads.
  The effects preview reaches every backend, but stays a projection, not a new engine: it reads
  the very rows `InventoryService` (java) / `inventory_service.py` / `lambda/match/inventory.py`
  already load to apply an item's effects, and reports them before the row is spent instead of
  only after.
- All three problems from parts one and two share the same root cause — a feature was
  implemented against the contract, but not against how a person actually uses it, or actually
  plays it. `use-item` answering the execute-event payload (Step 34 §2) was correct; nobody had
  yet clicked "use" on an item while the backpack list covered the very page the answer wanted
  to narrate on. `list_items_effects.id_card` existing in the schema since `V0.14.1` was correct;
  nobody had yet tried to author a row without falling back to a raw JSON import. And an item's
  effects living only on the `use-item` *answer* was correct by the Step 34 contract; nobody had
  yet tried to distinguish a healing potion from a poison without drinking it first.
- The opt-out flag (§6) is a genuine, colored design decision, not a bug fix: some stories want
  the "mysterious potion" the preview otherwise removes. It was left out of §5 on purpose and
  shipped once the shape of the preview itself had settled.
- The card bug (§7) is the same root cause one layer further in: once `effects[]` started
  riding on inventory rows, the board's own "item just received" card turned out to have never
  been reading that row in the first place — it was reading the *event's* stat changes instead,
  a mismatch nobody could see until an item had its own promise to show.
- The quantities (§8, v0.35.1) are the one part of this step that is not UX polish. Every
  quantity an item action moved was hardcoded before it — one unit added, one removed, the whole
  row spent or dropped — and an author had no way to say "at most one map" or "half this potion
  heals nobody". §8 gives three columns back to `list_items` and, as a direct consequence,
  changes what a REMOVE and a partial use/drop actually do to a character's bag.

---

## 1. react-game — using an item now closes the backpack

`GameBook.jsx` renders the backpack (`ItemsCards`, [Step 34](./Step34_InventoryAndResources.md#8-other-backends-and-frontends))
on the book's **right** page. `use-item`'s answer narrates on that very page — the effect card,
or an edge state — because it is the same payload `execute-event` returns (Step 34 §2). Before
this step, the board handed a `use-item` result straight to `handleEventExecuted`, the same
function an event uses, and left the bag open on top of it: the narrative rendered underneath a
list the player was still looking at.

New handler:

```javascript
// Step 35 — using an item closes the bag. The row is consumed, so the list the player
// came from no longer holds what they clicked; what matters now is the effect it applied,
// and that narrates on the RIGHT page — the very page the item list was covering.
// Closing before handing over to handleEventExecuted also means an edge state (coma,
// sadness overflow) takes the LEFT page instead of fighting the open bag for it.
function handleItemUsed(result) {
  setItemsView(false)
  setStatisticsCards(false)
  handleEventExecuted(result, result?.card ?? null)
}
```

`<ItemsCards>`'s `onDone` prop, previously `handleEventExecuted` directly, is now
`handleItemUsed` (`code/frontend/react-game/src/features/gameplay/GameBook.jsx`). Two reasons
converge on "close first, then delegate":

- **The clicked row is gone.** `use-item` deletes the whole `gaming_inventory_items` row
  (Step 34 §2 — `amount` is never decremented), so the list the player used it from no longer
  contains what they clicked. Leaving it open shows a backpack the response has already made
  stale.
- **The narrative needs the right page.** `handleEventExecuted`'s effect card, and the item's
  own fallback card (§2 below), both render with `previewSide="right"` — the same page the bag
  occupies. Closing the bag before calling it is what makes the narrative visible at all.
- A third, smaller effect falls out of the same change: an edge state from Step 30 (coma,
  sadness overflow) renders on the **left** page. With the bag open it had to fight the backpack
  for the right page's attention; closing first gives it a clean left page instead.

**Dropping stays different, on purpose.** `handleItemDropped` is unchanged — it reloads and
leaves `itemsView` exactly as it is:

```javascript
// Step 34 — dropping applies nothing and narrates nothing: there is no effect card and
// no edge state to show, only an inventory and a carried weight that just changed.
// The bag stays open on purpose: dropping is a tidying gesture and usually comes in a
// run of several, so the list the player is working through must not vanish under them.
function handleItemDropped() {
  handleReloadClockWeatherAndMatchData()
}
```

`drop-item` narrates nothing (Step 34 §2) and is typically repeated — a player clearing weight
out of the backpack drops several items in a row — so closing it after every click would fight
the very gesture it is meant to support.

## 2. react-game — narrative fallback on the item's own card

`handleEventExecuted` gained a second, optional parameter:

```javascript
// `fallbackCard` — Step 35, the item path only: a use-item answer carries the ITEM's own
// card in `result.card`, and an author who wrote no per-effect card still deserves a
// narrative rather than a board that silently reloads. Left null for events on purpose:
// there `result.card` is the EVENT card, which the board already handled its own way.
function handleEventExecuted(result, fallbackCard = null) {
```

Before this step, the narrative card shown after any executed event or item usage came only
from `grantedCard` (an item the response granted) or `lastEffectCard(result)` (the last
`effects[]` entry that carries its own `card`, per Step 34 §2/§6). If **neither** existed — an
item whose author wrote no `idCard` on any of its `list_items_effects` rows — nothing narrated
at all: the board simply reloaded, silently, on a click the player expected to do something.

The fix reads the item's own card as a last resort, but only on the path that can supply one:

```javascript
const effectCard = grantedUuid ? null : (lastEffectCard(result) ?? fallbackCard)
const narrative = grantedCard ?? effectCard
// The fallback IS an item card (the one that was just used), so it is styled as one —
// only a real list_*_effects row reads as an effect.
const narrativeType = (grantedCard || (effectCard && effectCard === fallbackCard))
  ? 'item' : 'effect'
```

`handleItemUsed` (§1) is the only caller that passes a non-null `fallbackCard`, and it passes
`result?.card` — for a `use-item` answer that is the **item's own** card, the `standaloneCard`
`EventExecutionService.applyStandaloneEffects` (Step 34 §3) puts on the response, resolved in
the requested language exactly like every other card on the payload. When it is the fallback
that ends up on screen, `narrativeType` reads `'item'`, not `'effect'`, because it genuinely is
an item card — `handleSelectionPreviewFull` styles the two differently, and a fallback that
displayed as an "effect" card with no effect behind it would be its own small lie.

The event path is deliberately excluded. `executeEvent`'s callers never pass a second argument,
so `fallbackCard` stays `null` for every executed event: `result.card` on an event answer is the
**event's own** card, and the board already has its own established handling for that (Step 29),
unrelated to the item fallback. Widening the fallback to cover events as well would have changed
already-shipped Step 29 behavior for no reason connected to this step's problem.

Both behaviors are exercised in
`code/frontend/react-game/src/test/GameBookCoverage.test.jsx`: closing the bag on use, narrating
with the item's own card when no effect row carries one, confirming an executed event does
**not** fall back to its own card, and confirming a drop leaves the bag open.

## 3. react-admin — the Item Effects form was illegible

Three files changed, all under `code/frontend/react-admin/src/`:
`constants/story/storiesEntities.jsx`, `constants/story/storyFieldOptions.js`,
`pages/story/StoryEditorPage.jsx`.

### a. `idCard` — the narrative card, now a form field

```javascript
// v0.35.0 — the narrative card of THIS effect, exactly like event-effects.idCard: the
// engine resolves it per row (InventoryService.standaloneEffects) and the board shows
// the last effect that carries one. The column has existed since V0.14.1; until now
// the form did not offer it, so it could only be authored by importing a JSON story.
{ key: 'idCard', label: 'Card ID (narrative)', type: 'number' },
```

Added as the **first** field of the `item-effects` entity, before `idItem`. The column
`list_items_effects.id_card` has existed since `V0.14.1`, and the engine already reads it per
row — `InventoryService.standaloneEffects` (java), mirrored in python and AWS — feeding
`StandaloneEffect.idCard`, which `applyStandaloneEffects` resolves into the `card` each
`effects[]` entry carries (Step 34 §2/§3). The admin form simply never offered the field, so a
row authored through the UI could apply a stat but never narrate one; the only way to give an
item effect its own card was to import a story JSON that already set `idCard` directly. It gets
the same `cardsOptions` picker — and, through it, the same "New Fast Card" shortcut — as every
other `idCard` field in the story editor (`StoryEditorPage.jsx`):

```javascript
// v0.35.0 — the same three pickers event-effects has. An item effect speaks exactly
// the event-effect vocabulary (one narrative card, two CSVs of trait ids), so an
// author naming one has the same lists to choose from — typing bare ids was the only
// way until now.
idCard: {
  options: cardsOptions,
},
```

### b. `effectCode` — free text becomes a closed vocabulary

```javascript
// v0.35.0 — a select, not free text: an effect code outside this vocabulary is
// dropped in silence by the engine, so a typo used to author an effect that could
// never fire and said nothing about it.
{ key: 'effectCode', label: 'Effect Code', type: 'select', options: ITEM_EFFECT_CODE_OPTIONS },
```

`effectCode` was a plain `type: 'text'` field. `EffectStatCodec.normalize()` (java) /
`normalize_effect_code` (python, AWS) lowercases whatever it receives and, on anything outside
its known set, hands it straight to the engine's `default ->` branch, which discards that part
of the effect without raising an error (Step 34 §3). A typo in a free-text field therefore
produced a row that looked authored and never fired — no validator catches it, because an
unknown `effect_code` is, by design, authored noise rather than a referential-integrity failure.

The new constant, in `storyFieldOptions.js`:

```javascript
export const ITEM_EFFECT_CODE_OPTIONS = [
  ...mapOptions([
    'LIFE', 'ENERGY', 'SAD', 'EXP', 'DEX', 'INT', 'COS', 'FOOD', 'MAGIC', 'COIN',
  ]),
  { value: 'SADNESS', label: 'SADNESS (alias of SAD)' },
  { value: 'COINS', label: 'COINS (alias of COIN)' },
]
```

The first ten values are exactly `EffectStatCodec.KNOWN` (java) — the token set item usage and
event execution both act on. The two aliases are appended **last** and labelled as aliases
on purpose: `EffectStatCodec` still translates `SADNESS` → `sad` and `COINS` → `coin` on the
item path only (Step 34 §3), and rows authored before v0.34.0 — the seed data among them — hold
those older spellings. Dropping them from the option list would have made the select render
blank on a row that works perfectly well; keeping them, but visibly marked as aliases, lets an
author both keep old content readable and learn the canonical spelling for anything new.

### c. `traitsToAdd` / `traitsToRemove` — a picker instead of raw CSV

```javascript
traitsToAdd: {
  options: traitsOptions,
},
traitsToRemove: {
  options: traitsOptions,
},
```

Both fields were added to `item-effects` in v0.34.0 as plain CSV-of-ids text inputs — correct in
shape, but authored the same way as typing `effectCode` by hand: no list to choose from, no
guardrail against naming a trait id the story does not define (the very thing
[Step 34 §6](./Step34_InventoryAndResources.md#6-validation--step-22-extension)'s `R_TRAIT_REF`
rule now catches at validation time, but only after the fact). They now get `traitsOptions`, the
same picker `event-effects.traitsToAdd`/`traitsToRemove` already uses — an item effect speaks
exactly the event-effect vocabulary (Step 34 §4: same column names, same CSV-of-story-scoped-
`list_traits`-ids format), so an author naming one has the same list to pick from as an author
naming the other. `idItem` already had its `itemsOptions` picker from v0.34.0 and is unchanged.

### d. `effectValue` — a clearer label

`'Effect Value'` becomes `'Effect Value (signed delta)'`, matching the sign convention every
other effect-value field in the story editor already documents in its label: positive adds,
negative subtracts, `0` does nothing (§4 below).

All four changes are exercised in
`code/frontend/react-admin/src/tests/constants/storiesEntities.test.js`
(`describe('item-effects entity config (Step 35)', ...)`), which asserts the field list and that
`effectCode`'s `options` is the very `ITEM_EFFECT_CODE_OPTIONS` constant, not a copy.

## 4. Reference for story authors — how a `list_items_effects` row actually behaves

This section documents the engine's existing behavior; nothing here changed in v0.35.0 (parts
one through three). It exists because the react-admin gaps closed in that version (§3) were
themselves evidence that this information was not otherwise easy to find while authoring. The
"real order of operations" subsection below is the one exception: v0.35.1 (§8) changed *how much*
a use-item call spends, so its code excerpt reflects the current, post-v0.35.1 behavior rather
than a frozen v0.35.0 snapshot.

**One row, one effect.** Each row of `list_items_effects` is a single effect. An item with
several rows sharing the same `idItem` applies all of them, **in row order**, when that item is
used. The recipient is always and only the character who used the item — there is no target or
target-class column on this table, unlike `list_events_effects`/`list_choices_effects`. Handing
an item, or its effect, to another character is a multiplayer feature (steps 71-76) and
deliberately out of scope for this table.

**`traits_to_add` / `traits_to_remove`** are two more columns on this same row (added
v0.34.0, CSV-of-`list_traits`-ids, same format `list_events_effects` uses; picker in
react-admin since v0.35.0, §3c). They work regardless of `hide_on_start_match`
(v0.35.2, see [Step23 §5.3](./Step23_CharacterStatsInitialization.md#53-schema-change--list_traitshide_on_start_match-v0352)):
a trait an author has locked out of the start-match picker can still be handed over
by `traits_to_add` on an item's use, and it then joins the character's active traits
like any other. The dev seed exercises exactly this: the **Guide Scroll**'s item
effect (java `list_items_effects` id `90002`, AWS effect id `1`) grants the hidden
"Scroll-Touched" trait instead of the plain one it granted before v0.35.2.

**A granted trait now also moves stats (v0.35.2, bugfix).** Before this version,
`traits_to_add`/`traits_to_remove` here only wrote the trait row — the trait's own
`life`/`energy`/`sad`/`dexterity`/`intelligence`/`constitution`/`weight` deltas were
applied only once, at character creation, so an item that handed over a "+2 life"
trait left the life bar untouched. It now moves them the moment the trait lands (and
reverses them if the effect removes one). The formula and the reasoning are
Step 23's, not this table's — see
[Step23 §6.4](./Step23_CharacterStatsInitialization.md#64-trait-stat-deltas-apply-on-grant-not-only-at-creation-v0352).

**Preconditions live one table over, on `list_items`, not here.**

- `isConsumabile` (`is_consumabile` in the database) gates whether `use-item` will run these
  rows at all: `!= 1` fails the whole call with `ITEM_NOT_CONSUMABLE` before any effect is
  looked at. A non-consumable item can still be carried, weighed, and satisfy an item condition
  on an event or choice — it simply cannot be used.
- `idClassPermitted` / `idClassProhibited` gate which character classes may use the item at all;
  `0` or `null` on either means "no restriction". Failing this gate raises
  `ITEM_CLASS_NOT_PERMITTED` / `ITEM_CLASS_PROHIBITED` before any row is applied.
- `drop-item` checks **neither** gate (Step 34 §2): a non-consumable, class-restricted item must
  still be droppable by whoever is carrying it.

A fourth `list_items` column, `flagShowEffects` (v0.35.0, §6 below), sits next to these but is
**not** a precondition: it never stops `use-item` from running, and it never stops an effect
from applying. It only decides whether the preview (§5) reports this item's promise before it is
used.

**Per-token behavior**, keyed by the (case-insensitive) `effect_code`:

| Token(s) | Effect |
|---|---|
| `life`, `energy` | Clamped to the character's own max — an effect cannot push either stat above its cap or below zero. |
| `sad` (alias `sadness`) | Applied through `Live.setSad` / `_Live.set_sad`, the same door every sadness change goes through — it can trip the [Step 30](./Step30_EdgeStates.md) sadness-overflow rule, and from there a coma, exactly as an event's `SAD` effect would. |
| `exp`, `dex`, `int`, `cos` | Adjusted by the signed value, never allowed below zero. |
| `food`, `magic`, `coin` (alias `coins`) | Land on the **backpack** (`gaming_backpack_resources`), not on the character's own stat row — these three are resources the party carries, not attributes of the character. |

**The value is signed, and `0` genuinely means nothing.** `effectValue` (`effect_value`) adds
when positive and subtracts when negative; a row with `0` is a no-op the engine still processes
without error — useful only as an inert placeholder, never as a way to express "no effect" more
cheaply than deleting the row.

**An unknown `effect_code` is silently dropped.** Outside the ten known tokens and the two
aliases (§3b), `EffectStatCodec.normalize()`/`normalize_effect_code` still lowercases and
returns *something*, but the engine's `default ->` branch does not recognize it and skips just
that part of the effect — the item is still consumed, the other rows on it still apply, and no
error surfaces anywhere. This is why §3b turned the field into a closed `select`: there was
previously no way for the admin UI itself to catch this class of mistake.

**Real order of operations, `use-item`:** the units are spent — the row updated or, if nothing
is left, deleted — **before** the effects run, not after (`InventoryService.useItem`, java —
mirrored in python and AWS). Current as of v0.35.1, which changed this from an unconditional
delete to a charge of `amount_use` units (§8a):

```java
int spend = unitAmountOfAction(item.getAmountUse());          // NULL/≤0 reads as 1
int held = ItemInstanceMapper.unitAmount(row.getAmount());
if (held < spend) {
    throw fail(InventoryException.Code.ITEM_NOT_ENOUGH, ...);  // refused before anything spends
}
List<StandaloneEffect> effects = standaloneEffects(c, item);

// The units go first: an item whose effects grant the same item back cannot pay for
// itself, and what was spent stays spent even if the effect chain ends in a coma.
int left = held - spend;
if (left > 0) {
    store.updateInventoryAmount(c.match.id(), row.getId(), left);
} else {
    store.deleteInventoryRow(c.match.id(), row.getId());
}

EventExecutionResult result =
        effectEngine.applyStandaloneEffects(c.match.id(), c.actor.id(), effects, card,
                lang, true);
store.logItemUsage(c.match.id(), c.actor.id(), item.getId(), spend, toEffectsJson(result));
```

Two consequences an author should keep in mind, unchanged in spirit since v0.34.0 even though
the mechanics changed: an item that (indirectly, through an event or choice chain) grants the
same item back cannot be spent twice by the same call, because the units that would have been
"reused" are already charged before any effect runs; and the spend is not undone even when the
effect chain ends the character's turn in a coma — a used item stays used regardless of how its
own effects turn out. What changed in v0.35.1 is only the *granularity*: before it, "spent" and
"row gone" were the same event; now a row with more than one unit can survive a use with fewer
units left in it, and the response's `itemRemoved` flag stays `true` either way (§8a) — it
reports that the action happened, not that the row is now empty.

## 5. Effects preview before use

Until this version, an item's effects reached the client only in the *answer* of `use-item` —
that is, once the `gaming_inventory_items` row was already deleted (Step 34 §2). The inventory
listing and the `items[]` a player's own character carries on `/info` reported a weight, an
amount, a card, a consumable flag — never what using the thing would actually do. A player
picking between two unlabelled potions had no way to know before drinking one.

### Contract — additive, no breaking change

Every row of `items[]` now carries `effects: [{statistic, value}]`, on **both**
`GET /api/gameplay/{uuidMatch}/inventory` and the `items[]` of each player's own character on
`GET /api/game/{uuidMatch}/info` (Step 34 §5) — it is the same shared mapper serving both
endpoints, so the two arrays can never diverge.

- `statistic` arrives already normalised by `EffectStatCodec`/`normalize_effect_code`: the
  client sees `sad`, never `SADNESS` (Step 34 §3b).
- `value` is the delta **the author wrote, before the engine's clamp** — the same reading
  `effectStatItems` already gives an applied `AppliedEffect` (Step 34 §2). A `-10` life effect
  on a character with 3 points left promises `-10` and, once used, delivers `-3`: the preview is
  the effect as authored, which is the only thing a promise can honestly show before the
  character it will act on is known to have that much left.
- The array is **always present**: `[]` for an item that carries no effect, and `[]` on the
  masked `items[]` of every other player — masking already empties the array itself (Step 34
  §5), so there is nothing extra to hide here.
- A row whose `effect_code` falls outside the engine's known vocabulary is **omitted**, not
  shown with a null or a placeholder: `applyStat`/`apply_stat` would silently drop that same row
  when the item is actually used, so promising an effect nothing applies would be a promise the
  engine itself breaks.
- **Deliberately out of scope**: the trait CSVs (`traits_to_add`/`traits_to_remove`) — showing
  them would need a second lookup to resolve ids into localised trait names, which this preview
  does not do — and the effect's own narrative card, which is the story of what *happened* and
  belongs on the `use-item` answer, not on a promise of what might.

Spec updated:
[`v0.34.0-inventory-resources-api.yaml`](../code/backend/java/adapter-rest/src/main/resources/openapi/v0.34.0-inventory-resources-api.yaml) —
new schema `ItemEffectPreview` (`statistic`, `value`) and a new `effects` array on
`ItemInstance`, both documented as v0.35.0. The `effects` array already on the `use-item`
answer's execute-event shape is untouched and unrelated — that one is a **result**
(`AppliedEffect`-shaped, keyed differently), this one is a **promise**.

### Java

- New model `core/model/match/ItemEffectPreview.java` — just `statistic`/`value`, deliberately
  narrow (see the contract above).
- `ItemInstanceInfo` gains an `effects` field.
- `ItemInstanceMapper` gains a second `build(...)` overload taking a
  `Map<Long, List<ItemEffectEntity>> effectsByItem`; the original overload still exists and
  delegates to the new one with `null`, so every pre-existing caller keeps returning `[]`
  unchanged. Two new private/static helpers: `previewEffects(effectsByItem, itemId)` — builds
  the list, dropping unknown codes — and `groupEffectsByItem(rows)` — groups a story's
  `list_items_effects` rows by `id_item`, in id order, the same order
  `InventoryStoreAdapter.findItemEffectsByItemId` already groups them in for the usage path, so
  the promise and the applied effects list in the same order.
- `InventoryService`'s per-request `Ctx` now caches the grouped rows behind a lazy
  `effectsByItem()` accessor, backed by `store.findItemEffectsByItemId(idStory)`. That one query
  now feeds **both** the preview (`mapItems`) and `standaloneEffects` (the actual application on
  `use-item`) — before this step, `findItemEffectsByItemId` was queried fresh on every call site
  that needed it; now it runs once per request no matter how many places read it.
- `CharacterMapper` groups a story's effect rows once, with
  `storyReadPort.findItemEffectsByStoryId(storyId)` fed through `ItemInstanceMapper
  .groupEffectsByItem`, and passes the same map into `ItemInstanceMapper.build(...)` for every
  player mapped on `/info` — one query per match, not one per player (no N+1).
- REST DTOs: new `ItemEffectPreviewResponse` (`statistic`, `value`, with a null-safe
  `fromModels` that turns a null list into `[]`) and a new `effects` field on
  `ItemInstanceResponse`.

### Python

- New dataclass `ItemEffectPreview` in `app/core/models/match/match_models.py`, and an `effects`
  field on `ItemInstanceInfo`.
- New shared function `preview_effects(rows)` in
  `app/core/services/match/inventory_service.py`, filtered against the module's
  `_KNOWN_EFFECT_CODES` set — used by both the listing path and `character_query_service
  .build_character_infos` (via `character_query_service.py`'s own import of the same function),
  so the two callers can never read the vocabulary differently.
- New port method `find_item_effects_by_item_id(story_id)` on `StoryMatchReadPort`
  (`app/core/ports/match/match_ports.py`), implemented in
  `app/adapters/persistence/match/story_match_read_adapter.py` — one query per story, grouped in
  memory, rows whose `id_item` matches nothing simply not grouped anywhere (no orphan bucket).
  A second implementation of the same method name already existed on `InventoryStorePort`
  (`app/core/ports/match/inventory_ports.py`, backing `inventory_store_adapter.py`) for the
  usage path from Step 34; this is the read-side sibling `character_query_service` calls when
  building `/info`.
- `inventory_controller.py`'s `item_to_camel` projects the new field:
  `"effects": [{"statistic": e.statistic, "value": e.value} for e in (i.effects or [])]`.

### AWS

- New `preview_effects(story, item)` in `lambda/match/inventory.py`, built directly on top of
  `standalone_effects(story, item)` — the very rows `use-item` already applies — filtered
  against the same `_KNOWN_EFFECT_CODES` set the codec functions use, so the promise can never
  name a code the usage path would ignore.
- `_item_rows(char, story, raw_cards, raw_texts, lang)` in `lambda/match/handler.py` now calls
  `_inventory.preview_effects(story, item)` per row instead of hardcoding `"effects": []`.
  `_item_rows` already backs both `GET /api/gameplay/{uuid}/inventory` and the caller's own
  `items[]` on `GET /api/game/{uuid}/info` (Step 34 §8), so both report the preview from the one
  change.

### react-game

`ItemCard.jsx` reads `item.effects` through `effectStatItems` — the same helper from
`utils/statBadges.js` that already turns an *applied* `AppliedEffect` into a stat badge — and
appends the resulting badges to `descriptionBadges`, after the weight and quantity badges
already there. The read is gated on `usable` (the item's own `isConsumabile`/class checks): a
non-consumable item can never fire its own effects, so previewing them there would promise
something the engine would refuse before it ever applied a stat.

### Design note — the author's opt-out

Showing the numbers up front removes the "mysterious potion" a story might want to keep
mysterious. §6 below is that opt-out: `list_items.flag_show_effects`, a migration on all three
backends, shipped as part three of this same step once the shape of the preview itself had
settled. Everything above this note describes the preview exactly as it behaves for the common
case, `flag_show_effects` unset or `1`; §6 is what changes when an author sets it to `0`.

## 6. Author opt-out: `flagShowEffects`

§5 always shows the preview for a usable item. This section is what a story author reaches for
when that is the wrong default for one specific item — the unlabelled bottle found in the dark,
whose whole point is that nobody knows what it does until they drink it.

### a. The column and its semantics

New nullable column `list_items.flag_show_effects` (`INTEGER`, `DEFAULT 1`), added by
`V0.35.0__add_item_flag_show_effects.sql` on both dialects
(`code/backend/java/adapter-sqlite/src/main/resources/db/migration/v0/` and the postgres
sibling under `adapter-postgres/`; postgres also adds a `COMMENT ON COLUMN`). Reading:

- `1` or `NULL` — the preview reports `effects[]` as §5 describes (the default).
- `0` — the item keeps its secret: `effects[]` comes back **empty**, on both
  `GET .../inventory` and `/info`.

**`NULL` reads as "shown" on purpose.** The column lands on stories authored before it existed,
and those stories already ship the preview from the moment §5 went live; a "hidden" default
would have silently taken the feature away from every one of them the day this migration ran.
`0` is therefore always an authored decision, never an absence of one — the exact same reading
`list_items` already gives `id_class_permitted`/`id_class_prohibited` (§4: `0`/`NULL` = no
restriction).

**The flag gates the promise, never the effect.** `useItem`/`use_item` does not consult it at
all: a "secret" item applies exactly the same `list_items_effects` rows a "shown" one would.
Hiding the numbers must never become a way to author an item that *behaves* differently, or the
preview and the applied effect would be two truths about the same row. It follows that an empty
`effects[]` never means "this item does nothing" — it may just mean the author chose not to say.

### b. Implementation

- **Java**: `flagShowEffects` field on `core/entity/story/ItemEntity.java`. `ItemInstanceMapper
  .showsEffects(item)` gates whether `previewEffects` (§5) populates `effects[]` at all —
  `null`/`1` shows, `0` returns `[]` without inspecting the rows. `StoryImportService` reads
  `flagShowEffects` off the story JSON (absent → `null` → shown). `StoryCrudService` exposes it
  both ways: read in the entity-to-map projection (alongside every other item field), written by
  `applyItemFields` guarded the same `containsKey` way every other optional field is.
- **Python**: `flag_show_effects` column on `ItemEntity`
  (`app/adapters/persistence/story/models.py`). Shared `shows_effects(item)` in
  `app/core/services/match/inventory_service.py`, gating `preview_effects` (§5) — used by both
  the inventory listing and `character_query_service.build_character_infos` (`/info`), imported
  by `character_query_service.py` rather than reimplemented, so the two callers can never read
  the flag differently. `story_persistence_adapter.save_items` writes it on import;
  `story_match_read_adapter.find_items_by_story_id` (the `/info` read path) and
  `inventory_store_adapter.find_items_by_id` (the inventory read path) both project the column.
  The admin CRUD is generic camel↔snake, so the field needed no controller change.
- **AWS**: `shows_effects(item)` in `lambda/match/inventory.py`, called at the top of
  `preview_effects` before any row is filtered — the same gate-then-project shape as java and
  python.
- **react-admin**: new field
  `{ key: 'flagShowEffects', label: 'Show Effects In Preview', type: 'checkbox' }` in
  `constants/story/storiesEntities.jsx`, placed immediately after `isConsumabile`.
  `getNewEntityDefaults('items')` (`pages/story/StoryEditorPageHelpers.jsx`) now returns
  `{ flagShowEffects: 1 }` — without that default an untouched checkbox on a freshly created
  item would be sent as an explicit `false`, and every item authored through the form would be
  born secret.
- **react-game**: no change for the flag itself — the gate is entirely server-side; a secret
  item's row simply arrives with `effects: []`, and `ItemCard.jsx` (§5) already renders no badge
  for an empty array.
- **OpenAPI** (`v0.34.0-inventory-resources-api.yaml`): the `effects` field description on
  `ItemInstance` now states that `flag_show_effects = 0` answers `[]` here even though the item
  still has effect rows, and that an empty array must never be read as "this item does nothing".

### c. Bug found and fixed along the way: booleans through `StoryCrudService.intVal`

While wiring `flagShowEffects` into `StoryCrudService.applyItemFields`, `intVal` turned out to
return `null` for a JSON boolean. The admin sends **every checkbox** as a JSON `true`/`false`,
and every flag column in the schema is an `INTEGER` — so `isSafe`, `isConsumabile`, and the new
`flagShowEffects` were all being **silently dropped** on write, not just this new field. The fix
adds a `Boolean` branch (`true → 1`, `false → 0`) ahead of the existing numeric-string parsing.
The test that pinned the old behavior,
`acceptsNumericStringsAndRejectsEverythingElseAsNull` in
`code/backend/java/core/src/test/java/games/paths/core/service/story/StoryCrudServiceFieldMappingTest.java`,
is unchanged — it still covers numeric strings and unparsable text — and is joined by a new
`acceptsABooleanForAFlagColumn`, asserting `isSafe: true`/`false` round-trip to `1`/`0`.

### d. Seed data, all four backends

The **Lead Ingot** (`id 90006` in the java seeds' `list_items` numbering, `id: 4` in
python/AWS) becomes the mysterious item: `flagShowEffects = 0`, while still applying `LIFE +1`
when used — exactly the pair §a's "gates the promise, never the effect" needs to test against.
The **Guide Scroll** leaves the field unset, so every seed also exercises the `NULL` → "shown"
reading. Files: the two dev seed SQL scripts
(`code/backend/java/adapter-sqlite/src/main/resources/db/migration/*/R__insert_story_seed_data.sql`,
`code/backend/java/adapter-postgres/src/main/resources/db/migration/*/R__insert_dev_test_data.sql`),
`code/backend/python/scripts/seed_stories.py`, `code/backend/aws/lambda/seed/handler.py`.

The python backend creates its tables with `Base.metadata.create_all` and the robot seed script
deletes `database.sqlite` before reseeding, so that path never needed a migration of its own —
consistent with how the project already handles a dev-only SQLite store.

## 7. The received item's own card (react-game)

A card bug, surfaced by §5/§6 rather than caused by them: before this step, when an event
handed a player an item, the card shown for it carried the **event's** `statChanges` (the
experience just earned), never the item's own promise — because `itemCardForUuid` extracted only
`row.card` off the matched inventory row and discarded the rest.

`code/frontend/react-game/src/features/gameplay/GameBook.jsx` now exposes the whole row, not
just its card:

```javascript
/** The carried inventory ROW, looked up by its STORY uuid. Step 35: the card alone is not
 *  enough any more — the row also carries the effects[] promise the board wants to show. */
export function itemRowForUuid(items, itemUuid) {
  if (!itemUuid) return null
  return (items ?? []).find(i => i?.itemUuid === itemUuid && i?.card) ?? null
}

/** The resolved card of a carried item, looked up by its STORY uuid. */
export function itemCardForUuid(items, itemUuid) {
  return itemRowForUuid(items, itemUuid)?.card ?? null
}
```

`itemCardForUuid`'s signature and behavior are unchanged — it now simply sits on top of
`itemRowForUuid` — so every existing caller keeps working. `handleEventExecuted` uses the new
function directly and switches its badge source on whether the narrative is a granted item:

```javascript
// Step 35 — the card of an item just RECEIVED carries the item's own promise, not the
// statChanges of the event that handed it over: the badges under a card have to be
// about the thing on it. What the event did to the player is already told by the effect
// card, and mixing "+2 exp you just earned" with "+3 life if you drink this" under one
// picture makes both unreadable. An item whose story hides its effects (flagShowEffects
// = 0) promises nothing, so the card simply carries no badge — as it should.
const stats = grantedCard
  ? effectStatItems(grantedRow?.effects, null, t)
  : statChangeItems(result, playerUuid, t)
```

The same swap applies in the `getInventory` fallback branch a few lines further down, for the
case where the granted row is brand new and not yet in `playerStats` — the freshly fetched row's
`effects` feed `effectStatItems` there too, so a just-created item is badged exactly like one
already carried. A secret item (§6) simply carries no badge at all: `effects` arrives empty,
`effectStatItems` has nothing to turn into a badge, and that silence is correct — it is the same
"the promise is withheld" behavior §6 describes, one layer further down the UI.

Both new cases are exercised in `GameBookCoverage.test.jsx`:
`'a received item is badged with its OWN promise, not with the event stat changes'` and
`'an item whose story hides its effects is received with no badge at all'`, alongside the
pre-existing `'fetches the inventory when the granted item is brand new'` case, now also
asserting the fetched row's badges.

## 8. Quantities and the per-character cap (v0.35.1)

Until this version every quantity an item action moved was hardcoded: an event ADD granted
exactly one unit, an event REMOVE took exactly one, and `use-item`/`drop-item` discarded the
**whole row** whatever it held (§2 above, and [Step 34 §2](./Step34_InventoryAndResources.md#2-use-item-answers-execute-event),
now both superseded — see the note at the end of this section). This part gives those numbers
back to the story author, on three new nullable columns on `list_items`, and closes a related
gap the first three parts never touched: nothing enforced that a character held at most one
`gaming_inventory_items` row per item.

### a. Three new columns on `list_items`

Migration `V0.35.1__item_amounts_and_unique_inventory_row.sql`, both java dialects
(`code/backend/java/adapter-sqlite/src/main/resources/db/migration/v0/` and the postgres
sibling under `adapter-postgres/`; postgres also adds a `COMMENT ON COLUMN` per column).

| Column | Governs | `NULL`/absent | `0` or negative |
|---|---|---|---|
| `max_per_character` | How many units of this item one character may hold | No limit (same reading `id_class_permitted`/`id_class_prohibited` already give `0`/`NULL`) | No limit |
| `amount_drop` | Units removed by **one** `drop-item` | Reads as `1` | Reads as `1` |
| `amount_use` | Units consumed by **one** `use-item` | Reads as `1` | Reads as `1` |

- **`max_per_character`.** An event ADD that would cross it is **refused without an error**:
  the event keeps running, every one of its other effects still applies, and the response
  carries an `itemChanges` entry with `action: "NOT_ADDED"` for that one item. Written for
  "one map, ever" and "at most two apples".
- **`amount_drop`.** Owning fewer units than the column asks is **not** a refusal: the drop
  takes what is there and `amountDropped` on the response reports that number — a player
  putting something down can always put down everything they hold.
- **`amount_use`.** Owning fewer units than the column asks **is** a refusal, new code
  `ITEM_NOT_ENOUGH` (409, `use-item` only): half a potion heals nobody, and letting the effect
  fire on a partial dose would be a lie about what the player actually did.
- **There is no `amount_add`.** An event ADD is always exactly one unit, on purpose: an event
  that must hand over three of something writes three effect rows, and `max_per_character`
  then applies to each of them in turn rather than to a lump the engine would have to split.
- **A negative or zero `amount_drop`/`amount_use` still reads as `1`**, not as "nothing moves":
  an action that moves zero units would be a free action repeatable forever, and the schema
  accepting the value is not the engine agreeing to honor it literally.

**The event REMOVE now takes every unit the character holds, not one.** This is a behavior
change, not just a new column: "the story takes it away from you" always meant the whole thing,
and the old one-unit REMOVE also carried a latent bug — the engine dropped the item from its
`ownedItemIds`/`owned_item_ids` set on any REMOVE, even one that left units behind, so a later
condition in the same execution could read "not owned" while the bag still held two.
v0.35.1 fixes both at once: REMOVE now empties the row, and the owned-items set is only ever
cleared when the row is actually gone.

### b. One row per (character, item)

The engine has always stacked an ADD onto the row a character already has, but nothing in the
schema enforced it, and a quantity spread across two rows would make `max_per_character` and
`amount_drop`/`amount_use` lie about what is actually held. The migration:

1. sums every duplicate group of `gaming_inventory_items` rows (same `id_match`,
   `id_character_match`, `id_item`) onto the row with the **lowest `id`** — the oldest one,
   the one another table is most likely to reference;
2. deletes the rest of each group;
3. creates `CREATE UNIQUE INDEX uq_inventory_char_item ON gaming_inventory_items (id_match,
   id_character_match, id_item)`, so no code path can write a second one again.

The same merge is replicated **in code**, in all three backends' `addItem`/`add_item` (java
`EventExecutionStoreAdapter.addItem`, python `event_store_adapter.add_item`, AWS
`events.apply_item`), for a database written by a build older than this migration. A comment in
the AWS adapter that used to read *"a character can hold two rows of the same item"* has been
corrected — it is no longer true on any backend.

### c. Implementation, by backend

- **Java**: three fields on `ItemEntity` (`maxPerCharacter`, `amountDrop`, `amountUse`), read
  and written by the story import/CRUD paths like every other item column.
  `EventExecutionStorePort.addItem` gains a fourth parameter,
  `boolean addItem(long idMatch, long idCharacter, long idItem, Integer maxPerCharacter)`, and
  folds pre-existing duplicate rows before applying the cap; `removeItem` now deletes the row
  outright. New `findItemMaxPerCharacterById(idStory)`, cached per request inside
  `EventExecutionService.Exec`. `EventExecutionService.applyItem` reports `NOT_ADDED` and leaves
  `ownedItemIds` untouched when an ADD is refused (§a). `InventoryService.useItem`/`dropItem`
  spend units rather than deleting unconditionally: a new `updateInventoryAmount` on
  `InventoryStorePort` writes the row that survives, and `deleteInventoryRow` fires only when
  nothing is left. `logItemUsage` now takes the spent `counter` — the column already existed on
  `log_item_usage` and always wrote `1`, silently wrong since the table existed. New
  `InventoryException.Code.ITEM_NOT_ENOUGH`, mapped to 409 in `InventoryController`.
- **Python**: the same three columns on `ItemEntity`
  (`app/adapters/persistence/story/models.py`); `event_store_adapter.add_item`/`remove_item`
  mirror the java merge-then-cap and full-removal logic, plus new
  `find_item_max_per_character_by_id(story_id)`; `event_service._apply_item` reports the
  `NOT_ADDED` constant the same way. `inventory_service.py` gains the shared helper
  `action_amount(authored)` (an authored `None`/`≤0` reads as `1`), `update_inventory_amount` on
  the store port and adapter, and passes the spent `counter` into `log_item_usage`. New
  `InventoryError.ITEM_NOT_ENOUGH`, mapped to 409 in `inventory_controller.py`.
- **AWS**: `lambda/match/inventory.py` gains `action_amount` (same reading as python) and
  `spend_units` — removes N units from a row, deleting it only when nothing is left — plus a
  `counter` parameter on `log_item_usage`. `lambda/match/events.py`'s `apply_item` takes a
  `max_per_character` argument, reports `NOT_ADDED`, empties the row on REMOVE, and folds
  duplicate rows before applying the cap. `lambda/match/handler.py` adds the `_item_cap(story,
  effect)` helper (passed at all three call sites that apply an item effect), spends units on
  use/drop instead of always clearing the row, and adds `ITEM_NOT_ENOUGH` to
  `_ITEM_REFUSAL_MESSAGES`.
- **Special case, the same on all three backends**: a `gaming_inventory_items` row whose story
  item no longer exists in `list_items` (possible after a re-import) is still dropped **in one
  gesture**, taking every unit regardless of `amount_drop` — there is no author left to say how
  many units such a drop takes, and [Step 34](./Step34_InventoryAndResources.md) already kept
  such a row droppable specifically so it cannot weigh the character down forever. That
  behavior is unchanged by this step; it now simply also applies when the row holds more than
  one unit.
- **react-admin**: three new numeric fields on the `items` entity form
  (`src/constants/story/storiesEntities.jsx`) — `Max Per Character (0/empty = no limit)`,
  `Units Removed By Drop (empty = 1)`, `Units Consumed By Use (empty = 1)` — labelled with
  their empty-value reading so an author does not have to guess it.
- **react-game**: no change *at the time these columns landed*. `handleItemUsed` already
  returns to the board after any `use-item` call, partial spend included — that behavior shipped
  in this same version (§1) — and the `NOT_ADDED` refusal already travels on the response payload
  but is not surfaced in the UI: the item card an event grants renders the same whether the grant
  landed or was refused at the cap. That held only until the three columns themselves reached the
  `items[]` payload; see §f below for what changed once they did.

### d. Seed data, all four backends

- **Scholar's Tonic** (java `id 90005`, python/AWS `id: 3`) is capped at **`max_per_character =
  1`**: the event that hands it over is `NORMAL` and free, so running it twice is exactly how
  the suite (§e) makes the refusal observable.
- **Guide Scroll** (java `id 90003`, python/AWS `id: 2`) gets `amount_drop = 2`.
- Every other seed item leaves all three columns unset — the same `NULL` = "no limit / one
  unit" reading every pre-0.35.1 story already had.

Files: the two dev seed SQL scripts
(`code/backend/java/adapter-sqlite/src/main/resources/db/migration/dev/R__insert_story_seed_data.sql`,
`code/backend/java/adapter-postgres/src/main/resources/db/migration/dev/R__insert_dev_test_data.sql`),
`code/backend/python/scripts/seed_stories.py`, `code/backend/aws/lambda/seed/handler.py`.

### e. Robot — new suite

`code/tests/robot/tests/34_inventory/item_quantities.robot` (5 tests, backend-agnostic): fills
the bag **twice** — every granting event at the start location is repeatable — and reads what
the second round answered. Covers: a second grant stacking onto the row a character already has
rather than opening a second one; a capped item coming back as `NOT_ADDED` while the same event
run still hands over everything else it grants (the refusal must not fail the event); the held
amount not growing past the cap; `use-item` spending exactly one unit by default and leaving the
rest; and `amountDropped` reporting exactly what a `drop-item` call actually put down. The capped
item and the multi-unit drop are found by **behavior**, not by a seeded id, so the suite runs
unchanged against java-sqlite, java-postgres, python and AWS. Cataloged in
`.claude/docs/robot-suites.md` under the `34_inventory` breakdown, alongside `effects_preview.robot`.

**Superseded by this section**: [Step 34 §2](./Step34_InventoryAndResources.md#2-use-item-answers-execute-event)'s
"using consumes the whole row" and "a character may hold two rows of the same item" — both were
accurate through v0.35.0 and are corrected in that document as of this version; the reference
here is the current behavior.

### f. The quantities travel to the payload, and react-game reads them (v0.35.1, continued)

§a shipped the three columns as gates the engine enforces; they never reached `items[]` itself,
so the board could neither write how many units are left before a cap nor know in advance that
a use would be refused — it pressed the button and caught `ITEM_NOT_ENOUGH` after the fact. This
increment closes that gap. No new migration, no new endpoint, no breaking change: it is a
projection of columns the story already has onto a payload that already exists.

**Contract.** Every row of `items[]` now also carries `maxPerCharacter`, `amountDrop`,
`amountUse` — on both `GET /api/gameplay/{uuid}/inventory` and the `items[]` of each player on
`GET /api/game/{uuid}/info`, the same shared mapper in every backend so the two cannot diverge.
The values travel **as authored, `null` included**: the backend does not invent a default. It is
the client that reads `null`/`0` as "no cap" and `null` as "one unit", exactly the reading the
engine itself uses. Substituting a `1` for a `null` server-side would hide from the board whether
the story ever said anything about a limit. And they are **reported, not applied** — the gates
stay server-side, the cap is enforced on the ADD (§a) and `ITEM_NOT_ENOUGH` is still decided by
`use-item`; what the client does with the numbers only spares the player a click the engine would
have refused anyway.

- **Java**: `ItemInstanceInfo` (`core/model/match/`) gains `maxPerCharacter`/`amountDrop`/
  `amountUse`; `ItemInstanceMapper.build(...)` copies them straight off the `ItemEntity` it
  already has in hand; `ItemInstanceResponse` (`adapter-rest/.../dto/`) projects the three fields
  alongside `fromModel`.
- **Python**: the `ItemInstanceInfo` dataclass (`app/core/models/match/match_models.py`) gains the
  three optional fields; `inventory_service._map_items` and `character_query_service
  .build_character_infos` both set them off the story item (the same two call sites that already
  set `effects`); `inventory_controller.item_to_camel` projects `maxPerCharacter`/`amountDrop`/
  `amountUse` into the JSON row.
- **AWS**: `lambda/match/handler.py`'s `_item_rows` sets the three keys off the resolved story
  item, and explicitly to `None` on the branch where the row's story item no longer exists — the
  same branch that already answers `effects: []` and a null `card` for a re-import-orphaned row.
- **OpenAPI**: `v0.34.0-inventory-resources-api.yaml`'s `ItemInstance` schema documents the three
  new nullable properties.

**react-game.** Two new helpers in `src/utils/statBadges.js`:

- `itemCap(item)` — `0` and `null` both read as "no cap" (`null` return); a positive
  `maxPerCharacter` returns as-is.
- `unitsPerUse(item)` — `null`, `0` or a negative `amountUse` all read as `1`, the same reading
  the engine's `action_amount` uses: the board must never promise a cheaper action than the
  server will honor.

`itemCarryBadges` now writes the amount badge as **`2/3`** when the item has a cap — shown even
at `1/1`, because "one, and that is all you will ever get" is news worth a badge, unlike an
uncapped single unit which still earns none. Without a cap the badge stays `x2`, prefixed;
the `x` is the quantity symbol and belongs only to the uncapped reading — `x2/3` does not parse.
`itemDescriptionBadges` appends a new **`perUse`** badge with the units one usage spends, but
only when that is more than one and only in the card DESCRIPTION, never on the card face (which
carries no labels — a bare "2" beside the weight would say nothing). One unit per use is what
every item did before v0.35.1, so showing it there would be noise.

`ItemCard.jsx`: `usable` is now `isConsumabile && enough`, where `enough = item.amount >=
unitsPerUse(item)` — the use button locks when the bag holds fewer units than one usage would
spend. Two distinct lock reasons: `ITEM_NOT_CONSUMABLE` (unchanged, for an item that can only be
carried) and the new `ITEM_NOT_ENOUGH` (carried but short of units). The short card-face reason
comes from the `game.item.reason.*` i18n keys; the long preview sentence (`game.item.reasonFull
.*`) has the current/needed figures — e.g. `(1/2)` — appended by the component itself, since the
i18n helper takes a key and cannot interpolate. New i18n keys, both `en.json` and `it.json`:
`game.item.perUse`, `game.item.reason.ITEM_NOT_ENOUGH`, `game.item.reasonFull.ITEM_NOT_ENOUGH`.

The `effects[]` promise (§5) stays keyed on `isConsumabile` alone, unaffected by this increment:
an item you cannot currently afford to use still says what using it would do.

## 9. Test coverage

- react-game: six new cases in `GameBookCoverage.test.jsx` — the four part-one cases (closing
  the bag and returning to the board on use, narrating with the item's own card when no effect
  row carries one, confirming an executed event does not pick up the same fallback, and
  confirming a drop leaves the bag open), plus two part-three cases:
  `'a received item is badged with its OWN promise, not with the event stat changes'` and
  `'an item whose story hides its effects is received with no badge at all'`; the pre-existing
  `'fetches the inventory when the granted item is brand new'` case now also asserts the fetched
  row's badges. Full suite: 832 tests passing.
- react-admin: field-list assertions for `item-effects` in
  `src/tests/constants/storiesEntities.test.js` (`describe('item-effects entity config (Step
  35)', ...)`) — `idCard` present and first, `effectCode` is a `select` bound to
  `ITEM_EFFECT_CODE_OPTIONS`, `effectValue`'s label — plus, part three,
  `describe('items entity config (Step 35)', ...)`'s
  `'offers flagShowEffects as a checkbox, next to the consumable one'`, asserting both the field
  and that it sits immediately after `isConsumabile`. `src/tests/pages/StoryEditorPageHelpers
  .test.jsx`'s `'a new item shows its effects unless the author unticks the box (Step 35)'`
  covers the `{ flagShowEffects: 1 }` default. Full suite: 642 tests passing.
- react-game, effects preview: five cases in `ItemCard.test.jsx` (`'promises the effects
  using it would apply (Step 35)'` and `'promises nothing for an item that can only be
  carried'`, alongside the existing badge/lock/use/drop cases) — unchanged by part three, since
  the flag is gated server-side and an empty `effects[]` already rendered no badge.
- Java, part three: `ItemInstanceMapperTest`'s `secretItemPromisesNothing()` (`flag_show_effects
  = 0` empties the promise) and `nullFlagStillPromises()` (an unset flag still promises, for
  stories authored before the column existed); `StoryEntitiesTest`'s
  `flagShowEffects_defaultsToUnset()` (entity getter/setter round-trip); `StoryCrudServiceFieldMappingTest`'s
  `createsAnItemWithEveryFieldMapped()` now includes `flagShowEffects` in its round trip, and the
  new `acceptsABooleanForAFlagColumn()` pins the `intVal` boolean fix (§6c) — the pre-existing
  `acceptsNumericStringsAndRejectsEverythingElseAsNull()` is unchanged, still covering numeric
  strings and unparsable text. Full suite: `mvn test` BUILD SUCCESS.
- Python, part three: `test_inventory_service.py`'s `test_a_secret_item_promises_nothing_step35`,
  `test_an_unset_flag_still_promises`, `test_using_a_secret_item_still_applies_its_effects`
  (asserts the effect still reaches `apply_standalone_effects` unchanged); `test_character_query_service.py`'s
  `test_a_secret_item_promises_nothing_on_info` (the same gate, read through `/info`, via the
  one shared `shows_effects` helper). Full suite: 1272 tests passing.
- AWS, part three: `test_inventory.py`'s `test_preview_effects_are_hidden_when_the_item_keeps_its_secret`
  (promise hidden, `standalone_effects` still returns the row) and
  `test_preview_effects_read_a_missing_flag_as_shown` (also pins `shows_effects(None) is True`).
  Full suite: 764 tests passing.
- Robot: new suite `code/tests/robot/tests/34_inventory/effects_preview.robot`, 6
  backend-agnostic test cases (`Every Inventory Row Promises Something Or Nothing But Never
  Null`, `A Promise Speaks The Engine Vocabulary`, `Match Info Reports Exactly The Same
  Promise`, `What An Item Promises Is What Using It Applies`, `An Item Can Keep Its Secret And
  Still Do Its Work`, `A Non Consumable Item Is Listed With Its Promise Like Any Other`) —
  cataloged in `.claude/docs/robot-suites.md` under the `34_inventory` breakdown. The secret-item
  case is discovered by behavior, not by a seeded id: all four seeds ship exactly one consumable
  with an empty promise (the heavy ingot, §6d), which is what that case looks for.
  `robot --dryrun`: 6/6 green; a real run against a started backend has not been made yet — say
  so plainly rather than implying it has.
- Java, part four (v0.35.1): `EventExecutionStoreAdapterReadWriteTest`'s
  `addItem_refusedAtTheCapAndTheRowIsLeftAlone()`, `addItem_underTheCapStillGoesIn()`,
  `addItem_capOfZeroIsNoCapAtAll()`; `InventoryServiceTest` covers the `ITEM_NOT_ENOUGH` refusal
  on `useItem` and the partial-spend path on `useItem`/`dropItem`;
  `InventoryStoreAdapterTest`/`InventoryControllerTest` cover `updateInventoryAmount` and the new
  409 mapping; `EventExecutionServiceEffectsTest`/`EventExecutionServiceSelectChoiceTest` cover
  `NOT_ADDED` reporting and the REMOVE-takes-everything change on both the event and choice
  paths. Full suite: `mvn test` BUILD SUCCESS.
- Python, part four (v0.35.1): `test_event_store_adapter.py`'s
  `test_add_item_refuses_at_the_cap`, `test_add_item_cap_of_zero_is_no_cap`;
  `test_inventory_service.py`'s `test_use_refuses_when_there_are_not_enough_units`,
  `test_drop_takes_what_is_there_when_it_is_not_enough`; `test_event_service.py`/
  `test_event_service_select_choice.py` cover `NOT_ADDED` and full-amount REMOVE on both the
  event and choice paths; `test_inventory_controller.py` covers the `ITEM_NOT_ENOUGH` → 409
  mapping. Full suite: 1280 tests passing.
- AWS, part four (v0.35.1): `test_events_edge_cases.py`'s `test_apply_item_add_creates_then_stacks`,
  `test_apply_item_add_is_refused_at_the_cap`, `test_apply_item_add_under_the_cap_and_a_cap_of_zero`;
  `test_match_handler_inventory.py`'s `test_use_item_refuses_when_there_are_not_enough_units` and
  the partial-drop/partial-use cases alongside it. Full suite: 768 tests passing.
- Robot, part four: new suite `code/tests/robot/tests/34_inventory/item_quantities.robot`, 5
  backend-agnostic test cases (§8e) — cataloged in `.claude/docs/robot-suites.md` under the
  `34_inventory` breakdown. `robot --dryrun`: 36/36 green across the whole `34_inventory` folder;
  a real run against a started backend has not been made yet — say so plainly rather than
  implying it has.
- react-game, react-admin: unaffected by part four itself — the change was entirely server-side
  (§8c); react-game catches up in the payload increment below (§8f).
- Java, part four continued — quantities on the payload (§8f): `ItemInstanceMapperTest`'s nested
  `Quantities` (`@DisplayName("authored quantities (v0.35.1)")`, 2 cases — the values travel as
  authored, and an unset item stays unset rather than defaulting); `InventoryDtosTest
  .itemInstanceResponse_projectsTheQuantities()` (projects set values, and confirms unset stays
  null) plus the pre-existing setter round-trip. Full suite: `mvn test` BUILD SUCCESS.
- Python, part four continued (§8f): `test_inventory_service.py`'s
  `test_the_authored_quantities_travel_to_the_board` and
  `test_an_item_that_authored_no_quantity_reports_none`; `test_inventory_controller.py`'s
  `test_inventory_projects_the_authored_quantities`; `test_character_query_service.py`'s
  `test_the_info_items_carry_the_authored_quantities` (same fields, read through `/info`). Full
  suite: 1284 tests passing.
- AWS, part four continued (§8f): `test_match_handler_inventory.py`'s
  `test_inventory_reports_the_authored_quantities`, plus the pre-existing listing test now also
  asserting `maxPerCharacter`/`amountDrop`/`amountUse` come back `None` for a seed that authors
  none of the three. Full suite: 769 tests passing.
- react-game, part four continued (§8f): five new cases in `statBadges.test.js` (`'the cap and
  the cost of a usage (v0.35.1)'`) — `itemCap` reading `0`/`null` as no cap, `unitsPerUse` reading
  a missing/zero/negative `amountUse` as one, the `2/3` amount badge, `1/1` when the cap is one,
  and the `perUse` badge appearing only above one unit per use. Four new cases in
  `ItemCard.test.jsx` — the use button locked with the `(1/2)` figures in the long reason, the
  same button re-offered once the bag holds enough, a non-consumable item still reading
  `ITEM_NOT_CONSUMABLE` rather than the new reason, and the cap/per-use badges both appearing
  together on a capped, multi-unit item. Full suite: 847 tests passing.
- react-admin: unaffected by §8f — the increment is read-only on the payload the board already
  fetches. Full suite: 644 tests passing.
- react-game, backpack UX (§11, v0.35.2): `ItemsCard.test.jsx` and `ItemsCards.test.jsx` gain the
  three cases listed at the end of §11. Full suite: 857 tests passing.
- Robot, resource costs (§12f, v0.35.3): new suite
  `code/tests/robot/tests/29_events/resource_costs.robot`, 9 backend-agnostic test cases —
  cataloged in `.claude/docs/robot-suites.md` under the `29_events` breakdown. Discovers events
  and neighbors by behavior, not by seeded id; fills the backpack via the new `Admin Change
  Statistics` keyword instead of playing towards the state. Full run: 576/576 on Java/SQLite and
  on Python; AWS and Java/Postgres not run.
- Python, resource costs bugfix (§12g): `test_event_store_adapter_movement.py` gains
  `test_insert_movement_log_accepts_and_persists_the_resource_costs` and
  `test_insert_movement_log_defaults_the_resource_costs_to_zero`, pinning the
  two-adapters-write-`log_movements` bug the E2E run found in the forced-move path.
- react-game, resource costs (§12h): `ItemsCard.test.jsx` — four existing cases updated, two
  added (listed in §12h). Full suite: 860 tests passing, 3 skipped.
- Trait grant now moves stats (§4, v0.35.2 bugfix): the engine change itself, its 9 new unit
  tests and its full-suite counts belong to [Step23 §6.4](./Step23_CharacterStatsInitialization.md#64-trait-stat-deltas-apply-on-grant-not-only-at-creation-v0352)
  — nothing on this table changed shape, so nothing item-specific is added here.
- Parts one and two carry no migration and no new endpoint — the effects preview is confined to
  a projection of already-loaded rows onto an existing field. Part three adds exactly one
  migration, `V0.35.0__add_item_flag_show_effects.sql` on both java dialects (§6a), and no new
  endpoint either: the flag is read by the same `GET .../inventory` and `GET .../info` payloads
  the preview already rides on. Part four (v0.35.1, §8) adds a second migration,
  `V0.35.1__item_amounts_and_unique_inventory_row.sql` on both java dialects, and still no new
  endpoint — but, unlike parts one through three, it is not purely additive: an ADD can now be
  refused, a REMOVE now empties the row instead of decrementing it by one, and a use/drop can
  now be a partial spend instead of an all-or-nothing row deletion. The same version's later
  increment (§8f) is purely additive again — no migration, no new endpoint — projecting the
  three columns part four already added onto the `items[]` payload part two already shipped.

## 10. Scope of change

| Layer | Path |
|---|---|
| Game board (react-game) | `src/features/gameplay/GameBook.jsx` — `handleItemUsed` (new), `handleEventExecuted` gains `fallbackCard` param and `narrativeType` derivation, `<ItemsCards>`'s `onDone` now `handleItemUsed` |
| Game board tests (react-game) | `src/test/GameBookCoverage.test.jsx` — four new cases |
| Admin story editor (react-admin) | `src/constants/story/storiesEntities.jsx` — `item-effects` gains `idCard`, `effectCode` becomes `select`, `effectValue` label updated; `src/constants/story/storyFieldOptions.js` — `ITEM_EFFECT_CODE_OPTIONS` (new); `src/pages/story/StoryEditorPage.jsx` — `item-effects` picker map gains `idCard`/`traitsToAdd`/`traitsToRemove` |
| Admin tests (react-admin) | `src/tests/constants/storiesEntities.test.js` — `item-effects entity config (Step 35)` |
| OpenAPI | `code/backend/java/adapter-rest/src/main/resources/openapi/v0.34.0-inventory-resources-api.yaml` — new schema `ItemEffectPreview`; new `effects` field on `ItemInstance` |
| Engine (Java) | `core/model/match/ItemEffectPreview.java` (new); `ItemInstanceInfo.effects` (new field); `service/match/ItemInstanceMapper.java` — new `build(...)` overload, `previewEffects`, `groupEffectsByItem`; `service/match/InventoryService.java` — `Ctx.effectsByItem()` cache, now shared by the preview and `standaloneEffects`; `service/match/CharacterMapper.java` — groups a story's effect rows once via `storyReadPort.findItemEffectsByStoryId` |
| REST (Java) | `adapters/rest/dto/ItemEffectPreviewResponse.java` (new); `ItemInstanceResponse.effects` (new field) |
| Engine (Python) | `app/core/models/match/match_models.py` — `ItemEffectPreview` dataclass (new), `ItemInstanceInfo.effects`; `app/core/services/match/inventory_service.py` — `preview_effects(rows)`, `_KNOWN_EFFECT_CODES` (new); `app/core/services/match/character_query_service.py` — reuses `preview_effects` when building `/info` |
| Ports/persistence (Python) | `app/core/ports/match/match_ports.py` — `StoryMatchReadPort.find_item_effects_by_item_id` (new); `app/adapters/persistence/match/story_match_read_adapter.py` — implementation (new) |
| REST (Python) | `app/adapters/rest/match/inventory_controller.py` — `item_to_camel` projects `effects` |
| Engine (AWS) | `lambda/match/inventory.py` — `preview_effects(story, item)` (new), built on `standalone_effects`; `lambda/match/handler.py` — `_item_rows` calls `preview_effects` instead of hardcoding `"effects": []` |
| Game board, effects preview (react-game) | `src/features/gameplay/cards/ItemCard.jsx` — reads `item.effects` through `effectStatItems` (`src/utils/statBadges.js`), appended to `descriptionBadges` for usable items |
| Tests, effects preview | Java: `ItemInstanceMapperTest`, `CharacterMapperTest`, `InventoryServiceTest`, `InventoryDtosTest` (new cases). Python: `test_inventory_service.py`, `test_character_query_service.py`, `test_inventory_controller.py`, `test_character_persistence_adapter.py` (new cases). AWS: `test_inventory.py`, `test_match_handler_inventory.py` (new cases). React-game: `test/ItemCard.test.jsx` (new cases) |
| Version strings only, no behavior | `code/backend/java/pom.xml`, `code/backend/java/ms-launcher/src/main/resources/application.yml`, `code/backend/python/pyproject.toml`, `code/backend/python/app/config.py`, `code/backend/aws/lambda/echo/handler.py`, `code/frontend/react-admin/src/components/layout/FooterBar.jsx`, `code/frontend/react-game/src/components/layout/Footer.jsx` — `0.34.0` → `0.35.0` |
| Migration, `flagShowEffects` (§6) | `code/backend/java/adapter-sqlite/src/main/resources/db/migration/v0/V0.35.0__add_item_flag_show_effects.sql` (new); `code/backend/java/adapter-postgres/src/main/resources/db/migration/v0/V0.35.0__add_item_flag_show_effects.sql` (new, also adds a `COMMENT ON COLUMN`) — `list_items.flag_show_effects INTEGER DEFAULT 1` |
| Engine, `flagShowEffects` (Java) | `core/entity/story/ItemEntity.java` — `flagShowEffects` field; `service/match/ItemInstanceMapper.java` — `showsEffects(item)` gates `previewEffects`; `service/story/StoryImportService.java` — reads `flagShowEffects` off the story JSON; `service/story/StoryCrudService.java` — `applyItemFields` writes it, the entity-to-map projection reads it, `intVal` gains a `Boolean` branch (§6c) |
| Engine, `flagShowEffects` (Python) | `app/adapters/persistence/story/models.py` — `flag_show_effects` column; `app/core/services/match/inventory_service.py` — `shows_effects(item)` (new), gates `preview_effects`; `app/core/services/match/character_query_service.py` — imports and reuses `shows_effects`; `app/adapters/persistence/story/story_persistence_adapter.py` — `save_items` writes it; `app/adapters/persistence/match/story_match_read_adapter.py`, `app/adapters/persistence/match/inventory_store_adapter.py` — both project the column |
| Engine, `flagShowEffects` (AWS) | `lambda/match/inventory.py` — `shows_effects(item)` (new), called at the top of `preview_effects` |
| Admin story editor, `flagShowEffects` (react-admin) | `src/constants/story/storiesEntities.jsx` — `items` gains `flagShowEffects` checkbox, right after `isConsumabile`; `src/pages/story/StoryEditorPageHelpers.jsx` — `getNewEntityDefaults('items')` returns `{ flagShowEffects: 1 }` |
| Admin tests, `flagShowEffects` (react-admin) | `src/tests/constants/storiesEntities.test.js` — `items entity config (Step 35)`; `src/tests/pages/StoryEditorPageHelpers.test.jsx` — new default case |
| OpenAPI, `flagShowEffects` | `v0.34.0-inventory-resources-api.yaml` — `ItemInstance.effects` description updated: `flag_show_effects = 0` answers `[]` even with effect rows present |
| Seed data, `flagShowEffects` (§6d) | `code/backend/java/adapter-sqlite/src/main/resources/db/migration/*/R__insert_story_seed_data.sql`, `code/backend/java/adapter-postgres/src/main/resources/db/migration/*/R__insert_dev_test_data.sql`, `code/backend/python/scripts/seed_stories.py`, `code/backend/aws/lambda/seed/handler.py` — the Lead Ingot ships `flagShowEffects = 0`, the Guide Scroll leaves it unset |
| Tests, `flagShowEffects` engine | Java: `ItemInstanceMapperTest`, `StoryEntitiesTest`, `StoryCrudServiceFieldMappingTest` (new/extended cases). Python: `test_inventory_service.py`, `test_character_query_service.py` (new cases). AWS: `test_inventory.py` (new cases) |
| Game board, received item's card (§7, react-game) | `src/features/gameplay/GameBook.jsx` — `itemRowForUuid` (new, returns the whole row); `itemCardForUuid` now delegates to it; `handleEventExecuted`'s `stats` derivation and the `getInventory` fallback branch both switch to `effectStatItems(row.effects, ...)` for a granted item |
| Tests, received item's card (react-game) | `src/test/GameBookCoverage.test.jsx` — two new cases plus one extended (listed in §9) |
| Robot, effects preview | `code/tests/robot/tests/34_inventory/effects_preview.robot` (6 tests); `.claude/docs/robot-suites.md` — `34_inventory` breakdown updated |
| Migration, quantities (§8a-b, v0.35.1) | `code/backend/java/adapter-sqlite/src/main/resources/db/migration/v0/V0.35.1__item_amounts_and_unique_inventory_row.sql` (new); `code/backend/java/adapter-postgres/src/main/resources/db/migration/v0/V0.35.1__item_amounts_and_unique_inventory_row.sql` (new, also adds `COMMENT ON COLUMN`) — `list_items.max_per_character`/`amount_drop`/`amount_use` (all `INTEGER`, nullable); merges pre-existing duplicate `gaming_inventory_items` rows and adds `CREATE UNIQUE INDEX uq_inventory_char_item ON gaming_inventory_items (id_match, id_character_match, id_item)` |
| Engine, quantities (Java, §8c) | `core/entity/story/ItemEntity.java` — `maxPerCharacter`/`amountDrop`/`amountUse` fields; `core/persistence/match/EventExecutionStoreAdapter.java` — `addItem(...,Integer maxPerCharacter)` merges duplicates and enforces the cap, `removeItem` empties the row, new `findItemMaxPerCharacterById`; `core/port/match/EventExecutionStorePort.java` — signatures updated; `core/service/match/EventExecutionService.java` — `applyItem` reports `NOT_ADDED`, REMOVE clears `ownedItemIds` only when the row is actually gone; `core/service/match/InventoryService.java` — `useItem`/`dropItem` spend units via new `updateInventoryAmount`, delete the row only when empty, `logItemUsage` takes the spent `counter`; `core/port/match/InventoryStorePort.java` — `updateInventoryAmount` (new); `core/port/match/InventoryPort.java` — `ITEM_NOT_ENOUGH` code |
| REST, quantities (Java) | `adapter-rest/.../InventoryController.java` — `ITEM_NOT_ENOUGH` mapped to 409 |
| Engine, quantities (Python, §8c) | `app/adapters/persistence/story/models.py` — `max_per_character`/`amount_drop`/`amount_use` columns; `app/adapters/persistence/match/event_store_adapter.py` — `add_item`/`remove_item` mirror the java merge/cap/full-removal logic, new `find_item_max_per_character_by_id`; `app/core/services/match/event_service.py` — `_apply_item` reports `NOT_ADDED`; `app/core/services/match/inventory_service.py` — `action_amount(authored)` (new), `update_inventory_amount` on the port/adapter, `log_item_usage` takes `counter`; `app/core/ports/match/inventory_ports.py` — `ITEM_NOT_ENOUGH` |
| REST, quantities (Python) | `app/adapters/rest/match/inventory_controller.py` — `ITEM_NOT_ENOUGH` mapped to 409 |
| Engine, quantities (AWS, §8c) | `lambda/match/inventory.py` — `action_amount`, `spend_units` (new), `log_item_usage(..., counter)`; `lambda/match/events.py` — `apply_item` takes `max_per_character`, reports `NOT_ADDED`, empties the row on REMOVE, folds duplicates; `lambda/match/handler.py` — `_item_cap(story, effect)` (new), use/drop spend units, `ITEM_NOT_ENOUGH` added to `_ITEM_REFUSAL_MESSAGES` |
| Admin story editor, quantities (react-admin, §8c) | `src/constants/story/storiesEntities.jsx` — `items` gains `maxPerCharacter`/`amountDrop`/`amountUse` numeric fields |
| OpenAPI, quantities | `v0.34.0-inventory-resources-api.yaml` — `list_items.amount_use`/`amount_drop`/`max_per_character` documented, `NOT_ADDED` and the refusal semantics for `use-item`/`drop-item`, `ITEM_NOT_ENOUGH` added to the error table |
| Seed data, quantities (§8d) | Same four files as the `flagShowEffects` seed row above — the Scholar's Tonic ships `maxPerCharacter = 1`, the Guide Scroll ships `amountDrop = 2` |
| Tests, quantities (§9) | Java: `EventExecutionStoreAdapterReadWriteTest`, `InventoryServiceTest`, `InventoryStoreAdapterTest`, `InventoryControllerTest`, `EventExecutionServiceEffectsTest`, `EventExecutionServiceSelectChoiceTest` (new/extended cases). Python: `test_event_store_adapter.py`, `test_inventory_service.py`, `test_event_service.py`, `test_event_service_select_choice.py`, `test_inventory_controller.py` (new cases). AWS: `test_events_edge_cases.py`, `test_match_handler_inventory.py` (new cases) |
| Robot, quantities | `code/tests/robot/tests/34_inventory/item_quantities.robot` (new, 5 tests); `.claude/docs/robot-suites.md` — `34_inventory` breakdown updated |
| Engine, quantities on the payload (Java, §8f) | `core/model/match/ItemInstanceInfo.java` — `maxPerCharacter`/`amountDrop`/`amountUse` fields (new); `core/service/match/ItemInstanceMapper.java` — `build(...)` copies them off the `ItemEntity` |
| REST, quantities on the payload (Java) | `adapter-rest/.../dto/ItemInstanceResponse.java` — three fields projected in `fromModel` |
| Engine, quantities on the payload (Python, §8f) | `app/core/models/match/match_models.py` — `ItemInstanceInfo` gains the three optional fields; `app/core/services/match/inventory_service.py` — `_map_items` sets them; `app/core/services/match/character_query_service.py` — `build_character_infos` sets them |
| REST, quantities on the payload (Python) | `app/adapters/rest/match/inventory_controller.py` — `item_to_camel` projects `maxPerCharacter`/`amountDrop`/`amountUse` |
| Engine, quantities on the payload (AWS, §8f) | `lambda/match/handler.py` — `_item_rows` sets the three keys off the resolved item, `None` on the story-item-gone branch |
| OpenAPI, quantities on the payload | `v0.34.0-inventory-resources-api.yaml` — `ItemInstance.maxPerCharacter`/`.amountDrop`/`.amountUse` (new nullable properties) |
| Game board, quantities on the payload (react-game, §8f) | `src/utils/statBadges.js` — `itemCap(item)`, `unitsPerUse(item)` (new helpers); `itemCarryBadges` writes `carried/cap`; `itemDescriptionBadges` appends a `perUse` badge above one unit; `src/features/gameplay/cards/ItemCard.jsx` — `usable = isConsumabile && enough`, new `ITEM_NOT_ENOUGH` lock reason with `(carried/needed)` appended to the long sentence; `src/i18n/en.json`, `src/i18n/it.json` — `game.item.perUse`, `game.item.reason.ITEM_NOT_ENOUGH`, `game.item.reasonFull.ITEM_NOT_ENOUGH` |
| Tests, quantities on the payload (§9) | Java: `ItemInstanceMapperTest` (`Quantities` nested class), `InventoryDtosTest.itemInstanceResponse_projectsTheQuantities` (new cases). Python: `test_inventory_service.py`, `test_inventory_controller.py`, `test_character_query_service.py` (new cases). AWS: `test_match_handler_inventory.py` (new case, plus null assertions on the existing listing test). react-game: `statBadges.test.js` (5 new), `ItemCard.test.jsx` (4 new) |
| Documentation | `documentation_v0/Step35_ItemsResolution.md` (this file, §6-§7-§8-§10 added, intro reframed; §8f added for the payload/react-game increment; §11 added for the v0.35.2 backpack UX fixes); `documentation_v0/Step34_InventoryAndResources.md` — corrected the now-superseded "whole row"/"two rows" passages (§8e note); `documentation_v0/Step09_DesignCoreDataModel.md` — `list_items` row gains `max_per_character`/`amount_drop`/`amount_use`, `gaming_inventory_items` row notes the new unique index (unchanged by §8f — additive to an existing payload, no new column); `documentation_v0/Step23_CharacterStatsInitialization.md` — new §6.4 (trait stat deltas apply on grant, v0.35.2 bugfix); `documentation_v0/Step29_NormalEvents.md` — pointer to §6.4 added to the Effects section; `documentation_v0/INDEX.md` — `Step35_ItemsResolution.md`, `Step23_CharacterStatsInitialization.md` rows updated |
| Game board, backpack UX (react-game, §11, v0.35.2) | `src/features/gameplay/cards/ItemsCard.jsx` — figures now built as a `statItemsToPageContent`/`statistics` badge list instead of description prose; `src/features/gameplay/cards/ItemsCards.jsx` — rows sorted usable-first via `isItemUsable`; `src/components/layout/Card.jsx` — new `bonusBadgeShowZeros` prop (default `false`) |
| Tests, backpack UX (react-game, §11) | `src/test/ItemsCard.test.jsx`, `src/test/ItemsCards.test.jsx` (new cases, listed in §11/§9) |
| Robot, resource costs (§12f, v0.35.3) | `code/tests/robot/tests/29_events/resource_costs.robot` (new, 9 tests); `code/tests/robot/resources/matches.resource` — `Admin Change Statistics` keyword (new); `.claude/docs/robot-suites.md` — `29_events` breakdown updated |
| Bugfix, resource costs (§12g, Python forced-move logging) | `app/adapters/persistence/match/event_store_adapter.py` — `insert_movement_log` gains `food_cost`/`magic_cost`/`coin_cost` to match `MovementStoreAdapter`'s signature; `tests/test_event_store_adapter_movement.py` (2 new cases) |
| Bugfix, resource costs (§12g, `/locations` neighbor fields) | `code/backend/java/adapter-rest/.../dto/MatchLocationsResponse.java` — `NeighborView` gains `costFood`/`costMagic`/`costCoin`; `code/backend/python/app/adapters/rest/match/movement_controller.py` — `_location_to_camel` projects the same three |
| Bugfix, resource costs (§12g, Robot predicates) | `code/tests/robot/tests/29_events/events.robot` — `Event Uuid By Type`, `Event Uuid By Cost`; `code/tests/robot/tests/30_edge_states/edge_states.robot` — one predicate; all three now read `costCoin` and exclude events with a food/magic price |
| Game board, resource costs (§12h, react-game) | `src/features/gameplay/cards/ItemsCard.jsx` — `food`/`magic`/`coins` badges, both variants |
| Tests, resource costs (react-game, §12h) | `src/test/ItemsCard.test.jsx` — four cases updated, two new (listed in §12h/§9) |

Parts one and two carry no migration and no new endpoint: `effects[]` is an additive field on
payloads `GET /api/gameplay/{uuid}/inventory` and `GET /api/game/{uuid}/info` already return.
Part three adds exactly one migration — `list_items.flag_show_effects`, on both java dialects
(§6a) — and still no new endpoint: the flag is read by the same two payloads. Part four (v0.35.1,
§8) adds a second migration — `list_items.max_per_character`/`amount_drop`/`amount_use` plus the
`uq_inventory_char_item` unique index, on both java dialects — again no new endpoint, but this
time behavior changes underneath the existing ones: an ADD can be refused, a REMOVE now empties
the row, and `use-item`/`drop-item` can now be a partial spend instead of an all-or-nothing row
deletion. A later increment within the same version (§8f) adds neither a migration nor an
endpoint: it projects those three columns onto `items[]` itself, so the board can read a cap and
a per-use cost it previously only found out about by being refused. [Step 34](./Step34_InventoryAndResources.md) remains the reference for the inventory
and resources contract itself, and for `use-item`'s own `effects[]` — the applied *result*,
distinct from the preview this step adds — though its §2 quantity language is now superseded by
§8 above, as noted there.

## 11. Backpack: figures as badges, usable-first ordering (v0.35.2)

Two small UX fixes to the bag itself (`ItemsCard`, the header card, and `ItemsCards`,
the list of rows), no migration, no endpoint change, no new prop most other cards use.

**The count and capacity are badges, not a sentence.** `ItemsCard` used to write "how
much is in the bag and how much still fits" into the card's own description text; it
now builds the same `figures` array an `ItemCard` reports its own weight/effects
through, and passes it as `statItemsToPageContent`/`statistics` like any other card. A
new `Card` prop, `bonusBadgeShowZeros` (default `false` — no other card's behavior
changes), is set on `ItemsCard` because an empty bag ("0 items, 0/30") is exactly the
figure worth showing, and `BonusBadgeList` otherwise drops a zero/missing value by
design. `card.description` is left holding only the prose — what the bag page is for —
so the same number the player reads on the little card before opening the bag is the
one they keep seeing once it is open; no copy can drift out of sync with the other.

**Usable items sort first.** `ItemsCards` now sorts its rows with
`[...items].sort((a, b) => Number(isItemUsable(b)) - Number(isItemUsable(a)))` —
`Array.sort` is stable, so within each half nothing is reshuffled, only the two halves
are separated. `isItemUsable` (`src/utils/statBadges.js`) is the exact predicate
`ItemCard` locks itself with, so a padlocked card can never end up sitting among the
unlocked ones. **Known limitation, not fixed here**: the order *within* each half is
whatever the backend sent — for the `/info` payload this page reads, that is
acquisition order in practice and not a guaranteed ordering; the separate
`.../inventory` endpoint does sort by id, so the two adapters diverge on this point.

Vitest: `ItemsCard.test.jsx` — `'says how heavy the bag is as a BADGE, not as a
sentence (v0.35.2)'`; `ItemsCards.test.jsx` — `'shows what can be used first, and
keeps the rest in the order it arrived (v0.35.2)'` and `'sorts by the same rule the
card locks itself with'`. Full react-game suite: 857 passed.

---

## 12. Resource costs: food, magic and coin become a cost of acting (v0.35.3)

Until this version only energy and coins could be charged, and only by an event; food and magic
were numbers that only ever went up — nothing in the engine consumed them. This part gives them
their first sink: an event or a movement edge can now cost food and magic exactly the way it
could already cost energy and coins.

### a. Schema

Migration `V0.35.3__resource_costs.sql`, both java dialects (`adapter-sqlite` +
`adapter-postgres`):

- `list_events.coin_cost` is **RENAMED** to `cost_coin` — three costs on one table spelled three
  different ways is a trap for the next author; new `cost_food`, `cost_magic` (`INTEGER DEFAULT
  0`) join it.
- `list_locations_neighbors` gains `cost_food`, `cost_magic`, `cost_coin`. `energy_cost` is
  deliberately untouched — see §c below.
- `list_choices` gains the same three columns, **RESERVED**: no engine, no admin form, no
  import/export reads them yet. They exist so the option-level cost, when it lands, is not a
  second migration.
- `log_events` gains `energy`, `food`, `magic`, `coin` — the table had **no cost column at all**
  before this: an event's price lived only in the HTTP response and was never persisted.
- `log_movements` gains `food`, `magic`, `coin` (it already had `energy`). Log column names stay
  bare — in a log the column IS what was spent; the `cost_` prefix belongs to the story tables
  that define the price.

### b. Engine — events

`EventAvailabilityChecker` gained two checks after the existing coin one, in this exact contract
order: energy → coin → food → magic → registry → weather → item → class. New refusal codes
`NOT_ENOUGH_FOOD`, `NOT_ENOUGH_MAGIC`; coins keep the existing (plural) `NOT_ENOUGH_COINS`.
Payment happens once, in `deductCosts`, by the actor alone.

**Automatic events never pay.** AUTOMATIC/FIRST events, an `id_event_next` chain, the Step 33
location-entry events and a choice resolution all run without ever reaching `deductCosts`.
Valorising `cost_food` on an automatic event is therefore not an error — it is silently ignored,
and a story author needs to know that before pricing one.

An already-open choice cycle re-serves its options without re-charging: the pre-existing `if
(!openCycle)` guard ([Step31](./Step31_ChoiceEngine.md)) now covers the two new costs the same
way it already covered coins.

### c. Engine — movement

The resource cost comes from the **edge alone** (`list_locations_neighbors`), with no
destination-entry term and no weather term — unlike energy, which keeps summing edge +
`list_locations.cost_energy_enter` + the weather modifier
([Step28 §4](./Step28_MovementSystem.md#4-energy-cost-formula)). The asymmetry is deliberate: the
energy formula is a sum, so an entry or weather term for food/magic/coin can be added later
without invalidating a single story that has already priced an edge.
`MovementAvailabilityChecker` checks the three new costs after `INSUFFICIENT_ENERGY` and before
`LOCATION_FULL` — coin → food → magic, the same order and reasoning as the event checker.

A forced move ([Step29 — Forced movement, v0.29.3](./Step29_NormalEvents.md#forced-movement-v0293))
pays nothing; its `log_movements` row records zeros for food/magic/coin, exactly as it already did
for energy.

Both checkers prove affordability before the deduction runs, so none of the four resources can go
negative — the same guarantee energy and coins already had.

### d. JSON / API contract

- Event JSON key `coinCost` → `costCoin`, plus new `costFood`, `costMagic`. **Import and admin
  CRUD accept BOTH names** (`costCoin` wins when both are present), so a story exported before
  v0.35.3 keeps its price instead of silently becoming free. AWS has no migration — the Lambda
  engine reads both keys straight off the stored story for the same reason.
- `execute-event`/`select-choice` responses gain `foodSpent`, `magicSpent`, `newFood`, `newMagic`.
  On `select-choice` all four `*Spent` fields are still `0` — the open already paid ([Step31](./Step31_ChoiceEngine.md)).
- `movements/start` response gains `foodSpent`, `magicSpent`, `coinSpent`, `newFood`, `newMagic`,
  `newCoin`.
- `GET /api/match/{uuid}/info`: each event now carries `coin`/`food`/`magic` beside `energy`; each
  neighbor carries `costFood`/`costMagic`/`costCoin` beside `energyCost` — edge-only, so no
  breakdown (contrast with `totalEnergyCost`'s three-term breakdown,
  [Step28 §5.3](./Step28_MovementSystem.md#53-matchlocationsresponse)).
- `GET /api/matches/{uuid}/logs`: MOVEMENT and EVENT entries gain `foodCost`, `magicCost`,
  `coinCost` (EVENT also fills `energyCost`, previously always `null` — `log_events` had nowhere
  to keep it). The price is stamped on the row of the event the player actually asked for; every
  other row of a chain logs zeros, so summing a match's log gives the real spend. **v0.35.4**
  adds the counterpart — `energyGain`/`foodGain`/`magicGain`/`coinGain`, present as numbers on
  every entry type — plus three new entry types for items; see §i below and the full write-up in
  [Step28 "New: Item Actions and Resource Gains (v0.35.4)"](./Step28_MovementSystem.md).
- `list_locations_neighbors` CRUD/import gains `costFood`/`costMagic`/`costCoin`.

### e. Components touched

java (core entities/ports/checkers/services/adapters, `adapter-rest` DTOs + 4 OpenAPI specs, both
migration dialects, both dev seed files), python (models, `event_availability`,
`movement_availability`, `event_service`, `movement_service`, store adapters, controllers,
`match_logs_service`, `seed_dev_data`), AWS (`lambda/match/events.py` + `movements.py` +
`handler.py`, `lambda/seed/handler.py`), react-admin (`storiesEntities.jsx`: event form
`costCoin`/`costFood`/`costMagic`, neighbor form the three costs), react-game
(`lockReasons.js` icons for the two new codes, `i18n/it.json` + `en.json` movement and event
reason blocks).

Seed events 90053 (`cost_food` 999 → `NOT_ENOUGH_FOOD`), 90054 (`cost_magic` 999 →
`NOT_ENOUGH_MAGIC`), 90055 (affordable: coin 1, food 2, magic 1); AWS seeds the same three under
uuids `evt-v0353-nofood`, `evt-v0353-nomagic`, `evt-v0353-affordable`.

### f. Robot suite

**Correction**: the very first version of this section said "no Robot suite", by deliberate
choice, since a tolled edge in the shared seed graph would perturb the `28_movement` suites,
which pick "the first neighbor" of the start location. That reasoning was sound for movement but
never actually ruled out an events suite — a follow-up doc-sync pass added one:
`code/tests/robot/tests/29_events/resource_costs.robot`, 9 tests, backend-agnostic. It walks the
whole round trip:

- every event of the location advertises all four prices (`energy`/`coin`/`food`/`magic`) on
  `/info`, always present and never negative — a cost discovered only by being refused would
  read as a bug;
- an event nobody can afford is blocked with `NOT_ENOUGH_FOOD` / `NOT_ENOUGH_MAGIC`, and
  `execute-event` refuses it with the very same code — one check procedure, two doors;
- a refusal takes nothing at all — the check runs before the deduction;
- the same event flips from blocked to available once the backpack can pay, with nothing about
  the event itself having changed;
- executing it charges exactly what it advertised, and `GET /resources` agrees with the response;
- a free event spends none of the three;
- the spend reaches the `EVENT` row of `GET /api/matches/{uuid}/logs` — before this version an
  event's price lived only in the HTTP response and was never persisted;
- every neighbor on both `/info` **and** `/locations` carries `costFood`/`costMagic`/`costCoin`
  — the one case in this suite that touches movement, and it does so without ever executing a
  move.

**Method**, worth recording because it is the reason the suite is portable: events and neighbors
are found by BEHAVIOUR (the price they advertise, the reason they report), never by a seeded
uuid or id; the backpack is filled through the admin `changeStatistics` override (new shared
keyword `Admin Change Statistics` in `code/tests/robot/resources/matches.resource`) rather than
by playing towards the state; every test case mints its own guest and its own match, since a
priced event spends a per-match backpack. The seed test-bed events named in §e above (90053 /
90054 / 90055, `evt-v0353-nofood` / `evt-v0353-nomagic` / `evt-v0353-affordable` on AWS) are what
this suite actually exercises.

**Why there is still no case that executes a tolled MOVE**: the original reasoning holds —
adding a priced edge to the shared seed graph would perturb the `28_movement` suites. The
movement half of the contract is covered by the unit tests on all three engines (§b, §c) plus
the payload-contract case above, which reads both `/info` and `/locations` without ever moving
along a priced edge.

**Results**: 576 tests, 576 passed on Java/SQLite and on Python
(`run_robot_with_local_java.sh`, `run_robot_with_local_python.sh`). AWS and Java/Postgres were
not run.

### g. Three bugs the Robot run found and fixed

Running the suite against a real backend (rather than stopping at `--dryrun`, as parts three and
four above were left) surfaced three defects invisible to unit tests:

- **Python: two adapters wrote `log_movements`, and only one learned the new signature.**
  `MovementStoreAdapter.insert_movement_log` (an ordinary move) gained
  `food_cost`/`magic_cost`/`coin_cost`; `EventStoreAdapter.insert_movement_log` — the writer used
  by a [forced move](./Step29_NormalEvents.md#forced-movement-v0293) — did not, so every forced
  move started answering 500 and cascaded failures into the inventory and choice suites too.
  Unit tests could not see it because they mock the store away. Fixed by mirroring the
  signature; two regression tests were added to `tests/test_event_store_adapter_movement.py`:
  `test_insert_movement_log_accepts_and_persists_the_resource_costs` and
  `test_insert_movement_log_defaults_the_resource_costs_to_zero`.
- **`GET /locations` mapped its neighbor payload separately from `/info`'s, and the three cost
  fields were missing from it** in Java (`MatchLocationsResponse.NeighborView`) and Python
  (`movement_controller._location_to_camel`); AWS already carried them. Both fixed, so
  `costFood`/`costMagic`/`costCoin` now ride identically on `/info` neighbors, `/locations`
  neighbors and the admin locations view. This is the same `NeighborCostDto` §5.3 already
  documents in [Step28](./Step28_MovementSystem.md#53-matchlocationsresponse) — the DTO shape
  was right from the first doc pass, the Java and Python code just did not fill it in yet.
- **Three Robot predicates selected seeded events by the old `coinCost` key** (`events.robot`'s
  `Event Uuid By Type` and `Event Uuid By Cost`; `edge_states.robot`, one predicate) and found
  nothing once §d renamed the JSON key to `costCoin`. Fixed to read `costCoin`, and each
  predicate now additionally excludes events carrying a food or magic price, so the new v0.35.3
  test-bed events (§e) cannot be mistaken for the historical fixtures those suites were written
  against.

### h. react-game: the backpack shows food, magic and coin

`ItemsCard.jsx` (the backpack card) now carries `food`, `magic` and `coins` badges beside the
capacity gauge, in both of its shapes — `little` in the statistics list and `page` while the bag
is open — so the figure read before opening the bag is the same one still shown after. Values
come from `playerStats.food` / `playerStats.magic` / `playerStats.coins` (mind the naming: the
backend field is `coin`, the `playerStats` key is `coins`); the icons and colours already
existed in `BonusBadgeList`'s `STAT_VISUAL`. `bonusBadgeShowZeros` (already used for the capacity
gauge since §11) keeps a zero supply visible on purpose: a player about to be refused for want of
two rations must be able to see the two rations they do not have. The capacity badge still
disappears when no maximum is known; the three resources do not, because they weigh nothing.

Tests: `src/test/ItemsCard.test.jsx` — four existing assertions updated for the new badges (the
heavy-bag case, the missing-weight default, the empty-bag zero case, and the
no-maximum-known case, which now drops only the capacity badge instead of every badge) plus two
new cases, `'carries food, magic and coins beside the capacity'` and `'shows an empty supply as
0, never as a missing badge'`. Full react-game suite: 860 tests passing, 3 skipped.

**Still not done**: the per-action and per-neighbor price is not yet rendered on the action or
neighbor cards themselves — the data is already on the payload (`/info` events carry
`coin`/`food`/`magic`, neighbors carry `costFood`/`costMagic`/`costCoin`, §d), only the badge on
those specific cards is missing. A player still discovers an action's exact price from the
refusal reason or from the backpack total, not from the action card before committing to it.

### i. v0.35.4 — the other half: what an action *gives*, and every item action in the log

§12 gave the log what an action **took**. Two things were still missing: nothing recorded what
an action **gave** — a match where the player earned 50 coins had them appear from nowhere — and
`log_item_usage` was written on a use and read by no endpoint, so taking an item or dropping one
left no trace anywhere.

- **Schema** (`V0.35.4__log_item_actions_and_resource_gains.sql`, SQLite + PostgreSQL): `log_events`
  gains `energy_gain`/`food_gain`/`magic_gain`/`coin_gain` — spend and gain stay separate columns
  rather than one signed number, because an event can pay 5 coins and hand back 2 in the same
  effect chain, and a single column would report `-3` for a transaction never worth `-3`.
  `log_item_usage` gains `action` (`ADD`/`USE`/`DROP`/`REMOVE`, default `USE`), `id_event` (the
  event whose effect moved the item; `NULL` on a direct use/drop, deliberately **not** a foreign
  key — `list_events` is keyed on `(id, id_story)`, so `id` alone is not a valid reference target)
  and signed `energy`/`food`/`magic`/`coin`.
- **Engine**: an `ADD` refused by `max_per_character` (§2) and a `REMOVE` that found nothing to
  take both write no row — neither is a thing that happened. A gain is stamped per event, reset
  before that event's own effects run, so a chained event logs what it gave and not what an
  earlier link already gave. Only the acting character's own resources ride on a row: an effect
  that also touches another character in the match stays in the HTTP response only.
- **API**: three new log-entry types, `ITEM_ADD`/`ITEM_USE`/`ITEM_DROP` (a `REMOVE` an effect
  produced surfaces as `ITEM_DROP`, with the raw action kept in the new `itemAction` field), plus
  `idItem`/`itemAction`/`counter` and the item's own `idCard`/`card`. The eight resource fields —
  four `*Cost`, four `*Gain` — are now numbers on **every** entry type, never `null`: Java already
  answered this shape, Python and AWS used to omit the keys on types that move nothing, which is
  the v0.35.4 contract fix.
- Full write-up, per-backend file list and the response-shape example: [Step28
  "New: Item Actions and Resource Gains (v0.35.4)"](./Step28_MovementSystem.md). Frontends:
  react-admin's `MatchLogsCard` gains a Resources column and badges/filters for the three new
  types; react-game's `MatchLogCard` renders `ITEM_*` tiles with the item's own card, and
  `BonusBadgeList` gains a per-badge `icon`/`color` override and an `actor` visual so one
  component can badge type, actor and resources without new keys in `STAT_VISUAL`. New Robot
  suite `item_logs.robot` (7 tests, `34_inventory`, backend-agnostic).

---

# Version Control

- **Document Version**: 0.35.4

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.35.4 | The log's other half (§i): `log_events` gains `energy_gain`/`food_gain`/`magic_gain`/`coin_gain`, the counterpart of §12's cost columns; `log_item_usage` becomes the register of every item action (`action`, `id_event`, signed deltas) instead of usages alone. Three new match-log types `ITEM_ADD`/`ITEM_USE`/`ITEM_DROP`; the eight resource fields are now numbers on every log entry, never null. Full writeup in [Step28](./Step28_MovementSystem.md). | August 24, 2026 |
  | 0.35.4 | Same version, continued (§i): react-admin's `MatchLogsCard` gains a Resources column and badges for the three new types; react-game's `MatchLogCard` shows the item's own card via `BonusBadgeList`, which gains a per-badge icon/color override and an `actor` visual; new Robot suite `item_logs.robot` (7 tests). | August 24, 2026 |
  | 0.35.3 | Food, magic and coin become a cost of acting (§12): `list_events.coin_cost` is renamed `cost_coin`, and both events and movement edges can now charge food/magic/coin, while `list_choices` gets the same three columns reserved for a future option-level cost. Import/admin accept both `coinCost` and `costCoin`; automatic events, forced moves and open choice cycles never pay. | August 23, 2026 |
  | 0.35.3 | Same version, continued (§12f-h): new Robot suite `resource_costs.robot` (9 tests, 576/576 on Java/SQLite and Python) replaces the earlier "no suite" note; three bugs the run found are fixed (Python's second `log_movements` writer, `/locations`' missing neighbor cost fields on Java/Python, three Robot predicates still keyed on `coinCost`); react-game's `ItemsCard` now badges food/magic/coin (per-action/per-neighbor price still not rendered). | August 24, 2026 |
  | 0.35.2 | Noted that `traits_to_add`/`traits_to_remove` on a `list_items_effects` row work regardless of a trait's new `hide_on_start_match` flag (§4); flag itself is documented in [Step23 §5.3](./Step23_CharacterStatsInitialization.md#53-schema-change--list_traitshide_on_start_match-v0352). | August 22, 2026 |
  | 0.35.2 | Bugfix note (§4): a trait granted through `traits_to_add` here now also moves the recipient's stats, not just the trait list — formula documented in [Step23 §6.4](./Step23_CharacterStatsInitialization.md#64-trait-stat-deltas-apply-on-grant-not-only-at-creation-v0352). | August 22, 2026 |
  | 0.35.2 | Backpack UX (§11): the bag's count/capacity moved from prose into badges (`bonusBadgeShowZeros`), and `ItemsCards` now lists usable items before locked ones. | August 22, 2026 |
  | 0.35.1 | Items resolution, part four — the quantities. Three nullable columns on `list_items` (`V0.35.1__item_amounts_and_unique_inventory_row.sql`): `max_per_character` caps what a character may hold and refuses a further ADD without failing the event that offered it, while `amount_drop` and `amount_use` say how many units one drop or one usage moves — and the same migration folds duplicate inventory rows and forbids new ones (§8a-§8e). The three numbers then travel in `items[]`, so the bag can write "2/3" and grey out a usage the engine would refuse (§8f). | August 22, 2026 |
  | 0.35.0 | Items resolution — UX refinement of the Step 34 inventory engine: using an item now closes the backpack and narrates on a clean page, an item card falls back on its own card when no effect row carries one, and the react-admin Item Effects form finally offers the narrative card, a closed vocabulary for `effect_code` and the trait pickers (§1-§4). `flagShowEffects` lets a story keep an item's effects secret while still applying them, and `effects[]` on every inventory row lets the board show what using it promises (§5-§7). | August 21, 2026 |

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
