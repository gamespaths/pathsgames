import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import EchoPage from '../../pages/EchoPage'

// ── Mock API module ────────────────────────────────────────────
vi.mock('../../api/echoApi', () => ({
  getServerStatus: vi.fn(),
}))
import { getServerStatus } from '../../api/echoApi'

const MOCK_DATA = {
  status: 'OK',
  timestamp: 1625097600000, // 2021-07-01
  properties: {
    env: 'development',
    version: '0.17.2',
    port: '8042'
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <EchoPage />
    </MemoryRouter>
  )
}

describe('EchoPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getServerStatus.mockResolvedValue(MOCK_DATA)
  })

  it('shows loading spinner initially', () => {
    getServerStatus.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByText(/Pinging server/i)).toBeInTheDocument()
  })

  it('renders status info after load', async () => {
    renderPage()
    expect(await screen.findByText('Server Online')).toBeInTheDocument()
    expect(screen.getByText('OK')).toBeInTheDocument()
    expect(screen.getByText('development')).toBeInTheDocument()
    expect(screen.getByText('0.17.2')).toBeInTheDocument()
    expect(screen.getByText('8042')).toBeInTheDocument()
  })

  it('shows error message on failure', async () => {
    getServerStatus.mockRejectedValue(new Error('Connection Refused'))
    renderPage()
    expect(await screen.findByText('Server Offline')).toBeInTheDocument()
    expect(screen.getByText(/Connection Refused/i)).toBeInTheDocument()
  })

  it('reloads data when Refresh button is clicked', async () => {
    renderPage()
    await screen.findByText('Server Online')
    
    getServerStatus.mockResolvedValue({ ...MOCK_DATA, status: 'RELOADED' })
    const refreshBtn = screen.getByText(/Refresh/i)
    fireEvent.click(refreshBtn)
    
    expect(screen.getByText(/Checking/i)).toBeInTheDocument()
    expect(await screen.findByText('RELOADED')).toBeInTheDocument()
    expect(getServerStatus).toHaveBeenCalledTimes(2)
  })

  it('renders raw JSON response', async () => {
    renderPage()
    await screen.findByText('Server Online')
    expect(screen.getByText(/Raw Response/i)).toBeInTheDocument()
    // The JSON string should be present in the pre tag
    const pre = screen.getByText((content, element) => {
      return element.tagName.toLowerCase() === 'pre' && content.includes('"status": "OK"')
    })
    expect(pre).toBeInTheDocument()
  })
})
