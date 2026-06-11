import { useTranslation } from '../../i18n/context'
import GameCard from '../../components/layout/GameCard'

export default function ConfigCard({
    type, value, locked, lockedIcon,lockInfo,
    selected, story, onChangeClick, onSelect, onPreview, count , onPagePreview, selectLabel,
    selectedCount }) {
  const { t } = useTranslation()
  const singleOption = count === 1
  const previewHandler = singleOption ? () => onPagePreview(value, type) : onPreview ? () => onPreview(value, type) : undefined

  // Step 23 — the trait card shows how many traits are selected (multi-select)
  const label = t(`book.${type}`) + (selectedCount > 1 ? ` (${selectedCount})` : '')

  return (
    <GameCard
      variant="little"
      story={story}
      hideCredits={false}
      card={value?.card}
      label={label}
      imageAlt={value?.name}
      name={value?.name}
      icon={value?.icon}
      disabled={locked} locked={locked}  lockedIcon={lockedIcon} lockInfo={lockInfo}
      singleOption={singleOption}
      selected={selected}
      onSelect={!singleOption ?  onSelect : undefined}
      onAction={!singleOption ?  onChangeClick : undefined }
      onPreview={previewHandler}
      actionLabel={t('book.change')}
      actionIcon="fa-sync-alt"
      selectLabel={selectLabel ?? t('book.select')}
      
    />
  )
}
