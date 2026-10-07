import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  listMatches, getMatchInfo, listMatchStatuses,
  updateMatch, stopMatch, deleteMatch,
  listMatchSnapshots, exportMatch, errorBody,
} from '../api/matchApi'
import LoadingSpinner from '../components/common/LoadingSpinner'
import ErrorAlert from '../components/common/ErrorAlert'
import ConfirmModal from '../components/common/ConfirmModal'
import useEscapeKey from '../hooks/useEscapeKey'
import { downloadJson } from '../utils/download'
import MatchDetailModal, { fmtDate, shortUuid, StatusBadge, fetchStoryCtx } from '../components/match/MatchDetailModal'

/**
 * MatchesPage — admin view of the matches.
 *
 * Lists every match (GET /api/admin/matches) and lets an admin:
 *   - inspect the runtime state (GET /api/match/{uuid}/info);
 *   - edit a match — status and name (PUT /api/admin/matches/{uuid});
 *   - export the latest snapshot as a file (POST /api/admin/matches/{uuid}/export, v0.41.4);
 *   - stop a running match (POST /api/admin/matches/{uuid}/stop);
 *   - delete a stopped match (DELETE /api/admin/matches/{uuid}).
 */

// Fallback used until GET /api/admin/matches/statuses resolves (or if it fails).
const DEFAULT_STATUSES = [
  { value: 'CREATED',  terminal: false },
  { value: 'RUNNING',  terminal: false },
  { value: 'PAUSED',   terminal: false },
  { value: 'ENDED',    terminal: true },
  { value: 'GAMEOVER', terminal: true },
]

// v0.28.1 — server-side scope (maps to the ?sinceDays= query param).
const PERIODS = [
  { label: 'All time',     value: '' },
  { label: 'Last 7 days',  value: '7' },
  { label: 'Last 30 days', value: '30' },
  { label: 'Last 90 days', value: '90' },
]

const PAGE_LIMIT = 50

/** The creator as the guest username shown in the game (`guest_` + first 8 chars of the user UUID). */
export const creatorLabel = uuid => (uuid ? `guest_${String(uuid).slice(0, 8)}` : '')

export default function MatchesPage() {
  const [matches,      setMatches]      = useState([])
  const [nextCursor,   setNextCursor]   = useState(null)
  const [loadingMore,  setLoadingMore]  = useState(false)
  const [statuses,     setStatuses]     = useState(DEFAULT_STATUSES)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [filter,       setFilter]       = useState('')
  const [statusFilter, setStatusFilter] = useState('RUNNING') // default scope: running matches
  const [period,       setPeriod]       = useState('') // sinceDays scope
  const [detail,       setDetail]       = useState(null) // { uuid, loading, info, error, storyCtx }
  const [editing,      setEditing]      = useState(null) // match being edited
  const [confirm,      setConfirm]      = useState(null) // { action, match }
  const [snapshots,    setSnapshots]    = useState({})   // match uuid -> latest snapshot row | null
  const [notice,       setNotice]       = useState('')

  const navigate = useNavigate()
  const terminalStatuses = new Set(statuses.filter(s => s.terminal).map(s => s.value))
  const isTerminal = (status) => terminalStatuses.has(status)

  // Status + period are applied server-side (the table never reads the whole
  // table); the text box filters the already-loaded rows client-side.
  const queryParams = () => {
    const p = { limit: PAGE_LIMIT }
    if (statusFilter) p.status = statusFilter
    if (period) p.sinceDays = Number(period)
    return p
  }

  const load = () => {
    setLoading(true)
    setError('')
    listMatches(queryParams())
      .then(env => {
        setMatches(Array.isArray(env?.items) ? env.items : [])
        setNextCursor(env?.nextCursor ?? null)
      })
      .catch(e => setError(e.message || 'Failed to load matches'))
      .finally(() => setLoading(false))
  }

  const loadMore = () => {
    if (!nextCursor) return
    setLoadingMore(true)
    setError('')
    listMatches({ ...queryParams(), cursor: nextCursor })
      .then(env => {
        setMatches(prev => [...prev, ...(Array.isArray(env?.items) ? env.items : [])])
        setNextCursor(env?.nextCursor ?? null)
      })
      .catch(e => setError(e.message || 'Failed to load more matches'))
      .finally(() => setLoadingMore(false))
  }

  // Reload from the first page whenever the server-side filters change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [statusFilter, period])

  // v0.41.4 — the latest snapshot of every loaded row, which enables its Export button.
  const loadSnapshots = (uuids) => Promise.all(uuids.map(uuid =>
    listMatchSnapshots(uuid)
      .then(rows => [uuid, Array.isArray(rows) && rows.length ? rows[0] : null])
      .catch(() => [uuid, null])))
    .then(pairs => setSnapshots(prev => ({ ...prev, ...Object.fromEntries(pairs) })))

  useEffect(() => {
    const missing = matches.map(m => m.uuid).filter(uuid => !(uuid in snapshots))
    if (missing.length) void loadSnapshots(missing)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches])

  useEffect(() => {
    listMatchStatuses()
      .then(data => { if (Array.isArray(data) && data.length) setStatuses(data) })
      .catch(() => setStatuses(DEFAULT_STATUSES))
  }, [])

  const openDetail = async (uuid, storyUuid) => {
    setDetail({ uuid, loading: true, info: null, error: '', storyCtx: null })
    try {
      const [info, storyCtx] = await Promise.all([
        getMatchInfo(uuid),
        fetchStoryCtx(storyUuid),
      ])
      setDetail({ uuid, loading: false, info, error: '', storyCtx })
    } catch (e) {
      setDetail({ uuid, loading: false, info: null, error: e.message || 'Failed to load match info', storyCtx: null })
    }
  }

  const exportLatest = async (match) => {
    const { text, fileName } = await exportMatch(match.uuid)
    downloadJson(text, fileName)
    setNotice(`Exported the end of clock ${snapshots[match.uuid]?.clock ?? '?'} as ${fileName}.`)
    await loadSnapshots([match.uuid])
  }

  const runConfirm = async () => {
    const { action, match } = confirm
    setConfirm(null)
    setError('')
    setNotice('')
    try {
      if (action === 'export') { await exportLatest(match); load(); return }
      if (action === 'stop')   await stopMatch(match.uuid)
      if (action === 'delete') await deleteMatch(match.uuid)
      load()
    } catch (e) {
      const body = errorBody(e)
      const codes = Array.isArray(body.errors) ? body.errors.map(x => x.code).join(', ') : ''
      setError((body.message || e.message || `Failed to ${action} match`) + (codes ? ` (${codes})` : ''))
    }
  }

  // Status/period are filtered server-side; the text box narrows the loaded rows.
  const filtered = matches.filter(m => {
    const text = filter.toLowerCase()
    return !text ||
      m.name?.toLowerCase().includes(text) ||
      m.uuid?.toLowerCase().includes(text) ||
      m.storyUuid?.toLowerCase().includes(text) ||
      m.userCreatorUuid?.toLowerCase().includes(text) ||
      (!!m.userCreatorUuid && creatorLabel(m.userCreatorUuid).includes(text))
  })

  // Counts reflect the rows loaded so far (load more to fetch additional pages).
  const counts = {
    total:   matches.length,
    created: matches.filter(m => m.status === 'CREATED').length,
    running: matches.filter(m => m.status === 'RUNNING').length,
    ended:   matches.filter(m => m.status === 'ENDED' || m.status === 'GAMEOVER').length,
  }

  return (
    <div>
      {/* Title + compact counters on a single row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="pg-page-title" style={{ margin: 0 }}><i className="fas fa-gamepad" />Matches</h2>
        {/* v0.41.4 — a match export file from any server */}
        <button className="pg-btn pg-btn-ghost pg-btn-sm" onClick={() => navigate('/matches/import')}>
          <i className="fas fa-file-import me-1" />Import
        </button>
        <div className="flex items-center gap-2">
          {[
            { label: 'Loaded',  value: counts.total,   icon: 'fas fa-gamepad',         cls: '' },
            { label: 'Created', value: counts.created, icon: 'fas fa-hourglass-start', cls: 'text-blue-400' },
            { label: 'Running', value: counts.running, icon: 'fas fa-play-circle',     cls: 'text-green-400' },
            { label: 'Ended',   value: counts.ended,   icon: 'fas fa-flag-checkered',  cls: '' },
          ].map(s => (
            <div
              key={s.label}
              className="pg-card"
              style={{ padding: '0.3rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}
            >
              <i className={`${s.icon} ${s.cls}`} style={{ fontSize: '0.78rem' }} />
              <span style={{ color: 'var(--color-ash)', fontSize: '0.72rem' }}>{s.label}</span>
              <span className={s.cls} style={{ fontWeight: 700, fontSize: '0.9rem' }}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      <ErrorAlert message={error} onClose={() => setError('')} />
      {notice && <div className="pg-alert pg-alert-success mb-3" role="status">{notice}</div>}

      {/* Toolbar — search grows, selects + button stay on the same row */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-0">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-ash)', fontSize: '0.8rem' }} />
          <input
            className="pg-input pl-8"
            placeholder="Filter by name, match, story or user (guest_…)…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>
        <select
          className="pg-input"
          style={{ width: 'auto', flex: '0 0 auto' }}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {statuses.map(s => <option key={s.value} value={s.value}>{s.value}</option>)}
        </select>
        <select
          className="pg-input"
          style={{ width: 'auto', flex: '0 0 auto' }}
          value={period}
          onChange={e => setPeriod(e.target.value)}
          aria-label="Filter by period"
        >
          {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <button className="pg-btn pg-btn-ghost" style={{ flex: '0 0 auto', whiteSpace: 'nowrap' }} onClick={load}>
          <i className="fas fa-sync-alt" /> Refresh
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingSpinner text="Loading matches…" />
      ) : (
        <div className="pg-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="pg-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Match UUID</th>
                  <th>Story UUID</th>
                  <th>User</th>
                  <th>Status</th>
                  <th>Clock</th>
                  <th>Created</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--color-ash)' }}>No matches found.</td></tr>
                )}
                {filtered.map(m => (
                  <tr key={m.uuid}>
                    <td>
                      <i className="fas fa-gamepad me-1" style={{ color: 'var(--color-ash)', fontSize: '0.75rem' }} />
                      {m.name || <em style={{ color: 'var(--color-ash)' }}>untitled</em>}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--color-ash)' }}>{shortUuid(m.uuid)}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--color-ash)' }}>{shortUuid(m.storyUuid)}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--color-ash)' }}
                      title={m.userCreatorUuid || undefined}>{creatorLabel(m.userCreatorUuid) || '—'}</td>
                    <td><StatusBadge status={m.status} /></td>
                    <td>{m.currentClock ?? 0}</td>
                    <td style={{ fontSize: '0.8rem' }}>{fmtDate(m.tsInsert)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        className="pg-btn pg-btn-ghost pg-btn-sm"
                        title="View detail"
                        onClick={() => openDetail(m.uuid, m.storyUuid)}
                      >
                        <i className="fas fa-eye" />
                      </button>
                      <button
                        className="pg-btn pg-btn-ghost pg-btn-sm"
                        title="Open details page (players & characters)"
                        onClick={() => navigate(`/matches/${m.uuid}`)}
                      >
                        <i className="fas fa-up-right-from-square" />
                      </button>
                      <button
                        className="pg-btn pg-btn-ghost pg-btn-sm"
                        title="Edit match"
                        onClick={() => setEditing(m)}
                      >
                        <i className="fas fa-pen" />
                      </button>
                      {snapshots[m.uuid] && (
                        <button
                          className="pg-btn pg-btn-ghost pg-btn-sm"
                          title={`Export the latest snapshot (end of clock ${snapshots[m.uuid].clock})`}
                          aria-label="Export match"
                          onClick={() => setConfirm({ action: 'export', match: m })}
                        >
                          <i className="fas fa-file-export" />
                        </button>
                      )}
                      {!isTerminal(m.status) && (
                        <button
                          className="pg-btn pg-btn-ghost pg-btn-sm"
                          title="Stop match"
                          onClick={() => setConfirm({ action: 'stop', match: m })}
                        >
                          <i className="fas fa-stop" />
                        </button>
                      )}
                      <button
                        className="pg-btn pg-btn-ghost pg-btn-sm"
                        title={isTerminal(m.status) ? 'Delete match' : 'Stop the match before deleting it'}
                        disabled={!isTerminal(m.status)}
                        onClick={() => setConfirm({ action: 'delete', match: m })}
                      >
                        <i className="fas fa-trash" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Server-side pagination footer (v0.28.1) — always visible so the paging
          state is clear; the button fetches the next page via the cursor. */}
      {!loading && matches.length > 0 && (
        <div className="flex items-center justify-between mt-4">
          <span style={{ color: 'var(--color-ash)', fontSize: '0.85rem' }}>
            Showing {filtered.length} of {matches.length} loaded
            {nextCursor ? ' — more available' : ' — all loaded'}
          </span>
          <button
            className="pg-btn pg-btn-ghost"
            onClick={loadMore}
            disabled={loadingMore || !nextCursor}
          >
            <i className="fas fa-angles-down" />{' '}
            {loadingMore ? 'Loading…' : nextCursor ? 'Load more' : 'No more pages'}
          </button>
        </div>
      )}

      {detail && <MatchDetailModal detail={detail} onClose={() => setDetail(null)} />}

      {editing && (
        <MatchEditModal
          match={editing}
          statuses={statuses}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}

      {confirm && (
        <ConfirmModal
          title={{ stop: 'Stop match', delete: 'Delete match', export: 'Export match' }[confirm.action]}
          message={{
            stop: `Set "${confirm.match.name || confirm.match.uuid}" to ENDED?`,
            delete: `Permanently delete "${confirm.match.name || confirm.match.uuid}" and its runtime state? This cannot be undone.`,
            export: `Export "${confirm.match.name || confirm.match.uuid}" as a file? This pauses the match, rolls it back to the snapshot of clock ${snapshots[confirm.match.uuid]?.clock ?? '?'} (the actions since are lost), then restarts it.`,
          }[confirm.action]}
          onConfirm={runConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}

/** Modal to edit a match — status and name. */
function MatchEditModal({ match, statuses, onClose, onSaved }) {
  useEscapeKey(onClose)
  const [name,   setName]   = useState(match.name || '')
  const [status, setStatus] = useState(match.status || '')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await updateMatch(match.uuid, { status, name })
      onSaved()
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Failed to update match')
      setSaving(false)
    }
  }

  return (
    <div className="pg-modal-backdrop" role="presentation" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pg-modal" style={{ maxWidth: 460 }}>
        <p className="pg-modal-title"><i className="fas fa-pen me-2" />Edit match</p>

        <ErrorAlert message={error} />

        <label className="pg-label" htmlFor="match-edit-name">Name</label>
        <input
          id="match-edit-name"
          className="pg-input mb-3"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Match name"
        />

        <label className="pg-label" htmlFor="match-edit-status">Status</label>
        <select
          id="match-edit-status"
          className="pg-input mb-4"
          value={status}
          onChange={e => setStatus(e.target.value)}
        >
          {statuses.map(s => <option key={s.value} value={s.value}>{s.value}</option>)}
        </select>

        <div className="flex gap-2 justify-end">
          <button className="pg-btn pg-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="pg-btn pg-btn-gold" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
