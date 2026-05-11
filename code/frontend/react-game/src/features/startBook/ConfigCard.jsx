import { useTranslation } from '../../i18n/context'
import GameCard from '../../components/layout/GameCard'

export default function ConfigCard({ type, value, locked, selected, story, onChangeClick, onSelect}) {
  const { t } = useTranslation()



  return (
    <GameCard
      story={story}
      hideCredits={false}
      card={value?.card}
      label={t(`book.${type}`)}
      imageAlt={value?.name}
      name={value?.name}
      icon={value?.icon}
      disabled={locked} locked={locked}
      selected={selected}
      onSelect={onSelect}
      onAction={onChangeClick}
      actionLabel={t('book.change')}
      actionIcon="fa-sync-alt"
      selectLabel={t('book.select')}
    />
  )
}
