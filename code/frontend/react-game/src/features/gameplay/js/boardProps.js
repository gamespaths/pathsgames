/**
 * The bag summary the backpack card shows wherever it appears (left page, statistics list).
 * One reader, so the two render points can never drift apart.
 */
import { visibleRegistry } from '@/utils/registry'
import { openMissions } from '@/utils/missions'

/**
 * Step 36 — the registry summary, read the same way wherever the card appears. The count is
 * the visible keys only, which is exactly what opening the section will list.
 */
export function registrySummaryProps(gameData) {
  return { count: visibleRegistry(gameData?.info?.registry).length }
}

/**
 * Step 37 — the mission summary. The count is the missions still OPEN, not every one the
 * match has reached: a card saying "4" when all four are done would be reporting nothing.
 */
export function missionsSummaryProps(gameData) {
  const missions = gameData?.info?.missions
  return { count: openMissions(missions).length,
           total: Array.isArray(missions) ? missions.length : 0 }
}

/**
 * Step 38 — the experience summary: the points held and the price of the next point per
 * stat, read the same way on the board card and on the left page.
 */
export function expSummaryProps(playerStats) {
  return { experience: playerStats?.experience ?? 0, expCosts: playerStats?.expCosts ?? null }
}

export function bagSummaryProps(playerStats) {
  return {
    count: playerStats?.items?.length ?? 0,
    weight: playerStats?.weight,
    weightMax: playerStats?.weightMax,
    food: playerStats?.food,
    magic: playerStats?.magic,
    coins: playerStats?.coins,
  }
}
