import { describe, it, expect } from 'vitest'
import { chromeScopeFor, CHROME_ALL, CHROME_NONE } from '../features/gameplay/js/chromeScope'

const ALL = { clock: true, weather: true, locations: true }
const NONE = { clock: false, weather: false, locations: false }

describe('chromeScopeFor (v0.37.6) — what an action answer makes stale', () => {
  it('an unknown answer refreshes everything (fail safe)', () => {
    expect(chromeScopeFor(null)).toEqual(ALL)
    expect(chromeScopeFor(undefined, 3)).toEqual(ALL)
    expect(chromeScopeFor('nope')).toEqual(ALL)
    expect(chromeScopeFor({})).toEqual(ALL)      // no clock, no flag
    expect(CHROME_ALL).toEqual(ALL)
    expect(CHROME_NONE).toEqual(NONE)
  })

  it('sleep: timeEndTriggered decides, else the clock number against the known one', () => {
    expect(chromeScopeFor({ timeEndTriggered: true, currentClock: 4 }, 3)).toEqual(ALL)
    expect(chromeScopeFor({ timeEndTriggered: false, currentClock: 3 }, 3)).toEqual(NONE)
    // flag false but the clock moved anyway (another player ended the time): trust the number
    expect(chromeScopeFor({ timeEndTriggered: false, currentClock: 4 }, 3)).toEqual(ALL)
    // flag false and no board clock to compare with: trust the flag
    expect(chromeScopeFor({ timeEndTriggered: false, currentClock: 4 }, null)).toEqual(NONE)
    expect(chromeScopeFor({ timeEndTriggered: false }, 3)).toEqual(NONE)
  })

  it('movement: new neighbours always, clock/weather only when the clock moved', () => {
    expect(chromeScopeFor({ toLocationUuid: 'l2', currentClock: 3 }, 3))
      .toEqual({ clock: false, weather: false, locations: true })
    expect(chromeScopeFor({ toLocationUuid: 'l2', currentClock: 4 }, 3)).toEqual(ALL)
    // no known clock and no flag: a clock number alone cannot say → advanced
    expect(chromeScopeFor({ toLocationUuid: 'l2', currentClock: 4 }, null)).toEqual(ALL)
  })

  it('event / choice / use-item: timeEnded, weatherApplied, movementApplied, registry', () => {
    const quiet = { timeEnded: false, currentClock: 3, weatherApplied: false, movementApplied: false }
    expect(chromeScopeFor(quiet, 3)).toEqual(NONE)
    expect(chromeScopeFor({ ...quiet, timeEnded: true, currentClock: 4 }, 3)).toEqual(ALL)
    expect(chromeScopeFor({ ...quiet, weatherApplied: true }, 3))
      .toEqual({ clock: false, weather: true, locations: true })
    expect(chromeScopeFor({ ...quiet, movementApplied: true }, 3))
      .toEqual({ clock: false, weather: false, locations: true })
    expect(chromeScopeFor({ ...quiet, locationChanges: [{ characterUuid: 'c' }] }, 3))
      .toEqual({ clock: false, weather: false, locations: true })
    expect(chromeScopeFor({ ...quiet, locationChanges: [] , registryChanges: [] }, 3)).toEqual(NONE)
    expect(chromeScopeFor({ ...quiet, registryChanges: [{ key: 'door' }] }, 3))
      .toEqual({ clock: false, weather: false, locations: true })
  })

  it('a drop-item style answer (only timeEnded:false) touches nothing', () => {
    expect(chromeScopeFor({ timeEnded: false }, 7)).toEqual(NONE)
  })
})
