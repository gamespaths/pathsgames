import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import GuestsPage from '../../pages/GuestsPage'
import StoriesPage from '../../pages/story/StoriesPage'

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
  getStory:      vi.fn(),
  listEntities:  vi.fn(),
  listAllStories: vi.fn(),
  deleteStory:   vi.fn(),
  importStory:   vi.fn(),
  exportStory:   vi.fn(),
  createStory:   vi.fn(),
}))

import { listGuests, getGuestStats, deleteGuest } from '../../api/guestApi'
import { listMatches, getMatchInfo, pauseMatch } from '../../api/matchApi'
import { getStory, listEntities, listAllStories } from '../../api/storyApi'

/**
 * The guests console and the story list against sparse or failing payloads: a
 * guest whose fields are null/false, a matches endpoint that answers with
 * something that is not a list, and stories with no title, author or counters.
 */

const GUEST = {
  userUuid: 'aaa-111-aaa', username: 'guest_aaa', role: 'PLAYER',
  expired: false, guestCookieToken: null, state: 6,
}

describe('GuestsPage edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // v0.36.2 — the endpoint answers the paged envelope, not a bare array.
    listGuests.mockResolvedValue({ items: [GUEST], nextCursor: null, limit: 50 })
    getGuestStats.mockResolvedValue({ totalGuests: 1, activeGuests: 1, expiredGuests: 0 })
    listMatches.mockResolvedValue(null)     // not an envelope
    getMatchInfo.mockResolvedValue({ match: {}, locations: [], registry: [] })
    getStory.mockResolvedValue({})
    listEntities.mockResolvedValue([])
  })

  it('reports a guests failure that carries no message', async () => {
    listGuests.mockRejectedValue({})
    render(<MemoryRouter><GuestsPage /></MemoryRouter>)
    expect(await screen.findByText('Failed to load guests')).toBeInTheDocument()
  })

  it('keeps going when only the stats call fails', async () => {
    getGuestStats.mockRejectedValue(new Error('no stats'))
    render(<MemoryRouter><GuestsPage /></MemoryRouter>)
    expect(await screen.findByText('guest_aaa')).toBeInTheDocument()
    expect(screen.queryByText('no stats')).not.toBeInTheDocument()
  })

  it('renders null and boolean guest fields in the detail modal, and no matches', async () => {
    render(<MemoryRouter><GuestsPage /></MemoryRouter>)
    await screen.findByText('guest_aaa')

    await userEvent.click(screen.getByTitle(/View detail/i))

    expect(await screen.findByText('No matches for this user.')).toBeInTheDocument()
    expect(screen.getByText('null')).toBeInTheDocument()   // guestCookieToken
    expect(screen.getByText('false')).toBeInTheDocument()  // expired

    // The panel swallows its own clicks; the backdrop closes.
    await userEvent.click(screen.getByText('guest_aaa', { selector: '.pg-modal-title' }))
    expect(screen.getByText('No matches for this user.')).toBeInTheDocument()
    fireEvent.click(document.querySelector('.pg-modal-backdrop'))
    await waitFor(() => expect(screen.queryByText('No matches for this user.')).not.toBeInTheDocument())
  })

  it('reports a failure of the per-guest matches call', async () => {
    listMatches.mockRejectedValue(new Error('matches down'))
    render(<MemoryRouter><GuestsPage /></MemoryRouter>)
    await screen.findByText('guest_aaa')

    await userEvent.click(screen.getByTitle(/View detail/i))
    expect(await screen.findByText('matches down')).toBeInTheDocument()
  })

  it('pauses a running match of the guest and reports a refusal', async () => {
    listMatches.mockResolvedValue({
      items: [{ uuid: 'm1', name: 'Run', status: 'RUNNING', userCreatorUuid: GUEST.userUuid }],
      nextCursor: null, limit: 50,
    })
    pauseMatch.mockRejectedValue({ response: { data: { message: 'cannot pause' } } })
    render(<MemoryRouter><GuestsPage /></MemoryRouter>)
    await screen.findByText('guest_aaa')

    await userEvent.click(screen.getByTitle(/View detail/i))
    await userEvent.click(await screen.findByTitle('Pause match'))

    expect(await screen.findByText('cannot pause')).toBeInTheDocument()
    const alert = screen.getByText('cannot pause').closest('.pg-alert')
    await userEvent.click(alert.querySelector('button'))
    expect(screen.queryByText('cannot pause')).not.toBeInTheDocument()
  })

  it('surfaces a delete failure on the page alert', async () => {
    deleteGuest.mockRejectedValue(new Error('guest is in a match'))
    render(<MemoryRouter><GuestsPage /></MemoryRouter>)
    await screen.findByText('guest_aaa')

    await userEvent.click(screen.getByTitle('Delete'))
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(await screen.findByText('guest is in a match')).toBeInTheDocument()
    const alert = screen.getByText('guest is in a match').closest('.pg-alert')
    await userEvent.click(alert.querySelector('button'))
    expect(screen.queryByText('guest is in a match')).not.toBeInTheDocument()
  })
})

describe('StoriesPage with bare stories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listAllStories.mockResolvedValue([{ uuid: 'story-1' }])   // no title, author, visibility, counters
  })

  it('dashes out every column the story does not carry', async () => {
    render(<MemoryRouter><StoriesPage /></MemoryRouter>)

    expect(await screen.findByText('Untitled')).toBeInTheDocument()
    const row = screen.getByText('Untitled').closest('tr')
    const cells = row.querySelectorAll('td')
    expect(cells[1]).toHaveTextContent('—')   // author
    expect(cells[2]).toHaveTextContent('—')   // visibility
    expect(cells[3]).toHaveTextContent('—')   // priority
    expect(cells[4]).toHaveTextContent('—')   // peghi
  })
})
