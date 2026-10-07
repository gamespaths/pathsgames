import { useTranslation } from '../../i18n/context'
import { isTutorialStory } from '../../constants/features'
import { storyMatchBadge } from '../../utils/matchStatus'

/** The first playable story of the tutorial category, in catalog order (coming-soon ones skipped). */
export function firstTutorialStory(stories) {
  return (Array.isArray(stories) ? stories : []).find(s => isTutorialStory(s) && s.comingSoon !== true) ?? null
}

/**
 * Step 42 — "Play the tutorial" on the home: the same click as the first tutorial story's card.
 * "Resume" while a match of it is open, hidden once it is finished, disabled while the matches load.
 */
export default function TutorialButton({ stories, matches, footerState, pendingStoryUuid = null, onStoryClick }) {
  const { t } = useTranslation()
  const story = firstTutorialStory(stories)
  if (!story) return null
  const badge = storyMatchBadge(matches, story.uuid)
  if (badge === 'completed') return null

  const loading = footerState === 'loading' || pendingStoryUuid === story.uuid
  const resume = badge === 'active' || badge === 'paused'
  const label = t(resume ? 'home.resumeTutorial' : 'home.playTutorial')
  return (
    <button type="button" className="btn-start-game home-tutorial-btn" data-testid="tutorial-btn"
      disabled={footerState !== 'ready' || pendingStoryUuid !== null} aria-busy={loading}
      onClick={() => onStoryClick(story)}>
      <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-play'} me-2`} aria-hidden="true" />{label}
    </button>
  )
}
