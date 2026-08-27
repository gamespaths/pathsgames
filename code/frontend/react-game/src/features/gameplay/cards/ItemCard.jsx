import { useState } from 'react'
import { useTranslation } from '@/i18n/context'
import Card from '@/components/layout/Card'
import { dropItem, useItem } from '@/api/matches'
import BonusBadgeList from '@/components/ui/BonusBadgeList'
import { isItemUsable, itemCarryBadges, itemDescriptionBadges, unitsPerUse, unitsPerDrop } from '@/utils/statBadges'
import { isBagOverloaded } from '@/utils/gamebook'

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
  const consumable = item?.isConsumabile === true
  // v0.35.1 — a usage spends `amountUse` units, so carrying fewer makes the action a
  // certain ITEM_NOT_ENOUGH. The engine still owns the refusal; greying the button out
  // only spares the player a click that was going to be answered with an error.
  const perUse = unitsPerUse(item)
  const carried = item?.amount ?? 1
  // The same predicate the bag sorts by (isItemUsable), so a locked card can never end up
  // among the usable ones.
  const usable = isItemUsable(item)
  const locked = !usable
  // Two registers for the same refusal: the card has room for one word, the preview has
  // room for the sentence that explains it. The figures ride on the long one, since the
  // sentence cannot interpolate them (the i18n helper takes a key and nothing else).
  const reasonKey = consumable ? 'ITEM_NOT_ENOUGH' : 'ITEM_NOT_CONSUMABLE'
  const lockInfo = locked ? t(`game.item.reason.${reasonKey}`) : undefined
  const lockInfoFull = !locked ? undefined
    : consumable
      ? `${t('game.item.reasonFull.ITEM_NOT_ENOUGH')} (${carried}/${perUse})`
      : t('game.item.reasonFull.ITEM_NOT_CONSUMABLE')

  const cardData = item?.card ?? {
    title: item?.name ?? item?.itemUuid,
    awesomeIcon: 'fas fa-box',
  }
  // The fallback lands on items whose card carries no icon of its own — anything from a
  // potion to a scroll — so it says "something is about to happen" and nothing more
  // specific: a bottle would stone on a parchment.
  const actionIcon = item?.card?.awesomeIcon ?? 'fas fa-play'

  // The x IS the quantity symbol — no icon beside it. Both lists come from the shared
  // helper: the card of an item just RECEIVED renders the same figures (GameBook), and one
  // copy of a figure cannot disagree with itself.
  // The value stays a bare number so the zero-filter in BonusBadgeList still reads it.
  const badgeItems = itemCarryBadges(item, t)
  // On the card FACE there is no room for labels, so the x carries the meaning on its own.
  const infoBadge = (
    <BonusBadgeList items={badgeItems.map(b => ({ ...b, label: null }))}
      className="player-stats-bar bonus-badge-list m-1 display-flex flex-direction-column" />
  )
  // Step 35 — the figures, then what using it promises: the same {statistic, value} rows
  // use-item will apply, straight off the inventory payload. The value is the AUTHORED
  // delta, before the clamp — a +5 life on a character one point from full still reads +5.
  // That is the effect as written, which is what a promise is.
  //
  // In the DESCRIPTION the label spells the amount out ("Amount: 2"), so the x would only
  // repeat it. Card renders these itself, under book-page-desc — hence the raw items, not a
  // ready-made BonusBadgeList.
  const descriptionBadges = itemDescriptionBadges(item, t)

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

  // v0.35.5 — the big card's buttons say how many units they move: a usage spends
  // `amountUse`, a drop removes `amountDrop` capped by what is held. Both are decided by the
  // engine, so the button promises exactly what the call will do. One unit is every item
  // that ever existed before v0.35.1, so it goes unsaid — the same silence the "per use"
  // badge keeps. The plain letter x, not the × sign, which is drawn smaller than the digits
  // and reads as a speck.
  const perDrop = unitsPerDrop(item)
  const withUnits = (label, units) => (units > 1 ? `${label} x${units}` : label)
  const useLabel = withUnits(t('game.item.use'), perUse)
  const dropLabel = withUnits(t('game.item.drop'), perDrop)

  // On the big card the bin is a real button, so it says what it does; on the row there is
  // room for the glyph alone (the aria-label carries the word).
  const dropAction = { label: dropLabel, icon: 'fa-trash m-1', onAction: handleDrop,
    ariaLabel: t('game.item.drop') }

  // v0.35.5 — over capacity the bin appears on the row itself, beside the (i). It does NOT
  // drop from there: dropping is irreversible, so the click opens the big card — the same
  // place the (i) opens — where the item can be read and the real bin carries its label.
  // Only a consumable row shows it: a carried-only one is dropped from its page, where the
  // player is looking at what they are about to lose.
  const overloaded = isBagOverloaded(playerStats)
  const showRowBin = overloaded && consumable
  const rowBin = { label: '', icon: 'fa-trash m-1', ariaLabel: t('game.item.drop'),
    onAction: openPreview }

  // The big card: the two actions of an item, or — when it cannot be used — the reason plus
  // the bin. Shared by the (i) and by the row bin, which lands on the very same page.
  function openPreview() {
    onPreview(item?.card ?? cardData, 'item', lockInfoFull ?? null,
      descriptionBadges, true,
      usable
        ? { onAction: handleUse, actionLabel: useLabel, actionIcon,
            actionsList: [dropAction], actionListClass: 'display-grid2' }
        : { extraContent: lockInfoFull, actionsList: [dropAction] },
      previewSide)
  }

  return (
    <Card
      card={cardData}
      entityType="item"
      actionIcon={actionIcon}
      locked={locked}
      lockInfo={lockInfo}
      lockedIcon="fas fa-box"
      // handleSelectionPreviewFull(card, type, lockReason, statistics, showModal, additionalProps, side)
      onPreview={openPreview}
      story={story}
      flagInformationCard={true}
      actionsList={showRowBin ? [rowBin] : []}
      actionListClass={showRowBin ? 'display-grid2' : null}
      childrenIntoImage={infoBadge}
      actionWithInfo={true}
      infoLabel={t('game.item.use')}
      // With the bin beside it there is no room for the word "use": the glyph says it, and
      // the label lives on as the button's aria-label.
      infoLabelClassName={showRowBin ? 'display-none' : undefined}
      infoIconClassName={!locked ? 'fas ' + actionIcon : undefined}
    />
  )
}
