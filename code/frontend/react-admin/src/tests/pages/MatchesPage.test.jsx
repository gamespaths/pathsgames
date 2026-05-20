import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import MatchesPage from '../../pages/MatchesPage'

vi.mock('../../api/matchApi', () => ({
  listMatches:  vi.fn(),
  getMatchInfo: vi.fn(),
}))
import { listMatches, getMatchInfo } from '../../api/matchApi'

const MOCK_MATCHES = [
  {
    uuid: 'm1-uuid-aaaa', name: 'Saturday run', storyUuid: 'story-1-uuid',
    difficultyUuid: 'd1', status: 'CREATED', singlePlayer: 1,
    currentClock: 0, expCost: 5, tsInsert: '2026-05-20T10:00:00Z',
  },
  {
    uuid: 'm2-uuid-bbbb', name: 'Night raid', storyUuid: 'story-2-uuid',
    difficultyUuid: 'd2', status: 'RUNNING', singlePlayer: 0,
    currentClock: 12, expCost: 8, tsInsert: '2026-05-19T10:00:00Z',
  },
]

const MOCK_INFO = {
  match: MOCK_MATCHES[0],
  currentLocationId: 10, currentLocationUuid: 'loc-1', currentLocationName: 'Tavern',
  locations: [{ idLocation: 10, uuid: 'loc-1', flagAlreadyActived: 0, clockCounter: 3 }],
  registry: [{ uuid: 'r1', key: 'act_1_done', intValue: 0, stringValue: null }],
  events: [], choices: [],
}

function renderPage() {
  return render(<MemoryRouter><MatchesPage /></MemoryRouter>)
}

describe('MatchesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listMatches.mockResolvedValue(MOCK_MATCHES)
    getMatchInfo.mockResolvedValue(MOCK_INFO)
  })

  it('shows loading spinner initially', () => {
    listMatches.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByText(/Loading matches/i)).toBeInTheDocument()
  })

  it('renders match rows after load', async () => {
    renderPage()
    expect(await screen.findByText('Saturday run')).toBeInTheDocument()
    expect(screen.getByText('Night raid')).toBeInTheDocument()
  })

  it('renders stats cards', async () => {
    renderPage()
    await screen.findByText('Saturday run')
    expect(screen.getByText('Total')).toBeInTheDocument()
    expect(screen.getByText('Running')).toBeInTheDocument()
  })

  it('filters by name', async () => {
    renderPage()
    await screen.findByText('Saturday run')
    await userEvent.type(screen.getByPlaceholderText(/Filter by name/i), 'night')
    expect(screen.queryByText('Saturday run')).toBeNull()
    expect(screen.getByText('Night raid')).toBeInTheDocument()
  })

  it('filters by status', async () => {
    renderPage()
    await screen.findByText('Saturday run')
    await userEvent.selectOptions(screen.getByLabelText('Filter by status'), 'RUNNING')
    expect(screen.queryByText('Saturday run')).toBeNull()
    expect(screen.getByText('Night raid')).toBeInTheDocument()
  })

  it('opens the detail modal and loads match info', async () => {
    renderPage()
    await screen.findByText('Saturday run')
    await userEvent.click(screen.getAllByTitle('View detail')[0])
    await waitFor(() => expect(getMatchInfo).toHaveBeenCalledWith('m1-uuid-aaaa'))
    expect(await screen.findByText(/Tavern/)).toBeInTheDocument()
    expect(screen.getByText('act_1_done')).toBeInTheDocument()
  })

  it('shows an error alert when listMatches fails', async () => {
    listMatches.mockRejectedValue(new Error('API down'))
    renderPage()
    expect(await screen.findByText(/API down/i)).toBeInTheDocument()
  })

  it('closes the detail modal', async () => {
    renderPage()
    await screen.findByText('Saturday run')
    await userEvent.click(screen.getAllByTitle('View detail')[0])
    await screen.findByText(/Tavern/)
    await userEvent.click(screen.getByText('Close'))
    await waitFor(() => expect(screen.queryByText('Close')).toBeNull())
  })

  it('shows empty state when there are no matches', async () => {
    listMatches.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText('No matches found.')).toBeInTheDocument()
  })
})
