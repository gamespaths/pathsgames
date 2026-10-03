import { useState } from 'react'
import { moveMatchOwner, errorBody } from '../../../api/matchApi'
import { getAdminUser } from '../../../api/userApi'
import { UserFields, reasonText } from './matchDetailShared'

/**
 * MoveOwnerModal — v0.41.6 paste a uuid, email or username, "Find" previews the user, "Confirm"
 * moves the match (creator and character) to it; the server errors are shown as they come.
 */

const failure = (e, fallback) => {
  const body = errorBody(e)
  return body.error ? `${body.error}: ${body.message ?? ''}`.trim() : (body.message || e?.message || fallback)
}

export default function MoveOwnerModal({ matchUuid, owner, running, onMoved, onCancel }) {
  const [identifier, setIdentifier] = useState('')
  const [preview, setPreview]       = useState(null)
  const [error, setError]           = useState('')
  const [busy, setBusy]             = useState(false)

  const sameOwner = Boolean(preview && owner && preview.uuid === owner.uuid)
  const canConfirm = Boolean(preview && preview.eligible !== false && !busy)

  async function find() {
    setBusy(true)
    setError('')
    setPreview(null)
    try {
      setPreview(await getAdminUser(identifier))
    } catch (e) {
      setError(failure(e, 'User not found'))
    } finally {
      setBusy(false)
    }
  }

  async function confirm() {
    setBusy(true)
    setError('')
    try {
      onMoved(await moveMatchOwner(matchUuid, identifier.trim()))
    } catch (e) {
      setError(failure(e, 'The move failed'))
      setBusy(false)
    }
  }

  return (
    <div className="pg-modal-backdrop" role="presentation"
         onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="pg-modal" style={{ maxWidth: '40rem' }} data-testid="move-owner-modal">
        <p className="pg-modal-title"><i className="fas fa-people-arrows me-2" />Move match to another user</p>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-parchment)' }}>
          Paste the uuid, the email or the username of the new owner. The match and its character move to it;
          the old user is not deleted.
        </p>
        {running && (
          <p className="pg-badge pg-badge-warning mb-2" data-testid="running-warning">
            The match is RUNNING: pause the match first if the player is online.
          </p>
        )}
        <form className="d-flex gap-2 mb-2" onSubmit={e => { e.preventDefault(); if (identifier.trim()) void find() }}>
          <input className="pg-input" style={{ flex: 1 }} placeholder="uuid, email or username"
                 aria-label="User identifier" value={identifier}
                 onChange={e => { setIdentifier(e.target.value); setPreview(null) }} />
          <button type="submit" className="pg-btn pg-btn-ghost" disabled={busy || !identifier.trim()}>
            <i className="fas fa-search me-1" />Find
          </button>
        </form>
        {error && <p className="pg-error" style={{ fontSize: '0.8rem' }} data-testid="move-error">{error}</p>}
        {preview && (
          <div className="mb-2" data-testid="move-preview">
            <UserFields user={preview} />
            {preview.eligible === false && (
              <p className="pg-error mt-2" style={{ fontSize: '0.8rem' }}>{reasonText(preview.reason)}</p>
            )}
            {sameOwner && (
              <p className="mt-2" style={{ fontSize: '0.8rem', color: 'var(--color-gold)' }}>
                This user already owns the match.
              </p>
            )}
          </div>
        )}
        <div className="flex gap-2 justify-end">
          <button className="pg-btn pg-btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="pg-btn pg-btn-gold" disabled={!canConfirm} onClick={() => { void confirm() }}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}
