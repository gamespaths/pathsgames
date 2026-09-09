import MissionStepCard from './MissionStepCard'
import { orderedMissions } from '@/utils/missions'
import { useTranslation } from '@/i18n/context'

/**
 * MissionCards — Step 37. The missions page: one card per mission the match has reached, on
 * the RIGHT page of the book, in the grid the backpack and the registry already use.
 *
 * It owns no data of its own. The rows come from `/info`, which already carries every mission
 * with its steps, so opening the panel costs no request and what it shows can never disagree
 * with the board that served it.
 *
 * A mission the match has NOT reached is not here because the backend never sent it: listing
 * it would spoil it.
 */
export default function MissionCards({ missions, story, onPreview, onOpenMission,
  previewSide = 'right' }) {
  const { t } = useTranslation()
  const rows = orderedMissions(missions)

  return (
    <div className="config-view-wrap config-view--config">
      <div className="config-cards-area selection-list">
        {rows.length === 0
          ? <p className="game-empty">{t('game.missions.empty')}</p>
          : rows.map(mission => (
            <MissionStepCard key={mission.uuid ?? mission.name} mission={mission} story={story}
              onPreview={onPreview} onOpenMission={onOpenMission} previewSide={previewSide} />
          ))}
      </div>
    </div>
  )
}
