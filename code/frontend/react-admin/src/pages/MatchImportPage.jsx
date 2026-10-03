import { useState } from 'react'
import { Link } from 'react-router-dom'
import { importMatch, errorBody } from '../api/matchApi'

/**
 * MatchImportPage — v0.41.4 Step 41 H: pick a match export file, see the automatic dry-run (source,
 * story, users, warnings, errors), choose replace / storyMode / startPaused, then import it.
 */

function Issues({ title, rows, kind }) {
  if (!rows?.length) return null
  return (
    <div className="mb-2" data-testid={`import-${kind}`}>
      <strong style={{ fontSize: '0.8rem' }}>{title}</strong>
      <ul className="m-0 p-0" style={{ listStyle: 'none' }}>
        {rows.map((e, i) => (
          <li key={`${e.code}-${i}`} style={{ fontSize: '0.8rem' }}>
            <span className={`pg-badge ${kind === 'errors' ? 'pg-badge-danger' : 'pg-badge-warning'} me-1`}>{e.code}</span>
            {e.message}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function MatchImportPage() {
  const [file, setFile]           = useState(null)   // { name, doc }
  const [check, setCheck]         = useState(null)
  const [replace, setReplace]     = useState(false)
  const [storyMode, setStoryMode] = useState('AUTO')
  const [startPaused, setStartPaused] = useState(false)
  const [busy, setBusy]           = useState(false)
  const [error, setError]         = useState('')
  const [errors, setErrors]       = useState([])
  const [result, setResult]       = useState(null)

  const options = (over = {}) => ({ replace, storyMode, startPaused, ...over })

  async function dryRun(doc, opts) {
    setBusy(true)
    setError('')
    setErrors([])
    try {
      setCheck(await importMatch({ export: doc, dryRun: true, ...opts }))
    } catch (e) {
      const body = errorBody(e)
      setCheck(null)
      setErrors(Array.isArray(body.errors) ? body.errors : [])
      setError(body.message || e?.message || 'The check failed')
    } finally {
      setBusy(false)
    }
  }

  async function pick(event) {
    const chosen = event.target.files?.[0]
    setResult(null)
    setCheck(null)
    if (!chosen) return
    let doc
    try {
      doc = JSON.parse(await chosen.text())
    } catch {
      setFile(null)
      setError('The file is not JSON')
      return
    }
    setFile({ name: chosen.name, doc })
    await dryRun(doc, options())
  }

  function change(over) {
    if (over.replace !== undefined) setReplace(over.replace)
    if (over.storyMode !== undefined) setStoryMode(over.storyMode)
    if (over.startPaused !== undefined) setStartPaused(over.startPaused)
    if (file && over.startPaused === undefined) void dryRun(file.doc, options(over))
  }

  async function doImport() {
    setBusy(true)
    setError('')
    setErrors([])
    try {
      setResult(await importMatch({ export: file.doc, ...options() }))
    } catch (e) {
      const body = errorBody(e)
      setErrors(Array.isArray(body.errors) ? body.errors : [])
      setError(body.message || e?.message || 'The import failed')
    } finally {
      setBusy(false)
    }
  }

  const story = check?.story ?? {}
  const source = check?.source ?? {}

  return (
    <div>
      <h2 className="pg-page-title"><i className="fas fa-file-import" />Import match</h2>
      <div className="pg-card mb-3">
        <p style={{ fontSize: '0.8rem', color: 'var(--color-ash)' }}>
          A file exported from any server (Java, Python or AWS). The check runs first and writes nothing.
          Copied guests have no token: they cannot resume their old session on this server.
        </p>
        <input type="file" accept="application/json,.json" onChange={(e) => { void pick(e) }}
               aria-label="Match export file" disabled={busy} />
        {file && <span className="ms-2" style={{ fontSize: '0.8rem' }}>{file.name}</span>}
      </div>

      {error && <p className="pg-error" data-testid="import-error">{error}</p>}
      <Issues title="Errors" rows={errors} kind="errors" />

      {check && (
        <div className="pg-card mb-3" data-testid="import-check">
          <p className="pg-card-title">
            Check: {check.valid
              ? <span className="pg-badge pg-badge-success">valid</span>
              : <span className="pg-badge pg-badge-danger">not importable</span>}
          </p>
          <p style={{ fontSize: '0.8rem' }} data-testid="import-source">
            Source: {source.backend} ({source.dialect ?? '—'}) {source.appVersion} on {source.server},
            snapshot of clock {source.snapshotClock}
          </p>
          <p style={{ fontSize: '0.8rem' }} data-testid="import-story">
            Story {story.uuid}: {story.status} → {story.action}
          </p>
          <Issues title="Errors" rows={check.errors} kind="errors" />
          <Issues title="Warnings" rows={check.warnings} kind="warnings" />
          <table className="pg-table" style={{ fontSize: '0.78rem' }}>
            <thead><tr><th>User</th><th>On this server</th><th>Status</th></tr></thead>
            <tbody>
              {(check.users ?? []).map(u => (
                <tr key={u.uuid} data-testid={`import-user-${u.uuid}`}>
                  <td>{u.username}</td>
                  <td>
                    {u.targetUsername}
                    {u.targetUuid && u.targetUuid !== u.uuid && (
                      <div className="text-muted" style={{ fontSize: '0.7rem' }}>{u.targetUuid}</div>
                    )}
                  </td>
                  <td>{u.status === 'MAPPED_BY_EMAIL' ? 'MAPPED_BY_EMAIL (same e-mail)' : u.status}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 d-flex flex-wrap gap-3 align-items-center" style={{ fontSize: '0.8rem' }}>
            {check.matchExists && (
              <label>
                <input type="checkbox" checked={replace} className="me-1"
                       onChange={(e) => change({ replace: e.target.checked })} />Replace the match already on this server
              </label>
            )}
            {story.status === 'DIFFERENT' && (
              <label>
                Story differs:{' '}
                <select value={storyMode} aria-label="Story mode"
                        onChange={(e) => change({ storyMode: e.target.value })}>
                  <option value="AUTO">refuse (AUTO)</option>
                  <option value="KEEP">keep this server's story</option>
                  <option value="REPLACE">replace it with the bundled one</option>
                </select>
                {storyMode === 'REPLACE' && (
                  <span className="ms-1" data-testid="matches-deleted">
                    — deletes {story.matchesDeleted ?? 0} match(es) of that story
                  </span>
                )}
              </label>
            )}
            <label>
              <input type="checkbox" checked={startPaused} className="me-1"
                     onChange={(e) => change({ startPaused: e.target.checked })} />Start paused
            </label>
            <button className="pg-btn pg-btn-gold" disabled={busy || !check.valid}
                    onClick={() => { void doImport() }}>
              <i className="fas fa-file-import me-1" />Import
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="pg-card" data-testid="import-result">
          <p>
            Imported at clock {result.snapshotClock}: the match is now at clock {result.clock}, {result.matchStatus}
            ({result.usersCreated} user(s) created, {result.logsImported} log rows).
          </p>
          <Link to={`/matches/${result.uuidMatch}`} className="pg-btn pg-btn-ghost">Open the match</Link>
        </div>
      )}
    </div>
  )
}
