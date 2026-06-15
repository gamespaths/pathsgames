import { useTranslation } from '../../i18n/context'

/**
 * ClockWidget — read-only display of the match clock (Step 26).
 *
 * Consumes the `ClockResponse` returned by `GET /api/match/{uuid}/clock`:
 *   { currentClock, clockLabelSingular, clockLabelPlural, anyCharacterSleeping, ... }
 *
 * The backend has no day/phase model yet, so we show the clock number and the
 * story's singular/plural label only (see Step 25 doc §10 note 1). When the story
 * has no clock-label text we fall back to "Clock N".
 */
export default function ClockWidget({ clock , className , title}) {
  const { t } = useTranslation()
  if (!clock) return null

  const value = clock.currentClock ?? 0
  const storyLabel = value === 1 ? clock.clockLabelSingular : clock.clockLabelPlural
  const label = storyLabel || t('game.clock.fallback').replace('{n}', value)

  return (
    <div className={`clock-widget mb-0 ${className}`}>
      {title && <span className="clock-widget-title">{title}</span>}
      <div className={`player-stats-bar bonus-badge-list mb-0 ${className}`}>
        <span className="stat-badge bonus-badge" title={t('game.clock.title')}>
          
          <i className="fas fa-hourglass-half me-2" />
          <span>{label}</span>
          <strong>{value}</strong>
          { /* <i className="fas fa-clock" style={{ color: 'var(--color-gold-light)' }} /> */ }
        </span>
        {clock.anyCharacterSleeping && (
          <span className="stat-badge bonus-badge" title={t('game.sleep.sleeping')}>
            <i className="fas fa-bed" style={{ color: '#9b8cff' }} />
            <span>{t('game.sleep.sleeping')}</span>
          </span>
        )}
      </div>
    </div>
  )
}
