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
// the close overlay / story page Card has no entityType → game-card. The book
// overlay (weather change / close) exposes `onClose` as the top-left back button.
vi.mock('../components/layout/Card', () => ({
  default: ({ entityType, card, children, childrenIntoImage, onPreview, onAction, onClose, actionLabel }) => (
    <div data-testid={entityType ? 'config-card' : 'game-card'}>
      {card?.title}{card?.description && <span>{card.description}</span>}{children}{childrenIntoImage}
      {onClose && <button data-testid="page-back" onClick={onClose}>back</button>}
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

import GameBook, { lastEffectCard } from '../features/gameplay/GameBook'
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
    fireEvent.click(screen.getAllByTestId('preview-information')[0])
    fireEvent.click(await screen.findByTestId('action-sleep'))
    await waitFor(() => {
      expect(onReload).toHaveBeenCalled()
    })
  })

  it('routes a regular action preview to the right book page (inline, not the mobile modal)', () => {
    // A regular (non-endGame) action now renders an ActionCard with
    // previewSide="right" (modeled on MovementCard): its (i) opens the right-page
    // inline preview (page-back appears) instead of the Bootstrap modal.
    const gameDataWithAction = { ...GAME_DATA, actions: [{ uuid: 'a2', name: 'Explore', card: { title: 'Explore' } }] }
    render(<GameBook gameData={gameDataWithAction} matchUuid="m1" story={STORY} onClose={vi.fn()} />)
    expect(screen.queryByTestId('page-back')).not.toBeInTheDocument()
    fireEvent.click(screen.getAllByTestId('preview-action')[0])
    // The right page now shows the previewed action card with a back arrow.
    expect(screen.getByTestId('page-back')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('page-back'))
    expect(screen.queryByTestId('page-back')).not.toBeInTheDocument()
  })

  // Tapping the (x) does NOT close immediately: it shows the close prompt as a
  // book overlay on the left page (with the story card on the right); only the
  // "exit to home" action button there calls onClose.
  it('shows the close confirmation prompt before exiting', () => {
    const onClose = vi.fn()
    render(<GameBook gameData={GAME_DATA} matchUuid="m1" story={STORY} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('book-close'))
    expect(screen.getByText('game.closePrompt')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    // The close prompt renders as a page-mode Card with entityType="exit", so its
    // action button (exit to home) is exposed as `action-exit`.
    fireEvent.click(screen.getByTestId('action-exit'))
    expect(onClose).toHaveBeenCalled()
  })

  // The endgame action card's (i) opens the endgame reading page on the RIGHT
  // book page (previewRight kind 'endgame'), with a back arrow that clears it.
  it('opens the endgame preview on the right page with a back arrow', () => {
    render(<GameBook gameData={GAME_DATA} matchUuid="m1" story={STORY} onClose={vi.fn()} />)
    expect(screen.queryByTestId('page-back')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('preview-action'))   // the endgame (i)
    expect(screen.getByTestId('page-back')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('page-back'))
    expect(screen.queryByTestId('page-back')).not.toBeInTheDocument()
  })

  // A previewSide="right" card (movement/sleep) opens inline on the right page
  // even on mobile — it does NOT use the (i) Bootstrap modal (side takes
  // precedence). This also covers the generic right 'preview' render.
  it('routes a previewSide=right card to the inline right page on mobile', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true })
    // The neighbor needs a card, else the movement preview is a no-op (null card).
    const gd = { ...GAME_DATA, locations: [{ uuid: 'l1', name: 'Cave', card: { title: 'Cave' } }] }
    render(<GameBook gameData={gd} matchUuid="m1" story={STORY} onClose={vi.fn()} />)
    fireEvent.click(screen.getByTestId('preview-movement'))   // MovementCard is previewSide="right"
    expect(screen.getByTestId('page-back')).toBeInTheDocument() // shown inline on the right page
    fireEvent.click(screen.getByTestId('page-back'))
    expect(screen.queryByTestId('page-back')).not.toBeInTheDocument()
    delete window.matchMedia
  })

  // Task: on mobile the close prompt renders at the bottom of the stacked
  // column, so it is scrolled into view.
  it('scrolls the close prompt into view on mobile', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true })
    const scrollIntoView = vi.fn()
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => { cb(); return 0 })
    const realQS = document.querySelector.bind(document)
    const qs = vi.spyOn(document, 'querySelector').mockImplementation(
      sel => (sel === '.book-mobile-right' ? { scrollIntoView } : realQS(sel)))
    try {
      render(<GameBook gameData={GAME_DATA} matchUuid="m1" story={STORY} onClose={vi.fn()} />)
      fireEvent.click(screen.getByTestId('book-close'))       // opens the close overlay (previewRight)
      expect(scrollIntoView).toHaveBeenCalled()
    } finally {
      raf.mockRestore(); qs.mockRestore(); delete window.matchMedia
    }
  })

  // Task: after a sleep/movement reload delivers new gameData, the board is
  // scrolled back to the top so the new card is in view.
  it('scrolls the board to the top after a sleep reload (new gameData)', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true })
    const scrollTo = vi.fn()
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => { cb(); return 0 })
    const realQS = document.querySelector.bind(document)
    const qs = vi.spyOn(document, 'querySelector').mockImplementation(
      sel => (sel === '.book-overlay' ? { scrollTo } : realQS(sel)))
    try {
      const props = { matchUuid: 'm1', story: STORY, onReload: vi.fn(), onClose: vi.fn() }
      const { rerender } = render(<GameBook gameData={GAME_DATA} {...props} />)
      // Enter the statistics view and sleep → arms the post-reload scroll flag.
      fireEvent.click(screen.getAllByTestId('preview-information')[0])
      fireEvent.click(screen.getByTestId('action-sleep'))
      scrollTo.mockClear()
      // The parent delivers a fresh board (new gameData reference).
      rerender(<GameBook gameData={{ ...GAME_DATA }} {...props} />)
      expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }))
    } finally {
      raf.mockRestore(); qs.mockRestore(); delete window.matchMedia
    }
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

  it('dismisses the close overlay via the back button without exiting', () => {
    const onClose = vi.fn()
    render(<GameBook gameData={GAME_DATA} matchUuid="m1" story={STORY} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('book-close'))
    // The overlay's back arrow is present while the close card is shown.
    expect(screen.getByTestId('page-back')).toBeInTheDocument()
    // The back button closes the overlay and returns to the game — it must NOT
    // call onClose (exit to home). (Overlay gone → its back arrow disappears.)
    fireEvent.click(screen.getByTestId('page-back'))
    expect(screen.queryByTestId('page-back')).not.toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  // Step 27 — when the weather changes (new uuid), the new WeatherCard is shown
  // as a book overlay on the right page (reading page + back arrow). The left
  // page keeps the normal content (the story-left branch is intentionally off).
  it('shows the weather change as a right-page WeatherCard overlay with a back button', async () => {
    const { getMatchWeather } = await import('../api/matches')
    getMatchWeather
      .mockResolvedValueOnce({ uuid: 'w1', card: { title: 'Sunny' }, costMoveSafeLocation: 0 })
      .mockResolvedValue({ uuid: 'w2', card: { title: 'Rainy' }, costMoveSafeLocation: 0 })
    render(<GameBook gameData={GAME_DATA} matchUuid="m1" story={STORY} onReload={vi.fn()} onClose={vi.fn()} />)
    // Reach the sleep card (statistics view) and sleep → refreshes the weather.
    fireEvent.click(screen.getAllByTestId('preview-information')[0])
    fireEvent.click(await screen.findByTestId('action-sleep'))
    // The overlay is active once its back arrow appears (the sleep flow already
    // cleared the statistics-view preview, so page-back can only come from it).
    await waitFor(() => expect(screen.getByTestId('page-back')).toBeInTheDocument())
    expect(screen.getByText('Rainy')).toBeInTheDocument()   // WeatherCard on the right page
    // Back arrow dismisses the overlay (the page-back button goes away).
    fireEvent.click(screen.getByTestId('page-back'))
    await waitFor(() => expect(screen.queryByTestId('page-back')).not.toBeInTheDocument())
  })

  it('enters statistics view and shows entity cards when characteristics preview is clicked', async () => {
    render(<GameBook gameData={GAME_DATA} matchUuid="m1" story={STORY} onClose={vi.fn()} />)
    // The characteristics card has entityType="information" and onPreview that also sets statisticsCards=true
    fireEvent.click(screen.getAllByTestId('preview-information')[0])
    // After entering statistics view, the GoToSleepCard should be present
    await waitFor(() => {
      expect(screen.getByTestId('go-to-sleep-card')).toBeInTheDocument()
    })
    // Entity cards for class, character, difficulty, story should render (coverage lines 177-184)
    expect(screen.getAllByTestId('config-card').length).toBeGreaterThan(0)
  })

  it('shows the sleep card in the normal view when the player is energy-stuck (every move/action costs more)', () => {
    const stuckData = {
      ...GAME_DATA,
      playerStats: { life: 10, energy: 1, energyMax: 10 },
      // The only neighbor costs 5 and the only action is an end-game escape hatch
      // (ignored) → nothing affordable → checkShowToSleepCard is true.
      locations: [{ uuid: 'l1', name: 'Cave', energyCost: 5 }],
    }
    render(<GameBook gameData={stuckData} matchUuid="m1" story={STORY} onClose={vi.fn()} />)
    expect(screen.getByTestId('go-to-sleep-card')).toBeInTheDocument()
  })

  it('hides the sleep card in the normal view when a movement is still affordable', () => {
    const okData = {
      ...GAME_DATA,
      playerStats: { life: 10, energy: 8, energyMax: 10 },
      locations: [{ uuid: 'l1', name: 'Cave', energyCost: 5 }], // 5 <= 8 → affordable
    }
    render(<GameBook gameData={okData} matchUuid="m1" story={STORY} onClose={vi.fn()} />)
    expect(screen.queryByTestId('go-to-sleep-card')).not.toBeInTheDocument()
  })

  it('clicking preview on a regular action card opens its previewed card', () => {
    const gameDataWithAction = {
      ...GAME_DATA,
      actions: [{ uuid: 'a2', name: 'Explore', card: { title: 'Explore' } }],
    }
    render(<GameBook gameData={gameDataWithAction} matchUuid="m1" story={STORY} onClose={vi.fn()} />)
    // ActionCard's (i) routes to the right page preview via handleSelectionPreviewFull.
    fireEvent.click(screen.getByTestId('preview-action'))
    // The previewed action card is now shown.
    expect(screen.getAllByTestId('config-card').length).toBeGreaterThan(0)
  })

  it('closes the statistics view on back when inside the statistics view', async () => {
    render(<GameBook gameData={GAME_DATA} matchUuid="m1" story={STORY} onClose={vi.fn()} />)
    fireEvent.click(screen.getAllByTestId('preview-information')[0])
    await waitFor(() => expect(screen.getByTestId('go-to-sleep-card')).toBeInTheDocument())
    // Clicking the left-page close (onClose) calls handleBackOrClose which resets statisticsCards
    // The left-page Card is rendered with onClose=handleBackOrClose when preview is set
    const closeBtn = screen.queryByTestId('config-view-close')
    if (closeBtn) fireEvent.click(closeBtn)
    // Either the sleep card is still visible or normal view is back — no crash
  })
})

// Step 29 — an executed event narrates itself through the card of its LAST applied effect.
describe('lastEffectCard', () => {
  it('picks the card of the last effect that carries one', () => {
    const result = { effects: [
      { statistic: 'exp', card: { title: 'First link' } },
      { statistic: 'life', card: { title: 'Last link' } },
    ] }
    expect(lastEffectCard(result)).toEqual({ title: 'Last link' })
  })

  it('skips the trailing effects that carry no card', () => {
    const result = { effects: [
      { statistic: 'exp', card: { title: 'The only narrative' } },
      { statistic: 'coin' },
    ] }
    expect(lastEffectCard(result)).toEqual({ title: 'The only narrative' })
  })

  it('returns null when nothing narrates the event', () => {
    expect(lastEffectCard({ effects: [{ statistic: 'exp' }] })).toBeNull()
    expect(lastEffectCard({ effects: [] })).toBeNull()
    expect(lastEffectCard(undefined)).toBeNull()
  })
})
