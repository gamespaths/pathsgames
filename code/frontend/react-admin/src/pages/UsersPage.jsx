import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listAdminUsers } from '../api/userApi'
import LoadingSpinner from '../components/common/LoadingSpinner'
import ErrorAlert from '../components/common/ErrorAlert'
import { fmtDate, shortUuid } from '../components/match/MatchDetailModal'
import { STATE_FILTERS, buildUserQuery, errorText, isEmailSearch } from '../constants/userAdmin'
import UserStateBadge from '../components/user/UserStateBadge'

// UsersPage — v1.7.0 V1 step 11: the users list (GET /api/admin/users), one search box ("@" = exact email,
// else nickname prefix), the state filter and cursor paging; the email is never shown here.

const PAGE_LIMIT = 50

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [nextCursor, setNextCursor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState('2')
  const navigate = useNavigate()

  const emailSearch = isEmailSearch(search)

  const load = () => {
    setLoading(true)
    setError('')
    listAdminUsers(buildUserQuery(search, stateFilter, PAGE_LIMIT))
      .then(env => {
        setUsers(Array.isArray(env?.items) ? env.items : [])
        setNextCursor(env?.nextCursor ?? null)
      })
      .catch(e => { setUsers([]); setNextCursor(null); setError(errorText(e, 'Failed to load users')) })
      .finally(() => setLoading(false))
  }

  const loadMore = () => {
    if (!nextCursor) return
    setLoadingMore(true)
    setError('')
    listAdminUsers(buildUserQuery(search, stateFilter, PAGE_LIMIT, nextCursor))
      .then(env => {
        setUsers(prev => [...prev, ...(Array.isArray(env?.items) ? env.items : [])])
        setNextCursor(env?.nextCursor ?? null)
      })
      .catch(e => setError(errorText(e, 'Failed to load more users')))
      .finally(() => setLoadingMore(false))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [search, stateFilter])

  const submit = (e) => {
    e.preventDefault()
    setSearch(input.trim())
  }

  const clear = () => {
    setInput('')
    setSearch('')
  }

  const hint = emailSearch
    ? 'Exact email search: the state filter is ignored.'
    : (!search && stateFilter === '2' ? 'Active users, newest last access first.'
      : (!search && !stateFilter ? 'Without a search the list shows the active users.' : 'Alphabetical by nickname.'))

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="pg-page-title" style={{ margin: 0 }}><i className="fas fa-users" />Users</h2>
        <span style={{ color: 'var(--color-ash)', fontSize: '0.8rem' }}>Guests are in the Guest Users page.</span>
      </div>

      <ErrorAlert message={error} onClose={() => setError('')} />

      <form className="flex items-center gap-3 mb-2" onSubmit={submit} role="search">
        <div className="relative flex-1 min-w-0">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-ash)', fontSize: '0.8rem' }} />
          <input
            className="pg-input pl-8"
            placeholder="Nickname prefix, or the exact email (with @)…"
            aria-label="Search users"
            value={input}
            onChange={e => setInput(e.target.value)}
          />
        </div>
        <select
          className="pg-input"
          style={{ width: 'auto', flex: '0 0 auto' }}
          value={stateFilter}
          onChange={e => setStateFilter(e.target.value)}
          disabled={emailSearch}
          aria-label="Filter by state"
        >
          {STATE_FILTERS.map(s => <option key={s.value || 'any'} value={s.value}>{s.label}</option>)}
        </select>
        <button type="submit" className="pg-btn pg-btn-gold" style={{ flex: '0 0 auto' }}>
          <i className="fas fa-search" /> Search
        </button>
        <button type="button" className="pg-btn pg-btn-ghost" style={{ flex: '0 0 auto' }} onClick={clear}
                disabled={!input && !search}>
          <i className="fas fa-times" /> Clear
        </button>
        <button type="button" className="pg-btn pg-btn-ghost" style={{ flex: '0 0 auto', whiteSpace: 'nowrap' }} onClick={load}>
          <i className="fas fa-sync-alt" /> Refresh
        </button>
      </form>
      <p className="mb-4" data-testid="users-hint" style={{ color: 'var(--color-ash)', fontSize: '0.78rem' }}>{hint}</p>

      {loading ? (
        <LoadingSpinner text="Loading users…" />
      ) : (
        <div className="pg-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="pg-table">
              <thead>
                <tr>
                  <th>Nickname</th>
                  <th>User UUID</th>
                  <th>State</th>
                  <th>Role</th>
                  <th>Account</th>
                  <th>Registered</th>
                  <th>Last access</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--color-ash)' }}>No users found.</td></tr>
                )}
                {users.map(u => (
                  <tr key={u.uuid}>
                    <td>
                      <i className="fas fa-user me-1" style={{ color: 'var(--color-ash)', fontSize: '0.75rem' }} />
                      {u.nickname || <em style={{ color: 'var(--color-ash)' }}>no nickname</em>}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--color-ash)' }} title={u.uuid}>
                      {shortUuid(u.uuid)}
                    </td>
                    <td><UserStateBadge state={u.state} suspendedUntil={u.suspendedUntil} /></td>
                    <td>{u.role || '—'}</td>
                    <td>{u.accountType || '—'}</td>
                    <td style={{ fontSize: '0.8rem' }}>{fmtDate(u.tsRegistration)}</td>
                    <td style={{ fontSize: '0.8rem' }}>{fmtDate(u.tsLastAccess)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="pg-btn pg-btn-ghost pg-btn-sm" title="Open the user page"
                              aria-label={`Open user ${u.nickname || u.uuid}`} onClick={() => navigate(`/users/${u.uuid}`)}>
                        <i className="fas fa-up-right-from-square" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && users.length > 0 && (
        <div className="flex items-center justify-between mt-4">
          <span style={{ color: 'var(--color-ash)', fontSize: '0.85rem' }}>
            Showing {users.length} loaded{nextCursor ? ' — more available' : ' — all loaded'}
          </span>
          <button className="pg-btn pg-btn-ghost" onClick={loadMore} disabled={loadingMore || !nextCursor}>
            <i className="fas fa-angles-down" />{' '}
            {loadingMore ? 'Loading…' : nextCursor ? 'Load more' : 'No more pages'}
          </button>
        </div>
      )}
    </div>
  )
}
