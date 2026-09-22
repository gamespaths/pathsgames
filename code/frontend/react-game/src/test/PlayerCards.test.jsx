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

  // v0.38.3 — a trait's cost is badged in-game only on the sides the difficulty budgets,
  // ahead of its stats, and a zero cost is left out as noise.
  it('badges the trait cost on the budgeted sides only, non-zero, before the stats', () => {
    const storyFull = {
      ...STORY_FULL,
      traits: [
        { uuid: 't1', costPositive: 2, costNegative: 1, life: 3, card: { title: 'Brave' } },
        { uuid: 't2', costPositive: 0, dexterity: 1, card: { title: 'Quick' } },
      ],
      difficulties: [{ uuid: 'd1', traitCostPositiveBudget: 3, energy: 4, card: { title: 'Hard' } }],
    }
    render(<PlayerCards storyFull={storyFull} story={STORY}
      playerStats={PLAYER_STATS} gameData={GAME_DATA} onPreview={vi.fn()} />)
    const traitCards = capturedCards.filter(c => c.entityType === 'trait')
    expect(traitCards[0].statistics.map(i => i.key)).toEqual(['costPositive', 'life'])
    expect(traitCards[1].statistics.map(i => i.key)).toEqual(['dexterity'])
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
    fireEvent.click(screen.getByTestId('preview-class'))
    expect(onPreview).toHaveBeenCalledWith({
      card: STORY_FULL.classes[0].card, type: 'class', stats: expect.any(Array), side: 'left' })
    fireEvent.click(screen.getByTestId('preview-character'))
    expect(onPreview).toHaveBeenCalledWith({
      card: STORY_FULL.characterTemplates[0].card, type: 'character', stats: expect.any(Array), side: 'left' })
    fireEvent.click(screen.getAllByTestId('preview-trait')[1])
    expect(onPreview).toHaveBeenCalledWith({
      card: STORY_FULL.traits[1].card, type: 'trait', stats: expect.any(Array), side: 'left' })
    fireEvent.click(screen.getByTestId('preview-difficulty'))
    expect(onPreview).toHaveBeenCalledWith({
      card: STORY_FULL.difficulties[0].card, type: 'difficulty', stats: expect.any(Array), side: 'left' })
    fireEvent.click(screen.getByTestId('preview-story'))
    expect(onPreview).toHaveBeenCalledWith({ card: STORY.card, type: 'story', side: 'left' })
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

// ── v0.37.4 — the story card is a story card: the match history left the board ──────

describe('PlayerCards — story card', () => {
  beforeEach(() => { capturedCards.length = 0 })

  it('never badges the story tile as the history any more', () => {
    render(<PlayerCards storyFull={STORY_FULL} story={STORY}
      playerStats={PLAYER_STATS} gameData={GAME_DATA}
      onPreview={vi.fn()} previewSide="right" />)

    expect(screen.queryByTestId('preview-matchlog')).toBeNull()
    expect(screen.getByTestId('preview-story')).toBeInTheDocument()
  })

  it('opens the story card on the side it was given', () => {
    const onPreview = vi.fn()
    render(<PlayerCards storyFull={STORY_FULL} story={STORY}
      playerStats={PLAYER_STATS} gameData={GAME_DATA}
      onPreview={onPreview} previewSide="right" />)

    fireEvent.click(screen.getByTestId('preview-story'))
    expect(onPreview).toHaveBeenCalledWith({ card: STORY.card, type: 'story', side: 'right' })
  })
})

// v0.37.7 — the match history card sits right before the story card, only when the board
// hands over a way to open it; its action opens the history on the right page.
vi.mock('@/features/matches/MatchHistoryCard', () => ({
  default: ({ onOpen }) => <button data-testid="card-matchlog" onClick={onOpen}>history</button>,
}))

describe('PlayerCards — match history door', () => {
  it('lists no history card without an opener', () => {
    renderCards()
    expect(screen.queryByTestId('card-matchlog')).toBeNull()
  })

  it('puts the history card right before the story card and opens it on click', () => {
    const onOpenHistory = vi.fn()
    const { container } = render(<PlayerCards storyFull={STORY_FULL} story={STORY}
      playerStats={PLAYER_STATS} gameData={GAME_DATA} onPreview={vi.fn()}
      onOpenHistory={onOpenHistory} />)
    const ids = [...container.querySelectorAll('[data-testid^="card-"]')]
      .map(el => el.getAttribute('data-testid'))
    const history = ids.indexOf('card-matchlog')
    expect(history).toBeGreaterThan(-1)
    expect(ids[history + 1]).toBe('card-story')
    expect(ids[history - 1]).toBe('card-difficulty')
    fireEvent.click(screen.getByTestId('card-matchlog'))
    expect(onOpenHistory).toHaveBeenCalledTimes(1)
  })
})
