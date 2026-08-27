import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

// Coverage-focused companion to HomePage.test.jsx / GamePage.test.jsx: the board
// reload handler, the fatal-error exit and the home-page paths the main suites
// never take.

const ts = vi.hoisted(() => ({ behavior: 'success' }))
vi.mock('@marsidev/react-turnstile', async () => {
  const { useEffect } = await import('react')
  return {
    Turnstile: ({ onSuccess, onError }) => {
      useEffect(() => { ts.behavior === 'bot' ? onError?.() : onSuccess?.('test-token') }, [])
      return <div data-testid="turnstile-mock" />
    },
  }
})
vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))
const mockOpenGuestModal = vi.fn()
vi.mock('@/features/guest-user/GuestUserContext', () => ({
  useGuestUser: () => ({ user: { userUuid: 'u1', accessToken: 'tok' }, openGuestModal: mockOpenGuestModal }),
}))
vi.mock('../api/stories', () => ({ getStories: vi.fn(), getStory: vi.fn(), getStoryDetail: vi.fn() }))
vi.mock('../api/matches', () => ({ listMatches: vi.fn() }))
vi.mock('../api/game', () => ({
  getMatchInfo: vi.fn(),
  MatchNotRunningError: class MatchNotRunningError extends Error {
    constructor(status) { super(`Match status is ${status}`); this.status = status }
  },
}))
vi.mock('../features/catalog/StoryCatalog', () => ({
  default: ({ stories, onStoryClick }) => (
    <div>{stories.map(s => <button key={s.uuid} onClick={() => onStoryClick(s)}>{s.title}</button>)}</div>
  ),
}))
// The start book exposes its close handler so the home page can drop the selection.
vi.mock('../features/start-book/StartBookModal', () => ({
  default: ({ story, onClose }) => (
    <div data-testid="start-book-modal">
      {story.title}<button data-testid="close-book" onClick={onClose}>close</button>
    </div>
  ),
}))
// The game board exposes onReload / onError so both parent handlers can be driven.
vi.mock('../features/gameplay/GameBook', () => ({
  default: ({ onReload, onError, onClose }) => (
    <div data-testid="game-book">
      <button data-testid="reload" onClick={() => onReload?.()}>reload</button>
      <button data-testid="fatal" onClick={() => onError?.({ status: 500 })}>fatal</button>
      <button data-testid="close" onClick={onClose}>close</button>
    </div>
  ),
}))
vi.mock('../components/modals/ErrorCard', () => ({
  default: ({ status, onClose }) => (
    <div data-testid="error-card">
      <span data-testid="error-status">{status ?? 'none'}</span>
      <button data-testid="close-error" onClick={onClose}>close-error</button>
    </div>
  ),
}))
vi.mock('../utils/turnstile', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, CF_KEY: 'test-site-key' }
})

import HomePage from '../pages/HomePage'
import GamePage from '../pages/GamePage'
import { getStories, getStory, getStoryDetail } from '../api/stories'
import { listMatches } from '../api/matches'
import { getMatchInfo } from '../api/game'

const STORY = { uuid: 's1', title: 'Forest Path', card: { title: 'Forest Path' } }

describe('HomePage — story click and book dismissal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ts.behavior = 'success'
    getStories.mockResolvedValue([STORY])
  })

  // v0.32.1 — the active-match list may still be loading when a story is clicked:
  // the page awaits the single in-flight request instead of firing a second one.
  it('awaits the in-flight match list instead of refetching it', async () => {
    let resolveMatches
    listMatches.mockReturnValue(new Promise(res => { resolveMatches = res }))
    render(<MemoryRouter><HomePage /></MemoryRouter>)
    fireEvent.click(await screen.findByText('Forest Path'))
    expect(screen.queryByTestId('start-book-modal')).not.toBeInTheDocument()
    resolveMatches([])
    expect(await screen.findByTestId('start-book-modal')).toBeInTheDocument()
    expect(listMatches).toHaveBeenCalledTimes(1)
  })

  // v0.32.1 — a failing fetch fails closed: without the list we cannot tell
  // whether a match already exists, so the book stays shut.
  it('does not open the book when the match fetch fails', async () => {
    listMatches.mockRejectedValue(new Error('offline'))
    render(<MemoryRouter><HomePage /></MemoryRouter>)
    fireEvent.click(await screen.findByText('Forest Path'))
    expect(await screen.findByText('home.matchesError')).toBeInTheDocument()
    expect(screen.queryByTestId('start-book-modal')).not.toBeInTheDocument()
  })

  // Closing the book clears the selected story and returns to the catalog.
  it('drops the selected story when the book is closed', async () => {
    listMatches.mockResolvedValue([])
    render(<MemoryRouter><HomePage /></MemoryRouter>)
    fireEvent.click(await screen.findByText('Forest Path'))
    fireEvent.click(await screen.findByTestId('close-book'))
    await waitFor(() => expect(screen.queryByTestId('start-book-modal')).not.toBeInTheDocument())
  })
})

describe('GamePage — reload and fatal errors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getStory.mockResolvedValue({ uuid: 'abc', title: 'Story', card: {} })
    getStoryDetail.mockResolvedValue({ uuid: 'abc' })
    getMatchInfo.mockResolvedValue({ uuid: 'match-1', story: { uuid: 'abc' } })
  })

  function wrap() {
    return render(
      <MemoryRouter initialEntries={[{ pathname: '/play/abc', state: { matchUuid: 'match-1' } }]}>
        <Routes><Route path="/play/:storyId" element={<GamePage />} /></Routes>
      </MemoryRouter>
    )
  }

  // The board asks for a fresh match-info after every state-mutating action.
  it('re-fetches the match board when the game asks for a reload', async () => {
    wrap()
    fireEvent.click(await screen.findByTestId('reload'))
    await waitFor(() => expect(getMatchInfo).toHaveBeenCalledTimes(2))
  })

  // A failing reload keeps the current board rather than blanking it.
  it('keeps the board when the reload fails', async () => {
    wrap()
    await screen.findByTestId('game-book')
    getMatchInfo.mockRejectedValueOnce(new Error('offline'))
    fireEvent.click(screen.getByTestId('reload'))
    await waitFor(() => expect(getMatchInfo).toHaveBeenCalledTimes(2))
    expect(screen.getByTestId('game-book')).toBeInTheDocument()
  })

  // A transient error raised inside the board is shown over it and dismissed in
  // place — the player stays in the match.
  it('dismisses a transient board error in place', async () => {
    wrap()
    fireEvent.click(await screen.findByTestId('fatal'))
    expect(await screen.findByTestId('error-card')).toBeInTheDocument()
    expect(screen.getByTestId('error-status')).toHaveTextContent('500')
    fireEvent.click(screen.getByTestId('close-error'))
    expect(screen.queryByTestId('error-card')).not.toBeInTheDocument()
    expect(screen.getByTestId('game-book')).toBeInTheDocument()
  })

  // A fatal match-load error has no board to go back to: closing it sends the
  // player home.
  it('sends the player home when a fatal match error is closed', async () => {
    const original = window.location
    delete window.location
    window.location = { ...original, href: 'http://localhost/play/abc' }
    try {
      getMatchInfo.mockRejectedValue(Object.assign(new Error('gone'), { status: 404 }))
      wrap()
      expect(await screen.findByTestId('error-card')).toBeInTheDocument()
      fireEvent.click(screen.getByTestId('close-error'))
      expect(window.location.href).toBe('/')
    } finally {
      window.location = original
    }
  })
})
