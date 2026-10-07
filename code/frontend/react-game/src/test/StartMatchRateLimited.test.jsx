import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// v0.41.0 — POST /api/matches answered 429: the player reads a sentence with the wait, not the code.
const T = {
  'startMatch.errorRateLimited': 'Too many new matches. Try again in {time}.',
  'errors.rateLimitSoon': 'a few minutes',
}
vi.mock('@/i18n/context', () => ({
  useTranslation: () => ({ t: (k) => T[k] ?? k, lang: 'en', setLang: vi.fn() }),
}))
vi.mock('@/features/guest-user/GuestUserContext', () => ({
  useGuestUser: () => ({ user: { userUuid: 'u1', accessToken: 'tok-1', csrfToken: 'c1' } }),
}))
vi.mock('@/api/matches', () => ({ createMatch: vi.fn(), joinMatch: vi.fn(), startMatch: vi.fn() }))
vi.mock('@/context/PolicyBookContext', () => ({
  usePolicyBook: () => ({ policyBook: null, openPolicyBook: vi.fn(), closePolicyBook: vi.fn() }),
}))
vi.mock('@/hooks/useAntibot', () => ({
  default: () => ({ phase: 'ready', token: 'tok-cf', retry: vi.fn() }),
}))

import StartMatchFlow from '../features/start-match/StartMatchFlow'
import { createMatch } from '@/api/matches'

const STORY = { uuid: 's1', title: 'The Lost Crown', card: { title: 'The Lost Crown' } }
const CONFIG = {
  character: { uuid: 'ch1', name: 'Ranger' },
  class: { uuid: 'cl1', name: 'Mage' },
  traits: [{ uuid: 'tr1', name: 'Brave' }],
  difficulty: { uuid: 'df1', name: 'Normal' },
}

async function startAndFail(rejection) {
  createMatch.mockRejectedValue(rejection)
  render(<MemoryRouter><StartMatchFlow story={STORY} config={CONFIG} storyId="s1" /></MemoryRouter>)
  fireEvent.click(screen.getAllByRole('button', { name: 'book.start' })[0])
  await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
}

describe('StartMatchFlow — RATE_LIMITED (v0.41.0)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('VITE_MATCH_START_DELAY', '3')
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it('translates the per-guest limit into hours', async () => {
    await startAndFail({ response: { status: 429, data: { error: 'RATE_LIMITED', message: 'Too many matches created by this player', retryAfterSeconds: 43200 } } })
    expect(createMatch).toHaveBeenCalledTimes(1)
    expect(screen.getAllByText('Too many new matches. Try again in 12 h.').length).toBeGreaterThan(0)
    expect(screen.queryByText('RATE_LIMITED')).toBeNull()
  })

  it('translates the per-IP limit into minutes from the Retry-After header', async () => {
    await startAndFail({ response: { status: 429, data: {}, headers: { 'retry-after': '600' } } })
    expect(screen.getAllByText('Too many new matches. Try again in 10 min.').length).toBeGreaterThan(0)
  })

  it('keeps the raw code for the other errors', async () => {
    await startAndFail({ response: { status: 400, data: { error: 'INVALID_INPUT' } } })
    expect(screen.getAllByText('INVALID_INPUT').length).toBeGreaterThan(0)
  })

  it('still words the active-match refusal and falls back to the network message', async () => {
    await startAndFail({ response: { status: 409, data: { error: 'ACTIVE_MATCH_ALREADY_EXISTS' } } })
    expect(screen.getAllByText('startMatch.errorActiveMatch').length).toBeGreaterThan(0)
  })

  it('shows the transport message when no response came back', async () => {
    await startAndFail(new Error('Network Error'))
    expect(screen.getAllByText('Network Error').length).toBeGreaterThan(0)
  })
})
