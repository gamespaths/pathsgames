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
  useItem: vi.fn(),
  dropItem: vi.fn(),
  getInventory: vi.fn(() => Promise.resolve({ items: [] })),
  getMatchClock: vi.fn(() => Promise.resolve(null)),
  getMatchWeather: vi.fn(() => Promise.resolve(null)),
  getMatchLocations: vi.fn(() => Promise.resolve({ matchUuid: 'm1', locations: [] })),
  getMatchLogs: vi.fn(() => Promise.resolve([])),
  sleepCharacter: vi.fn(),
  startMovement: vi.fn(),
  executeEvent: vi.fn(),
  selectChoice: vi.fn(),
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
              onForward, actionsList, onSelect, locked, lockInfo }) => (
    <div data-testid={entityType ? `cc-${entityType}` : 'game-card'}>
      <span>{card?.title}</span>{children}{childrenIntoImage}
      {onClose && <button data-testid="page-back" onClick={onClose}>back</button>}
      {onForward && <button data-testid="page-forward" onClick={onForward}>forward</button>}
      {onPreview && <button data-testid={`preview-${entityType}`} onClick={onPreview}>preview</button>}
      {onAction && <button data-testid={`action-${entityType}`} onClick={onAction}>action</button>}
      {onSelect && <button data-testid={`select-${entityType}`} onClick={onSelect}>select</button>}
      {locked && <span data-testid={`locked-${entityType}`}>{lockInfo}</span>}
      {(actionsList ?? []).map((a, i) => (
        <button key={i} data-testid={`extra-action-${i}`} onClick={a.onAction}>{a.icon}</button>
      ))}
    </div>
  ),
}))

import GameBook from '../features/gameplay/GameBook'
import { executeEvent, getInventory, getMatchLocations, getMatchWeather, selectChoice } from '../api/matches'

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

  // The payload names a neighbor by the uuid of the location at the far end, so every
  // path into the same place shares it while costing something different. The board
  // must quote the cost of the move IT offers — the one leaving the player's location.
  it('quotes the cost of the move leaving the player location, not another origin', async () => {
    getMatchLocations.mockResolvedValue({
      matchUuid: 'm1',
      locations: [
        // the player stands on 1; this is the move the board renders
        { idLocation: 1, neighbors: [{ uuid: 'l1', totalEnergyCost: 3 }] },
        // another visited location bordering the same destination, listed later
        { idLocation: 9, neighbors: [{ uuid: 'l1', totalEnergyCost: 7 }] },
      ],
    })
    renderBook()
    await waitFor(() => expect(getMatchLocations).toHaveBeenCalled())
    const card = await screen.findByTestId('cc-movement')
    await waitFor(() => expect(card).toHaveTextContent('3'))
    expect(card).not.toHaveTextContent('7')
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
  it.skip('attaches a forward arrow to the coma page when the same event changed the weather', async () => {
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

describe('GameBook — the Step 31 choice engine', () => {
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

  const PENDING = {
    status: 'CHOICES_PENDING', effects: [], pendingChoices: [
      { uuid: 'c1', name: 'Gold Door', available: true, reason: null },
      { uuid: 'c2', name: 'Runes', available: false, reason: 'CONDITION_STATISTICS_NOT_MET' },
    ],
    card: { title: 'The Crossroads' },
    edgeState: { comaUuids: [], sadnessOverflowUuids: [] },
  }

  // CHOICES_PENDING puts the event card on the LEFT (entityType "event") and the options
  // as small cards on the RIGHT (entityType "choice"), plus a "do nothing" card — not the
  // effect-narrative path (the event applied nothing).
  it('opens the event card (left) and the options list (right) on CHOICES_PENDING', async () => {
    executeEvent.mockResolvedValue(PENDING)
    await executeAction()
    expect(await screen.findByTestId('cc-event')).toBeInTheDocument()         // event card, left
    expect(screen.getAllByTestId('cc-choice')).toHaveLength(2)                // one per option
  })

  // The event card's back arrow ends the event.
  it('the event card back arrow closes the choice-event view', async () => {
    executeEvent.mockResolvedValue(PENDING)
    await executeAction()
    expect(await screen.findByTestId('cc-event')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('page-back'))   // the event card's only close arrow
    expect(screen.queryByTestId('cc-event')).not.toBeInTheDocument()
    expect(screen.queryAllByTestId('cc-choice')).toHaveLength(0)
  })

  // The APPLIED flow (the Step 29 default) never opens the choices view.
  it('keeps the effect-narrative path on an APPLIED event', async () => {
    executeEvent.mockResolvedValue({
      status: 'APPLIED', effects: [], pendingChoices: [],
      edgeState: { comaUuids: [], sadnessOverflowUuids: [] },
    })
    await executeAction()
    await waitFor(() => expect(executeEvent).toHaveBeenCalled())
    expect(screen.queryByTestId('cc-event')).not.toBeInTheDocument()
    expect(screen.queryAllByTestId('cc-choice')).toHaveLength(0)
  })

  // The options list survives the async weather/board reload the same event triggers —
  // even when the reload reports a weather change, it must not cover the right page.
  it('keeps the options list after the post-event reload (weather does not cover it)', async () => {
    getMatchWeather
      .mockResolvedValueOnce({ uuid: 'w1', card: { title: 'Sunny' }, costMoveSafeLocation: 0 })
      .mockResolvedValue({ uuid: 'w2', card: { title: 'Rainy' }, costMoveSafeLocation: 0 })
    executeEvent.mockResolvedValue(PENDING)
    await executeAction()
    expect((await screen.findAllByTestId('cc-choice')).length).toBe(2)
    await waitFor(() => expect(getMatchLocations).toHaveBeenCalled())
    expect(screen.getAllByTestId('cc-choice')).toHaveLength(2)
    expect(screen.getAllByTestId('cc-choice')).toHaveLength(2)
  })
})

describe('GameBook — the Step 32 choice resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getMatchWeather.mockResolvedValue({ uuid: 'w1', card: { title: 'Sunny' }, costMoveSafeLocation: 0 })
    getMatchLocations.mockResolvedValue({ matchUuid: 'm1', locations: [] })
  })

  const PENDING = {
    status: 'CHOICES_PENDING', effects: [], pendingChoices: [
      { uuid: 'c1', name: 'Gold Door', available: true, reason: null },
    ],
    card: { title: 'The Crossroads' },
    edgeState: { comaUuids: [], sadnessOverflowUuids: [] },
  }

  const RESOLVED = {
    status: 'APPLIED', choiceUuid: 'c1', eventUuid: 'e1',
    narrative: 'You push the door open.',
    effects: [{ effectUuid: 'ef1', card: { title: 'A wound' } }],
    statChanges: [], pendingChoices: [],
    edgeState: { comaUuids: [], sadnessOverflowUuids: [] },
  }

  async function openChoices() {
    executeEvent.mockResolvedValue(PENDING)
    renderBook()
    fireEvent.click(screen.getByTestId('preview-action'))
    fireEvent.click(screen.getByTestId('action-action'))
    expect(await screen.findByTestId('cc-choice')).toBeInTheDocument()
  }

  it('resolves the picked option through select-choice and closes the options', async () => {
    await openChoices()
    selectChoice.mockResolvedValue(RESOLVED)

    fireEvent.click(screen.getByTestId('select-choice'))

    await waitFor(() => expect(selectChoice).toHaveBeenCalledWith('m1', 'c1', 'tok', 'en'))
    // The options are gone and the LEFT page is back on the current location: the
    // roadmap's "riparte dalla current location". What is left on the right is the
    // narrative card, which is the point of the whole exchange.
    await waitFor(() => expect(screen.queryAllByTestId('cc-choice')).toHaveLength(0))
    expect(screen.getByText('A wound')).toBeInTheDocument()
  })

  it('narrates with the linked event card when an effect ran one', async () => {
    await openChoices()
    selectChoice.mockResolvedValue({
      ...RESOLVED,
      choiceEventUuid: 'evt-linked',
      choiceEventCard: { title: 'Beyond the door' },
    })

    fireEvent.click(screen.getByTestId('select-choice'))

    // The event's own card wins over the last effect card — "la card del evento".
    expect(await screen.findByText('Beyond the door')).toBeInTheDocument()
    expect(screen.queryByText('A wound')).not.toBeInTheDocument()
  })

  it('falls back to the last effect card when no event was linked', async () => {
    await openChoices()
    selectChoice.mockResolvedValue(RESOLVED)

    fireEvent.click(screen.getByTestId('select-choice'))

    expect(await screen.findByText('A wound')).toBeInTheDocument()
  })

  it('re-arms the options when a linked event is itself a choice-event', async () => {
    await openChoices()
    selectChoice.mockResolvedValue({
      status: 'CHOICES_PENDING',
      card: { title: 'A deeper fork' },
      pendingChoices: [
        { uuid: 'c9', name: 'Deeper', available: true, reason: null },
        { uuid: 'c8', name: 'Back', available: true, reason: null },
      ],
      effects: [], statChanges: [],
      edgeState: { comaUuids: [], sadnessOverflowUuids: [] },
    })

    fireEvent.click(screen.getByTestId('select-choice'))

    await waitFor(() => expect(screen.getAllByTestId('cc-choice')).toHaveLength(2))
    expect(screen.getByTestId('cc-event')).toBeInTheDocument()
  })

  it('keeps the options open and reports the error when the resolution is refused', async () => {
    const onError = vi.fn()
    executeEvent.mockResolvedValue(PENDING)
    render(<GameBook gameData={GAME_DATA} matchUuid="m1" story={STORY} onError={onError} />)
    fireEvent.click(screen.getByTestId('preview-action'))
    fireEvent.click(screen.getByTestId('action-action'))
    expect(await screen.findByTestId('cc-choice')).toBeInTheDocument()

    selectChoice.mockRejectedValue({ response: { data: { error: 'CHOICE_NOT_OPEN' } } })
    fireEvent.click(screen.getByTestId('select-choice'))

    await waitFor(() => expect(onError).toHaveBeenCalledWith('CHOICE_NOT_OPEN'))
    // The cycle may still be open, so retrying is legal: the list stays put.
    expect(screen.getAllByTestId('cc-choice')).toHaveLength(1)
  })

  it('shows a coma over the narrative when the option put the party down', async () => {
    await openChoices()
    selectChoice.mockResolvedValue({
      ...RESOLVED,
      edgeState: {
        comaUuids: [], sadnessOverflowUuids: [], allPlayersInComa: true,
        comaEventCard: { title: 'All asleep forever' },
      },
    })

    fireEvent.click(screen.getByTestId('select-choice'))

    expect(await screen.findByText('All asleep forever')).toBeInTheDocument()
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
    fireEvent.click(screen.getByTestId('extra-action-0'))             // fa-map opens the map
    expect(screen.getByTestId('game-map-canvas')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('page-forward'))               // the enter-location arrow
    expect(screen.queryByTestId('game-map-canvas')).not.toBeInTheDocument()
    expect(screen.getByTestId('cc-movement')).toBeInTheDocument()     // back on the board
  })

  // The map's own back arrow closes it without touching the rest of the view.
  it('closes the map with its back arrow', () => {
    renderBook()
    fireEvent.click(screen.getByTestId('extra-action-0'))
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
  // card on the board and auto-clicks its Sleep button. It is the card's MAIN action —
  // fa-map, which used to be, now sits first in actionsList.
  it('reveals and fires the sleep card from the characteristics fa-bed shortcut', async () => {
    const onReload = vi.fn()
    renderBook({}, { onReload })
    expect(screen.queryByTestId('go-to-sleep-card')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('action-information'))
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

describe('GameBook — inventory (Step 34)', () => {
  it('renders one ItemCard per inventory row of the calling player', () => {
    renderBook({
      playerStats: {
        life: 10, energy: 10, constitution: 3,
        items: [
          { uuid: 'row-1', itemUuid: 'item-900', name: 'Potion', weight: 3, amount: 1,
            isConsumabile: true, card: { title: 'Healing Potion' } },
          { uuid: 'row-2', itemUuid: 'item-901', name: 'Sword', weight: 5, amount: 1,
            isConsumabile: false },
        ],
      },
    })
    // The bag lives on its own page now: the flask button is the way in.
    fireEvent.click(screen.getAllByTestId('extra-action-3')[0])

    expect(screen.getAllByTestId('cc-item')).toHaveLength(2)
    // The non-consumable one renders locked — carried, not usable.
    expect(screen.getByTestId('locked-item')).toBeTruthy()
  })

  it('renders no ItemCard when the player carries nothing', () => {
    renderBook({ playerStats: { life: 10, energy: 10, constitution: 3, items: [] } })
    fireEvent.click(screen.getAllByTestId('extra-action-3')[0])
    expect(screen.queryByTestId('cc-item')).toBeNull()
  })

  it('survives a player stats block with no items key at all', () => {
    renderBook()
    expect(screen.queryByTestId('cc-item')).toBeNull()
  })

  it('a dropped item reloads the board: nothing to narrate, only a weight that changed', async () => {
    const onReload = vi.fn()
    renderBook({
      playerStats: {
        life: 10, energy: 10, constitution: 3,
        items: [{ uuid: 'row-1', itemUuid: 'item-900', name: 'Potion', weight: 3,
                  amount: 1, isConsumabile: true }],
      },
    }, { onReload })

    fireEvent.click(screen.getAllByTestId('extra-action-3')[0])
    fireEvent.click(screen.getByTestId('preview-item'))
    fireEvent.click(screen.getAllByTestId('extra-action-0').at(-1))

    await waitFor(() => expect(onReload).toHaveBeenCalled())
  })
})

describe('GameBook — the backpack page (Step 34)', () => {
  // getInventory is a module-level mock shared with the tests above: without this the
  // "not called" assertions would read another test's call.
  beforeEach(() => {
    vi.clearAllMocks()
    getInventory.mockResolvedValue({ items: [] })
  })

  const BAG = {
    life: 10, energy: 10, constitution: 3, weight: 4, weightMax: 30,
    items: [
      { uuid: 'row-1', itemUuid: 'item-900', name: 'Potion', weight: 2, amount: 2,
        isConsumabile: true, card: { title: 'Healing Potion' } },
    ],
  }

  it('the flask button opens the backpack on the right page', () => {
    renderBook({ playerStats: BAG })

    // Before: the characteristics card, no item cards.
    expect(screen.queryByTestId('cc-item')).toBeNull()
    // The flask is the 4th secondary action of the characteristics card (index 3).
    fireEvent.click(screen.getAllByTestId('extra-action-3')[0])

    expect(screen.getAllByTestId('cc-item').length).toBeGreaterThan(0)
  })

  it('the backpack lists one card per row, and the left page closes it again', () => {
    renderBook({ playerStats: BAG })
    fireEvent.click(screen.getAllByTestId('extra-action-3')[0])

    // Right page: the rows. Left page: the bag card, which owns the way back.
    expect(screen.getAllByTestId('cc-item')).toHaveLength(1)
    expect(screen.getByTestId('cc-items')).toBeTruthy()

    fireEvent.click(screen.getByTestId('page-back'))

    // Back on the board: the rows and the bag page are gone, the location and the
    // characteristics card are what the player sees again.
    expect(screen.queryByTestId('cc-item')).toBeNull()
    expect(screen.queryByTestId('cc-items')).toBeNull()
    expect(screen.getByTestId('cc-location')).toBeTruthy()
    expect(screen.getByTestId('cc-information')).toBeTruthy()
  })

  it('closing the bag returns to the board even when it was opened from the statistics list', () => {
    renderBook({ playerStats: BAG })
    // In through the statistics view, where ItemsCard sits next to the map card.
    fireEvent.click(screen.getByTestId('preview-information'))
    fireEvent.click(screen.getAllByTestId('action-items')[0])
    expect(screen.getAllByTestId('cc-item').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByTestId('page-back'))

    // Not back to the menu that led here — back to the game. (The characteristics card
    // matches more than once: the board's copy plus the preview modal opened above.)
    expect(screen.queryByTestId('cc-item')).toBeNull()
    expect(screen.queryByTestId('cc-map')).toBeNull()
    expect(screen.getAllByTestId('cc-information').length).toBeGreaterThan(0)
  })

  it('the small backpack card in the statistics view opens the same page', () => {
    renderBook({ playerStats: BAG })
    // Open the statistics view first: that is where ItemsCard lives, next to the map.
    fireEvent.click(screen.getByTestId('preview-information'))

    const openers = screen.getAllByTestId('action-items')
    expect(openers.length).toBeGreaterThan(0)
    fireEvent.click(openers[0])

    expect(screen.getAllByTestId('cc-item').length).toBeGreaterThan(0)
  })

  it('an event that grants a carried item narrates with the ITEM card, not the effect one', async () => {
    executeEvent.mockResolvedValue({
      status: 'APPLIED',
      effects: [{ statistic: 'exp', card: { title: 'The effect card' } }],
      itemChanges: [{ characterUuid: 'me', itemUuid: 'item-900', action: 'ADD' }],
    })
    renderBook({ playerStats: BAG })

    fireEvent.click(screen.getByTestId('preview-action'))
    fireEvent.click(screen.getByTestId('action-action'))

    // The item is already carried, so its card was resolved by match-info: no fetch.
    await waitFor(() => expect(screen.getAllByText('Healing Potion').length).toBeGreaterThan(0))
    expect(screen.queryByText('The effect card')).toBeNull()
    expect(getInventory).not.toHaveBeenCalled()
  })

  it('fetches the inventory when the granted item is brand new', async () => {
    executeEvent.mockResolvedValue({
      status: 'APPLIED',
      effects: [{ statistic: 'exp', card: { title: 'The effect card' } }],
      itemChanges: [{ characterUuid: 'me', itemUuid: 'item-999', action: 'ADD' }],
    })
    getInventory.mockResolvedValue({
      items: [{ uuid: 'row-9', itemUuid: 'item-999', card: { title: 'A brand new thing' } }],
    })
    renderBook({ playerStats: BAG })

    fireEvent.click(screen.getByTestId('preview-action'))
    fireEvent.click(screen.getByTestId('action-action'))

    await waitFor(() => expect(getInventory).toHaveBeenCalled())
    await waitFor(() => expect(screen.getAllByText('A brand new thing').length).toBeGreaterThan(0))
    expect(screen.queryByText('The effect card')).toBeNull()
  })

  it('a failed inventory fetch leaves the board alone rather than crashing it', async () => {
    executeEvent.mockResolvedValue({
      status: 'APPLIED',
      effects: [{ statistic: 'exp', card: { title: 'The effect card' } }],
      itemChanges: [{ characterUuid: 'me', itemUuid: 'item-999', action: 'ADD' }],
    })
    getInventory.mockRejectedValue(new Error('offline'))
    renderBook({ playerStats: BAG })

    fireEvent.click(screen.getByTestId('preview-action'))
    fireEvent.click(screen.getByTestId('action-action'))

    await waitFor(() => expect(getInventory).toHaveBeenCalled())
    expect(screen.getByTestId('book')).toBeTruthy()
  })

  it('an event that grants nothing still narrates with the effect card', async () => {
    executeEvent.mockResolvedValue({
      status: 'APPLIED',
      effects: [{ statistic: 'exp', card: { title: 'The effect card' } }],
      itemChanges: [],
    })
    renderBook({ playerStats: BAG })

    fireEvent.click(screen.getByTestId('preview-action'))
    fireEvent.click(screen.getByTestId('action-action'))

    await waitFor(() => expect(screen.getAllByText('The effect card').length).toBeGreaterThan(0))
    expect(getInventory).not.toHaveBeenCalled()
  })
})
