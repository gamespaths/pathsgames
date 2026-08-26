// Stats shown as a current/max gauge (Step 27) paired with their max key.
const GAUGE_KEYS = [
  ['life', 'lifeMax'],
  ['energy', 'energyMax'],
  ['sadness', 'sadnessMax'],
  ['weight', 'weightMax'],
]

// Plain single-value stats (no max projected by /info yet).
const PLAIN_KEYS = ['experience', 'food', 'magic', 'coins' , 'dexterity', 'intelligence', 'constitution']

/**
 * The badge list behind the stats bar: the clock (plain mode only), the gauges and,
 * with `plainFlag`, the single-value stats. Shared with InformationCard, which lays the
 * same badges out one per row instead of in a bar.
 */
export function buildStatBadges(stats, t, { plainFlag = false, showLabel = true, specificKeys = null } = {}) {
  const keysList = specificKeys ?? GAUGE_KEYS
  const gauge = keysList.map(([key, maxKey]) => {
    const value = stats?.[key] ?? 0
    const max = stats?.[maxKey] ?? 0
    return {
      key,
      label: showLabel ? t(`game.stats.${key}`) : null,
      // current/max when a max is known, otherwise the bare current value
      value: max ? `${value}/${max}` : value,
    }
  })

  const plain = PLAIN_KEYS.map(key => ({
    key,
    label: t(`game.stats.${key}`),
    value: stats?.[key] ?? 0,
  }))

  // The clock closes the list: it measures the match, not the character, so it reads as a
  // footer to the stats rather than as the first of them.
  const clockStat = plainFlag && stats?.clock != null
    ? [{ key: 'clock', label: stats.clockLabelSingular ?? 'Time', value: stats.clock }]
    : []

  return [...gauge, ...(plainFlag ? plain : []), ...clockStat]
}

// The engine names the statistics as the story authors them; the badges (and their
// translations) use the longer in-game names. Anything not listed has no badge.
export const STAT_CHANGE_KEYS = {
  life: 'life',
  energy: 'energy',
  sad: 'sadness',
  exp: 'experience',
  dex: 'dexterity',
  int: 'intelligence',
  cos: 'constitution',
  food: 'food',
  magic: 'magic',
  coin: 'coins',
}

/** One badge per statistic, dropping the net-zero ones. Shared shape of both readings. */
function badgesFrom(totals, t) {
  return [...totals.entries()]
    .filter(([, delta]) => delta !== 0)
    .map(([key, delta]) => ({
      key,
      label: t(`game.stats.${key}`),
      value: delta > 0 ? `+${delta}` : String(delta),
    }))
}

/**
 * The badges an executed event earned the player: its `statChanges`, which carry the delta
 * ACTUALLY applied (after the clamp — a -10 life on a character with 3 left is a -3), one row
 * per character and per statistic. Rows of the other characters standing in the location are
 * dropped, and a chain that touches the same statistic twice is summed into one badge.
 * A net delta of 0 earns no badge.
 */
export function statChangeItems(result, characterUuid, t = (k) => k) {
  const totals = new Map()
  for (const change of result?.statChanges ?? []) {
    if (characterUuid && change?.characterUuid && change.characterUuid !== characterUuid) continue
    const key = STAT_CHANGE_KEYS[String(change?.statistic ?? '').toLowerCase()]
    const delta = Number(change?.delta)
    if (!key || !Number.isFinite(delta)) continue
    totals.set(key, (totals.get(key) ?? 0) + delta)
  }
  return badgesFrom(totals, t)
}

/**
 * The same badges read off `AppliedEffect` rows instead — for the payloads that carry the
 * effects but no `statChanges`, which is the case of `counterZero[].cardEffects` (v0.33.1).
 *
 * The difference matters and is deliberate: `statistic`/`value` are what the story
 * **authored**, before the engine clamped them, while `statChanges.delta` is what actually
 * landed. So a -10 energy on a character with 3 left shows as -10 here and would show as -3
 * there. It is the only reading this payload allows, and it is the effect as written.
 *
 * `characterUuids` is the set the effect resolved onto: rows that touched other characters
 * are dropped, exactly as `statChangeItems` drops their `statChanges`. An empty set means
 * the effect landed on nobody in particular — an automatic event can run with no actor at
 * all — and is kept: it is still what happened.
 */
export function effectStatItems(effects, characterUuid, t = (k) => k) {
  const totals = new Map()
  for (const effect of effects ?? []) {
    const touched = effect?.characterUuids ?? []
    if (characterUuid && touched.length > 0 && !touched.includes(characterUuid)) continue
    const key = STAT_CHANGE_KEYS[String(effect?.statistic ?? '').toLowerCase()]
    const value = Number(effect?.value)
    if (!key || !Number.isFinite(value)) continue
    totals.set(key, (totals.get(key) ?? 0) + value)
  }
  return badgesFrom(totals, t)
}

/**
 * Step 35 — what an inventory ROW weighs and carries, as badges.
 *
 * Two shapes of one list, so the bag and the card of an item just received cannot describe
 * the same row differently:
 *
 *   itemCarryBadges       what the row IS — how many and how heavy. The `x` rides on the
 *                         amount because the card FACE has no room for a label.
 *   itemDescriptionBadges the same figures without that prefix (the label spells it out
 *                         there), followed by what USING it promises.
 *
 * The promise is only ever appended for a consumable: a carried-only item never fires its
 * effect rows, so promising them would be a promise the engine refuses to keep. An item
 * whose story hides them (flagShowEffects = 0) arrives with an empty `effects` and simply
 * adds nothing.
 */
/**
 * v0.35.1 — the cap the story put on this item, or null when it put none. 0 reads as "no
 * limit", the same way the engine and the class gates read it.
 */
export function itemCap(item) {
  const cap = Number(item?.maxPerCharacter)
  return Number.isFinite(cap) && cap > 0 ? cap : null
}

/** v0.35.1 — units one usage spends. Null, zero or a negative all read as one, exactly as
 *  the engine reads them: the board must not promise a cheaper action than the server. */
export function unitsPerUse(item) {
  const units = Number(item?.amountUse)
  return Number.isFinite(units) && units >= 1 ? units : 1
}

/**
 * v0.35.2 — can the player use this item RIGHT NOW?
 *
 * Two conditions, and both are the server's: only a consumable can be used at all, and a
 * usage spends `amountUse` units, so carrying fewer is a certain ITEM_NOT_ENOUGH. Kept in
 * one place because two readings would drift — the bag sorts by this and the card locks by
 * it, and a card sitting among the usable ones while showing a padlock is worse than
 * either order.
 */
export function isItemUsable(item) {
  return item?.isConsumabile === true && (item?.amount ?? 1) >= unitsPerUse(item)
}

export function itemCarryBadges(item, t = (k) => k) {
  const amount = item?.amount ?? 1
  const weight = item?.weight ?? 0
  const cap = itemCap(item)
  const badges = [{ key: 'weight', value: `${weight * amount}`, label: t('game.item.weight') }]
  // A capped item shows "2/3": how many are carried out of how many may be. A single unit
  // is worth saying when there is a cap — "1/1" means "and that is all you will ever get".
  // The x is the quantity symbol and only fits the uncapped reading; a plain letter, not
  // the × sign, which is drawn smaller than the digits and read as a speck.
  if (cap) {
    badges.unshift({ key: 'amount', value: `${amount}/${cap}`, label: t('game.item.amount') })
  } else if (amount > 1) {
    badges.unshift({ key: 'amount', value: `${amount}`, prefix: 'x', label: t('game.item.amount') })
  }
  return badges
}

export function itemDescriptionBadges(item, t = (k) => k) {
  const perUse = unitsPerUse(item)
  // What one usage costs, and only when it costs more than one: an item that spends a
  // single unit is every item that ever existed before v0.35.1, and saying so would be
  // noise. It lives here and not on the card face, which has no room for a label — a bare
  // "2" beside the weight would say nothing at all.
  const cost = perUse > 1
    ? [{ key: 'perUse', value: `${perUse}`, label: t('game.item.perUse') }]
    : []
  return [...itemCarryBadges(item, t).map(({ prefix, ...b }) => b), ...cost,
          ...itemPromise(item, t)]
}

/**
 * Step 35 — the badges of an item just RECEIVED: what this thing weighs, and what using it
 * promises. No count, deliberately.
 *
 * The card is about the object that just arrived, not about the shelf it landed on. And
 * since the quantity is not on the card, the weight cannot be the stack's either — "4" next
 * to a potion nobody said there were two of describes nothing. So this is the UNIT weight,
 * while the bag (itemDescriptionBadges) shows the count and weighs the whole stack.
 */
export function itemPromiseBadges(item, t = (k) => k) {
  return [
    { key: 'weight', value: `${item?.weight ?? 0}`, label: t('game.item.weight') },
    ...itemPromise(item, t),
  ]
}

/** What using it would apply — for a consumable only, empty for anything else. */
function itemPromise(item, t) {
  return item?.isConsumabile === true ? effectStatItems(item?.effects, null, t) : []
}
