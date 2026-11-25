import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k }),
}))
vi.mock('@/components/layout/Card', () => ({
  default: ({ card, variant, onAction, actionLabel, actionIcon, onClose, children, hidePreview }) => (
    <div data-testid="close-card" data-variant={variant}>
      <span data-testid="card-title">{card?.title}</span>
      {card?.description && <span data-testid="card-desc">{card.description}</span>}
      {children}
      {onClose && <button data-testid="back-btn" onClick={onClose}>back</button>}
      {onAction && (
        <button data-testid="action-btn" onClick={onAction}>{actionLabel}</button>
      )}
      {actionIcon && <span data-testid="action-icon">{actionIcon}</span>}
      {hidePreview && <span data-testid="hide-preview">true</span>}
    </div>
  ),
}))

import CloseGameCard from '../features/gameplay/cards/CloseGameCard'

const STORY = { uuid: 's1', title: 'Test Story', card: { title: 'Close Story Card' } }

describe('CloseGameCard', () => {
  // v1.13.0 — the page mode is the only one: no overlay, no onDismiss.
  it('renders the close card as a book page, with no overlay', () => {
    render(<CloseGameCard story={STORY} onExit={vi.fn()} onBack={vi.fn()} />)
    expect(screen.getByTestId('close-card').dataset.variant).toBe('page')
    expect(document.querySelector('.close-prompt-overlay')).toBeNull()
    // The card title is overridden with the "exit to home" prompt label.
    expect(screen.getByTestId('card-title').textContent).toBe('game.exitToHome')
  })

  it('hides preview on the card', () => {
    render(<CloseGameCard story={STORY} onExit={vi.fn()} onBack={vi.fn()} />)
    expect(screen.getByTestId('hide-preview')).toBeInTheDocument()
  })

  it('renders the close prompt text', () => {
    render(<CloseGameCard story={STORY} onExit={vi.fn()} onBack={vi.fn()} />)
    expect(screen.getByText('game.closePrompt')).toBeInTheDocument()
  })

  it('uses home icon for action', () => {
    render(<CloseGameCard story={STORY} onExit={vi.fn()} onBack={vi.fn()} />)
    expect(screen.getByTestId('action-icon').textContent).toBe('fa-home')
  })

  it('calls onBack (cancel) when the back arrow is clicked, not onExit', () => {
    const onBack = vi.fn()
    const onExit = vi.fn()
    render(<CloseGameCard story={STORY} onExit={onExit} onBack={onBack} />)
    fireEvent.click(screen.getByTestId('back-btn'))
    expect(onBack).toHaveBeenCalledOnce()
    expect(onExit).not.toHaveBeenCalled()
  })

  it('calls onExit when the action button (exit to home) is clicked', () => {
    const onExit = vi.fn()
    render(<CloseGameCard story={STORY} onExit={onExit} onBack={vi.fn()} />)
    fireEvent.click(screen.getByTestId('action-btn'))
    expect(onExit).toHaveBeenCalledOnce()
  })

  it('works without a story card', () => {
    render(<CloseGameCard story={null} onExit={vi.fn()} onBack={vi.fn()} />)
    expect(screen.getByTestId('card-title').textContent).toBe('game.exitToHome')
  })
})
