import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))

// Home integration: human at once, a guest with a token, catalog and matches mocked.
vi.mock('@marsidev/react-turnstile', async () => {
  const { useEffect } = await import('react')
  return { Turnstile: ({ onSuccess }) => { useEffect(() => { onSuccess?.('tok') }, []); return null } }
})
const guest = vi.hoisted(() => ({ user: { userUuid: 'u1', accessToken: 'tok' } }))
const mockOpenGuestModal = vi.fn()
vi.mock('@/features/guest-user/GuestUserContext', () => ({
  useGuestUser: () => ({ user: guest.user, error: null, openGuestModal: mockOpenGuestModal }),
}))
vi.mock('../constants/features', async (importOriginal) => ({
  ...(await importOriginal()), RESUME_WITHOUT_MODAL: false, ADD_COMING_SOON_STORIES: false,
}))
vi.mock('../api/stories', () => ({ getStoriesCatalog: vi.fn() }))
vi.mock('../api/matches', () => ({ listMatches: vi.fn() }))
vi.mock('../features/catalog/StoryCatalog', () => ({ default: () => <div data-testid="catalog" /> }))
vi.mock('../features/start-book/StartBookModal', () => ({
  default: ({ story }) => <div data-testid="start-book-modal">{story.title}</div>,
}))
vi.mock('../utils/turnstile', async (importOriginal) => ({ ...(await importOriginal()), CF_KEY: 'test-site-key' }))

import TutorialButton, { firstTutorialStory } from '../features/catalog/TutorialButton'
import HomePage from '../pages/HomePage'
import { getStoriesCatalog } from '../api/stories'
import { listMatches } from '../api/matches'
import { HomeStatusProvider } from '../context/HomeStatusContext'

const ADV = { uuid: 'a1', title: 'Infinite paths', category: 'Adventure' }
const SOON = { uuid: 't0', title: 'Soon', category: 'Tutorial', comingSoon: true }
const TUT = { uuid: 't1', title: 'First steps', category: 'Tutorial' }
const TUT2 = { uuid: 't2', title: 'Second steps', category: 'tutorial' }
const STORIES = [ADV, SOON, TUT, TUT2]

const renderButton = props => render(
  <TutorialButton stories={STORIES} matches={[]} footerState="ready" onStoryClick={vi.fn()} {...props} />)

describe('firstTutorialStory', () => {
  it('picks the first playable tutorial story in catalog order', () => {
    expect(firstTutorialStory(STORIES)).toBe(TUT)
    expect(firstTutorialStory([ADV])).toBeNull()
    expect(firstTutorialStory(null)).toBeNull()
  })
})

describe('TutorialButton', () => {
  it('plays the first tutorial story: same click as its card', () => {
    const onStoryClick = vi.fn()
    renderButton({ onStoryClick })
    const btn = screen.getByTestId('tutorial-btn')
    expect(btn.textContent).toBe('home.playTutorial')
    expect(btn.querySelector('.fa-play')).toBeTruthy()
    expect(btn).not.toBeDisabled()
    fireEvent.click(btn)
    expect(onStoryClick).toHaveBeenCalledWith(TUT)
  })

  it.each(['RUNNING', 'CREATED', 'PAUSED'])('says resume while a %s match of the tutorial is open', status => {
    renderButton({ matches: [{ uuid: 'm1', storyUuid: 't1', status }] })
    expect(screen.getByTestId('tutorial-btn').textContent).toBe('home.resumeTutorial')
  })

  it.each(['ENDED', 'GAMEOVER'])('is hidden once the tutorial is finished (%s)', status => {
    const { container } = renderButton({ matches: [{ uuid: 'm1', storyUuid: 't1', status }] })
    expect(container.firstChild).toBeNull()
  })

  it('a finished OTHER story does not hide it', () => {
    renderButton({ matches: [{ uuid: 'm1', storyUuid: 'a1', status: 'ENDED' }] })
    expect(screen.getByTestId('tutorial-btn').textContent).toBe('home.playTutorial')
  })

  it('is disabled with a spinner while the matches load', () => {
    renderButton({ matches: null, footerState: 'loading' })
    const btn = screen.getByTestId('tutorial-btn')
    expect(btn).toBeDisabled()
    expect(btn.getAttribute('aria-busy')).toBe('true')
    expect(btn.querySelector('.fa-spinner')).toBeTruthy()
    expect(btn.querySelector('.fa-play')).toBeNull()
  })

  it('is disabled (no spinner) when the matches failed or the antibot blocked', () => {
    for (const footerState of ['error', 'blocked']) {
      const { unmount } = renderButton({ footerState })
      const btn = screen.getByTestId('tutorial-btn')
      expect(btn).toBeDisabled()
      expect(btn.querySelector('.fa-spinner')).toBeNull()
      unmount()
    }
  })

  it('spins while its own story is pending, and is disabled while any story is', () => {
    const { rerender } = renderButton({ pendingStoryUuid: 't1' })
    expect(screen.getByTestId('tutorial-btn').querySelector('.fa-spinner')).toBeTruthy()
    rerender(<TutorialButton stories={STORIES} matches={[]} footerState="ready" onStoryClick={vi.fn()} pendingStoryUuid="a1" />)
    const btn = screen.getByTestId('tutorial-btn')
    expect(btn).toBeDisabled()
    expect(btn.querySelector('.fa-spinner')).toBeNull()
  })

  it('shows nothing without a tutorial story', () => {
    const { container } = renderButton({ stories: [ADV, SOON] })
    expect(container.firstChild).toBeNull()
  })
})

describe('HomePage — tutorial button', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.cookie = 'pathsgames.turnstilePass=; max-age=0; path=/'
    getStoriesCatalog.mockResolvedValue(STORIES)
  })

  const renderHome = () => render(<HomeStatusProvider><MemoryRouter><HomePage /></MemoryRouter></HomeStatusProvider>)

  it('opens the start book of the first tutorial story when there is no match yet', async () => {
    listMatches.mockResolvedValue([])
    renderHome()
    const btn = await screen.findByTestId('tutorial-btn')
    await vi.waitFor(() => expect(btn).not.toBeDisabled())
    fireEvent.click(btn)
    expect((await screen.findByTestId('start-book-modal')).textContent).toBe('First steps')
  })

  it('a paused tutorial match: resume, which opens the guest modal like the card does', async () => {
    listMatches.mockResolvedValue([{ uuid: 'm1', storyUuid: 't1', status: 'PAUSED' }])
    renderHome()
    const btn = await screen.findByTestId('tutorial-btn')
    await vi.waitFor(() => expect(btn.textContent).toBe('home.resumeTutorial'))
    await vi.waitFor(() => expect(btn).not.toBeDisabled())
    fireEvent.click(btn)
    expect(mockOpenGuestModal).toHaveBeenCalled()
  })

  it('no button once the tutorial was played to the end', async () => {
    listMatches.mockResolvedValue([{ uuid: 'm1', storyUuid: 't1', status: 'ENDED' }])
    renderHome()
    await screen.findByTestId('catalog')
    await vi.waitFor(() => expect(screen.queryByTestId('tutorial-btn')).toBeNull())
  })
})
