// v1.7.0 V1 step 8 — STALE_MATCH on the board: the notice, the refetch with a new reload key, no error card.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../api/game', () => ({ getMatchInfo: vi.fn() }))
vi.mock('../api/stories', () => ({ getStory: vi.fn(), getStoryDetail: vi.fn() }))
vi.mock('@/features/guest-user/GuestUserContext', () => ({ useGuestUser: () => ({ user: { accessToken: 'tok' } }) }))
vi.mock('../i18n/context', () => ({ useTranslation: () => ({ t: (k) => k, lang: 'en' }) }))
vi.mock('@/context/ServerContext', () => ({
  useServer: () => ({ matchRefetch: { browsers: ['all'], minHiddenSeconds: 0 } }),
}))
vi.mock('../features/gameplay/GameBook', () => ({
  default: ({ onError, reloadKey, staleKey }) => (
    <div data-testid="game-book">
      <span data-testid="reload-key">{reloadKey}</span>
      <span data-testid="stale-key">{staleKey}</span>
      <button onClick={() => onError?.({ staleMatch: true })}>stale-error</button>
      <button onClick={() => onError?.({ status: 409, response: { data: { error: 'NOT_YOUR_TURN' } } })}>other-error</button>
    </div>
  ),
}))
vi.mock('../components/modals/ErrorCard', () => ({
  default: ({ message }) => <div data-testid="error-card">{message}</div>,
}))

import GamePage from '../pages/GamePage'
import { getMatchInfo } from '../api/game'
import { getStory, getStoryDetail } from '../api/stories'
import { STALE_EVENT } from '../api/matchVersion'

function wrap() {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/play/abc', state: { matchUuid: 'm1' } }]}>
      <Routes><Route path="/play/:storyId" element={<GamePage />} /></Routes>
    </MemoryRouter>)
}

function announce(matchUuid) {
  act(() => { window.dispatchEvent(new CustomEvent(STALE_EVENT, { detail: { matchUuid } })) })
}

describe('GamePage on STALE_MATCH', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getMatchInfo.mockResolvedValue({ locations: [] })
    getStory.mockResolvedValue({ uuid: 'abc' })
    getStoryDetail.mockResolvedValue({ uuid: 'abc' })
  })
  afterEach(() => vi.useRealTimers())

  it('v1.8.0 — asks the board for the Refreshing page, refetches it and bumps the reload key; no floating notice', async () => {
    wrap()
    await screen.findByTestId('game-book')
    expect(getMatchInfo).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('stale-key').textContent).toBe('0')
    announce('m1')
    expect(screen.getByTestId('stale-key').textContent).toBe('1')
    expect(screen.queryByRole('status')).toBeNull()
    await waitFor(() => expect(getMatchInfo).toHaveBeenCalledTimes(2))
    expect(screen.getByTestId('reload-key').textContent).toBe('1')
  })

  it('ignores another match; an event without a match uuid counts', async () => {
    wrap()
    await screen.findByTestId('game-book')
    announce('other')
    expect(screen.getByTestId('stale-key').textContent).toBe('0')
    announce(undefined)
    expect(screen.getByTestId('stale-key').textContent).toBe('1')
  })

  it('a stale action error opens no error card, another one does', async () => {
    wrap()
    await screen.findByTestId('game-book')
    fireEvent.click(screen.getByText('stale-error'))
    expect(screen.queryByTestId('error-card')).toBeNull()
    fireEvent.click(screen.getByText('other-error'))
    expect(screen.getByTestId('error-card').textContent).toBe('NOT_YOUR_TURN')
  })

  it('a page return refetches the match', async () => {
    wrap()
    await screen.findByTestId('game-book')
    act(() => { window.dispatchEvent(new Event('online')) })
    await waitFor(() => expect(getMatchInfo).toHaveBeenCalledTimes(2))
  })
})
