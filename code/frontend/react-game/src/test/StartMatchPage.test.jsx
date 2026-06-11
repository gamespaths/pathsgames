import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// Controllable Turnstile mock: fires onSuccess (human) by default, onError when
// `ts.behavior` is 'bot'. The antibot gate now lives in start-match.
const ts = vi.hoisted(() => ({ behavior: 'success' }))
vi.mock('@marsidev/react-turnstile', async () => {
  const { useEffect } = await import('react')
  return {
    Turnstile: ({ onSuccess, onError }) => {
      useEffect(() => {
        if (ts.behavior === 'bot') onError?.()
        else onSuccess?.('test-token')
      }, [])
      return <div data-testid="turnstile-mock" />
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
  useGuestUser: () => ({
    user: { userUuid: 'u1', username: 'guest_u1', accessToken: 'tok-1' },
  }),
}))
vi.mock('@/api/matches', () => ({ createMatch: vi.fn(), joinMatch: vi.fn() }))

import StartMatchPage from '../pages/StartMatchPage'
import { createMatch, joinMatch } from '@/api/matches'

const STORY = {
  uuid: 's1',
  title: 'The Lost Crown',
  card: { title: 'The Lost Crown', description: 'An epic quest.' },
}
const CONFIG = {
  character:  { uuid: 'ch1', name: 'Ranger' },
  class:      { uuid: 'cl1', name: 'Mage' },
  traits:     [{ uuid: 'tr1', name: 'Brave' }],
  difficulty: { uuid: 'df1', name: 'Normal' },
}

function renderPage(state) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/start-match/s1', state }]}>
      <Routes>
        <Route path="/start-match/:storyId" element={<StartMatchPage />} />
        <Route path="/" element={<div>home-page</div>} />
        <Route path="/play/:storyId" element={<div>game-page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

/** Click the (duplicated mobile+desktop) Start button in the confirm step. */
function clickStart() {
  fireEvent.click(screen.getAllByText('book.startGame')[0])
}

describe('StartMatchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ts.behavior = 'success'
    joinMatch.mockResolvedValue({ uuid: 'c1' }) // Step 21 auto-join succeeds by default
    vi.stubEnv('VITE_MATCH_START_DELAY', '3') // 3s waits keep the test fast
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it('redirects home when navigation state is missing', () => {
    renderPage(undefined)
    expect(screen.getByText('home-page')).toBeInTheDocument()
  })

  it('passes the antibot check then shows the confirm step (terms + start)', () => {
    renderPage({ story: STORY, config: CONFIG })
    expect(screen.getAllByText('The Lost Crown').length).toBeGreaterThan(0)
    // Turnstile auto-passes → confirm Start button is shown, no match created yet
    expect(screen.getAllByText('book.startGame').length).toBeGreaterThan(0)
    expect(createMatch).not.toHaveBeenCalled()
  })

  it('keeps the antibot gate and offers a retry on widget error (no confirm)', () => {
    ts.behavior = 'bot'
    renderPage({ story: STORY, config: CONFIG })
    expect(screen.getAllByText('antibot.error').length).toBeGreaterThan(0)
    expect(screen.getAllByText('startMatch.retry').length).toBeGreaterThan(0)
    expect(screen.queryByText('book.startGame')).not.toBeInTheDocument()
    expect(createMatch).not.toHaveBeenCalled()
  })

  it('creates the match after Start + delay with the full loadout and antibot token', async () => {
    createMatch.mockResolvedValue({ uuid: 'm1', status: 'CREATED' })
    renderPage({ story: STORY, config: CONFIG })
    clickStart()

    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })

    expect(createMatch).toHaveBeenCalledTimes(1)
    const [payload, token] = createMatch.mock.calls[0]
    expect(payload).toMatchObject({
      storyUuid: 's1',
      difficultyUuid: 'df1',
      classUuid: 'cl1',
      characterTemplateUuid: 'ch1',
      traitUuids: ['tr1'],
      singlePlayer: 1,
      turnstileToken: 'test-token',
    })
    expect(token).toBe('tok-1')
    // Step 21 — the flow auto-joins the freshly created match with the loadout.
    expect(joinMatch).toHaveBeenCalledTimes(1)
    const [joinUuid, loadout] = joinMatch.mock.calls[0]
    expect(joinUuid).toBe('m1')
    expect(loadout).toMatchObject({ characterTemplateUuid: 'ch1', classUuid: 'cl1', traitUuids: ['tr1'] })
    expect(screen.getAllByText(/startMatch\.created/).length).toBeGreaterThan(0)
  })

  it('surfaces an error when the auto-join fails', async () => {
    createMatch.mockResolvedValue({ uuid: 'm1', status: 'CREATED' })
    joinMatch.mockRejectedValueOnce(new Error('ALREADY_JOINED'))
    renderPage({ story: STORY, config: CONFIG })
    clickStart()

    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })

    expect(joinMatch).toHaveBeenCalledTimes(1)
    expect(screen.getAllByText(/startMatch\.error/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('ALREADY_JOINED').length).toBeGreaterThan(0)
  })

  it('jumps to the game page after the created delay', async () => {
    createMatch.mockResolvedValue({ uuid: 'm1', status: 'CREATED' })
    renderPage({ story: STORY, config: CONFIG })
    clickStart()

    await act(async () => { await vi.advanceTimersByTimeAsync(3000) }) // starting → create
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) }) // created → game

    expect(screen.getByText('game-page')).toBeInTheDocument()
  })

  it('shows an error and retries when match creation fails', async () => {
    createMatch.mockRejectedValueOnce(new Error('STORY_HAS_NO_LOCATIONS'))
    renderPage({ story: STORY, config: CONFIG })
    clickStart()

    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(screen.getAllByText(/startMatch\.error/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('STORY_HAS_NO_LOCATIONS').length).toBeGreaterThan(0)

    createMatch.mockResolvedValueOnce({ uuid: 'm2', status: 'CREATED' })
    await act(async () => { fireEvent.click(screen.getAllByText(/startMatch\.retry/)[0]) })
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })

    expect(createMatch).toHaveBeenCalledTimes(2)
    expect(screen.getAllByText(/startMatch\.created/).length).toBeGreaterThan(0)
  })
})
