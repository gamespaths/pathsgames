import { useLocation, useParams } from 'react-router-dom'
import StartBook from '@/features/start-book/StartBook'

/**
 * StoryPage — v1.13.0: route shell of `/story/:storyId` (was a modal of the Home). Router state
 * `{ story?, config? }`: the Home's story and the loadout to reopen with; a direct load has neither.
 */
export default function StoryPage() {
  const { storyId } = useParams()
  const { state } = useLocation()
  return <StartBook key={storyId} storyId={storyId} story={state?.story ?? null}
    initialConfig={state?.config ?? null} />
}
