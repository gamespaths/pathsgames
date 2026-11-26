import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// A Turnstile token is single-use and expires after ~300s: this suite pins the
// two rules that follow from it — the widget is never unmounted (so its own
// auto-refresh keeps minting), and a retry always sends a brand-new token.

// Each widget mount issues its own token; `ts.last` is the freshest one minted.
const ts = vi.hoisted(() => ({ minted: 0, last: null, auto: true }))
vi.mock('@marsidev/react-turnstile', async () => {
  const { useEffect } = await import('react')
  const mint = (onSuccess) => {
    ts.minted += 1
    ts.last = `tok-${ts.minted}`
    onSuccess?.(ts.last)
  }
  return {
    Turnstile: ({ onSuccess, onError, onExpire }) => {
      useEffect(() => { if (ts.auto) mint(onSuccess) }, [])
      // Click = the widget refreshing an expired token on its own; the other two = its error and expiry callbacks.
      return <>
        <button data-testid="turnstile-mock" onClick={() => mint(onSuccess)} />
        <button data-testid="turnstile-error" onClick={() => onError?.()} />
        <button data-testid="turnstile-expire" onClick={() => onExpire?.()} />
      </>
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
const guest = vi.hoisted(() => ({ value: null }))
vi.mock('@/features/guest-user/GuestUserContext', () => ({
  useGuestUser: () => guest.value ?? { user: { userUuid: 'u1', accessToken: 'tok-1' } },
}))
vi.mock('@/features/guest-user/GoogleSignInButton', () => ({ default: () => <div data-testid="google-signin" /> }))
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

function renderPage(story = STORY) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/start-match/s1', state: { story, config: CONFIG } }]}>
      <Routes>
        <Route path="/start-match/:storyId" element={<StartMatchPage />} />
        <Route path="/" element={<div>home-page</div>} />
        <Route path="/play/:storyId" element={<div>game-page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

const startButtons = () => screen.getAllByRole('button', { name: 'book.start' })
const clickStart = () => fireEvent.click(startButtons()[0])
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
    expect(startButtons().length).toBeGreaterThan(0)
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

// Step 15 §9 — "Success! You are human." under the left card's text for 4 s after a check passed on this visit.
describe('StartMatchFlow — the success line (as on the Home)', () => {
  const STORY_DESC = { ...STORY, card: { title: 'The Lost Crown', description: 'A crown was lost.' } }
  const line = () => screen.queryByTestId('antibot-success')
  const leftPage = () => document.querySelector('.book-page-left')

  beforeEach(() => {
    vi.clearAllMocks()
    ts.minted = 0
    ts.last = null
    ts.auto = false
    guest.value = null
    vi.useFakeTimers()
  })
  afterEach(() => {
    ts.auto = true
    guest.value = null
    vi.useRealTimers()
  })

  const pass = () => act(() => { fireEvent.click(screen.getAllByTestId('turnstile-mock')[0]) })

  it('no line while checking; inside the left card\'s .book-page-desc after success; gone after 4 s', () => {
    renderPage(STORY_DESC)
    expect(line()).toBeNull()
    pass()
    expect(line()).toHaveTextContent('antibot.success')
    expect(line().closest('.book-page-desc')).not.toBeNull()
    expect(leftPage().contains(line())).toBe(true)
    expect(line().parentElement).toHaveClass('home-intro-antibot')
    act(() => { vi.advanceTimersByTime(3999) })
    expect(line()).not.toBeNull()
    act(() => { vi.advanceTimersByTime(1) })
    expect(line()).toBeNull()
  })

  it('a new check (an expired token, a retry after an error) shows it again once passed', () => {
    renderPage(STORY_DESC)
    pass()
    act(() => { vi.advanceTimersByTime(4000) })
    expect(line()).toBeNull()
    // a refresh of a still valid token is no new check: no line
    pass()
    expect(line()).toBeNull()
    // onExpire is retry: checking again, then a pass shows the line again
    act(() => { fireEvent.click(screen.getAllByTestId('turnstile-expire')[0]) })
    expect(line()).toBeNull()
    pass()
    expect(line()).not.toBeNull()
    // an error hides it at once; the retry's pass shows it again
    act(() => { fireEvent.click(screen.getAllByTestId('turnstile-error')[0]) })
    expect(line()).toBeNull()
    act(() => { fireEvent.click(screen.getAllByText('startMatch.retry')[0]) })
    pass()
    expect(line()).not.toBeNull()
  })

  it('on the guest login page too (a guest with Google on)', () => {
    guest.value = { user: { userUuid: 'u1', accessToken: 'tok-1' }, isGoogleUser: false, googleEnabled: true }
    renderPage(STORY_DESC)
    pass()
    expect(line()).not.toBeNull()
    expect(leftPage().querySelector('[data-testid="google-signin"]')).not.toBeNull()
    expect(line().closest('.book-page-desc')).not.toBeNull()
  })

  it('none behind an (i) preview, which covers the left card while the 4 s run', () => {
    renderPage(STORY_DESC)
    pass()
    expect(line()).not.toBeNull()
    act(() => { fireEvent.click(screen.getAllByLabelText('card.info')[0]) })
    expect(screen.getAllByTestId('page-back').length).toBeGreaterThan(0)
    expect(line()).toBeNull()
  })
})
