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
  checkShowToSleepCard,
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

describe('utils/gamebook — movementEnergyCost', () => {
  it('prefers the weather-resolved cost keyed by uuid', () => {
    expect(movementEnergyCost({ uuid: 'l1', energyCost: 5 }, { l1: 3 })).toBe(3)
  })
  it('falls back to the base edge cost, then to 0', () => {
    expect(movementEnergyCost({ uuid: 'l1', energyCost: 5 }, {})).toBe(5)
    expect(movementEnergyCost({ uuid: 'l1' }, {})).toBe(0)
    expect(movementEnergyCost(null)).toBe(0)
  })
})

describe('utils/gamebook — checkShowToSleepCard', () => {
  it('hides the sleep card when a movement is still affordable', () => {
    const show = checkShowToSleepCard({
      playerStats: { energy: 4 },
      locations: [{ uuid: 'l1' }], // resolved cost 4 → affordable
      actions: [],
      locationCosts: { l1: 4 },
    })
    expect(show).toBe(false)
  })

  it('shows the sleep card when every movement costs more than the current energy', () => {
    const show = checkShowToSleepCard({
      playerStats: { energy: 2 },
      locations: [{ uuid: 'l1' }, { uuid: 'l2', energyCost: 5 }],
      actions: [],
      locationCosts: { l1: 3 }, // l1 costs 3, l2 costs 5 — both > 2
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
      locationCosts: { l1: 5 },
    })
    expect(show).toBe(true)
  })

  it('hides the sleep card when a costed action is affordable', () => {
    const show = checkShowToSleepCard({
      playerStats: { energy: 5 },
      locations: [{ uuid: 'l1', energyCost: 9 }], // move unaffordable (9 > 5)
      actions: [{ uuid: 'a1', energyCost: 3 }],   // action affordable (5 >= 3)
      locationCosts: {},
    })
    expect(show).toBe(false)
  })

  it('shows the sleep card when a costed action is present but unaffordable', () => {
    const show = checkShowToSleepCard({
      playerStats: { energy: 1 },
      locations: [{ uuid: 'l1' }],
      actions: [{ uuid: 'a1', energyCost: 3 }], // needs 3, has 1 → unaffordable
      locationCosts: { l1: 5 },
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

  it('shows the sleep card when there is nothing to do at all', () => {
    expect(checkShowToSleepCard({ playerStats: { energy: 10 } })).toBe(true)
    expect(checkShowToSleepCard()).toBe(true)
  })
})
