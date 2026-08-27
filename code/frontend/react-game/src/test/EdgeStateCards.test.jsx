import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k }),
}))
vi.mock('@/utils/loadoutCards', () => ({
  buildCardSad: () => ({ title: 'game.sad.title', description: 'game.sad.description' }),
  buildCardComa: () => ({ title: 'game.coma.title', description: 'game.coma.description' }),
}))

let captured = {}
vi.mock('@/components/layout/Card', () => ({
  default: ({ card, onPreview, onClose, onForward, variant, entityType, statItemsToPageContent, hidePreview }) => {
    captured = { card, onPreview, onClose, onForward, variant, entityType, statItemsToPageContent, hidePreview }
    return (
      <div data-testid="card">
        <span data-testid="card-title">{card?.title}</span>
        <span data-testid="card-description">{card?.description}</span>
        <span data-testid="card-variant">{variant || 'board'}</span>
        <span data-testid="card-entity">{entityType}</span>
        {onPreview && <button data-testid="preview-btn" onClick={onPreview}>preview</button>}
        {onClose && <button data-testid="close-btn" onClick={onClose}>back</button>}
        {onForward && <button data-testid="forward-btn" onClick={onForward}>forward</button>}
      </div>
    )
  },
}))

import SadnessCard from '../features/gameplay/cards/SadnessCard'
import ComaCard from '../features/gameplay/cards/ComaCard'

const STORY = { uuid: 's1', title: 'Story' }

beforeEach(() => {
  captured = {}
  vi.clearAllMocks()
})

describe('SadnessCard (Step 30)', () => {
  it('renders the sadness card on the board with a preview handler', () => {
    render(<SadnessCard story={STORY} onPreview={vi.fn()} />)

    expect(screen.getByTestId('card-title')).toHaveTextContent('game.sad.title')
    expect(screen.getByTestId('card-entity')).toHaveTextContent('sad')
    expect(screen.getByTestId('card-variant')).toHaveTextContent('board')
    expect(screen.getByTestId('preview-btn')).toBeInTheDocument()
  })

  it('renders as a full reading page when onBack is given, with no preview lens', () => {
    const onBack = vi.fn()
    render(<SadnessCard story={STORY} onBack={onBack} />)

    expect(screen.getByTestId('card-variant')).toHaveTextContent('page')
    expect(captured.hidePreview).toBe(true)
    fireEvent.click(screen.getByTestId('close-btn'))
    expect(onBack).toHaveBeenCalled()
  })

  it('shows the life it cost when the caller knows the constitution', () => {
    render(<SadnessCard story={STORY} lifeLost={7} onBack={vi.fn()} />)

    expect(captured.statItemsToPageContent).toEqual([
      { key: 'life', value: '-7', label: 'game.stats.life' },
    ])
  })

  it('omits the stat item when the constitution is unknown', () => {
    render(<SadnessCard story={STORY} onBack={vi.fn()} />)
    expect(captured.statItemsToPageContent).toEqual([])
  })

  it('forwards the requested side to onPreview', () => {
    const onPreview = vi.fn()
    render(<SadnessCard story={STORY} onPreview={onPreview} previewSide="right" />)

    fireEvent.click(screen.getByTestId('preview-btn'))
    const { type, side } = onPreview.mock.calls[0][0]
    expect(type).toBe('sad')
    expect(side).toBe('right')
  })
})

describe('ComaCard (Step 30)', () => {
  it('renders its own copy for a personal coma', () => {
    render(<ComaCard story={STORY} onBack={vi.fn()} />)

    expect(screen.getByTestId('card-title')).toHaveTextContent('game.coma.title')
    expect(screen.getByTestId('card-entity')).toHaveTextContent('coma')
  })

  it("prefers the story's epilogue card when the whole party is down", () => {
    const comaEventCard = { title: 'The dark closes in', description: 'Everything fades.' }
    render(<ComaCard story={STORY} allPlayers comaEventCard={comaEventCard} onBack={vi.fn()} />)

    expect(screen.getByTestId('card-title')).toHaveTextContent('The dark closes in')
    expect(screen.getByTestId('card-description')).toHaveTextContent('Everything fades.')
  })

  it('falls back to the party copy when the story authored no epilogue', () => {
    render(<ComaCard story={STORY} allPlayers onBack={vi.fn()} />)

    expect(screen.getByTestId('card-title')).toHaveTextContent('game.allComa.title')
    expect(screen.getByTestId('card-description')).toHaveTextContent('game.allComa.description')
  })

  it('fills in only the missing half of a partially authored epilogue card', () => {
    render(<ComaCard story={STORY} allPlayers comaEventCard={{ title: 'Silence' }} onBack={vi.fn()} />)

    expect(screen.getByTestId('card-title')).toHaveTextContent('Silence')
    expect(screen.getByTestId('card-description')).toHaveTextContent('game.allComa.description')
  })

  it('does not mutate the card object it was given', () => {
    const comaEventCard = { title: 'Silence' }
    render(<ComaCard story={STORY} allPlayers comaEventCard={comaEventCard} onBack={vi.fn()} />)

    expect(comaEventCard).toEqual({ title: 'Silence' })
  })

  it('renders as a board card with a preview handler when onBack is absent', () => {
    const onPreview = vi.fn()
    render(<ComaCard story={STORY} onPreview={onPreview} />)

    expect(screen.getByTestId('card-variant')).toHaveTextContent('board')
    fireEvent.click(screen.getByTestId('preview-btn'))
    expect(onPreview.mock.calls[0][0].type).toBe('coma')
  })
})

describe('Edge cards defer the weather via a forward arrow (v0.30.x)', () => {
  it('SadnessCard renders a forward arrow when onForward is given', () => {
    const onForward = vi.fn()
    render(<SadnessCard story={STORY} onBack={vi.fn()} onForward={onForward} />)

    fireEvent.click(screen.getByTestId('forward-btn'))
    expect(onForward).toHaveBeenCalled()
  })

  it('SadnessCard has no forward arrow without onForward', () => {
    render(<SadnessCard story={STORY} onBack={vi.fn()} />)
    expect(screen.queryByTestId('forward-btn')).toBeNull()
  })

  it('ComaCard renders a forward arrow when onForward is given', () => {
    const onForward = vi.fn()
    render(<ComaCard story={STORY} onBack={vi.fn()} onForward={onForward} />)

    fireEvent.click(screen.getByTestId('forward-btn'))
    expect(onForward).toHaveBeenCalled()
  })

  it('ComaCard has no forward arrow without onForward', () => {
    render(<ComaCard story={STORY} onBack={vi.fn()} />)
    expect(screen.queryByTestId('forward-btn')).toBeNull()
  })
})
