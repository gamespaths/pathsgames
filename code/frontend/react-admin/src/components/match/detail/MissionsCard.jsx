import { useState } from 'react'
import { UuidCopy } from './matchDetailShared'

/**
 * MissionsCard — Step 37 missions of a match, the read-only twin of the registry panel:
 * a mission IS a projection of the registry, so the console shows it beside it, never edits it.
 */

// AVAILABLE opened and waits, ACTIVE is walking its steps, the last two are final.
const STATUS_BADGE = {
  AVAILABLE: 'pg-badge-info',
  ACTIVE:    'pg-badge-warning',
  COMPLETED: 'pg-badge-success',
  FAILED:    'pg-badge-danger',
}

function StatusChip({ status }) {
  const cls = STATUS_BADGE[status] || 'pg-badge-info'
  return <span className={`pg-badge ${cls}`}>{status || '—'}</span>
}

export default function MissionsCard({ missions }) {
  const rows = missions ?? []
  const [open, setOpen] = useState(null)   // uuid of the mission whose steps are unfolded

  const counts = rows.reduce((acc, m) => {
    acc[m.status] = (acc[m.status] ?? 0) + 1
    return acc
  }, {})

  // A mission with no steps completes on its own condition: there is no progress to show.
  const progress = (m) => {
    if (!m.stepsTotal) return '—'
    const done = (m.steps ?? []).filter(s => s.done).length
    return `${done} / ${m.stepsTotal}`
  }

  return (
    <div className="pg-card mb-4" style={{ padding: 0, overflow: 'hidden' }} data-testid="missions-panel">
      <p className="pg-card-title" style={{ padding: '0.75rem 1rem 0' }}>
        <i className="fas fa-flag-checkered me-1" />Missions ({rows.length})
        {rows.length > 0 && (
          <span style={{ color: 'var(--color-ash)', fontWeight: 'normal', fontSize: '0.78rem' }}>
            {' '}· {Object.entries(counts).map(([s, n]) => `${n} ${s.toLowerCase()}`).join(' · ')}
          </span>
        )}
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table className="pg-table" style={{ fontSize: '0.78rem' }}>
          <thead>
            <tr><th>Mission</th><th>Uuid</th><th>Status</th><th>Steps</th><th>Reached</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-ash)' }}>
                {/* Not "none authored": a mission the match never reached is never listed. */}
                No mission reached by this match.
              </td></tr>
            )}
            {rows.map(m => (
              <tr key={m.uuid}>
                <td>
                  {m.stepsTotal > 0 ? (
                    <button className="pg-btn pg-btn-sm pg-btn-ghost" style={{ padding: 0 }}
                            aria-label={`Steps of ${m.name || m.uuid}`}
                            aria-expanded={open === m.uuid}
                            onClick={() => setOpen(open === m.uuid ? null : m.uuid)}>
                      <i className={`fas fa-caret-${open === m.uuid ? 'down' : 'right'} me-1`} />
                      {m.name || '—'}
                    </button>
                  ) : (m.name || '—')}
                  {m.description && (
                    <div style={{ color: 'var(--color-ash)', fontSize: '0.72rem' }}>
                      {m.description}
                    </div>
                  )}
                  {open === m.uuid && (
                    <ol style={{ margin: '0.4rem 0 0', paddingLeft: '1.1rem' }}>
                      {(m.steps ?? []).map(s => (
                        <li key={s.uuid} style={{ color: s.done ? 'inherit' : 'var(--color-ash)' }}>
                          <i className={`fas fa-${s.done ? 'check' : 'hourglass-half'} me-1`}
                             title={s.done ? 'closed' : 'still open'} />
                          {s.step != null ? `${s.step}. ` : ''}{s.name || s.uuid}
                        </li>
                      ))}
                    </ol>
                  )}
                </td>
                <td><UuidCopy uuid={m.uuid} /></td>
                <td><StatusChip status={m.status} /></td>
                <td>{progress(m)}</td>
                <td>{m.stepReached ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
