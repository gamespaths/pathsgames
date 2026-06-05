import { useTranslation } from '../../i18n/context'
import ConfigCard from './ConfigCard'
import BonusBadgeList from '../../components/ui/BonusBadgeList'
import { aggregateBonusTotals } from '../../utils/bonusStats'
import { buildGameTypeCard, buildLoginCard } from '@/utils/loadoutCards'

export default function ConfigView({ config, story, onChangeClick, onPreview, onProceed }) {
  const { t } = useTranslation()

  const totals = aggregateBonusTotals([
    { entity: config.character,  type: 'character' },
    { entity: config.class,      type: 'class' },
    { entity: config.trait,      type: 'trait' },
    { entity: config.difficulty, type: 'difficulty' },
  ])
  const totalItems = totals.map(({ category, value }) => ({
    key: category,
    label: t(`book.stats.totals.${category}`),
    value,
  }))

  const gameTypeValue = buildGameTypeCard(t)
  const loginValue    = buildLoginCard(t)

  return (
    <div className="config-view-wrap config-view--config">

      <div className="config-cards-area selection-list">
        {/* Selectable cards: BOTH "Cambia" and the magnifying glass open the
            selection list + preview together (handled by onChangeClick). */}
        <ConfigCard type="class"      value={config.class}      story={story} onChangeClick={() => onChangeClick('class')}      onPreview={() => onChangeClick('class')}      count={story?.classes?.length}            onPagePreview={onPreview} />
        <ConfigCard type="character"  value={config.character}  story={story} onChangeClick={() => onChangeClick('character')}  onPreview={() => onChangeClick('character')}  count={story?.characterTemplates?.length} onPagePreview={onPreview} />
        <ConfigCard type="trait"      value={config.trait}      story={story} onChangeClick={() => onChangeClick('trait')}      onPreview={() => onChangeClick('trait')}      count={story?.traits?.length}             onPagePreview={onPreview} />
        <ConfigCard type="difficulty" value={config.difficulty} story={story} onChangeClick={() => onChangeClick('difficulty')} onPreview={() => onChangeClick('difficulty')} count={story?.difficulties?.length}       onPagePreview={onPreview} />
        {/* Locked cards: lens is preview-only (no selection list to open). */}
        <ConfigCard type="gameType"   value={gameTypeValue} locked onPreview={onPreview} />
        <ConfigCard type="login"      value={loginValue}    locked onPreview={onPreview} />
      </div>
      {totalItems.length > 0 && (
        <BonusBadgeList className="config-total-bonus" items={totalItems} />
      )}
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
