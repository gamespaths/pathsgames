/**
 * The missions as the board reads them. Step 37 — the backend already sends only the missions
 * this match has reached, with their steps in order and each one flagged done, so the board
 * neither filters nor sorts what a mission is worth.
 */
// A COMPLETED mission is ALWAYS last, after even a status the board does not know.
const ORDER = { ACTIVE: 0, AVAILABLE: 1, FAILED: 2, COMPLETED: 99 }

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

/** The card a mission reads as: the authored one, else its name and description. */
export function missionCard(mission) {
  return {
    ...(mission?.card ?? {}),
    title: mission?.card?.title || mission?.name,
    description: mission?.card?.description || mission?.description,
  }
}

/** The green a done mission is drawn in — the same one .bonus-badge--done paints the text. */
export const MISSION_DONE_COLOR = '#1e7d3a'

/** Step 40 — the green of a Completed check glyph, the same as the story list (.story-card-status__check). */
export const MISSION_CHECK_COLOR = '#4ade80'

/** The glyph each status wears, wherever it is drawn. Font Awesome 5 names: the game loads 5. */
export const MISSION_STATUS_ICON = {
  AVAILABLE: 'fas fa-clipboard-list',
  ACTIVE: 'fas fa-hourglass-half',
  COMPLETED: 'fas fa-check-circle',
  FAILED: 'fas fa-times-circle',
}

/**
 * The badge a CLOSED mission wears on its little card — and the very same one a DONE step
 * wears on its own: done is done, and two spellings of it would read as two different things.
 *
 * v0.37.3 — no `label`: "Completed" next to the check glyph says it, and "Status: Completed"
 * only spent a word repeating what the badge already is.
 */
export function missionStatusBadge(t, status) {
  return {
    key: 'missionStatus',
    value: t(`game.missions.status.${status}`) || status,
    icon: MISSION_STATUS_ICON[status] ?? MISSION_STATUS_ICON.AVAILABLE,
    color: status === 'COMPLETED' ? MISSION_CHECK_COLOR : null,
    keepZero: true, // a word, not a number: never dropped by the zero filter
  }
}

/**
 * v0.38.2 — the ONE badge the "mission completed" page wears in place of "Status: Completed":
 * it is an announcement, not a state, so it reads as a sentence and in green, glyph included.
 */
export function missionCompletedBadge(t) {
  return {
    key: 'missionCompleted',
    value: t('game.missions.completed'),
    label: null,
    icon: MISSION_STATUS_ICON.COMPLETED,
    color: MISSION_DONE_COLOR,
    className: 'bonus-badge--done',
  }
}

/** Step 40 — the step-progress badge ("2/3"), the same on the little card and on the page. */
export function missionStepsBadge(t, progress) {
  return { key: 'missionSteps', value: progress, label: t('game.missions.progress'),
    icon: 'fas fa-list-ol', color: null }
}

/**
 * The badges a mission's READING page carries: its status and, when it has steps, how far down
 * them it is. Step 40 — the very badges of the little card, glyphs included, so none reads grey.
 */
export function missionPageStats(t, mission) {
  const progress = missionProgressLabel(mission)
  return [
    { ...missionStatusBadge(t, mission?.status), label: t('game.missions.statusLabel') },
    ...(progress ? [missionStepsBadge(t, progress)] : []),
  ]
}
