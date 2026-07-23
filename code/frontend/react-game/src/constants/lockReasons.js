/**
 * The icon of a refusal — one table, for every card that can render one.
 *
 * The backend refuses a move (action/move) and an action (execute-event) with the SAME kind of
 * answer: a code. Both cards therefore ask the same question — "which icon for this code?" —
 * and it is answered here, once, instead of in an `if` per card. Codes shared by the two
 * systems (COMA, SLEEPING) appear once; the two names for "not enough energy"
 * (INSUFFICIENT_ENERGY for movement, NOT_ENOUGH_ENERGY for events) map to the same icon.
 *
 * The icon says what the player should do about it, not merely that they cannot: a bed means
 * "go to sleep and come back", a lock means "something is still missing". `fa-ban` is the
 * fallback and means only "you cannot" — so an unknown code degrades to it rather than
 * rendering nothing.
 */
export const LOCK_ICON_DEFAULT = 'fas fa-ban'

export const LOCK_REASON_ICONS = {
  // the character's own state — shared by movement and actions
  COMA: 'fas fa-heartbeat',
  SLEEPING: 'fas fa-moon',
  CHARACTER_CANNOT_ACT: LOCK_ICON_DEFAULT,
  MATCH_NOT_RUNNING: 'fas fa-pause',

  // resources: the bed points at the way out of an energy problem (go to sleep)
  INSUFFICIENT_ENERGY: 'fas fa-bed',
  NOT_ENOUGH_ENERGY: 'fas fa-bed',
  NOT_ENOUGH_COINS: 'fas fa-coins',
  OVERWEIGHT: 'fas fa-weight-hanging',

  // movement
  NOT_A_NEIGHBOR: 'fas fa-route',
  MOVEMENT_CONDITION_NOT_MET: 'fas fa-lock',
  LOCATION_FULL: 'fas fa-users',

  // actions
  EVENT_NOT_EXECUTABLE_TYPE: LOCK_ICON_DEFAULT,
  ONCE_ALREADY_CONSUMED: 'fas fa-check',
  WRONG_LOCATION: 'fas fa-map-marker-alt',
  REGISTRY_CONDITION_NOT_MET: 'fas fa-lock',
  WEATHER_CONDITION_NOT_MET: 'fas fa-cloud-sun',
  ITEM_CONDITION_NOT_MET: 'fas fa-flask',
  CLASS_CONDITION_NOT_MET: 'fas fa-hat-wizard',

  LOADING : 'fas fa-spinner fa-spin',
}

/** The icon for a refusal code; `fa-ban` when the code is unknown or absent. */
export function lockedIconFor(reason) {
  return (reason && LOCK_REASON_ICONS[reason]) || LOCK_ICON_DEFAULT
}
