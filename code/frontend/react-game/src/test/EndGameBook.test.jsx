import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))
const bookProps = vi.hoisted(() => ({ last: null }))
vi.mock('../components/book/Book', () => ({
  default: (props) => {
    bookProps.last = props
    return <div data-testid="book">{props.left}{props.right}</div>
  },
}))
vi.mock('../components/layout/Card', () => ({
  default: ({ card, loading, onAction, actionLabel }) => (
    <div data-testid="book-page" data-loading={String(!!loading)}>{card?.title ?? card?.name}
      {onAction && <span data-testid="page-action">{actionLabel}</span>}</div>
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

  it('the end card carries the home action (one tree: no separate close button)', () => {
    wrap()
    expect(screen.getByTestId('page-action')).toHaveTextContent('game.endGameClose')
    expect(document.querySelector('.end-game-actions')).toBeNull()
  })

  it('v1.14.0 — one tree: the story and the end-game pages are rendered once each', () => {
    wrap()
    expect(screen.getAllByTestId('book-page')).toHaveLength(2)
    expect(bookProps.last.mobile).toBeUndefined()
  })

  it('the missions branch keeps the plain wrapper (the end card goes on top on phones only at the ending)', () => {
    wrap({ missions: [{ uuid: 'm1', status: 'OPEN', card: { title: 'M1' } }] })
    expect(bookProps.last.wrapperClass ?? 'book-wrapper').toBe('book-wrapper')
  })

  it('renders without endGameCard gracefully', () => {
    wrap({ endGameCard: undefined })
    expect(screen.getByTestId('book')).toBeInTheDocument()
  })
})
