import { useState } from 'react'
import { listAdminUsers } from '../../api/userApi'

/** v1.7.0 step 12 — a user picked by nickname prefix through the admin users search (GET /api/admin/users). */
export const PICKER_LIMIT = 10

export default function UserPicker({ value, onChange }) {
  const [text, setText] = useState('')
  const [results, setResults] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const search = async () => {
    const nickname = text.trim()
    if (!nickname) return
    setBusy(true)
    setError('')
    try {
      const env = await listAdminUsers({ nickname, limit: PICKER_LIMIT })
      setResults(Array.isArray(env?.items) ? env.items : [])
    } catch (e) {
      setError(e.message || 'Search failed')
      setResults(null)
    } finally {
      setBusy(false)
    }
  }

  const pick = (user) => {
    onChange?.({ uuid: user.uuid, nickname: user.nickname ?? user.uuid })
    setResults(null)
    setText('')
  }

  if (value) {
    return (
      <span className="pg-badge pg-badge-info" data-testid="user-picker-value" style={{ whiteSpace: 'nowrap' }}>
        <i className="fas fa-user me-1" />{value.nickname}
        <button type="button" className="ms-2" aria-label="Clear user filter" onClick={() => onChange?.(null)}>
          <i className="fas fa-times" />
        </button>
      </span>
    )
  }
  return (
    <div className="relative" style={{ flex: '0 0 auto' }}>
      <div className="flex items-center gap-1">
        <input className="pg-input" style={{ width: '11rem' }} placeholder="User (nickname)…" value={text}
          aria-label="Filter by user" onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void search() }} />
        <button type="button" className="pg-btn pg-btn-ghost pg-btn-sm" onClick={() => void search()}
          disabled={busy || !text.trim()} aria-label="Search users">
          <i className={`fas ${busy ? 'fa-spinner fa-spin' : 'fa-search'}`} />
        </button>
      </div>
      {error && <div className="pg-alert pg-alert-danger mt-1" role="alert">{error}</div>}
      {results && (
        <ul className="pg-card absolute z-10 mt-1" data-testid="user-picker-results"
          style={{ padding: '0.3rem', minWidth: '14rem', listStyle: 'none' }}>
          {results.length === 0 && <li style={{ color: 'var(--color-ash)' }}>No users found.</li>}
          {results.map(u => (
            <li key={u.uuid}>
              <button type="button" className="pg-btn pg-btn-ghost pg-btn-sm" onClick={() => pick(u)}>
                {u.nickname ?? u.uuid}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
