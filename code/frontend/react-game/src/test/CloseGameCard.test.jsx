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
  it('renders the close card', () => {
    render(<CloseGameCard story={STORY} onExit={vi.fn()} onDismiss={vi.fn()} />)
    expect(screen.getByTestId('close-card')).toBeInTheDocument()
    // The card title is overridden with the "exit to home" prompt label.
    expect(screen.getByTestId('card-title').textContent).toBe('game.exitToHome')
  })

  it('calls onExit when action button is clicked', () => {
    const onExit = vi.fn()
    render(<CloseGameCard story={STORY} onExit={onExit} onDismiss={vi.fn()} />)
    fireEvent.click(screen.getByTestId('action-btn'))
    expect(onExit).toHaveBeenCalledOnce()
  })

  it('calls onDismiss when overlay is clicked', () => {
    const onDismiss = vi.fn()
    render(<CloseGameCard story={STORY} onExit={vi.fn()} onDismiss={onDismiss} />)
    const overlay = document.querySelector('.close-prompt-overlay')
    fireEvent.click(overlay)
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('calls onDismiss when Escape key is pressed on overlay', () => {
    const onDismiss = vi.fn()
    render(<CloseGameCard story={STORY} onExit={vi.fn()} onDismiss={onDismiss} />)
    const overlay = document.querySelector('.close-prompt-overlay')
    fireEvent.keyDown(overlay, { key: 'Escape' })
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('does not call onDismiss when a non-Escape key is pressed', () => {
    const onDismiss = vi.fn()
    render(<CloseGameCard story={STORY} onExit={vi.fn()} onDismiss={onDismiss} />)
    const overlay = document.querySelector('.close-prompt-overlay')
    fireEvent.keyDown(overlay, { key: 'Enter' })
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('stops propagation on modal click', () => {
    const onDismiss = vi.fn()
    render(<CloseGameCard story={STORY} onExit={vi.fn()} onDismiss={onDismiss} />)
    const modal = document.querySelector('.close-prompt-modal')
    fireEvent.click(modal)
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('stops propagation on modal keydown', () => {
    const onDismiss = vi.fn()
    render(<CloseGameCard story={STORY} onExit={vi.fn()} onDismiss={onDismiss} />)
    const modal = document.querySelector('.close-prompt-modal')
    fireEvent.keyDown(modal, { key: 'Escape' })
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('hides preview on the card', () => {
    render(<CloseGameCard story={STORY} onExit={vi.fn()} onDismiss={vi.fn()} />)
    expect(screen.getByTestId('hide-preview')).toBeInTheDocument()
  })

  it('renders the close prompt text', () => {
    render(<CloseGameCard story={STORY} onExit={vi.fn()} onDismiss={vi.fn()} />)
    expect(screen.getByText('game.closePrompt')).toBeInTheDocument()
  })

  it('uses home icon for action', () => {
    render(<CloseGameCard story={STORY} onExit={vi.fn()} onDismiss={vi.fn()} />)
    expect(screen.getByTestId('action-icon').textContent).toBe('fa-home')
  })

  // Page (overlay) mode — rendered on the book's right page with a back arrow.
  describe('page mode (onBack)', () => {
    it('renders a page-variant card instead of the modal overlay', () => {
      render(<CloseGameCard story={STORY} onExit={vi.fn()} onBack={vi.fn()} />)
      expect(screen.getByTestId('close-card').dataset.variant).toBe('page')
      expect(document.querySelector('.close-prompt-overlay')).toBeNull()
      expect(screen.getByText('game.closePrompt')).toBeInTheDocument()
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
  })
})
