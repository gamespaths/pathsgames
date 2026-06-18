import { useTranslation } from '../../i18n/context'
import Card from '../../components/layout/Card'
import BonusBadgeList from '../../components/ui/BonusBadgeList'
import { aggregateBonusTotals, buildConfigStatistics } from '../../utils/bonusStats'
import { buildStatisticsCard } from '@/utils/loadoutCards'

export default function ConfigView({ config, story, onChangeClick, onPreview, onProceed }) {
  const { t } = useTranslation()

  const selectedTraits = Array.isArray(config.traits) ? config.traits : []
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
        <Card card={config.class?.card} entityType="class" onAction={() => onChangeClick('class')} onPreview={() => onChangeClick('class')} story={story} />
        <Card card={config.character?.card} entityType="character" onAction={() => onChangeClick('character')} onPreview={() => onChangeClick('character')} story={story} />
        <Card card={statisticsCard} entityType="bonuses" flagInformationCard={true} story={story} 
          onPreview={() => onPreview(statisticsCard,"bonuses", null ,statisticCard1) } 
          statistics={statisticCard1} flagShowFullStatistics={true} 
        />
        <Card card={selectedTraits[0]?.card ?? null} entityType="trait" onAction={() => onChangeClick('trait')} onPreview={() => onChangeClick('trait')} story={story} />
        <Card card={config.difficulty?.card} entityType="difficulty" onAction={() => onChangeClick('difficulty')} onPreview={() => onChangeClick('difficulty')} story={story} />
        <Card card={statisticsCard} entityType="bonuses" flagInformationCard={true} story={story} 
          onPreview={() => onPreview(statisticsCard,"bonuses", null ,statisticCard2) } 
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
