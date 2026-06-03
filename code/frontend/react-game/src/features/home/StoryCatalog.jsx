import { useTranslation } from '../../i18n/context'
import StoryCard from './StoryCard'
import { storyMatchBadge } from '../../utils/matchStatus'

export default function StoryCatalog({ stories, matches, onStoryClick }) {
  const { t } = useTranslation()

  if (!stories || stories.length === 0) {
    return (
      <div className="stories-section">
        <p className="stories-empty">{t('home.noStories')}</p>
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
                <StoryCard key={story.uuid} story={story} onClick={onStoryClick} badge={storyMatchBadge(matches, story.uuid)} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
