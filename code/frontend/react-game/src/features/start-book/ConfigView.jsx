import { useTranslation } from '../../i18n/context'
import Card from '../../components/layout/Card'
import BonusBadgeList from '../../components/ui/BonusBadgeList'
import { aggregateBonusTotals, buildConfigStatistics } from '../../utils/bonusStats'
import { buildStatisticsCard, buildNoTraitsCard } from '@/utils/loadoutCards'
import { hasChoiceForType } from './startBookOptions'

export default function ConfigView({ config, story, onChangeClick, onInfoClick, onPreview, onProceed }) {
  const { t } = useTranslation()

  // A type with a single option is already selected: no "Change", only an (i) that opens its detail.
  function selectableProps(type) {
    if (hasChoiceForType(type, story)) {
      return { onAction: () => onChangeClick(type), onPreview: () => onChangeClick(type) }
    }
    return { flagInformationCard: true, onPreview: () => onInfoClick?.(type) }
  }

  const selectedTraits = Array.isArray(config.traits) ? config.traits : []
  const noTraitsCard = selectedTraits.length === 0 ? buildNoTraitsCard(t) : null
  const statistics = buildConfigStatistics(config, t);
  const statisticsCard = buildStatisticsCard(t, statistics , story);
  const statisticCard1 = statistics.filter(cat => ['dexterity', 'intelligence', 'constitution'].includes(cat.key)) ;
  const statisticCard2 = statistics.filter(cat => ['life', 'energy', 'sad', 'weight'].includes(cat.key)) ;

  //const gameTypeValue = buildGameTypeCard(t)
  //const loginValue    = buildLoginCard(t)

  return (
    <div className="config-view-wrap config-view--config">

      <div className="config-cards-area selection-list">
        {/* Selectable cards: BOTH "Cambia" and the magnifying glass open the
            selection list + preview together (handled by onChangeClick). */}
        <Card card={config.class?.card} entityType="class" {...selectableProps('class')} story={story} />
        <Card card={config.character?.card} entityType="character" {...selectableProps('character')} story={story} />
        <Card card={statisticsCard} entityType="bonuses" flagInformationCard={false} story={story} 
          onPreview={() => onPreview(statisticsCard,"bonuses", null ,statisticCard1) } hidePreview={true}
          statistics={statisticCard1} flagShowFullStatistics={true} 
        />
        <Card card={selectedTraits[0]?.card ?? noTraitsCard} entityType="trait" {...selectableProps('trait')} story={story} />
        <Card card={config.difficulty?.card} entityType="difficulty" {...selectableProps('difficulty')} story={story} />
        <Card card={statisticsCard} entityType="bonuses" flagInformationCard={false} story={story} 
          onPreview={() => onPreview(statisticsCard,"bonuses", null ,statisticCard2) }  hidePreview={true}
          statistics={statisticCard2} flagShowFullStatistics={true} 
        />


        { /* <Card type="login"      value={loginValue}    locked onPreview={onPreview} /> */ }
      </div>
      {/* totalItems.length > 0 && (
        <BonusBadgeList className="config-total-bonus" items={totalItems} />
      )*/ }
      <div className="page-footer">
        <button
          className="btn-start-game"
          onClick={onProceed}
        >
          <i className="fas fa-play me-2" />{t('book.startGame')}
        </button>
      </div>


    </div>
  )
}
