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
