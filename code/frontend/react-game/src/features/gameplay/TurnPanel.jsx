import { useTranslation } from '../../i18n/context'

/**
 * TurnPanel — Step 24 single-player turn cycle UI.
 *
 * Presentational component: it renders the turn queue (ordered by priority,
 * highest first) and exposes the two player actions:
 *   - "Start" when the match has not begun yet (no queue / status CREATED);
 *   - "Pass"  when the match is RUNNING, to hand the turn to the next character.
 *
 * The async work (calling the turn-cycle API) is owned by the parent, which
 * passes `onStart` / `onPass` callbacks and a `busy` flag. `sequence` is the
 * TurnSequence returned by GET /api/match/{uuid}/turn-sequence.
 */
export default function TurnPanel({ sequence, onStart, onPass, busy = false }) {
  const { t } = useTranslation()

  const queue = Array.isArray(sequence?.queue) ? sequence.queue : []
  const status = sequence?.status ?? 'CREATED'
  const isRunning = status === 'RUNNING'
  const activeUuid = sequence?.activeCharacterUuid ?? null

  return (
    <div className="turn-panel" data-testid="turn-panel">
      <div className="turn-panel-header">
        <span className="turn-panel-title">{t('game.turn.title')}</span>
        <span className="turn-panel-status" data-testid="turn-status">{status}</span>
      </div>

      {queue.length === 0 ? (
        <p className="turn-panel-empty">{t('game.turn.empty')}</p>
      ) : (
        <ol className="turn-queue">
          {queue.map((entry) => {
            const active = entry.characterUuid && entry.characterUuid === activeUuid
            return (
              <li
                key={entry.characterUuid ?? entry.idCharacter}
                className={`turn-queue-item${active ? ' is-active' : ''}`}
                data-testid="turn-queue-item"
              >
                <span className="turn-queue-name">
                  {entry.name ?? entry.characterUuid}
                </span>
                <span className="turn-queue-status">{entry.status}</span>
                {entry.passCounter > 0 && (
                  <span className="turn-queue-pass" title={t('game.turn.passCount')}>
                    ×{entry.passCounter}
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      )}

      <div className="turn-panel-actions">
        {isRunning ? (
          <button
            type="button"
            className="btn pg-btn"
            onClick={onPass}
            disabled={busy}
            data-testid="turn-pass-btn"
          >
            {t('game.turn.pass')}
          </button>
        ) : (
          <button
            type="button"
            className="btn pg-btn"
            onClick={onStart}
            disabled={busy}
            data-testid="turn-start-btn"
          >
            {t('game.turn.start')}
          </button>
        )}
      </div>
    </div>
  )
}
