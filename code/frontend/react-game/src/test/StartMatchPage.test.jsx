import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'

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
vi.mock('@/api/matches', () => ({ createMatch: vi.fn(), joinMatch: vi.fn(), startMatch: vi.fn() }))
const openPolicyBook = vi.fn()
vi.mock('@/context/PolicyBookContext', () => ({
  usePolicyBook: () => ({ policyBook: null, openPolicyBook, closePolicyBook: vi.fn() }),
}))

import StartMatchPage from '../pages/StartMatchPage'
import { createMatch, joinMatch, startMatch } from '@/api/matches'

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

// What the home route received in its router state (the loadout handed back by "Back").
const homeState = { current: null }
function HomeProbe() {
  homeState.current = useLocation().state
  return <div>home-page</div>
}

function renderPage(state) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/start-match/s1', state }]}>
      <Routes>
        <Route path="/start-match/:storyId" element={<StartMatchPage />} />
        <Route path="/" element={<HomeProbe />} />
        <Route path="/play/:storyId" element={<div>game-page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

/** The (duplicated mobile+desktop) Start buttons: the action of the last bonuses card. */
const startButtons = () => screen.queryAllByRole('button', { name: 'book.start' })
/** The locked "Start" faces of that card (the only lock with a reason), when not offered. */
const startLocks = () => document.querySelectorAll('.gc-footer__cards-buttons[title]')

/** Click the first Start button. */
function clickStart() {
  fireEvent.click(startButtons()[0])
}
/** The lock label of the phase card at `index` (0 = story, then creating/joining/running/created), desktop copy. */
function phaseLabel(index) {
  return document.querySelectorAll('.pg-card--phase .gc-footer__cards-buttons')[index].textContent
}

describe('StartMatchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ts.behavior = 'success'
    joinMatch.mockResolvedValue({ uuid: 'c1' }) // Step 21 auto-join succeeds by default
    startMatch.mockResolvedValue({ status: 'RUNNING' }) // CREATED → RUNNING succeeds by default
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

  it('passes the antibot check then offers Start on the last bonuses card', () => {
    renderPage({ story: STORY, config: CONFIG })
    expect(screen.getAllByText('The Lost Crown').length).toBeGreaterThan(0)
    // Turnstile auto-passes → the card's Start action is offered, no match created yet
    expect(startButtons().length).toBeGreaterThan(0)
    expect(startLocks().length).toBe(0)
    expect(createMatch).not.toHaveBeenCalled()
    // The old bottom Home button is gone: the book's (x) goes home instead.
    expect(screen.queryByText('startMatch.home')).not.toBeInTheDocument()
  })

  it('keeps the antibot gate and offers a retry on widget error (Start stays locked)', () => {
    ts.behavior = 'bot'
    renderPage({ story: STORY, config: CONFIG })
    expect(screen.getAllByText('antibot.error').length).toBeGreaterThan(0)
    expect(screen.getAllByText('startMatch.retry').length).toBeGreaterThan(0)
    expect(startButtons().length).toBe(0)
    const locks = startLocks()
    expect(locks.length).toBeGreaterThan(0)
    expect(locks[0].getAttribute('title')).toBe('antibot.verifying')
    expect(createMatch).not.toHaveBeenCalled()
  })

  it('locks Start while the terms are not accepted, and unlocks it again', () => {
    renderPage({ story: STORY, config: CONFIG })
    fireEvent.click(screen.getAllByText('book.accepted')[0])
    expect(startButtons().length).toBe(0)
    expect(startLocks()[0].getAttribute('title')).toBe('startMatch.acceptTermsFirst')
    fireEvent.click(screen.getAllByText('book.accept')[0])
    expect(startButtons().length).toBeGreaterThan(0)
  })

  // Start swaps the six cards for the phase cards: the story (checked, "starting"), then one
  // card per phase — the first spinning with the countdown, the others pending.
  it('replaces the cards with the phase cards once the match is starting', async () => {
    createMatch.mockResolvedValue({ uuid: 'm1', status: 'CREATED' })
    renderPage({ story: STORY, config: CONFIG })
    await act(async () => { clickStart() })
    expect(startButtons().length).toBe(0)
    expect(screen.queryAllByRole('button', { name: 'card.info' }).length).toBe(0)
    expect(document.querySelectorAll('.pg-card--phase').length).toBe(10) // 5 cards, desktop + mobile
    expect(phaseLabel(0)).toContain('startMatch.phaseStarting')
    expect(document.querySelector('.pg-card--phase .fa-check')).not.toBeNull()
    expect(phaseLabel(1)).toBe('startMatch.phaseInProgress (3)')
    expect(document.querySelector('.pg-card--phase-inProgress .fa-spinner')).not.toBeNull()
    expect(phaseLabel(2)).toBe('startMatch.phasePending')
    expect(phaseLabel(4)).toBe('startMatch.phasePending')
    expect(screen.getAllByText('startMatch.phaseTitle.creating').length).toBeGreaterThan(0)
  })

  it('the story card "Back" returns to the catalog with the loadout to reopen', () => {
    renderPage({ story: STORY, config: CONFIG })
    fireEvent.click(screen.getAllByRole('button', { name: 'book.back' })[0])
    expect(screen.getByText('home-page')).toBeInTheDocument()
    expect(homeState.current).toMatchObject({ reopenStory: { uuid: 's1' }, reopenConfig: { class: { uuid: 'cl1' } } })
  })

  it('the book (x) goes back home', () => {
    renderPage({ story: STORY, config: CONFIG })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.getByText('home-page')).toBeInTheDocument()
  })

  it('opens the character-attributes page from the first bonuses card (i)', () => {
    renderPage({ story: STORY, config: CONFIG })
    // Info buttons in card order: gameType, bonuses (attributes), login, terms (the story
    // card carries Back only).
    const infoBtns = screen.getAllByRole('button', { name: 'card.info' })
    fireEvent.click(infoBtns[1])
    expect(screen.getAllByText('book.characterAttributesTitle').length).toBeGreaterThan(0)
  })

  it('creates the match after Start + delay with the full loadout and antibot token', async () => {
    createMatch.mockResolvedValue({ uuid: 'm1', status: 'CREATED' })
    renderPage({ story: STORY, config: CONFIG })
    clickStart()

    // starting(3) → create → creating(3) → join → joining(3) → start → running(3) → created
    await act(async () => { await vi.advanceTimersByTimeAsync(12000) })

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
    // After join the match is started (CREATED → RUNNING) so gameplay is accepted.
    expect(startMatch).toHaveBeenCalledTimes(1)
    expect(startMatch).toHaveBeenCalledWith('m1', 'tok-1')
    // creating / joining / running are done, the created card spins through its countdown.
    expect(phaseLabel(1)).toBe('startMatch.phaseComplete')
    expect(phaseLabel(2)).toBe('startMatch.phaseComplete')
    expect(phaseLabel(3)).toBe('startMatch.phaseComplete')
    expect(phaseLabel(4)).toBe('startMatch.phaseInProgress (3)')
  })

  it('surfaces an error when the auto-join fails', async () => {
    createMatch.mockResolvedValue({ uuid: 'm1', status: 'CREATED' })
    joinMatch.mockRejectedValueOnce(new Error('ALREADY_JOINED'))
    renderPage({ story: STORY, config: CONFIG })
    clickStart()

    // starting(3) → create → creating(3) → join (rejects)
    await act(async () => { await vi.advanceTimersByTimeAsync(6000) })

    expect(joinMatch).toHaveBeenCalledTimes(1)
    expect(screen.getAllByText(/startMatch\.error/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('ALREADY_JOINED').length).toBeGreaterThan(0)
    // The joining card reads "failed" (the error as its tooltip); creating stays done.
    expect(phaseLabel(1)).toBe('startMatch.phaseComplete')
    expect(phaseLabel(2)).toBe('startMatch.phaseFailed')
    expect(document.querySelector('.pg-card--phase-failed .gc-footer__cards-buttons').getAttribute('title')).toBe('ALREADY_JOINED')
    expect(phaseLabel(3)).toBe('startMatch.phasePending')
  })

  it('jumps to the game page after the created delay', async () => {
    createMatch.mockResolvedValue({ uuid: 'm1', status: 'CREATED' })
    renderPage({ story: STORY, config: CONFIG })
    clickStart()

    // starting → create → creating → join → joining → start → running → created
    await act(async () => { await vi.advanceTimersByTimeAsync(12000) })
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) }) // created → game

    expect(screen.getByText('game-page')).toBeInTheDocument()
  })

  it('clicking a card info button triggers handleSelectionPreview (preview state)', () => {
    renderPage({ story: STORY, config: CONFIG })
    // All Card info buttons have aria-label=t('card.info')='card.info'
    const infoBtns = screen.getAllByRole('button', { name: 'card.info' })
    expect(infoBtns.length).toBeGreaterThan(0)
    // Clicking the first info button sets the preview (handleSelectionPreview)
    fireEvent.click(infoBtns[0])
    // No crash — preview state is set
  })

  it('clicking the terms card info button opens the terms book', () => {
    renderPage({ story: STORY, config: CONFIG })
    const infoBtns = screen.getAllByRole('button', { name: 'card.info' })
    // The terms card is last in cardsBlock — click its info button
    fireEvent.click(infoBtns[infoBtns.length - 1])
    expect(openPolicyBook).toHaveBeenCalledWith('terms')
  })

  it('clicking a card info button on mobile triggers Bootstrap modal (handleSelectionPreview mobile path)', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true })
    const show = vi.fn()
    window.bootstrap = { Modal: { getOrCreateInstance: vi.fn().mockReturnValue({ show }) } }
    const modalEl = document.createElement('div')
    modalEl.id = 'cardPreviewModal'
    document.body.appendChild(modalEl)

    renderPage({ story: STORY, config: CONFIG })
    const infoBtns = screen.getAllByRole('button', { name: 'card.info' })
    fireEvent.click(infoBtns[0])
    // On mobile, handleSelectionPreview tries to open cardPreviewModal via Bootstrap
    expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 767px)')

    delete window.matchMedia
    delete window.bootstrap
    document.body.removeChild(modalEl)
  })

  it('shows an error and retries when match creation fails', async () => {
    createMatch.mockRejectedValueOnce(new Error('STORY_HAS_NO_LOCATIONS'))
    renderPage({ story: STORY, config: CONFIG })
    clickStart()

    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(screen.getAllByText(/startMatch\.error/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('STORY_HAS_NO_LOCATIONS').length).toBeGreaterThan(0)

    createMatch.mockResolvedValueOnce({ uuid: 'm2', status: 'CREATED' })
    // The error state offers Retry only: no Home button any more.
    expect(screen.queryByText('startMatch.home')).not.toBeInTheDocument()
    await act(async () => { fireEvent.click(screen.getAllByText(/startMatch\.retry/)[0]) })
    // starting → create → creating → join → joining → start → running → created
    await act(async () => { await vi.advanceTimersByTimeAsync(12000) })

    expect(createMatch).toHaveBeenCalledTimes(2)
    // The retry cleared the failed mark: every phase but the last is done again.
    expect(phaseLabel(1)).toBe('startMatch.phaseComplete')
    expect(phaseLabel(4)).toBe('startMatch.phaseInProgress (3)')
    expect(document.querySelector('.pg-card--phase-failed')).toBeNull()
  })
})
