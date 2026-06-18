import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import MatchesPage from '../../pages/MatchesPage'

vi.mock('../../api/matchApi', () => ({
  listMatches:       vi.fn(),
  getMatchInfo:      vi.fn(),
  listMatchStatuses: vi.fn(),
  updateMatch:       vi.fn(),
  stopMatch:         vi.fn(),
  pauseMatch:        vi.fn(),
  resumeMatch:       vi.fn(),
  deleteMatch:       vi.fn(),
}))
vi.mock('../../api/storyApi', () => ({
  getStory:     vi.fn(),
  listEntities: vi.fn(),
}))
// MatchDetailModal is a shared component — mock its storyApi deps at the source level above
import {
  listMatches, getMatchInfo, listMatchStatuses,
  updateMatch, stopMatch, deleteMatch,
} from '../../api/matchApi'
import { getStory, listEntities } from '../../api/storyApi'

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

const MOCK_STATUSES = [
  { value: 'CREATED',  terminal: false },
  { value: 'RUNNING',  terminal: false },
  { value: 'PAUSED',   terminal: false },
  { value: 'ENDED',    terminal: true },
  { value: 'GAMEOVER', terminal: true },
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
    listMatchStatuses.mockResolvedValue(MOCK_STATUSES)
    updateMatch.mockResolvedValue({ status: 'UPDATED' })
    stopMatch.mockResolvedValue({ status: 'UPDATED' })
    deleteMatch.mockResolvedValue({ status: 'DELETED' })
    getStory.mockResolvedValue({ uuid: 'story-1-uuid', title: 'The Lost Kingdom', author: 'Admin' })
    listEntities.mockResolvedValue([])
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
    expect(screen.getByText('The Lost Kingdom')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
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

  it('edits a match status and name', async () => {
    renderPage()
    await screen.findByText('Saturday run')
    await userEvent.click(screen.getAllByTitle('Edit match')[0])
    expect(await screen.findByText('Edit match')).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'PAUSED')
    await userEvent.click(screen.getByText('Save'))
    await waitFor(() =>
      expect(updateMatch).toHaveBeenCalledWith('m1-uuid-aaaa', { status: 'PAUSED', name: 'Saturday run' })
    )
  })

  it('stops a match after confirmation', async () => {
    renderPage()
    await screen.findByText('Saturday run')
    await userEvent.click(screen.getAllByTitle('Stop match')[0])
    await userEvent.click(screen.getByText('Confirm'))
    await waitFor(() => expect(stopMatch).toHaveBeenCalledWith('m1-uuid-aaaa'))
  })

  it('disables delete for a non-terminal match', async () => {
    renderPage()
    await screen.findByText('Saturday run')
    // both seeded matches are CREATED / RUNNING — not deletable
    screen.getAllByTitle(/Stop the match before deleting/i)
      .forEach(btn => expect(btn).toBeDisabled())
  })

  it('deletes a stopped match after confirmation', async () => {
    listMatches.mockResolvedValue([
      { ...MOCK_MATCHES[0], status: 'ENDED' },
    ])
    renderPage()
    await screen.findByText('Saturday run')
    await waitFor(() => expect(listMatchStatuses).toHaveBeenCalled())
    const deleteBtn = await screen.findByTitle('Delete match')
    await userEvent.click(deleteBtn)
    await userEvent.click(screen.getByText('Confirm'))
    await waitFor(() => expect(deleteMatch).toHaveBeenCalledWith('m1-uuid-aaaa'))
  })

  it('cancels the edit modal without saving', async () => {
    renderPage()
    await screen.findByText('Saturday run')
    await userEvent.click(screen.getAllByTitle('Edit match')[0])
    expect(await screen.findByText('Edit match')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByText('Edit match')).not.toBeInTheDocument()
    expect(updateMatch).not.toHaveBeenCalled()
  })

  it('shows an error when edit save fails', async () => {
    updateMatch.mockRejectedValue(new Error('save-error'))
    renderPage()
    await screen.findByText('Saturday run')
    await userEvent.click(screen.getAllByTitle('Edit match')[0])
    await screen.findByText('Edit match')
    await userEvent.click(screen.getByText('Save'))
    expect(await screen.findByText(/save-error/i)).toBeInTheDocument()
  })

  it('edits the match name in the edit modal', async () => {
    renderPage()
    await screen.findByText('Saturday run')
    await userEvent.click(screen.getAllByTitle('Edit match')[0])
    await screen.findByText('Edit match')
    const nameInput = screen.getByLabelText(/Name/i)
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'Renamed Run')
    await userEvent.click(screen.getByText('Save'))
    await waitFor(() =>
      expect(updateMatch).toHaveBeenCalledWith('m1-uuid-aaaa', { status: 'CREATED', name: 'Renamed Run' })
    )
  })

  it('shows error when runConfirm (stop) fails', async () => {
    stopMatch.mockRejectedValue(new Error('stop-action-fail'))
    renderPage()
    await screen.findByText('Saturday run')
    await userEvent.click(screen.getAllByTitle('Stop match')[0])
    await userEvent.click(screen.getByText('Confirm'))
    expect(await screen.findByText(/stop-action-fail/i)).toBeInTheDocument()
  })

  it('renders untitled match with fallback label', async () => {
    listMatches.mockResolvedValue([{ ...MOCK_MATCHES[0], name: null }])
    renderPage()
    expect(await screen.findByText('untitled')).toBeInTheDocument()
  })

  it('renders Multiplayer badge for singlePlayer=0 match', async () => {
    listMatches.mockResolvedValue([{ ...MOCK_MATCHES[0], singlePlayer: 0 }])
    renderPage()
    expect(await screen.findByText('Multiplayer')).toBeInTheDocument()
  })

  it('shows error in detail modal when getMatchInfo fails', async () => {
    getMatchInfo.mockRejectedValue(new Error('info-boom'))
    renderPage()
    await screen.findByText('Saturday run')
    await userEvent.click(screen.getAllByTitle('View detail')[0])
    expect(await screen.findByText(/info-boom/i)).toBeInTheDocument()
  })

  it('falls back to default statuses when listMatchStatuses returns non-array', async () => {
    listMatchStatuses.mockResolvedValue(null)
    renderPage()
    await screen.findByText('Saturday run')
    // default statuses are still used — status filter options remain
    const options = await screen.findAllByText('CREATED')
    expect(options.length).toBeGreaterThanOrEqual(1)
  })

  it('navigate button is present for each match row', async () => {
    renderPage()
    await screen.findByText('Saturday run')
    const expandBtns = screen.getAllByTitle('Open details page (players & characters)')
    expect(expandBtns.length).toBe(2)
  })
})
