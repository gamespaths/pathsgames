/**
 * MatchStatus — bottom-of-page error block of the match creation, with its retry action
 * (home is the book's (x)). The running phases read on their own cards since v0.38.3.
 */
export default function MatchStatus({ phase, countdown, errorMsg, onRetry, t }) {
  if (phase === 'error') {
    return (
      <div className="start-match-status start-match-status--error">
        <p><i className="fas fa-exclamation-triangle me-2" />{t('startMatch.error')}</p>
        {errorMsg && <p className="start-match-error-detail">{errorMsg}</p>}
        <div className="start-match-actions">
          {/* Retry is offered on every error: it re-runs the antibot check first. */}
          <button className="btn-start-game" onClick={onRetry}>
            <i className="fas fa-sync-alt me-2" />{t('startMatch.retry')}
          </button>
        </div>
      </div>
    )
  }

  return null
  /* v0.38.3 — the per-phase countdown text moved onto the phase cards; kept here, unused.
  const created = phase === 'created'
  // Per-phase status message; unknown phases fall back to the generic "starting".
  const PHASE_LABELS = {
    starting: 'startMatch.starting',
    creating: 'startMatch.creating',
    joining: 'startMatch.joining',
    running: 'startMatch.running',
    created: 'startMatch.created',
  }
  const label = t(PHASE_LABELS[phase] ?? 'startMatch.starting')
  const icon = created ? 'fas fa-check-circle' : 'fas fa-spinner fa-spin'

  return (
    <div className={`start-match-status${created ? ' start-match-status--ok' : ''}`}>
      <p>
        <i className={`${icon} me-2`} />
        {label}
        {countdown > 0 && (
          <span className="start-match-countdown"> ({countdown})</span>
        )}
      </p>
    </div>
  )
  */
}
