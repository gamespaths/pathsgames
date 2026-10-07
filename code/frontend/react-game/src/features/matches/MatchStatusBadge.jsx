import { useTranslation } from '../../i18n/context'
import { MATCH_STATUS_BADGE } from '../../utils/matchStatus'

/**
 * MatchStatusBadge — Step 40: the match status as a stat badge, centred on the picture
 * (`inline` for a row of the history page). Shared by MatchCard and MatchLogCard.
 */
export default function MatchStatusBadge({ status, inline = false }) {
  const { t } = useTranslation()
  const badge = MATCH_STATUS_BADGE[status]
  const tone = badge?.tone ?? 'paused'
  return (
    <span className={`story-card-status story-card-status--${tone} stat-badge bonus-badge `
      + (inline ? 'story-card-status--inline' : 'story-card-status--center')}
      data-testid="match-status-badge">
      {badge && <i className={`${badge.icon} me-1`} />}
      {t(`matches.status.${status}`) || status}
    </span>
  )
}
