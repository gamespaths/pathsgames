import ExperienceStatCard from './ExperienceStatCard'
import { expStatRows } from '@/utils/experience'

/**
 * ExperienceCards — Step 38. The training page: one ExperienceStatCard per stat, on the
 * RIGHT page of the book. It owns no data of its own: the values and the price list come
 * from `playerStats`, which match-info already carries — so opening the page costs no
 * request, and what it shows can never disagree with the board that served it.
 */
export default function ExperienceCards({
  playerStats, story, matchUuid, accessToken, onDone, onError,
}) {
  // What the player can buy comes first, in the order the price list renders otherwise.
  const rows = expStatRows(playerStats).sort((a, b) => Number(b.affordable) - Number(a.affordable))
  return (
    <div className="config-view-wrap config-view--config">
      <div className="config-cards-area selection-list">
        {rows.map(row => (
          <ExperienceStatCard key={row.stat} row={row} story={story}
            experience={playerStats?.experience ?? 0}
            matchUuid={matchUuid} accessToken={accessToken}
            onDone={onDone} onError={onError} />
        ))}
      </div>
    </div>
  )
}
