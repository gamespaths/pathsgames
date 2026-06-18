import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))
vi.mock('@/features/guest-user/GuestUserContext', () => ({
  useGuestUser: () => ({ user: { accessToken: 'tok' } }),
}))
vi.mock('../api/matches', () => ({
  endMatch: vi.fn(),
  getMatchClock: vi.fn(() => Promise.resolve(null)),
  sleepCharacter: vi.fn(),
}))
vi.mock('../components/book/Book', () => ({
  default: ({ left, right, onClose }) => (
    <div data-testid="book">
      <button data-testid="book-close" onClick={onClose}>x</button>
      {left}{right}
    </div>
  ),
}))
vi.mock('../components/book/BookPageLeft', () => ({ default: ({ children }) => <div>{children}</div> }))
vi.mock('../components/book/BookPageRight', () => ({ default: ({ children }) => <div>{children}</div> }))
vi.mock('../components/book/BookPageContent', () => ({
  default: ({ card, extraContent }) => (
    <div data-testid="book-page-content">{card?.title}{extraContent}</div>
  ),
}))
vi.mock('../features/gameplay/cards/LocationCard', () => ({ default: ({ location }) => <div data-testid="location-card">{location?.name}</div> }))
vi.mock('../features/gameplay/cards/PlayerStats', () => ({ default: () => <div data-testid="player-stats" /> }))
// Selection cards pass `entityType` (config-card + preview-/action-<entityType>);
// direct Card usages (e.g. CloseGameCard) have no entityType → game-card.
vi.mock('../components/layout/Card', () => ({
  default: ({ entityType, card, children, childrenIntoImage, onPreview, onAction, actionLabel }) => (
    <div data-testid={entityType ? 'config-card' : 'game-card'}>
      {card?.title}{children}{childrenIntoImage}
      {onPreview && <button data-testid={`preview-${entityType}`} onClick={onPreview}>preview</button>}
      {onAction && <button data-testid={entityType ? `action-${entityType}` : 'game-card-action'} onClick={onAction}>{actionLabel}</button>}
    </div>
  ),
}))
vi.mock('../features/gameplay/ClockWidget', () => ({ default: () => <div data-testid="clock-widget" /> }))
vi.mock('../features/gameplay/SleepButton', () => ({ default: () => <div data-testid="sleep-button" /> }))
vi.mock('../features/gameplay/EndGameBook', () => ({ default: () => <div data-testid="end-game-book" /> }))
vi.mock('../features/gameplay/GameBookMobile', () => ({ default: () => <div data-testid="game-book-mobile" /> }))
vi.mock('../features/start-book/StartBookModal', () => ({ CardPreviewOverlay: () => <div data-testid="preview-overlay" /> }))

import GameBook from '../features/gameplay/GameBook'
import { endMatch, sleepCharacter } from '../api/matches'

const GAME_DATA = {
  actualLocationCard: { name: 'Entrance', title: 'Entrance' },
  playerStats: { life: 10 },
  locations: [{ uuid: 'l1', name: 'Cave' }],
  // The end-game event action exposes an "end game" button via ConfigCard onAction.
  actions: [{ uuid: 'a1', name: 'Flee', uuidEvent: 'e1', endGame: true, card: { title: 'Flee' } }],
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

  it('renders PlayerStats and action ConfigCards', () => {
    render(<GameBook gameData={GAME_DATA} matchUuid="m1" story={STORY} onClose={vi.fn()} />)
    expect(screen.getByTestId('player-stats')).toBeInTheDocument()
    expect(screen.getAllByTestId('config-card').length).toBeGreaterThan(0)
  })

  // An end-game action renders a ConfigCard with an onAction button (label
  // game.endGame) wired to handleEndGame.
  it('renders EndGameBook after the end-game button triggers endMatch', async () => {
    endMatch.mockResolvedValue({})
    render(<GameBook gameData={GAME_DATA} matchUuid="m1" story={STORY} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('game.endGame'))      // click the end-game action button
    expect(await screen.findByTestId('end-game-book')).toBeInTheDocument()
  })

  it('shows end-game error when endMatch fails', async () => {
    endMatch.mockRejectedValue({ message: 'NETWORK_ERROR' })
    render(<GameBook gameData={GAME_DATA} matchUuid="m1" story={STORY} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('game.endGame'))
    await waitFor(() => {
      expect(screen.getByText('NETWORK_ERROR')).toBeInTheDocument()
    })
  })

  // The sleep card lives in the statistics view (opened from the characteristics
  // card preview). Its onAction calls sleepCharacter, then onSlept refreshes the
  // clock and reloads the board (onReload).
  it('sleep action calls sleepCharacter and reloads the board', async () => {
    sleepCharacter.mockResolvedValue({ isSleeping: true, timeEndTriggered: true })
    const onReload = vi.fn()
    render(<GameBook gameData={GAME_DATA} matchUuid="m1" story={STORY} onReload={onReload} onClose={vi.fn()} />)
    // Enter the statistics view via the characteristics card preview.
    fireEvent.click(screen.getAllByTestId('preview-story')[0])
    fireEvent.click(await screen.findByTestId('action-sleep'))
    await waitFor(() => {
      expect(sleepCharacter).toHaveBeenCalledWith('m1', 'tok')
      expect(onReload).toHaveBeenCalled()
    })
  })

  it('opens the card preview modal on mobile when a preview opens', async () => {
    // On mobile the (i) lens opens the big card in the Bootstrap modal.
    window.matchMedia = vi.fn().mockReturnValue({ matches: true })
    const show = vi.fn()
    window.bootstrap = { Modal: { getOrCreateInstance: vi.fn().mockReturnValue({ show }) } }
    render(<GameBook gameData={GAME_DATA} matchUuid="m1" story={STORY} onClose={vi.fn()} />)
    // An action card previews with showModal=true (the characteristics card uses false).
    fireEvent.click(screen.getAllByTestId('preview-action')[0])
    await waitFor(() => {
      expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 767px)')
      expect(show).toHaveBeenCalled()
    })
    delete window.bootstrap
    delete window.matchMedia
  })

  // Tapping the (x) does NOT close immediately: it shows the "paused match"
  // confirmation card; only the home button there calls onClose.
  it('shows the close confirmation prompt before exiting', () => {
    const onClose = vi.fn()
    render(<GameBook gameData={GAME_DATA} matchUuid="m1" story={STORY} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('book-close'))
    expect(screen.getByText('game.closePrompt')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('game-card-action'))
    expect(onClose).toHaveBeenCalled()
  })

  it('renders gracefully when gameData is null', () => {
    render(<GameBook gameData={null} matchUuid="m1" story={STORY} onClose={vi.fn()} />)
    expect(screen.getByTestId('book')).toBeInTheDocument()
  })
})
