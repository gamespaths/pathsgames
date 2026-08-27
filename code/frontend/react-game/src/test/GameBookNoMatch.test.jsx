import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

/**
 * GameBook before a match exists (the preview the story page renders) and with a
 * story that carries no card: every per-match endpoint must stay unasked, and the
 * board must still draw.
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
  getMatchLogs: vi.fn(() => Promise.resolve([])),
  sleepCharacter: vi.fn(),
  startMovement: vi.fn(),
  executeEvent: vi.fn(),
  selectChoice: vi.fn(),
}))
vi.mock('../components/book/Book', () => ({
  default: ({ left, right }) => <div data-testid="book">{left}{right}</div>,
}))
vi.mock('../features/gameplay/GameBookMobile', () => ({ default: () => <div data-testid="game-book-mobile" /> }))
vi.mock('../features/gameplay/EndGameBook', () => ({ default: () => <div data-testid="end-game-book" /> }))
vi.mock('../features/gameplay/cards/PlayerStats', () => ({ default: () => <div data-testid="player-stats" /> }))
vi.mock('../features/matches/MatchLogCard', () => ({ default: () => <div data-testid="match-log-card" /> }))
vi.mock('../components/layout/Card', () => ({
  default: ({ entityType, card }) => (
    <div data-testid={entityType ? `cc-${entityType}` : 'game-card'}>{card?.title}</div>
  ),
}))

import GameBook from '../features/gameplay/GameBook'
import {
  getMatchClock, getMatchWeather, getMatchLocations,
} from '../api/matches'

const GAME_DATA = {
  actualLocationCard: { title: 'Entrance' },
  playerStats: { life: 10, energy: 10, constitution: 3 },
  locations: [],
  actions: [],
  endGameCard: { title: 'You Won!' },
  info: {
    players: [{ uuid: 'me', idLocation: 1 }],
    locations: [],
    locationsActive: [{ idLocation: 1, uuid: 'l0', card: { title: 'Start location' }, neighbors: [] }],
  },
}

describe('GameBook without a match uuid', () => {
  beforeEach(() => vi.clearAllMocks())

  it('asks for no clock, weather or locations at all', async () => {
    render(<GameBook gameData={GAME_DATA} matchUuid={null} story={{ uuid: 's1', title: 'Story' }}
      onReload={vi.fn()} onClose={vi.fn()} onError={vi.fn()} />)

    await waitFor(() => expect(screen.getByTestId('book')).toBeInTheDocument())
    expect(getMatchClock).not.toHaveBeenCalled()
    expect(getMatchWeather).not.toHaveBeenCalled()
    expect(getMatchLocations).not.toHaveBeenCalled()
  })

  it('draws the board for a story that carries no card', async () => {
    render(<GameBook gameData={GAME_DATA} matchUuid={null} story={{ uuid: 's1' }}
      onReload={vi.fn()} onClose={vi.fn()} onError={vi.fn()} />)

    expect(await screen.findByTestId('book')).toBeInTheDocument()
  })

  it('drops the pending responses of a match that is unmounted mid-flight', async () => {
    let resolveClock
    getMatchClock.mockReturnValue(new Promise(r => { resolveClock = r }))

    const { unmount } = render(
      <GameBook gameData={GAME_DATA} matchUuid="m1" story={{ uuid: 's1' }}
        onReload={vi.fn()} onClose={vi.fn()} onError={vi.fn()} />)

    await waitFor(() => expect(getMatchClock).toHaveBeenCalled())
    unmount()
    resolveClock({ currentClock: 3 })   // arrives after the unmount: must be ignored

    await waitFor(() => expect(screen.queryByTestId('book')).not.toBeInTheDocument())
  })
})
