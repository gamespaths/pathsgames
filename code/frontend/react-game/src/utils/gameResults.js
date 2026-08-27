/**
 * gameResults.js — pure readers over the gameplay API answers (execute-event,
 * select-choice, use-item). Extracted from GameBook: they are payload logic, not board logic.
 */

/**
 * Step 34 — the uuids of the STORY items an execution handed over.
 *
 * `itemChanges` names the story item (`itemUuid`), not the inventory row: the row is
 * created by the same write and its uuid never travels in this payload.
 */
export function grantedItemUuids(result) {
  return (result?.itemChanges ?? [])
    .filter(c => c?.action === 'ADD' && c?.itemUuid)
    .map(c => c.itemUuid)
}

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

/**
 * The card an executed event narrates: the LAST applied effect that carries one. The effects
 * come back in the order the engine applied them (a chain runs several), and the story reads
 * as the one that landed last. Effects without a card are skipped — they change stats, they
 * do not tell anything.
 */
export function lastEffectCard(result) {
  const effects = result?.effects ?? []
  for (let i = effects.length - 1; i >= 0; i -= 1) {
    if (effects[i]?.card) return effects[i].card
  }
  return null
}
