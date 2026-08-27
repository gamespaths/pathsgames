import { describe, it, expect, vi } from 'vitest'
import { render, screen, isInaccessible } from '@testing-library/react'

vi.mock('../features/gameplay/ClockWidget', () => ({ default: () => <div data-testid="clock-widget" /> }))
vi.mock('../features/gameplay/cards/PlayerStats', () => ({ default: () => <div data-testid="player-stats" /> }))
vi.mock('../features/gameplay/SleepButton', () => ({ default: () => <div data-testid="sleep-button" /> }))

import {
  buildCardCharacteristics,
  buildCardCharacteristicsRight,
  resolveSelectionEntity,
  storySelectionCount,
  selectedTraitCount,
  movementEnergyCost,
  movementCostKey,
  buildLocationCosts,
  checkShowToSleepCard,
  isStatsCritical,
  isBagOverloaded,
} from '../utils/gamebook'

const STORY = {
  title: 'Test Story',
  card: { title: 'orig', urlImage: 'http://x/c.png', awesomeIcon: 'fa-x', linkCopyright: 'http://x' },
  classes: [{ uuid: 'c1', name: 'Mage', card: { title: 'Mage' } }],
  characterTemplates: [{ uuid: 'ch1', name: 'Hero', card: { title: 'Hero' } }],
  traits: [{ uuid: 't1', name: 'Brave', card: { title: 'Brave' } }, { uuid: 't2', name: 'Wise', card: {} }],
  difficulties: [{ uuid: 'd1', name: 'Hard', card: { title: 'Hard' } }],
}

const PLAYER = {
  description: 'a hero', classUuid: 'c1', characterTemplateUuid: 'ch1',
  traitUuids: ['t1', 't2'], difficultyUuid: 'd1',
}

describe('utils/gamebook — resolveSelectionEntity', () => {
  it('resolves each selection type to the matching story entity', () => {
    expect(resolveSelectionEntity(STORY, PLAYER, null, 'class')?.uuid).toBe('c1')
    expect(resolveSelectionEntity(STORY, PLAYER, null, 'character')?.uuid).toBe('ch1')
    expect(resolveSelectionEntity(STORY, PLAYER, null, 'difficulty')?.uuid).toBe('d1')
  })

  it('uses the first uuid for multi-select traits', () => {
    expect(resolveSelectionEntity(STORY, PLAYER, null, 'trait')?.uuid).toBe('t1')
  })

  it('returns null when the uuid is missing or unknown', () => {
    expect(resolveSelectionEntity(STORY, {}, null, 'class')).toBeNull()
    expect(resolveSelectionEntity(STORY, { classUuid: 'nope' }, null, 'class')).toBeNull()
    expect(resolveSelectionEntity(STORY, PLAYER, null, 'unknown')).toBeNull()
    expect(resolveSelectionEntity({}, PLAYER, null, 'class')).toBeNull()
  })
})

describe('utils/gamebook — counts', () => {
  it('storySelectionCount counts entities per type', () => {
    expect(storySelectionCount(STORY, 'class')).toBe(1)
    expect(storySelectionCount(STORY, 'trait')).toBe(2)
    expect(storySelectionCount(STORY, 'unknown')).toBe(0)
    expect(storySelectionCount({}, 'class')).toBe(0)
  })

  it('selectedTraitCount counts the selected trait uuids', () => {
    expect(selectedTraitCount(PLAYER)).toBe(2)
    expect(selectedTraitCount({})).toBe(0)
  })
})

describe('utils/gamebook — card builders', () => {
  const WEATHER = { idWeather: 2, card: { title: 'Storm', urlImage: 'http://x/storm.png', awesomeIcon: 'fa-bolt' } }

  it('buildCardCharacteristics copies the story card when there is no weather', () => {
    const card = buildCardCharacteristics(STORY, PLAYER, null, null)
    expect(card.urlImage).toBe('http://x/c.png')
    expect(card.awesomeIcon).toBe('fa-x')
    // returns a copy, not the same reference
    expect(card).not.toBe(STORY.card)
  })

  it('buildCardCharacteristics prefers the resolved weather card when present', () => {
    const card = buildCardCharacteristics(STORY, PLAYER, null, WEATHER)
    expect(card.title).toBe('Storm')
    expect(card.urlImage).toBe('http://x/storm.png')
  })

  it('buildCardCharacteristicsRight produces a JSX description flagged with descriptionTag', () => {
    const card = buildCardCharacteristicsRight(STORY, PLAYER, null, null, { matchUuid: 'm1' })
    expect(card.descriptionTag).toBe(true)
    render(<div>{card.description}</div>)
    expect(screen.getByTestId('player-stats')).toBeInTheDocument()
  })

  it('buildCardCharacteristicsRight uses the weather card image when present', () => {
    const card = buildCardCharacteristicsRight(STORY, PLAYER, null, WEATHER, { matchUuid: 'm1' })
    expect(card.urlImage).toBe('http://x/storm.png')
    expect(card.descriptionTag).toBe(true)
  })
})

describe('utils/gamebook — buildLocationCosts', () => {
  // The payload names a neighbor by the uuid of the location at the other end, so
  // two origins leading into the same place share it. Keyed on that uuid alone the
  // second entry silently replaces the first.
  const payload = {
    locations: [
      // where the player stands: reaching B costs 3 from here
      { idLocation: 1, neighbors: [{ uuid: 'b', totalEnergyCost: 3 }] },
      // another visited location, also bordering B, but a cheaper way in
      { idLocation: 3, neighbors: [{ uuid: 'b', totalEnergyCost: 1 }] },
    ],
  }

  it('keeps one entry per (origin, destination) pair instead of one per destination', () => {
    const costs = buildLocationCosts(payload)
    expect(costs[movementCostKey(1, 'b')]).toBe(3)
    expect(costs[movementCostKey(3, 'b')]).toBe(1)
  })

  it('does not let another origin overwrite the cost of the move the player can make', () => {
    // The backend lists the player's own location FIRST, so a destination-keyed map
    // always ends up holding some OTHER origin's cost — the board then advertises a
    // move as cheaper (or dearer) than it is.
    const costs = buildLocationCosts(payload)
    expect(movementEnergyCost({ uuid: 'b', energyCost: 2 }, costs, 1)).toBe(3)
    expect(movementEnergyCost({ uuid: 'b', energyCost: 2 }, costs, 3)).toBe(1)
  })

  it('skips entries the payload cannot place (no uuid, no origin id)', () => {
    const costs = buildLocationCosts({ locations: [
      { idLocation: 1, neighbors: [{ totalEnergyCost: 9 }] },
      { neighbors: [{ uuid: 'x', totalEnergyCost: 9 }] },
    ] })
    expect(costs).toEqual({})
    expect(buildLocationCosts(null)).toEqual({})
    expect(buildLocationCosts({ locations: [{ idLocation: 1 }] })).toEqual({})
  })
})

describe('utils/gamebook — movementEnergyCost', () => {
  it('prefers the weather-resolved cost of the move that leaves the current location', () => {
    expect(movementEnergyCost({ uuid: 'l1', energyCost: 5 }, { [movementCostKey(7, 'l1')]: 3 }, 7)).toBe(3)
  })
  it('falls back to the base edge cost, then to 0', () => {
    expect(movementEnergyCost({ uuid: 'l1', energyCost: 5 }, {}, 7)).toBe(5)
    expect(movementEnergyCost({ uuid: 'l1' }, {}, 7)).toBe(0)
    expect(movementEnergyCost(null)).toBe(0)
  })
  it('falls back to the base cost when the origin is unknown or has no path there', () => {
    const costs = { [movementCostKey(7, 'l1')]: 3 }
    // no origin (the board has not resolved the player's location yet)
    expect(movementEnergyCost({ uuid: 'l1', energyCost: 5 }, costs)).toBe(5)
    // a far node picked on the map: no edge from here, so no total to quote
    expect(movementEnergyCost({ uuid: 'l1', energyCost: 5 }, costs, 99)).toBe(5)
  })
})

describe('utils/gamebook — checkShowToSleepCard', () => {
  it('hides the sleep card while everything on the board is affordable', () => {
    const show = checkShowToSleepCard({
      playerStats: { energy: 4 },
      locations: [{ uuid: 'l1' }], // resolved cost 4 → affordable
      actions: [{ uuid: 'a1', energyCost: 4 }],
      locationCosts: { [movementCostKey(7, 'l1')]: 4 },
      hereLocationId: 7,
    })
    expect(show).toBe(false)
  })

  it('shows the sleep card when every movement costs more than the current energy', () => {
    const show = checkShowToSleepCard({
      playerStats: { energy: 2 },
      locations: [{ uuid: 'l1' }, { uuid: 'l2', energyCost: 5 }],
      actions: [],
      locationCosts: { [movementCostKey(7, 'l1')]: 3 }, // l1 costs 3, l2 costs 5 — both > 2
      hereLocationId: 7,
    })
    expect(show).toBe(true)
  })

  // The rule the card follows: ONE thing out of reach is already a reason to rest, even
  // while the player still has plenty else they could do.
  it('shows the sleep card when a single movement is out of reach among affordable ones', () => {
    const show = checkShowToSleepCard({
      playerStats: { energy: 4 },
      locations: [{ uuid: 'l1' }, { uuid: 'l2', energyCost: 9 }], // l1 costs 2, l2 costs 9
      actions: [],
      locationCosts: { [movementCostKey(7, 'l1')]: 2 },
      hereLocationId: 7,
    })
    expect(show).toBe(true)
  })

  it('shows the sleep card when a single costed action is out of reach', () => {
    const show = checkShowToSleepCard({
      playerStats: { energy: 4 },
      locations: [{ uuid: 'l1', energyCost: 1 }],           // affordable
      actions: [{ uuid: 'a1', energyCost: 2 },              // affordable
                { uuid: 'a2', energyCost: 6 }],             // out of reach → rest
      locationCosts: {},
    })
    expect(show).toBe(true)
  })

  it('ignores actions with no positive energy cost (0 or absent); they never suppress the sleep card', () => {
    // Move l1 costs 5 (unaffordable at energy 0); the two actions have no
    // positive cost → ignored → still stuck.
    const show = checkShowToSleepCard({
      playerStats: { energy: 0 },
      locations: [{ uuid: 'l1' }],
      actions: [{ uuid: 'a1' }, { uuid: 'a2', energyCost: 0 }],
      locationCosts: { [movementCostKey(7, 'l1')]: 5 },
      hereLocationId: 7,
    })
    expect(show).toBe(true)
  })

  // An affordable action no longer hides the card while a move is priced out: the move the
  // player cannot make is the reason to rest, whatever else is still within reach.
  it('shows the sleep card for an unaffordable move even when a costed action is affordable', () => {
    const show = checkShowToSleepCard({
      playerStats: { energy: 5 },
      locations: [{ uuid: 'l1', energyCost: 9 }], // move unaffordable (9 > 5)
      actions: [{ uuid: 'a1', energyCost: 3 }],   // action affordable (5 >= 3)
      locationCosts: {},
    })
    expect(show).toBe(true)
  })

  it('shows the sleep card when a costed action is present but unaffordable', () => {
    const show = checkShowToSleepCard({
      playerStats: { energy: 1 },
      locations: [{ uuid: 'l1' }],
      actions: [{ uuid: 'a1', energyCost: 3 }], // needs 3, has 1 → unaffordable
      locationCosts: { [movementCostKey(7, 'l1')]: 5 },
      hereLocationId: 7,
    })
    expect(show).toBe(true)
  })

  it('ignores end-game actions (escape hatches never suppress the sleep card)', () => {
    const show = checkShowToSleepCard({
      playerStats: { energy: 1 },
      locations: [{ uuid: 'l1', energyCost: 5 }],
      actions: [{ uuid: 'a1', endGame: true }], // excluded → still stuck
      locationCosts: {},
    })
    expect(show).toBe(true)
  })

  // Unchanged and independent of energy: a board with no open location left.
  it('shows the sleep card when there is nothing to do at all', () => {
    expect(checkShowToSleepCard({ playerStats: { energy: 10 } })).toBe(true)
    expect(checkShowToSleepCard()).toBe(true)
    expect(checkShowToSleepCard({
      playerStats: { energy: 10 },
      locations: [{ uuid: 'l1', energyCost: 1, available: false }],
    })).toBe(true)
  })
})

describe('utils/gamebook — the bookmark alarms', () => {
  const FINE = { life: 5, energy: 5, sadness: 1, sadnessMax: 5, weight: 7, weightMax: 30 }

  it('says nothing is wrong while every statistic has room left', () => {
    expect(isStatsCritical(FINE)).toBe(false)
    expect(isBagOverloaded(FINE)).toBe(false)
  })

  it('fires on a life or an energy about to run out', () => {
    expect(isStatsCritical({ ...FINE, life: 1 })).toBe(true)
    expect(isStatsCritical({ ...FINE, life: 0 })).toBe(true)
    expect(isStatsCritical({ ...FINE, life: 2 })).toBe(false)
    expect(isStatsCritical({ ...FINE, energy: 1 })).toBe(true)
    expect(isStatsCritical({ ...FINE, energy: 2 })).toBe(false)
  })

  it('fires on a sadness at its ceiling, and on the last step before it', () => {
    expect(isStatsCritical({ ...FINE, sadness: 5, sadnessMax: 5 })).toBe(true)
    expect(isStatsCritical({ ...FINE, sadness: 6, sadnessMax: 5 })).toBe(true)
    expect(isStatsCritical({ ...FINE, sadness: 4, sadnessMax: 5 })).toBe(false)
  })

  it('treats a statistic the backend has not projected as unknown, never as an alarm', () => {
    expect(isStatsCritical({})).toBe(false)
    expect(isStatsCritical(null)).toBe(false)
    expect(isStatsCritical({ sadness: 9 })).toBe(false)          // no ceiling to compare with
    expect(isStatsCritical({ life: null, energy: undefined })).toBe(false)
  })

  it('fires only PAST the limit: a bag exactly at capacity is full, not overloaded', () => {
    expect(isBagOverloaded({ weight: 31, weightMax: 30 })).toBe(true)
    expect(isBagOverloaded({ weight: 30, weightMax: 30 })).toBe(false)
    expect(isBagOverloaded({ weight: 29, weightMax: 30 })).toBe(false)
  })

  it('never fires without both figures — an unknown weight is not a bad one', () => {
    expect(isBagOverloaded({ weight: 5 })).toBe(false)
    expect(isBagOverloaded({ weight: 5, weightMax: 0 })).toBe(false)
    expect(isBagOverloaded({ weightMax: 30 })).toBe(false)
    expect(isBagOverloaded(null)).toBe(false)
  })
})
