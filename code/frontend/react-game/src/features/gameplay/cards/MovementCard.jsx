import { useState } from 'react'
import { useTranslation } from '@/i18n/context'
import Card from '@/components/layout/Card'
import BonusBadgeList from '@/components/ui/BonusBadgeList'
import { startMovement } from '@/api/matches'

/**
 * MovementCard — Step 28. A move-target card for one neighbor of the active
 * location. The neighbor (uuid, card, direction, base energyCost) comes from the
 * /info adapter (`gameData.locations`); `totalEnergyCost` is the weather-resolved
 * cost from the /locations endpoint and falls back to the base edge cost.
 *
 * Pressing the action button calls POST /gameplay/{match}/movements/start with
 * the neighbor's location uuid; on success the parent reloads the board. When the
 * character lacks the energy the card renders locked with a `lockInfo` hint (no
 * `label` prop — see the no-label-prop-in-card convention).
 */
export default function MovementCard({
  location, totalEnergyCost, playerStats, story, onPreview, matchUuid, accessToken, onMoved,
}) {
  const { t } = useTranslation()
  const [moving, setMoving] = useState(false)

  const cost = totalEnergyCost ?? location?.energyCost ?? 0
  const energy = playerStats?.energy ?? 0
  const canMove = energy >= cost

  async function handleMove() {
    if (moving || !matchUuid || !location?.uuid) return
    setMoving(true)
    try {
      const result = await startMovement(matchUuid, location.uuid, accessToken)
      onMoved?.(result)
    } catch (e) {
      console.error('movement failed', e?.response?.data?.error || e?.message)
    } finally {
      setMoving(false)
    }
  }

  const costItems = [{ key: 'energy', value: '-' + cost, label: null }]
  const costBadge = (
    <BonusBadgeList items={costItems}
      className="book-page-stats mb-0 display-ruby flex-direction-column" />
  )
  const moveInfo = (
    <div className="movement-info">
      <span>
        {location?.direction ? `${location.direction} · ` : ''}
        {t('game.movement.cost')} <strong>{costBadge}</strong>
      </span>
    </div>
  )

  return (
    <Card
      card={location?.card ?? { title: location?.name, description: location?.description,
        urlImage: location?.urlImage, awesomeIcon: location?.awesomeIcon }}
      entityType="movement"
      onAction={canMove ? handleMove : undefined}
      actionLabel={t('game.movement.action')}
      actionIcon="fa-person-walking"
      locked={!canMove}
      lockInfo={!canMove ? t('game.movement.noEnergy') : undefined}
      lockedIcon="fas fa-person-walking-arrow-right"
      onPreview={() => {
        onPreview(location?.card ?? null, 'movement', null, [], true,
          canMove
            ? { onAction: handleMove, actionLabel: t('game.movement.action'),
                actionIcon: 'fa-person-walking', extraContent: moveInfo, extraContentClassName: '' }
            : { extraContent: moveInfo, extraContentClassName: '' })
      }}
      story={story}
      flagInformationCard={true}
      actionOnlyIfPreview={true}
      actionWithInfo={true}
      childrenIntoImage={costBadge}
    />
  )
}
