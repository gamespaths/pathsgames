import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Controllable Turnstile mock: on mount it fires onSuccess (human) by default,
// or onError when `ts.behavior` is flipped to 'bot' before render.
const ts = vi.hoisted(() => ({ behavior: 'success' }))
vi.mock('@marsidev/react-turnstile', async () => {
  const { useEffect } = await import('react')
  return {
    Turnstile: ({ onSuccess, onError }) => {
      useEffect(() => {
        if (ts.behavior === 'bot') onError?.()
        else if (ts.behavior === 'pending') { /* v0.37.6 — never answers */ }
        else onSuccess?.('test-token')
      }, [])
      return <div data-testid="turnstile-mock" />
    },
  }
})

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))

const mockOpenGuestModal = vi.fn()
const mockUser = { userUuid: 'u1', username: 'guest_u1', accessToken: 'tok' }
// v0.37.6 — the guest identity the page sees; tests swap it to simulate a session
// still being created (no token yet) or one that failed.
const guest = vi.hoisted(() => ({ user: null, error: null }))

vi.mock('@/features/guest-user/GuestUserContext', () => ({
  useGuestUser: () => ({ user: guest.user, error: guest.error, openGuestModal: mockOpenGuestModal }),
}))

// The flags come from .env*, which a build (or a developer) flips: pin them here so this
// suite always describes the modal flow. The direct-resume one has its own suite.
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
vi.mock('../features/start-book/StartBookModal', () => ({
  default: ({ story, onClose }) => <div data-testid="start-book-modal">{story.title}</div>,
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

const STORY_A = { uuid: 's1', title: 'Forest Path', card: {} }
const STORY_B = { uuid: 's2', title: 'Dragon Keep', card: {} }

function wrap(ui) {
  return render(
    <HomeStatusProvider>
      <MemoryRouter>{ui}<HomeErrorProbe /></MemoryRouter>
    </HomeStatusProvider>,
  )
}

describe('HomePage — story click with active match check', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ts.behavior = 'success'
    guest.user = mockUser
    guest.error = null
    document.cookie = 'pathsgames.turnstilePass=; max-age=0; path=/' // forget prior pass
    getStories.mockResolvedValue([STORY_A, STORY_B])
  })

  it('opens StartBookModal when no active match for that story', async () => {
    listMatches.mockResolvedValue([
      { uuid: 'm1', storyUuid: 's1', status: 'ENDED' },
    ])
    wrap(<HomePage />)
    fireEvent.click(await screen.findByText('Forest Path'))
    expect(await screen.findByTestId('start-book-modal')).toBeInTheDocument()
    expect(mockOpenGuestModal).not.toHaveBeenCalled()
  })

  it('opens GuestUserModal when RUNNING match exists for that story (handing over the fetched matches)', async () => {
    const list = [{ uuid: 'm1', storyUuid: 's1', status: 'RUNNING' }]
    listMatches.mockResolvedValue(list)
    wrap(<HomePage />)
    fireEvent.click(await screen.findByText('Forest Path'))
    await waitFor(() => expect(mockOpenGuestModal).toHaveBeenCalledTimes(1))
    // matches already loaded by Home are passed to the modal so it won't refetch
    expect(mockOpenGuestModal).toHaveBeenCalledWith(list)
    expect(screen.queryByTestId('start-book-modal')).not.toBeInTheDocument()
  })

  it('opens GuestUserModal when CREATED match exists for that story', async () => {
    listMatches.mockResolvedValue([
      { uuid: 'm2', storyUuid: 's1', status: 'CREATED' },
    ])
    wrap(<HomePage />)
    fireEvent.click(await screen.findByText('Forest Path'))
    await waitFor(() => expect(mockOpenGuestModal).toHaveBeenCalledTimes(1))
  })

  it('does not redirect when active match is for a different story', async () => {
    listMatches.mockResolvedValue([
      { uuid: 'm1', storyUuid: 's2', status: 'RUNNING' },
    ])
    wrap(<HomePage />)
    fireEvent.click(await screen.findByText('Forest Path'))
    expect(await screen.findByTestId('start-book-modal')).toBeInTheDocument()
    expect(mockOpenGuestModal).not.toHaveBeenCalled()
  })

  it('opens GuestUserModal when a PAUSED match exists for that story (v0.32.1)', async () => {
    const list = [{ uuid: 'm3', storyUuid: 's1', status: 'PAUSED' }]
    listMatches.mockResolvedValue(list)
    wrap(<HomePage />)
    fireEvent.click(await screen.findByText('Forest Path'))
    await waitFor(() => expect(mockOpenGuestModal).toHaveBeenCalledWith(list))
    expect(screen.queryByTestId('start-book-modal')).not.toBeInTheDocument()
  })

  it('fails closed when listMatches throws: no StartBookModal, "error" footers and the navbar error (v0.37.6)', async () => {
    listMatches.mockRejectedValue(new Error('Network error'))
    wrap(<HomePage />)
    await screen.findByText('Forest Path')
    await waitFor(() => expect(screen.getByTestId('footer-state').textContent).toBe('error'))
    expect(screen.getByTestId('home-error').textContent).toBe('matches')
    fireEvent.click(screen.getByText('Forest Path'))
    expect(screen.queryByTestId('start-book-modal')).not.toBeInTheDocument()
    expect(mockOpenGuestModal).not.toHaveBeenCalled()
    expect(screen.queryByText('home.matchesError')).not.toBeInTheDocument()
  })

  it('a click that awaited a failing in-flight list also fails closed (v0.32.1)', async () => {
    let rejectMatches
    listMatches.mockReturnValue(new Promise((_, rej) => { rejectMatches = rej }))
    wrap(<HomePage />)
    fireEvent.click(await screen.findByText('Forest Path'))
    rejectMatches(new Error('Network error'))
    await waitFor(() => expect(screen.getByTestId('footer-state').textContent).toBe('error'))
    expect(screen.queryByTestId('start-book-modal')).not.toBeInTheDocument()
  })

  it('a click during the load awaits the single in-flight request (v0.32.1)', async () => {
    let resolveMatches
    listMatches.mockReturnValue(new Promise(res => { resolveMatches = res }))
    wrap(<HomePage />)
    fireEvent.click(await screen.findByText('Forest Path'))
    // still pending: nothing opened, and no second request was fired
    expect(screen.queryByTestId('start-book-modal')).not.toBeInTheDocument()
    expect(listMatches).toHaveBeenCalledTimes(1)
    resolveMatches([])
    expect(await screen.findByTestId('start-book-modal')).toBeInTheDocument()
    expect(listMatches).toHaveBeenCalledTimes(1)
  })

  it('shows the catalog even when the widget fails, with "blocked" footers, no clicks and the navbar error (v0.37.6)', async () => {
    ts.behavior = 'bot'
    listMatches.mockResolvedValue([])
    wrap(<HomePage />)
    expect(await screen.findByText('Forest Path')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('footer-state').textContent).toBe('blocked'))
    expect(screen.getByTestId('home-error').textContent).toBe('antibot')
    expect(getStories).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('Forest Path'))
    expect(screen.queryByTestId('start-book-modal')).not.toBeInTheDocument()
    expect(screen.queryByText('antibot.error')).not.toBeInTheDocument()
  })

  it('fetches stories and matches in parallel with the antibot check, footers spinning meanwhile (v0.37.6)', async () => {
    ts.behavior = 'pending'
    listMatches.mockResolvedValue([])
    wrap(<HomePage />)
    expect(await screen.findByText('Forest Path')).toBeInTheDocument()
    expect(screen.getByTestId('turnstile-mock')).toBeInTheDocument()
    expect(screen.getByText('antibot.verifying')).toBeInTheDocument()
    // The strip overlays the hero picture, above the title.
    const strip = document.querySelector('.hero-overlay > .home-antibot-strip')
    expect(strip).toContainElement(screen.getByTestId('turnstile-mock'))
    expect(strip.nextElementSibling).toHaveClass('hero-title')
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
    expect(screen.queryByTestId('start-book-modal')).not.toBeInTheDocument()
    // The token lands → one call, with that token.
    guest.user = mockUser
    rerender(
      <HomeStatusProvider>
        <MemoryRouter><HomePage /><HomeErrorProbe /></MemoryRouter>
      </HomeStatusProvider>,
    )
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
    expect(screen.getByTestId('home-error').textContent).toBe('matches')
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
    expect(screen.getByTestId('home-error').textContent).toBe('stories')
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
