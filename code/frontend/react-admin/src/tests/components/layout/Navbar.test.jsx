import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
})
