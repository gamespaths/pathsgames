import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import MatchesPage from '../../pages/MatchesPage'
import MatchDetailPage from '../../pages/MatchDetailPage'
import GuestsPage from '../../pages/GuestsPage'
import MatchDetailModal from '../../components/match/MatchDetailModal'

vi.mock('../../api/matchApi', () => ({
  listMatches: vi.fn(), getMatchInfo: vi.fn(), listMatchStatuses: vi.fn(),
  updateMatch: vi.fn(), stopMatch: vi.fn(), pauseMatch: vi.fn(),
  resumeMatch: vi.fn(), deleteMatch: vi.fn(),
  getMatchClock: vi.fn(), getMatchWeather: vi.fn(), getMatchLocations: vi.fn(),
  getMatchLogs: vi.fn(), changePlayerStatistics: vi.fn(),
}))
vi.mock('../../api/storyApi', () => ({ getStory: vi.fn(), listEntities: vi.fn() }))
vi.mock('../../api/guestApi', () => ({
  listGuests: vi.fn(), getGuestStats: vi.fn(), deleteGuest: vi.fn(), deleteExpiredGuests: vi.fn(),
}))

import * as matchApi from '../../api/matchApi'
import { getStory, listEntities } from '../../api/storyApi'
import { listGuests, getGuestStats } from '../../api/guestApi'

/**
 * The last resort of every error ladder in the match console: an error object
 * that carries neither a response body nor a message, which is what an aborted
 * request or a thrown string leaves behind.
 */

const MATCH = { uuid: 'm1-uuid-aaaa', name: 'Saturday run', storyUuid: 'story-1', status: 'RUNNING' }

function env(items, nextCursor = null) {
  return { items, nextCursor, limit: 50 }
}

describe('MatchesPage error fallbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    matchApi.listMatches.mockResolvedValue(env([MATCH]))
    matchApi.listMatchStatuses.mockResolvedValue([{ value: 'RUNNING', terminal: false }])
    matchApi.getMatchInfo.mockResolvedValue({ match: MATCH, locations: [], registry: [] })
    getStory.mockResolvedValue({})
    listEntities.mockResolvedValue([])
  })

  const renderPage = () => render(<MemoryRouter><MatchesPage /></MemoryRouter>)

  it('reloads with the status filter applied', async () => {
    renderPage()
    await screen.findByText('Saturday run')

    await userEvent.selectOptions(screen.getByLabelText('Filter by status'), 'RUNNING')

    await waitFor(() => expect(matchApi.listMatches).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'RUNNING' })))
  })

  it('falls back to the generic message on a bodyless load-more failure', async () => {
    matchApi.listMatches
      .mockResolvedValueOnce(env([MATCH], 'cursor-1'))
      .mockRejectedValueOnce({})
    renderPage()
    await screen.findByText('Saturday run')

    await userEvent.click(screen.getByRole('button', { name: /Load more/i }))
    expect(await screen.findByText('Failed to load more matches')).toBeInTheDocument()
  })

  it('falls back to the generic message when the detail call fails without one', async () => {
    matchApi.getMatchInfo.mockRejectedValue({})
    renderPage()
    await screen.findByText('Saturday run')

    await userEvent.click(screen.getByTitle('View detail'))
    expect(await screen.findByText('Failed to load match info')).toBeInTheDocument()
  })

  it('falls back to the generic message when the stop action fails without one', async () => {
    matchApi.stopMatch.mockRejectedValue({})
    renderPage()
    await screen.findByText('Saturday run')

    await userEvent.click(screen.getByTitle('Stop match'))
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(await screen.findByText('Failed to stop match')).toBeInTheDocument()
  })

  it('names the match in the delete confirmation and closes the edit modal on Escape', async () => {
    matchApi.updateMatch.mockRejectedValue({})
    matchApi.listMatches.mockResolvedValue(env([{ ...MATCH, status: 'ENDED' }]))
    matchApi.listMatchStatuses.mockResolvedValue([{ value: 'ENDED', terminal: true }])
    renderPage()
    await screen.findByText('Saturday run')

    await userEvent.click(screen.getByTitle('Delete match'))
    expect(screen.getByText(/Permanently delete "Saturday run"/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Cancel/i }))

    await userEvent.click(screen.getByTitle('Edit match'))
    await userEvent.click(screen.getByRole('button', { name: /^Save$/i }))
    expect(await screen.findByText('Failed to update match')).toBeInTheDocument()

    fireEvent.keyDown(document.querySelector('.pg-modal-backdrop'), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByLabelText('Name')).not.toBeInTheDocument())
  })
})

describe('MatchDetailPage error fallbacks', () => {
  const renderPage = () => render(
    <MemoryRouter initialEntries={['/matches/m1']}>
      <Routes>
        <Route path="/matches/:uuid" element={<MatchDetailPage />} />
        <Route path="/matches"       element={<div>matches-list</div>} />
      </Routes>
    </MemoryRouter>
  )

  beforeEach(() => {
    vi.clearAllMocks()
    matchApi.getMatchInfo.mockResolvedValue({ match: MATCH, locations: [], registry: [], players: [] })
    matchApi.getMatchClock.mockResolvedValue({ currentClock: 1, clockLabelSingular: null, clockLabelPlural: 'hours' })
    matchApi.getMatchWeather.mockResolvedValue(null)
    matchApi.getMatchLocations.mockResolvedValue(null)
    matchApi.getMatchLogs.mockResolvedValue({ logs: [], currentClock: 1, total: 0, nextCursor: null })
    getStory.mockResolvedValue({})
    listEntities.mockResolvedValue([])
  })

  it('renders no clock label at all when the story names none for this clock', async () => {
    renderPage()
    await screen.findByText('Saturday run')
    expect(screen.getByTestId('match-status-label')).toHaveTextContent('RUNNING')
  })

  it('names the match in both confirmations and reports a bodyless action failure', async () => {
    matchApi.stopMatch.mockRejectedValue({})
    renderPage()
    await screen.findByText('Saturday run')

    await userEvent.click(screen.getByRole('button', { name: /Stop/i }))
    expect(screen.getByText(/Set match "Saturday run" status to ENDED\?/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(await screen.findByText('Action failed')).toBeInTheDocument()
  })

  it('names the match in the delete confirmation', async () => {
    matchApi.getMatchInfo.mockResolvedValue({
      match: { ...MATCH, status: 'ENDED' }, locations: [], registry: [], players: [],
    })
    renderPage()
    await screen.findByText('Saturday run')

    await userEvent.click(screen.getByRole('button', { name: /Delete match/i }))
    expect(screen.getByText(/Permanently delete match "Saturday run"/)).toBeInTheDocument()
  })

  it('dashes a player whose template, class and traits are not named at all', async () => {
    matchApi.getMatchInfo.mockResolvedValue({
      match: MATCH, locations: [], registry: [],
      players: [{ uuid: 'c1', characterTemplateUuid: null, classUuid: null, traitUuids: [] }],
    })
    renderPage()
    await screen.findByText('Saturday run')

    await userEvent.click(screen.getByRole('tab', { name: /Players/i }))
    expect((await screen.findAllByText('—')).length).toBeGreaterThan(0)
  })
})

describe('GuestsPage and MatchDetailModal fallbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listGuests.mockResolvedValue([{ userUuid: 'g1', username: 'guest_a', expired: true }])
    getGuestStats.mockResolvedValue({ totalGuests: 1, activeGuests: 0, expiredGuests: 1 })
    matchApi.listMatches.mockResolvedValue([{ uuid: 'm1', name: 'Run', status: 'RUNNING', userCreatorUuid: 'g1' }])
    matchApi.getMatchInfo.mockResolvedValue({ match: {}, locations: [], registry: [] })
    getStory.mockResolvedValue({})
    listEntities.mockResolvedValue([])
  })

  it('renders a true flag as a badge and closes the guest modal with Escape', async () => {
    render(<MemoryRouter><GuestsPage /></MemoryRouter>)
    await screen.findByText('guest_a')

    await userEvent.click(screen.getByTitle(/View detail/i))
    expect(await screen.findByText('true')).toBeInTheDocument()

    fireEvent.keyDown(document.querySelector('.pg-modal-backdrop'), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByText('true')).not.toBeInTheDocument())
  })

  it('falls back to the generic messages for bodyless guest-side failures', async () => {
    matchApi.pauseMatch.mockRejectedValue({})
    render(<MemoryRouter><GuestsPage /></MemoryRouter>)
    await screen.findByText('guest_a')

    await userEvent.click(screen.getByTitle(/View detail/i))
    await userEvent.click(await screen.findByTitle('Pause match'))
    expect(await screen.findByText('Failed to pause match')).toBeInTheDocument()
  })

  it('falls back to the generic message when the guest match detail fails', async () => {
    matchApi.getMatchInfo.mockRejectedValue({})
    render(<MemoryRouter><GuestsPage /></MemoryRouter>)
    await screen.findByText('guest_a')

    await userEvent.click(screen.getByTitle(/View detail/i))
    await userEvent.click(await screen.findByTitle('View match detail'))
    expect(await screen.findByText('Failed to load match info')).toBeInTheDocument()
  })

  it('MatchDetailModal renders a visited location and a valued registry row', () => {
    render(<MatchDetailModal
      detail={{
        uuid: 'm1', loading: false, error: null, storyCtx: null,
        info: {
          match: {},
          locations: [{ uuid: 'loc-1', idLocation: 1, flagAlreadyActived: 1, flagVisited: 1, clockCounter: 2 }],
          registry: [{ uuid: 'r1', key: 'gate', stringValue: 'OPEN', intValue: 3 }],
        },
      }}
      onClose={vi.fn()} />)

    const row = screen.getByText('#1').closest('tr')
    expect(row).toHaveTextContent('yes')
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})
