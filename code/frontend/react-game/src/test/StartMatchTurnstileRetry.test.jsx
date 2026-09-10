import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// A Turnstile token is single-use and expires after ~300s: this suite pins the
// two rules that follow from it — the widget is never unmounted (so its own
// auto-refresh keeps minting), and a retry always sends a brand-new token.

// Each widget mount issues its own token; `ts.last` is the freshest one minted.
const ts = vi.hoisted(() => ({ minted: 0, last: null }))
vi.mock('@marsidev/react-turnstile', async () => {
  const { useEffect } = await import('react')
  const mint = (onSuccess) => {
    ts.minted += 1
    ts.last = `tok-${ts.minted}`
    onSuccess?.(ts.last)
  }
  return {
    Turnstile: ({ onSuccess }) => {
      useEffect(() => { mint(onSuccess) }, [])
      // Click = the widget refreshing an expired token on its own.
      return <button data-testid="turnstile-mock" onClick={() => mint(onSuccess)} />
    },
  }
})
vi.mock('@/utils/turnstile', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, CF_KEY: 'test-site-key' }
})
vi.mock('@/i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))
vi.mock('@/features/guest-user/GuestUserContext', () => ({
  useGuestUser: () => ({ user: { userUuid: 'u1', accessToken: 'tok-1' } }),
}))
vi.mock('@/api/matches', () => ({ createMatch: vi.fn(), joinMatch: vi.fn(), startMatch: vi.fn() }))

import StartMatchPage from '../pages/StartMatchPage'
import { createMatch, joinMatch, startMatch } from '@/api/matches'

const STORY = { uuid: 's1', title: 'The Lost Crown', card: { title: 'The Lost Crown' } }
const CONFIG = {
  character: { uuid: 'ch1', name: 'Ranger' },
  class: { uuid: 'cl1', name: 'Mage' },
  traits: [{ uuid: 'tr1', name: 'Brave' }],
  difficulty: { uuid: 'df1', name: 'Normal' },
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/start-match/s1', state: { story: STORY, config: CONFIG } }]}>
      <Routes>
        <Route path="/start-match/:storyId" element={<StartMatchPage />} />
        <Route path="/" element={<div>home-page</div>} />
        <Route path="/play/:storyId" element={<div>game-page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

const clickStart = () => fireEvent.click(screen.getAllByText('book.startGame')[0])
const turnstileToken = (call) => call[0].turnstileToken

describe('StartMatchFlow — Turnstile token freshness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ts.minted = 0
    ts.last = null
    joinMatch.mockResolvedValue({ uuid: 'c1' })
    startMatch.mockResolvedValue({ status: 'RUNNING' })
    vi.stubEnv('VITE_MATCH_START_DELAY', '3')
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it('keeps the widget mounted (hidden) once the gate has passed', () => {
    renderPage()
    expect(screen.getAllByText('book.startGame').length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('turnstile-mock').length).toBeGreaterThan(0)
    const holders = document.querySelectorAll('.start-match-antibot')
    expect(holders.length).toBeGreaterThan(0)
    holders.forEach(h => expect(h.hasAttribute('hidden')).toBe(true))
  })

  it('sends the refreshed token, not the one minted at mount', async () => {
    createMatch.mockResolvedValue({ uuid: 'm1', status: 'CREATED' })
    renderPage()
    const firstToken = ts.last
    // The widget refreshes its expired token while the player is still choosing.
    act(() => { fireEvent.click(screen.getAllByTestId('turnstile-mock')[0]) })
    expect(ts.last).not.toBe(firstToken)

    clickStart()
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })

    expect(createMatch).toHaveBeenCalledTimes(1)
    expect(turnstileToken(createMatch.mock.calls[0])).toBe(ts.last)
  })

  it('offers a retry on TURNSTILE_VALIDATION_FAILED and re-posts with a fresh token', async () => {
    createMatch
      .mockRejectedValueOnce({ response: { data: { error: 'TURNSTILE_VALIDATION_FAILED' } } })
      .mockResolvedValue({ uuid: 'm1', status: 'CREATED' })
    renderPage()
    clickStart()
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })

    expect(screen.getAllByText('TURNSTILE_VALIDATION_FAILED').length).toBeGreaterThan(0)
    expect(screen.getAllByText('startMatch.retry').length).toBeGreaterThan(0)

    await act(async () => { fireEvent.click(screen.getAllByText('startMatch.retry')[0]) })
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })

    expect(createMatch).toHaveBeenCalledTimes(2)
    const [first, second] = createMatch.mock.calls
    expect(turnstileToken(second)).not.toBe(turnstileToken(first))
    expect(turnstileToken(second)).toBe(ts.last)
  })
})
