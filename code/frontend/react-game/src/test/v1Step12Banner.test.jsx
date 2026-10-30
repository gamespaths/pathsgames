// v1.7.0 V1 step 12 — the dismissible "match is being updated" banner after a return refetch, with the log link.
import { describe, it, expect, vi, beforeEach } from 'vitest'
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
  default: ({ openLogKey }) => <div data-testid="game-book"><span data-testid="log-key">{openLogKey}</span></div>,
}))

import GamePage from '../pages/GamePage'
import { getMatchInfo } from '../api/game'
import { getStory, getStoryDetail } from '../api/stories'
import { clearMatchVersions, rememberMatchVersion } from '../api/matchVersion'

function wrap() {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/play/abc', state: { matchUuid: 'm1' } }]}>
      <Routes><Route path="/play/:storyId" element={<GamePage />} /></Routes>
    </MemoryRouter>)
}

function versions(...list) {
  let i = 0
  getMatchInfo.mockImplementation(async () => {
    const matchVersion = list[Math.min(i, list.length - 1)]
    i += 1
    rememberMatchVersion('m1', { matchVersion })
    return { locations: [], matchVersion }
  })
}

// v1.8.0 — the return listener is attached by an effect after the board renders: under load a single
// early event is lost, so it is sent again until the return refetch answers
async function returnToThePage() {
  await waitFor(() => {
    act(() => { window.dispatchEvent(new Event('online')) })
    expect(getMatchInfo.mock.calls.length).toBeGreaterThanOrEqual(2)
  })
}

describe('GamePage — match changed on another device', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearMatchVersions()
    getStory.mockResolvedValue({ uuid: 'abc' })
    getStoryDetail.mockResolvedValue({ uuid: 'abc' })
  })

  it('a new version after the return refetch shows the banner; the link opens the log', async () => {
    versions('v1', 'v2')
    wrap()
    await screen.findByTestId('game-book')
    await returnToThePage()
    const banner = await screen.findByTestId('match-updated-banner')
    expect(banner).toHaveTextContent('game.matchUpdating')
    expect(screen.getByTestId('log-key').textContent).toBe('0')
    fireEvent.click(screen.getByText('game.matchUpdatedLog'))
    expect(screen.queryByTestId('match-updated-banner')).toBeNull()
    expect(screen.getByTestId('log-key').textContent).toBe('1')
  })

  it('the banner is dismissible', async () => {
    versions('v1', 'v2')
    wrap()
    await screen.findByTestId('game-book')
    await returnToThePage()
    await screen.findByTestId('match-updated-banner')
    fireEvent.click(screen.getByLabelText('game.matchUpdatedDismiss'))
    expect(screen.queryByTestId('match-updated-banner')).toBeNull()
  })

  it('the same version (or a write of this device already known) shows nothing', async () => {
    versions('v1', 'v1')
    wrap()
    await screen.findByTestId('game-book')
    await returnToThePage()
    await waitFor(() => expect(getMatchInfo).toHaveBeenCalledTimes(2))
    expect(screen.queryByTestId('match-updated-banner')).toBeNull()
  })
})
