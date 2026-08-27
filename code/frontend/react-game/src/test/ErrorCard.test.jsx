import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k }),
}))

import ErrorCard from '../components/modals/ErrorCard'
import images from '@/data/images.json'

describe('ErrorCard', () => {
  it('renders the fixed "error" card from data/images.json on its own overlay', () => {
    const { container } = render(<ErrorCard status="RUNNING" onClose={vi.fn()} />)
    expect(screen.getByTestId('error-card-overlay')).toBeInTheDocument()
    expect(screen.getByText('errors.title')).toBeInTheDocument()
    const errorImg = images.find(x => x.id === 'error')
    expect(container.querySelector('img').src).toBe(errorImg.urlImage)
    expect(container.querySelector('.book-page-content')).not.toBeNull()
  })

  it('shows only matchNotRunning message for non-ENDED status', () => {
    render(<ErrorCard status="PAUSED" onClose={vi.fn()} />)
    expect(screen.getByText(/errors\.matchNotRunning/)).toBeInTheDocument()
    expect(screen.queryByText(/errors\.matchEnded/)).toBeNull()
  })

  it('adds the matchEnded suffix when status is ENDED', () => {
    render(<ErrorCard status="ENDED" onClose={vi.fn()} />)
    expect(screen.getByText(/errors\.matchNotRunning.*errors\.matchEnded/)).toBeInTheDocument()
  })

  it('shows the explicit API message when provided, overriding the generic text', () => {
    render(<ErrorCard status="RUNNING" message="Not enough energy: have 2, need 4" onClose={vi.fn()} />)
    expect(screen.getByText('Not enough energy: have 2, need 4')).toBeInTheDocument()
    expect(screen.queryByText(/errors\.matchNotRunning/)).toBeNull()
  })

  it('calls onClose from the close action and from the back arrow', () => {
    const onClose = vi.fn()
    render(<ErrorCard status="RUNNING" onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /modals\.close/ }))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'card.back' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('caps the card width when maxWidth is given, fills the overlay otherwise', () => {
    const { container } = render(<ErrorCard status="RUNNING" onClose={vi.fn()} maxWidth="400px" />)
    const wrap = container.querySelector('.error-card-overlay').firstChild
    expect(wrap.style.maxWidth).toBe('400px')
    const { container: c2 } = render(<ErrorCard status="RUNNING" onClose={vi.fn()} />)
    const bare = c2.querySelector('.error-card-overlay').firstChild
    expect(bare.style.maxWidth).toBe('')
    expect(bare.style.width).toBe('100%')
  })
})
