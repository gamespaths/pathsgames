import { useTranslation } from '@/i18n/context'
import Card from '@/components/layout/Card'
import { lockedIconFor } from '@/constants/lockReasons'

/**
 * Step 31 — ChoiceCard: one option of a choice-event, as a small board card.
 *
 * Mirrors ActionCard: the backend already decided whether the option is selectable
 * (`available`) and, when not, why (`reason`). So the card either renders locked with the
 * translated reason, or offers the (i) lens and a "Do" quick-select. Its enlarged preview
 * shows only the "Do" action.
 *
 * Step 32 — `onSelect(choice)` now resolves the option through select-choice. `busy` is
 * true while that call is in flight and locks every option, so a second click cannot
 * resolve a cycle the first one is already closing. The locked hint rides on `lockInfo`,
 * never a `label` prop (the no-label-prop-in-card convention).
 */
const DO_ICON = 'fa-hand-pointer'

export function choiceReasonLabel(t, reason, long = false) {
  if (!reason) return t('game.choices.unavailable')
  const key = long ? `game.choices.longReason.${reason}` : `game.choices.reason.${reason}`
  const label = t(key)
  // t() returns the key itself on a miss — fall back to the generic label.
  return label === key ? t('game.choices.unavailable') : label
}

export default function ChoiceCard({
  choice, story, onPreview, previewSide = 'right', onSelect, busy = false,
}) {
  const { t } = useTranslation()

  // While a resolution is in flight every option reads as locked, including this one:
  // the cycle is being closed and no second pick can land.
  const available = choice?.available === true && !busy
  const locked = !available
  const lockInfoShort = locked
    ? (busy && choice?.available === true
        ? t('game.choices.resolving')
        : choiceReasonLabel(t, choice?.reason))
    : undefined
  const lockInfo = locked
    ? (busy && choice?.available === true
        ? t('game.choices.resolving')
        : choiceReasonLabel(t, choice?.reason,true))
    : undefined

  const cardData = choice?.card ?? {
    title: choice?.name, description: choice?.description,
  }

  function handleDo() {
    if (!available) return
    onSelect?.(choice)
  }

  return (
    <Card story={story} variant="little"
      card={cardData}
      entityType="choice"
      
      locked={locked}
      lockInfo={lockInfoShort}
      lockedIcon={lockedIconFor(!busy ? choice?.reason : 'LOADING')}

      onSelect={available ? handleDo : undefined}
      actionIcon={DO_ICON}
      selectLabel={t('game.choices.do')}
      // The enlarged (i) preview offers only "Do" (available) or the reason (locked).
      onPreview={() => onPreview(choice?.card ?? cardData, 'choice', lockInfo ?? null, [], true,
        available
          ? { onAction: handleDo, actionLabel: t('game.choices.do'), actionIcon: DO_ICON }
          : { extraContent: lockInfo },
        previewSide)}
      
      flagInformationCard={true}
      //actionWithInfo={true}
      infoLabel={/*t('game.choices.do')*/''} 
      //infoIconClassName={!locked ? 'fas ' + DO_ICON : undefined}
    />
  )
}
