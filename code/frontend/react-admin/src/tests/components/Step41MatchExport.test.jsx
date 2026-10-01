// v0.41.4 Step 41 H — the Export button of the Snapshots card and the match import page.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('../../api/matchApi', async () => {
  const real = await vi.importActual('../../api/matchApi')
  return {
    listMatchSnapshots: vi.fn(),
    checkMatchSnapshot: vi.fn(),
    restoreMatchSnapshot: vi.fn(),
    exportMatch: vi.fn(),
    importMatch: vi.fn(),
    errorBody: real.errorBody,
  }
})

import * as matchApi from '../../api/matchApi'
import SnapshotsCard from '../../components/match/detail/SnapshotsCard'
import MatchImportPage from '../../pages/MatchImportPage'

const ROWS = [{ uuid: 's2', clock: 3, type: 'LIGHT', timestamp: 't', description: 'Time-end of clock 3', sizeBytes: 10 }]

describe('SnapshotsCard — Export', () => {
  const originalCreate = global.URL.createObjectURL
  const originalRevoke = global.URL.revokeObjectURL

  beforeEach(() => {
    vi.clearAllMocks()
    matchApi.listMatchSnapshots.mockResolvedValue(ROWS)
    global.URL.createObjectURL = vi.fn(() => 'blob:x')
    global.URL.revokeObjectURL = vi.fn()
  })
  afterEach(() => {
    global.URL.createObjectURL = originalCreate
    global.URL.revokeObjectURL = originalRevoke
  })

  it('is disabled without snapshots', async () => {
    matchApi.listMatchSnapshots.mockResolvedValueOnce([])
    render(<SnapshotsCard matchUuid="m1" />)
    expect(await screen.findByText('No snapshots yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export match' })).toBeDisabled()
  })

  it('confirms, downloads the file, reloads and tells the page', async () => {
    matchApi.exportMatch.mockResolvedValue({ text: '{"a":1}', fileName: 'match-m1-clock-3.json' })
    const onRestored = vi.fn()
    render(<SnapshotsCard matchUuid="m1" onRestored={onRestored} />)
    await screen.findByText('Time-end of clock 3')
    await userEvent.click(screen.getByRole('button', { name: 'Export match' }))
    expect(screen.getByText(/rolls it back to the snapshot of clock 3/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(matchApi.exportMatch).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Export match' }))
    await userEvent.click(screen.getByRole('button', { name: /confirm|yes|ok/i }))
    expect(await screen.findByTestId('export-notice')).toHaveTextContent('match-m1-clock-3.json')
    expect(matchApi.exportMatch).toHaveBeenCalledWith('m1')
    expect(global.URL.createObjectURL).toHaveBeenCalled()
    expect(matchApi.listMatchSnapshots).toHaveBeenCalledTimes(2)
    expect(onRestored).toHaveBeenCalledWith('')
  })

  it('shows the 409 errors of a refused export', async () => {
    matchApi.exportMatch.mockRejectedValue({ response: { data: JSON.stringify({
      error: 'SNAPSHOT_INTEGRITY_FAILED', message: 'The snapshot failed its integrity check',
      errors: [{ code: 'USER_MISSING', message: 'user 4 no longer exists' }] }) } })
    render(<SnapshotsCard matchUuid="m1" />)
    await screen.findByText('Time-end of clock 3')
    await userEvent.click(screen.getByRole('button', { name: 'Export match' }))
    await userEvent.click(screen.getByRole('button', { name: /confirm|yes|ok/i }))
    expect(await screen.findByText('The snapshot failed its integrity check')).toBeInTheDocument()
    expect(screen.getByText('USER_MISSING')).toBeInTheDocument()
  })

  it('falls back to the error text when the body says nothing', async () => {
    matchApi.exportMatch.mockRejectedValue({ message: 'Network Error' })
    render(<SnapshotsCard matchUuid="m1" />)
    await screen.findByText('Time-end of clock 3')
    await userEvent.click(screen.getByRole('button', { name: 'Export match' }))
    await userEvent.click(screen.getByRole('button', { name: /confirm|yes|ok/i }))
    expect(await screen.findByText('Network Error')).toBeInTheDocument()
  })
})

const CHECK = {
  valid: true, errors: [], matchExists: true,
  warnings: [{ code: 'CROSS_FAMILY', message: 'Exported by the aws backend' }],
  source: { backend: 'aws', dialect: 'dynamodb', appVersion: '0.41.4', server: 'test', snapshotClock: 3 },
  story: { uuid: 's1', status: 'DIFFERENT', action: 'KEEP', matchesDeleted: 4 },
  users: [{ uuid: 'u1', username: 'guest_1', targetUsername: 'guest_1_u1', targetUuid: 'u1', status: 'RENAMED' },
    { uuid: 'u2', username: 'boss', targetUsername: 'boss_here', targetUuid: 't9', status: 'MAPPED_BY_EMAIL' }],
}

function file(text) {
  const f = new File([text], 'match.json', { type: 'application/json' })
  f.text = () => Promise.resolve(text)
  return f
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/matches/import']}>
      <Routes>
        <Route path="/matches/import" element={<MatchImportPage />} />
        <Route path="/matches/:uuid" element={<p>match page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('MatchImportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('runs the dry-run on the picked file and renders source, story, users and warnings', async () => {
    matchApi.importMatch.mockResolvedValue(CHECK)
    renderPage()
    fireEvent.change(screen.getByLabelText('Match export file'), { target: { files: [file('{"format":"x"}')] } })
    expect(await screen.findByTestId('import-check')).toBeInTheDocument()
    expect(matchApi.importMatch).toHaveBeenCalledWith({ export: { format: 'x' }, dryRun: true, replace: false,
      storyMode: 'AUTO', startPaused: false })
    expect(screen.getByTestId('import-source')).toHaveTextContent('aws (dynamodb) 0.41.4 on test')
    expect(screen.getByTestId('import-story')).toHaveTextContent('DIFFERENT → KEEP')
    expect(screen.getByText('guest_1_u1')).toBeInTheDocument()
    expect(screen.getByTestId('import-user-u1')).not.toHaveTextContent('t9')
    expect(screen.getByTestId('import-user-u2')).toHaveTextContent('boss_heret9MAPPED_BY_EMAIL (same e-mail)')
    expect(screen.getByText('CROSS_FAMILY')).toBeInTheDocument()
  })

  it('re-checks on replace and story mode, shows the deleted count, then imports and links the match', async () => {
    matchApi.importMatch.mockResolvedValue(CHECK)
    renderPage()
    fireEvent.change(screen.getByLabelText('Match export file'), { target: { files: [file('{}')] } })
    await screen.findByTestId('import-check')
    await userEvent.click(screen.getByLabelText(/Replace the match/))
    await waitFor(() => expect(matchApi.importMatch).toHaveBeenLastCalledWith(
      expect.objectContaining({ dryRun: true, replace: true })))
    await userEvent.selectOptions(screen.getByLabelText('Story mode'), 'REPLACE')
    await waitFor(() => expect(matchApi.importMatch).toHaveBeenLastCalledWith(
      expect.objectContaining({ dryRun: true, storyMode: 'REPLACE' })))
    expect(screen.getByTestId('matches-deleted')).toHaveTextContent('deletes 4 match(es)')
    await userEvent.click(screen.getByLabelText('Start paused'))
    matchApi.importMatch.mockResolvedValueOnce({ status: 'IMPORTED', uuidMatch: 'm9', snapshotClock: 3, clock: 4,
      matchStatus: 'PAUSED', usersCreated: 1, logsImported: 12 })
    await userEvent.click(screen.getByRole('button', { name: /^Import$/ }))
    expect(await screen.findByTestId('import-result')).toHaveTextContent('now at clock 4, PAUSED')
    expect(matchApi.importMatch).toHaveBeenLastCalledWith({ export: {}, replace: true, storyMode: 'REPLACE',
      startPaused: true })
    await userEvent.click(screen.getByText('Open the match'))
    expect(await screen.findByText('match page')).toBeInTheDocument()
  })

  it('refuses a non-JSON file, an empty pick and shows the errors of a check or an import', async () => {
    renderPage()
    fireEvent.change(screen.getByLabelText('Match export file'), { target: { files: [file('not json')] } })
    expect(await screen.findByTestId('import-error')).toHaveTextContent('The file is not JSON')
    fireEvent.change(screen.getByLabelText('Match export file'), { target: { files: [] } })
    expect(matchApi.importMatch).not.toHaveBeenCalled()

    matchApi.importMatch.mockRejectedValueOnce({ response: { data: { message: 'The export is larger than 10 bytes' } } })
    fireEvent.change(screen.getByLabelText('Match export file'), { target: { files: [file('{}')] } })
    expect(await screen.findByText('The export is larger than 10 bytes')).toBeInTheDocument()

    matchApi.importMatch.mockResolvedValueOnce({ ...CHECK, valid: false, matchExists: false,
      story: { uuid: 's1', status: 'SAME', action: 'USE_EXISTING' },
      errors: [{ code: 'MATCH_EXISTS', message: 'Match m already exists' }] })
    fireEvent.change(screen.getByLabelText('Match export file'), { target: { files: [file('{}')] } })
    expect(await screen.findByText('MATCH_EXISTS')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Import$/ })).toBeDisabled()
    expect(screen.queryByLabelText('Story mode')).toBeNull()

    matchApi.importMatch.mockResolvedValueOnce(CHECK)
    fireEvent.change(screen.getByLabelText('Match export file'), { target: { files: [file('{}')] } })
    await waitFor(() => expect(screen.getByRole('button', { name: /^Import$/ })).toBeEnabled())
    matchApi.importMatch.mockRejectedValueOnce({ response: { data: { error: 'IMPORT_INVALID', message: 'cannot',
      errors: [{ code: 'CHECKSUM_MISMATCH', message: 'The file does not match its checksum' }] } } })
    await userEvent.click(screen.getByRole('button', { name: /^Import$/ }))
    expect(await screen.findByText('CHECKSUM_MISMATCH')).toBeInTheDocument()
    matchApi.importMatch.mockRejectedValueOnce({ message: 'Network Error' })
    await userEvent.click(screen.getByRole('button', { name: /^Import$/ }))
    expect(await screen.findByText('Network Error')).toBeInTheDocument()
  })

  it('falls back to a generic message when a check fails without a body', async () => {
    matchApi.importMatch.mockRejectedValueOnce({})
    renderPage()
    fireEvent.change(screen.getByLabelText('Match export file'), { target: { files: [file('{}')] } })
    expect(await screen.findByText('The check failed')).toBeInTheDocument()
  })
})
