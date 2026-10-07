import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Navbar from '../components/layout/Navbar'

const mockSetLang = vi.fn()
const mockChangeServer = vi.fn()
const mockNavigate = vi.fn()

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => mockNavigate,
}))

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({
    t: (key) => key,
    lang: 'it',
    setLang: mockSetLang,
  }),
}))

vi.mock('../context/ServerContext', () => ({
  useServer: () => ({
    server: 'http://localhost:8042',
    servers: [
      { label: 'Local (8042)', url: 'http://localhost:8042' },
    ],
    probing: false,
    changeServer: mockChangeServer,
  }),
}))

// v0.37.6 — the home load error the Navbar reports; tests flip it before rendering.
const homeStatus = vi.hoisted(() => ({ error: null }))
vi.mock('@/context/HomeStatusContext', () => ({
  useHomeStatus: () => ({ error: homeStatus.error, setError: vi.fn() }),
}))

const mockOpenGuestModal = vi.fn()
vi.mock('@/features/guest-user/GuestUserContext', () => ({
  useGuestUser: () => ({
    user: { userUuid: 'mock-uuid-0001', username: 'guest_mock0001' },
    loading: false,
    error: null,
    refreshGuest: vi.fn(),
    clearGuest: vi.fn(),
    openGuestModal: mockOpenGuestModal,
    guestModalOpen: false,
    closeGuestModal: vi.fn(),
  }),
}))

function renderNavbar(initialRoute = '/') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Navbar />
    </MemoryRouter>
  )
}

describe('Navbar', () => {
  it('renders brand link', () => {
    renderNavbar()
    expect(screen.getByText('nav.brand')).toBeInTheDocument()
  })

  it('renders user button with guest username as title', () => {
    renderNavbar()
    expect(screen.getByTitle('guest_mock0001')).toBeInTheDocument()
  })

  it('user button shows nav.guest label', () => {
    renderNavbar()
    const btn = screen.getByTitle('guest_mock0001')
    expect(btn.tagName).toBe('BUTTON')
    expect(btn).toHaveTextContent('nav.guest')
  })

  it('guest button calls openGuestModal on click', () => {
    renderNavbar()
    fireEvent.click(screen.getByTitle('guest_mock0001'))
    expect(mockOpenGuestModal).toHaveBeenCalledOnce()
  })

  it('does not show exit button on home page', () => {
    renderNavbar('/')
    expect(screen.queryByText('game.exitToHome')).toBeNull()
  })

  it('shows exit button on play page', () => {
    renderNavbar('/play/123')
    expect(screen.getByText('game.exitToHome')).toBeInTheDocument()
  })

  it('exit button navigates back home', () => {
    renderNavbar('/play/123')
    fireEvent.click(screen.getByText('game.exitToHome'))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('renders the three social links with their targets', () => {
    renderNavbar()
    expect(screen.getByTitle('nav.instagram')).toHaveAttribute('href', 'https://www.instagram.com/pathsgames/')
    expect(screen.getByTitle('nav.youtube')).toHaveAttribute(
      'href', 'https://www.youtube.com/channel/UCbrfVJJDmX-iBda6WhURPkQ')
    expect(screen.getByTitle('nav.x')).toHaveAttribute('href', 'https://x.com/PathsGames')
  })

  it('social links open in a new tab', () => {
    renderNavbar()
    const link = screen.getByTitle('nav.instagram')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener')
    expect(link).toHaveAttribute('aria-label', 'nav.instagram')
  })

  it('social row is not marked tight on the home page', () => {
    const { container } = renderNavbar('/')
    expect(container.querySelector('.navbar-social')).not.toHaveClass('navbar-social--tight')
  })

  it('social row is marked tight on a play page, where the exit button takes the room', () => {
    const { container } = renderNavbar('/play/123')
    expect(container.querySelector('.navbar-social')).toHaveClass('navbar-social--tight')
  })

  // v0.37.6 — home load errors surface here with a refresh button.
  it('shows nothing about errors while the home is fine', () => {
    homeStatus.error = null
    const { container } = renderNavbar('/')
    expect(container.querySelector('.navbar-error')).toBeNull()
  })

  it('shows the home error with a refresh button that reloads the page', () => {
    homeStatus.error = 'matches'
    const reload = vi.fn()
    const original = window.location
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, reload } })
    try {
      const { container } = renderNavbar('/')
      expect(container.querySelector('.navbar-error')).toHaveAttribute('role', 'alert')
      expect(screen.getByText('nav.error.matches')).toBeInTheDocument()
      fireEvent.click(screen.getByText('nav.refresh'))
      expect(reload).toHaveBeenCalledOnce()
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original })
      homeStatus.error = null
    }
  })

  it('names the antibot and stories failures too', () => {
    homeStatus.error = 'antibot'
    const { unmount } = renderNavbar('/')
    expect(screen.getByText('nav.error.antibot')).toBeInTheDocument()
    unmount()
    homeStatus.error = 'stories'
    renderNavbar('/')
    expect(screen.getByText('nav.error.stories')).toBeInTheDocument()
    homeStatus.error = null
  })
})
