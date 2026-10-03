import { useCallback, useEffect, useState } from 'react'
import { getMatchOwner, errorBody } from '../../../api/matchApi'
import { UserFields, reasonText } from './matchDetailShared'
import MoveOwnerModal from './MoveOwnerModal'

/**
 * UserCard — v0.41.6 the User tab: the owner (creator) of the match, and "Move" to give the match
 * and its character to another user (disabled on a terminated match).
 */

export { UserFields, reasonText }

export default function UserCard({ matchUuid, terminal, status, notice, onMoved }) {
  const [owner, setOwner]   = useState(null)
  const [error, setError]   = useState('')
  const [moving, setMoving] = useState(false)

  const load = useCallback(() => {
    setError('')
    return getMatchOwner(matchUuid)
      .then(setOwner)
      .catch(e => {
        setOwner(null)
        setError(errorBody(e).message || e?.message || 'Failed to load the owner')
      })
  }, [matchUuid])

  useEffect(() => { void load() }, [load])

  async function moved(result) {
    setMoving(false)
    const text = result?.status === 'UNCHANGED'
      ? `${result?.owner?.username ?? 'The user'} already owns this match.`
      : `Match moved from ${result?.previousOwner?.username ?? '—'} to ${result?.owner?.username ?? '—'}.`
    await load()
    if (onMoved) onMoved(text)
  }

  return (
    <div className="pg-card mb-4" data-testid="user-panel">
      {moving && (
        <MoveOwnerModal matchUuid={matchUuid} owner={owner} running={status === 'RUNNING'}
                        onMoved={(r) => { void moved(r) }} onCancel={() => setMoving(false)} />
      )}
      <div className="d-flex justify-content-between align-items-center mb-2">
        <p className="pg-card-title m-0"><i className="fas fa-user me-1" />Owner</p>
        <button className="pg-btn pg-btn-sm pg-btn-gold" disabled={terminal || !owner}
                title={terminal ? 'A terminated match cannot be moved' : 'Move the match to another user'}
                onClick={() => setMoving(true)} aria-label="Move match">
          <i className="fas fa-people-arrows me-1" />Move
        </button>
      </div>
      {notice && <p className="pg-badge pg-badge-success mb-2" data-testid="owner-notice">{notice}</p>}
      {error && <p className="pg-error" style={{ fontSize: '0.8rem' }}>{error}</p>}
      {!owner && !error && <p style={{ color: 'var(--color-ash)' }}>Loading…</p>}
      {owner && (
        <>
          <UserFields user={owner} />
          {owner.eligible === false && (
            <p className="pg-error mt-2" style={{ fontSize: '0.78rem' }}>{reasonText(owner.reason)}</p>
          )}
        </>
      )}
    </div>
  )
}
