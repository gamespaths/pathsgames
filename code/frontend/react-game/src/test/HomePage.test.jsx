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

vi.mock('@/features/guest-user/GuestUserContext', () => ({
  useGuestUser: () => ({ user: mockUser, openGuestModal: mockOpenGuestModal }),
}))

// The flags come from .env*, which a build (or a developer) flips: pin them here so this
// suite always describes the modal flow. The direct-resume one has its own suite.
vi.mock('../constants/features', async (importOriginal) => ({
  ...(await importOriginal()),
  RESUME_WITHOUT_MODAL: false,
  ADD_COMING_SOON_STORIES: false,
}))

vi.mock('../api/stories', () => ({ getStories: vi.fn() }))
vi.mock('../api/matches', () => ({ listMatches: vi.fn() }))
vi.mock('../features/catalog/StoryCatalog', () => ({
  default: ({ stories, onStoryClick }) => (
    <div>
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
import { getStories } from '../api/stories'
import { listMatches } from '../api/matches'

const STORY_A = { uuid: 's1', title: 'Forest Path', card: {} }
const STORY_B = { uuid: 's2', title: 'Dragon Keep', card: {} }

function wrap(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('HomePage — story click with active match check', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ts.behavior = 'success'
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

  it('fails closed when listMatches throws: no StartBookModal, an error banner instead (v0.32.1)', async () => {
    listMatches.mockRejectedValue(new Error('Network error'))
    wrap(<HomePage />)
    fireEvent.click(await screen.findByText('Forest Path'))
    expect(await screen.findByText('home.matchesError')).toBeInTheDocument()
    expect(screen.queryByTestId('start-book-modal')).not.toBeInTheDocument()
    expect(mockOpenGuestModal).not.toHaveBeenCalled()
  })

  it('retries the match list from the error banner (v0.32.1)', async () => {
    listMatches.mockRejectedValueOnce(new Error('Network error'))
    listMatches.mockResolvedValue([])
    wrap(<HomePage />)
    await screen.findByText('home.matchesError')
    fireEvent.click(screen.getByText('startMatch.retry'))
    await waitFor(() => expect(listMatches).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByText('home.matchesError')).not.toBeInTheDocument())
    fireEvent.click(screen.getByText('Forest Path'))
    expect(await screen.findByTestId('start-book-modal')).toBeInTheDocument()
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

  it('offers a retry (instead of blocking) and never calls getStories on widget error', async () => {
    ts.behavior = 'bot'
    wrap(<HomePage />)
    expect(await screen.findByText('antibot.error')).toBeInTheDocument()
    expect(screen.getByText('startMatch.retry')).toBeInTheDocument()
    expect(screen.queryByText('Forest Path')).not.toBeInTheDocument()
    expect(getStories).not.toHaveBeenCalled()
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
    document.cookie = 'pathsgames.turnstilePass=1; path=/'
    listMatches.mockResolvedValue([])
  })

  it('shows the error and a retry instead of spinning for ever', async () => {
    getStories.mockRejectedValue(new Error('Network Error'))
    wrap(<HomePage />)
    expect(await screen.findByText('home.storiesError')).toBeInTheDocument()
    expect(screen.getByText('startMatch.retry')).toBeInTheDocument()
    expect(screen.queryByText('home.loading')).not.toBeInTheDocument()
  })

  it('retry refetches and shows the catalog once the call succeeds', async () => {
    getStories.mockRejectedValueOnce(new Error('Network Error'))
      .mockResolvedValueOnce([STORY_A, STORY_B])
    wrap(<HomePage />)
    fireEvent.click(await screen.findByText('startMatch.retry'))
    expect(await screen.findByText('Forest Path')).toBeInTheDocument()
    expect(screen.queryByText('home.storiesError')).not.toBeInTheDocument()
    expect(getStories).toHaveBeenCalledTimes(2)
  })

  it('leaves the error showing when the retry fails too', async () => {
    getStories.mockRejectedValue(new Error('Network Error'))
    wrap(<HomePage />)
    fireEvent.click(await screen.findByText('startMatch.retry'))
    await waitFor(() => expect(getStories).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('home.storiesError')).toBeInTheDocument()
  })

  it('shows the catalog, not the error, when the fetch succeeds', async () => {
    getStories.mockResolvedValue([STORY_A])
    wrap(<HomePage />)
    expect(await screen.findByText('Forest Path')).toBeInTheDocument()
    expect(screen.queryByText('home.storiesError')).not.toBeInTheDocument()
  })
})

describe('HomePage — unmounted before the catalog fetch settles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ts.behavior = 'success'
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
    expect(screen.queryByText('home.storiesError')).not.toBeInTheDocument()
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
