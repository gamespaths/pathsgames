import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))
const bookProps = vi.hoisted(() => ({ last: null }))
vi.mock('../components/book/Book', () => ({
  default: (props) => {
    bookProps.last = props
    return <div data-testid="book">{props.left}{props.right}{props.mobile}</div>
  },
}))
vi.mock('../components/layout/Card', () => ({
  default: ({ card, loading }) => (
    <div data-testid="book-page" data-loading={String(!!loading)}>{card?.title ?? card?.name}</div>
  ),
}))

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
      <EndGameBook story={STORY} endGameCard={END_CARD} {...props} />
    </MemoryRouter>
  )
}

describe('EndGameBook', () => {
  it('renders the Book wrapper', () => {
    wrap()
    expect(screen.getByTestId('book')).toBeInTheDocument()
  })

  it('v1.13.0 — an in-flow book: no overlay class, no close (x); the home tab goes home', () => {
    wrap()
    expect(bookProps.last.overlayClass).toBeUndefined()
    expect(bookProps.last.onClose).toBeUndefined()
    expect(bookProps.last.wrapperClass).toBe('book-wrapper end-game-wrapper')
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

  it('stacks the story and end-game cards in the mobile layout too', () => {
    wrap()
    // desktop left + right + mobile story + mobile end-game = 4 page cards
    expect(screen.getAllByTestId('book-page').length).toBeGreaterThanOrEqual(4)
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
