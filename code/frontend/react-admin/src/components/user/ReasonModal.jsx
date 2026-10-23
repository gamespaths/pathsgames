import { useState } from 'react'
import useEscapeKey from '../../hooks/useEscapeKey'
import {
  USER_REASONS, REASON_MIN, composeReason, freeTextMax, reasonError, suspendBounds, untilError,
} from '../../constants/userAdmin'

/** ReasonModal — v1.7.0 the ConfirmModal of an admin user action with a reason (and the suspension end date). */
export default function ReasonModal({ title, message, withUntil = false, danger = true, busy = false, error = '',
  onConfirm, onCancel }) {
  useEscapeKey(onCancel, !busy)
  const [code, setCode] = useState('')
  const [text, setText] = useState('')
  const [until, setUntil] = useState('')
  const [touched, setTouched] = useState(false)

  const max = freeTextMax(code || 'OTHER')
  const reasonProblem = reasonError(code, text)
  const untilProblem = withUntil ? untilError(until) : ''
  const bounds = suspendBounds()
  const length = text.trim().length

  const confirm = () => {
    setTouched(true)
    if (reasonProblem || untilProblem || busy) return
    onConfirm({ reason: composeReason(code, text), until: withUntil ? until : undefined })
  }

  return (
    <div className="pg-modal-backdrop" role="presentation" onClick={e => { if (e.target === e.currentTarget && !busy) onCancel() }}>
      <div className="pg-modal" role="dialog" aria-label={title} style={{ maxWidth: 520 }}>
        <p className="pg-modal-title">
          {danger ? <i className="fas fa-exclamation-triangle text-red-400 me-2" /> : <i className="fas fa-question-circle me-2" />}
          {title}
        </p>
        {message && <p className="mb-3" style={{ fontSize: '0.95rem', color: 'var(--color-parchment)' }}>{message}</p>}
        {error && <div className="pg-alert pg-alert-danger mb-3" role="alert">{error}</div>}

        <label className="pg-label" htmlFor="reason-code">Reason</label>
        <select id="reason-code" className="pg-input mb-3" value={code} onChange={e => setCode(e.target.value)}>
          <option value="">Pick a reason…</option>
          {USER_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>

        <label className="pg-label" htmlFor="reason-text">Details</label>
        <textarea id="reason-text" className="pg-input" rows={4} maxLength={max} value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder={`Why (${REASON_MIN} to ${max} characters)`} />
        <div className="flex justify-between mb-3" style={{ fontSize: '0.75rem' }}>
          <span className="text-yellow-300">
            <i className="fas fa-user-shield me-1" />No personal data (no names, emails or addresses).
          </span>
          <span data-testid="reason-count" style={{ color: 'var(--color-ash)' }}>{length} / {max}</span>
        </div>

        {withUntil && (
          <>
            <label className="pg-label" htmlFor="suspend-until">Suspended until (UTC day)</label>
            <input id="suspend-until" type="date" className="pg-input mb-3" min={bounds.min} max={bounds.max}
                   value={until} onChange={e => setUntil(e.target.value)} />
          </>
        )}

        {touched && (reasonProblem || untilProblem) && (
          <p className="pg-error mb-3" role="status" style={{ fontSize: '0.8rem' }}>{reasonProblem || untilProblem}</p>
        )}

        <div className="flex gap-2 justify-end">
          <button className="pg-btn pg-btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className={`pg-btn ${danger ? 'pg-btn-danger' : 'pg-btn-gold'}`} onClick={confirm} disabled={busy}>
            {busy ? 'Working…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
