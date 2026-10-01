// v0.41.1 Step 41 B — the Snapshots tab: list, Check with its errors, Restore behind the confirm, reload.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('../../api/matchApi', () => ({
  getMatchInfo: vi.fn(),
  getMatchClock: vi.fn(),
  getMatchWeather: vi.fn(),
  getMatchLocations: vi.fn(),
  getMatchLogs: vi.fn(),
  stopMatch: vi.fn(),
  pauseMatch: vi.fn(),
  resumeMatch: vi.fn(),
  deleteMatch: vi.fn(),
  changePlayerStatistics: vi.fn(),
  listMatchSnapshots: vi.fn(),
  checkMatchSnapshot: vi.fn(),
  restoreMatchSnapshot: vi.fn(),
  exportMatch: vi.fn(),
  errorBody: vi.fn(() => ({})),
}))
vi.mock('../../api/storyApi', () => ({ getStory: vi.fn(), listEntities: vi.fn() }))

import * as matchApi from '../../api/matchApi'
import { getStory, listEntities } from '../../api/storyApi'
import SnapshotsCard from '../../components/match/detail/SnapshotsCard'
import MatchDetailPage from '../../pages/MatchDetailPage'

const ROWS = [
  { uuid: 's2', clock: 3, type: 'LIGHT', timestamp: '2026-09-28T10:00:00Z', description: 'Time-end of clock 3', sizeBytes: 2048 },
  { uuid: 's1', clock: 2, type: 'LIGHT', timestamp: null, description: null, sizeBytes: 900 },
]

describe('SnapshotsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    matchApi.listMatchSnapshots.mockResolvedValue(ROWS)
  })

  it('lists the snapshots newest first with their size', async () => {
    render(<SnapshotsCard matchUuid="m1" />)
    expect(await screen.findByText('Time-end of clock 3')).toBeInTheDocument()
    expect(screen.getByText('Snapshots (2)')).toBeInTheDocument()
    expect(screen.getByText('2.0 KB')).toBeInTheDocument()
    expect(screen.getByText('900 B')).toBeInTheDocument()
    expect(matchApi.listMatchSnapshots).toHaveBeenCalledWith('m1')
  })

  it('says so when there are none, or when the list fails', async () => {
    matchApi.listMatchSnapshots.mockResolvedValueOnce(null)
    const { unmount } = render(<SnapshotsCard matchUuid="m1" />)
    expect(await screen.findByText('No snapshots yet.')).toBeInTheDocument()
    unmount()
    matchApi.listMatchSnapshots.mockRejectedValueOnce({ response: { data: { message: 'Match not found: m1' } } })
    render(<SnapshotsCard matchUuid="m1" />)
    expect(await screen.findByText('Match not found: m1')).toBeInTheDocument()
  })

  it('Check shows valid, or every error of a failed check', async () => {
    matchApi.checkMatchSnapshot
      .mockResolvedValueOnce({ valid: true, errors: [] })
      .mockResolvedValueOnce({ valid: false, errors: [{ code: 'STORY_ENTITY_MISSING', message: 'trait 1 is no longer in the story' }] })
    render(<SnapshotsCard matchUuid="m1" />)
    await userEvent.click(await screen.findByLabelText('Check snapshot of clock 3'))
    expect(await screen.findByText('valid')).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText('Check snapshot of clock 2'))
    expect(await screen.findByText('STORY_ENTITY_MISSING')).toBeInTheDocument()
    expect(screen.getByText('trait 1 is no longer in the story')).toBeInTheDocument()
    expect(matchApi.checkMatchSnapshot).toHaveBeenCalledWith('m1', 's1')
  })

  it('a check that fails outright shows its message', async () => {
    matchApi.checkMatchSnapshot.mockRejectedValueOnce(new Error('network down'))
    render(<SnapshotsCard matchUuid="m1" />)
    await userEvent.click(await screen.findByLabelText('Check snapshot of clock 3'))
    expect(await screen.findByText('network down')).toBeInTheDocument()
  })

  it('Restore asks first; cancel restores nothing', async () => {
    render(<SnapshotsCard matchUuid="m1" />)
    await userEvent.click(await screen.findByLabelText('Restore snapshot of clock 3'))
    expect(screen.getByText(/Roll the match back to the end of clock 3/)).toBeInTheDocument()
    await userEvent.click(screen.getByText('Cancel'))
    expect(matchApi.restoreMatchSnapshot).not.toHaveBeenCalled()
  })

  it('a confirmed restore reloads the list and tells the page what happened', async () => {
    const onRestored = vi.fn()
    matchApi.restoreMatchSnapshot.mockResolvedValueOnce({ status: 'RESTORED', uuidSnapshot: 's2', clock: 3, matchStatus: 'PAUSED', logsRemoved: 7 })
    render(<SnapshotsCard matchUuid="m1" onRestored={onRestored} />)
    await userEvent.click(await screen.findByLabelText('Restore snapshot of clock 3'))
    await userEvent.click(screen.getByText('Confirm'))
    await waitFor(() => expect(onRestored).toHaveBeenCalledWith(
      'Restored the end of clock 3: 7 log rows removed, match PAUSED.'))
    expect(matchApi.restoreMatchSnapshot).toHaveBeenCalledWith('m1', 's2')
    expect(matchApi.listMatchSnapshots).toHaveBeenCalledTimes(2)
  })

  it('a restore answered with an empty body still reports with the row defaults', async () => {
    const onRestored = vi.fn()
    matchApi.restoreMatchSnapshot.mockResolvedValueOnce(undefined)
    render(<SnapshotsCard matchUuid="m1" onRestored={onRestored} />)
    await userEvent.click(await screen.findByLabelText('Restore snapshot of clock 2'))
    await userEvent.click(screen.getByText('Confirm'))
    await waitFor(() => expect(onRestored).toHaveBeenCalledWith(
      'Restored the end of clock 2: 0 log rows removed, match PAUSED.'))
  })

  it('a refused restore (409) shows the failed check on the row', async () => {
    matchApi.restoreMatchSnapshot.mockRejectedValueOnce({ response: { data: {
      error: 'SNAPSHOT_INTEGRITY_FAILED', message: 'The snapshot failed its integrity check',
      errors: [{ code: 'USER_MISSING', message: 'user 4 no longer exists' }] } } })
    render(<SnapshotsCard matchUuid="m1" />)
    await userEvent.click(await screen.findByLabelText('Restore snapshot of clock 3'))
    await userEvent.click(screen.getByText('Confirm'))
    expect(await screen.findByText('The snapshot failed its integrity check')).toBeInTheDocument()
    expect(screen.getByText('USER_MISSING')).toBeInTheDocument()
  })

  it('tolerates a row without size, a check without errors and no page callback', async () => {
    matchApi.listMatchSnapshots.mockResolvedValue([{ uuid: 's9', clock: 1 }])
    matchApi.checkMatchSnapshot.mockResolvedValueOnce({ valid: false })
    matchApi.restoreMatchSnapshot.mockResolvedValueOnce({ clock: 1, logsRemoved: 0, matchStatus: 'PAUSED' })
    render(<SnapshotsCard matchUuid="m1" />)
    expect(await screen.findByText('0 B')).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText('Check snapshot of clock 1'))
    expect(await screen.findByTestId('snapshot-errors')).toBeEmptyDOMElement()
    await userEvent.click(screen.getByLabelText('Restore snapshot of clock 1'))
    await userEvent.click(screen.getByText('Confirm'))
    await waitFor(() => expect(matchApi.listMatchSnapshots).toHaveBeenCalledTimes(2))
  })

  it('a restore failing without a body shows the generic message', async () => {
    matchApi.restoreMatchSnapshot.mockRejectedValueOnce({})
    render(<SnapshotsCard matchUuid="m1" notice="earlier notice" />)
    expect(screen.getByTestId('snapshot-notice')).toHaveTextContent('earlier notice')
    await userEvent.click(await screen.findByLabelText('Restore snapshot of clock 3'))
    await userEvent.click(screen.getByText('Confirm'))
    expect(await screen.findByText('The restore failed')).toBeInTheDocument()
  })
})

describe('MatchDetailPage Snapshots tab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    matchApi.getMatchInfo.mockResolvedValue({ match: { uuid: 'm1', status: 'RUNNING' }, locations: [], registry: [], players: [] })
    matchApi.getMatchClock.mockRejectedValue(new Error('x'))
    matchApi.getMatchWeather.mockRejectedValue(new Error('x'))
    matchApi.getMatchLocations.mockRejectedValue(new Error('x'))
    matchApi.getMatchLogs.mockResolvedValue({})
    matchApi.listMatchSnapshots.mockResolvedValue(ROWS)
    getStory.mockResolvedValue({})
    listEntities.mockResolvedValue([])
  })

  it('opens the tab, restores and reloads the match with the notice kept', async () => {
    matchApi.restoreMatchSnapshot.mockResolvedValueOnce({ status: 'RESTORED', clock: 3, matchStatus: 'PAUSED', logsRemoved: 2 })
    render(
      <MemoryRouter initialEntries={['/matches/m1']}>
        <Routes><Route path="/matches/:uuid" element={<MatchDetailPage />} /></Routes>
      </MemoryRouter>
    )
    await userEvent.click(await screen.findByRole('tab', { name: /Snapshots/i }))
    await userEvent.click(await screen.findByLabelText('Restore snapshot of clock 3'))
    await userEvent.click(screen.getByText('Confirm'))
    expect(await screen.findByTestId('snapshot-notice')).toHaveTextContent('2 log rows removed')
    expect(matchApi.getMatchInfo).toHaveBeenCalledTimes(2)
  })
})
