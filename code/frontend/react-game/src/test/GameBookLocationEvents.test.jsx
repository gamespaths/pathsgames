import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

/**
 * Step 33 — the right page after an arrival and after a sleep.
 *
 * Both `onMoved` and `onSlept` used to drop their argument on the floor: the board learned
 * the new position from the reload alone, and a time-start told it nothing. These tests pin
 * the two things that changed — a movement now narrates what the destination did about the
 * arrival, and a sleep now narrates what ran out in the world while the party slept.
 */

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
  default: ({ left, right }) => <div data-testid="book">{left}{right}</div>,
}))
vi.mock('../components/book/BookPageLeft', () => ({ default: ({ children }) => <div>{children}</div> }))
vi.mock('../components/book/BookPageRight', () => ({ default: ({ children }) => <div>{children}</div> }))
vi.mock('../features/gameplay/cards/LocationCard', () => ({ default: () => <div data-testid="location-card" /> }))
vi.mock('../features/gameplay/cards/PlayerStats', () => ({ default: () => <div data-testid="player-stats" /> }))
vi.mock('../features/gameplay/ClockWidget', () => ({ default: () => <div data-testid="clock-widget" /> }))
vi.mock('../features/gameplay/SleepButton', () => ({ default: () => <div data-testid="sleep-button" /> }))
vi.mock('../features/gameplay/EndGameBook', () => ({ default: () => <div data-testid="end-game-book" /> }))
vi.mock('../features/gameplay/GameBookMobile', () => ({ default: () => <div data-testid="game-book-mobile" /> }))
vi.mock('../features/start-book/StartBookModal', () => ({ CardPreviewOverlay: () => <div /> }))

// The movement card: fires onMoved with whatever the API answered.
vi.mock('../features/gameplay/cards/MovementCard', () => ({
  default: ({ onMoved }) => (
    <div data-testid="movement-card">
      <button data-testid="do-move" onClick={() => onMoved?.(globalThis.__moveResult)}>move</button>
    </div>
  ),
}))
// The sleep card: fires onSlept with whatever the API answered.
vi.mock('../features/gameplay/cards/GoToSleepCard', () => ({
  default: ({ onSlept }) => (
    <div data-testid="go-to-sleep-card">
      <button data-testid="do-sleep" onClick={() => onSlept?.(globalThis.__sleepResult)}>sleep</button>
    </div>
  ),
}))
vi.mock('../features/gameplay/cards/AutomaticEvents', () => ({
  default: ({ items, onDismiss }) => (
    <div data-testid="automatic-events-list">
      <span data-testid="automatic-events-count">{items?.length ?? 0}</span>
      <button data-testid="automatic-events-dismiss" onClick={() => onDismiss?.()}>ok</button>
    </div>
  ),
}))
vi.mock('../components/layout/Card', () => ({
  default: ({ entityType, card, children, childrenIntoImage, onPreview, onAction, onClose, onForward, actionLabel }) => (
    <div data-testid={entityType ? 'config-card' : 'game-card'}>
      {card?.title}{children}{childrenIntoImage}
      {onClose && <button data-testid="page-back" onClick={onClose}>back</button>}
      {onForward && <button data-testid="page-forward" onClick={onForward}>forward</button>}
      {onPreview && <button data-testid={`preview-${entityType}`} onClick={onPreview}>preview</button>}
      {onAction && <button data-testid={entityType ? `action-${entityType}` : 'game-card-action'} onClick={onAction}>{actionLabel}</button>}
    </div>
  ),
}))

import GameBook from '../features/gameplay/GameBook'

const GAME_DATA = {
  actualLocationCard: { name: 'Entrance', title: 'Entrance' },
  playerStats: { life: 10 },
  locations: [{ uuid: 'l1', name: 'Cave' }],
  actions: [],
  info: { locationsActive: [{ secureParam: 1 }] },
}
const STORY = { uuid: 's1', title: 'Test Story', card: { title: 'Test Story' } }

function automaticEvent(trigger, title) {
  return {
    trigger,
    idLocation: 12,
    eventUuid: `evt-${trigger}`,
    card: { title },
    effects: [],
    statChanges: [],
    locationChanges: [],
    gameOver: false,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  globalThis.__moveResult = undefined
  globalThis.__sleepResult = undefined
})

describe('GameBook — Step 33 arrivals', () => {
  it('narrates the event the destination fired on arrival', async () => {
    globalThis.__moveResult = {
      automaticEvents: [automaticEvent('FIRST_ENTRY', 'A door left open')],
    }
    render(<GameBook gameData={GAME_DATA} matchUuid="m1" story={STORY}
      onReload={vi.fn()} onClose={vi.fn()} />)

    fireEvent.click(screen.getAllByTestId('do-move')[0])

    expect(await screen.findByText('A door left open')).toBeInTheDocument()
  })

  it('chains several fired events behind a forward arrow', async () => {
    // The history trigger and the occupancy one are orthogonal: both can fire on one
    // arrival, and the player reads them one after the other.
    globalThis.__moveResult = {
      automaticEvents: [
        automaticEvent('FIRST_ENTRY', 'A door left open'),
        automaticEvent('FIRST_IN_LOCATION', 'Nobody else is here'),
      ],
    }
    render(<GameBook gameData={GAME_DATA} matchUuid="m1" story={STORY}
      onReload={vi.fn()} onClose={vi.fn()} />)

    fireEvent.click(screen.getAllByTestId('do-move')[0])
    expect(await screen.findByText('A door left open')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('page-forward'))
    expect(await screen.findByText('Nobody else is here')).toBeInTheDocument()
  })

  it('a move that fired nothing narrates nothing', async () => {
    globalThis.__moveResult = { automaticEvents: [] }
    const onReload = vi.fn()
    render(<GameBook gameData={GAME_DATA} matchUuid="m1" story={STORY}
      onReload={onReload} onClose={vi.fn()} />)

    fireEvent.click(screen.getAllByTestId('do-move')[0])

    // The board still reloads — the character did move.
    await waitFor(() => expect(onReload).toHaveBeenCalled())
    expect(screen.queryByText('A door left open')).toBeNull()
  })
})

describe('GameBook — Step 33 wake-up list', () => {
  async function sleepWith(counterZero) {
    globalThis.__sleepResult = { counterZero }
    render(<GameBook gameData={GAME_DATA} matchUuid="m1" story={STORY}
      onReload={vi.fn()} onClose={vi.fn()} />)
    // The sleep card lives in the statistics view, behind the characteristics preview.
    fireEvent.click(screen.getAllByTestId('preview-information')[0])
    fireEvent.click(await screen.findByTestId('do-sleep'))
  }

  it('shows the counters that ran out while the party slept', async () => {
    await sleepWith([
      { eventUuid: 'e1', idLocation: 12, clock: 7, visibility: 'FULL', card: { title: 'x' } },
      { eventUuid: 'e2', idLocation: 99, clock: 7, visibility: 'ANONYMOUS' },
    ])

    // A LIST: several counters can expire on the same time-start.
    expect(await screen.findByTestId('automatic-events-list')).toBeInTheDocument()
    expect(screen.getByTestId('automatic-events-count')).toHaveTextContent('2')
  })

  it('dismissing the list returns the board', async () => {
    await sleepWith([
      { eventUuid: 'e1', idLocation: 12, clock: 7, visibility: 'FULL', card: { title: 'x' } },
    ])
    fireEvent.click(await screen.findByTestId('automatic-events-dismiss'))
    await waitFor(() => expect(screen.queryByTestId('automatic-events-list')).toBeNull())
  })

  it('an ordinary sleep shows no list at all', async () => {
    await sleepWith([])
    await waitFor(() => expect(screen.queryByTestId('automatic-events-list')).toBeNull())
  })
})
