import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Same harness as HomePage.test.jsx, but with the RESUME_WITHOUT_MODAL flag on:
// a story with a resumable match must go straight to /play, no guest modal.
vi.mock('@marsidev/react-turnstile', async () => {
  const { useEffect } = await import('react')
  return {
    Turnstile: ({ onSuccess }) => {
      useEffect(() => { onSuccess?.('test-token') }, [])
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

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => mockNavigate,
}))

vi.mock('../constants/features', async (importOriginal) => ({
  ...(await importOriginal()),
  RESUME_WITHOUT_MODAL: true,
  ADD_COMING_SOON_STORIES: false,
}))

vi.mock('../api/stories', () => ({ getStories: vi.fn() }))
vi.mock('../api/matches', () => ({ listMatches: vi.fn() }))
vi.mock('../features/catalog/StoryCatalog', () => ({
  default: ({ stories, onStoryClick }) => (
    <div>{stories.map(s => <button key={s.uuid} onClick={() => onStoryClick(s)}>{s.title}</button>)}</div>
  ),
}))
vi.mock('../features/start-book/StartBookModal', () => ({
  default: ({ story }) => <div data-testid="start-book-modal">{story.title}</div>,
}))

import HomePage from '../pages/HomePage'
import { getStories } from '../api/stories'
import { listMatches } from '../api/matches'

const STORY_A = { uuid: 's1', title: 'Forest Path', card: {} }

describe('HomePage — Resume without the player modal (VITE_RESUME_WITHOUT_MODAL)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.cookie = 'pathsgames.turnstilePass=1; path=/'
    getStories.mockResolvedValue([STORY_A])
  })

  it('goes straight to the running match, carrying its uuid', async () => {
    listMatches.mockResolvedValue([{ uuid: 'm1', storyUuid: 's1', status: 'RUNNING' }])
    render(<MemoryRouter><HomePage /></MemoryRouter>)
    fireEvent.click(await screen.findByText('Forest Path'))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/play/s1', { state: { matchUuid: 'm1' } }))
    expect(mockOpenGuestModal).not.toHaveBeenCalled()
    expect(screen.queryByTestId('start-book-modal')).not.toBeInTheDocument()
  })

  it('resumes a CREATED match too', async () => {
    listMatches.mockResolvedValue([{ uuid: 'm2', storyUuid: 's1', status: 'CREATED' }])
    render(<MemoryRouter><HomePage /></MemoryRouter>)
    fireEvent.click(await screen.findByText('Forest Path'))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/play/s1', { state: { matchUuid: 'm2' } }))
  })

  it('still opens the modal for a PAUSED match — it blocks a new run but cannot be resumed', async () => {
    const list = [{ uuid: 'm3', storyUuid: 's1', status: 'PAUSED' }]
    listMatches.mockResolvedValue(list)
    render(<MemoryRouter><HomePage /></MemoryRouter>)
    fireEvent.click(await screen.findByText('Forest Path'))
    await waitFor(() => expect(mockOpenGuestModal).toHaveBeenCalledWith(list))
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('opens StartBookModal when there is nothing to resume', async () => {
    listMatches.mockResolvedValue([{ uuid: 'm4', storyUuid: 's1', status: 'ENDED' }])
    render(<MemoryRouter><HomePage /></MemoryRouter>)
    fireEvent.click(await screen.findByText('Forest Path'))
    expect(await screen.findByTestId('start-book-modal')).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
