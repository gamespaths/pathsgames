import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import GuestsPage from '../../pages/GuestsPage'

vi.mock('../../api/guestApi', () => ({
  listGuests:          vi.fn(),
  getGuestStats:       vi.fn(),
  deleteGuest:         vi.fn(),
  deleteExpiredGuests: vi.fn(),
}))
vi.mock('../../api/matchApi', () => ({
  listMatches:  vi.fn(),
  getMatchInfo: vi.fn(),
  stopMatch:    vi.fn(),
  pauseMatch:   vi.fn(),
  resumeMatch:  vi.fn(),
}))
vi.mock('../../api/storyApi', () => ({
  getStory:     vi.fn(),
  listEntities: vi.fn(),
}))

import { listGuests, getGuestStats, deleteGuest, deleteExpiredGuests } from '../../api/guestApi'
import { listMatches, getMatchInfo, stopMatch, pauseMatch, resumeMatch } from '../../api/matchApi'
import { getStory, listEntities } from '../../api/storyApi'

const MOCK_STATS  = { totalGuests: 3, activeGuests: 2, expiredGuests: 1 }
const MOCK_GUESTS = [
  {
    userUuid:         'aaa-111-aaa',
    username:         'guest_aaa111aa',
    role:             'PLAYER',
    state:            6,
    expired:          false,
    guestCookieToken: 'tok-1',
    tsRegistration:   '2026-04-01T10:00:00Z',
    tsLastAccess:     '2026-04-10T08:00:00Z',
    guestExpiresAt:   '2026-05-01T10:00:00Z',
  },
  {
    userUuid:         'bbb-222-bbb',
    username:         'guest_bbb222bb',
    role:             'PLAYER',
    state:            6,
    expired:          true,
    guestCookieToken: 'tok-2',
    tsRegistration:   '2026-03-01T10:00:00Z',
    tsLastAccess:     null,
    guestExpiresAt:   '2026-04-01T10:00:00Z',
  },
]

const MOCK_MATCHES = [
  {
    uuid: 'm1-uuid-aaaa', name: 'Dragon Run', storyUuid: 'story-uuid-1',
    userCreatorUuid: 'aaa-111-aaa', status: 'RUNNING',
    singlePlayer: 1, currentClock: 5, expCost: 3, tsInsert: '2026-05-01T10:00:00Z',
  },
  {
    uuid: 'm2-uuid-bbbb', name: 'Night raid', storyUuid: 'story-uuid-2',
    userCreatorUuid: 'bbb-222-bbb', status: 'ENDED',
    singlePlayer: 1, currentClock: 20, expCost: 8, tsInsert: '2026-04-15T10:00:00Z',
  },
]

const MOCK_INFO = {
  match: MOCK_MATCHES[0],
  currentLocationId: 10, currentLocationUuid: 'loc-1',
  locations: [], registry: [], events: [], choices: [],
}

function renderPage() {
  return render(<MemoryRouter><GuestsPage /></MemoryRouter>)
}

describe('GuestsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listGuests.mockResolvedValue(MOCK_GUESTS)
    getGuestStats.mockResolvedValue(MOCK_STATS)
    listMatches.mockResolvedValue(MOCK_MATCHES)
    getMatchInfo.mockResolvedValue(MOCK_INFO)
    stopMatch.mockResolvedValue({})
    pauseMatch.mockResolvedValue({})
    resumeMatch.mockResolvedValue({})
    getStory.mockResolvedValue({ uuid: 'story-uuid-1', title: 'The Dragon Path', author: 'Admin' })
    // v0.28.6 — currentLocationName is gone from /info; the console resolves the
    // location title from the story context (list_locations.idTextName → texts).
    listEntities.mockImplementation((_uuid, kind) => {
      if (kind === 'locations') return Promise.resolve([{ uuid: 'loc-1', id: 10, idTextName: 500 }])
      if (kind === 'texts') return Promise.resolve([{ idText: 500, lang: 'en', shortText: 'Tavern' }])
      return Promise.resolve([])
    })
  })

  it('shows loading spinner initially', () => {
    listGuests.mockReturnValue(new Promise(() => {}))
    getGuestStats.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByText(/Loading guests/i)).toBeInTheDocument()
  })

  it('renders stats cards after load', async () => {
    renderPage()
    expect(await screen.findByText('3')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('renders guest rows', async () => {
    renderPage()
    expect(await screen.findByText('guest_aaa111aa')).toBeInTheDocument()
    expect(screen.getByText('guest_bbb222bb')).toBeInTheDocument()
  })

  it('shows Active/Expired badges correctly', async () => {
    renderPage()
    await screen.findByText('guest_aaa111aa')
    expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Expired').length).toBeGreaterThanOrEqual(1)
  })

  it('filters by username', async () => {
    renderPage()
    await screen.findByText('guest_aaa111aa')
    await userEvent.type(screen.getByPlaceholderText(/Filter by username/i), 'bbb')
    expect(screen.queryByText('guest_aaa111aa')).toBeNull()
    expect(screen.getByText('guest_bbb222bb')).toBeInTheDocument()
  })

  it('opens confirm modal on delete click', async () => {
    renderPage()
    await screen.findByText('guest_aaa111aa')
    await userEvent.click(screen.getAllByTitle('Delete')[0])
    expect(screen.getByText('Delete Guest')).toBeInTheDocument()
  })

  it('does not call deleteGuest when modal is cancelled', async () => {
    renderPage()
    await screen.findByText('guest_aaa111aa')
    await userEvent.click(screen.getAllByTitle('Delete')[0])
    await userEvent.click(screen.getByText('Cancel'))
    expect(deleteGuest).not.toHaveBeenCalled()
  })

  it('calls deleteGuest on confirm', async () => {
    deleteGuest.mockResolvedValue({ status: 'DELETED', uuid: 'aaa-111-aaa' })
    renderPage()
    await screen.findByText('guest_aaa111aa')
    await userEvent.click(screen.getAllByTitle('Delete')[0])
    await userEvent.click(screen.getByText('Confirm'))
    await waitFor(() => expect(deleteGuest).toHaveBeenCalledWith('aaa-111-aaa'))
  })

  it('opens guest detail modal and loads user matches', async () => {
    renderPage()
    await screen.findByText('guest_aaa111aa')
    await userEvent.click(screen.getAllByTitle('View detail')[0])
    // modal title shows username
    const instances = screen.getAllByText('guest_aaa111aa')
    expect(instances.length).toBeGreaterThanOrEqual(2)
    // matches section loads and filters to this user
    expect(await screen.findByText('Dragon Run')).toBeInTheDocument()
    // Night raid belongs to bbb user — must not appear
    expect(screen.queryByText('Night raid')).toBeNull()
  })

  it('shows no-matches message when user has no matches', async () => {
    listMatches.mockResolvedValue([])
    renderPage()
    await screen.findByText('guest_aaa111aa')
    await userEvent.click(screen.getAllByTitle('View detail')[0])
    expect(await screen.findByText('No matches for this user.')).toBeInTheDocument()
  })

  it('opens stacked match detail on eye button click', async () => {
    renderPage()
    await screen.findByText('guest_aaa111aa')
    await userEvent.click(screen.getAllByTitle('View detail')[0])
    await screen.findByText('Dragon Run')
    await userEvent.click(screen.getByTitle('View match detail'))
    await waitFor(() => expect(getMatchInfo).toHaveBeenCalledWith('m1-uuid-aaaa'))
    expect((await screen.findAllByText(/Tavern/)).length).toBeGreaterThan(0)
  })

  it('shows stop button for active match and calls stopMatch', async () => {
    renderPage()
    await screen.findByText('guest_aaa111aa')
    await userEvent.click(screen.getAllByTitle('View detail')[0])
    await screen.findByText('Dragon Run')
    await userEvent.click(screen.getByTitle('Stop match'))
    await waitFor(() => expect(stopMatch).toHaveBeenCalledWith('m1-uuid-aaaa'))
  })

  it('shows pause button for RUNNING match', async () => {
    renderPage()
    await screen.findByText('guest_aaa111aa')
    await userEvent.click(screen.getAllByTitle('View detail')[0])
    await screen.findByText('Dragon Run')
    expect(screen.getByTitle('Pause match')).toBeInTheDocument()
  })

  it('shows resume button for PAUSED match', async () => {
    listMatches.mockResolvedValue([
      { ...MOCK_MATCHES[0], status: 'PAUSED' },
    ])
    renderPage()
    await screen.findByText('guest_aaa111aa')
    await userEvent.click(screen.getAllByTitle('View detail')[0])
    await screen.findByText('Dragon Run')
    expect(screen.getByTitle('Resume match')).toBeInTheDocument()
  })

  it('shows error alert when listGuests fails', async () => {
    listGuests.mockRejectedValue(new Error('API down'))
    renderPage()
    expect(await screen.findByText(/API down/i)).toBeInTheDocument()
  })

  it('calls deleteExpiredGuests on cleanup confirm', async () => {
    deleteExpiredGuests.mockResolvedValue({ status: 'CLEANUP_COMPLETE', deletedCount: 1 })
    renderPage()
    await screen.findByText('guest_aaa111aa')
    await userEvent.click(screen.getByText(/Cleanup Expired/i))
    await userEvent.click(screen.getByText('Confirm'))
    await waitFor(() => expect(deleteExpiredGuests).toHaveBeenCalled())
  })

  it('cancels cleanup modal', async () => {
    renderPage()
    await screen.findByText('guest_aaa111aa')
    await userEvent.click(screen.getByText(/Cleanup Expired/i))
    await userEvent.click(screen.getByText('Cancel'))
    expect(deleteExpiredGuests).not.toHaveBeenCalled()
  })

  it('closes success alert', async () => {
    deleteGuest.mockResolvedValue({ status: 'DELETED' })
    renderPage()
    await screen.findByText('guest_aaa111aa')
    await userEvent.click(screen.getAllByTitle('Delete')[0])
    await userEvent.click(screen.getByText('Confirm'))
    const alert = await screen.findByText(/deleted/i)
    const closeBtn = alert.parentElement.querySelector('button')
    await userEvent.click(closeBtn)
    await waitFor(() => expect(screen.queryByText(/deleted/i)).toBeNull())
  })

  it('closes guest detail modal with Close button', async () => {
    renderPage()
    await screen.findByText('guest_aaa111aa')
    await userEvent.click(screen.getAllByTitle('View detail')[0])
    await screen.findByText('Dragon Run') // wait for modal to fully load
    await userEvent.click(screen.getByText('Close'))
    expect(screen.queryByText('Close')).toBeNull()
  })

  it('calls resumeMatch when resume button is clicked for PAUSED match', async () => {
    listMatches.mockResolvedValue([
      { ...MOCK_MATCHES[0], status: 'PAUSED' },
    ])
    renderPage()
    await screen.findByText('guest_aaa111aa')
    await userEvent.click(screen.getAllByTitle('View detail')[0])
    await screen.findByText('Dragon Run')
    await userEvent.click(screen.getByTitle('Resume match'))
    await waitFor(() => expect(resumeMatch).toHaveBeenCalledWith('m1-uuid-aaaa'))
  })

  it('shows matchError inline when a match action fails', async () => {
    stopMatch.mockRejectedValue(new Error('action-failed'))
    renderPage()
    await screen.findByText('guest_aaa111aa')
    await userEvent.click(screen.getAllByTitle('View detail')[0])
    await screen.findByText('Dragon Run')
    await userEvent.click(screen.getByTitle('Stop match'))
    expect(await screen.findByText(/action-failed/i)).toBeInTheDocument()
  })

  it('shows error in user-matches area when listMatches fails on openGuestDetail', async () => {
    listMatches.mockRejectedValue(new Error('matches-boom'))
    renderPage()
    await screen.findByText('guest_aaa111aa')
    await userEvent.click(screen.getAllByTitle('View detail')[0])
    expect(await screen.findByText(/matches-boom/i)).toBeInTheDocument()
  })

  it('filters guests by userUuid substring', async () => {
    renderPage()
    await screen.findByText('guest_aaa111aa')
    await userEvent.type(screen.getByPlaceholderText(/Filter by username/i), 'bbb-222')
    expect(screen.queryByText('guest_aaa111aa')).toBeNull()
    expect(screen.getByText('guest_bbb222bb')).toBeInTheDocument()
  })

  it('renders untitled match name in the guest detail modal', async () => {
    listMatches.mockResolvedValue([
      { ...MOCK_MATCHES[0], name: null },
    ])
    renderPage()
    await screen.findByText('guest_aaa111aa')
    await userEvent.click(screen.getAllByTitle('View detail')[0])
    // wait for the modal to show the guest name twice (header + table)
    await waitFor(() => expect(screen.getAllByText('guest_aaa111aa').length).toBeGreaterThanOrEqual(2))
    // match with null name renders <em>untitled</em>
    expect(await screen.findByText(/untitled/i)).toBeInTheDocument()
  })

  it('shows error in stacked match detail when getMatchInfo fails', async () => {
    getMatchInfo.mockRejectedValue(new Error('detail-boom'))
    renderPage()
    await screen.findByText('guest_aaa111aa')
    await userEvent.click(screen.getAllByTitle('View detail')[0])
    await screen.findByText('Dragon Run')
    await userEvent.click(screen.getByTitle('View match detail'))
    await waitFor(() => expect(getMatchInfo).toHaveBeenCalledWith('m1-uuid-aaaa'))
    expect(await screen.findByText(/detail-boom/i)).toBeInTheDocument()
  })

  it('closes the stacked match detail modal', async () => {
    renderPage()
    await screen.findByText('guest_aaa111aa')
    await userEvent.click(screen.getAllByTitle('View detail')[0])
    await screen.findByText('Dragon Run')
    await userEvent.click(screen.getByTitle('View match detail'))
    await waitFor(() => expect(getMatchInfo).toHaveBeenCalledWith('m1-uuid-aaaa'))
    const closeButtons = await screen.findAllByText('Close')
    await userEvent.click(closeButtons[closeButtons.length - 1])
    await waitFor(() => expect(screen.queryAllByText('Close').length).toBeLessThan(closeButtons.length))
  })
})
