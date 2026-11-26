import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

vi.mock('../api/game', () => ({
  getMatchInfo: vi.fn(),
  MatchNotRunningError: class MatchNotRunningError extends Error {
    constructor(status) { super(`Match status is ${status}`); this.status = status; this.name = 'MatchNotRunningError' }
  },
}))
vi.mock('../api/stories', () => ({ getStory: vi.fn(), getStories: vi.fn(), getStoryDetail: vi.fn() }))
vi.mock('../api/matches', () => ({ listMatches: vi.fn() }))
const guest = vi.hoisted(() => ({ value: null }))
vi.mock('@/features/guest-user/GuestUserContext', () => ({
  useGuestUser: () => guest.value,
}))
vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en' }),
}))
// v1.13.0 — a transient error reaches the board as `error`: its right page, closed by onErrorClose.
vi.mock('../features/gameplay/GameBook', () => ({
  default: ({ gameData, matchUuid, story, onClose, onError, error, onErrorClose }) => (
    <div data-testid="game-book">
      <span data-testid="match-uuid">{matchUuid ?? 'none'}</span>
      <button onClick={onClose}>close</button>
      <button onClick={() => onError?.({ status: 409, response: { data: { message: 'Not enough energy: have 2, need 4' } } })}>trigger-error</button>
      {error && (
        <div data-testid="error-card">
          <span data-testid="error-status">{error.status ?? 'none'}</span>
          <span data-testid="error-message">{error.message ?? 'none'}</span>
          <button onClick={onErrorClose}>close-error</button>
        </div>
      )}
    </div>
  ),
}))
vi.mock('../components/layout/ErrorCard', () => ({
  default: ({ status, message, onClose }) => (
    <div data-testid="error-card">
      <span data-testid="error-status">{status ?? 'none'}</span>
      <span data-testid="error-message">{message ?? 'none'}</span>
      <button onClick={onClose}>close-error</button>
    </div>
  ),
}))

import GamePage from '../pages/GamePage'
import { getMatchInfo } from '../api/game'
import { listMatches } from '../api/matches'
import { getStory, getStoryDetail } from '../api/stories'

function StoryStub() {
  const { pathname, state } = useLocation()
  return <div data-testid="story-page" data-redirected={String(Boolean(state?.redirected))}>{pathname}</div>
}

function wrap(storyId = 'abc', state = {}) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: `/play/${storyId}`, state }]}>
      <Routes>
        <Route path="/play/:storyId" element={<GamePage />} />
        <Route path="/story/:storyId" element={<StoryStub />} />
        <Route path="/" element={<div data-testid="home-page" />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('GamePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    guest.value = { user: { accessToken: 'tok' } }
    getStoryDetail.mockResolvedValue({ uuid: 'abc' })
  })

  it('v1.13.0 — while data loads: a Book, LoadingCard on the left, an empty right page', () => {
    getMatchInfo.mockReturnValue(new Promise(() => {}))
    getStory.mockReturnValue(new Promise(() => {}))
    const { container } = wrap('abc', { matchUuid: 'match-1' })
    expect(container.querySelector('.book-stage')).toBeInTheDocument()
    expect(container.querySelector('.book-page-left')).toHaveTextContent('game.loadingCard.title')
    expect(container.querySelector('.book-page-right .page-inner').textContent).toBe('')
    expect(container.querySelector('.game-page-wrap')).toBeNull()
  })

  it('renders GameBook after data loads', async () => {
    getMatchInfo.mockResolvedValue({ locations: [] })
    getStory.mockResolvedValue({ uuid: 'abc', title: 'Test Story' })
    wrap('abc', { matchUuid: 'match-1' })
    expect(await screen.findByTestId('game-book')).toBeInTheDocument()
    expect(screen.getByTestId('match-uuid').textContent).toBe('match-1')
  })

  it('asks /info once under StrictMode double mount (v0.37.6)', async () => {
    const { StrictMode } = await import('react')
    getMatchInfo.mockResolvedValue({ locations: [] })
    getStory.mockResolvedValue({ uuid: 'abc', title: 'Test Story' })
    render(
      <StrictMode>
        <MemoryRouter initialEntries={[{ pathname: '/play/abc', state: { matchUuid: 'match-1' } }]}>
          <Routes><Route path="/play/:storyId" element={<GamePage />} /></Routes>
        </MemoryRouter>
      </StrictMode>,
    )
    expect(await screen.findByTestId('game-book')).toBeInTheDocument()
    expect(getMatchInfo).toHaveBeenCalledTimes(1)
    expect(getStory).toHaveBeenCalledTimes(1)
  })

  describe('v1.13.0 — direct load without router state', () => {
    it('resumes the player\'s only running match of that story', async () => {
      listMatches.mockResolvedValue([
        { uuid: 'other', storyUuid: 'zzz', status: 'RUNNING' },
        { uuid: 'match-7', storyUuid: 'abc', status: 'RUNNING' },
      ])
      getMatchInfo.mockResolvedValue({ locations: [] })
      getStory.mockResolvedValue({ uuid: 'abc', title: 'Test Story' })
      wrap('abc')
      expect(await screen.findByTestId('game-book')).toBeInTheDocument()
      expect(screen.getByTestId('match-uuid').textContent).toBe('match-7')
      expect(listMatches).toHaveBeenCalledWith('tok')
      expect(getMatchInfo).toHaveBeenCalledWith('match-7', 'tok', 'en')
    })

    it('no running match of that story: to /story/:storyId', async () => {
      listMatches.mockResolvedValue([{ uuid: 'm1', storyUuid: 'abc', status: 'ENDED' }])
      wrap('abc')
      expect(await screen.findByTestId('story-page')).toHaveTextContent('/story/abc')
      // Step 15 — a silent redirect: no book change, no turn
      expect(screen.getByTestId('story-page')).toHaveAttribute('data-redirected', 'true')
      expect(getMatchInfo).not.toHaveBeenCalled()
    })

    it('a failed list: to /story/:storyId', async () => {
      listMatches.mockRejectedValue(new Error('down'))
      wrap('abc')
      expect(await screen.findByTestId('story-page')).toHaveTextContent('/story/abc')
    })

    it('no session (a failed guest, or logged out with none to resume): to /story/:storyId', async () => {
      guest.value = { user: null, error: 'guest-init-failed' }
      const { unmount } = wrap('abc')
      expect(await screen.findByTestId('story-page')).toBeInTheDocument()
      unmount()
      guest.value = { user: null, sessionIdle: true }
      wrap('abc')
      expect(await screen.findByTestId('story-page')).toBeInTheDocument()
      expect(listMatches).not.toHaveBeenCalled()
    })

    it('waits for the session meanwhile, showing the loading page', () => {
      guest.value = { user: null }
      const { container } = wrap('abc')
      expect(listMatches).not.toHaveBeenCalled()
      expect(screen.queryByTestId('story-page')).not.toBeInTheDocument()
      expect(container.querySelector('.book-page-left')).toHaveTextContent('game.loadingCard.title')
    })

    it('outside a guest provider it waits too', () => {
      guest.value = undefined
      wrap('abc')
      expect(screen.queryByTestId('story-page')).not.toBeInTheDocument()
    })
  })

  it('surfaces a GameBook API error as a transient ErrorCard without leaving the board', async () => {
    getMatchInfo.mockResolvedValue({ locations: [] })
    getStory.mockResolvedValue({ uuid: 'abc', title: 'Test Story' })
    wrap('abc', { matchUuid: 'match-1' })
    await screen.findByTestId('game-book')

    fireEvent.click(screen.getByText('trigger-error'))
    // The API error message is the board's right page, and the board stays mounted (transient).
    expect(await screen.findByTestId('error-card')).toBeInTheDocument()
    expect(screen.getByTestId('error-message').textContent).toBe('Not enough energy: have 2, need 4')
    expect(screen.getByTestId('error-status').textContent).toBe('409')
    expect(screen.getByTestId('game-book')).toBeInTheDocument()

    // Dismissing a transient error keeps the player in the game (no redirect).
    fireEvent.click(screen.getByText('close-error'))
    expect(screen.queryByTestId('error-card')).not.toBeInTheDocument()
    expect(screen.getByTestId('game-book')).toBeInTheDocument()
  })

  it('shows ErrorCard when getMatchInfo throws MatchNotRunningError', async () => {
    const { MatchNotRunningError } = await import('../api/game')
    getMatchInfo.mockRejectedValue(new MatchNotRunningError('ENDED'))
    getStory.mockResolvedValue({ uuid: 'abc', title: 'Test Story' })
    const { container } = wrap('abc', { matchUuid: 'match-ended' })
    // v1.13.0 — inside a Book: the fixed error picture on the left, ErrorCard on the right
    expect((await screen.findAllByTestId('error-card')).length).toBeGreaterThan(0)
    expect(container.querySelector('.book-page-right [data-testid="error-card"]')).toBeInTheDocument()
    expect(container.querySelector('.book-page-left')).toHaveTextContent('errors.title')
    expect(screen.getAllByTestId('error-status')[0].textContent).toBe('ENDED')
    expect(screen.queryByTestId('game-book')).not.toBeInTheDocument()
  })

  it('a fatal error after the story loaded keeps the story card on the left page', async () => {
    getMatchInfo.mockResolvedValueOnce({ locations: [] })
    getStory.mockResolvedValue({ uuid: 'abc', title: 'Test Story', card: { title: 'Story card' } })
    const { container, rerender } = wrap('abc', { matchUuid: 'match-1' })
    await screen.findByTestId('game-book')
    // a new session token re-asks the board, which now fails
    getMatchInfo.mockRejectedValue(Object.assign(new Error('gone'), { status: 404 }))
    guest.value = { user: { accessToken: 'tok-2' } }
    rerender(
      <MemoryRouter initialEntries={[{ pathname: '/play/abc', state: { matchUuid: 'match-1' } }]}>
        <Routes><Route path="/play/:storyId" element={<GamePage />} /></Routes>
      </MemoryRouter>
    )
    expect((await screen.findAllByTestId('error-status'))[0].textContent).toBe('404')
    expect(container.querySelector('.book-page-left')).toHaveTextContent('Story card')
  })

  it('step 15 — close (Leave) goes home in the app, no reload', async () => {
    getMatchInfo.mockResolvedValue({ locations: [] })
    getStory.mockResolvedValue({ uuid: 'abc' })
    wrap('abc', { matchUuid: 'match-1' })
    await screen.findByTestId('game-book')
    act(() => { screen.getByText('close').click() })
    expect(screen.getByTestId('home-page')).toBeInTheDocument()
  })
})
