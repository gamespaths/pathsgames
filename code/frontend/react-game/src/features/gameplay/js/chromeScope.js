/**
 * v0.37.6 — which side payloads (clock / weather / locations) an action's answer makes
 * stale. Every action used to refetch all three; most answers already say what moved.
 *
 * Rules, most specific first — an unknown answer refreshes everything (fail safe):
 *   - clock: `timeEnded` / `timeEndTriggered` true, or the answer's `currentClock` differs
 *     from the clock the board knows. An answer with NO clock information at all counts
 *     as advanced.
 *   - weather: follows the clock (a new time unit re-selects it), or `weatherApplied`.
 *   - locations: follows the weather (it changes the move costs), a movement (new
 *     neighbours: `toLocationUuid`, `movementApplied`, `locationChanges`), or a registry
 *     write (a key can open an edge).
 */
export const CHROME_ALL = Object.freeze({ clock: true, weather: true, locations: true })
export const CHROME_NONE = Object.freeze({ clock: false, weather: false, locations: false })

export function chromeScopeFor(result, knownClock = null) {
  if (!result || typeof result !== 'object') return CHROME_ALL

  const hasClockNumber = typeof result.currentClock === 'number'
  const hasEndFlag = typeof result.timeEnded === 'boolean' || typeof result.timeEndTriggered === 'boolean'
  let clock
  if (result.timeEnded === true || result.timeEndTriggered === true) {
    clock = true
  } else if (hasClockNumber) {
    // A known board clock to compare with, else trust the flag if there is one.
    clock = typeof knownClock === 'number' ? result.currentClock !== knownClock : !hasEndFlag
  } else {
    clock = !hasEndFlag
  }

  const weather = clock || result.weatherApplied === true
  const moved = result.movementApplied === true
    || result.toLocationUuid != null
    || (Array.isArray(result.locationChanges) && result.locationChanges.length > 0)
  const registry = Array.isArray(result.registryChanges) && result.registryChanges.length > 0
  const locations = weather || moved || registry

  return { clock, weather, locations }
}
