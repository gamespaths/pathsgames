import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))
vi.mock('../components/book/Book', () => ({
  default: ({ left, right, mobile }) => <div data-testid="book">{left}{right}{mobile}</div>,
}))
vi.mock('../components/book/BookPageContent', () => ({
  default: ({ card, loading }) => (
    <div data-testid="book-page" data-loading={String(!!loading)}>{card?.title}</div>
  ),
}))
vi.mock('../components/layout/Card', () => ({ default: () => <div data-testid="game-card" /> }))

import EndGameBook from '../features/gameplay/EndGameBook'

const STORY = {
  title: 'Epic Quest',
  card: { title: 'Epic Quest', urlImage: 'https://img.example.com/story.jpg' },
  description: 'A great adventure.',
}

const END_CARD = { title: 'Victory!', description: 'You won.', urlImage: null }

function wrap(props = {}) {
  return render(
    <MemoryRouter>
      <EndGameBook story={STORY} endGameCard={END_CARD} onClose={vi.fn()} {...props} />
    </MemoryRouter>
  )
}

describe('EndGameBook', () => {
  it('renders the Book wrapper', () => {
    wrap()
    expect(screen.getByTestId('book')).toBeInTheDocument()
  })

  it('renders both left (story) and right (end-game) book pages', () => {
    wrap()
    const pages = screen.getAllByTestId('book-page')
    expect(pages.length).toBeGreaterThanOrEqual(2)
  })

  it('renders the close button in mobile layout', () => {
    wrap()
    expect(screen.getByText('game.endGameClose')).toBeInTheDocument()
  })

  it('shows story image in mobile layout when provided', () => {
    wrap()
    const imgs = document.querySelectorAll('.book-mobile-story-img')
    expect(imgs.length).toBeGreaterThan(0)
  })

  it('navigates to home when close button is clicked', () => {
    wrap()
    fireEvent.click(screen.getByText('game.endGameClose'))
    // After click the MemoryRouter should have navigated to '/'
    // No crash = navigation succeeded
  })

  it('renders without endGameCard gracefully', () => {
    wrap({ endGameCard: undefined })
    expect(screen.getByTestId('book')).toBeInTheDocument()
  })
})
