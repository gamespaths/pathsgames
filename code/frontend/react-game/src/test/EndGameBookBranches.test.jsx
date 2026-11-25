import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const navigate = vi.fn()
vi.mock('react-router-dom', async (orig) => ({ ...(await orig()), useNavigate: () => navigate }))
vi.mock('../i18n/context', () => ({ useTranslation: () => ({ t: (k) => k }) }))
vi.mock('../components/book/Book', () => ({
  default: ({ left, right }) => <div>{left}{right}</div>,
}))
vi.mock('../components/layout/Card', () => ({
  default: ({ card }) => <div data-testid="page">{card?.title ?? card?.name}</div>,
}))

import EndGameBook from '../features/gameplay/EndGameBook'

describe('EndGameBook (full cards, one tree)', () => {
  beforeEach(() => navigate.mockClear())

  it('renders story + end-game images/titles once each (v1.14.0 one tree)', () => {
    render(
      <MemoryRouter>
        <EndGameBook
          story={{ title: 'My Story', description: 'A tale', card: { urlImage: 'http://x/s.png', title: 'My Story', description: 'A tale' } }}
          endGameCard={{ urlImage: 'http://x/e.png', title: 'The End', description: 'Finis' }}
          onClose={vi.fn()}
        />
      </MemoryRouter>
    )
    expect(screen.getAllByText('My Story').length).toBeGreaterThan(0)
    expect(screen.getAllByText('The End').length).toBeGreaterThan(0)
    // story + end-game cards, each on its own page; no mobile copy
    expect(screen.getAllByTestId('page').length).toBe(2)
    expect(navigate).not.toHaveBeenCalled()
  })

  it('falls back to card title/name when story/endGame fields are missing', () => {
    render(
      <MemoryRouter>
        <EndGameBook
          story={{ card: { title: 'CardTitle', description: 'CardDesc' } }}
          endGameCard={{ name: 'EndName' }}
          onClose={vi.fn()}
        />
      </MemoryRouter>
    )
    expect(screen.getAllByText('CardTitle').length).toBeGreaterThan(0)
    // endGameCard has only `name` → Card falls back to it
    expect(screen.getAllByText('EndName').length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('page').length).toBe(2)
  })
})
