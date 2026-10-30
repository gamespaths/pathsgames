import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getAdminUser, banUser, suspendUser, unblockUser, relinkSubject, deleteOldUser,
} from '../api/userApi'
import { listMatches } from '../api/matchApi'
import LoadingSpinner from '../components/common/LoadingSpinner'
import ErrorAlert from '../components/common/ErrorAlert'
import { fmtDate, shortUuid, StatusBadge } from '../components/match/MatchDetailModal'
import { UuidCopy } from '../components/match/detail/matchDetailShared'
import UserStateBadge from '../components/user/UserStateBadge'
import ReasonModal from '../components/user/ReasonModal'
import { allowedActions, errorText, fmtPlayTime } from '../constants/userAdmin'

// UserDetailPage — v1.7.0 V1 step 11: profile (with the email), identities, state, statistics, sessions, the
// match history (GET /api/admin/matches?userUuid=) and the ban / suspend / unblock / re-link / deletion actions.

const MATCH_LIMIT = 20

const ACTIONS = {
  ban: {
    title: 'Ban user',
    message: 'Every session is revoked, the active matches become BANNED and the Google account and the email can no longer sign in.',
    run: (uuid, { reason }) => banUser(uuid, reason),
    done: r => `User banned${r?.bannedMatchUuids?.length ? `, ${r.bannedMatchUuids.length} active match(es) set to BANNED` : ''}.`,
  },
  suspend: {
    title: 'Suspend user',
    message: 'Every session is revoked; the user cannot sign in until the chosen day (UTC). Matches are untouched.',
    withUntil: true,
    run: (uuid, { reason, until }) => suspendUser(uuid, until, reason),
    done: r => `User suspended until ${fmtDate(r?.suspendedUntil)}.`,
  },
  unblock: {
    title: 'Unblock user',
    message: 'The user becomes active again; matches already BANNED stay BANNED.',
    danger: false,
    run: (uuid, { reason }) => unblockUser(uuid, reason),
    done: () => 'User unblocked.',
  },
  relink: {
    title: 'Arm the re-link of the Google subject',
    message: 'The next verified Google login with this email replaces the Google subject of this user (one time).',
    danger: false,
    run: (uuid, { reason }) => relinkSubject(uuid, reason),
    done: () => 'Re-link armed: the next Google login with this email replaces the subject.',
  },
  deletion: {
    title: 'Delete the old user',
    message: 'The user goes to state Deleting and the normal deletion job removes it. This cannot be undone.',
    run: (uuid, { reason }) => deleteOldUser(uuid, reason),
    done: () => 'User marked for deletion: the deletion job removes it.',
  },
}

const RELOAD_CODES = new Set(['INVALID_STATE_TRANSITION', 'USER_NOT_FOUND'])

function KeyValueTable({ rows, testId }) {
  return (
    <table className="pg-table" style={{ fontSize: '0.8rem' }} data-testid={testId}>
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label}><th style={{ width: '10rem' }}>{label}</th><td>{value}</td></tr>
        ))}
      </tbody>
    </table>
  )
}

export default function UserDetailPage() {
  const { uuid } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [matches, setMatches] = useState([])
  const [matchCursor, setMatchCursor] = useState(null)
  const [matchesLoading, setMatchesLoading] = useState(true)
  const [matchesError, setMatchesError] = useState('')
  const [dialog, setDialog] = useState(null) // { action, busy, error }

  const loadUser = useCallback(() => {
    setError('')
    return getAdminUser(uuid)
      .then(setUser)
      .catch(e => { setUser(null); setError(errorText(e, 'Failed to load the user')) })
      .finally(() => setLoading(false))
  }, [uuid])

  const loadMatches = useCallback((cursor) => {
    setMatchesLoading(true)
    setMatchesError('')
    return listMatches({ userUuid: uuid, limit: MATCH_LIMIT, ...(cursor ? { cursor } : {}) })
      .then(env => {
        const items = Array.isArray(env?.items) ? env.items : []
        setMatches(prev => (cursor ? [...prev, ...items] : items))
        setMatchCursor(env?.nextCursor ?? null)
      })
      .catch(e => setMatchesError(errorText(e, 'Failed to load the matches')))
      .finally(() => setMatchesLoading(false))
  }, [uuid])

  useEffect(() => {
    setLoading(true)
    void loadUser()
    void loadMatches(null)
  }, [loadUser, loadMatches])

  const runAction = async ({ reason, until }) => {
    const action = ACTIONS[dialog.action]
    setDialog(d => ({ ...d, busy: true, error: '' }))
    try {
      const result = await action.run(user.uuid, { reason, until })
      setDialog(null)
      setNotice(action.done(result))
      await Promise.all([loadUser(), loadMatches(null)])
    } catch (e) {
      setDialog(d => ({ ...d, busy: false, error: errorText(e) }))
      if (RELOAD_CODES.has(e?.code)) void loadUser()
    }
  }

  const openDialog = (action) => {
    setNotice('')
    setDialog({ action, busy: false, error: '' })
  }

  if (loading) return <LoadingSpinner text="Loading user…" />

  const allowed = allowedActions(user)
  const stats = user?.stats || {}
  const identities = Array.isArray(user?.identities) ? user.identities : []
  const label = user?.nickname || user?.username || uuid
  const current = dialog ? ACTIONS[dialog.action] : null

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="pg-page-title" style={{ margin: 0 }}><i className="fas fa-user" />{user ? label : 'User'}</h2>
        <div className="flex gap-2">
          <button className="pg-btn pg-btn-ghost" onClick={() => navigate('/users')}>
            <i className="fas fa-arrow-left" /> Users
          </button>
          <button className="pg-btn pg-btn-ghost" onClick={() => { void loadUser(); void loadMatches(null) }}>
            <i className="fas fa-sync-alt" /> Refresh
          </button>
        </div>
      </div>

      <ErrorAlert message={error} onClose={() => setError('')} />
      {notice && <div className="pg-alert pg-alert-success mb-3" role="status">{notice}</div>}

      {user && (
        <>
          <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
            <div className="pg-card">
              <p className="pg-card-title"><i className="fas fa-id-card me-1" />Profile</p>
              <KeyValueTable testId="user-profile" rows={[
                ['UUID', <UuidCopy key="uuid" uuid={user.uuid} />],
                ['Username', user.username ?? '—'],
                ['Nickname', user.nickname ?? '—'],
                ['Email', user.email ?? '—'],
                ['Role', user.role ?? '—'],
                ['Account', user.accountType ?? (user.guest ? 'GUEST' : '—')],
                ['State', <UserStateBadge key="state" state={user.state} suspendedUntil={user.suspendedUntil} />],
                ['Registration', fmtDate(user.tsRegistration)],
                ['Last access', fmtDate(user.tsLastAccess)],
                ['Open sessions', user.sessions ?? 0],
                ['Re-link armed', user.relinkPending ? 'yes' : 'no'],
                ['Ban hashes stored', user.banned ? 'yes' : 'no'],
              ]} />
            </div>
            <div className="pg-card">
              <p className="pg-card-title"><i className="fas fa-chart-bar me-1" />Statistics</p>
              <KeyValueTable testId="user-stats" rows={[
                ['Matches played', stats.matchesPlayed ?? 0],
                ['Completed', stats.matchesCompleted ?? 0],
                ['Game over', stats.matchesGameOver ?? 0],
                ['Play time', fmtPlayTime(stats.playTimeMs)],
                ['Clocks played', stats.clocksPlayed ?? 0],
                ['Matches created', user.matchCount ?? 0],
              ]} />
            </div>
          </div>

          <div className="pg-card mb-4">
            <p className="pg-card-title"><i className="fas fa-key me-1" />Identities</p>
            {identities.length === 0 ? (
              <p style={{ color: 'var(--color-ash)', fontSize: '0.85rem' }}>No login identity.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="pg-table" style={{ fontSize: '0.8rem' }} data-testid="user-identities">
                  <thead>
                    <tr><th>Provider</th><th>Subject</th><th>Email</th><th>Name</th><th>Picture</th><th>Locale</th><th>Profile update</th></tr>
                  </thead>
                  <tbody>
                    {identities.map(i => (
                      <tr key={`${i.provider}-${i.subject}`}>
                        <td>{i.provider}</td>
                        <td style={{ fontFamily: 'monospace' }}>{i.subject}</td>
                        <td>{i.email ?? '—'}</td>
                        <td>{i.profileName || [i.givenName, i.familyName].filter(Boolean).join(' ') || '—'}</td>
                        <td>{i.pictureUrl ? <a href={i.pictureUrl} target="_blank" rel="noopener noreferrer">open</a> : '—'}</td>
                        <td>{i.locale ?? '—'}</td>
                        <td>{fmtDate(i.tsProfileUpdate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
            <div className="pg-card" data-testid="user-actions">
              <p className="pg-card-title"><i className="fas fa-gavel me-1" />Actions</p>
              {user.guest && <p style={{ color: 'var(--color-ash)', fontSize: '0.85rem' }}>A guest: use the Guest Users page.</p>}
              {user.role === 'ADMIN' && <p style={{ color: 'var(--color-ash)', fontSize: '0.85rem' }}>An ADMIN can never be banned or suspended.</p>}
              <div className="flex flex-wrap gap-2">
                {allowed.ban && (
                  <button className="pg-btn pg-btn-danger pg-btn-sm" onClick={() => openDialog('ban')}>
                    <i className="fas fa-ban me-1" />Ban
                  </button>
                )}
                {allowed.suspend && (
                  <button className="pg-btn pg-btn-gold pg-btn-sm" onClick={() => openDialog('suspend')}>
                    <i className="fas fa-user-clock me-1" />Suspend
                  </button>
                )}
                {allowed.unblock && (
                  <button className="pg-btn pg-btn-gold pg-btn-sm" onClick={() => openDialog('unblock')}>
                    <i className="fas fa-unlock me-1" />Unblock
                  </button>
                )}
                {!allowed.ban && !allowed.suspend && !allowed.unblock && (
                  <span style={{ color: 'var(--color-ash)', fontSize: '0.85rem' }}>No action for this state.</span>
                )}
              </div>
            </div>
            <div className="pg-card" data-testid="mismatch-panel">
              <p className="pg-card-title"><i className="fas fa-people-arrows me-1" />IDENTITY_MISMATCH</p>
              <p style={{ color: 'var(--color-ash)', fontSize: '0.8rem' }} className="mb-2">
                The user signs in with a Google account whose subject differs from the stored one (same email).
              </p>
              {user.relinkPending && <p className="pg-badge pg-badge-gold mb-2">Re-link armed</p>}
              <div className="flex flex-wrap gap-2">
                <button className="pg-btn pg-btn-gold pg-btn-sm" disabled={!allowed.relink} onClick={() => openDialog('relink')}>
                  <i className="fas fa-link me-1" />Arm re-link of the Google subject
                </button>
                <button className="pg-btn pg-btn-danger pg-btn-sm" disabled={!allowed.deletion} onClick={() => openDialog('deletion')}>
                  <i className="fas fa-user-xmark me-1" />Delete the old user
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="pg-card" style={{ padding: 0, overflow: 'hidden' }}>
        <p className="pg-card-title" style={{ padding: '0.8rem 1rem 0' }}><i className="fas fa-gamepad me-1" />Matches</p>
        {matchesError && <div className="px-3"><ErrorAlert message={matchesError} /></div>}
        <div style={{ overflowX: 'auto' }}>
          <table className="pg-table" data-testid="user-matches">
            <thead>
              <tr><th>Name</th><th>Match UUID</th><th>Status</th><th>Clock</th><th>Created</th><th>Last played</th><th style={{ textAlign: 'right' }}>Open</th></tr>
            </thead>
            <tbody>
              {!matchesLoading && matches.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--color-ash)' }}>No matches.</td></tr>
              )}
              {matches.map(m => (
                <tr key={m.uuid}>
                  <td>{m.name || <em style={{ color: 'var(--color-ash)' }}>untitled</em>}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--color-ash)' }} title={m.uuid}>{shortUuid(m.uuid)}</td>
                  <td><StatusBadge status={m.status} /></td>
                  <td>{m.currentClock ?? 0}</td>
                  <td style={{ fontSize: '0.8rem' }}>{fmtDate(m.tsInsert)}</td>
                  <td style={{ fontSize: '0.8rem' }}>{fmtDate(m.tsUpdate)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="pg-btn pg-btn-ghost pg-btn-sm" title="Open the match page"
                            aria-label={`Open match ${m.name || m.uuid}`} onClick={() => navigate(`/matches/${m.uuid}`)}>
                      <i className="fas fa-up-right-from-square" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {matchesLoading && <LoadingSpinner text="Loading matches…" />}
        {!matchesLoading && matches.length > 0 && (
          <div className="flex items-center justify-between" style={{ padding: '0.6rem 1rem' }}>
            <span style={{ color: 'var(--color-ash)', fontSize: '0.85rem' }}>
              {matches.length} loaded{matchCursor ? ' — more available' : ' — all loaded'}
            </span>
            <button className="pg-btn pg-btn-ghost pg-btn-sm" disabled={!matchCursor} onClick={() => loadMatches(matchCursor)}>
              <i className="fas fa-angles-down" /> {matchCursor ? 'Load more' : 'No more pages'}
            </button>
          </div>
        )}
      </div>

      {dialog && current && (
        <ReasonModal
          title={current.title}
          message={`${label}: ${current.message}`}
          withUntil={!!current.withUntil}
          danger={current.danger !== false}
          busy={dialog.busy}
          error={dialog.error}
          onConfirm={runAction}
          onCancel={() => setDialog(null)}
        />
      )}
    </div>
  )
}
