import { useState } from 'react'
import { useTranslation } from '@/i18n/context'
import Card from '@/components/layout/Card'
import BonusBadgeList from '@/components/ui/BonusBadgeList'
import { startMovement } from '@/api/matches'
import { lockedIconFor } from '@/constants/lockReasons'

/**
 * MovementCard — Step 28. A move-target card for one neighbor of the active
 * location. The neighbor (uuid, card, direction, base energyCost) comes from the
 * /info adapter (`gameData.locations`); `totalEnergyCost` is the weather-resolved
 * cost from the /locations endpoint and falls back to the base edge cost.
 *
 * Pressing the action button calls POST /gameplay/{match}/movements/start with
 * the neighbor's location uuid; on success the parent reloads the board.
 *
 * Whether the move is possible at all is the backend's call, not this card's: match-info
 * ships every neighbor with `available` and, when false, with the `reason` — the very code
 * action/move would return as its error (COMA, SLEEPING, MOVEMENT_CONDITION_NOT_MET,
 * LOCATION_FULL, …). So the card never guesses a cause it cannot know; it renders locked with
 * the translated reason. The local energy check survives only as the fallback for a backend
 * old enough to send no verdict.
 *
 * The locked state goes through `lockInfo`, never a `label` prop: CardButtons falls back to
 * the name and the hint would be lost (the no-label-prop-in-card convention).
 */
export default function MovementCard({variant=null,isNeighbor=true,viewFromMap=false,
  location, totalEnergyCost, playerStats, story, onPreview, previewSide='left', matchUuid, accessToken, onMoved, onError
}) {
  const { t } = useTranslation()
  const [moving, setMoving] = useState(false)

  const cost = totalEnergyCost ?? location?.energyCost ?? 0
  const energy = playerStats?.energy ?? 0
  // The backend now ships its own verdict on every neighbor of match-info: `available` is what
  // action/move would answer, and `reason` the code it would refuse with (COMA, SLEEPING,
  // MOVEMENT_CONDITION_NOT_MET, LOCATION_FULL, …) — causes the board cannot compute on its own.
  // An older payload carries neither: `available` is then null and the local energy check below
  // remains the only gate, exactly as before.
  
  const blockedByBackend = location?.available === false || playerStats.isComa || playerStats.isSleeping
  const backendReason = playerStats.isComa ? 'COMA' 
    : playerStats.isSleeping ? 'SLEEPING'
    : blockedByBackend ? (location?.reason ?? null) : null
  const affordable = energy >= cost
  const canMove = isNeighbor && affordable && !blockedByBackend
  const locked = (!canMove && !viewFromMap) || (!canMove && isNeighbor)

  // Two registers for the same refusal: the card has room for one word (it sits in a badge
  // next to the lock icon), the preview has room for the sentence that actually explains it.
  const lockInfo = canMove ? undefined
    : !isNeighbor ? t('game.movement.notNeighbor')
    : backendReason ? t(`game.movement.reason.${backendReason}`)
    // Refused, but by a backend too old to say why: state the refusal, do not invent a cause.
    : blockedByBackend ? t('game.movement.blocked')
    : t('game.movement.noEnergy')

  const lockInfoFull = canMove ? undefined
    : !isNeighbor ? t('game.movement.notNeighbor')
    : backendReason ? t(`game.movement.reasonFull.${backendReason}`)
    : blockedByBackend ? t('game.movement.blockedFull')
    : t('game.movement.reasonFull.INSUFFICIENT_ENERGY')

  // One table for every refusal icon (see constants/lockReasons). Without a backend verdict the
  // only cause the card can name on its own is the energy, so it asks for that code's icon.
  const lockedIcon = lockedIconFor(
    backendReason ?? (isNeighbor && !affordable ? 'INSUFFICIENT_ENERGY' : null))

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

  // v0.35.3 — a path can also charge coins, food and magic. The energy above is the
  // weather-resolved TOTAL (edge + destination entry + weather); these three come from the
  // edge alone, so they are reported as authored. Listed in the order the check procedure
  // reads them, and BonusBadgeList drops whatever sits at zero: a free path shows nothing.
  const costItems = [
    { key: 'energy', value: '' + cost, label: t('game.movement.cost') },
    { key: 'coins',  value: '' + (location?.costCoin  ?? 0), label: t('game.stats.coins') },
    { key: 'food',   value: '' + (location?.costFood  ?? 0), label: t('game.stats.food') },
    { key: 'magic',  value: '' + (location?.costMagic ?? 0), label: t('game.stats.magic') },
  ]
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
      
      locked={locked && !viewFromMap}
      lockInfo={lockInfo   }
      lockedIcon={lockedIcon}
      
      onPreview={() => {
        //handleSelectionPreviewFull(card, type, lockReason, statistics , showModal=true , additionalProps={})
        onPreview(location?.card ?? null, 'movement', lockInfoFull ?? null, null, true,
          canMove
            ? { onAction: handleMove, actionLabel: t('game.movement.action'),
                actionIcon: location?.awesomeIcon ?? location?.card?.awesomeIcon ?? "fa-walking"
                , actionLabelChildren: costBadge
                , /* extraContent: moveInfo, extraContentClassName: '' */ }
            : { extraContent: (<>{lockInfoFull}<div className='display-inline-flex'>{costBadge}</div></>) 
                , actionLabelChildren: costBadge }, previewSide)
      }} hidePreview={!isNeighbor || (viewFromMap && locked)   }
      story={story}
      flagInformationCard={!viewFromMap  }
      actionOnlyIfPreview={!viewFromMap}
      actionWithInfo={true}
      actionLabelChildren={viewFromMap ? costBadge : null}
      childrenIntoImage={!viewFromMap  ? costBadge : null}
      infoIconClassName={!canMove ? null 
        : (location?.awesomeIcon!=null && location?.awesomeIcon !== '') ? location?.awesomeIcon 
        : (location?.card?.awesomeIcon != null && location?.card?.awesomeIcon !== '') ? location?.card?.awesomeIcon 
        : "fas fa-location-arrow"}
      infoLabel={t('game.movement.action')}

      //from MAP neighbor locked -> no locked but show extraContent
      extraContent={ viewFromMap && locked ? (<>{lockInfoFull}<div className='display-inline-flex'>{costBadge}</div></>) : null }

      //flagShowFullStatistics={false}
      //statistics={costItems}
    />
  )
}
