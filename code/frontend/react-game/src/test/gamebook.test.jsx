import { describe, it, expect, vi } from 'vitest'
import { render, screen, isInaccessible } from '@testing-library/react'

vi.mock('../features/gameplay/ClockWidget', () => ({ default: () => <div data-testid="clock-widget" /> }))
vi.mock('../features/gameplay/PlayerStats', () => ({ default: () => <div data-testid="player-stats" /> }))
vi.mock('../features/gameplay/SleepButton', () => ({ default: () => <div data-testid="sleep-button" /> }))

import {
  buildCardCharacteristics,
  buildCardCharacteristicsRight,
  resolveSelectionEntity,
  storySelectionCount,
  selectedTraitCount,
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
  it('buildCardCharacteristics strips image/icon and uses the player description', () => {
    const card = buildCardCharacteristics(STORY, PLAYER, null)
    expect(card.urlImage).toBeNull()
    expect(card.awesomeIcon).toBeNull()
    expect(card.description).toBe('a hero')
    render(<div>{card.title}</div>)
    expect(screen.getByTestId('clock-widget')).toBeInTheDocument()
  })

  it('buildCardCharacteristicsRight produces a JSX description flagged with descriptionTag', () => {
    const card = buildCardCharacteristicsRight(STORY, PLAYER, null, { matchUuid: 'm1' })
    expect(card.descriptionTag).toBe(true)
    expect(card.urlImage).toBeNull()
    render(<div>{card.title}{card.description}</div>)
    expect(screen.getByTestId('player-stats')).toBeInTheDocument()
    expect(screen.getByTestId('sleep-button')).toBeInTheDocument()
  })
})
