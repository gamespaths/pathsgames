import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'

// Controllable Turnstile mock: on mount it fires onSuccess (human) by default,
// or onError when `ts.behavior` is flipped to 'bot' before render.
const ts = vi.hoisted(() => ({ behavior: 'success', pass: null }))
vi.mock('@marsidev/react-turnstile', async () => {
  const { useEffect } = await import('react')
  return {
    Turnstile: ({ onSuccess, onError }) => {
      useEffect(() => {
        if (ts.behavior === 'bot') onError?.()
        else if (ts.behavior === 'pending') { /* v0.37.6 — never answers */ }
        else if (ts.behavior === 'manual') ts.pass = onSuccess
        else onSuccess?.('test-token')
      }, [])
      return <div data-testid="turnstile-mock" />
    },
  }
})

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))

const mockOpenPlayerPage = vi.fn()
const mockUser = { userUuid: 'u1', username: 'guest_u1', accessToken: 'tok' }
// v0.37.6 — the guest identity the page sees; tests swap it to simulate a session
// still being created (no token yet) or one that failed.
const guest = vi.hoisted(() => ({ user: null, error: null, sessionIdle: false, ensureGuest: null }))

vi.mock('@/features/guest-user/GuestUserContext', () => ({
  useGuestUser: () => ({ user: guest.user, error: guest.error,
    sessionIdle: guest.sessionIdle, ensureGuest: guest.ensureGuest }),
}))
// v1.13.0 — a blocking match opens /player with the list the Home already has
vi.mock('@/features/guest-user/usePlayerPage', () => ({
  default: () => ({ openPlayerPage: mockOpenPlayerPage, closePlayerPage: vi.fn() }),
}))

// The flags come from .env*, which a build (or a developer) flips: pin them here so this
// suite always describes the player-page flow. The direct-resume one has its own suite.
vi.mock('../constants/features', async (importOriginal) => ({
  ...(await importOriginal()),
  RESUME_WITHOUT_MODAL: false,
  ADD_COMING_SOON_STORIES: false,
}))

vi.mock('../api/stories', () => ({ getStoriesCatalog: vi.fn() }))
vi.mock('../api/matches', () => ({ listMatches: vi.fn() }))
vi.mock('../features/catalog/StoryCatalog', () => ({
  default: ({ stories, onStoryClick, footerState }) => (
    <div>
      <span data-testid="footer-state">{footerState}</span>
      {stories.map(s => (
        <button key={s.uuid} onClick={() => onStoryClick(s)}>{s.title}</button>
      ))}
    </div>
  ),
}))

vi.mock('../utils/turnstile', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, CF_KEY: 'test-site-key' }
})

import HomePage from '../pages/HomePage'
import { getStoriesCatalog as getStories } from '../api/stories'
import { listMatches } from '../api/matches'
import { HomeStatusProvider, useHomeStatus } from '../context/HomeStatusContext'

// v0.37.6 — what the Navbar would read: the home error code, or "none".
function HomeErrorProbe() {
  const { error } = useHomeStatus()
  return <span data-testid="home-error">{error ?? 'none'}</span>
}

// v1.13.0 — the story set-up book is the /story/:storyId page, reached with the story in its state.
function StoryPageStub() {
  const { pathname, state } = useLocation()
  return <div data-testid="story-page" data-path={pathname}>{state?.story?.title}</div>
}

function tree(ui) {
  return (
    <HomeStatusProvider>
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<>{ui}<HomeErrorProbe /></>} />
          <Route path="/story/:storyId" element={<StoryPageStub />} />
        </Routes>
      </MemoryRouter>
    </HomeStatusProvider>
  )
}

const STORY_A = { uuid: 's1', title: 'Forest Path', card: {} }
const STORY_B = { uuid: 's2', title: 'Dragon Keep', card: {} }

function wrap(ui) {
  return render(tree(ui))
}

describe('HomePage — story click with active match check', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ts.behavior = 'success'
    guest.user = mockUser
    guest.error = null
    guest.sessionIdle = false
    guest.ensureGuest = null
    document.cookie = 'pathsgames.turnstilePass=; max-age=0; path=/' // forget prior pass
    getStories.mockResolvedValue([STORY_A, STORY_B])
  })

  it('v1.8.0 — no "Sign in with Google to find your matches" button', async () => {
    listMatches.mockResolvedValue([])
    wrap(<HomePage />)
    await screen.findByText('home.heroTitle')
    expect(screen.queryByTestId('known-account-hint')).toBeNull()
    expect(screen.queryByText('home.knownAccount')).toBeNull()
  })

  it('v1.13.0 — opens /story/:storyId, the story in the router state, when no active match', async () => {
    listMatches.mockResolvedValue([
      { uuid: 'm1', storyUuid: 's1', status: 'ENDED' },
    ])
    wrap(<HomePage />)
    fireEvent.click(await screen.findByText('Forest Path'))
    const page = await screen.findByTestId('story-page')
    expect(page.dataset.path).toBe('/story/s1')
    expect(page).toHaveTextContent('Forest Path')
    expect(mockOpenPlayerPage).not.toHaveBeenCalled()
  })

  it('v1.13.0 — the router state of a return from start-match no longer reopens anything on the Home', async () => {
    listMatches.mockResolvedValue([])
    render(
      <HomeStatusProvider>
        <MemoryRouter initialEntries={[{ pathname: '/', state: { reopenStory: STORY_B, reopenConfig: { class: { name: 'Mage' } } } }]}>
          <Routes><Route path="/" element={<HomePage />} /><Route path="/story/:storyId" element={<StoryPageStub />} /></Routes>
        </MemoryRouter>
      </HomeStatusProvider>,
    )
    await screen.findByText('Dragon Keep')
    expect(screen.queryByTestId('story-page')).not.toBeInTheDocument()
  })

  it('opens the player page when RUNNING match exists for that story (handing over the fetched matches)', async () => {
    const list = [{ uuid: 'm1', storyUuid: 's1', status: 'RUNNING' }]
    listMatches.mockResolvedValue(list)
    wrap(<HomePage />)
    fireEvent.click(await screen.findByText('Forest Path'))
    await waitFor(() => expect(mockOpenPlayerPage).toHaveBeenCalledTimes(1))
    // matches already loaded by Home are passed to the player page so it won't refetch
    expect(mockOpenPlayerPage).toHaveBeenCalledWith(list)
    expect(screen.queryByTestId('story-page')).not.toBeInTheDocument()
  })

  it('opens the player page when CREATED match exists for that story', async () => {
    listMatches.mockResolvedValue([
      { uuid: 'm2', storyUuid: 's1', status: 'CREATED' },
    ])
    wrap(<HomePage />)
    fireEvent.click(await screen.findByText('Forest Path'))
    await waitFor(() => expect(mockOpenPlayerPage).toHaveBeenCalledTimes(1))
  })

  it('does not redirect when active match is for a different story', async () => {
    listMatches.mockResolvedValue([
      { uuid: 'm1', storyUuid: 's2', status: 'RUNNING' },
    ])
    wrap(<HomePage />)
    fireEvent.click(await screen.findByText('Forest Path'))
    expect(await screen.findByTestId('story-page')).toBeInTheDocument()
    expect(mockOpenPlayerPage).not.toHaveBeenCalled()
  })

  it('opens the player page when a PAUSED match exists for that story (v0.32.1)', async () => {
    const list = [{ uuid: 'm3', storyUuid: 's1', status: 'PAUSED' }]
    listMatches.mockResolvedValue(list)
    wrap(<HomePage />)
    fireEvent.click(await screen.findByText('Forest Path'))
    await waitFor(() => expect(mockOpenPlayerPage).toHaveBeenCalledWith(list))
    expect(screen.queryByTestId('story-page')).not.toBeInTheDocument()
  })

  it('fails closed when listMatches throws: no story page, "error" footers and the navbar error (v0.37.6)', async () => {
    listMatches.mockRejectedValue(new Error('Network error'))
    wrap(<HomePage />)
    await screen.findByText('Forest Path')
    await waitFor(() => expect(screen.getByTestId('footer-state').textContent).toBe('error'))
    await waitFor(() => expect(screen.getByTestId('home-error').textContent).toBe('matches'))
    fireEvent.click(screen.getByText('Forest Path'))
    expect(screen.queryByTestId('story-page')).not.toBeInTheDocument()
    expect(mockOpenPlayerPage).not.toHaveBeenCalled()
    expect(screen.queryByText('home.matchesError')).not.toBeInTheDocument()
  })

  it('a click that awaited a failing in-flight list also fails closed (v0.32.1)', async () => {
    let rejectMatches
    listMatches.mockReturnValue(new Promise((_, rej) => { rejectMatches = rej }))
    wrap(<HomePage />)
    fireEvent.click(await screen.findByText('Forest Path'))
    rejectMatches(new Error('Network error'))
    await waitFor(() => expect(screen.getByTestId('footer-state').textContent).toBe('error'))
    expect(screen.queryByTestId('story-page')).not.toBeInTheDocument()
  })

  it('a click during the load awaits the single in-flight request (v0.32.1)', async () => {
    let resolveMatches
    listMatches.mockReturnValue(new Promise(res => { resolveMatches = res }))
    wrap(<HomePage />)
    fireEvent.click(await screen.findByText('Forest Path'))
    // still pending: nothing opened, and no second request was fired
    expect(screen.queryByTestId('story-page')).not.toBeInTheDocument()
    expect(listMatches).toHaveBeenCalledTimes(1)
    resolveMatches([])
    expect(await screen.findByTestId('story-page')).toBeInTheDocument()
    expect(listMatches).toHaveBeenCalledTimes(1)
  })

  it('shows the catalog even when the widget fails, with "blocked" footers, no clicks and the navbar error (v0.37.6)', async () => {
    ts.behavior = 'bot'
    listMatches.mockResolvedValue([])
    wrap(<HomePage />)
    expect(await screen.findByText('Forest Path')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('footer-state').textContent).toBe('blocked'))
    await waitFor(() => expect(screen.getByTestId('home-error').textContent).toBe('antibot'))
    expect(getStories).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('Forest Path'))
    expect(screen.queryByTestId('story-page')).not.toBeInTheDocument()
    expect(screen.queryByText('antibot.error')).not.toBeInTheDocument()
  })

  it('fetches stories and matches in parallel with the antibot check, footers spinning meanwhile (v0.37.6)', async () => {
    ts.behavior = 'pending'
    listMatches.mockResolvedValue([])
    wrap(<HomePage />)
    expect(await screen.findByText('Forest Path')).toBeInTheDocument()
    expect(screen.getByTestId('turnstile-mock')).toBeInTheDocument()
    expect(screen.getByText('antibot.verifying')).toBeInTheDocument()
    // Step 14 — the strip sits right under the intro text (left page), not at the card's foot.
    const strip = document.querySelector('.book-page-left .book-page-desc > .home-intro-antibot > .home-antibot-strip')
    expect(strip).toContainElement(screen.getByTestId('turnstile-mock'))
    expect(strip.closest('.book-page-desc')).toHaveTextContent(/^home\.heroSub/)
    expect(document.querySelector('.home-intro-extra .home-antibot-strip')).toBeNull()
    await waitFor(() => expect(listMatches).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId('footer-state').textContent).toBe('loading')
    expect(screen.getByTestId('home-error').textContent).toBe('none')
  })

  it('does not call /api/matches until the guest session hands over a token (v0.37.6)', async () => {
    guest.user = null
    listMatches.mockResolvedValue([])
    const { rerender } = wrap(<HomePage />)
    await screen.findByText('Forest Path')
    expect(listMatches).not.toHaveBeenCalled()
    expect(screen.getByTestId('footer-state').textContent).toBe('loading')
    // A click meanwhile is ignored: nothing in flight to wait for.
    fireEvent.click(screen.getByText('Forest Path'))
    expect(screen.queryByTestId('story-page')).not.toBeInTheDocument()
    // The token lands → one call, with that token.
    guest.user = mockUser
    rerender(tree(<HomePage />))
    await waitFor(() => expect(screen.getByTestId('footer-state').textContent).toBe('ready'))
    expect(listMatches).toHaveBeenCalledTimes(1)
    expect(listMatches).toHaveBeenCalledWith('tok')
  })

  it('reports "error" when the guest session itself could not be created (v0.37.6)', async () => {
    guest.user = null
    guest.error = 'guest-init-failed'
    wrap(<HomePage />)
    await screen.findByText('Forest Path')
    await waitFor(() => expect(screen.getByTestId('footer-state').textContent).toBe('error'))
    await waitFor(() => expect(screen.getByTestId('home-error').textContent).toBe('matches'))
    expect(listMatches).not.toHaveBeenCalled()
  })

  it('reports "rateLimited" when the guest login answered 429 (v0.41.0)', async () => {
    guest.user = null
    guest.error = 'RATE_LIMITED'
    wrap(<HomePage />)
    await screen.findByText('Forest Path')
    await waitFor(() => expect(screen.getByTestId('footer-state').textContent).toBe('error'))
    await waitFor(() => expect(screen.getByTestId('home-error').textContent).toBe('rateLimited'))
    expect(listMatches).not.toHaveBeenCalled()
  })

  it('fetches the catalog once under StrictMode double mount, and again on a language change (v0.37.6)', async () => {
    const { StrictMode } = await import('react')
    listMatches.mockResolvedValue([])
    render(
      <StrictMode>
        <HomeStatusProvider><MemoryRouter><HomePage /><HomeErrorProbe /></MemoryRouter></HomeStatusProvider>
      </StrictMode>,
    )
    expect(await screen.findByText('Forest Path')).toBeInTheDocument()
    expect(getStories).toHaveBeenCalledTimes(1)
    expect(listMatches).toHaveBeenCalledTimes(1)
  })

  it('clears the navbar error when the page unmounts (v0.37.6)', async () => {
    listMatches.mockRejectedValue(new Error('Network error'))
    const { unmount } = wrap(<HomePage />)
    await waitFor(() => expect(screen.getByTestId('home-error').textContent).toBe('matches'))
    unmount()
    // A fresh mount with a good list starts clean.
    listMatches.mockResolvedValue([])
    wrap(<HomePage />)
    await waitFor(() => expect(screen.getByTestId('footer-state').textContent).toBe('ready'))
    expect(screen.getByTestId('home-error').textContent).toBe('none')
  })

  it('records a pass cookie after a human check', async () => {
    wrap(<HomePage />)
    await screen.findByText('Forest Path')
    expect(document.cookie).toContain('pathsgames.turnstilePass=1')
  })

  it('skips the widget and loads stories directly when a recent pass cookie exists', async () => {
    document.cookie = 'pathsgames.turnstilePass=1; path=/'
    wrap(<HomePage />)
    expect(await screen.findByText('Forest Path')).toBeInTheDocument()
    expect(screen.queryByTestId('turnstile-mock')).not.toBeInTheDocument()
    expect(getStories).toHaveBeenCalledTimes(1)
  })
})

describe('HomePage — the catalog fetch fails', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ts.behavior = 'success'
    guest.user = mockUser
    guest.error = null
    document.cookie = 'pathsgames.turnstilePass=1; path=/'
    listMatches.mockResolvedValue([])
  })

  it('shows only the yellow sign (words and refresh are in the navbar) instead of spinning for ever', async () => {
    getStories.mockRejectedValue(new Error('Network Error'))
    wrap(<HomePage />)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveAttribute('aria-label', 'home.storiesError')
    expect(alert.querySelector('.fa-exclamation-triangle.home-stories-error-icon')).toBeInTheDocument()
    expect(screen.queryByText('home.storiesError')).not.toBeInTheDocument()
    expect(screen.queryByText('startMatch.retry')).not.toBeInTheDocument()
    expect(screen.queryByText('home.loading')).not.toBeInTheDocument()
    // The navbar code is set by an effect after the render that shows the sign: wait for it
    // (on a slow CI runner the alert can be found one render before the effect lands).
    await waitFor(() => expect(screen.getByTestId('home-error').textContent).toBe('stories'))
    expect(getStories).toHaveBeenCalledTimes(1)
  })

  it('shows the catalog, not the sign, when the fetch succeeds', async () => {
    getStories.mockResolvedValue([STORY_A])
    wrap(<HomePage />)
    expect(await screen.findByText('Forest Path')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByTestId('home-error').textContent).toBe('none')
  })
})

describe('HomePage — hidden stories (v0.38.1, data/hidden-stories.json)', () => {
  // The Robot seed story that sits on the AWS test backend while a run is in progress.
  const SEED = { uuid: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', title: 'TUTORIAL — Learn to Play', author: 'PathsMaster', card: {} }

  beforeEach(() => {
    vi.clearAllMocks()
    ts.behavior = 'success'
    guest.user = mockUser
    guest.error = null
    document.cookie = 'pathsgames.turnstilePass=1; path=/'
    listMatches.mockResolvedValue([])
  })

  it('never hands a blacklisted story to the catalog, the others untouched', async () => {
    getStories.mockResolvedValue([SEED, STORY_A, STORY_B])
    wrap(<HomePage />)
    expect(await screen.findByText('Forest Path')).toBeInTheDocument()
    expect(screen.getByText('Dragon Keep')).toBeInTheDocument()
    expect(screen.queryByText('TUTORIAL — Learn to Play')).not.toBeInTheDocument()
  })
})

describe('HomePage — unmounted before the catalog fetch settles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ts.behavior = 'success'
    guest.user = mockUser
    guest.error = null
    document.cookie = 'pathsgames.turnstilePass=1; path=/'
    listMatches.mockResolvedValue([])
  })

  it('ignores a rejection that lands after unmount', async () => {
    let reject
    getStories.mockReturnValue(new Promise((_, r) => { reject = r }))
    const { unmount } = wrap(<HomePage />)
    unmount()
    reject(new Error('Network Error'))
    await waitFor(() => expect(getStories).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('ignores a resolution that lands after unmount', async () => {
    let resolve
    getStories.mockReturnValue(new Promise(r => { resolve = r }))
    const { unmount } = wrap(<HomePage />)
    unmount()
    resolve([STORY_A])
    await waitFor(() => expect(getStories).toHaveBeenCalled())
    expect(screen.queryByText('Forest Path')).not.toBeInTheDocument()
  })
})

describe('HomePage v1.2.0 — after a Google logout with no guest to resume', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ts.behavior = 'success'
    document.cookie = 'pathsgames.turnstilePass=; max-age=0; path=/'
    getStories.mockResolvedValue([STORY_A])
    guest.user = null
    guest.error = null
    guest.sessionIdle = true
  })

  it('lists nothing and the first Play creates the guest', async () => {
    guest.ensureGuest = vi.fn().mockResolvedValue(mockUser)
    wrap(<HomePage />)
    await waitFor(() => expect(screen.getByTestId('footer-state').textContent).toBe('ready'))
    fireEvent.click(await screen.findByText('Forest Path'))
    expect(await screen.findByTestId('story-page')).toBeInTheDocument()
    expect(guest.ensureGuest).toHaveBeenCalled()
    expect(listMatches).not.toHaveBeenCalled()
  })

  it('a guest that cannot be created turns the footer to error', async () => {
    guest.ensureGuest = vi.fn().mockRejectedValue(new Error('429'))
    wrap(<HomePage />)
    await waitFor(() => expect(screen.getByTestId('footer-state').textContent).toBe('ready'))
    fireEvent.click(await screen.findByText('Forest Path'))
    await waitFor(() => expect(screen.getByTestId('footer-state').textContent).toBe('error'))
    expect(screen.queryByTestId('story-page')).toBeNull()
  })
})

describe('HomePage — step 14, the Home is a book', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ts.behavior = 'pending'
    ts.pass = null
    guest.user = mockUser
    guest.error = null
    guest.sessionIdle = false
    document.cookie = 'pathsgames.turnstilePass=; max-age=0; path=/'
    getStories.mockResolvedValue([STORY_A])
    listMatches.mockResolvedValue([])
  })

  it('intro card on the left page, the stories on the right, no home tab', async () => {
    const { container } = wrap(<HomePage />)
    await screen.findByText('Forest Path')
    expect(container.querySelector('.book-stage.home-book-stage > .book-shell > .book-wrapper.home-book')).toBeInTheDocument()
    expect(container.querySelector('.book-stage')).toHaveClass('book-stage--no-tabs')
    expect(container.querySelector('.book-bookmark--home')).toBeNull()
    expect(container.querySelector('.book-page-left')).toHaveTextContent('home.heroTitle')
    expect(container.querySelector('.book-page-right')).toContainElement(screen.getByText('Forest Path'))
    // no hero banner and no mobile copy any more
    expect(container.querySelector('.hero-section')).toBeNull()
    expect(container.querySelector('.book-mobile-layout')).toBeNull()
  })

  it('the intro card: the Home title is the h1, the subtitle its text, the home photo credited', async () => {
    const images = (await import('../data/images.json')).default
    const home = images.find(x => x.id === 'home')
    const { container } = wrap(<HomePage />)
    await screen.findByText('Forest Path')
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveClass('book-page-title')
    expect(h1).toHaveTextContent('home.heroTitle')
    expect(container.querySelector('.book-page-left .book-page-desc')).toHaveTextContent('home.heroSub')
    expect(container.querySelector('.book-page-left img').getAttribute('src')).toBe(home.urlImage)
    // no tip and no type badge: only the picture credit in the bar
    expect(container.querySelector('.book-page-left [data-testid="credit-image"]')).toBeInTheDocument()
    expect(container.querySelector('.book-page-left [data-testid="credit-tip"]')).toBeNull()
    expect(container.querySelector('.book-page-left .gc-type-badge-credits')).toBeNull()
  })

  it('the strip while checking, then a success line under the intro text that leaves after 4 s', async () => {
    ts.behavior = 'manual'
    const { container } = wrap(<HomePage />)
    await screen.findByText('Forest Path')
    const desc = container.querySelector('.book-page-left .book-page-desc')
    expect(desc).toContainElement(screen.getByTestId('turnstile-mock'))
    expect(screen.queryByTestId('antibot-success')).toBeNull()
    vi.useFakeTimers()
    try {
      await act(async () => { ts.pass('tok') })
      expect(screen.queryByTestId('turnstile-mock')).toBeNull()
      expect(desc).toContainElement(screen.getByTestId('antibot-success'))
      expect(screen.getByTestId('antibot-success')).toHaveTextContent('antibot.success')
      expect(container.querySelector('.home-intro-extra [data-testid="antibot-success"]')).toBeNull()
      act(() => { vi.advanceTimersByTime(3999) })
      expect(screen.getByTestId('antibot-success')).toBeInTheDocument()
      act(() => { vi.advanceTimersByTime(1) })
      expect(screen.queryByTestId('antibot-success')).toBeNull()
      expect(container.querySelector('.home-intro-antibot')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('no success line when no check ran on this visit (recent pass cookie)', async () => {
    document.cookie = 'pathsgames.turnstilePass=1; path=/'
    listMatches.mockResolvedValue([])
    const { container } = wrap(<HomePage />)
    await screen.findByText('Forest Path')
    expect(screen.queryByTestId('turnstile-mock')).toBeNull()
    expect(screen.queryByTestId('antibot-success')).toBeNull()
    expect(container.querySelector('.home-intro-antibot')).toBeNull()
  })

  it('a blocked check shows nothing on the card: the navbar says it', async () => {
    ts.behavior = 'bot'
    const { container } = wrap(<HomePage />)
    await waitFor(() => expect(screen.getByTestId('home-error').textContent).toBe('antibot'))
    expect(container.querySelector('.home-antibot-strip')).toBeNull()
    expect(screen.queryByTestId('antibot-success')).toBeNull()
  })

  it('keeps the stories heading in the markup, hidden by CSS', async () => {
    const { container } = wrap(<HomePage />)
    await screen.findByText('Forest Path')
    const heading = container.querySelector('.book-page-right h2.book-cards-heading')
    expect(heading).toHaveTextContent('home.stories')
  })

  it('loading: the game loading page on the right page', async () => {
    getStories.mockReturnValue(new Promise(() => {}))
    const { container } = wrap(<HomePage />)
    const right = container.querySelector('.book-page-right')
    expect(right.querySelector('.book-page-content .book-page-loading')).toBeInTheDocument()
    expect(right).toHaveTextContent('game.loadingCard.title')
    expect(screen.queryByTestId('tutorial-btn')).toBeNull()
  })

  it('fetch error: the yellow sign on the right page', async () => {
    getStories.mockRejectedValue(new Error('down'))
    const { container } = wrap(<HomePage />)
    const alert = await screen.findByRole('alert')
    expect(container.querySelector('.book-page-right')).toContainElement(alert)
  })

  it('is rendered once: one Turnstile widget, one book, one catalog', async () => {
    const { container } = wrap(<HomePage />)
    await screen.findByText('Forest Path')
    expect(screen.getAllByTestId('turnstile-mock')).toHaveLength(1)
    expect(container.querySelectorAll('.book-wrapper')).toHaveLength(1)
    expect(screen.getAllByText('Forest Path')).toHaveLength(1)
  })

  it('a policy chapter covers both pages, kept mounted with the widget running', async () => {
    const { PolicyBookProvider, usePolicyBook } = await import('../context/PolicyBookContext')
    function Opener() { const { openPolicyBook } = usePolicyBook(); return <button onClick={() => openPolicyBook('privacy')}>open-privacy</button> }
    const { container } = render(<PolicyBookProvider>{tree(<><Opener /><HomePage /></>)}</PolicyBookProvider>)
    await screen.findByText('Forest Path')
    fireEvent.click(screen.getByText('open-privacy'))
    expect(container.querySelector('.book-stage')).toHaveClass('book-stage--no-tabs')
    expect(container.querySelector('.book-bookmark--home')).toBeNull()
    expect(container.querySelector('.book-page-left .book-content--chapter')).toBeInTheDocument()
    const covered = container.querySelectorAll('.book-wrapper .book-content--covered')
    expect(covered).toHaveLength(2)
    covered.forEach(el => expect(el).toHaveAttribute('aria-hidden', 'true'))
    expect(covered[0]).toContainElement(screen.getByTestId('turnstile-mock'))
    expect(covered[1]).toContainElement(screen.getByText('Forest Path'))
  })
})
