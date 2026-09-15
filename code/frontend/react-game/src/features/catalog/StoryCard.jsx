import { useTranslation } from '../../i18n/context'
import Card from '../../components/layout/Card'

/**
 * StoryCard — one catalog story as the shared "little" Card: title, image, footer.
 * v0.37.6 — the footer follows `footerState`: 'loading' spins until the antibot check
 * and the match list answer; 'blocked' (antibot failed) and 'error' (matches failed)
 * lock the card with a message; 'ready' says Play / Resume / Replay.
 */
export default function StoryCard({ story, onClick, badge, pending = false, footerState = 'loading' }) {
  const { t } = useTranslation()
  // v0.36.2 — a story the player has already finished offers Replay, not Play: the
  // click starts a brand-new match either way, but the card should say so.
  const actionLabel = badge === 'active'
    ? t('home.badgeResume')
    : badge === 'paused'
      ? t('home.badgePaused')
      : badge === 'completed'
        ? t('home.badgeReplay')
        : t('home.badgePlay')
  const actionIcon = badge === 'paused'
    ? 'fa-pause'
    : badge === 'completed' ? 'fa-rotate-right' : 'fa-play'
  // The teaser is locked for good; every other card is locked until the footer is 'ready'.
  const locked = story.comingSoon === true || footerState !== 'ready'
  const FOOTER_LOCK = {
    loading: { icon: 'fas fa-spinner fa-spin', text: t('home.loadingMatches') },
    blocked: { icon: 'fas fa-ban', text: t('home.footerBlocked') },
    error: { icon: 'fas fa-exclamation-triangle', text: t('home.footerError') },
  }
  const lock = story.comingSoon
    ? { icon: 'fas fa-hourglass-half', text: t('book.comingSoon') }
    : FOOTER_LOCK[footerState] ?? FOOTER_LOCK.loading

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
      locked={locked}
      lockedIcon={lock.icon}
      lockInfo={lock.text}
      onAction={!locked ? () => onClick(story) : undefined}
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
