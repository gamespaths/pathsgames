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

vi.mock('../context/GuestUserContext', () => ({
  useGuestUser: () => ({ user: mockUser, openGuestModal: mockOpenGuestModal }),
}))

vi.mock('../api/stories', () => ({ getStories: vi.fn() }))
vi.mock('../api/matches', () => ({ listMatches: vi.fn() }))
vi.mock('../features/home/StoryCatalog', () => ({
  default: ({ stories, onStoryClick }) => (
    <div>
      {stories.map(s => (
        <button key={s.uuid} onClick={() => onStoryClick(s)}>{s.title}</button>
      ))}
    </div>
  ),
}))
vi.mock('../features/startBook/StartBookModal', () => ({
  default: ({ story, onClose }) => <div data-testid="start-book-modal">{story.title}</div>,
}))

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

  it('opens GuestUserModal when RUNNING match exists for that story', async () => {
    listMatches.mockResolvedValue([
      { uuid: 'm1', storyUuid: 's1', status: 'RUNNING' },
    ])
    wrap(<HomePage />)
    fireEvent.click(await screen.findByText('Forest Path'))
    await waitFor(() => expect(mockOpenGuestModal).toHaveBeenCalledTimes(1))
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

  it('falls back to StartBookModal when listMatches throws', async () => {
    listMatches.mockRejectedValue(new Error('Network error'))
    wrap(<HomePage />)
    fireEvent.click(await screen.findByText('Forest Path'))
    expect(await screen.findByTestId('start-book-modal')).toBeInTheDocument()
  })

  it('blocks bots: shows antibot message and never calls getStories', async () => {
    ts.behavior = 'bot'
    wrap(<HomePage />)
    expect(await screen.findByText('antibot.blocked')).toBeInTheDocument()
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
