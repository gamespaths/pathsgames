import { useTranslation } from '../../i18n/context'
import Card from '../../components/layout/Card'

/**
 * StoryCard — one catalog story as the shared "little" Card: title, image, footer.
 * The footer spins until the matches answer, then says Play / Resume / Coming Soon.
 */
export default function StoryCard({ story, onClick, badge, pending = false, showActions = false }) {
  const { t } = useTranslation()
  const actionLabel = badge === 'active'
    ? t('home.badgeResume')
    : badge === 'paused'
      ? t('home.badgePaused')
      : t('home.badgePlay')
  const actionIcon = badge === 'paused' ? 'fa-pause' : 'fa-play'
  // Two ways a card has no button: the teaser has none at all, and until the matches
  // answer we cannot tell Play from Resume — that one waits behind a spinner.
  const waitingForMatches = !showActions && !story.comingSoon

  // Overlays sitting on the picture: category, plus the terminal/blocked match state.
  const imageOverlays = (
    <>
      <span className="story-card-badge">{story.category}</span>
      {badge === 'completed' && (
        <span className="story-card-status story-card-status--completed">
          <i className="fas fa-check-circle story-card-status__check me-1" />{t('home.badgeCompleted')}
        </span>
      )}
      {badge === 'paused' && (
        <span className="story-card-status story-card-status--paused">
          <i className="fas fa-pause me-1" />{t('home.badgePaused')}
        </span>
      )}
    </>
  )

  return (
    <Card
      variant="little"
      card={story.card}
      name={story.title}
      imageAlt={story.title}
      additionalCardClasses={`story-netflix-card${pending ? ' story-card--pending' : ''}`
        + (story.comingSoon ? ' story-card--soon pg-card--no-hover' : '')}
      childrenIntoImage={imageOverlays}
      locked={story.comingSoon === true || waitingForMatches}
      lockedIcon={waitingForMatches ? 'fas fa-spinner fa-spin' : 'fas fa-hourglass-half'}
      lockInfo={waitingForMatches ? t('home.loadingMatches') : t('book.comingSoon')}
      onAction={showActions && !story.comingSoon ? () => onClick(story) : undefined}
      actionLabel={actionLabel}
      actionIcon={actionIcon}
    >
      {/* v0.32.1 — the match list is still loading for this click: show it, so the
          player waits instead of clicking again. */}
      {pending && (
        <span className="story-card-pending-overlay">
          <i className="fas fa-spinner fa-spin" />
        </span>
      )}
    </Card>
  )
}
