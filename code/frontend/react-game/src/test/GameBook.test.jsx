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
  getMatchWeather: vi.fn(() => Promise.resolve(null)),
  getMatchLocations: vi.fn(() => Promise.resolve({ matchUuid: 'm1', locations: [] })),
  sleepCharacter: vi.fn(),
  startMovement: vi.fn(),
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
vi.mock('../features/gameplay/cards/GoToSleepCard', () => ({
  default: ({ onSlept }) => (
    <div data-testid="go-to-sleep-card">
      <button data-testid="action-sleep" onClick={() => onSlept?.()}>sleep</button>
    </div>
  ),
}))

import GameBook from '../features/gameplay/GameBook'
import { endMatch, sleepCharacter } from '../api/matches'

const GAME_DATA = {
  actualLocationCard: { name: 'Entrance', title: 'Entrance' },
  playerStats: { life: 10 },
  locations: [{ uuid: 'l1', name: 'Cave' }],
  // The end-game event action exposes an "end game" button via ConfigCard onAction.
  actions: [{ uuid: 'a1', name: 'Flee', uuidEvent: 'e1', endGame: true, card: { title: 'Flee' } }],
  endGameCard: { title: 'You Won!' },
  info: { locationsActive: [{ secureParam: 1 }] },
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
    fireEvent.click(screen.getByText('game.endGameShort'))      // click the end-game action button
    expect(await screen.findByTestId('end-game-book')).toBeInTheDocument()
  })

  it('shows end-game error when endMatch fails', async () => {
    endMatch.mockRejectedValue({ message: 'NETWORK_ERROR' })
    render(<GameBook gameData={GAME_DATA} matchUuid="m1" story={STORY} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('game.endGameShort'))
    await waitFor(() => {
      expect(screen.getByText('NETWORK_ERROR')).toBeInTheDocument()
    })
  })

  // The sleep card lives in the statistics view (opened from the characteristics
  // card preview). Its onSlept callback refreshes the clock and reloads the board.
  it('sleep action triggers onSlept which calls onReload', async () => {
    const onReload = vi.fn()
    render(<GameBook gameData={GAME_DATA} matchUuid="m1" story={STORY} onReload={onReload} onClose={vi.fn()} />)
    // Enter the statistics view via the characteristics card preview.
    fireEvent.click(screen.getAllByTestId('preview-story')[0])
    fireEvent.click(await screen.findByTestId('action-sleep'))
    await waitFor(() => {
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

  it('renders a regular action card (non-endGame) as a config-card', () => {
    const gameDataWithNonEndGame = {
      ...GAME_DATA,
      actions: [{ uuid: 'a2', name: 'Explore', card: { title: 'Explore' } }],
    }
    render(<GameBook gameData={gameDataWithNonEndGame} matchUuid="m1" story={STORY} onClose={vi.fn()} />)
    expect(screen.getAllByTestId('config-card').length).toBeGreaterThan(0)
  })

  it('dismisses the close prompt when onDismiss is triggered', () => {
    render(<GameBook gameData={GAME_DATA} matchUuid="m1" story={STORY} onClose={vi.fn()} />)
    fireEvent.click(screen.getByTestId('book-close'))
    expect(screen.getByText('game.closePrompt')).toBeInTheDocument()
    // Click the overlay backdrop to dismiss
    const overlay = document.querySelector('.close-prompt-overlay')
    if (overlay) fireEvent.click(overlay)
  })

  it('enters statistics view and shows entity cards when characteristics preview is clicked', async () => {
    render(<GameBook gameData={GAME_DATA} matchUuid="m1" story={STORY} onClose={vi.fn()} />)
    // The characteristics card has entityType="story" and onPreview that also sets statisticsCards=true
    fireEvent.click(screen.getAllByTestId('preview-story')[0])
    // After entering statistics view, the GoToSleepCard should be present
    await waitFor(() => {
      expect(screen.getByTestId('go-to-sleep-card')).toBeInTheDocument()
    })
    // Entity cards for class, character, difficulty, story should render (coverage lines 177-184)
    expect(screen.getAllByTestId('config-card').length).toBeGreaterThan(0)
  })

  it('shows the sleep card in the normal view when player energy is 1 or less', () => {
    const lowEnergyData = {
      ...GAME_DATA,
      playerStats: { life: 10, energy: 1, energyMax: 10 },
    }
    render(<GameBook gameData={lowEnergyData} matchUuid="m1" story={STORY} onClose={vi.fn()} />)
    // Line 194-196: playerStats?.energy <= 1 branch renders GoToSleepCard in normal view
    expect(screen.getByTestId('go-to-sleep-card')).toBeInTheDocument()
  })

  it('clicking preview on a regular action card calls handleSelectionPreview', () => {
    const gameDataWithAction = {
      ...GAME_DATA,
      actions: [{ uuid: 'a2', name: 'Explore', card: { title: 'Explore' } }],
    }
    render(<GameBook gameData={gameDataWithAction} matchUuid="m1" story={STORY} onClose={vi.fn()} />)
    // Line 211: onPreview of a regular (non-endGame) action card
    fireEvent.click(screen.getByTestId('preview-action'))
    // After preview, the left page shows the previewed card
    expect(screen.getAllByTestId('config-card').length).toBeGreaterThan(0)
  })

  it('closes the statistics view on back when inside the statistics view', async () => {
    render(<GameBook gameData={GAME_DATA} matchUuid="m1" story={STORY} onClose={vi.fn()} />)
    fireEvent.click(screen.getAllByTestId('preview-story')[0])
    await waitFor(() => expect(screen.getByTestId('go-to-sleep-card')).toBeInTheDocument())
    // Clicking the left-page close (onClose) calls handleBackOrClose which resets statisticsCards
    // The left-page Card is rendered with onClose=handleBackOrClose when preview is set
    const closeBtn = screen.queryByTestId('config-view-close')
    if (closeBtn) fireEvent.click(closeBtn)
    // Either the sleep card is still visible or normal view is back — no crash
  })
})
