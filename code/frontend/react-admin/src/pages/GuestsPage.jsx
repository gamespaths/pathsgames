import { useEffect, useState } from 'react'
import { listGuests, getGuestStats, deleteGuest, deleteExpiredGuests } from '../api/guestApi'
import LoadingSpinner from '../components/common/LoadingSpinner'
import ErrorAlert from '../components/common/ErrorAlert'
import ConfirmModal from '../components/common/ConfirmModal'

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

export default function GuestsPage() {
  const [guests,    setGuests]    = useState([])
  const [stats,     setStats]     = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [success,   setSuccess]   = useState('')
  const [filter,    setFilter]    = useState('')
  const [modal,     setModal]     = useState(null) // { type: 'single'|'cleanup', uuid? }
  const [detail,    setDetail]    = useState(null) // guest detail modal

  const load = () => {
    setLoading(true)
    setError('')
    Promise.allSettled([listGuests(), getGuestStats()])
      .then(([g, s]) => {
        if (g.status === 'fulfilled') setGuests(g.value)
        else setError(g.reason?.message || 'Failed to load guests')
        if (s.status === 'fulfilled') setStats(s.value)
        setLoading(false)
      })
  }

  useEffect(load, [])

  const confirmDelete = (uuid) => setModal({ type: 'single', uuid })
  const confirmCleanup = ()    => setModal({ type: 'cleanup' })

  const handleConfirm = async () => {
    const m = modal
    setModal(null)
    try {
      if (m.type === 'single') {
        await deleteGuest(m.uuid)
        setSuccess(`Guest ${m.uuid.slice(0, 8)}… deleted.`)
      } else {
        const res = await deleteExpiredGuests()
        setSuccess(`Cleanup done: ${res.deletedCount} expired sessions removed.`)
      }
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  const filtered = guests.filter(g =>
    !filter ||
    g.username?.toLowerCase().includes(filter.toLowerCase()) ||
    g.userUuid?.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div>
      <h2 className="pg-page-title"><i className="fas fa-user-secret" />Guest Users</h2>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-5">
          {[
            { label: 'Total',   value: stats.totalGuests,   icon: 'fas fa-users' },
            { label: 'Active',  value: stats.activeGuests,  icon: 'fas fa-user-check', cls: 'text-green-400' },
            { label: 'Expired', value: stats.expiredGuests, icon: 'fas fa-user-clock',  cls: 'text-red-400'  },
          ].map(s => (
            <div key={s.label} className="pg-card text-center">
              <div className="pg-card-title"><i className={`${s.icon} me-1`} />{s.label}</div>
              <div className={`pg-stat-value ${s.cls || ''}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      <ErrorAlert message={error} onClose={() => setError('')} />
      {success && (
        <div className="pg-alert pg-alert-success mb-4">
          <i className="fas fa-check-circle me-2" />{success}
          <button className="ml-auto opacity-60 hover:opacity-100" onClick={() => setSuccess('')}><i className="fas fa-times" /></button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-ash)', fontSize: '0.8rem' }} />
          <input
            className="pg-input pl-8"
            placeholder="Filter by username or UUID…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>
        <button className="pg-btn pg-btn-ghost" onClick={load}>
          <i className="fas fa-sync-alt" /> Refresh
        </button>
        <button className="pg-btn pg-btn-danger" onClick={confirmCleanup} disabled={!stats?.expiredGuests}>
          <i className="fas fa-trash-alt" /> Cleanup Expired ({stats?.expiredGuests ?? 0})
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingSpinner text="Loading guests…" />
      ) : (
        <div className="pg-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="pg-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>UUID</th>
                  <th>Role</th>
                  <th>State</th>
                  <th>Status</th>
                  <th>Registered</th>
                  <th>Last Access</th>
                  <th>Expires</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--color-ash)' }}>No guests found.</td></tr>
                )}
                {filtered.map(g => (
                  <tr key={g.userUuid}>
                    <td>
                      <i className="fas fa-user-secret me-1" style={{ color: 'var(--color-ash)', fontSize: '0.75rem' }} />
                      {g.username}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--color-ash)' }}>
                      {g.userUuid?.slice(0, 8)}…
                    </td>
                    <td><span className="pg-badge pg-badge-info">{g.role}</span></td>
                    <td><span className="pg-badge pg-badge-gold">{g.state}</span></td>
                    <td>
                      {g.expired
                        ? <span className="pg-badge pg-badge-danger"><i className="fas fa-times me-1" />Expired</span>
                        : <span className="pg-badge pg-badge-success"><i className="fas fa-check me-1" />Active</span>
                      }
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>{fmtDate(g.tsRegistration)}</td>
                    <td style={{ fontSize: '0.8rem' }}>{fmtDate(g.tsLastAccess)}</td>
                    <td style={{ fontSize: '0.8rem' }}>{fmtDate(g.guestExpiresAt)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="pg-btn pg-btn-ghost pg-btn-sm me-1"
                        title="View detail"
                        onClick={() => setDetail(g)}
                      >
                        <i className="fas fa-eye" />
                      </button>
                      <button
                        className="pg-btn pg-btn-danger pg-btn-sm"
                        title="Delete"
                        onClick={() => confirmDelete(g.userUuid)}
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

      {/* Confirm modals */}
      {modal?.type === 'single' && (
        <ConfirmModal
          title="Delete Guest"
          message={`Are you sure you want to delete guest ${modal.uuid}? This cannot be undone.`}
          onConfirm={handleConfirm}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === 'cleanup' && (
        <ConfirmModal
          title="Cleanup Expired Sessions"
          message={`This will delete all ${stats?.expiredGuests} expired guest sessions and their tokens. Continue?`}
          onConfirm={handleConfirm}
          onCancel={() => setModal(null)}
        />
      )}

      {/* Detail modal */}
      {detail && (
        <div className="pg-modal-backdrop" onClick={() => setDetail(null)}>
          <div className="pg-modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <p className="pg-modal-title">
              <i className="fas fa-user-secret me-2" />
              {detail.username}
            </p>
            <table className="pg-table" style={{ fontSize: '0.85rem' }}>
              <tbody>
                {Object.entries(detail).map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ fontFamily: 'Cinzel, serif', fontSize: '0.7rem', color: 'var(--color-gold-dark)', whiteSpace: 'nowrap' }}>{k}</td>
                    <td style={{ wordBreak: 'break-all', color: 'var(--color-parchment)' }}>
                      {v === null ? <em style={{ color: 'var(--color-ash)' }}>null</em>
                        : v === true ? <span className="pg-badge pg-badge-success">true</span>
                        : v === false ? <span className="pg-badge pg-badge-danger">false</span>
                        : String(v)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end mt-3">
              <button className="pg-btn pg-btn-ghost" onClick={() => setDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
