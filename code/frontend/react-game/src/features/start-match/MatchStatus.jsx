/**
 * MatchStatus — bottom-of-page status block for the match-creation phases:
 * spinner/countdown while starting or creating, a success state once created,
 * or an error with retry/home actions. Extracted from the former StartMatchPage.
 */
export default function MatchStatus({ phase, countdown, errorMsg, onRetry, onHome, t }) {
  if (phase === 'error') {
    const isTurnstileFail = errorMsg === 'TURNSTILE_VALIDATION_FAILED'
    return (
      <div className="start-match-status start-match-status--error">
        <p><i className="fas fa-exclamation-triangle me-2" />{t('startMatch.error')}</p>
        {errorMsg && <p className="start-match-error-detail">{errorMsg}</p>}
        <div className="start-match-actions">
          {!isTurnstileFail && (
            <button className="btn-start-game" onClick={onRetry}>
              <i className="fas fa-sync-alt me-2" />{t('startMatch.retry')}
            </button>
          )}
          <button className="btn-start-game" onClick={onHome}>
            <i className="fas fa-home me-2" />{t('startMatch.home')}
          </button>
        </div>
      </div>
    )
  }

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
}
