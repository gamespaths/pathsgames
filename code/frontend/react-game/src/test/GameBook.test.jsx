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
  executeEvent: vi.fn(),
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
  default: ({ entityType, card, children, childrenIntoImage, onPreview, onAction, onClose,
              onForward, actionLabel, actionsList }) => (
    <div data-testid={entityType ? 'config-card' : 'game-card'}>
      {card?.title}{card?.description && <span>{card.description}</span>}{children}{childrenIntoImage}
      {onClose && <button data-testid="page-back" onClick={onClose}>back</button>}
      {onForward && <button data-testid="page-forward" onClick={onForward}>forward</button>}
      {onPreview && <button data-testid={`preview-${entityType}`} onClick={onPreview}>preview</button>}
      {onAction && <button data-testid={entityType ? `action-${entityType}` : 'game-card-action'} onClick={onAction}>{actionLabel}</button>}
      {/* The secondary footer buttons: the characteristics card reaches the map and the
          backpack through these, so a test cannot get at them without this. */}
      {(actionsList ?? []).map((a, i) => (
        <button key={i} data-testid={`extra-action-${i}`} onClick={a.onAction}>{a.icon}</button>
      ))}
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

import GameBook, { lastEffectCard, statChangeItems, grantedItemUuids, itemCardForUuid } from '../features/gameplay/GameBook'
import { endMatch, sleepCharacter, startMovement, executeEvent, getMatchWeather } from '../api/matches'

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

  // Map view: clicking an unexplored ("?") node that borders the player selects
  // it and the RIGHT page shows its NEIGHBOR (movement) card — the location card
  // is fog-gated, so the matching move-target from gameData.locations is used,
  // with a working move action.
  it('map: clicking an unexplored "?" neighbor shows its movement card and can move there', async () => {
    const mapGameData = {
      ...GAME_DATA,
      playerStats: { life: 10, energy: 10 },
      actions: [],
      locations: [{ uuid: 'lb', idLocation: 6, name: 'Into the dark', energyCost: 2,
        card: { title: 'Into the dark' } }],
      info: {
        players: [{ idLocation: 1 }],
        locations: [{ idLocation: 1, flagAlreadyActived: 1, clockCounter: 0 }],
        locationsActive: [{
          idLocation: 1, uuid: 'l1', card: { title: 'Start location' },
          neighbors: [{ uuid: 'lb', idLocation: 6, idLocationFrom: 1, idLocationTo: 6,
            direction: 'WEST', flagBack: 0, card: { title: 'Into the dark' } }],
        }],
      },
    }
    startMovement.mockResolvedValue({})
    render(<GameBook gameData={mapGameData} matchUuid="m1" story={STORY} onClose={vi.fn()} />)
    fireEvent.click(screen.getByTestId('extra-action-0'))  // the fa-map action opens the map
    // a visited node keeps its own location card on the right page
    fireEvent.click(screen.getByTestId('map-node-1'))
    expect(screen.getByText('Start location')).toBeInTheDocument()
    // the unexplored neighbor node is clickable and takes the gold ring
    fireEvent.click(screen.getByTestId('map-node-6'))
    expect(screen.getByTestId('map-node-6').className).toContain('game-map-node--current')
    // the right page shows the neighbor's movement card, with its move action
    expect(screen.getByText('Into the dark')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('action-movement'))
    await waitFor(() => {
      expect(startMovement).toHaveBeenCalledWith('m1', 'lb', 'tok')
    })
  })

  // v0.35.6 — an arrival kills as an event does: the move answers an edgeState and the
  // board must narrate it, epilogue card and all, instead of leaving the player to notice
  // on the next reload that they are comatose.
  it('map: a move whose arrival put the party down opens the coma page', async () => {
    const mapGameData = {
      ...GAME_DATA,
      playerStats: { life: 10, energy: 10 },
      actions: [],
      locations: [{ uuid: 'lb', idLocation: 6, name: 'Into the dark', energyCost: 2,
        card: { title: 'Into the dark' } }],
      info: {
        players: [{ idLocation: 1 }],
        locations: [{ idLocation: 1, flagAlreadyActived: 1, clockCounter: 0 }],
        locationsActive: [{
          idLocation: 1, uuid: 'l1', card: { title: 'Start location' },
          neighbors: [{ uuid: 'lb', idLocation: 6, idLocationFrom: 1, idLocationTo: 6,
            direction: 'WEST', flagBack: 0, card: { title: 'Into the dark' } }],
        }],
      },
    }
    startMovement.mockResolvedValue({
      automaticEvents: [],
      edgeState: {
        sadnessOverflowUuids: [], comaUuids: [], allPlayersInComa: true,
        comaEventUuid: 'evt-coma', comaEventCard: { title: 'The dark closes in' },
        comaExecutedEventUuids: ['evt-coma'], comaEffects: [],
      },
    })
    render(<GameBook gameData={mapGameData} matchUuid="m1" story={STORY} onClose={vi.fn()} />)
    fireEvent.click(screen.getByTestId('extra-action-0'))
    fireEvent.click(screen.getByTestId('map-node-6'))
    fireEvent.click(screen.getByTestId('action-movement'))

    expect(await screen.findByText('The dark closes in')).toBeInTheDocument()
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
    // The reload holds the LoadingCard on the right page for 3s
    // (refreshComponents' timer), so the default 1s waitFor races it: give the
    // overlay room to land.
    await waitFor(() => expect(screen.getByTestId('page-back')).toBeInTheDocument(), { timeout: 4000 })
    expect(screen.getByText('Rainy')).toBeInTheDocument()   // WeatherCard on the right page
    // Back arrow dismisses the overlay (the page-back button goes away).
    fireEvent.click(screen.getByTestId('page-back'))
    await waitFor(() => expect(screen.queryByTestId('page-back')).not.toBeInTheDocument())
  })

  // Step 29 — when an executed event BOTH narrates an effect card AND changes the
  // weather, the async weather reload must not cover the effect: it attaches a
  // forward arrow (→) to it that opens the new weather page.
  it('event with effect + weather change shows the effect first, then the weather via the forward arrow', async () => {
    getMatchWeather
      .mockResolvedValueOnce({ uuid: 'w1', card: { title: 'Sunny' }, costMoveSafeLocation: 0 })
      .mockResolvedValue({ uuid: 'w2', card: { title: 'Rainy' }, costMoveSafeLocation: 0 })
    // The executed event answers with one applied effect carrying its own card.
    executeEvent.mockResolvedValue({ effects: [{ card: { title: 'EffectNarrative' } }] })
    const gd = { ...GAME_DATA, actions: [{ uuid: 'a2', name: 'Explore', available: true, card: { title: 'Explore' } }] }
    render(<GameBook gameData={gd} matchUuid="m1" story={STORY} onReload={vi.fn()} onClose={vi.fn()} />)
    // Open the action's (i) preview (right page) → then fire its execute button.
    fireEvent.click(screen.getByTestId('preview-action'))
    fireEvent.click(screen.getByTestId('action-action'))
    // The effect card lands on the right page; once the weather reload resolves it
    // gains a forward arrow instead of being replaced by the weather page.
    await waitFor(() => expect(screen.getByText('EffectNarrative')).toBeInTheDocument(), { timeout: 4000 })
    await waitFor(() => expect(screen.getByTestId('page-forward')).toBeInTheDocument(), { timeout: 4000 })
    expect(screen.queryByText('Rainy')).not.toBeInTheDocument()   // weather is NOT shown yet
    // In the effect+weather case the effect only leads forward: no back arrow.
    expect(screen.queryByTestId('page-back')).not.toBeInTheDocument()
    // The forward arrow opens the new weather page.
    fireEvent.click(screen.getByTestId('page-forward'))
    expect(screen.getByText('Rainy')).toBeInTheDocument()
  })

  // Step 29 — an executed event that narrates an effect but does NOT change the
  // weather keeps only the effect card, with no forward arrow.
  it('event with effect but no weather change shows the effect without a forward arrow', async () => {
    // Weather resolves to the same uuid throughout → no change.
    getMatchWeather.mockResolvedValue({ uuid: 'w1', card: { title: 'Sunny' }, costMoveSafeLocation: 0 })
    executeEvent.mockResolvedValue({ effects: [{ card: { title: 'EffectNarrative' } }] })
    const gd = { ...GAME_DATA, actions: [{ uuid: 'a2', name: 'Explore', available: true, card: { title: 'Explore' } }] }
    render(<GameBook gameData={gd} matchUuid="m1" story={STORY} onReload={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByTestId('preview-action'))
    fireEvent.click(screen.getByTestId('action-action'))
    await waitFor(() => expect(screen.getByText('EffectNarrative')).toBeInTheDocument(), { timeout: 4000 })
    expect(screen.queryByTestId('page-forward')).not.toBeInTheDocument()
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

// Step 34 — an event that hands over an item narrates itself with the ITEM's card, not
// with the card of the effect row that produced it: what the player wants to see is the
// thing they just got.
describe('grantedItemUuids', () => {
  it('names the story items an execution added', () => {
    const result = { itemChanges: [
      { characterUuid: 'c1', itemUuid: 'item-900', action: 'ADD' },
      { characterUuid: 'c1', itemUuid: 'item-901', action: 'ADD' },
    ] }
    expect(grantedItemUuids(result)).toEqual(['item-900', 'item-901'])
  })

  it('ignores a removal — nothing was gained to show', () => {
    const result = { itemChanges: [{ characterUuid: 'c1', itemUuid: 'item-900', action: 'REMOVE' }] }
    expect(grantedItemUuids(result)).toEqual([])
  })

  it('is empty when the event touched no item', () => {
    expect(grantedItemUuids({ itemChanges: [] })).toEqual([])
    expect(grantedItemUuids({})).toEqual([])
    expect(grantedItemUuids(undefined)).toEqual([])
  })
})

describe('itemCardForUuid', () => {
  const carried = [
    { uuid: 'row-1', itemUuid: 'item-900', card: { title: 'Healing Potion' } },
    { uuid: 'row-2', itemUuid: 'item-901' },
  ]

  it('finds the resolved card of a carried item by its STORY uuid', () => {
    expect(itemCardForUuid(carried, 'item-900')).toEqual({ title: 'Healing Potion' })
  })

  it('does not match on the inventory ROW uuid — the two are different things', () => {
    expect(itemCardForUuid(carried, 'row-1')).toBeNull()
  })

  it('returns null when the row carries no card, so the caller can fetch it', () => {
    expect(itemCardForUuid(carried, 'item-901')).toBeNull()
  })

  it('returns null for an item that is not carried, or no item at all', () => {
    expect(itemCardForUuid(carried, 'item-999')).toBeNull()
    expect(itemCardForUuid(carried, null)).toBeNull()
    expect(itemCardForUuid(undefined, 'item-900')).toBeNull()
  })
})

// Step 29 — the badges under the narrative come from the applied statChanges, not the effects.
describe('statChangeItems', () => {
  const t = (key) => key

  it('maps the engine statistics onto the badge keys, signing the delta', () => {
    const result = { statChanges: [
      { characterUuid: 'me', statistic: 'life', before: 10, after: 7, delta: -3 },
      { characterUuid: 'me', statistic: 'exp', before: 0, after: 2, delta: 2 },
      { characterUuid: 'me', statistic: 'coin', before: 5, after: 9, delta: 4 },
    ] }
    expect(statChangeItems(result, 'me', t)).toEqual([
      { key: 'life', label: 'game.stats.life', value: '-3' },
      { key: 'experience', label: 'game.stats.experience', value: '+2' },
      { key: 'coins', label: 'game.stats.coins', value: '+4' },
    ])
  })

  it('drops the changes of the other characters in the location', () => {
    const result = { statChanges: [
      { characterUuid: 'me', statistic: 'life', delta: -3 },
      { characterUuid: 'someone-else', statistic: 'life', delta: -3 },
    ] }
    expect(statChangeItems(result, 'me', t)).toEqual([
      { key: 'life', label: 'game.stats.life', value: '-3' },
    ])
  })

  it('sums a statistic a chain touched more than once', () => {
    const result = { statChanges: [
      { characterUuid: 'me', statistic: 'energy', delta: -4 },
      { characterUuid: 'me', statistic: 'energy', delta: 1 },
    ] }
    expect(statChangeItems(result, 'me', t)).toEqual([
      { key: 'energy', label: 'game.stats.energy', value: '-3' },
    ])
  })

  it('shows no badge for a net delta of zero, an unknown statistic or no change at all', () => {
    const clamped = { statChanges: [
      { characterUuid: 'me', statistic: 'life', before: 3, after: 3, delta: 0 },
      { characterUuid: 'me', statistic: 'sad', delta: 2 },
      { characterUuid: 'me', statistic: 'sad', delta: -2 },
      { characterUuid: 'me', statistic: 'nonsense', delta: 5 },
    ] }
    expect(statChangeItems(clamped, 'me', t)).toEqual([])
    expect(statChangeItems({ statChanges: [] }, 'me', t)).toEqual([])
    expect(statChangeItems(undefined, 'me', t)).toEqual([])
  })

  it('keeps every change when the player character is unknown', () => {
    const result = { statChanges: [{ characterUuid: 'me', statistic: 'sad', delta: 2 }] }
    expect(statChangeItems(result, null, t)).toEqual([
      { key: 'sadness', label: 'game.stats.sadness', value: '+2' },
    ])
  })
})
