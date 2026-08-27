import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// EndGameCard — the board card of an event that ends the match. Its footer button
// ends the game straight away; its (i) lens opens the reading page carrying the
// SAME end-game action (so the big card can end it too).

vi.mock('@/i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))
vi.mock('@/components/layout/Card', () => ({
  default: ({ card, entityType, variant, onPreview, onAction, onClose, actionLabel }) => (
    <div data-testid="card" data-entity={entityType} data-variant={variant}>
      <span>{card?.title}</span>
      {onPreview && <button data-testid="preview" onClick={onPreview}>i</button>}
      {onAction && <button data-testid="action" onClick={onAction}>{actionLabel}</button>}
      {onClose && <button data-testid="back" onClick={onClose}>back</button>}
    </div>
  ),
}))

import EndGameCard from '../features/gameplay/cards/EndGameCard'

const ACTION = { uuid: 'a1', name: 'Flee', uuidEvent: 'e1', endGame: true, card: { title: 'Flee the dungeon' } }

describe('EndGameCard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the action card as a little action card', () => {
    render(<EndGameCard story={{}} action={ACTION} handleEndGamePreviewFull={vi.fn()} handleEndGame={vi.fn()} />)
    const card = screen.getByTestId('card')
    expect(card).toHaveAttribute('data-entity', 'action')
    expect(card).toHaveAttribute('data-variant', 'little')
    expect(screen.getByText('Flee the dungeon')).toBeInTheDocument()
  })

  it('ends the game from the footer button', () => {
    const handleEndGame = vi.fn()
    render(<EndGameCard story={{}} action={ACTION} handleEndGamePreviewFull={vi.fn()} handleEndGame={handleEndGame} />)
    expect(screen.getByTestId('action')).toHaveTextContent('game.endGameShort')
    fireEvent.click(screen.getByTestId('action'))
    expect(handleEndGame).toHaveBeenCalledWith(ACTION)
  })

  // The lens hands the reading page the action's own card plus the end-game
  // button (label + icon) as additional props, so the big card can end it too.
  it('opens the reading page carrying the end-game button', () => {
    const handleEndGamePreviewFull = vi.fn()
    const handleEndGame = vi.fn()
    render(<EndGameCard story={{}} action={ACTION}
      handleEndGamePreviewFull={handleEndGamePreviewFull} handleEndGame={handleEndGame} />)
    fireEvent.click(screen.getByTestId('preview'))
    expect(handleEndGamePreviewFull).toHaveBeenCalledWith(expect.objectContaining({
      card: ACTION.card,
      stats: [],
      props: expect.objectContaining({ actionLabel: 'game.endGame', actionIcon: 'fa-flag-checkered' }),
    }))
    // The additional props carry a working end-game handler.
    handleEndGamePreviewFull.mock.calls[0][0].props.onAction()
    expect(handleEndGame).toHaveBeenCalledWith(ACTION)
  })

  // In page mode it renders the full reading page with a back arrow.
  it('renders as a reading page with a back arrow', () => {
    const onBack = vi.fn()
    render(<EndGameCard story={{}} action={ACTION} variant="page" onBack={onBack}
      handleEndGamePreviewFull={vi.fn()} handleEndGame={vi.fn()} />)
    expect(screen.getByTestId('card')).toHaveAttribute('data-variant', 'page')
    fireEvent.click(screen.getByTestId('back'))
    expect(onBack).toHaveBeenCalled()
  })
})
