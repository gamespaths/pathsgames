import { useTranslation } from '../../i18n/context'
import StoryCard from './StoryCard'
import DealtList from '@/components/layout/DealtList'
import { storyMatchBadge } from '../../utils/matchStatus'

/** Categories in first-seen order, each story (teasers included) inside its own: today's catalog order. */
export function catalogOrder(stories) {
  const categories = [...new Set(stories.map(s => s.category))]
  return categories.flatMap(cat => stories.filter(s => s.category === cat))
}

// v0.37.6 — `footerState`: 'loading' | 'blocked' | 'error' | 'ready' (see HomePage).
// Step 14 — one dealt grid on the Home's right page, the category as a badge on each card.
export default function StoryCatalog({ stories, matches, onStoryClick, pendingStoryUuid = null, footerState = 'loading' }) {
  const { t } = useTranslation()

  if (!stories || stories.length === 0) {
    return <p className="stories-empty">{t('home.noStories')}</p>
  }

  return (
    <div className="config-view-wrap">
      <DealtList className="config-cards-area selection-list home-stories">
        {catalogOrder(stories).map(story => (
          <StoryCard
            key={story.uuid}
            story={story}
            onClick={onStoryClick}
            badge={storyMatchBadge(matches, story.uuid)}
            pending={pendingStoryUuid === story.uuid}
            footerState={footerState}
          />
        ))}
      </DealtList>
    </div>
  )
}
