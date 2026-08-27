import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../api/game', () => ({
  getMatchInfo: vi.fn(),
  MatchNotRunningError: class MatchNotRunningError extends Error {
    constructor(status) { super(`Match status is ${status}`); this.status = status; this.name = 'MatchNotRunningError' }
  },
}))
vi.mock('../api/stories', () => ({ getStory: vi.fn(), getStories: vi.fn(), getStoryDetail: vi.fn() }))
vi.mock('@/features/guest-user/GuestUserContext', () => ({
  useGuestUser: () => ({ user: { accessToken: 'tok' } }),
}))
vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en' }),
}))
vi.mock('../features/gameplay/GameBook', () => ({
  default: ({ gameData, matchUuid, story, onClose, onError }) => (
    <div data-testid="game-book">
      <span data-testid="match-uuid">{matchUuid ?? 'none'}</span>
      <button onClick={onClose}>close</button>
      <button onClick={() => onError?.({ status: 409, response: { data: { message: 'Not enough energy: have 2, need 4' } } })}>trigger-error</button>
    </div>
  ),
}))
vi.mock('../components/modals/ErrorCard', () => ({
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
import { getStory, getStoryDetail } from '../api/stories'

function wrap(storyId = 'abc', state = {}) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: `/play/${storyId}`, state }]}>
      <Routes>
        <Route path="/play/:storyId" element={<GamePage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('GamePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getStoryDetail.mockResolvedValue({ uuid: 'abc' })
  })

  it('shows the LoadingCard page while data loads', () => {
    getMatchInfo.mockReturnValue(new Promise(() => {}))
    getStory.mockReturnValue(new Promise(() => {}))
    wrap('abc', { matchUuid: 'match-1' })
    expect(screen.getByText('game.loadingCard.title')).toBeInTheDocument()
  })

  it('renders GameBook after data loads', async () => {
    getMatchInfo.mockResolvedValue({ locations: [] })
    getStory.mockResolvedValue({ uuid: 'abc', title: 'Test Story' })
    wrap('abc', { matchUuid: 'match-1' })
    expect(await screen.findByTestId('game-book')).toBeInTheDocument()
    expect(screen.getByTestId('match-uuid').textContent).toBe('match-1')
  })

  it('shows ErrorCard with status 400 when matchUuid is absent', async () => {
    getStory.mockResolvedValue({ uuid: 'abc', title: 'Test Story' })
    wrap('abc')
    expect(await screen.findByTestId('error-card')).toBeInTheDocument()
    expect(screen.getByTestId('error-status').textContent).toBe('400')
    expect(screen.queryByTestId('game-book')).not.toBeInTheDocument()
  })

  it('surfaces a GameBook API error as a transient ErrorCard without leaving the board', async () => {
    getMatchInfo.mockResolvedValue({ locations: [] })
    getStory.mockResolvedValue({ uuid: 'abc', title: 'Test Story' })
    wrap('abc', { matchUuid: 'match-1' })
    await screen.findByTestId('game-book')

    fireEvent.click(screen.getByText('trigger-error'))
    // The API error message is shown, and the board stays mounted (transient).
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
    wrap('abc', { matchUuid: 'match-ended' })
    expect(await screen.findByTestId('error-card')).toBeInTheDocument()
    expect(screen.getByTestId('error-status').textContent).toBe('ENDED')
    expect(screen.queryByTestId('game-book')).not.toBeInTheDocument()
  })

  it('redirects to home when close is clicked (location.href)', async () => {
    const originalHref = window.location.href
    delete window.location
    window.location = { href: '' }

    getMatchInfo.mockResolvedValue({ locations: [] })
    getStory.mockResolvedValue({ uuid: 'abc' })
    const { getByText } = wrap('abc', { matchUuid: 'match-1' })
    await screen.findByTestId('game-book')
    getByText('close').click()
    expect(window.location.href).toBe('/')

    window.location = { href: originalHref }
  })
})
