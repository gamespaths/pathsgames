import { useTranslation } from '../../i18n/context'
import Card from '../../components/layout/Card'
import { ACTIVE_MATCH_STATUSES, HIDDEN_MATCH_STATUSES, lastPlayedOf } from '../../utils/matchStatus'
import { formatRelative } from '../../utils/dates'
import MatchStatusBadge from './MatchStatusBadge'

/**
 * MatchCard — small card for a user's match in the profile book.
 *
 * Step 40 — every card wears its status badge. Active match (CREATED/RUNNING): (i) + Resume;
 * any other (PAUSED/ENDED/GAMEOVER): a small Missions icon + a wide Log button (the history).
 * v1.7.0 step 9 — a "last played" line; CANCELLED and BANNED are muted and never opened; `highlighted`
 * marks a match the last login cancelled.
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

  // Dates use the browser locale until step 16 formats them by language.
  const lastPlayed = formatRelative(lastPlayedOf(match))
  const extra = (lastPlayed || status === 'CANCELLED') ? (
    <>
      {lastPlayed && <p className="match-card-last-played" data-testid="match-last-played">
        <i className="fas fa-clock me-1" />{t('matches.lastPlayed')} {lastPlayed}
      </p>}
      {status === 'CANCELLED' && <p className="match-card-cancelled-note" data-testid="match-cancelled-note">
        {t('matches.cancelledKept')}
      </p>}
    </>
  ) : null

  const classes = [hidden ? 'pg-card--match-muted' : null, highlighted ? 'pg-card--match-highlight' : null]
    .filter(Boolean).join(' ')

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
