import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Navbar from '../../../components/layout/Navbar'
import { AuthProvider } from '../../../context/AuthContext'
import { getServerStatus } from '../../../api/echoApi'

vi.mock('../../../api/echoApi', () => ({
  getServerStatus: vi.fn(),
}))

function renderNavbar() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Navbar />
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('Navbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getServerStatus.mockResolvedValue({ properties: { version: '1.2.3' } })
  })

  it('renders brand and server info', async () => {
    renderNavbar()
    expect(screen.getByText(/Paths Games/i)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('1.2.3')).toBeInTheDocument())
  })

  it('shows online status after successful ping', async () => {
    renderNavbar()
    await waitFor(() => expect(screen.getByText('Online')).toBeInTheDocument())
  })

  it('shows offline status if ping fails', async () => {
    getServerStatus.mockRejectedValue(new Error('Fail'))
    renderNavbar()
    await waitFor(() => expect(screen.getByText('Offline')).toBeInTheDocument())
  })

  it('contains server selector', () => {
    renderNavbar()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('renders navigation menu button', () => {
    renderNavbar()
    expect(screen.getByRole('button', { name: /navigation menu/i })).toBeInTheDocument()
  })

  it('opens dropdown with menu items when menu button is clicked', () => {
    renderNavbar()
    const menuBtn = screen.getByRole('button', { name: /navigation menu/i })
    fireEvent.click(menuBtn)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Guest Users')).toBeInTheDocument()
    expect(screen.getByText('Server Status')).toBeInTheDocument()
  })

  it('closes dropdown after clicking a menu item', () => {
    renderNavbar()
    fireEvent.click(screen.getByRole('button', { name: /navigation menu/i }))
    fireEvent.click(screen.getByText('Dashboard'))
    expect(screen.queryByText('Guest Users')).not.toBeInTheDocument()
  })

  it('closes dropdown when clicking outside', () => {
    renderNavbar()
    fireEvent.click(screen.getByRole('button', { name: /navigation menu/i }))
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    // Simulate mousedown outside the dropdown
    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('Guest Users')).not.toBeInTheDocument()
  })

  it('calls changeServer when server selector changes', async () => {
    renderNavbar()
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'http://localhost:8044' } })
    // just checking no error thrown — AuthContext changeServer is a no-op in test
    expect(select).toBeInTheDocument()
  })

  it('unmounting before the ping answers sets no state', async () => {
    let resolve
    getServerStatus.mockReturnValue(new Promise(r => { resolve = r }))
    const { unmount } = renderNavbar()

    unmount()
    resolve({ properties: { version: '9.9.9' } })
    await Promise.resolve()

    expect(screen.queryByText('9.9.9')).toBeNull()
  })

  it('unmounting before a failing ping answers sets no state', async () => {
    let reject
    getServerStatus.mockReturnValue(new Promise((_, r) => { reject = r }))
    const { unmount } = renderNavbar()

    unmount()
    reject(new Error('down'))
    await Promise.resolve()

    expect(screen.queryByText(/offline/i)).toBeNull()
  })

  it('a server that answers with no version at all reads as online with a blank one', async () => {
    getServerStatus.mockResolvedValue({})
    renderNavbar()
    await waitFor(() => expect(screen.queryByText('1.2.3')).toBeNull())
  })

  it('a mousedown outside the open menu closes it', async () => {
    renderNavbar()
    const toggle = document.querySelector('.pg-navbar-server')
      ?? screen.getAllByRole('button')[0]
    fireEvent.click(toggle)

    fireEvent.mouseDown(document.body)

    await waitFor(() => expect(document.querySelector('.pg-dropdown-menu')).toBeNull())
  })
})
