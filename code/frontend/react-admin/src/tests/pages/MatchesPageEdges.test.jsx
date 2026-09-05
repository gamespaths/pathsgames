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
import {
  listMatches, getMatchInfo, listMatchStatuses, updateMatch, stopMatch,
} from '../../api/matchApi'
import { getStory, listEntities } from '../../api/storyApi'

/**
 * The failure and sparse-payload half of the matches console: every API call has
 * a `e.response?.data?.message || e.message || 'fallback'` ladder behind it, the
 * envelope may not be an envelope at all, and a match row may carry no name.
 */

const BARE_MATCH = { uuid: 'm1-uuid-aaaa', storyUuid: 'story-1' } // no name, clock, expCost, status

function env(items, nextCursor = null) {
  return { items, nextCursor, limit: 50 }
}

function renderPage() {
  return render(<MemoryRouter><MatchesPage /></MemoryRouter>)
}

describe('MatchesPage edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listMatches.mockResolvedValue(env([BARE_MATCH]))
    listMatchStatuses.mockResolvedValue([])
    getMatchInfo.mockResolvedValue({ match: BARE_MATCH, locations: [], registry: [] })
    getStory.mockResolvedValue({})
    listEntities.mockResolvedValue([])
  })

  it('defaults the row values a match does not carry', async () => {
    renderPage()

    expect(await screen.findByText('untitled')).toBeInTheDocument()
    expect(screen.getByText('Single')).toBeInTheDocument()   // singlePlayer undefined
    const row = screen.getByText('untitled').closest('tr')
    const cells = row.querySelectorAll('td')
    expect(cells[5]).toHaveTextContent('0')                  // currentClock
    expect(cells[6]).toHaveTextContent('0')                  // expCost
  })

  it('renders the empty state when the API answers with something that is not an envelope', async () => {
    listMatches.mockResolvedValue(null)
    renderPage()
    expect(await screen.findByText('No matches found.')).toBeInTheDocument()
  })

  it('falls back to the built-in statuses when the status endpoint fails', async () => {
    listMatchStatuses.mockRejectedValue(new Error('nope'))
    renderPage()
    await screen.findByText('untitled')
    await waitFor(() => expect(screen.getByLabelText('Filter by status')).toBeInTheDocument())
    expect(screen.getAllByRole('option').some(o => o.value === 'GAMEOVER')).toBe(true)
  })

  it('shows the load error and lets the alert be dismissed', async () => {
    listMatches.mockRejectedValue(new Error('backend down'))
    renderPage()

    expect(await screen.findByText('backend down')).toBeInTheDocument()
    const alert = screen.getByText('backend down').closest('.pg-alert')
    await userEvent.click(alert.querySelector('button'))
    expect(screen.queryByText('backend down')).not.toBeInTheDocument()
  })

  it('reports a nameless error object with the generic message', async () => {
    listMatches.mockRejectedValue({})
    renderPage()
    expect(await screen.findByText('Failed to load matches')).toBeInTheDocument()
  })

  it('appends the next page and reports a failure of the load-more call', async () => {
    listMatches
      .mockResolvedValueOnce(env([BARE_MATCH], 'cursor-1'))
      .mockRejectedValueOnce(new Error('no more'))
    renderPage()
    await screen.findByText('untitled')

    await userEvent.click(screen.getByRole('button', { name: /Load more/i }))
    expect(await screen.findByText('no more')).toBeInTheDocument()
  })

  it('reports the detail modal failure inside the modal', async () => {
    getMatchInfo.mockRejectedValue(new Error('info exploded'))
    renderPage()
    await screen.findByText('untitled')

    await userEvent.click(screen.getByTitle('View detail'))
    expect(await screen.findByText('info exploded')).toBeInTheDocument()
  })

  it('names the match by uuid in the confirm dialog and surfaces the API error message', async () => {
    stopMatch.mockRejectedValue({ response: { data: { message: 'match already ended' } } })
    renderPage()
    await screen.findByText('untitled')

    await userEvent.click(screen.getByTitle('Stop match'))
    expect(screen.getByText(new RegExp(`"${BARE_MATCH.uuid}"`))).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(await screen.findByText('match already ended')).toBeInTheDocument()
  })

  it('closes the confirm dialog on cancel without calling the API', async () => {
    renderPage()
    await screen.findByText('untitled')

    await userEvent.click(screen.getByTitle('Stop match'))
    await userEvent.click(screen.getByRole('button', { name: /Cancel/i }))

    expect(stopMatch).not.toHaveBeenCalled()
    expect(screen.queryByText(/Set "/)).not.toBeInTheDocument()
  })

  it('opens the details page from the row shortcut', async () => {
    renderPage()
    await screen.findByText('untitled')
    await userEvent.click(screen.getByTitle(/Open details page/i))
    // navigation is enough: the row action no longer renders the list page title
    expect(screen.getByTitle(/Open details page/i)).toBeInTheDocument()
  })

  it('edits a match that has neither name nor status and reports the save failure', async () => {
    updateMatch.mockRejectedValue(new Error('save failed'))
    renderPage()
    await screen.findByText('untitled')

    await userEvent.click(screen.getByTitle('Edit match'))
    expect(screen.getByLabelText('Name')).toHaveValue('')

    await userEvent.click(screen.getByRole('button', { name: /^Save$/i }))
    expect(await screen.findByText('save failed')).toBeInTheDocument()

    // the modal panel swallows its own clicks and Escape key
    await userEvent.click(screen.getByText('Edit match'))
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
  })

  it('clearing the status filter drops it from the query', async () => {
    renderPage()
    await screen.findByText(/m1-uuid/)

    await userEvent.selectOptions(screen.getByLabelText('Filter by status'), '')

    await waitFor(() => expect(listMatches).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ status: expect.anything() })))
  })

  it('a second page that is not an envelope appends nothing', async () => {
    listMatches.mockResolvedValueOnce(env([BARE_MATCH], 'page-2'))
    listMatches.mockResolvedValueOnce(null)
    renderPage()
    await screen.findByText(/m1-uuid/)

    await userEvent.click(screen.getByText('Load more'))

    await waitFor(() => expect(screen.getByText('No more pages')).toBeInTheDocument())
  })

  it('the load-more button does nothing once there is no cursor', async () => {
    renderPage()
    await screen.findByText(/m1-uuid/)
    listMatches.mockClear()

    await userEvent.click(screen.getByText('No more pages'))

    expect(listMatches).not.toHaveBeenCalled()
  })

  it('the delete dialog names a nameless match by its uuid', async () => {
    listMatchStatuses.mockResolvedValue([{ value: 'ENDED', terminal: true }])
    listMatches.mockResolvedValue(env([{ ...BARE_MATCH, status: 'ENDED' }]))
    renderPage()
    await screen.findByText(/m1-uuid/)

    await userEvent.click(screen.getByTitle('Delete match'))

    expect(await screen.findByText(/m1-uuid-aaaa.*runtime state/)).toBeInTheDocument()
  })

  it('a click inside the edit panel does not close it', async () => {
    renderPage()
    await screen.findByText(/m1-uuid/)
    await userEvent.click(screen.getByTitle('Edit match'))

    await userEvent.click(document.querySelector('.pg-modal'))

    expect(screen.getByLabelText('Name')).toBeInTheDocument()
  })
})
