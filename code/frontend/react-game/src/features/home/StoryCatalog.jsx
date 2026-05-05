import { useTranslation } from '../../i18n/context'
import StoryCard from './StoryCard'

export default function StoryCatalog({ stories, onStoryClick }) {
  const { t } = useTranslation()

  if (!stories || stories.length === 0) {
    return (
      <div className="stories-section">
        <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('home.noStories')}</p>
      </div>
    )
  }

  const categories = [...new Set(stories.map(s => s.category))]

  return (
    <div>
      {categories.map(cat => {
        const catStories = stories.filter(s => s.category === cat)
        return (
          <div className="stories-section" key={cat}>
            <h2 className="section-label">
              <i className="fas fa-book-open me-2" />{cat}
            </h2>
            <div className="stories-grid">
              {catStories.map(story => (
                <StoryCard key={story.uuid} story={story} onClick={onStoryClick} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
