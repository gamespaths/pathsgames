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
export default function MovementCard({variant=null,isNeighbor=true,viewFromMap=false,
  location, totalEnergyCost, playerStats, story, onPreview, previewSide='left', matchUuid, accessToken, onMoved, onError
}) {
  const { t } = useTranslation()
  const [moving, setMoving] = useState(false)

  const cost = totalEnergyCost ?? location?.energyCost ?? 0
  const energy = playerStats?.energy ?? 0
  const canMoveEnergy = energy >= cost
  const canMove = canMoveEnergy && isNeighbor
  const locked = (!canMove && !viewFromMap) || (!canMoveEnergy && isNeighbor)

  async function handleMove() {
    if (moving || !matchUuid || !location?.uuid) return
    setMoving(true)
    try {
      const result = await startMovement(matchUuid, location.uuid, accessToken)
      onMoved?.(result)
    } catch (e) {
      console.error('movement failed', e?.response?.data?.error || e?.message)
      // Surface the failure to the GamePage so it is shown instead of failing silently.
      onError?.(e)
    } finally {
      setMoving(false)
    } 
  }

  const costItems = [{ key: 'energy', value: '' + cost, label: t('game.movement.cost') }]
  const costBadge = (
    <BonusBadgeList items={costItems.map(item => ({ ...item, label: null }))} 
      className="player-stats-bar bonus-badge-list m-1 display-flex flex-direction-column" />
  ) 
    /* const moveInfo = (
    <div className="movement-info">
      <span>
        { location?.direction ? `${location.direction} · ` : '' }
        { t('game.movement.cost')} <strong>{costBadge}</strong> */ /* display-inline-grid }
      </span>
    </div>
  )*/

  return (
    <Card variant={variant }
      card={location?.card ?? { title: location?.name, description: location?.description,
        urlImage: location?.urlImage, awesomeIcon: location?.awesomeIcon }}
      entityType="movement"
      onAction={canMove ? handleMove : undefined}
      actionLabel={t('game.movement.action')}
      actionIcon={location?.awesomeIcon ?? location?.card?.awesomeIcon ?? "fa-walking"}
      locked={ locked }
      lockInfo={!canMove ? (isNeighbor ? t('game.movement.noEnergy') : t('game.movement.notNeighbor')) : undefined}
      lockedIcon={isNeighbor ? "fas fa-bed" : "fas fa-ban"}
      onPreview={() => {
        //handleSelectionPreviewFull(card, type, lockReason, statistics , showModal=true , additionalProps={})
        onPreview(location?.card ?? null, 'movement', null, costItems, true,
          canMove
            ? { onAction: handleMove, actionLabel: t('game.movement.action'),
                actionIcon: location?.awesomeIcon ?? location?.card?.awesomeIcon ?? "fa-walking"
                , /* extraContent: moveInfo, extraContentClassName: '' */ }
            : { /* extraContent: moveInfo, extraContentClassName: ''*/ }, previewSide)
      }} hidePreview={!isNeighbor  }
      story={story}
      flagInformationCard={!viewFromMap  }
      actionOnlyIfPreview={!viewFromMap}
      actionWithInfo={true}
      childrenIntoImage={costBadge}
      infoIconClassName={!canMove ? null : location?.awesomeIcon ?? location?.card?.awesomeIcon ?? "fas fa-location-arrow"}
      infoLabel={t('game.movement.action')}
      //flagShowFullStatistics={false}
      //statistics={costItems}
    />
  )
}
