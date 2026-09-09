import Card from '@/components/layout/Card'
import { useTranslation } from '@/i18n/context'
import { MISSION_STATUS_ICON, missionStatusBadge } from '@/utils/missions'

/**
 * MissionStepsCards — v0.37.1. The steps of ONE mission, on the RIGHT page, while the mission's
 * own card reads on the left: a mission is a list of things to do, and that list is the page.
 *
 * What the party has closed is shown in full, but only the FIRST step still open is: the ones
 * behind it are what the story has not asked for yet, and listing them would spoil the way.
 */

/** Every step already closed, plus the first one that is not — in the story's own order. */
export function visibleSteps(mission) {
  const steps = Array.isArray(mission?.steps) ? mission.steps : []
  const next = steps.findIndex(s => !s?.done)
  return next === -1 ? steps : steps.slice(0, next + 1)
}

export default function MissionStepsCards({ mission, story = null, onPreview,
  previewSide = 'right' }) {
  const { t } = useTranslation()
  const steps = visibleSteps(mission)

  return (
    <div className="config-view-wrap config-view--config">
      <div className="config-cards-area selection-list">
        {steps.length === 0
          ? <p className="game-empty">{t('game.missions.stepsEmpty')}</p>
          : steps.map((step, index) => {
            // A step closes for good, so a done one is LOCKED exactly as a closed mission is.
            const done = Boolean(step?.done)
            const card = {
              ...(step?.card ?? {}),
              title: step?.card?.title || step?.name,
              description: step?.card?.description || step?.description,
            }
            // A done step wears the mission's own Completed badge, not a spelling of its own.
            const badge = missionStatusBadge(t, 'COMPLETED')
            return (
              <Card key={step?.uuid ?? `${index}`}
                card={card}
                entityType="missions"
                story={story}
                statistics={done ? [badge] : []}
                flagShowFullStatistics
                bonusBadgeShowZeros
                locked={done}
                lockedIcon={done ? MISSION_STATUS_ICON.COMPLETED : undefined}
                lockInfo={done ? badge.value : undefined} flagInformationCard
                additionalCardClasses="pg-card--mission"
                onPreview={() => onPreview?.({ card, type: 'missions', side: previewSide })}
              />
            )
          })}
      </div>
    </div>
  )
}
