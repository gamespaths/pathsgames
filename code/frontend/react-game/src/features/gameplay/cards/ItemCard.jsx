import { useState } from 'react'
import { useTranslation } from '@/i18n/context'
import Card from '@/components/layout/Card'
import { dropItem, useItem } from '@/api/matches'
import BonusBadgeList from '@/components/ui/BonusBadgeList'

/**
 * ItemCard — Step 34. One card per row of the calling character's inventory.
 *
 * The two actions live on the preview, not on the card face, exactly like ActionCard:
 * "use" is the primary action, "drop" rides in `actionsList`. Only a consumable item can
 * be used — a non-consumable one renders locked and can still be dropped, which is the
 * whole point of carrying it.
 *
 * Both calls name `item.uuid`, the INVENTORY ROW — never `item.itemUuid`, which is the
 * story definition. Using removes the row; the amount is not decremented.
 *
 * `use-item` answers the execute-event payload, so `onDone` is the board's
 * `handleEventExecuted`: an item carrying a SADNESS effect trips the Step 30 overflow or
 * coma and the handler already knows how to show it.
 *
 * The locked state goes through `lockInfo`, never a `label` prop: CardButtons falls back
 * to the name and the hint would be lost (the no-label-prop-in-card convention).
 */
export default function ItemCard({
  item, story, onPreview, previewSide = 'right',
  playerStats, matchUuid, accessToken, onDone, onDropped, onError, // eslint-disable-line no-unused-vars
}) {
  const { t } = useTranslation()
  const [running, setRunning] = useState(false)

  // The backend has already decided: `isConsumabile` is false for an item that can only
  // be carried. The class gates are enforced server-side and surface as an error code.
  const usable = item?.isConsumabile === true
  const locked = !usable
  // Two registers for the same refusal: the card has room for one word, the preview has
  // room for the sentence that explains it.
  const lockInfo = locked ? t('game.item.reason.ITEM_NOT_CONSUMABLE') : undefined
  const lockInfoFull = locked ? t('game.item.reasonFull.ITEM_NOT_CONSUMABLE') : undefined

  const cardData = item?.card ?? {
    title: item?.name ?? item?.itemUuid,
    awesomeIcon: 'fas fa-box',
  }
  // The fallback lands on items whose card carries no icon of its own — anything from a
  // potion to a scroll — so it says "something is about to happen" and nothing more
  // specific: a bottle would stone on a parchment.
  const actionIcon = item?.card?.awesomeIcon ?? 'fas fa-play'

  const amount = item?.amount ?? 1
  const weight = item?.weight ?? 0
  const badgeItems = [
    { key: 'weight', value: `${weight * amount}`, label: t('game.item.weight') },
  ]
  // The x IS the quantity symbol — no icon beside it. A plain letter, not the × sign:
  // that glyph is drawn smaller than the digits it sits next to, so the badge read as a
  // number with a speck in front of it.
  // The value stays a bare number so the zero-filter in BonusBadgeList still reads it.
  if (amount > 1) badgeItems.unshift({ key: 'amount', value: `${amount}`, prefix: 'x',
                                       label: t('game.item.amount') })
  // On the card FACE there is no room for labels, so the x carries the meaning on its own.
  const infoBadge = (
    <BonusBadgeList items={badgeItems.map(b => ({ ...b, label: null }))}
      className="player-stats-bar bonus-badge-list m-1 display-flex flex-direction-column" />
  )
  // In the DESCRIPTION the label spells it out ("Amount: 2"), so the x would only repeat
  // it. Card renders these itself, under book-page-desc — hence the raw items, not a
  // ready-made BonusBadgeList.
  const descriptionBadges = badgeItems.map(({ prefix, ...b }) => b)

  async function handleUse() {
    if (running || !matchUuid || !item?.uuid) return
    setRunning(true)
    try {
      const result = await useItem(matchUuid, item.uuid, accessToken)
      onDone?.(result)
    } catch (e) {
      console.error('use-item failed', e?.response?.data?.error || e?.message)
      onError?.(e)
    } finally {
      setRunning(false)
    }
  }

  async function handleDrop() {
    if (running || !matchUuid || !item?.uuid) return
    setRunning(true)
    try {
      const result = await dropItem(matchUuid, item.uuid, accessToken)
      onDropped?.(result)
    } catch (e) {
      console.error('drop-item failed', e?.response?.data?.error || e?.message)
      onError?.(e)
    } finally {
      setRunning(false)
    }
  }

  const dropAction = { label: '', icon: 'fa-trash m-1', onAction: handleDrop }

  return (
    <Card
      card={cardData}
      entityType="item"
      actionIcon={actionIcon}
      locked={locked}
      lockInfo={lockInfo}
      lockedIcon="fas fa-box"
      // handleSelectionPreviewFull(card, type, lockReason, statistics, showModal, additionalProps, side)
      onPreview={() => onPreview(item?.card ?? cardData, 'item', lockInfoFull ?? null,
        descriptionBadges, true,
        usable
          ? { onAction: handleUse, actionLabel: t('game.item.use'), actionIcon,
              actionsList: [dropAction], actionListClass: 'display-grid2' }
          : { extraContent: lockInfoFull, actionsList: [dropAction] },
        previewSide)}
      story={story}
      flagInformationCard={true}
      childrenIntoImage={infoBadge}
      actionWithInfo={true}
      infoLabel={t('game.item.use')}
      infoIconClassName={!locked ? 'fas ' + actionIcon : undefined}
    />
  )
}
