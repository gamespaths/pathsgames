import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Navbar from '../components/layout/Navbar'
import { HomeButtonProvider, useHomeButtonHandler } from '../context/HomeButtonContext'

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

vi.mock('@/features/guest-user/GuestUserContext', () => ({
  useGuestUser: () => ({
    user: { userUuid: 'mock-uuid-0001', username: 'guest_mock0001' },
    loading: false,
    error: null,
    refreshGuest: vi.fn(),
    clearGuest: vi.fn(),
    setMatches: vi.fn(),
  }),
}))

function renderNavbar(initialRoute = '/', handler = null) {
  function Page() { useHomeButtonHandler(handler); return null }
  return render(
    <HomeButtonProvider>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Page />
        <Navbar />
      </MemoryRouter>
    </HomeButtonProvider>
  )
}

describe('Navbar', () => {
  it('renders brand link', () => {
    renderNavbar()
    expect(screen.getByText('nav.brand')).toBeInTheDocument()
  })

  const userBtn = () => document.querySelector('.nav-user-btn')

  it('renders user button with guest username as drawn tooltip', () => {
    renderNavbar()
    expect(userBtn()).toHaveAttribute('data-tip', 'guest_mock0001')
    expect(userBtn()).not.toHaveAttribute('title')
  })

  it('user button shows nav.guest label', () => {
    renderNavbar()
    const btn = userBtn()
    expect(btn.tagName).toBe('BUTTON')
    expect(btn).toHaveTextContent('nav.guest')
  })

  it('v1.13.0 — the user button opens /player', () => {
    mockNavigate.mockClear()
    renderNavbar()
    fireEvent.click(userBtn())
    expect(mockNavigate).toHaveBeenCalledWith('/player')
  })

  it('also in a match: a push, so Back returns to the match', () => {
    mockNavigate.mockClear()
    renderNavbar('/play/123')
    fireEvent.click(userBtn())
    expect(mockNavigate).toHaveBeenCalledWith('/player')
  })

  it('on /player already it replaces the entry instead of stacking a second one', () => {
    mockNavigate.mockClear()
    renderNavbar('/player')
    fireEvent.click(userBtn())
    expect(mockNavigate).toHaveBeenCalledWith('/player', { replace: true })
  })

  it('v1.13.0 — no close button and no "Exit to Home" on any route', () => {
    for (const route of ['/', '/play/123', '/story/s1', '/start-match/s1', '/player']) {
      const { container, unmount } = renderNavbar(route)
      expect(screen.queryByText('game.exitToHome')).toBeNull()
      expect(container.querySelector('.navbar-home-btn')).toBeNull()
      expect(container.querySelector('.navbar-social--tight')).toBeNull()
      expect(container.querySelector('.book-close-btn')).toBeNull()
      unmount()
    }
  })

  it('renders the three social links with their targets', () => {
    renderNavbar()
    expect(screen.getByLabelText('nav.instagram')).toHaveAttribute('href', 'https://www.instagram.com/pathsgames/')
    expect(screen.getByLabelText('nav.youtube')).toHaveAttribute(
      'href', 'https://www.youtube.com/channel/UCbrfVJJDmX-iBda6WhURPkQ')
    expect(screen.getByLabelText('nav.x')).toHaveAttribute('href', 'https://x.com/PathsGames')
  })

  it('social links open in a new tab, with a drawn tooltip', () => {
    renderNavbar()
    const link = screen.getByLabelText('nav.instagram')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener')
    expect(link).toHaveAttribute('data-tip', 'nav.instagram')
    expect(link).not.toHaveAttribute('title')
  })

  it('step 15 — brand without a handler off the Home goes home in the app (no reload: the book changes)', () => {
    mockNavigate.mockClear()
    renderNavbar('/story/s1')
    const brand = screen.getByText('nav.brand').closest('a')
    expect(brand).toHaveAttribute('href', '/')
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    brand.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('step 15 — on the Home the brand keeps its full load; a new tab or window keeps the link', () => {
    mockNavigate.mockClear()
    const { unmount } = renderNavbar('/')
    const home = new MouseEvent('click', { bubbles: true, cancelable: true })
    screen.getByText('nav.brand').closest('a').dispatchEvent(home)
    expect(home.defaultPrevented).toBe(false)
    unmount()
    renderNavbar('/play/123', vi.fn())
    const brand = screen.getByText('nav.brand').closest('a')
    for (const init of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
      const click = new MouseEvent('click', { bubbles: true, cancelable: true, ...init })
      brand.dispatchEvent(click)
      expect(click.defaultPrevented).toBe(false)
    }
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('brand with a handler (a running match) prevents the reload and runs it', () => {
    const handler = vi.fn()
    renderNavbar('/play/123', handler)
    const brand = screen.getByText('nav.brand').closest('a')
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    brand.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)
    expect(handler).toHaveBeenCalledOnce()
  })

  describe('--navbar-h', () => {
    afterEach(() => {
      delete globalThis.ResizeObserver
      document.documentElement.style.removeProperty('--navbar-h')
    })

    it('without a ResizeObserver (jsdom) the CSS fallback stays', () => {
      delete globalThis.ResizeObserver
      renderNavbar()
      expect(document.documentElement.style.getPropertyValue('--navbar-h')).toBe('')
    })

    it('writes the real height on <html>, follows its changes, and drops it on unmount', () => {
      let notify = null
      const disconnect = vi.fn()
      globalThis.ResizeObserver = class { constructor(cb) { notify = cb } observe() {} disconnect() { disconnect() } }
      const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
        .mockReturnValue({ height: 72.4, width: 0, top: 0, left: 0, right: 0, bottom: 72.4 })
      const { unmount } = renderNavbar()
      expect(document.documentElement.style.getPropertyValue('--navbar-h')).toBe('72px')
      rect.mockReturnValue({ height: 0 })
      notify()
      expect(document.documentElement.style.getPropertyValue('--navbar-h')).toBe('72px')
      rect.mockReturnValue({ height: 118 })
      notify()
      expect(document.documentElement.style.getPropertyValue('--navbar-h')).toBe('118px')
      unmount()
      expect(disconnect).toHaveBeenCalled()
      expect(document.documentElement.style.getPropertyValue('--navbar-h')).toBe('')
      rect.mockRestore()
    })
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
