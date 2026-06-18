import { useTranslation } from '@/i18n/context'

/**
 * ConfirmStep — the "validate the next step" action shown at the page bottom once
 * the antibot check passes: Start (enabled only when the terms card above is
 * accepted) or Home. Single-player only for now; this is the branch point where
 * the future multiplayer JOIN / lobby action will live.
 */
export default function ConfirmStep({ termsAccepted, onStart, onHome }) {
  const { t } = useTranslation()

  return (
    <div className="start-match-status">
      <div className="start-match-actions">
        <button className="btn-start-game" onClick={onHome}>
          <i className="fas fa-home me-2" />{t('startMatch.home')}
        </button>
        <button className="btn-start-game" disabled={!termsAccepted} onClick={onStart}>
          <i className="fas fa-play me-2" />{t('book.startGame')}
        </button>
      </div>
    </div>
  )
}
