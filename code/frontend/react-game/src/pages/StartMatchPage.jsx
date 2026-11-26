import { useEffect } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import StartMatchFlow from '@/features/start-match/StartMatchFlow'
import { REDIRECT_STATE } from '@/components/book/bookSwap'

/**
 * StartMatchPage — route shell for `/start-match/:storyId`.
 *
 * Reached from the start book's "Start Game" with `{ story, config }` in the
 * router state. Thin by design: it guards the navigation state and delegates the
 * whole antibot → confirm → create → enter-game flow to StartMatchFlow. A direct
 * navigation (typed URL, new tab) has no state: v1.13.0 — back to the story page.
 */
export default function StartMatchPage() {
  const { storyId } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()

  const story = state?.story ?? null
  const config = state?.config ?? null

  useEffect(() => {
    if (!story || !config) navigate(`/story/${storyId}`, { replace: true, state: REDIRECT_STATE })
  }, [story, config, navigate, storyId])

  if (!story || !config) return null

  return <StartMatchFlow story={story} config={config} storyId={storyId} />
}
