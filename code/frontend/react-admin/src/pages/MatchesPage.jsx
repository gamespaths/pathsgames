import { useEffect, useState } from 'react'
import { listMatches, getMatchInfo } from '../api/matchApi'
import LoadingSpinner from '../components/common/LoadingSpinner'
import ErrorAlert from '../components/common/ErrorAlert'

/**
 * MatchesPage (v0.19.10) — admin view of the single-player matches.
 *
 * Lists the matches returned by GET /api/matches and opens the per-match
 * runtime state (GET /api/match/{uuid}/info) in a detail modal. The match
 * endpoints expose no mutating operations yet, so the available operation is
 * inspecting a match.
 */

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString()
}

function shortUuid(uuid) {
  return uuid ? `${uuid.slice(0, 8)}…` : '—'
}

const STATUS_BADGE = {
  CREATED:  'pg-badge-info',
  RUNNING:  'pg-badge-success',
  PAUSED:   'pg-badge-gold',
  ENDED:    'pg-badge-gold',
  GAMEOVER: 'pg-badge-danger',
}

const STATUSES = ['CREATED', 'RUNNING', 'PAUSED', 'ENDED', 'GAMEOVER']

function StatusBadge({ status }) {
  return <span className={`pg-badge ${STATUS_BADGE[status] || 'pg-badge-info'}`}>{status || '—'}</span>
}

export default function MatchesPage() {
  const [matches,      setMatches]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [filter,       setFilter]       = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [detail,       setDetail]       = useState(null) // { uuid, loading, info, error }

  const load = () => {
    setLoading(true)
    setError('')
    listMatches()
      .then(data => setMatches(Array.isArray(data) ? data : []))
      .catch(e => setError(e.message || 'Failed to load matches'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const openDetail = async (uuid) => {
    setDetail({ uuid, loading: true, info: null, error: '' })
    try {
      const info = await getMatchInfo(uuid)
      setDetail({ uuid, loading: false, info, error: '' })
    } catch (e) {
      setDetail({ uuid, loading: false, info: null, error: e.message || 'Failed to load match info' })
    }
  }

  const filtered = matches.filter(m => {
    const text = filter.toLowerCase()
    const textMatch = !text ||
      m.name?.toLowerCase().includes(text) ||
      m.uuid?.toLowerCase().includes(text) ||
      m.storyUuid?.toLowerCase().includes(text)
    return textMatch && (!statusFilter || m.status === statusFilter)
  })

  const counts = {
    total:   matches.length,
    created: matches.filter(m => m.status === 'CREATED').length,
    running: matches.filter(m => m.status === 'RUNNING').length,
    ended:   matches.filter(m => m.status === 'ENDED' || m.status === 'GAMEOVER').length,
  }

  return (
    <div>
      <h2 className="pg-page-title"><i className="fas fa-gamepad" />Matches</h2>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Total',   value: counts.total,   icon: 'fas fa-gamepad' },
          { label: 'Created', value: counts.created, icon: 'fas fa-hourglass-start', cls: 'text-blue-400' },
          { label: 'Running', value: counts.running, icon: 'fas fa-play-circle',     cls: 'text-green-400' },
          { label: 'Ended',   value: counts.ended,   icon: 'fas fa-flag-checkered',  cls: '' },
        ].map(s => (
          <div key={s.label} className="pg-card text-center">
            <div className="pg-card-title"><i className={`${s.icon} me-1`} />{s.label}</div>
            <div className={`pg-stat-value ${s.cls || ''}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <ErrorAlert message={error} onClose={() => setError('')} />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-ash)', fontSize: '0.8rem' }} />
          <input
            className="pg-input pl-8"
            placeholder="Filter by name, match or story UUID…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>
        <select
          className="pg-input"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="pg-btn pg-btn-ghost" onClick={load}>
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
                  <th>Status</th>
                  <th>Mode</th>
                  <th>Clock</th>
                  <th>XP Cost</th>
                  <th>Created</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--color-ash)' }}>No matches found.</td></tr>
                )}
                {filtered.map(m => (
                  <tr key={m.uuid}>
                    <td>
                      <i className="fas fa-gamepad me-1" style={{ color: 'var(--color-ash)', fontSize: '0.75rem' }} />
                      {m.name || <em style={{ color: 'var(--color-ash)' }}>untitled</em>}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--color-ash)' }}>{shortUuid(m.uuid)}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--color-ash)' }}>{shortUuid(m.storyUuid)}</td>
                    <td><StatusBadge status={m.status} /></td>
                    <td>
                      {m.singlePlayer === 0
                        ? <span className="pg-badge pg-badge-gold">Multiplayer</span>
                        : <span className="pg-badge pg-badge-info">Single</span>}
                    </td>
                    <td>{m.currentClock ?? 0}</td>
                    <td>{m.expCost ?? 0}</td>
                    <td style={{ fontSize: '0.8rem' }}>{fmtDate(m.tsInsert)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="pg-btn pg-btn-ghost pg-btn-sm"
                        title="View detail"
                        onClick={() => openDetail(m.uuid)}
                      >
                        <i className="fas fa-eye" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detail && <MatchDetailModal detail={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

/** Modal showing the runtime state of a single match. */
function MatchDetailModal({ detail, onClose }) {
  const { uuid, loading, info, error } = detail
  const match = info?.match

  return (
    <div className="pg-modal-backdrop" onClick={onClose}>
      <div className="pg-modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <p className="pg-modal-title">
          <i className="fas fa-gamepad me-2" />
          {match?.name || `Match ${shortUuid(uuid)}`}
        </p>

        {loading && <LoadingSpinner text="Loading match info…" />}
        <ErrorAlert message={error} />

        {!loading && info && (
          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {/* Summary */}
            <table className="pg-table" style={{ fontSize: '0.82rem', marginBottom: '1rem' }}>
              <tbody>
                {Object.entries(match || {}).map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ fontFamily: 'Cinzel, serif', fontSize: '0.7rem', color: 'var(--color-gold-dark)', whiteSpace: 'nowrap' }}>{k}</td>
                    <td style={{ wordBreak: 'break-all', color: 'var(--color-parchment)' }}>
                      {v === null || v === undefined
                        ? <em style={{ color: 'var(--color-ash)' }}>null</em>
                        : Array.isArray(v) ? (v.length ? v.join(', ') : <em style={{ color: 'var(--color-ash)' }}>empty</em>)
                        : String(v)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="pg-card-title mb-2">
              <i className="fas fa-map-marker-alt me-1" />
              Current location: {info.currentLocationName || '—'}
            </p>

            {/* Location state */}
            <p className="pg-card-title mb-1"><i className="fas fa-map me-1" />Locations ({info.locations?.length ?? 0})</p>
            <table className="pg-table" style={{ fontSize: '0.78rem', marginBottom: '1rem' }}>
              <thead>
                <tr><th>idLocation</th><th>UUID</th><th>Activated</th><th>Clock</th></tr>
              </thead>
              <tbody>
                {(info.locations ?? []).length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-ash)' }}>No locations.</td></tr>
                )}
                {(info.locations ?? []).map(l => (
                  <tr key={l.uuid ?? l.idLocation}>
                    <td>{l.idLocation}</td>
                    <td style={{ fontFamily: 'monospace' }}>{shortUuid(l.uuid)}</td>
                    <td>{l.flagAlreadyActived ? 'yes' : 'no'}</td>
                    <td>{l.clockCounter ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Registry */}
            <p className="pg-card-title mb-1"><i className="fas fa-list me-1" />Registry ({info.registry?.length ?? 0})</p>
            <table className="pg-table" style={{ fontSize: '0.78rem' }}>
              <thead>
                <tr><th>Key</th><th>String value</th><th>Int value</th></tr>
              </thead>
              <tbody>
                {(info.registry ?? []).length === 0 && (
                  <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--color-ash)' }}>No registry entries.</td></tr>
                )}
                {(info.registry ?? []).map(r => (
                  <tr key={r.uuid ?? r.key}>
                    <td>{r.key}</td>
                    <td style={{ wordBreak: 'break-all' }}>{r.stringValue ?? '—'}</td>
                    <td>{r.intValue ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end mt-3">
          <button className="pg-btn pg-btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
