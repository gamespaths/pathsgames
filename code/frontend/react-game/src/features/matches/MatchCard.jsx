import { useTranslation } from '../../i18n/context'
import Card from '../../components/layout/Card'
import { ACTIVE_MATCH_STATUSES } from '../../utils/matchStatus'
import MatchStatusBadge from './MatchStatusBadge'

/**
 * MatchCard — small card for a user's match in the profile book.
 *
 * Step 40 — every card wears its status badge. Active match (CREATED/RUNNING): (i) + Resume;
 * any other (PAUSED/ENDED/GAMEOVER): a small Missions icon + a wide Log button (the history).
 *
 * onPreviewCard(infoObj) — (i), or Missions with `missionsOnly`; onHistory(infoObj) — Log.
 */
export default function MatchCard({ match, story, onResume, onPreviewCard, onHistory }) {
  const { t } = useTranslation()

  const status    = match?.status ?? ''
  const resumable = ACTIVE_MATCH_STATUSES.has(status)
  const card      = story?.card ?? null
  const name      = story?.title ?? t('matches.unknownStory')

  const statusLabel = t(`matches.status.${status}`) || status
  const info = { card, story, statusLabel, match }

  const handlePreview = () => onPreviewCard?.(info)
  const handleHistory = () => onHistory?.(info)

  // A match that cannot be resumed: the Missions icon takes the (i) slot, Log the wide button.
  const buttons = !resumable
    ? { onSelect: handleHistory, selectLabel: t('matches.logOpen'), selectIcon: 'fa-history',
        onPreview: () => onPreviewCard?.({ ...info, missionsOnly: true }),
        infoIconClassName: 'fas fa-clipboard-list', infoLabel: t('game.missions.openAction') }
    : { onSelect: onResume, selectLabel: t('matches.resume'), onPreview: handlePreview }

  return (
    <div className="match-card-wrap">
      <Card
        variant="little"
        card={card}
        name={name}
        icon="fas fa-book-open"
        {...buttons}
        childrenIntoImage={<MatchStatusBadge status={status} />}
      />
    </div>
  )
}
