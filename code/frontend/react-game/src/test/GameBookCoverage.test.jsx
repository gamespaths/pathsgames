import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// Coverage-focused companion to GameBook.test.jsx: it exercises the branches the
// main suite leaves untouched (edge states, the map "enter location" arrow, the
// (i)-card sleep shortcut, the match-log page and the locations refresh failure).

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
  getMatchLogs: vi.fn(() => Promise.resolve([])),
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
vi.mock('../features/gameplay/GameBookMobile', () => ({ default: () => <div data-testid="game-book-mobile" /> }))
vi.mock('../features/gameplay/EndGameBook', () => ({ default: () => <div data-testid="end-game-book" /> }))
vi.mock('../features/gameplay/cards/PlayerStats', () => ({ default: () => <div data-testid="player-stats" /> }))
vi.mock('../features/matches/MatchLogCard', () => ({
  default: ({ onBack }) => (
    <div data-testid="match-log-card"><button data-testid="log-back" onClick={onBack}>back</button></div>
  ),
}))
vi.mock('../features/gameplay/cards/GoToSleepCard', () => ({
  default: ({ onSlept }) => (
    <div data-testid="go-to-sleep-card">
      <button aria-label="Sleep" data-testid="action-sleep" onClick={() => onSlept?.()}>sleep</button>
    </div>
  ),
}))
// A single dumb Card stand-in: every handler GameBook wires becomes a button so
// the branch behind it can be fired from a test.
vi.mock('../components/layout/Card', () => ({
  default: ({ entityType, card, children, childrenIntoImage, onPreview, onAction, onClose,
              onForward, actionsList }) => (
    <div data-testid={entityType ? `cc-${entityType}` : 'game-card'}>
      <span>{card?.title}</span>{children}{childrenIntoImage}
      {onClose && <button data-testid="page-back" onClick={onClose}>back</button>}
      {onForward && <button data-testid="page-forward" onClick={onForward}>forward</button>}
      {onPreview && <button data-testid={`preview-${entityType}`} onClick={onPreview}>preview</button>}
      {onAction && <button data-testid={`action-${entityType}`} onClick={onAction}>action</button>}
      {(actionsList ?? []).map((a, i) => (
        <button key={i} data-testid={`extra-action-${i}`} onClick={a.onAction}>{a.icon}</button>
      ))}
    </div>
  ),
}))

import GameBook from '../features/gameplay/GameBook'
import { executeEvent, getMatchLocations, getMatchWeather } from '../api/matches'

const STORY = { uuid: 's1', title: 'Test Story', card: { title: 'Test Story' } }

// A board with one neighbor location and one available (non end-game) action, so
// the executed-event flow can be driven from the action card.
const GAME_DATA = {
  actualLocationCard: { title: 'Entrance' },
  playerStats: { life: 10, energy: 10, constitution: 3 },
  locations: [{ uuid: 'l1', idLocation: 2, name: 'Cave', card: { title: 'Cave' } }],
  actions: [{ uuid: 'a1', name: 'Explore', available: true, card: { title: 'Explore' } }],
  endGameCard: { title: 'You Won!' },
  info: {
    players: [{ uuid: 'me', idLocation: 1 }],
    locations: [{ idLocation: 1, flagAlreadyActived: 1, clockCounter: 0 }],
    locationsActive: [{ idLocation: 1, uuid: 'l0', card: { title: 'Start location' }, neighbors: [] }],
  },
}

function renderBook(overrides = {}, props = {}) {
  return render(
    <GameBook gameData={{ ...GAME_DATA, ...overrides }} matchUuid="m1" story={STORY}
      onReload={vi.fn()} onClose={vi.fn()} onError={vi.fn()} {...props} />
  )
}

describe('GameBook — locations payload', () => {
  beforeEach(() => vi.clearAllMocks())

  // buildLocationCosts walks every visited location's neighbors and indexes the
  // total energy cost by neighbor uuid; a neighbor without a uuid is skipped.
  it('indexes the per-neighbor energy costs from the locations payload', async () => {
    getMatchLocations.mockResolvedValue({
      matchUuid: 'm1',
      locations: [
        { idLocation: 1, neighbors: [{ uuid: 'l1', totalEnergyCost: 4 }, { uuid: null, totalEnergyCost: 9 }] },
        { idLocation: 2 },   // no neighbors array at all
      ],
    })
    renderBook()
    await waitFor(() => expect(getMatchLocations).toHaveBeenCalled())
    expect(screen.getByTestId('book')).toBeInTheDocument()
  })

  // The move costs are non-critical chrome: a failing refresh must keep the board
  // alive with the previous map (refreshLocations' catch).
  it('survives a failing locations refresh after a sleep reload', async () => {
    getMatchLocations
      .mockResolvedValueOnce({ matchUuid: 'm1', locations: [] })
      .mockRejectedValue(new Error('boom'))
    renderBook()
    await waitFor(() => expect(getMatchLocations).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getAllByTestId('preview-information')[0])   // statistics view
    fireEvent.click(await screen.findByTestId('action-sleep'))         // triggers the refresh
    await waitFor(() => expect(getMatchLocations).toHaveBeenCalledTimes(2))
    expect(screen.getByTestId('book')).toBeInTheDocument()
  })
})

describe('GameBook — edge states after an executed event', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getMatchWeather.mockResolvedValue({ uuid: 'w1', card: { title: 'Sunny' }, costMoveSafeLocation: 0 })
    getMatchLocations.mockResolvedValue({ matchUuid: 'm1', locations: [] })
  })

  async function executeAction() {
    renderBook()
    fireEvent.click(screen.getByTestId('preview-action'))
    fireEvent.click(screen.getByTestId('action-action'))
  }

  // Step 30 — the whole party going down is the news: the story's own epilogue
  // card is what the player reads on the right page.
  it('shows the party-coma page (with the story epilogue card) when everyone falls into a coma', async () => {
    executeEvent.mockResolvedValue({
      effects: [], edgeState: { allPlayersInComa: true, comaEventCard: { title: 'All asleep forever' } },
    })
    await executeAction()
    expect(await screen.findByText('All asleep forever')).toBeInTheDocument()
  })

  // A personal coma (this client's character is listed) shows the generic coma page.
  it('shows the personal coma page when this player is in the coma list', async () => {
    executeEvent.mockResolvedValue({ effects: [], edgeState: { comaUuids: ['me'] } })
    await executeAction()
    expect(await screen.findByText('game.coma.title')).toBeInTheDocument()
  })

  // Another character's coma is not this client's news: no coma page.
  it('ignores a coma that belongs to another character', async () => {
    executeEvent.mockResolvedValue({ effects: [], edgeState: { comaUuids: ['someone-else'] } })
    await executeAction()
    await waitFor(() => expect(executeEvent).toHaveBeenCalled())
    expect(screen.queryByText('game.coma.title')).not.toBeInTheDocument()
  })

  // Sadness overflow: the sadness page reports the life the character paid.
  it('shows the sadness page when this player overflowed their sadness', async () => {
    executeEvent.mockResolvedValue({ effects: [], edgeState: { sadnessOverflowUuids: ['me'] } })
    await executeAction()
    expect(await screen.findByText('game.sad.title')).toBeInTheDocument()
  })

  // Step 30 — a coma outranks a weather change: the weather waits behind a
  // forward arrow (→) attached to the coma page instead of covering it.
  it('attaches a forward arrow to the coma page when the same event changed the weather', async () => {
    getMatchWeather
      .mockResolvedValueOnce({ uuid: 'w1', card: { title: 'Sunny' }, costMoveSafeLocation: 0 })
      .mockResolvedValue({ uuid: 'w2', card: { title: 'Rainy' }, costMoveSafeLocation: 0 })
    executeEvent.mockResolvedValue({ effects: [], edgeState: { comaUuids: ['me'] } })
    await executeAction()
    await waitFor(() => expect(screen.getByTestId('page-forward')).toBeInTheDocument(), { timeout: 4000 })
    expect(screen.queryByText('Rainy')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('page-forward'))
    expect(screen.getByText('Rainy')).toBeInTheDocument()
  })

  // An action whose event carries no card at all previews a null card: the whole
  // preview state is cleared instead of opening an empty reading page.
  it('clears every preview when a card-less action is previewed', async () => {
    render(
      <GameBook gameData={{ ...GAME_DATA, actions: [{ uuid: 'a9', name: 'Nothing', available: false }] }}
        matchUuid="m1" story={STORY} onClose={vi.fn()} />
    )
    fireEvent.click(screen.getByTestId('preview-action'))
    expect(screen.queryByTestId('page-back')).not.toBeInTheDocument()
  })
})

describe('GameBook — map and statistics view', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getMatchLocations.mockResolvedValue({ matchUuid: 'm1', locations: [] })
  })

  // Step 0.28.5 — with the map open and nothing selected, the right page shows the
  // current location with the "enter" arrow: it drops back into the play view.
  it('enters the play view from the map\'s current-location arrow', () => {
    renderBook()
    fireEvent.click(screen.getByTestId('action-information'))         // fa-map opens the map
    expect(screen.getByTestId('game-map-canvas')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('page-forward'))               // the enter-location arrow
    expect(screen.queryByTestId('game-map-canvas')).not.toBeInTheDocument()
    expect(screen.getByTestId('cc-movement')).toBeInTheDocument()     // back on the board
  })

  // The map's own back arrow closes it without touching the rest of the view.
  it('closes the map with its back arrow', () => {
    renderBook()
    fireEvent.click(screen.getByTestId('action-information'))
    fireEvent.click(screen.getByLabelText('card.back'))
    expect(screen.queryByTestId('game-map-canvas')).not.toBeInTheDocument()
  })

  // The statistics view exposes the map card, whose action opens the same map.
  it('opens the map from the statistics-view map card', async () => {
    renderBook()
    fireEvent.click(screen.getAllByTestId('preview-information')[0])
    expect(await screen.findByTestId('go-to-sleep-card')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('action-map'))
    expect(screen.getByTestId('game-map-canvas')).toBeInTheDocument()
  })

  // The story card in the statistics view opens the match history on the right page.
  it('opens the match log page from the story card in the statistics view', async () => {
    renderBook()
    fireEvent.click(screen.getAllByTestId('preview-information')[0])
    fireEvent.click(await screen.findByTestId('preview-story'))
    expect(await screen.findByTestId('match-log-card')).toBeInTheDocument()
  })

  // The (i) characteristics card carries a fa-bed shortcut: it reveals the sleep
  // card on the board and auto-clicks its Sleep button.
  it('reveals and fires the sleep card from the characteristics fa-bed shortcut', async () => {
    const onReload = vi.fn()
    renderBook({}, { onReload })
    expect(screen.queryByTestId('go-to-sleep-card')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('extra-action-0'))
    expect(screen.getByTestId('go-to-sleep-card')).toBeInTheDocument()
    await waitFor(() => expect(onReload).toHaveBeenCalled(), { timeout: 2000 })
  })

  // A comatose character gets the coma card among the board cards.
  it('shows the coma card on the board while the character is comatose', () => {
    renderBook({ playerStats: { life: 0, energy: 0, isComa: true } })
    expect(screen.getByTestId('cc-coma')).toBeInTheDocument()
  })
})

afterEach(() => { delete window.matchMedia })
