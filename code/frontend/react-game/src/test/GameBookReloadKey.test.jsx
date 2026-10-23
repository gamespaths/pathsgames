// v1.7.0 V1 step 8 — a new reload key reloads the clock, weather and locations; a stale end-game shows no error.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('../i18n/context', () => ({ useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }) }))
vi.mock('@/features/guest-user/GuestUserContext', () => ({ useGuestUser: () => ({ user: { accessToken: 'tok' } }) }))
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
vi.mock('../components/book/Book', () => ({ default: ({ left, right }) => <div data-testid="book">{left}{right}</div> }))
vi.mock('../features/gameplay/GameBookMobile', () => ({ default: () => <div /> }))
vi.mock('../features/gameplay/EndGameBook', () => ({ default: () => <div /> }))
vi.mock('../features/gameplay/cards/PlayerStats', () => ({ default: () => <div /> }))
vi.mock('../features/matches/MatchLogCard', () => ({ default: () => <div data-testid="match-log" /> }))
vi.mock('../components/layout/Card', () => ({ default: () => <div /> }))

import GameBook from '../features/gameplay/GameBook'
import { getMatchClock } from '../api/matches'

const GAME_DATA = {
  actualLocationCard: { title: 'Entrance' }, playerStats: { life: 10 }, locations: [], actions: [],
  endGameCard: { title: 'End' },
  info: { players: [{ uuid: 'me', idLocation: 1 }], locations: [], locationsActive: [] },
}

function board(reloadKey, openLogKey = 0) {
  return <GameBook gameData={GAME_DATA} matchUuid="m1" story={{ uuid: 's1' }} reloadKey={reloadKey}
    openLogKey={openLogKey} onReload={vi.fn()} onClose={vi.fn()} onError={vi.fn()} />
}

describe('GameBook reload key', () => {
  beforeEach(() => vi.clearAllMocks())

  it('a new key reloads the chrome, the same key does not', async () => {
    const { rerender } = render(board(0))
    await waitFor(() => expect(getMatchClock).toHaveBeenCalledTimes(1))
    rerender(board(0))
    rerender(board(1))
    await waitFor(() => expect(getMatchClock).toHaveBeenCalledTimes(2))
    expect(screen.getByTestId('book')).toBeTruthy()
  })

  it('v1.7.0 step 12 — a new log key opens the match log on the right page', async () => {
    const { rerender } = render(board(0, 0))
    await waitFor(() => expect(getMatchClock).toHaveBeenCalledTimes(1))
    expect(screen.queryByTestId('match-log')).toBeNull()
    rerender(board(0, 1))
    await waitFor(() => expect(screen.getByTestId('match-log')).toBeTruthy())
  })
})
