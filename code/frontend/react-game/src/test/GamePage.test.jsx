import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../api/game', () => ({ getGameData: vi.fn() }))
vi.mock('../api/stories', () => ({ getStory: vi.fn(), getStories: vi.fn() }))
vi.mock('@/features/guest-user/GuestUserContext', () => ({
  useGuestUser: () => ({ user: { accessToken: 'tok' } }),
}))
vi.mock('../features/gameplay/GameBook', () => ({
  default: ({ gameData, matchUuid, story, onClose }) => (
    <div data-testid="game-book">
      <span data-testid="match-uuid">{matchUuid ?? 'none'}</span>
      <button onClick={onClose}>close</button>
    </div>
  ),
}))

import GamePage from '../pages/GamePage'
import { getGameData } from '../api/game'
import { getStory } from '../api/stories'

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
  })

  it('shows loading spinner while data loads', () => {
    getGameData.mockReturnValue(new Promise(() => {}))
    getStory.mockReturnValue(new Promise(() => {}))
    wrap()
    expect(screen.getByText(/Loading/)).toBeInTheDocument()
  })

  it('renders GameBook after data loads', async () => {
    getGameData.mockResolvedValue({ locations: [] })
    getStory.mockResolvedValue({ uuid: 'abc', title: 'Test Story' })
    wrap('abc', { matchUuid: 'match-1' })
    expect(await screen.findByTestId('game-book')).toBeInTheDocument()
    expect(screen.getByTestId('match-uuid').textContent).toBe('match-1')
  })

  it('passes null matchUuid when state is absent', async () => {
    getGameData.mockResolvedValue({ locations: [] })
    getStory.mockResolvedValue({ uuid: 'abc', title: 'Test Story' })
    wrap('abc')
    expect(await screen.findByTestId('game-book')).toBeInTheDocument()
    expect(screen.getByTestId('match-uuid').textContent).toBe('none')
  })

  it('redirects to home when close is clicked (location.href)', async () => {
    const originalHref = window.location.href
    delete window.location
    window.location = { href: '' }

    getGameData.mockResolvedValue({ locations: [] })
    getStory.mockResolvedValue({ uuid: 'abc' })
    const { getByText } = wrap('abc')
    await screen.findByTestId('game-book')
    getByText('close').click()
    expect(window.location.href).toBe('/')

    window.location = { href: originalHref }
  })
})
