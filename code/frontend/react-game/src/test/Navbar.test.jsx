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

  it('renders IT and EN language buttons', () => {
    renderNavbar()
    expect(screen.getByTitle('Italiano')).toBeInTheDocument()
    expect(screen.getByTitle('English')).toBeInTheDocument()
  })

  it('calls setLang when EN button clicked', () => {
    renderNavbar()
    fireEvent.click(screen.getByTitle('English'))
    expect(mockSetLang).toHaveBeenCalledWith('en')
  })

  it('renders guest button', () => {
    renderNavbar()
    expect(screen.getByText('nav.guest')).toBeInTheDocument()
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
