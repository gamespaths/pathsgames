import { useState } from 'react'
import { useTranslation } from '../../i18n/context'
import { sleepCharacter } from '../../api/matches'

/**
 * SleepButton — voluntary sleep action with a confirm dialog (Step 26).
 *
 * Renders a game action button; clicking it opens a medieval-themed confirm
 * modal (controlled by React state, reusing the `.modal-content` look). On
 * confirm it POSTs `/api/gameplay/{uuid}/action/sleep`; on success it calls
 * `onSlept(result)` so the parent can refresh the clock and stats. Backend 409s
 * (ALREADY_SLEEPING / NOT_YOUR_TURN / MATCH_NOT_RUNNING) are surfaced inline.
 *
 * `disabled` should be set when the caller's character is already sleeping, to
 * avoid the 409 ALREADY_SLEEPING round-trip.
 */
export default function SleepButton({ matchUuid, accessToken, disabled = false, onSlept }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function confirm() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await sleepCharacter(matchUuid, accessToken)
      setOpen(false)
      onSlept?.(result)
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'sleep-failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className="modal-close-btn sleep-action-btn"
        disabled={disabled}
        onClick={() => { setError(null); setOpen(true) }}
      >
        <i className="fas fa-bed me-2" />{t('game.sleep.action')}
      </button>

      {open && (
        <div className="sleep-modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-content sleep-modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                <i className="fas fa-bed me-2" />{t('game.sleep.confirmTitle')}
              </h5>
              <button
                type="button"
                className="modal-custom-close"
                aria-label="close"
                onClick={() => setOpen(false)}
              >
                <i className="fas fa-times" />
              </button>
            </div>
            <div className="modal-body" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.7 }}>
              <p>{t('game.sleep.confirmBody')}</p>
              {error && (
                <p className="game-error">
                  <i className="fas fa-exclamation-triangle me-2" />{error}
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="modal-close-btn" onClick={() => setOpen(false)} disabled={busy}>
                {t('game.sleep.cancel')}
              </button>
              <button type="button" className="modal-close-btn sleep-confirm-btn" onClick={confirm} disabled={busy}>
                <i className="fas fa-bed me-2" />{t('game.sleep.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
