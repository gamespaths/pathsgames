import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DashboardPage from '../../pages/DashboardPage'

// ── Mock API modules ───────────────────────────────────────────
vi.mock('../../api/echoApi', () => ({
  getServerStatus: vi.fn(),
}))
vi.mock('../../api/guestApi', () => ({
  getGuestStats: vi.fn(),
}))
vi.mock('../../api/storyApi', () => ({
  listAllStories: vi.fn(),
}))

import { getServerStatus } from '../../api/echoApi'
import { getGuestStats } from '../../api/guestApi'
import { listAllStories } from '../../api/storyApi'

const MOCK_SERVER_DATA = {
  status: 'OK',
  timestamp: Date.now(),
  properties: { version: '0.17.2' },
}

const MOCK_GUEST_STATS = {
  totalGuests: 10,
  activeGuests: 3,
  expiredGuests: 7,
}

const MOCK_STORIES = [
  { uuid: '1', title: 'Story 1' },
  { uuid: '2', title: 'Story 2' },
]

function renderPage() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>
  )
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getServerStatus.mockResolvedValue(MOCK_SERVER_DATA)
    getGuestStats.mockResolvedValue(MOCK_GUEST_STATS)
    listAllStories.mockResolvedValue(MOCK_STORIES)
  })

  it('shows loading spinner initially', () => {
    // Return a promise that never resolves
    getServerStatus.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByText(/Loading dashboard/i)).toBeInTheDocument()
  })

  it('renders all stats after load', async () => {
    renderPage()
    expect(await screen.findByText('Server Online')).toBeInTheDocument()
    expect(screen.getByText('v0.17.2')).toBeInTheDocument()
    
    // Check Guest stats
    expect(screen.getByText('Total Guests')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('Active Guests')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('Expired Guests')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    
    // Check Story count
    expect(screen.getByText('Stories (all)')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('renders server as Offline if API fails', async () => {
    getServerStatus.mockRejectedValue(new Error('Down'))
    renderPage()
    expect(await screen.findByText('Server Offline')).toBeInTheDocument()
  })

  it('renders quick action links', async () => {
    renderPage()
    expect(await screen.findByText('Quick Actions')).toBeInTheDocument()
    expect(screen.getByText('Manage Guests')).toHaveAttribute('href', '/guests')
    expect(screen.getByText('Manage Stories')).toHaveAttribute('href', '/stories')
    expect(screen.getByText('Import Story')).toHaveAttribute('href', '/stories/import')
    expect(screen.getByText('Server Status')).toHaveAttribute('href', '/echo')
  })
})
