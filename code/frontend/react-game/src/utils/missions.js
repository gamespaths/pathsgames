/**
 * The missions as the board reads them. Step 37 — the backend already sends only the missions
 * this match has reached, with their steps in order and each one flagged done, so the board
 * neither filters nor sorts what a mission is worth.
 */
const ORDER = { ACTIVE: 0, AVAILABLE: 1, COMPLETED: 2, FAILED: 3 }

/** The missions of the match, open ones first: what is still to do is what is worth reading. */
export function orderedMissions(missions) {
  const rows = Array.isArray(missions) ? missions : []
  return [...rows].sort((a, b) =>
    (ORDER[a?.status] ?? 9) - (ORDER[b?.status] ?? 9)
    || (a?.name ?? '').localeCompare(b?.name ?? ''))
}

/** The missions still open — the number the card carries before anything is opened. */
export function openMissions(missions) {
  return orderedMissions(missions).filter(m => m?.status === 'AVAILABLE' || m?.status === 'ACTIVE')
}

/** How far down the steps a mission is: `{ done, total }`, both 0 when it has no steps. */
export function missionProgress(mission) {
  const steps = Array.isArray(mission?.steps) ? mission.steps : []
  return { done: steps.filter(s => s?.done).length, total: steps.length }
}

/** The progress as the badge writes it: "2/3", or null for a mission with no steps at all. */
export function missionProgressLabel(mission) {
  const { done, total } = missionProgress(mission)
  return total === 0 ? null : `${done}/${total}`
}
