import { useTranslation } from '../../i18n/context'
import Card from '../../components/layout/Card'
import { ACTIVE_MATCH_STATUSES, HIDDEN_MATCH_STATUSES } from '../../utils/matchStatus'
import MatchStatusBadge from './MatchStatusBadge'

/**
 * MatchCard — small card for a user's match in the profile book.
 *
 * Step 40 — every card wears its status badge. Active match (CREATED/RUNNING): (i) + Resume;
 * any other (PAUSED/ENDED/GAMEOVER): a small Missions icon + a wide Log button (the history).
 * v1.7.0 step 9 — CANCELLED and BANNED are never opened (v1.8.0: in full colour); `highlighted` marks a match the last
 * login cancelled (v1.8.0: no "last played" line, the list order still uses it).
 *
 * onPreviewCard(infoObj) — (i), or Missions with `missionsOnly`; onHistory(infoObj) — Log.
 */
export default function MatchCard({ match, story, onResume, onPreviewCard, onHistory, highlighted = false }) {
  const { t } = useTranslation()

  const status    = match?.status ?? ''
  const resumable = ACTIVE_MATCH_STATUSES.has(status)
  const hidden    = HIDDEN_MATCH_STATUSES.has(status)
  const card      = story?.card ?? null
  const name      = story?.title ?? t('matches.unknownStory')

  const statusLabel = t(`matches.status.${status}`) || status
  const info = { card, story, statusLabel, match }

  const handlePreview = () => onPreviewCard?.(info)
  const handleHistory = () => onHistory?.(info)

  // A match that cannot be resumed: the Missions icon takes the (i) slot, Log the wide button.
  const buttons = hidden
    ? { locked: true, lockedIcon: 'fas fa-ban', lockInfo: { kind: 'match', label: statusLabel }, hidePreview: true }
    : !resumable
      ? { onSelect: handleHistory, selectLabel: t('matches.logOpen'), selectIcon: 'fa-history',
          onPreview: () => onPreviewCard?.({ ...info, missionsOnly: true }),
          infoIconClassName: 'fas fa-clipboard-list', infoLabel: t('game.missions.openAction') }
      : { onSelect: onResume, selectLabel: t('matches.resume'), onPreview: handlePreview }

  const extra = status === 'CANCELLED' ? (
    <p className="match-card-cancelled-note" data-testid="match-cancelled-note">{t('matches.cancelledKept')}</p>
  ) : null

  // v1.8.0 — cancelled and banned cards keep full colour (no muted style)
  const classes = highlighted ? 'pg-card--match-highlight' : ''

  return (
    <div className="match-card-wrap" data-testid="match-card" data-status={status}
      data-highlighted={highlighted ? 'true' : undefined}>
      <Card
        variant="little"
        card={card}
        name={name}
        icon="fas fa-book-open"
        {...buttons}
        extraContent={extra}
        extraContentClassName="match-card-extra"
        additionalCardClasses={classes || undefined}
        childrenIntoImage={<MatchStatusBadge status={status} />}
      />
    </div>
  )
}
