import { useState } from 'react'
import { useTranslation } from '@/i18n/context'
import Card from '@/components/layout/Card'
import { executeEvent } from '@/api/matches'
import BonusBadgeList from '@/components/ui/BonusBadgeList'
import { lockedIconFor } from '@/constants/lockReasons'

/**
 * ActionCard — Step 29. One card per NORMAL/ONCE event available at the active location.
 *
 * The backend has already decided whether the action can be taken: match-info ships every
 * event with `available` and, when false, with the `reason` — the very code
 * `execute-event` would return as its error. So this card never guesses: it either renders
 * locked with the translated reason, or it calls
 * POST /gameplay/{match}/action/execute-event and asks the parent to reload the board.
 *
 * The locked state goes through `lockInfo`, never a `label` prop: CardButtons falls back to
 * the name and the hint would be lost (the no-label-prop-in-card convention).
 */
export default function ActionCard({
  action, story, onPreview, previewSide = 'left',
  playerStats, matchUuid, accessToken, onDone, onError, // eslint-disable-line no-unused-vars
}) {
  const { t } = useTranslation()
  const [running, setRunning] = useState(false)

  const available = action?.available === true
  const locked = !available
  // Two registers for the same refusal: the card has room for one word (it sits in a badge next
  // to the lock icon), the preview has room for the sentence that actually explains it.
  // An older backend sends no reason: say "blocked" rather than invent a cause.
  const lockInfo = locked
    ? (action?.reason ? t(`game.event.reason.${action.reason}`) : t('game.event.blocked'))
    : undefined
  const lockInfoFull = locked
    ? (action?.reason ? t(`game.event.reasonFull.${action.reason}`) : t('game.event.blockedFull'))
    : undefined

  const cardData = action?.card ?? {
    title: action?.name, description: action?.description,
    urlImage: action?.urlImage, awesomeIcon: action?.awesomeIcon,
  }
  const actionIcon = action?.awesomeIcon ?? action?.card?.awesomeIcon ?? 'fas fa-bolt'

  async function handleExecute() {
    if (running || !matchUuid || !action?.uuid) return
    setRunning(true)
    try {
      const result = await executeEvent(matchUuid, action.uuid, accessToken)
      onDone?.(result)
    } catch (e) {
      console.error('execute-event failed', e?.response?.data?.error || e?.message)
      onError?.(e)
    } finally {
      setRunning(false)
    }
  }
  // v0.35.3 — an action can also cost coins, food and magic. The four are listed in the order
  // the check procedure reads them (energy, coin, food, magic), so the badges appear in the
  // same order the refusal would name them. BonusBadgeList drops whatever sits at zero, so a
  // free action still shows no badge at all.
  const costItems = [
    { key: 'energy', value: '' + (action?.energy ?? 0), label: t('game.movement.cost') },
    { key: 'coins',  value: '' + (action?.coin  ?? 0),  label: t('game.stats.coins') },
    { key: 'food',   value: '' + (action?.food  ?? 0),  label: t('game.stats.food') },
    { key: 'magic',  value: '' + (action?.magic ?? 0),  label: t('game.stats.magic') },
  ]
  const costBadge = (
    <BonusBadgeList items={costItems.map(item => ({ ...item, label: null }))} 
      className="player-stats-bar bonus-badge-list m-1 display-flex flex-direction-column" />
  ) 

  return (
    <Card
      card={cardData}
      entityType="action"
      //onAction={available ? handleExecute : undefined}
      //actionLabel={t('game.event.action')}
      actionIcon={actionIcon}
      locked={locked}
      lockInfo={lockInfo}
      lockedIcon={lockedIconFor(action?.reason)}
      onPreview={() => onPreview({
        card: action?.card ?? null,
        type: 'action',
        lockedReason: lockInfoFull ?? null,
        stats: [],
        side: previewSide,
        props: available
          ? { onAction: handleExecute, actionLabel: t('game.event.action'), actionIcon,
              actionLabelChildren: costBadge }
          : { extraContent: (<>{lockInfoFull}<div className='display-inline-flex'>{costBadge}</div></>) },
      })}
      story={story}
      flagInformationCard={true}
      childrenIntoImage={costBadge}
      actionWithInfo={true}
      infoLabel={t('game.event.action')}
      infoIconClassName={!locked ? "fas " + actionIcon : undefined}

    />
  )
}
