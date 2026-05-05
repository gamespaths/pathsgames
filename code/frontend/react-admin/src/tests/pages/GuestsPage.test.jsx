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
import { listGuests, getGuestStats, deleteGuest, deleteExpiredGuests } from '../../api/guestApi'

const MOCK_STATS = { totalGuests: 3, activeGuests: 2, expiredGuests: 1 }
const MOCK_GUESTS = [
  {
    userUuid:       'aaa-111-aaa',
    username:       'guest_aaa111aa',
    role:           'PLAYER',
    state:          6,
    expired:        false,
    guestCookieToken: 'tok-1',
    tsRegistration: '2026-04-01T10:00:00Z',
    tsLastAccess:   '2026-04-10T08:00:00Z',
    guestExpiresAt: '2026-05-01T10:00:00Z',
  },
  {
    userUuid:       'bbb-222-bbb',
    username:       'guest_bbb222bb',
    role:           'PLAYER',
    state:          6,
    expired:        true,
    guestCookieToken: 'tok-2',
    tsRegistration: '2026-03-01T10:00:00Z',
    tsLastAccess:   null,
    guestExpiresAt: '2026-04-01T10:00:00Z',
  },
]

function renderPage() {
  return render(<MemoryRouter><GuestsPage /></MemoryRouter>)
}

describe('GuestsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listGuests.mockResolvedValue(MOCK_GUESTS)
    getGuestStats.mockResolvedValue(MOCK_STATS)
  })

  it('shows loading spinner initially', () => {
    listGuests.mockReturnValue(new Promise(() => {}))
    getGuestStats.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByText(/Loading guests/i)).toBeInTheDocument()
  })

  it('renders stats cards after load', async () => {
    renderPage()
    expect(await screen.findByText('3')).toBeInTheDocument() // totalGuests
    expect(screen.getByText('2')).toBeInTheDocument()        // activeGuests
    expect(screen.getByText('1')).toBeInTheDocument()        // expiredGuests
  })

  it('renders guest rows', async () => {
    renderPage()
    expect(await screen.findByText('guest_aaa111aa')).toBeInTheDocument()
    expect(screen.getByText('guest_bbb222bb')).toBeInTheDocument()
  })

  it('shows Active/Expired badges correctly', async () => {
    renderPage()
    await screen.findByText('guest_aaa111aa')
    // each badge text may appear in multiple elements (icon + text node)
    expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Expired').length).toBeGreaterThanOrEqual(1)
  })

  it('filters by username', async () => {
    renderPage()
    await screen.findByText('guest_aaa111aa')
    const input = screen.getByPlaceholderText(/Filter by username/i)
    await userEvent.type(input, 'bbb')
    expect(screen.queryByText('guest_aaa111aa')).toBeNull()
    expect(screen.getByText('guest_bbb222bb')).toBeInTheDocument()
  })

  it('opens confirm modal on delete click', async () => {
    renderPage()
    await screen.findByText('guest_aaa111aa')
    const deleteButtons = screen.getAllByTitle('Delete')
    await userEvent.click(deleteButtons[0])
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

  it('opens detail modal on eye click', async () => {
    renderPage()
    await screen.findByText('guest_aaa111aa')
    await userEvent.click(screen.getAllByTitle('View detail')[0])
    // modal shows the username as a heading
    const instances = screen.getAllByText('guest_aaa111aa')
    expect(instances.length).toBeGreaterThanOrEqual(2) // table row + modal
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

  it('closes detail modal with Close button', async () => {
    renderPage()
    await screen.findByText('guest_aaa111aa')
    await userEvent.click(screen.getAllByTitle('View detail')[0])
    const closeBtn = screen.getByText('Close')
    await userEvent.click(closeBtn)
    expect(screen.queryByText('Close')).toBeNull()
  })
})
