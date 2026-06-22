import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k }),
}))
vi.mock('../components/modals/CardDetailModal', () => ({
  default: ({ card, modalId, actionLabel }) => (
    <div data-testid="card-detail-modal" data-modal-id={modalId}>
      <span data-testid="card-name">{card?.name}</span>
      <span data-testid="card-desc">{card?.description}</span>
      <span data-testid="action-label">{actionLabel}</span>
    </div>
  ),
}))

import ErrorCard from '../components/modals/ErrorCard'

describe('ErrorCard', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    delete window.bootstrap
  })

  it('renders a CardDetailModal with the error title', () => {
    render(<ErrorCard status="RUNNING" onClose={vi.fn()} />)
    expect(screen.getByTestId('card-detail-modal')).toBeInTheDocument()
    expect(screen.getByTestId('card-name').textContent).toBe('errors.title')
    expect(screen.getByTestId('action-label').textContent).toBe('modals.close')
  })

  it('shows only matchNotRunning message for non-ENDED status', () => {
    render(<ErrorCard status="PAUSED" onClose={vi.fn()} />)
    const desc = screen.getByTestId('card-desc').textContent
    expect(desc).toContain('errors.matchNotRunning')
    expect(desc).not.toContain('errors.matchEnded')
  })

  it('adds the matchEnded suffix when status is ENDED', () => {
    render(<ErrorCard status="ENDED" onClose={vi.fn()} />)
    const desc = screen.getByTestId('card-desc').textContent
    expect(desc).toContain('errors.matchNotRunning')
    expect(desc).toContain('errors.matchEnded')
  })

  it('calls onClose when the Bootstrap modal hidden event fires', () => {
    const el = document.createElement('div')
    el.id = 'error-card-match-modal'
    document.body.appendChild(el)

    const mockInstance = { show: vi.fn() }
    window.bootstrap = { Modal: { getOrCreateInstance: vi.fn().mockReturnValue(mockInstance) } }

    const onClose = vi.fn()
    render(<ErrorCard status="RUNNING" onClose={onClose} />)

    expect(mockInstance.show).toHaveBeenCalled()

    el.dispatchEvent(new Event('hidden.bs.modal'))
    expect(onClose).toHaveBeenCalled()

    delete window.bootstrap
  })

  it('renders without crashing when Bootstrap is not available', () => {
    render(<ErrorCard status="RUNNING" onClose={vi.fn()} />)
    expect(screen.getByTestId('card-detail-modal')).toBeInTheDocument()
  })
})
