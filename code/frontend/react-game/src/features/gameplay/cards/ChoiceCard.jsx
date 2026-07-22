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
 * Selecting is Step 32: `onSelect(choice)` is wired by the parent (for now it dismisses
 * the choices — the cost was already paid on open). The locked hint rides on `lockInfo`,
 * never a `label` prop (the no-label-prop-in-card convention).
 */
const DO_ICON = 'fa-hand-pointer'

export function choiceReasonLabel(t, reason) {
  if (!reason) return t('game.choices.unavailable')
  const key = `game.choices.reason.${reason}`
  const label = t(key)
  // t() returns the key itself on a miss — fall back to the generic label.
  return label === key ? t('game.choices.unavailable') : label
}

export default function ChoiceCard({
  choice, story, onPreview, previewSide = 'right', onSelect,
}) {
  const { t } = useTranslation()

  const available = choice?.available === true
  const locked = !available
  const lockInfo = locked ? choiceReasonLabel(t, choice?.reason) : undefined

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
      lockInfo={lockInfo}
      lockedIcon={lockedIconFor(choice?.reason)}

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
