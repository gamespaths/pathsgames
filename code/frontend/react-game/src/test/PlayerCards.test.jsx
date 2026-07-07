import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k }),
}))
const capturedCards = []
vi.mock('@/components/layout/Card', () => ({
  default: (props) => {
    capturedCards.push(props)
    const { card, entityType, onPreview, statistics, flagShowFullStatistics } = props
    return (
      <div data-testid={`card-${entityType}`}>
        <span data-testid={`title-${entityType}`}>{card?.title}</span>
        {flagShowFullStatistics && statistics?.length > 0 && (
          <div data-testid={`overlay-${entityType}`}>
            {statistics.map(i => <span key={i.key} data-testid={`badge-${i.key}`}>{i.value}</span>)}
          </div>
        )}
        {onPreview && <button data-testid={`preview-${entityType}`} onClick={onPreview}>preview</button>}
      </div>
    )
  },
}))

import PlayerCards from '../features/gameplay/cards/PlayerCards'

const STORY_FULL = {
  classes: [{ uuid: 'c1', weightMax: 10, dexterityBase: 2, card: { title: 'Warrior' } }],
  characterTemplates: [{ uuid: 'ch1', lifeMax: 20, energyMax: 5, card: { title: 'Hero' } }],
  traits: [
    { uuid: 't1', life: 3, card: { title: 'Brave' } },
    { uuid: 't2', dexterity: 1, card: { title: 'Quick' } },
  ],
  difficulties: [{ uuid: 'd1', energy: 4, expCost: 2, card: { title: 'Hard' } }],
}
const STORY = { card: { title: 'The Tale' } }
const PLAYER_STATS = {
  classUuid: 'c1',
  characterTemplateUuid: 'ch1',
  traitUuids: ['t1', 't2'],
  difficultyUuid: 'd1',
}
const GAME_DATA = { match: {} }

function renderCards(onPreview = vi.fn()) {
  render(<PlayerCards storyFull={STORY_FULL} story={STORY}
    playerStats={PLAYER_STATS} gameData={GAME_DATA} onPreview={onPreview} />)
}

describe('PlayerCards', () => {
  beforeEach(() => {
    capturedCards.length = 0
  })

  it('renders the class, character, two trait, difficulty and story cards', () => {
    renderCards()
    expect(screen.getByTestId('title-class').textContent).toBe('Warrior')
    expect(screen.getByTestId('title-character').textContent).toBe('Hero')
    expect(screen.getAllByTestId('card-trait')).toHaveLength(2)
    expect(screen.getByTestId('title-difficulty').textContent).toBe('Hard')
    expect(screen.getByTestId('title-story').textContent).toBe('The Tale')
  })

  it('overlays the entity stat badges on the class/character/trait/difficulty images', () => {
    renderCards()
    expect(screen.getByTestId('overlay-class')).toBeInTheDocument()
    expect(screen.getByTestId('overlay-character')).toBeInTheDocument()
    expect(screen.getAllByTestId('overlay-trait')).toHaveLength(2)
    expect(screen.getByTestId('overlay-difficulty')).toBeInTheDocument()
  })

  it('includes the difficulty energy-per-sleep badge with the difficulty stats', () => {
    renderCards()
    expect(screen.getByTestId('badge-energy').textContent).toBe('4')
    expect(screen.getByTestId('badge-expCost').textContent).toBe('2')
  })

  it('does not overlay a badge list on the story card', () => {
    renderCards()
    const storyCard = capturedCards.find(c => c.entityType === 'story')
    expect(storyCard.statistics).toBeUndefined()
    expect(screen.queryByTestId('overlay-story')).toBeNull()
  })

  it('forwards each entity card and its stat items to onPreview', () => {
    const onPreview = vi.fn()
    renderCards(onPreview)
    // onPreview signature: (card, type, lockReason, statItems, showModal, additionalProps, previewSide)
    fireEvent.click(screen.getByTestId('preview-class'))
    expect(onPreview).toHaveBeenCalledWith(
      STORY_FULL.classes[0].card, 'class', null, expect.any(Array), true, null, 'left',
    )
    fireEvent.click(screen.getByTestId('preview-character'))
    expect(onPreview).toHaveBeenCalledWith(
      STORY_FULL.characterTemplates[0].card, 'character', null, expect.any(Array), true, null, 'left',
    )
    fireEvent.click(screen.getAllByTestId('preview-trait')[1])
    expect(onPreview).toHaveBeenCalledWith(
      STORY_FULL.traits[1].card, 'trait', null, expect.any(Array), true, null, 'left',
    )
    fireEvent.click(screen.getByTestId('preview-difficulty'))
    expect(onPreview).toHaveBeenCalledWith(
      STORY_FULL.difficulties[0].card, 'difficulty', null, expect.any(Array), true, null, 'left',
    )
    fireEvent.click(screen.getByTestId('preview-story'))
    expect(onPreview).toHaveBeenCalledWith(STORY.card, 'story', null, null, true, null, 'left')
  })

  it('omits the overlay when the entity has no non-zero stats', () => {
    const story = {
      ...STORY_FULL,
      classes: [{ uuid: 'c1', weightMax: 0, dexterityBase: 0, card: { title: 'Plain' } }],
    }
    render(<PlayerCards storyFull={story} story={STORY}
      playerStats={PLAYER_STATS} gameData={GAME_DATA} onPreview={vi.fn()} />)
    expect(screen.queryByTestId('overlay-class')).toBeNull()
  })

  it('still renders a trait card when its uuid does not resolve to a story entity', () => {
    render(<PlayerCards storyFull={STORY_FULL} story={STORY}
      playerStats={{ ...PLAYER_STATS, traitUuids: ['unknown'] }}
      gameData={GAME_DATA} onPreview={vi.fn()} />)
    expect(screen.getAllByTestId('card-trait')).toHaveLength(1)
    expect(screen.queryByTestId('overlay-trait')).toBeNull()
  })

  it('renders no trait cards when the player has no traits', () => {
    render(<PlayerCards storyFull={STORY_FULL} story={STORY}
      playerStats={{ ...PLAYER_STATS, traitUuids: [] }} gameData={GAME_DATA} onPreview={vi.fn()} />)
    expect(screen.queryByTestId('card-trait')).toBeNull()
  })
})
