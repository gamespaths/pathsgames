/**
 * Step 38 — what the board needs to know about spending experience.
 *
 * The backend prices every point (`playerStats.expCosts`, null where a stat sits at its
 * cap) and owns every refusal; these readers only decide what to SHOW, so a player is never
 * offered a click that is going to be answered with a certain 409.
 */

/** The three stats a point can be bought for, in the order the price list renders them. */
export const EXP_STATS = ['dex', 'int', 'cos']

/** Engine token → the playerStats key that carries the current value. */
export const EXP_STAT_KEY = { dex: 'dexterity', int: 'intelligence', cos: 'constitution' }

/** Engine token → the badge/icon vocabulary of the stat bar. */
export const EXP_STAT_ICON = { dex: 'fas fa-running', int: 'fas fa-brain', cos: 'fas fa-shield-alt' }

/** True when the party stands in a safe location — the same read GoToSleepCard makes. */
export function isLocationSafe(gameData) {
  const secure = gameData?.info?.locationsActive?.[0]?.secureParam
  return secure != null && Number(secure) > 0
}

/**
 * One row per stat: the current value, what the next point costs (null at the cap) and
 * whether the experience held pays for it.
 */
export function expStatRows(playerStats) {
  const costs = playerStats?.expCosts ?? {}
  const held = Number(playerStats?.experience ?? 0)
  return EXP_STATS.map(stat => {
    const cost = costs?.[stat] ?? null
    const atCap = cost === null || cost === undefined
    return {
      stat,
      key: EXP_STAT_KEY[stat],
      value: Number(playerStats?.[EXP_STAT_KEY[stat]] ?? 0),
      cost,
      atCap,
      affordable: !atCap && Number(cost) <= held,
    }
  })
}

/** The cheapest next point, or null when every stat is capped. */
export function cheapestExpCost(playerStats) {
  const costs = expStatRows(playerStats).filter(r => !r.atCap).map(r => Number(r.cost))
  return costs.length ? Math.min(...costs) : null
}

/**
 * Whether the "train" card belongs on the board: a safe location, an awake character out
 * of coma, and at least one point the experience held can pay for. The turn is the
 * engine's to refuse (single player always owns it).
 */
export function canUseExp(gameData, playerStats) {
  if (!isLocationSafe(gameData)) return false
  if (playerStats?.isComa || playerStats?.isSleeping) return false
  return expStatRows(playerStats).some(r => r.affordable)
}
