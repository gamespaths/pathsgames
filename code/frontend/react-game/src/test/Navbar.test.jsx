import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Navbar from '../components/layout/Navbar'

const mockSetLang = vi.fn()
const mockChangeServer = vi.fn()

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({
    t: (key) => key,
    lang: 'it',
    setLang: mockSetLang,
  }),
}))

vi.mock('../context/ServerContext', () => ({
  useServer: () => ({
    server: 'mock',
    servers: [
      { label: 'Mock (offline)', url: 'mock' },
      { label: 'Local (8042)', url: 'http://localhost:8042' },
    ],
    probing: false,
    changeServer: mockChangeServer,
  }),
  MOCK_SERVER: 'mock',
}))

const mockOpenGuestModal = vi.fn()
vi.mock('../context/GuestUserContext', () => ({
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
})
