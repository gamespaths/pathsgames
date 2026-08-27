import { useTranslation } from '../../i18n/context'

export default function StoryCard({ story, onClick, badge, pending = false }) {
  const { t } = useTranslation()
  return (
    <div
      className={`pg-card pg-card--home story-netflix-card${pending ? ' story-card--pending' : ''}`}
      onClick={() => onClick(story)}
    >
      {badge===null &&
         <span className="story-card-badge">{story.category}</span>
      }
      {/* v0.32.1 — the match list is still loading for this click: show it, so the
          player waits instead of clicking again. */}
      {pending && (
        <span className="story-card-pending-overlay">
          <i className="fas fa-spinner fa-spin" />
        </span>
      )}
      {badge === 'active' && (
        <span className="story-card-status story-card-status--active">
          <i className="fas fa-play me-1" />{t('home.badgeResume')}
        </span>
      )}
      {badge === 'paused' && (
        <span className="story-card-status story-card-status--paused">
          <i className="fas fa-pause me-1" />{t('home.badgePaused')}
        </span>
      )}
      {badge === 'completed' && (
        <span className="story-card-status story-card-status--completed">
          <i className="fas fa-check me-1" />{t('home.badgeCompleted')}
        </span>
      )}
      <div className="story-card-play-icon">
        <i className="fas fa-play" />
      </div>
      <img
        src={story.card?.urlImage}
        alt={story.title}
        className="story-card-img"
        loading="lazy"
      />
      <div className="story-card-body">
        <h4 className="story-card-title">{story.title}</h4>
      </div>
    </div>
  )
}
