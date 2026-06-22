import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k }),
}))
vi.mock('@/components/layout/Card', () => ({
  default: ({ card, onAction, actionLabel, actionIcon, children, hidePreview }) => (
    <div data-testid="close-card">
      <span data-testid="card-title">{card?.title}</span>
      {children}
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
    expect(screen.getByTestId('card-title').textContent).toBe('Close Story Card')
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
})
