import Card from '@/components/layout/Card'
import { useTranslation } from '@/i18n/context'
import { missionCard, missionPageStats, missionProgressLabel, missionStatusBadge, missionStepsBadge }
  from '@/utils/missions'

/**
 * MissionStepCard — Step 37. One mission of the match, as a little card in the grid.
 *
 * The step progress rides as a badge over the image, and so does the status once the mission
 * is CLOSED. Step 40 — a closed mission is no longer locked: its status is a badge like the
 * progress, and the footer keeps only the wide (i), as an open mission does.
 */
export default function MissionStepCard({ mission, story = null, onPreview, onOpenMission,
  previewSide = 'right' }) {
  const { t } = useTranslation()
  const status = mission?.status
  const progress = missionProgressLabel(mission)
  const closed = status === 'COMPLETED' || status === 'FAILED'
  // A mission that is DONE has nothing left to count: "Completed" is the whole answer.
  const done = status === 'COMPLETED'

  // Only a CLOSED mission badges its status: an open one simply IS available or active.
  const badges = [
    ...(closed ? [missionStatusBadge(t, status)] : []),
    ...(progress && !done ? [missionStepsBadge(t, progress)] : []),
  ]

  const card = missionCard(mission)

  // The (i) opens the reading page — worth turning to when the author wrote one, and worth it
  // anyway once the mission has steps, since that page is now where they are read.
  const hidePreview = !mission?.card?.urlImage && !mission?.description
    && !(mission?.steps ?? []).length

  function openPreview() {
    const stats = missionPageStats(t, mission)
    // v0.37.1 — the mission reads on the LEFT page and its steps fill the right one. The old
    // single-page preview is the fallback for a caller that wired no mission door.
    if (onOpenMission) {
      onOpenMission({ mission, card, stats })
      return
    }
    onPreview?.({ card, type: 'missions', stats,
      steps: (mission?.steps ?? []).map(s => ({ ...s })), side: previewSide })
  }

  return (
    <Card
      card={card}
      entityType="missions"
      story={story}
      statistics={badges}
      flagShowFullStatistics
      bonusBadgeShowZeros
      flagInformationCard
      hidePreview={hidePreview}
      additionalCardClasses={`pg-card--mission${done ? ' pg-card--done' : ''}`}
      onPreview={openPreview}
    />
  )
}
