/**
 * The bag summary the backpack card shows wherever it appears (left page, statistics list).
 * One reader, so the two render points can never drift apart.
 */
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
