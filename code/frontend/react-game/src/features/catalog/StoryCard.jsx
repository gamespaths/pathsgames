import { useTranslation } from '../../i18n/context'

export default function StoryCard({ story, onClick, badge }) {
  const { t } = useTranslation()
  return (
    <div className="pg-card pg-card--home story-netflix-card" onClick={() => onClick(story)}>
      {badge===null &&
         <span className="story-card-badge">{story.category}</span>
      }
      {badge === 'active' && (
        <span className="story-card-status story-card-status--active">
          <i className="fas fa-play me-1" />{t('home.badgeResume')}
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
