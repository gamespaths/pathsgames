import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import MatchesPage from '../../pages/MatchesPage'

/** v0.41.4 — the Export button of the matches list: shown only when the row has a snapshot. */
vi.mock('../../api/matchApi', () => ({
  listMatches:        vi.fn(),
  getMatchInfo:       vi.fn(),
  listMatchStatuses:  vi.fn(),
  updateMatch:        vi.fn(),
  stopMatch:          vi.fn(),
  deleteMatch:        vi.fn(),
  listMatchSnapshots: vi.fn(),
  exportMatch:        vi.fn(),
  errorBody:          (e) => e?.response?.data ?? {},
}))
vi.mock('../../api/storyApi', () => ({ getStory: vi.fn(), listEntities: vi.fn() }))
vi.mock('../../utils/download', () => ({ downloadJson: vi.fn() }))

import { listMatches, listMatchStatuses, listMatchSnapshots, exportMatch } from '../../api/matchApi'
import { downloadJson } from '../../utils/download'

const MATCHES = [
  { uuid: 'with-snap', name: 'Saved run', storyUuid: 's1', status: 'RUNNING', singlePlayer: 1, currentClock: 3 },
  { uuid: 'no-snap', name: 'Fresh run', storyUuid: 's1', status: 'CREATED', singlePlayer: 1, currentClock: 0 },
  { uuid: 'broken', name: 'Broken run', storyUuid: 's1', status: 'RUNNING', singlePlayer: 1, currentClock: 1 },
]

function exportButton(name) {
  return within(screen.getByText(name).closest('tr')).queryByRole('button', { name: 'Export match' })
}

async function renderPage() {
  render(<MemoryRouter><MatchesPage /></MemoryRouter>)
  await screen.findByText('Saved run')
  await waitFor(() => expect(exportButton('Saved run')).toBeInTheDocument())
}

describe('MatchesPage export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listMatches.mockResolvedValue({ items: MATCHES, nextCursor: null, limit: 50 })
    listMatchStatuses.mockResolvedValue([])
    listMatchSnapshots.mockImplementation((uuid) => {
      if (uuid === 'with-snap') return Promise.resolve([{ uuid: 'sn2', clock: 2 }, { uuid: 'sn1', clock: 1 }])
      if (uuid === 'broken') return Promise.reject(new Error('down'))
      return Promise.resolve([])
    })
  })

  it('shows Export only on rows that have a snapshot', async () => {
    await renderPage()
    expect(exportButton('Saved run')).toHaveAttribute('title', 'Export the latest snapshot (end of clock 2)')
    expect(exportButton('Fresh run')).toBeNull()
    expect(exportButton('Broken run')).toBeNull()
    expect(listMatchSnapshots).toHaveBeenCalledTimes(3)
  })

  it('exports after the confirmation, downloads the file and reloads', async () => {
    exportMatch.mockResolvedValue({ text: '{"format":"x"}', fileName: 'match-with-sna-clock-2.json' })
    await renderPage()
    await userEvent.click(exportButton('Saved run'))
    expect(screen.getByText(/rolls it back to the snapshot of clock 2/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(downloadJson).toHaveBeenCalledWith('{"format":"x"}', 'match-with-sna-clock-2.json'))
    expect(exportMatch).toHaveBeenCalledWith('with-snap')
    expect(await screen.findByRole('status')).toHaveTextContent('Exported the end of clock 2 as match-with-sna-clock-2.json.')
    await waitFor(() => expect(listMatches).toHaveBeenCalledTimes(2))
    expect(listMatchSnapshots.mock.calls.filter(([u]) => u === 'with-snap')).toHaveLength(2)
  })

  it('shows the refusal with its error codes', async () => {
    exportMatch.mockRejectedValue({ response: { data: {
      message: 'The snapshot failed its integrity check', errors: [{ code: 'STORY_ENTITY_MISSING' }] } } })
    await renderPage()
    await userEvent.click(exportButton('Saved run'))
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(await screen.findByText(
      'The snapshot failed its integrity check (STORY_ENTITY_MISSING)')).toBeInTheDocument()
    expect(downloadJson).not.toHaveBeenCalled()
  })

  it('falls back to the generic message and keeps nothing on cancel', async () => {
    exportMatch.mockRejectedValue({})
    await renderPage()
    await userEvent.click(exportButton('Saved run'))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(exportMatch).not.toHaveBeenCalled()
    await userEvent.click(exportButton('Saved run'))
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(await screen.findByText('Failed to export match')).toBeInTheDocument()
  })
})
