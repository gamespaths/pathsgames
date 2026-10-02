import { useCallback, useEffect, useState } from 'react'
import {
  listMatchSnapshots, checkMatchSnapshot, restoreMatchSnapshot, exportMatch, errorBody,
} from '../../../api/matchApi'
import ConfirmModal from '../../common/ConfirmModal'
import { downloadJson } from '../../../utils/download'

/**
 * SnapshotsCard — v0.41.1 Step 41 B: the time-end snapshots of a match, newest first; "Check"
 * lists what fails, "Restore" (confirmed) rolls the match back; v0.41.4 "Export" downloads the file.
 */

const errorText = (e, fallback) => e?.response?.data?.message || e?.message || fallback

const sizeText = (bytes) => (bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes ?? 0} B`)

function CheckResult({ result }) {
  if (!result) return <span style={{ color: 'var(--color-ash)' }}>—</span>
  if (result.valid) return <span className="pg-badge pg-badge-success">valid</span>
  return (
    <ul className="m-0 p-0" style={{ listStyle: 'none' }} data-testid="snapshot-errors">
      {(result.errors ?? []).map((e, i) => (
        <li key={`${e.code}-${i}`}>
          <span className="pg-badge pg-badge-danger me-1">{e.code}</span>{e.message}
        </li>
      ))}
    </ul>
  )
}

export default function SnapshotsCard({ matchUuid, onRestored, notice }) {
  const [rows, setRows]       = useState(null)
  const [error, setError]     = useState('')
  const [busy, setBusy]       = useState(false)
  const [checks, setChecks]   = useState({})     // snapshot uuid -> { valid, errors }
  const [confirm, setConfirm] = useState(null)   // the snapshot row waiting for confirmation
  const [exporting, setExporting] = useState(null) // the latest row, waiting for the export confirmation
  const [exportErrors, setExportErrors] = useState([])
  const [exported, setExported] = useState('')

  const load = useCallback(() => {
    setError('')
    return listMatchSnapshots(matchUuid)
      .then(data => setRows(Array.isArray(data) ? data : []))
      .catch(e => {
        setRows([])
        setError(errorText(e, 'Failed to load the snapshots'))
      })
  }, [matchUuid])

  useEffect(() => { void load() }, [load])

  async function check(row) {
    setBusy(true)
    setError('')
    try {
      const result = await checkMatchSnapshot(matchUuid, row.uuid)
      setChecks(prev => ({ ...prev, [row.uuid]: result }))
    } catch (e) {
      setError(errorText(e, 'The check failed'))
    } finally {
      setBusy(false)
    }
  }

  async function restore(row) {
    setConfirm(null)
    setBusy(true)
    setError('')
    try {
      const result = await restoreMatchSnapshot(matchUuid, row.uuid)
      setChecks({})
      const text = `Restored the end of clock ${result?.clock ?? row.clock}: `
        + `${result?.logsRemoved ?? 0} log rows removed, match ${result?.matchStatus ?? 'PAUSED'}.`
      await load()
      if (onRestored) onRestored(text)
    } catch (e) {
      // A 409 carries the failed check: show it on the row, the message above the table.
      const errors = e?.response?.data?.errors
      if (Array.isArray(errors)) setChecks(prev => ({ ...prev, [row.uuid]: { valid: false, errors } }))
      setError(errorText(e, 'The restore failed'))
    } finally {
      setBusy(false)
    }
  }

  async function exportFile(row) {
    setExporting(null)
    setBusy(true)
    setError('')
    setExportErrors([])
    setExported('')
    try {
      const { text, fileName } = await exportMatch(matchUuid)
      downloadJson(text, fileName)
      setExported(`Exported the end of clock ${row.clock} as ${fileName}.`)
      await load()
      if (onRestored) onRestored('')
    } catch (e) {
      const body = errorBody(e)
      setExportErrors(Array.isArray(body.errors) ? body.errors : [])
      setError(body.message || errorText(e, 'The export failed'))
    } finally {
      setBusy(false)
    }
  }

  const list = rows ?? []

  return (
    <div className="pg-card mb-4" style={{ padding: 0, overflow: 'hidden' }} data-testid="snapshots-panel">
      {confirm && (
        <ConfirmModal
          title="Restore snapshot"
          message={`Roll the match back to the end of clock ${confirm.clock}? The log rows written after it are deleted, the time-start runs again and the match is left PAUSED (resume it from the configuration tab).`}
          onConfirm={() => { void restore(confirm) }}
          onCancel={() => setConfirm(null)}
          danger
        />
      )}
      {exporting && (
        <ConfirmModal
          title="Export match"
          message={`Export the match as a file? This pauses the match, rolls it back to the snapshot of clock ${exporting.clock} (the actions since are lost), then restarts it.`}
          onConfirm={() => { void exportFile(exporting) }}
          onCancel={() => setExporting(null)}
          danger
        />
      )}
      <div className="d-flex justify-content-between align-items-center" style={{ padding: '0.75rem 1rem 0' }}>
        <p className="pg-card-title m-0">
          <i className="fas fa-camera me-1" />Snapshots ({list.length})
        </p>
        <button className="pg-btn pg-btn-sm pg-btn-ghost" disabled={busy || list.length === 0}
                onClick={() => setExporting(list[0])} aria-label="Export match">
          <i className="fas fa-file-export me-1" />Export
        </button>
      </div>
      <p style={{ padding: '0 1rem', fontSize: '0.78rem', color: 'var(--color-ash)' }}>
        One snapshot at every time-end, before the clock moves; the newest ones are kept.
      </p>
      {notice && (
        <p className="pg-badge pg-badge-success" style={{ margin: '0 1rem 0.5rem' }} data-testid="snapshot-notice">
          {notice}
        </p>
      )}
      {exported && (
        <p className="pg-badge pg-badge-success" style={{ margin: '0 1rem 0.5rem' }} data-testid="export-notice">
          {exported}
        </p>
      )}
      {error && (
        <p className="pg-error" style={{ padding: '0 1rem', fontSize: '0.8rem' }}>{error}</p>
      )}
      {exportErrors.length > 0 && (
        <div style={{ padding: '0 1rem 0.5rem' }}><CheckResult result={{ valid: false, errors: exportErrors }} /></div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table className="pg-table" style={{ fontSize: '0.78rem' }}>
          <thead>
            <tr><th>Clock</th><th>Taken</th><th>Description</th><th>Size</th><th>Check</th><th></th></tr>
          </thead>
          <tbody>
            {rows === null && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-ash)' }}>Loading…</td></tr>
            )}
            {rows !== null && list.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-ash)' }}>No snapshots yet.</td></tr>
            )}
            {list.map(row => (
              <tr key={row.uuid}>
                <td>{row.clock}</td>
                <td>{row.timestamp ?? '—'}</td>
                <td>{row.description ?? '—'}</td>
                <td>{sizeText(row.sizeBytes)}</td>
                <td><CheckResult result={checks[row.uuid]} /></td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="pg-btn pg-btn-sm pg-btn-ghost me-1" disabled={busy}
                          onClick={() => { void check(row) }} aria-label={`Check snapshot of clock ${row.clock}`}>
                    <i className="fas fa-stethoscope me-1" />Check
                  </button>
                  <button className="pg-btn pg-btn-sm pg-btn-danger" disabled={busy}
                          onClick={() => setConfirm(row)} aria-label={`Restore snapshot of clock ${row.clock}`}>
                    <i className="fas fa-clock-rotate-left me-1" />Restore
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
