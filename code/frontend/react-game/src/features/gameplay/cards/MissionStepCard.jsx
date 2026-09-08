import Card from '@/components/layout/Card'
import { useTranslation } from '@/i18n/context'
import { missionProgressLabel } from '@/utils/missions'

/**
 * MissionStepCard — Step 37. One mission of the match, as a little card in the grid.
 *
 * The STATUS and the step progress ride as badges over the image, the way a registry key
 * carries its value. A closed mission is LOCKED rather than hidden: what the party finished
 * is part of the story it can still read.
 *
 * The lock hint travels as `lockInfo`, never as `label` — `label` is a display override and
 * would replace the mission's own name.
 */
const STATUS_ICON = {
  AVAILABLE: 'fas fa-clipboard-list',
  ACTIVE: 'fas fa-hourglass-half',
  COMPLETED: 'fas fa-circle-check',
  FAILED: 'fas fa-circle-xmark',
}

export default function MissionStepCard({ mission, story = null, onPreview,
  previewSide = 'right' }) {
  const { t } = useTranslation()
  const status = mission?.status
  const progress = missionProgressLabel(mission)
  const closed = status === 'COMPLETED' || status === 'FAILED'

  const badges = [
    { key: 'missionStatus', value: t(`game.missions.status.${status}`) || status, label: null,
      icon: STATUS_ICON[status] ?? 'fas fa-clipboard-list', color: null },
    ...(progress
      ? [{ key: 'missionSteps', value: progress, label: null, icon: 'fas fa-list-ol',
           color: null }]
      : []),
  ]

  const card = {
    ...(mission?.card ?? {}),
    title: mission?.card?.title || mission?.name,
    description: mission?.card?.description || mission?.description,
  }

  // The (i) opens a reading page whose whole point is the picture; without one the author
  // wrote no page worth turning to, so the button goes rather than opening an empty card.
  const hidePreview = !mission?.card?.urlImage && !mission?.description

  function openPreview() {
    onPreview?.({
      card,
      type: 'missions',
      stats: [
        { key: 'missionStatus', value: t(`game.missions.status.${status}`) || status,
          label: t('game.missions.statusLabel') },
        ...(progress
          ? [{ key: 'missionSteps', value: progress, label: t('game.missions.progress') }]
          : []),
      ],
      // Every step of the mission, in order, each saying whether this match has closed it.
      steps: (mission?.steps ?? []).map(s => ({ ...s })),
      side: previewSide,
    })
  }

  return (
    <Card
      card={card}
      entityType="missions"
      story={story}
      statistics={badges}
      flagShowFullStatistics
      bonusBadgeListLittleIntoImage
      bonusBadgeShowZeros
      locked={closed}
      lockedIcon={closed ? STATUS_ICON[status] : undefined}
      lockInfo={closed ? t(`game.missions.status.${status}`) : undefined}
      hidePreview={hidePreview}
      additionalCardClasses="pg-card--mission"
      onPreview={openPreview}
    />
  )
}
