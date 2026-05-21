import { useEffect, useState } from 'react'
import { listGuests, getGuestStats, deleteGuest, deleteExpiredGuests } from '../api/guestApi'
import {
  listMatches, getMatchInfo,
  stopMatch, pauseMatch, resumeMatch,
} from '../api/matchApi'
import LoadingSpinner from '../components/common/LoadingSpinner'
import ErrorAlert from '../components/common/ErrorAlert'
import ConfirmModal from '../components/common/ConfirmModal'
import MatchDetailModal, { fmtDate, shortUuid, StatusBadge, fetchStoryCtx } from '../components/match/MatchDetailModal'

const TERMINAL_STATUSES = new Set(['ENDED', 'GAMEOVER'])
const isTerminal = (s) => TERMINAL_STATUSES.has(s)

export default function GuestsPage() {
  const [guests,       setGuests]       = useState([])
  const [stats,        setStats]        = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [success,      setSuccess]      = useState('')
  const [filter,       setFilter]       = useState('')
  const [modal,        setModal]        = useState(null) // { type: 'single'|'cleanup', uuid? }
  const [guestDetail,  setGuestDetail]  = useState(null) // guest object
  const [userMatches,  setUserMatches]  = useState({ loading: false, list: [], error: '' })
  const [matchDetail,  setMatchDetail]  = useState(null) // { uuid, loading, info, error, storyCtx }
  const [matchError,   setMatchError]   = useState('')   // inline action error

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

  const openGuestDetail = async (guest) => {
    setGuestDetail(guest)
    setUserMatches({ loading: true, list: [], error: '' })
    setMatchError('')
    try {
      const all = await listMatches()
      const list = (Array.isArray(all) ? all : []).filter(m => m.userCreatorUuid === guest.userUuid)
      setUserMatches({ loading: false, list, error: '' })
    } catch (e) {
      setUserMatches({ loading: false, list: [], error: e.message || 'Failed to load matches' })
    }
  }

  const closeGuestDetail = () => {
    setGuestDetail(null)
    setUserMatches({ loading: false, list: [], error: '' })
    setMatchDetail(null)
    setMatchError('')
  }

  const openMatchDetail = async (m) => {
    setMatchDetail({ uuid: m.uuid, loading: true, info: null, error: '', storyCtx: null })
    try {
      const [info, storyCtx] = await Promise.all([
        getMatchInfo(m.uuid),
        fetchStoryCtx(m.storyUuid),
      ])
      setMatchDetail({ uuid: m.uuid, loading: false, info, error: '', storyCtx })
    } catch (e) {
      setMatchDetail({ uuid: m.uuid, loading: false, info: null, error: e.message || 'Failed to load match info', storyCtx: null })
    }
  }

  const doMatchAction = async (action, matchUuid) => {
    setMatchError('')
    try {
      if (action === 'stop')   await stopMatch(matchUuid)
      if (action === 'pause')  await pauseMatch(matchUuid)
      if (action === 'resume') await resumeMatch(matchUuid)
      // Refresh user matches list
      const all = await listMatches()
      const list = (Array.isArray(all) ? all : []).filter(m => m.userCreatorUuid === guestDetail.userUuid)
      setUserMatches(prev => ({ ...prev, list }))
    } catch (e) {
      setMatchError(e.response?.data?.message || e.message || `Failed to ${action} match`)
    }
  }

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
                        onClick={() => openGuestDetail(g)}
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

      {/* Guest detail modal */}
      {guestDetail && (
        <div className="pg-modal-backdrop" onClick={closeGuestDetail}>
          <div className="pg-modal" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
            <p className="pg-modal-title">
              <i className="fas fa-user-secret me-2" />
              {guestDetail.username}
            </p>

            <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {/* Guest fields */}
              <p className="pg-card-title mb-2"><i className="fas fa-id-card me-1" />User info</p>
              <table className="pg-table" style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                <tbody>
                  {Object.entries(guestDetail).map(([k, v]) => (
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

              {/* Matches section */}
              <p className="pg-card-title mb-2"><i className="fas fa-gamepad me-1" />Matches</p>

              {matchError && <ErrorAlert message={matchError} onClose={() => setMatchError('')} />}

              {userMatches.loading && <LoadingSpinner text="Loading matches…" />}
              {userMatches.error && <ErrorAlert message={userMatches.error} />}

              {!userMatches.loading && (
                <table className="pg-table" style={{ fontSize: '0.8rem', marginBottom: '1rem' }}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Status</th>
                      <th>Story UUID</th>
                      <th>Created</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userMatches.list.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-ash)' }}>
                          No matches for this user.
                        </td>
                      </tr>
                    )}
                    {userMatches.list.map(m => (
                      <tr key={m.uuid}>
                        <td>
                          {m.name || <em style={{ color: 'var(--color-ash)' }}>untitled</em>}
                          <span style={{ fontFamily: 'monospace', fontSize: '0.65rem', color: 'var(--color-ash)', marginLeft: 6 }}>
                            {shortUuid(m.uuid)}
                          </span>
                        </td>
                        <td><StatusBadge status={m.status} /></td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--color-ash)' }}>
                          {shortUuid(m.storyUuid)}
                        </td>
                        <td style={{ fontSize: '0.75rem' }}>{fmtDate(m.tsInsert)}</td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {/* View match detail */}
                          <button
                            className="pg-btn pg-btn-ghost pg-btn-sm"
                            title="View match detail"
                            onClick={() => openMatchDetail(m)}
                          >
                            <i className="fas fa-eye" />
                          </button>
                          {/* Active-match state transitions */}
                          {!isTerminal(m.status) && (
                            <>
                              {m.status === 'RUNNING' && (
                                <button
                                  className="pg-btn pg-btn-ghost pg-btn-sm"
                                  title="Pause match"
                                  onClick={() => doMatchAction('pause', m.uuid)}
                                >
                                  <i className="fas fa-pause" />
                                </button>
                              )}
                              {m.status === 'PAUSED' && (
                                <button
                                  className="pg-btn pg-btn-ghost pg-btn-sm"
                                  title="Resume match"
                                  onClick={() => doMatchAction('resume', m.uuid)}
                                >
                                  <i className="fas fa-play" />
                                </button>
                              )}
                              <button
                                className="pg-btn pg-btn-ghost pg-btn-sm"
                                title="Stop match"
                                onClick={() => doMatchAction('stop', m.uuid)}
                              >
                                <i className="fas fa-stop" />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-end mt-3">
              <button className="pg-btn pg-btn-ghost" onClick={closeGuestDetail}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Stacked match detail modal */}
      {matchDetail && (
        <MatchDetailModal detail={matchDetail} onClose={() => setMatchDetail(null)} />
      )}
    </div>
  )
}
