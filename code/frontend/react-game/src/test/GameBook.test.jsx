import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))
vi.mock('@/features/guest-user/GuestUserContext', () => ({
  useGuestUser: () => ({ user: { accessToken: 'tok' } }),
}))
vi.mock('../api/matches', () => ({ endMatch: vi.fn() }))
vi.mock('../components/book/Book', () => ({
  default: ({ left, right, onClose }) => <div data-testid="book">{left}{right}</div>,
}))
vi.mock('../components/book/BookPageLeft', () => ({ default: ({ children }) => <div>{children}</div> }))
vi.mock('../components/book/BookPageRight', () => ({ default: ({ children }) => <div>{children}</div> }))
vi.mock('../components/book/BookPageContent', () => ({
  default: ({ card }) => <div data-testid="book-page-content">{card?.title}</div>,
}))
vi.mock('../components/layout/GameCard', () => ({ default: ({ card }) => <div data-testid="game-card">{card?.title}</div> }))
vi.mock('../features/gameplay/LocationCard', () => ({ default: ({ location }) => <div data-testid="location-card">{location?.name}</div> }))
vi.mock('../features/gameplay/PlayerStats', () => ({ default: () => <div data-testid="player-stats" /> }))
vi.mock('../features/gameplay/ActionRow', () => ({
  default: ({ options, onEndGame }) => (
    <div data-testid="selection-view">
      {options?.map((o, i) => (
        <button key={i} onClick={() => onEndGame(o)}>end:{o.name}</button>
      ))}
    </div>
  ),
}))
vi.mock('../features/gameplay/EndGameBook', () => ({ default: () => <div data-testid="end-game-book" /> }))
vi.mock('../features/gameplay/GameBookMobile', () => ({ default: () => <div data-testid="game-book-mobile" /> }))
vi.mock('../features/start-book/StartBookModal', () => ({ CardPreviewOverlay: () => <div data-testid="preview-overlay" /> }))

import GameBook from '../features/gameplay/GameBook'
import { endMatch } from '../api/matches'

const GAME_DATA = {
  startLocation: { name: 'Entrance', title: 'Entrance' },
  playerStats: { life: 10 },
  locations: [{ uuid: 'l1', name: 'Cave' }],
  actions: [{ uuid: 'a1', name: 'Flee', uuidEvent: 'e1' }],
  endGameCard: { title: 'You Won!' },
}

const STORY = { uuid: 's1', title: 'Test Story', card: { title: 'Test Story' } }

describe('GameBook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the Book component', () => {
    render(<GameBook gameData={GAME_DATA} matchUuid="m1" story={STORY} onClose={vi.fn()} />)
    expect(screen.getByTestId('book')).toBeInTheDocument()
  })

  it('renders PlayerStats and SelectionView', () => {
    render(<GameBook gameData={GAME_DATA} matchUuid="m1" story={STORY} onClose={vi.fn()} />)
    expect(screen.getByTestId('player-stats')).toBeInTheDocument()
    expect(screen.getByTestId('selection-view')).toBeInTheDocument()
  })

  it('renders EndGameBook after successful endMatch', async () => {
    endMatch.mockResolvedValue({})
    render(<GameBook gameData={GAME_DATA} matchUuid="m1" story={STORY} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('end:Flee'))
    expect(await screen.findByTestId('end-game-book')).toBeInTheDocument()
  })

  it('shows end-game error when endMatch fails', async () => {
    endMatch.mockRejectedValue({ message: 'NETWORK_ERROR' })
    render(<GameBook gameData={GAME_DATA} matchUuid="m1" story={STORY} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('end:Flee'))
    await waitFor(() => {
      expect(screen.getByText('NETWORK_ERROR')).toBeInTheDocument()
    })
  })

  it('renders gracefully when gameData is null', () => {
    render(<GameBook gameData={null} matchUuid="m1" story={STORY} onClose={vi.fn()} />)
    expect(screen.getByTestId('book')).toBeInTheDocument()
  })
})
